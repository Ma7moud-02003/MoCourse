import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as http from 'http';
import { mkdtempSync, readdirSync, writeFileSync, utimesSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { LessonType } from 'src/utils/enums/lessonType.enum';
import { sweepOldTempUploads, lessonUploadSlots } from 'src/common/upload/temp-upload';

/** Real routing, multer, temp-file storage and slot limiter. DB, auth guards and Cloudinary are stubbed. */
describe('lesson video upload over HTTP (disk-backed, stubbed provider)', () => {
  let app: INestApplication;
  let dir: string;
  let lessonType = LessonType.VIDEO;
  let ownerId = 3;
  const cloud: any = { uploadVideoFromPath: jest.fn(), uploadFile: jest.fn() };
  const lessonRepo: any = {
    findOne: jest.fn(async () => ({ id: 1, type: lessonType, section: { id: 2 } })),
    save: jest.fn(async (x) => x),
  };
  const sectionService: any = { getSection: jest.fn(async () => ({ id: 2, course: { id: 5 } })) };
  const courseSvc: any = { getSingleCourse: jest.fn(async () => ({ id: 5, Instractor: { id: ownerId } })) };
  const authStub = { canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { id: 3, role: 'x' }; return true; } };
  const left = () => readdirSync(dir);
  const settle = async (n = 20) => { for (let i = 0; i < n && left().length; i++) await new Promise((r) => setTimeout(r, 25)); };
  const vid = (n: number) => Buffer.alloc(n, 1);
  const put = (n: number, type = 'video/mp4') =>
    request(app.getHttpServer()).patch('/api/lesson/uploadFile/1').attach('file', vid(n), { filename: 'a.mp4', contentType: type });

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'vid-test-'));
    process.env.UPLOAD_TMP_DIR = dir;
    process.env.VIDEO_MAX_UPLOAD_BYTES = '1000';
    process.env.VIDEO_UPLOAD_CONCURRENCY = '1';
    const svc = new LessonService(lessonRepo, sectionService, courseSvc, cloud, {} as any);
    const mod = await Test.createTestingModule({ controllers: [LessonController], providers: [{ provide: LessonService, useValue: svc }] })
      .overrideGuard(AuthGuard).useValue(authStub)
      .overrideGuard(Roleguard).useValue({ canActivate: () => true })
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    lessonType = LessonType.VIDEO;
    ownerId = 3;
    cloud.uploadVideoFromPath.mockReset().mockResolvedValue({ url: 'u', publicId: 'p', durationSeconds: 7 });
    cloud.uploadFile.mockReset();
  });

  it('video within the cap streams from a temp file, is saved, and the temp file is removed', async () => {
    let seen = '';
    cloud.uploadVideoFromPath.mockImplementation(async (p: string) => { seen = p; expect(existsSync(p)).toBe(true); return { url: 'u', publicId: 'p', durationSeconds: 7 }; });
    const res = await put(1000).expect(200);
    expect(res.body.videoUrl).toBe('u');
    expect(res.body.duration).toBe(7);
    expect(seen.startsWith(dir)).toBe(true);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
    await settle();
    expect(left()).toEqual([]);
  });
  it('video over the cap: 413, provider never called, nothing left on disk', async () => {
    await put(1001).expect(413);
    expect(cloud.uploadVideoFromPath).not.toHaveBeenCalled();
    await settle();
    expect(left()).toEqual([]);
  });
  it('wrong declared type: 400, provider never called, temp file removed', async () => {
    await put(10, 'application/pdf').expect(400);
    expect(cloud.uploadVideoFromPath).not.toHaveBeenCalled();
    await settle();
    expect(left()).toEqual([]);
  });
  it('not the owner: 403, provider never called, temp file removed', async () => {
    ownerId = 99;
    await put(10).expect(403);
    expect(cloud.uploadVideoFromPath).not.toHaveBeenCalled();
    await settle();
    expect(left()).toEqual([]);
  });
  it('provider failure: error returned, temp file removed, slot freed', async () => {
    cloud.uploadVideoFromPath.mockRejectedValue(new Error('provider down'));
    await put(10).expect(500);
    await settle();
    expect(left()).toEqual([]);
    expect(lessonUploadSlots.inUse).toBe(0);
  });
  it('missing file: 400 and no provider call', async () => {
    await request(app.getHttpServer()).patch('/api/lesson/uploadFile/1').expect(400);
    expect(cloud.uploadVideoFromPath).not.toHaveBeenCalled();
    expect(lessonUploadSlots.inUse).toBe(0);
  });
  it('only one upload runs at a time: the second gets 503, a later one succeeds, nothing left on disk', async () => {
    let finish!: () => void;
    cloud.uploadVideoFromPath.mockImplementationOnce(() => new Promise((r) => { finish = () => r({ url: 'u', publicId: 'p', durationSeconds: 1 }); }));
    const first = put(10).then((r) => r);
    for (let i = 0; i < 50 && lessonUploadSlots.inUse === 0; i++) await new Promise((r) => setTimeout(r, 20));
    for (let i = 0; i < 50 && !cloud.uploadVideoFromPath.mock.calls.length; i++) await new Promise((r) => setTimeout(r, 20));
    await put(10).expect(503);
    finish();
    expect((await first).status).toBe(200);
    await put(10).expect(200);
    await settle();
    expect(left()).toEqual([]);
    expect(lessonUploadSlots.inUse).toBe(0);
  });
  it('client abort mid-upload frees the slot and leaves no temp file', async () => {
    const server = app.getHttpServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const boundary = 'xx';
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.mp4"\r\nContent-Type: video/mp4\r\n\r\n`;
    await new Promise<void>((resolve) => {
      const req = http.request({ port, method: 'PATCH', path: '/api/lesson/uploadFile/1', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': 5000 } });
      req.on('error', () => resolve());
      req.write(head + 'a'.repeat(500));
      setTimeout(() => { req.destroy(); setTimeout(resolve, 100); }, 100);
    });
    await settle(40);
    expect(left()).toEqual([]);
    expect(lessonUploadSlots.inUse).toBe(0);
    await put(10).expect(200);
  });
  it('PDF lessons still work through the same route (read from the temp file, uploaded as before)', async () => {
    lessonType = LessonType.PDF;
    cloud.uploadFile.mockResolvedValue({ secure_url: 'pu', public_id: 'pp' });
    const res = await request(app.getHttpServer()).patch('/api/lesson/uploadFile/1').attach('file', Buffer.from('%PDF-1.4 x'), { filename: 'a.pdf', contentType: 'application/pdf' }).expect(200);
    expect(res.body.pdfUrl).toBe('pu');
    expect(cloud.uploadFile).toHaveBeenCalledTimes(1);
    await settle();
    expect(left()).toEqual([]);
  });
  it('startup sweep removes only old upload- files', async () => {
    const old = join(dir, 'upload-old'); const fresh = join(dir, 'upload-fresh'); const other = join(dir, 'keep-me');
    [old, fresh, other].forEach((f) => writeFileSync(f, 'x'));
    const past = new Date(Date.now() - 2 * 3600 * 1000);
    utimesSync(old, past, past); utimesSync(other, past, past);
    expect(await sweepOldTempUploads()).toBe(1);
    expect(left().sort()).toEqual(['keep-me', 'upload-fresh']);
    [fresh, other].forEach((f) => require('fs').unlinkSync(f));
  });
});
