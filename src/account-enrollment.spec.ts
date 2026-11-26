import { ConflictException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateUserDto } from './User/user/Dtos/update.dto';
import { UpdateSectionDto } from './section/dtos/update.dto';
import { UserService } from './User/user/user.service';
import { PaymentinfoService } from './instructor-payment-info/paymentinfo/paymentinfo.service';
import { EnrollmentService } from './enrollment/enrollment.service';
import { SectionService } from './section/section.service';
import { UserRoles } from './utils/enums/userRole.enum';
import { EnrollmentEntity } from './enrollment/enrollment.entity';
import { getMetadataArgsStorage } from 'typeorm';

describe('UpdateUserDto password', () => {
  const errs = (password: string) => validate(plainToInstance(UpdateUserDto, { password }));
  it('accepts the same 6..150 range as registration', async () => {
    expect(await errs('abcdef')).toHaveLength(0);
    expect(await errs('a'.repeat(150))).toHaveLength(0);
  });
  it('rejects too short and too long', async () => {
    expect((await errs('abc')).length).toBeGreaterThan(0);
    expect((await errs('a'.repeat(151))).length).toBeGreaterThan(0);
  });
});

describe('UpdateSectionDto', () => {
  it('allows a partial update and has no courseId (no way to move a section)', async () => {
    expect(await validate(plainToInstance(UpdateSectionDto, { title: 'new title' }))).toHaveLength(0);
    expect(Object.keys(new UpdateSectionDto())).not.toContain('courseId');
  });
});

describe('UserService.getInstractorInfo', () => {
  const make = (role: UserRoles, payment: any) => {
    const repo = { findOne: jest.fn().mockResolvedValue({ id: 1, role, password: 'x', fullName: 'a' }) };
    const pay = { findInsPaymentInfo: jest.fn().mockResolvedValue(payment) };
    return { svc: new UserService(repo as any, {} as any, pay as any, {} as any), pay };
  };
  it('student: no payment lookup, paymentInfo null', async () => {
    const { svc, pay } = make(UserRoles.STUDENT, null);
    const r: any = await svc.getInstractorInfo(1);
    expect(r.paymentInfo).toBeNull();
    expect(r.personalInfo.password).toBeUndefined();
    expect(pay.findInsPaymentInfo).not.toHaveBeenCalled();
  });
  it('instructor without payment info: null, not 404', async () => {
    const { svc } = make(UserRoles.INSTRACTOR, null);
    expect(((await svc.getInstractorInfo(1)) as any).paymentInfo).toBeNull();
  });
  it('instructor with payment info returns it', async () => {
    const { svc } = make(UserRoles.INSTRACTOR, { id: 3 });
    expect(((await svc.getInstractorInfo(1)) as any).paymentInfo).toEqual({ id: 3 });
  });
});

describe('PaymentinfoService.addPaymentInfo', () => {
  it('stores the vodafone number in the real column', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((x) => x), save: jest.fn() };
    await new PaymentinfoService(repo as any).addPaymentInfo({ vodafoneCash: '01012345678', ownerName: 'Owner' } as any, 4);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ vodafonCach: '01012345678', instractor: { id: 4 } }));
  });
  it('second add is a 409, nothing saved', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue({ id: 1 }), create: jest.fn(), save: jest.fn() };
    await expect(new PaymentinfoService(repo as any).addPaymentInfo({ ownerName: 'Owner' } as any, 4)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('PaymentinfoService.addPaymentInfo concurrent add', () => {
  it('a database unique violation becomes a 409', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((x) => x), save: jest.fn().mockRejectedValue({ code: '23505' }) };
    await expect(new PaymentinfoService(repo as any).addPaymentInfo({ ownerName: 'Owner' } as any, 4)).rejects.toBeInstanceOf(ConflictException);
  });
  it('other database errors are not swallowed', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((x) => x), save: jest.fn().mockRejectedValue(new Error('boom')) };
    await expect(new PaymentinfoService(repo as any).addPaymentInfo({ ownerName: 'Owner' } as any, 4)).rejects.toThrow('boom');
  });
});

describe('EnrollmentService dashboard helpers', () => {
  const make = (repo: any) => new EnrollmentService(repo, {} as any, {} as any, {} as any);
  it('student with no enrollments gets 0 percent, not NaN', async () => {
    const r = await make({ count: jest.fn().mockResolvedValue(0) }).getStudentCoursesCount(1);
    expect(r.persentage).toBe(0);
  });
  it('instructor completion rate keeps the same keys when empty', async () => {
    const r: any = await make({ count: jest.fn().mockResolvedValue(0) }).getStudentsCourseCompletionRate(1);
    expect(r).toEqual({ totalStudents: 0, completedStudents: 0, completionPercentage: 0 });
  });
  it('last courses are the newest, ties broken by id', async () => {
    const find = jest.fn().mockResolvedValue([]);
    await make({ find }).getLastCoursesOfStudent(1);
    expect(find.mock.calls[0][0]).toMatchObject({ order: { enrolledAt: 'DESC', id: 'DESC' }, take: 2 });
  });
  it('suggestions use the newest enrollment and return [] when there is none', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const course = { getSuggestedCourses: jest.fn() };
    const svc = new EnrollmentService({ findOne } as any, course as any, {} as any, {} as any);
    expect(await svc.getCommonCategory(1)).toEqual([]);
    expect(findOne.mock.calls[0][0].order).toEqual({ enrolledAt: 'DESC', id: 'DESC' });
    expect(course.getSuggestedCourses).not.toHaveBeenCalled();
  });
  it('status filter is passed to the query', async () => {
    const find = jest.fn().mockResolvedValue([{ id: 1 }]);
    await make({ find }).getStudentCourses(1, 'completed' as any);
    expect(find.mock.calls[0][0].where).toMatchObject({ user: { id: 1 }, status: 'completed' });
  });
  it('my courses: empty list is [] (not an exception value)', async () => {
    const r = await make({ find: jest.fn().mockResolvedValue([]) }).getStudentCourses(1);
    expect(r).toEqual([]);
  });
  it('my courses: adds progressPercent, 0 when course has no lessons', async () => {
    const find = jest.fn().mockResolvedValue([{ id: 1, course: { id: 10 } }, { id: 2, course: { id: 11 } }]);
    const query = jest.fn().mockResolvedValue([{ courseId: '10', total: '4', done: '1' }]);
    const r: any = await make({ find, manager: { query } }).getStudentCourses(1);
    expect(r.map((x: any) => x.progressPercent)).toEqual([25, 0]);
    expect(query.mock.calls[0][1]).toEqual([1, [10, 11]]);
  });
  it('enrollCourse needs both ids', async () => {
    await expect(make({}).enrollCourse(1, undefined as any)).rejects.toThrow();
  });
});

describe('EnrollmentEntity.enrolledAt', () => {
  it('is a create date column, so it never changes on update', () => {
    const cols = getMetadataArgsStorage().columns.filter((c) => c.target === EnrollmentEntity && c.propertyName === 'enrolledAt');
    expect(cols[0].mode).toBe('createDate');
  });
});

describe('SectionService.getCourseSections', () => {
  const make = () => {
    const find = jest.fn().mockResolvedValue([]);
    const course = { canViewCourse: jest.fn().mockResolvedValue(true), verifyingInstractorOwnTheCourse: jest.fn().mockResolvedValue(false) };
    const enroll = { verifyStudentEnrollment: jest.fn().mockResolvedValue(false) };
    return { find, svc: new SectionService({ find } as any, course as any, enroll as any) };
  };
  it('orders by section order then id and paginates', async () => {
    const { find, svc } = make();
    await svc.getCourseSections(1, 2, 2 as any);
    expect(find.mock.calls[0][0]).toMatchObject({ order: { order: 'ASC', id: 'ASC' }, skip: 10, take: 10 });
  });
  it('junk page number falls back to the first page instead of NaN', async () => {
    const { find, svc } = make();
    const r: any = await svc.getCourseSections(1, 2, 'abc' as any);
    expect(find.mock.calls[0][0].skip).toBe(0);
    expect(r.pageNum).toBe(0);
  });
  it('string page "2" works as page 2', async () => {
    const { find, svc } = make();
    await svc.getCourseSections(1, 2, '2' as any);
    expect(find.mock.calls[0][0].skip).toBe(10);
  });
});
