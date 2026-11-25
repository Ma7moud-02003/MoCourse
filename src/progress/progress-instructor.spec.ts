import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EnrollmentService } from 'src/enrollment/enrollment.service';
import { ProgressService } from './progress.service';

const OWNER = 9, OTHER = 77, STUDENT = 5, COURSE = 3;

function enrollSetup(enrolled: boolean) {
  const enrollRepo: any = { findOne: jest.fn().mockResolvedValue(enrolled ? { id: 1 } : null) };
  const courseService: any = {
    getSingleCourse: jest.fn(async (id: number) => {
      if (id !== COURSE) throw new NotFoundException('Course not found with this id');
      return { id, Instractor: { id: OWNER } };
    }),
  };
  return { svc: new EnrollmentService(enrollRepo, courseService, {} as any, {} as any), enrollRepo, courseService };
}

describe('instructor can only see progress of enrolled students in own courses', () => {
  it('owner with an enrolled student passes', async () => {
    const { svc } = enrollSetup(true);
    await expect(svc.assertInstructorCanViewStudent(COURSE, STUDENT, OWNER)).resolves.toBeUndefined();
  });
  it('another instructor gets 404 and no enrollment lookup runs', async () => {
    const { svc, enrollRepo } = enrollSetup(true);
    await expect(svc.assertInstructorCanViewStudent(COURSE, STUDENT, OTHER)).rejects.toThrow(NotFoundException);
    expect(enrollRepo.findOne).not.toHaveBeenCalled();
  });
  it('owner asking about a student who is not enrolled gets 404', async () => {
    const { svc } = enrollSetup(false);
    await expect(svc.assertInstructorCanViewStudent(COURSE, STUDENT, OWNER)).rejects.toThrow(NotFoundException);
  });
  it('unknown course gives 404', async () => {
    const { svc } = enrollSetup(true);
    await expect(svc.assertInstructorCanViewStudent(999, STUDENT, OWNER)).rejects.toThrow(NotFoundException);
  });
  it('missing ids give 400', async () => {
    const { svc } = enrollSetup(true);
    await expect(svc.assertInstructorCanViewStudent(COURSE, 0, OWNER)).rejects.toThrow(BadRequestException);
  });
  it('progress is not computed when the check fails', async () => {
    const enrollService: any = { assertInstructorCanViewStudent: jest.fn().mockRejectedValue(new NotFoundException()) };
    const lessonService: any = { getLessonsCout: jest.fn() };
    const progressRepo: any = { count: jest.fn() };
    const svc = new ProgressService(progressRepo, lessonService, {} as any, enrollService);
    await expect(svc.getStudentProgressForInstructor(COURSE, STUDENT, OTHER)).rejects.toThrow(NotFoundException);
    expect(progressRepo.count).not.toHaveBeenCalled();
    expect(lessonService.getLessonsCout).not.toHaveBeenCalled();
  });
  it('progress is returned for the owner', async () => {
    const enrollService: any = { assertInstructorCanViewStudent: jest.fn().mockResolvedValue(undefined) };
    const lessonService: any = { getLessonsCout: jest.fn().mockResolvedValue(4) };
    const progressRepo: any = { count: jest.fn().mockResolvedValue(1) };
    const svc = new ProgressService(progressRepo, lessonService, {} as any, enrollService);
    await expect(svc.getStudentProgressForInstructor(COURSE, STUDENT, OWNER)).resolves.toEqual({ totalLesoons: 4, completedLessons: 1, persentage: 25 });
    expect(enrollService.assertInstructorCanViewStudent).toHaveBeenCalledWith(COURSE, STUDENT, OWNER);
  });
});
