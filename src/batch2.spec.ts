import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { parsePaging, pageResult } from 'src/utils/pagination';
import { UserService } from 'src/User/user/user.service';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { ProgressService } from 'src/progress/progress.service';
import { EnrollmentService } from 'src/enrollment/enrollment.service';
import { CourseService } from 'src/course/course.service';

describe('pagination helper', () => {
  it('defaults to page 1, limit 10', () => {
    expect(parsePaging(undefined, undefined)).toEqual({ page: 1, limit: 10, skip: 0 });
  });
  it('reads page and limit, skips (page-1)*limit', () => {
    expect(parsePaging('3', '5')).toEqual({ page: 3, limit: 5, skip: 10 });
  });
  it('bad values fall back, limit is capped at 50', () => {
    expect(parsePaging('abc', '-4')).toEqual({ page: 1, limit: 10, skip: 0 });
    expect(parsePaging('0', '9999').limit).toBe(50);
  });
  it('page result has the same keys as notifications', () => {
    expect(pageResult([1], 11, 2, 10)).toEqual({ items: [1], page: 2, limit: 10, total: 11, totalPages: 2 });
  });
});

describe('course list pagination', () => {
  it('uses skip/take, a stable order and returns the page shape', async () => {
    const findAndCount = jest.fn(async () => [[{ id: 1 }], 25]);
    const svc = new CourseService({ findAndCount } as any, {} as any, {} as any);
    const r: any = await svc.getAllCourses('' as any, undefined, undefined, undefined, undefined, UserRoles.STUDENT, '2', '10');
    const a = (findAndCount.mock.calls[0] as any[])[0];
    expect(a.skip).toBe(10);
    expect(a.take).toBe(10);
    expect(a.order).toEqual({ createdAt: 'DESC', id: 'DESC' });
    expect(r).toEqual({ items: [{ id: 1 }], page: 2, limit: 10, total: 25, totalPages: 3 });
  });
});

describe('admin all_users', () => {
  it('is paginated and never returns password hashes', async () => {
    const findAndCount = jest.fn(async () => [[{ id: 1, email: 'a', password: 'hash' }], 1]);
    const svc = new UserService({ findAndCount } as any, {} as any, {} as any, {} as any);
    const r: any = await svc.getAllUsers('1', '20');
    expect(r.items[0]).toEqual({ id: 1, email: 'a' });
    expect(r.total).toBe(1);
  });
});

describe('deleteOwnAccount', () => {
  const make = async (role: UserRoles, courses = 0, students = 0) => {
    const hash = await bcrypt.hash('secret1', 4);
    const m: any = { count: jest.fn(async (e: any) => (e.name === 'CourseEntity' ? courses : students)) };
    const repo: any = { findOne: jest.fn(async () => ({ id: 4, role, password: hash })), manager: m };
    const svc = new UserService(repo, {} as any, {} as any, {} as any);
    svc.deleteUser = jest.fn(async () => ({ message: 'User Deleted Successfully' })) as any;
    return svc;
  };
  it('wrong or missing password is a 400 and nothing is deleted', async () => {
    const svc = await make(UserRoles.STUDENT);
    await expect(svc.deleteOwnAccount(4, 'nope')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.deleteOwnAccount(4, '')).rejects.toBeInstanceOf(BadRequestException);
    expect(svc.deleteUser).not.toHaveBeenCalled();
  });
  it('right password deletes a student', async () => {
    const svc = await make(UserRoles.STUDENT);
    await expect(svc.deleteOwnAccount(4, 'secret1')).resolves.toEqual({ message: 'User Deleted Successfully' });
  });
  it('instructor with courses is blocked (409)', async () => {
    const svc = await make(UserRoles.INSTRACTOR, 2, 5);
    await expect(svc.deleteOwnAccount(4, 'secret1')).rejects.toBeInstanceOf(ConflictException);
    expect(svc.deleteUser).not.toHaveBeenCalled();
  });
  it('instructor with no courses can delete', async () => {
    const svc = await make(UserRoles.INSTRACTOR, 0, 0);
    await expect(svc.deleteOwnAccount(4, 'secret1')).resolves.toBeDefined();
  });
});

describe('password change needs the current password', () => {
  const make = async () => {
    const user: any = { id: 4, fullName: 'a', password: await bcrypt.hash('oldpass1', 4) };
    const repo: any = { findOne: jest.fn(async () => user), save: jest.fn(async (x: any) => x) };
    return { svc: new UserService(repo, {} as any, {} as any, {} as any), user, repo };
  };
  it('self change: missing or wrong current password is refused', async () => {
    const { svc, repo } = await make();
    await expect(svc.updateUser(4, { password: 'newpass1' } as any, true)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateUser(4, { password: 'newpass1', currentPassword: 'bad' } as any, true)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('self change with the right current password works', async () => {
    const { svc, user } = await make();
    await svc.updateUser(4, { password: 'newpass1', currentPassword: 'oldpass1' } as any, true);
    expect(await bcrypt.compare('newpass1', user.password)).toBe(true);
  });
  it('a name-only change does not need a password', async () => {
    const { svc, user } = await make();
    await svc.updateUser(4, { fullName: 'b' } as any, true);
    expect(user.fullName).toBe('b');
  });
  it('admin route does not need it', async () => {
    const { svc } = await make();
    await expect(svc.updateUser(4, { password: 'newpass1' } as any)).resolves.toBeDefined();
  });
});

describe('updateAvatar', () => {
  const png: any = (size = 10) => ({ mimetype: 'image/png', size, buffer: Buffer.alloc(size, 1) });
  it('uploads an image and saves the url', async () => {
    const user: any = { id: 4, avatar: 'old' };
    const repo: any = { findOne: jest.fn(async () => user), save: jest.fn(async (x: any) => x) };
    const cloud: any = { uploadFile: jest.fn(async () => ({ secure_url: 'new-url' })) };
    const svc = new UserService(repo, {} as any, {} as any, cloud);
    const r: any = await svc.updateAvatar(4, png());
    expect(r.avatar).toBe('new-url');
    expect(user.avatar).toBe('new-url');
  });
  it('no file, non-image, or over 2 MB is refused before any upload', async () => {
    const cloud: any = { uploadFile: jest.fn() };
    const svc = new UserService({} as any, {} as any, {} as any, cloud);
    await expect(svc.updateAvatar(4, undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateAvatar(4, { ...png(), mimetype: 'application/pdf' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateAvatar(4, png(2 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(BadRequestException);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
  });
});

describe('instructor per-lesson progress', () => {
  const make = (rows: any[], assertFn = jest.fn(async () => undefined)) => {
    const query = jest.fn(async () => rows);
    const prog = new ProgressService({ manager: { query } } as any, {} as any, {} as any, { assertInstructorCanViewStudent: assertFn } as any);
    return { prog, query, assertFn };
  };
  it('checks the instructor owns the course first, then lists every lesson', async () => {
    const { prog, assertFn, query } = make([
      { sectionId: 1, sectionTitle: 'S', lessonId: 10, title: 'L1', duration: 60, completed: true, lastPosition: 58, completedAt: null },
      { sectionId: 1, sectionTitle: 'S', lessonId: 11, title: 'L2', duration: 60, completed: null, lastPosition: null, completedAt: null },
    ]);
    const r: any = await prog.getStudentLessonsProgressForInstructor(3, 5, 9);
    expect(assertFn).toHaveBeenCalledWith(3, 5, 9);
    expect(query.mock.calls[0]).toEqual([expect.any(String), [3, 5]]);
    expect(r.totalLessons).toBe(2);
    expect(r.completedLessons).toBe(1);
    expect(r.persentage).toBe(50);
    expect(r.lessons[1]).toMatchObject({ lessonId: 11, completed: false, lastPosition: 0 });
  });
  it('a refused check stops before any query', async () => {
    const { prog, query } = make([], jest.fn(async () => { throw new BadRequestException(); }));
    await expect(prog.getStudentLessonsProgressForInstructor(3, 5, 9)).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
  it('course with no lessons gives 0 percent, not an error', async () => {
    const { prog } = make([]);
    const r: any = await prog.getStudentLessonsProgressForInstructor(3, 5, 9);
    expect(r).toMatchObject({ totalLessons: 0, completedLessons: 0, persentage: 0, lessons: [] });
  });
});

describe('resume position', () => {
  const make = (enrolled: boolean, queryResults: any[][], progress: any = { lastPosition: 100, completed: false }) => {
    const query = jest.fn();
    queryResults.forEach((r) => query.mockResolvedValueOnce(r));
    const save = jest.fn(async (x: any) => x);
    const repo: any = { manager: { query }, save, findOne: jest.fn(async () => progress) };
    const lesson: any = {
      verifyStudentEnrollment: jest.fn(async () => enrolled),
      getLessonSectionId: jest.fn(async () => 1),
      getLessonForDeveopment: jest.fn(async () => ({ type: 'video', duration: 600, section: { id: 1 } })),
    };
    const section: any = { getSection: jest.fn(async () => ({ course: { id: 3 } })) };
    return { prog: new ProgressService(repo, lesson, section, {} as any), query, save, progress };
  };
  it('not enrolled -> 401', async () => {
    const { prog } = make(false, []);
    await expect(prog.getResumePoint(3, 7)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('returns the last touched lesson and the second', async () => {
    const { prog } = make(true, [[{ lessonId: '12', title: 'L', duration: 600, lastPosition: 245, completed: false }]]);
    expect(await prog.getResumePoint(3, 7)).toEqual({ lessonId: 12, title: 'L', duration: 600, lastPosition: 245, completed: false });
  });
  it('not started: first lesson at 0; no lessons: null', async () => {
    const a = make(true, [[], [{ lessonId: 1, title: 'First', duration: 60, lastPosition: 0, completed: false }]]);
    expect(await a.prog.getResumePoint(3, 7)).toMatchObject({ lessonId: 1, lastPosition: 0 });
    const b = make(true, [[], []]);
    expect(await b.prog.getResumePoint(3, 7)).toBeNull();
  });
  it('saves the latest position even if it is earlier than before, and clamps it', async () => {
    const a = make(true, [], { lastPosition: 400, completed: false });
    await a.prog.updateProgress({ lessonId: 1, lastPosition: 30 }, 7);
    expect(a.save.mock.calls[0][0].lastPosition).toBe(30);
    const b = make(true, [], { lastPosition: 0, completed: false });
    await b.prog.updateProgress({ lessonId: 1, lastPosition: 100 }, 7);
    expect(b.save.mock.calls[0][0].lastPosition).toBe(100);
    const c = make(true, [], { lastPosition: 0, completed: false });
    await c.prog.updateProgress({ lessonId: 1, lastPosition: 100000 }, 7).catch(() => undefined);
    expect(c.save.mock.calls[0][0].lastPosition).toBe(600);
  });
});
