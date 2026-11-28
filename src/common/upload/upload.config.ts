import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Interim limits for lesson uploads. Env overrides are read per request, so changing the media provider
 * or plan later is a config change, not a code change. Invalid values (not a whole number, zero, negative,
 * empty) fall back to the default; values above the hard maximum are clamped to it.
 *
 * Video default 100,000,000 bytes (the owner's choice, matches Cloudinary's FREE plan video limit; Plus: 2 GB)
 * and PDF default 10,000,000 bytes. Raise VIDEO_MAX_UPLOAD_BYTES after upgrading the plan.
 */
export const DEFAULT_VIDEO_MAX_BYTES = 100_000_000;
export const DEFAULT_PDF_MAX_BYTES = 10_000_000;
export const DEFAULT_CONCURRENCY = 2;
export const MAX_CONCURRENCY = 16;
// no env value can raise a cap above this (keeps the cap an exact integer)
export const HARD_MAX_BYTES = 2 ** 40;
// a foreign temp folder whose files are all older than this is a leftover, even if its process id looks alive
export const TEMP_MAX_AGE_MS = 60 * 60 * 1000;

export function wholeNumber(raw: string | undefined, fallback: number, max: number) {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export const videoMaxBytes = () => wholeNumber(process.env.VIDEO_MAX_UPLOAD_BYTES, DEFAULT_VIDEO_MAX_BYTES, HARD_MAX_BYTES);
export const pdfMaxBytes = () => wholeNumber(process.env.PDF_MAX_UPLOAD_BYTES, DEFAULT_PDF_MAX_BYTES, HARD_MAX_BYTES);
export const uploadConcurrency = () => wholeNumber(process.env.UPLOAD_CONCURRENCY ?? process.env.VIDEO_UPLOAD_CONCURRENCY, DEFAULT_CONCURRENCY, MAX_CONCURRENCY);

/** Shared root for temp uploads. Each running process writes only inside its own subfolder of it. */
export const uploadTmpRoot = () => process.env.UPLOAD_TMP_DIR || join(tmpdir(), 'mocourse-uploads');
const BOOT_ID = randomBytes(4).toString('hex');
export const OWN_DIR_NAME = `p${process.pid}-${BOOT_ID}`;
export const ownTmpDir = () => join(uploadTmpRoot(), OWN_DIR_NAME);
