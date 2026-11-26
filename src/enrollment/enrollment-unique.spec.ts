import { BadRequestException } from '@nestjs/common';
import { EnrollmentEntity } from './enrollment.entity';
import { EnrollmentService } from './enrollment.service';
import { getMetadataArgsStorage } from 'typeorm';

const qb = (raw: any[]) => {
  const b: any = { calls: [] as string[] };
  b.insert = () => (b.calls.push('insert'), b);
  b.into = (e: any) => (b.calls.push('into:' + e.name), b);
  b.values = (v: any) => (b.values_ = v, b);
  b.onConflict = (c: string) => (b.calls.push('onConflict:' + c), b);
  b.execute = async () => ({ raw, identifiers: raw });
  return b;
};

const make = (opts: { existing?: any; raw?: any[]; published?: boolean }) => {
  const builder = qb(opts.raw ?? [{ id: 9 }]);
  const repo: any = { findOne: jest.fn().mockResolvedValue(opts.existing ?? null), manager: { createQueryBuilder: () => builder } };
  const course = { getSingleCourse: jest.fn().mockResolvedValue({ id: 1, title: 'T', isPublished: opts.published ?? true }) };
  const notif = { creatNotification: jest.fn() };
  const svc = new EnrollmentService(repo, course as any, {} as any, notif as any);
  return { svc, repo, builder, notif };
};

describe('one enrollment per student and course', () => {
  it('entity declares the unique rule the migration creates', () => {
    const u = getMetadataArgsStorage().uniques.find((x) => x.target === EnrollmentEntity);
    expect(u?.name).toBe('UQ_enrollments_user_course');
    expect(u?.columns).toEqual(['user', 'course']);
  });

  it('enrollCourse inserts once with ON CONFLICT on the unique rule only and notifies', async () => {
    const { svc, builder, notif } = make({});
    await svc.enrollCourse(1, 5);
    expect(builder.calls).toEqual(['insert', 'into:EnrollmentEntity', 'onConflict:ON CONSTRAINT "UQ_enrollments_user_course" DO NOTHING']);
    expect(notif.creatNotification).toHaveBeenCalledTimes(1);
  });

  it('repeat request keeps the existing enrollment: rejected, no insert, no notification', async () => {
    const { svc, builder, notif } = make({ existing: { id: 3 } });
    await expect(svc.enrollCourse(1, 5)).rejects.toThrow(BadRequestException);
    expect(builder.calls).toEqual([]);
    expect(notif.creatNotification).not.toHaveBeenCalled();
  });

  it('concurrent loser (insert ignored) gets the same answer and no notification', async () => {
    const { svc, notif } = make({ raw: [] });
    await expect(svc.enrollCourse(1, 5)).rejects.toThrow(/alrealdy enroll/);
    expect(notif.creatNotification).not.toHaveBeenCalled();
  });

  it('enrollCourseInTransaction reports false when the insert was ignored, true when created', async () => {
    const lost = make({ raw: [] });
    const m1: any = { getRepository: () => lost.repo, createQueryBuilder: () => qb([]) };
    expect(await lost.svc.enrollCourseInTransaction(m1, 1, 5)).toBe(false);
    const won = make({});
    const m2: any = { getRepository: () => won.repo, createQueryBuilder: () => qb([{ id: 1 }]) };
    expect(await won.svc.enrollCourseInTransaction(m2, 1, 5)).toBe(true);
  });

  it('enrollCourseInTransaction does nothing when already enrolled', async () => {
    const { svc, repo } = make({ existing: { id: 1 } });
    const m: any = { getRepository: () => repo, createQueryBuilder: jest.fn() };
    expect(await svc.enrollCourseInTransaction(m, 1, 5)).toBe(false);
    expect(m.createQueryBuilder).not.toHaveBeenCalled();
  });
});
