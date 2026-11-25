import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import * as http from 'http';
import { mkdtempSync, readdirSync, writeFileSync, utimesSync, existsSync, mkdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { LessonType } from 'src/utils/enums/lessonType.enum';
import { sweepOldTempUploads, lessonUploadSlots } from 'src/common/upload/temp-upload';
import { OWN_DIR_NAME, wholeNumber, uploadConcurrency, videoMaxBytes, DEFAULT_VIDEO_MAX_BYTES, DEFAULT_CONCURRENCY, MAX_CONCURRENCY, HARD_MAX_BYTES } from 'src/common/upload/upload.config';

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
  // every file under the shared temp root, whichever per-process folder it is in
  const left = (): string[] => readdirSync(dir).flatMap((d) => (statSync(join(dir, d)).isDirectory() ? readdirSync(join(dir, d)) : [d]));
  const settle = async (n = 20) => { for (let i = 0; i < n && left().length; i++) await new Promise((r) => setTimeout(r, 25)); };
  const vid = (n: number) => Buffer.alloc(n, 1);
  const put = (n: number, type = 'video/mp4') =>
    request(app.getHttpServer()).patch('/api/lesson/uploadFile/1').attach('file', vid(n), { filename: 'a.mp4', contentType: type });

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'vid-test-'));
    process.env.UPLOAD_TMP_DIR = dir;
    process.env.VIDEO_MAX_UPLOAD_BYTES = '1000';
    process.env.UPLOAD_CONCURRENCY = '1';
    process.env.PDF_MAX_UPLOAD_BYTES = '200';
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
    expect(seen.startsWith(join(dir, OWN_DIR_NAME))).toBe(true);
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
    for (let i = 0; i < 100 && lessonUploadSlots.inUse > 0; i++) await new Promise((r) => setTimeout(r, 50));
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
  it('PDF over PDF_MAX_UPLOAD_BYTES gets 413, is cleaned up, provider never called; video cap does not apply to it', async () => {
    lessonType = LessonType.PDF;
    const big = Buffer.concat([Buffer.from('%PDF-1.4 '), Buffer.alloc(300, 1)]); // 309 bytes: over the 200 PDF cap, under the 1000 video cap
    await request(app.getHttpServer()).patch('/api/lesson/uploadFile/1').attach('file', big, { filename: 'a.pdf', contentType: 'application/pdf' }).expect(413);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
    await settle();
    expect(left()).toEqual([]);
  });
  it('startup sweep: removes dead-process and stale folders, keeps live fresh folders and its own', async () => {
    const mk = (name: string, ageMs: number) => {
      const d = join(dir, name); mkdirSync(d, { recursive: true });
      const f = join(d, 'upload-x'); writeFileSync(f, 'x');
      const t = new Date(Date.now() - ageMs); utimesSync(f, t, t);
    };
    mk('p999999-aaaaaaaa', 0);                 // process id not alive -> removed even though fresh
    mk(`p${process.pid}-bbbbbbbb`, 2 * 3600e3); // pid looks alive but files are 2h old -> removed
    mk(`p${process.pid}-cccccccc`, 1000);       // pid alive, active file -> kept (another live process)
    mkdirSync(join(dir, OWN_DIR_NAME), { recursive: true }); // our own folder is never touched
    writeFileSync(join(dir, OWN_DIR_NAME, 'upload-mine'), 'x');
    writeFileSync(join(dir, 'unrelated.txt'), 'x');
    expect(await sweepOldTempUploads()).toBe(2);
    expect(readdirSync(dir).sort()).toEqual([OWN_DIR_NAME, `p${process.pid}-cccccccc`, 'unrelated.txt'].sort());
    expect(existsSync(join(dir, OWN_DIR_NAME, 'upload-mine'))).toBe(true);
  });
});

describe('upload env config validation', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  it.each([['abc'], ['0'], ['-5'], ['12.5'], [''], ['  '], ['NaN'], ['Infinity']])('video cap %p falls back to the default', (v) => {
    process.env.VIDEO_MAX_UPLOAD_BYTES = v;
    expect(videoMaxBytes()).toBe(DEFAULT_VIDEO_MAX_BYTES);
  });
  it('valid cap is used, huge cap is clamped', () => {
    process.env.VIDEO_MAX_UPLOAD_BYTES = '5000';
    expect(videoMaxBytes()).toBe(5000);
    process.env.VIDEO_MAX_UPLOAD_BYTES = '99999999999999999999';
    expect(videoMaxBytes()).toBe(DEFAULT_VIDEO_MAX_BYTES); // not a safe integer -> default
    process.env.VIDEO_MAX_UPLOAD_BYTES = String(2 ** 50);
    expect(videoMaxBytes()).toBe(HARD_MAX_BYTES);
  });
  it('concurrency: invalid or non-positive -> default, huge -> clamped', () => {
    for (const v of ['0', '-1', 'x', '1.5']) { process.env.UPLOAD_CONCURRENCY = v; expect(uploadConcurrency()).toBe(DEFAULT_CONCURRENCY); }
    process.env.UPLOAD_CONCURRENCY = '1000000'; expect(uploadConcurrency()).toBe(MAX_CONCURRENCY);
    process.env.UPLOAD_CONCURRENCY = '3'; expect(uploadConcurrency()).toBe(3);
  });
  it('wholeNumber basics', () => expect(wholeNumber(undefined, 7, 10)).toBe(7));
});

/** Real AuthGuard and Roleguard (real JWT verification). Only DB and Cloudinary are stubbed. */
describe('lesson upload route with the real guards', () => {
  let app: INestApplication;
  let dir: string;
  const SECRET = 'test-secret';
  const cloud: any = { uploadVideoFromPath: jest.fn(async () => ({ url: 'u', publicId: 'p', durationSeconds: 1 })), uploadFile: jest.fn() };
  const lessonRepo: any = { findOne: jest.fn(async () => ({ id: 1, type: LessonType.VIDEO, section: { id: 2 } })), save: jest.fn(async (x) => x) };
  const sectionService: any = { getSection: jest.fn(async () => ({ id: 2, course: { id: 5 } })) };
  const courseSvc: any = { getSingleCourse: jest.fn(async () => ({ id: 5, Instractor: { id: 3 } })) };
  let jwt: JwtService;
  const left = (): string[] => (existsSync(dir) ? readdirSync(dir).flatMap((d) => (statSync(join(dir, d)).isDirectory() ? readdirSync(join(dir, d)) : [d])) : []);
  const send = (token?: string) => {
    const r = request(app.getHttpServer()).patch('/api/lesson/uploadFile/1');
    if (token) r.set('Authorization', `Bearer ${token}`);
    return r.attach('file', Buffer.alloc(10, 1), { filename: 'a.mp4', contentType: 'video/mp4' });
  };

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'vid-guard-'));
    process.env.UPLOAD_TMP_DIR = dir;
    process.env.VIDEO_MAX_UPLOAD_BYTES = '1000';
    process.env.UPLOAD_CONCURRENCY = '2';
    const svc = new LessonService(lessonRepo, sectionService, courseSvc, cloud, {} as any);
    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRET })],
      controllers: [LessonController],
      providers: [{ provide: LessonService, useValue: svc }, { provide: ConfigService, useValue: { get: () => SECRET } }, AuthGuard, Roleguard],
    }).compile();
    jwt = mod.get(JwtService);
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it('no token: 401 and the temp directory is never even created', async () => {
    await send().expect(401);
    expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([]);
  });
  it('invalid token: 401, nothing written', async () => {
    await send('garbage').expect(401);
    expect(readdirSync(dir)).toEqual([]);
  });
  it('student token (wrong role): rejected by Roleguard before any disk write', async () => {
    const t = await jwt.signAsync({ id: 3, role: UserRoles.STUDENT });
    const res = await send(t);
    expect(res.status).toBe(401);
    expect(readdirSync(dir)).toEqual([]);
    expect(cloud.uploadVideoFromPath).not.toHaveBeenCalled();
  });
  it('instructor token for a lesson they do not own: 403, but ownership runs AFTER the file is written (then deleted)', async () => {
    const t = await jwt.signAsync({ id: 77, role: UserRoles.INSTRACTOR });
    await send(t).expect(403);
    expect(cloud.uploadVideoFromPath).not.toHaveBeenCalled();
    for (let i = 0; i < 40 && left().length; i++) await new Promise((r) => setTimeout(r, 25));
    expect(left()).toEqual([]);
  });
  it('owner instructor: 200', async () => {
    const t = await jwt.signAsync({ id: 3, role: UserRoles.INSTRACTOR });
    await send(t).expect(200);
  });
});
