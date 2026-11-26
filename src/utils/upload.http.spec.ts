import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CourseController } from 'src/course/course.controller';
import { CourseService } from 'src/course/course.service';
import { PurchaseController } from 'src/Purchase/purchase.controller';
import { PurchaseService } from 'src/Purchase/purchase.service';
import { LessonController } from 'src/lesson/lesson.controller';
import { LessonService } from 'src/lesson/lesson.service';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { LessonType } from 'src/utils/enums/lessonType.enum';
import { StatusEnum } from 'src/utils/enums/purchaseStatus.enum';

/** Real routing, multer and services; Cloudinary, DB and auth are stubbed. */
describe('upload routes over HTTP (stubbed Cloudinary)', () => {
  let app: INestApplication;
  const cloud: any = { uploadFile: jest.fn(async () => ({ secure_url: 'u', public_id: 'p', duration: 3 })) };
  const lessonRepo: any = {
    findOne: jest.fn(async () => ({ id: 1, type: LessonType.PDF, section: { id: 2 } })),
    save: jest.fn(async (x) => x),
  };
  const purchaseRepo: any = {
    findOne: jest.fn(async () => ({ id: 1, status: StatusEnum.PENDING, user: { id: 3 }, course: { id: 5, title: 'C', Instractor: { id: 9 } } })),
    save: jest.fn(async (x) => x),
    // conditional status update used when a payment proof is submitted
    createQueryBuilder: () => {
      const b: any = {};
      b.update = () => b; b.set = () => b; b.where = () => b;
      b.execute = async () => ({ affected: 1 });
      return b;
    },
  };
  const courseRepo: any = { create: jest.fn((x) => x), save: jest.fn(async (x) => x) };
  const notif: any = { creatNotification: jest.fn() };
  const sectionService: any = { getSection: jest.fn(async () => ({ id: 2, course: { id: 5 } })) };
  const courseSvcStub: any = { getSingleCourse: jest.fn(async () => ({ id: 5, Instractor: { id: 3 } })) };
  const authStub = { canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { id: 3, role: 'x' }; return true; } };

  beforeAll(async () => {
    const courseSvc = new CourseService(courseRepo, cloud, {} as any);
    const purchaseSvc = new PurchaseService(purchaseRepo, courseSvc, {} as any, cloud, notif);
    const lessonSvc = new LessonService(lessonRepo, sectionService, courseSvcStub, cloud, {} as any);
    const mod = await Test.createTestingModule({
      controllers: [CourseController, PurchaseController, LessonController],
      providers: [
        { provide: CourseService, useValue: courseSvc },
        { provide: PurchaseService, useValue: purchaseSvc },
        { provide: LessonService, useValue: lessonSvc },
      ],
    })
      .overrideGuard(AuthGuard).useValue(authStub)
      .overrideGuard(Roleguard).useValue({ canActivate: () => true })
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => cloud.uploadFile.mockClear());

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

  it('course create without thumbnail: 400, no upload', async () => {
    await request(app.getHttpServer()).post('/api/course/').field('title', 't').expect(400);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
  });
  it('course create with an image reaches the (stub) upload', async () => {
    await request(app.getHttpServer()).post('/api/course/').field('title', 't').attach('thumbnail', png, { filename: 'a.png', contentType: 'image/png' }).expect(201);
    expect(cloud.uploadFile).toHaveBeenCalledTimes(1);
  });
  const MB = 1024 * 1024;
  const post = (n: number) => request(app.getHttpServer()).post('/api/course/').field('title', 't').attach('thumbnail', Buffer.alloc(n), { filename: 'a.png', contentType: 'image/png' });
  const confirm = (n: number) => request(app.getHttpServer()).patch('/api/buy/confirm/5').field('transactionId', 't').field('paymentMethod', 'x').attach('thumbnail', Buffer.alloc(n), { filename: 'a.png', contentType: 'image/png' });
  it('course thumbnail that is not an image: 400, no upload', async () => {
    await request(app.getHttpServer()).post('/api/course/').field('title', 't').attach('thumbnail', Buffer.from('x'), { filename: 'a.pdf', contentType: 'application/pdf' }).expect(400);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
  });
  it('thumbnail: exactly 5 MB passes, 5 MB + 1 byte gets 413 with no upload', async () => {
    await post(5 * MB + 1).expect(413);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
    await post(5 * MB).expect(201);
    expect(cloud.uploadFile).toHaveBeenCalledTimes(1);
  });
  it('payment proof: exactly 10 MB passes, 10 MB + 1 byte gets 413 with no upload', async () => {
    await confirm(10 * MB + 1).expect(413);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
    await confirm(10 * MB).expect(200);
    expect(cloud.uploadFile).toHaveBeenCalledTimes(1);
  });
  it('payment proof that is not an image: 400, no upload', async () => {
    await request(app.getHttpServer()).patch('/api/buy/confirm/5').field('transactionId', 't').field('paymentMethod', 'x').attach('thumbnail', Buffer.from('x'), { filename: 'a.pdf', contentType: 'application/pdf' }).expect(400);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
  });
  it('purchase confirm without screenshot: 400, no upload', async () => {
    await request(app.getHttpServer()).patch('/api/buy/confirm/5').field('transactionId', 't').field('paymentMethod', 'x').expect(400);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
  });
  it('lesson upload without file: 400, no upload', async () => {
    await request(app.getHttpServer()).patch('/api/lesson/uploadFile/1').expect(400);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
  });
  it('lesson pdf that is not really a pdf: 400, no upload', async () => {
    await request(app.getHttpServer()).patch('/api/lesson/uploadFile/1').attach('file', Buffer.from('not a pdf'), { filename: 'a.pdf', contentType: 'application/pdf' }).expect(400);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
  });
  it('real pdf reaches the (stub) upload', async () => {
    await request(app.getHttpServer()).patch('/api/lesson/uploadFile/1').attach('file', Buffer.from('%PDF-1.4 x'), { filename: 'a.pdf', contentType: 'application/pdf' }).expect(200);
    expect(cloud.uploadFile).toHaveBeenCalledTimes(1);
  });
});
