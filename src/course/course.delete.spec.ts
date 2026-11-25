import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { CourseService } from './course.service';
import { UserRoles } from 'src/utils/enums/userRole.enum';

function build(opts: { exams: number[]; attempts: number; ownerId?: number }) {
  const calls: string[] = [];
  const course = { id: 5, Instractor: { id: opts.ownerId ?? 3 } };
  const manager: any = {
    findOne: jest.fn(async () => { calls.push('lock-course'); return { id: 5 }; }),
    find: jest.fn(async (_e: any, o: any) => { calls.push(o.lock ? 'lock-exams' : 'list-exams'); return opts.exams.map((id) => ({ id })); }),
    count: jest.fn(async () => { calls.push('count-attempts'); return opts.attempts; }),
    remove: jest.fn(async (c: any) => { calls.push('remove'); return c; }),
  };
  const courseRepo: any = { manager: { transaction: (fn: any) => fn(manager) } };
  const service = new CourseService(courseRepo, {} as any, {} as any);
  (service as any).getSingleCourse = jest.fn(async () => course);
  return { service, manager, calls };
}

describe('CourseService.deleteCourse protects student results', () => {
  it('deletes a course whose exams have no attempts', async () => {
    const { service, manager } = build({ exams: [1, 2], attempts: 0 });
    await service.deleteCourse(5, 3, UserRoles.INSTRACTOR);
    expect(manager.remove).toHaveBeenCalled();
  });

  it('deletes a course with no exams without locking anything', async () => {
    const { service, calls } = build({ exams: [], attempts: 0 });
    await service.deleteCourse(5, 3, UserRoles.INSTRACTOR);
    expect(calls).toEqual(['lock-course', 'list-exams', 'remove']);
  });

  it('refuses (409) when any exam in the course has an attempt, for the owner and for an admin', async () => {
    for (const [id, role] of [[3, UserRoles.INSTRACTOR], [99, UserRoles.ADMIN]] as const) {
      const { service, manager } = build({ exams: [1], attempts: 2 });
      await expect(service.deleteCourse(5, id, role)).rejects.toBeInstanceOf(ConflictException);
      expect(manager.remove).not.toHaveBeenCalled();
    }
  });

  it('locks the exams (exclusive) before counting attempts, then deletes', async () => {
    const { service, calls } = build({ exams: [1], attempts: 0 });
    await service.deleteCourse(5, 3, UserRoles.INSTRACTOR);
    expect(calls).toEqual(['lock-course', 'list-exams', 'lock-exams', 'count-attempts', 'remove']);
  });

  it('a different instructor is refused and nothing runs', async () => {
    const { service, manager } = build({ exams: [1], attempts: 0 });
    await expect(service.deleteCourse(5, 99, UserRoles.INSTRACTOR)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(manager.find).not.toHaveBeenCalled();
    expect(manager.findOne).not.toHaveBeenCalled();
  });
});
