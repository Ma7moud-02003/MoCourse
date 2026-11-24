import { ForbiddenException } from '@nestjs/common';
import { QuizService } from './quiz.service';

function build(opts: { owns?: boolean; enrolled?: boolean } = {}) {
  const quizRepo: any = {
    find: jest.fn().mockResolvedValue([{ id: 1 }]),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: 9, ...x })),
  };
  const courseService: any = {
    getCourseDetails: jest.fn().mockResolvedValue({ id: 5 }),
    verifyingInstractorOwnTheCourse: jest.fn().mockResolvedValue(opts.owns ?? true),
  };
  const enrollService: any = {
    verifyStudentEnrollment: jest.fn().mockResolvedValue(opts.enrolled ?? true),
  };
  const service = new QuizService(quizRepo, {} as any, courseService, enrollService);
  return { service, quizRepo, courseService, enrollService };
}

const dto: any = {
  title: 'Quiz', courseId: 5, passMark: 60, totalMarks: 100, timeLimit: 10, quizTarget: 'course',
};

describe('QuizService', () => {
  it('getQuizes checks enrollment with (studentId, courseId) in the right order', async () => {
    const { service, enrollService } = build();
    await service.getQuizes(5, 7); // courseId=5, studentId=7
    expect(enrollService.verifyStudentEnrollment).toHaveBeenCalledWith(7, 5);
  });

  it('getQuizes queries the course id and only published quizzes', async () => {
    const { service, quizRepo } = build();
    await service.getQuizes(5, 7);
    expect(quizRepo.find.mock.calls[0][0].where).toEqual({ course: { id: 5 }, isPublished: true });
  });

  it('getQuizes rejects a student who is not enrolled', async () => {
    const { service, quizRepo } = build({ enrolled: false });
    await expect(service.getQuizes(5, 7)).rejects.toBeInstanceOf(ForbiddenException);
    expect(quizRepo.find).not.toHaveBeenCalled();
  });

  it('creatNewQuiz rejects an instructor who does not own the course', async () => {
    const { service, quizRepo, courseService } = build({ owns: false });
    await expect(service.creatNewQuiz(3, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(courseService.verifyingInstractorOwnTheCourse).toHaveBeenCalledWith(3, 5);
    expect(quizRepo.save).not.toHaveBeenCalled();
  });

  it('creatNewQuiz lets the course owner create a quiz', async () => {
    const { service, quizRepo } = build({ owns: true });
    await service.creatNewQuiz(3, dto);
    expect(quizRepo.save).toHaveBeenCalled();
  });
});
