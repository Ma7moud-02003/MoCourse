import { BadRequestException, ConflictException } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { fakeExamDb } from './exam-fake-db-spec';

function build(opts: { published: boolean; questionIds: number[]; attempts?: number }) {
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

describe('exam settings are frozen once a student started', () => {
  it('rejects every kind of update when an attempt exists and saves nothing', async () => {
    const { service, state } = build({ published: true, questionIds: [1], attempts: 1 });
    const before = { ...state.quiz };
    for (const patch of [{ title: 'New' }, { passMark: 10 }, { timeLimit: 5 }, { maxAttempts: 3 }, { shuffleQuestions: true },
      { shuffleChoices: true }, { showResultImmediately: true }, { isPublished: false }, { description: 'x' }, { instructions: 'x' }]) {
      await expect(service.updateQuiz(10, 3, patch as any)).rejects.toBeInstanceOf(ConflictException);
    }
    expect(state.quiz).toEqual(before);
  });

  it('still allows updates while there are no attempts', async () => {
    const { service, state } = build({ published: true, questionIds: [1], attempts: 0 });
    await service.updateQuiz(10, 3, { timeLimit: 5, passMark: 0 } as any);
    expect(state.quiz.timeLimit).toBe(5);
    expect(state.quiz.passMark).toBe(0);
  });

  it('non-owner still gets Forbidden, not Conflict', async () => {
    const { service } = build({ published: true, questionIds: [1], attempts: 1 });
    await expect(service.updateQuiz(10, 99, { title: 'x' } as any)).rejects.not.toBeInstanceOf(ConflictException);
  });
});
