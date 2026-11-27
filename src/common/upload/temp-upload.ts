import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { StorageEngine } from 'multer';
import { createWriteStream, mkdirSync, promises as fs } from 'fs';
import { join } from 'path';
import { Observable, finalize } from 'rxjs';
import { OWN_DIR_NAME, ownTmpDir, uploadConcurrency, uploadTmpRoot, videoMaxBytes } from './upload.config';

const PREFIX = 'upload-';

/**
 * multer storage that writes the incoming file to a temp file instead of keeping it in memory.
 * The path is recorded on the request BEFORE any byte is written, so a rejected, oversized or aborted
 * upload (where multer never sets req.file) can still be cleaned up.
 */
export const tempDiskStorage: StorageEngine = {
  _handleFile(req: any, file, cb) {
    let path: string;
    try {
      const dir = ownTmpDir();
      mkdirSync(dir, { recursive: true });
      path = join(dir, PREFIX + randomBytes(16).toString('hex'));
    } catch (e) {
      return cb(e as Error);
    }
    (req.__tempUploadPaths ||= []).push(path);
    const out = createWriteStream(path);
    let done = false;
    const finish = (err: Error | null, info?: any) => {
      if (done) return;
      done = true;
      if (err) out.destroy();
      cb(err as any, info);
    };
    file.stream.pipe(out);
    file.stream.once('error', (e: Error) => finish(e));
    out.once('error', (e: Error) => finish(e));
    out.once('finish', () => finish(null, { path, size: out.bytesWritten }));
  },
  _removeFile(_req, file: any, cb) {
    fs.unlink(file.path).then(() => cb(null), () => cb(null));
  },
};

/**
 * multer 2.5+ accepts a file up to exactly `fileSize` and rejects anything larger, so the limit is the cap itself.
 * Read per request so an env override applies without code changes.
 */
export const lessonUploadLimits = {
  get fileSize() {
    return videoMaxBytes();
  },
};

/** Fixed number of upload slots shared by the whole process. */
export class UploadSlots {
  private used = 0;
  tryAcquire(max: number): (() => void) | null {
    if (this.used >= max) return null;
    this.used++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.used--;
      }
    };
  }
  get inUse() {
    return this.used;
  }
}

export const lessonUploadSlots = new UploadSlots();

/** Files whose deletion failed even after retries. They count against the bound, see below. */
export const stuckTempFiles = new Set<string>();

/** Delete a temp file. Missing file is success. Other errors are retried, then reported as false. */
async function removeFile(path: string, attempts = 3): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.unlink(path);
      return true;
    } catch (e: any) {
      if (e?.code === 'ENOENT') return true;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 20 * (i + 1)));
    }
  }
  return false;
}

/**
 * Put BEFORE FileInterceptor. It (1) takes one of a small, fixed number of upload slots or answers 503, and
 * (2) deletes the temp file on every exit: success, validation error, provider failure, multer rejection,
 * client abort.
 * The slot is freed after the delete. If a delete keeps failing, the slot is still freed (otherwise a few
 * bad files would block uploads forever) but the file is remembered in stuckTempFiles, logged, and retried on
 * the next request. Disk bound per process: (slots + stuck files) x cap, and new uploads get 503 while
 * stuck files >= slots, so the bound is at most 2 x slots x cap.
 */
@Injectable()
export class BoundedTempUploadInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const max = uploadConcurrency();
    const retry = [...stuckTempFiles].map((p) => removeFile(p, 1).then((ok) => ok && stuckTempFiles.delete(p)));
    void Promise.all(retry);
    if (stuckTempFiles.size >= max) {
      throw new HttpException('Upload storage needs attention, try again later', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const release = lessonUploadSlots.tryAcquire(max);
    if (!release) {
      throw new HttpException('Too many uploads in progress, try again in a moment', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return next.handle().pipe(
      finalize(() => {
        const paths: string[] = [...new Set([...(req.__tempUploadPaths ?? []), req.file?.path].filter(Boolean))];
        void Promise.all(
          paths.map(async (p) => {
            if (!(await removeFile(p))) {
              stuckTempFiles.add(p);
              console.error(`[upload] could not delete temp file ${p}; kept on the stuck list`);
            }
          }),
        ).finally(release);
      }),
    );
  }
}

/** true only when the process is provably gone (ESRCH). EPERM or anything else counts as not dead. */
function provablyDead(pid: number) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (e: any) {
    return e?.code === 'ESRCH';
  }
}

/**
 * Remove leftovers of OTHER processes. Call once at startup. Never touches this process's own folder.
 * A foreign folder p<pid>-<boot> is removed ONLY when its process is provably dead (kill(pid,0) gives ESRCH).
 * Age is never used: a live process may be in a long upload. A live, unknown (EPERM) or reused pid keeps its
 * folder, so an orphan can stay on disk until that pid is gone. This is deliberate: leaving an orphan is
 * safer than deleting an active file. On a shared or containerised host, pids are not comparable across
 * hosts or containers, so use a separate UPLOAD_TMP_DIR per instance and clean orphans there by hand if
 * needed. Returns the number of folders removed.
 */
export async function sweepOldTempUploads() {
  const root = uploadTmpRoot();
  let names: string[] = [];
  try {
    names = await fs.readdir(root);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of names) {
    const m = /^p(\d+)-[0-9a-f]+$/.exec(name);
    if (!m || name === OWN_DIR_NAME) continue;
    if (!provablyDead(Number(m[1]))) continue;
    try {
      await fs.rm(join(root, name), { recursive: true, force: true });
      removed++;
    } catch {
      /* keep, retry at next start */
    }
  }
  return removed;
}
