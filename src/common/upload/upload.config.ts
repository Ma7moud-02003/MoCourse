import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Interim defaults for lesson uploads. Everything can be overridden by env, so changing the media
 * provider or plan later is a config change, not a code change.
 *
 * Video default: 100,000,000 bytes. Cloudinary's compare-plans page lists "100 MB" max video size for the
 * free plan; it does not say MB or MiB, so the smaller decimal reading is used. This is a provisional
 * technical default, not a guarantee that the account accepts it.
 */
export const DEFAULT_VIDEO_MAX_BYTES = 100_000_000;
export const DEFAULT_VIDEO_CONCURRENCY = 2;
// temp files older than this are leftovers (crash, kill -9) and are removed at startup
export const TEMP_MAX_AGE_MS = 60 * 60 * 1000;

function positiveInt(raw: string | undefined, fallback: number) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export const videoMaxBytes = () => positiveInt(process.env.VIDEO_MAX_UPLOAD_BYTES, DEFAULT_VIDEO_MAX_BYTES);
export const videoConcurrency = () => positiveInt(process.env.VIDEO_UPLOAD_CONCURRENCY, DEFAULT_VIDEO_CONCURRENCY);
export const uploadTmpDir = () => process.env.UPLOAD_TMP_DIR || join(tmpdir(), 'mocourse-uploads');
