import { Writable } from 'stream';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const received: Buffer[] = [];
let opts: any;
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_chunked_stream: (o: any, cb: any) => {
        opts = o;
        return new Writable({
          write(chunk, _e, done) { received.push(chunk); done(); },
          final(done) { cb(null, { secure_url: 'https://x/v.mp4', public_id: 'course/vidoes/v', duration: 12.6 }); done(); },
        });
      },
    },
  },
}));

import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService.uploadVideoFromPath (provider stubbed)', () => {
  it('streams the file from disk and returns provider-neutral fields', async () => {
    const f = join(mkdtempSync(join(tmpdir(), 'cv-')), 'v.bin');
    writeFileSync(f, Buffer.alloc(300_000, 7));
    const svc = new CloudinaryService({ get: () => 'x' } as any);
    const r = await svc.uploadVideoFromPath(f, 'course/vidoes');
    expect(r).toEqual({ url: 'https://x/v.mp4', publicId: 'course/vidoes/v', durationSeconds: 13 });
    expect(opts).toEqual({ folder: 'course/vidoes', resource_type: 'video' });
    expect(Buffer.concat(received).length).toBe(300_000);
  });
  it('rejects when the file cannot be read', async () => {
    const svc = new CloudinaryService({ get: () => 'x' } as any);
    await expect(svc.uploadVideoFromPath('/nonexistent/file', 'f')).rejects.toThrow();
  });
});
