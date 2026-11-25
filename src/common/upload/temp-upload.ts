import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { StorageEngine } from 'multer';
import { createWriteStream, mkdirSync, promises as fs } from 'fs';
import { join } from 'path';
import { Observable, finalize } from 'rxjs';
import { OWN_DIR_NAME, TEMP_MAX_AGE_MS, ownTmpDir, uploadConcurrency, uploadTmpRoot, videoMaxBytes } from './upload.config';

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
 * multer rejects a file that reaches `fileSize`, so the limit is cap + 1 to accept exactly the cap.
 * Read per request so an env override applies without code changes.
 */
export const lessonUploadLimits = {
  get fileSize() {
    return videoMaxBytes() + 1;
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

async function removeQuietly(path?: string) {
  if (!path) return;
  try {
    await fs.unlink(path);
  } catch {
    /* already gone */
  }
}

/**
 * Put BEFORE FileInterceptor. It (1) takes one of a small, fixed number of upload slots or answers 503, so
 * temp disk use is at most slots x max file size, and (2) deletes the temp file on every exit: success,
 * validation error, provider failure, multer rejection, client abort.
 */
@Injectable()
export class BoundedTempUploadInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const release = lessonUploadSlots.tryAcquire(uploadConcurrency());
    if (!release) {
      throw new HttpException('Too many uploads in progress, try again in a moment', HttpStatus.SERVICE_UNAVAILABLE);
    }
    // the slot is freed only AFTER the temp file is deleted, so slots x cap really bounds live temp disk use
    return next.handle().pipe(
      finalize(() => {
        const paths: string[] = [...(req.__tempUploadPaths ?? []), req.file?.path].filter(Boolean);
        void Promise.all(paths.map((p) => removeQuietly(p))).finally(release);
      }),
    );
  }
}

function processAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e: any) {
    return e?.code === 'EPERM'; // exists but not ours
  }
}

/**
 * Remove leftovers of OTHER processes. Call once at startup. Never touches this process's own folder.
 * A foreign folder (p<pid>-<boot>) is removed when its process is gone, or when every file in it is older
 * than TEMP_MAX_AGE_MS (covers a reused process id, e.g. container restarts). A live process's active
 * upload keeps its file's modified time fresh, so it is not removed. Returns the number of folders removed.
 */
export async function sweepOldTempUploads(now = Date.now()) {
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
    const dir = join(root, name);
    try {
      const files = await fs.readdir(dir);
      let newest = 0;
      for (const f of files) newest = Math.max(newest, (await fs.stat(join(dir, f))).mtimeMs);
      const stale = files.length === 0 || now - newest > TEMP_MAX_AGE_MS;
      if (!processAlive(Number(m[1])) || stale) {
        await fs.rm(dir, { recursive: true, force: true });
        removed++;
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}
