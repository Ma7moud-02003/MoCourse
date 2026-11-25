import { NotFoundException } from '@nestjs/common';
import { CourseService, parsePublished } from './course.service';
import { LessonService } from 'src/lesson/lesson.service';
import { PurchaseService } from 'src/Purchase/purchase.service';
import { UserRoles } from 'src/utils/enums/userRole.enum';

const OWNER = 3, ENROLLED = 7, STRANGER = 8;

function build(published: boolean) {
  const course: any = { id: 5, title: 'T', isPublished: published, Instractor: { id: OWNER }, quizzes: [], category: { id: 1 } };
  const courseRepo: any = {
    findOne: jest.fn(async () => course),
    find: jest.fn(async () => []),
    save: jest.fn(async (c: any) => c),
  };
  const enroll: any = { verifyStudentEnrollment: jest.fn(async (u: number) => u === ENROLLED) };
  const service = new CourseService(courseRepo, {} as any, enroll);
  return { service, courseRepo, course };
}

describe('parsePublished', () => {
  it('leaves the state unchanged when nothing is sent', () => {
    expect(parsePublished(undefined)).toBeUndefined();
    expect(parsePublished(null)).toBeUndefined();
    expect(parsePublished('')).toBeUndefined();
  });
  it('reads booleans and form strings', () => {
    expect(parsePublished(true)).toBe(true);
    expect(parsePublished(false)).toBe(false);
    expect(parsePublished('true')).toBe(true);
    expect(parsePublished('false')).toBe(false);
  });
  it('rejects nonsense', () => {
    expect(() => parsePublished('maybe')).toThrow();
  });
});

describe('updateCourse keeps publish state', () => {
  it('a title-only edit does not unpublish', async () => {
    const { service, course } = build(true);
    await service.updateCourse({ title: 'New' } as any, 5, OWNER, UserRoles.INSTRACTOR);
    expect(course.isPublished).toBe(true);
    expect(course.title).toBe('New');
  });
  it('a title-only edit does not publish a draft', async () => {
    const { service, course } = build(false);
    await service.updateCourse({ title: 'New' } as any, 5, OWNER, UserRoles.INSTRACTOR);
    expect(course.isPublished).toBe(false);
  });
  it('the string "false" unpublishes and "true" publishes', async () => {
    const a = build(true);
    await a.service.updateCourse({ isPublished: 'false' } as any, 5, OWNER, UserRoles.INSTRACTOR);
    expect(a.course.isPublished).toBe(false);
    const b = build(false);
    await b.service.updateCourse({ isPublished: 'true' } as any, 5, OWNER, UserRoles.INSTRACTOR);
    expect(b.course.isPublished).toBe(true);
  });
});

describe('draft visibility', () => {
  it('public list filters to published, admin sees all', async () => {
    const { service, courseRepo } = build(true);
    await service.getAllCourses('' as any, undefined, undefined, undefined, undefined, UserRoles.STUDENT);
    expect(courseRepo.find.mock.calls[0][0].where.isPublished).toBe(true);
    await service.getAllCourses('' as any, undefined, undefined, undefined, undefined, UserRoles.ADMIN);
    expect('isPublished' in courseRepo.find.mock.calls[1][0].where).toBe(false);
  });
  it('suggested courses are published only', async () => {
    const { service, courseRepo } = build(true);
    await service.getSuggestedCourses(1);
    expect(courseRepo.find.mock.calls[0][0].where.isPublished).toBe(true);
  });
  it('details of a draft: hidden from a stranger, shown to owner, admin and enrolled student', async () => {
    const { service } = build(false);
    await expect(service.getCourseDetails(5, STRANGER, UserRoles.STUDENT, true)).rejects.toThrow(NotFoundException);
    await expect(service.getCourseDetails(5, undefined, undefined, true)).rejects.toThrow(NotFoundException);
    await expect(service.getCourseDetails(5, OWNER, UserRoles.INSTRACTOR, true)).resolves.toBeTruthy();
    await expect(service.getCourseDetails(5, 99, UserRoles.ADMIN, true)).resolves.toBeTruthy();
    await expect(service.getCourseDetails(5, ENROLLED, UserRoles.STUDENT, true)).resolves.toBeTruthy();
  });
  it('internal callers without the flag still read a draft (exam creation)', async () => {
    const { service } = build(false);
    await expect(service.getCourseDetails(5)).resolves.toBeTruthy();
  });
  it('a published course is visible to everyone', async () => {
    const { service } = build(true);
    await expect(service.getCourseDetails(5, STRANGER, UserRoles.STUDENT, true)).resolves.toBeTruthy();
  });
  it('canViewCourse: draft only for owner, admin, enrolled', async () => {
    const { service } = build(false);
    expect(await service.canViewCourse(5, STRANGER)).toBe(false);
    expect(await service.canViewCourse(5)).toBe(false);
    expect(await service.canViewCourse(5, OWNER)).toBe(true);
    expect(await service.canViewCourse(5, ENROLLED)).toBe(true);
    expect(await service.canViewCourse(5, 99, UserRoles.ADMIN)).toBe(true);
  });
});

describe('purchase and lessons on a draft course', () => {
  it('cannot buy a draft course', async () => {
    const { service } = build(false);
    const repo: any = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const p = new PurchaseService(repo, service, {} as any, {} as any, {} as any);
    await expect(p.buyCourse(STRANGER, 5)).rejects.toThrow(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  function lessons(published: boolean, lesson: any) {
    const { service } = build(published);
    const lessonRepo: any = { findOne: jest.fn(async () => lesson), find: jest.fn(async () => []) };
    const sectionService: any = { getSection: jest.fn(async () => ({ id: 2, course: { id: 5, Instractor: { id: OWNER } } })) };
    const enroll: any = { verifyStudentEnrollment: jest.fn(async (u: number) => u === ENROLLED) };
    return new LessonService(lessonRepo, sectionService, service as any, {} as any, enroll);
  }
  const base = { id: 1, section: { id: 2 } };

  it('draft course: a preview lesson is hidden from a stranger, kept for an enrolled student', async () => {
    const s = lessons(false, { ...base, isPreview: true });
    await expect(s.getLesson(1, STRANGER)).rejects.toThrow(NotFoundException);
    await expect(s.getLesson(1, ENROLLED)).resolves.toBeTruthy();
  });
  it('draft course: lesson list hidden from a stranger, shown to enrolled student', async () => {
    const s = lessons(false, base);
    await expect(s.getSectiionLessons(2, STRANGER)).rejects.toThrow(NotFoundException);
    await expect(s.getSectiionLessons(2, ENROLLED)).resolves.toEqual([]);
  });
  it('draft course: admin can list lessons and open a preview, still not paid content', async () => {
    const s = lessons(false, { ...base, isPreview: true });
    await expect(s.getSectiionLessons(2, 99, UserRoles.ADMIN)).resolves.toEqual([]);
    await expect(s.getLesson(1, 99, UserRoles.ADMIN)).resolves.toBeTruthy();
    const t = lessons(false, { ...base, isPreview: false });
    await expect(t.getLesson(1, 99, UserRoles.ADMIN)).rejects.toThrow();
  });
  it('published course: preview open to anyone, non-preview needs enrollment', async () => {
    const s = lessons(true, { ...base, isPreview: true });
    await expect(s.getLesson(1, STRANGER)).resolves.toBeTruthy();
    const t = lessons(true, { ...base, isPreview: false });
    await expect(t.getLesson(1, STRANGER)).rejects.toThrow();
    await expect(t.getLesson(1, ENROLLED)).resolves.toBeTruthy();
  });
});
