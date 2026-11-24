import { BadRequestException } from '@nestjs/common';
import { QuizService } from './quiz.service';

function build(opts: { published: boolean; questions: number }) {
  const quiz: any = {
    id: 1, isPublished: opts.published, course: { Instractor: { id: 3 } },
  };
  const quizRepo: any = {
    findOne: jest.fn(async () => quiz),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
  };
  const questionRepo: any = { count: jest.fn(async () => opts.questions) };
  const courseService: any = {
    getCourseDetails: jest.fn().mockResolvedValue({ id: 5 }),
    verifyingInstractorOwnTheCourse: jest.fn().mockResolvedValue(true),
  };
  const service = new QuizService(quizRepo, questionRepo, courseService, {} as any);
  return { service, quizRepo, questionRepo, quiz };
}

const dto: any = {
  title: 'Quiz', courseId: 5, passMark: 60, totalMarks: 100, timeLimit: 10, quizTarget: 'course',
};

describe('QuizService publish rules', () => {
  it('a new exam is saved as a draft when isPublished is omitted', async () => {
    const { service, quizRepo } = build({ published: false, questions: 0 });
    await service.creatNewQuiz(3, dto);
    expect(quizRepo.save.mock.calls[0][0].isPublished).toBe(false);
  });

  it('creating an exam with isPublished true is rejected and nothing is saved', async () => {
    const { service, quizRepo } = build({ published: false, questions: 0 });
    await expect(service.creatNewQuiz(3, { ...dto, isPublished: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(quizRepo.save).not.toHaveBeenCalled();
  });

  it('publishing a draft with zero questions is rejected', async () => {
    const { service, quizRepo } = build({ published: false, questions: 0 });
    await expect(service.updateQuiz(1, 3, { isPublished: true } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(quizRepo.save).not.toHaveBeenCalled();
  });

  it('publishing a draft with questions works', async () => {
    const { service, quizRepo } = build({ published: false, questions: 2 });
    const res: any = await service.updateQuiz(1, 3, { isPublished: true } as any);
    expect(res.isPublished).toBe(true);
    expect(quizRepo.save).toHaveBeenCalled();
  });

  it('unpublishing is always allowed', async () => {
    const { service } = build({ published: true, questions: 0 });
    const res: any = await service.updateQuiz(1, 3, { isPublished: false } as any);
    expect(res.isPublished).toBe(false);
  });

  it('editing other fields of a draft with no questions still works', async () => {
    const { service } = build({ published: false, questions: 0 });
    const res: any = await service.updateQuiz(1, 3, { title: 'New title' } as any);
    expect(res.title).toBe('New title');
  });
});
