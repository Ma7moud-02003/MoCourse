import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { StorageEngine } from 'multer';
import { createWriteStream, mkdirSync, promises as fs } from 'fs';
import { join } from 'path';
import { Observable, finalize } from 'rxjs';
import { TEMP_MAX_AGE_MS, uploadTmpDir, videoConcurrency, videoMaxBytes } from './upload.config';

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
      const dir = uploadTmpDir();
      mkdirSync(dir, { recursive: true });
      path = join(dir, PREFIX + randomBytes(16).toString('hex'));
    } catch (e) {
      return cb(e as Error);
    }
    (req.__tempUploadPaths ||= []).push(path);
    const out = createWriteStream(path);
    file.stream.pipe(out);
    file.stream.once('error', (e: Error) => cb(e));
    out.once('error', (e: Error) => cb(e));
    out.once('finish', () => cb(null, { path, size: out.bytesWritten } as any));
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
    const release = lessonUploadSlots.tryAcquire(videoConcurrency());
    if (!release) {
      throw new HttpException('Too many uploads in progress, try again in a moment', HttpStatus.SERVICE_UNAVAILABLE);
    }
    // a client that drops the connection frees its slot even if the handler is still running
    req.once?.('close', () => {
      if (req.aborted) release();
    });
    return next.handle().pipe(
      finalize(() => {
        release();
        const paths: string[] = [...(req.__tempUploadPaths ?? []), req.file?.path].filter(Boolean);
        void Promise.all(paths.map((p) => removeQuietly(p)));
      }),
    );
  }
}

/** Remove leftovers from crashes. Call once at startup. Only touches our own prefixed files. */
export async function sweepOldTempUploads(now = Date.now()) {
  const dir = uploadTmpDir();
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of names) {
    if (!name.startsWith(PREFIX)) continue;
    const p = join(dir, name);
    try {
      const st = await fs.stat(p);
      if (now - st.mtimeMs > TEMP_MAX_AGE_MS) {
        await fs.unlink(p);
        removed++;
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}
