import { BadRequestException } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { fakeExamDb } from './exam-fake-db-spec';

function build(opts: { published: boolean; questionIds: number[] }) {
  const db = fakeExamDb(opts);
  const courseService: any = {
    getCourseDetails: jest.fn().mockResolvedValue({ id: 5 }),
    verifyingInstractorOwnTheCourse: jest.fn().mockResolvedValue(true),
  };
  const service = new QuizService(db.quizRepo, db.questionRepo, courseService, {} as any);
  return { service, ...db };
}

const dto: any = {
  title: 'Quiz', courseId: 5, passMark: 60, timeLimit: 10, quizTarget: 'course',
};

describe('QuizService publish rules', () => {
  it('a new exam is saved as a draft when isPublished is omitted', async () => {
    const { service, quizRepo } = build({ published: false, questionIds: [] });
    await service.creatNewQuiz(3, dto);
    expect(quizRepo.save.mock.calls[0][0].isPublished).toBe(false);
  });

  it('creating an exam with isPublished true is rejected and nothing is saved', async () => {
    const { service, quizRepo } = build({ published: false, questionIds: [] });
    await expect(service.creatNewQuiz(3, { ...dto, isPublished: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(quizRepo.save).not.toHaveBeenCalled();
  });

  it('publishing a draft with zero questions is rejected and stays a draft', async () => {
    const { service, state } = build({ published: false, questionIds: [] });
    await expect(service.updateQuiz(10, 3, { isPublished: true } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(state.quiz.isPublished).toBe(false);
  });

  it('publishing a draft with questions works', async () => {
    const { service, state } = build({ published: false, questionIds: [1, 2] });
    await service.updateQuiz(10, 3, { isPublished: true } as any);
    expect(state.quiz.isPublished).toBe(true);
  });

  it('unpublishing is always allowed', async () => {
    const { service, state } = build({ published: true, questionIds: [] });
    await service.updateQuiz(10, 3, { isPublished: false } as any);
    expect(state.quiz.isPublished).toBe(false);
  });

  it('editing other fields of a draft with no questions still works', async () => {
    const { service, state } = build({ published: false, questionIds: [] });
    await service.updateQuiz(10, 3, { title: 'New title' } as any);
    expect(state.quiz.title).toBe('New title');
  });

  it('a non-owner cannot update', async () => {
    const { service, state } = build({ published: false, questionIds: [1] });
    await expect(service.updateQuiz(10, 99, { isPublished: true } as any)).rejects.toThrow();
    expect(state.quiz.isPublished).toBe(false);
  });
});
