import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService.destroyAsset (provider stubbed; real Cloudinary not exercised)', () => {
  const svc = new CloudinaryService({ get: () => 'x' } as any);
  afterEach(() => jest.restoreAllMocks());

  it('destroys exactly the given public_id', async () => {
    const spy = jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' } as any);
    expect(await svc.destroyAsset('course/images/abc')).toBe(true);
    expect(spy).toHaveBeenCalledWith('course/images/abc', { resource_type: 'image' });
  });
  it('returns false when the provider says not found', async () => {
    jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'not found' } as any);
    expect(await svc.destroyAsset('a')).toBe(false);
  });
  it('never throws on provider errors', async () => {
    jest.spyOn(cloudinary.uploader, 'destroy').mockRejectedValue(new Error('net'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await svc.destroyAsset('a')).toBe(false);
  });
  it('ignores an empty id without calling the provider', async () => {
    const spy = jest.spyOn(cloudinary.uploader, 'destroy');
    expect(await svc.destroyAsset('')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
