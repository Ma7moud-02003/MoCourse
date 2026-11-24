import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuestionService } from './question.service';
import { QuizService } from 'src/quiz/quiz.service';
import { fakeExamDb } from 'src/quiz/exam-fake-db-spec';

function build(opts: { published: boolean; questionIds: number[]; marks?: Record<number, number> }) {
  const db = fakeExamDb(opts);
  const courseService: any = {};
  const quizService = new QuizService(db.quizRepo, db.questionRepo, courseService, {} as any);
  const service = new QuestionService(db.questionRepo, {} as any, quizService);
  return { service, quizService, ...db };
}

describe('QuestionService.deleteQuestions', () => {
  it('blocks deleting the last question of a published exam', async () => {
    const { service, state } = build({ published: true, questionIds: [1] });
    await expect(service.deleteQuestions(1, 3)).rejects.toBeInstanceOf(BadRequestException);
    expect(state.questions).toEqual([1]);
  });

  it('allows deleting a question of a published exam when others remain', async () => {
    const { service, state } = build({ published: true, questionIds: [1, 2] });
    await service.deleteQuestions(1, 3);
    expect(state.questions).toEqual([2]);
  });

  it('allows deleting the last question of a draft exam', async () => {
    const { service, state } = build({ published: false, questionIds: [1] });
    await service.deleteQuestions(1, 3);
    expect(state.questions).toEqual([]);
  });

  it('rejects a non-owner and removes nothing', async () => {
    const { service, state } = build({ published: true, questionIds: [1, 2] });
    await expect(service.deleteQuestions(1, 99)).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.questions).toEqual([1, 2]);
  });
});

describe('exam guards under concurrency (simulated quiz-row lock)', () => {
  it('two simultaneous deletes of the last two questions of a published exam: one succeeds, one is blocked', async () => {
    const { service, state } = build({ published: true, questionIds: [1, 2] });
    const results = await Promise.allSettled([service.deleteQuestions(1, 3), service.deleteQuestions(2, 3)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(state.questions).toHaveLength(1);
  });

  it('publish racing a delete never leaves a published exam with zero questions', async () => {
    const { service, quizService, state } = build({ published: false, questionIds: [1] });
    await Promise.allSettled([
      quizService.updateQuiz(10, 3, { isPublished: true } as any),
      service.deleteQuestions(1, 3),
    ]);
    expect(state.quiz.isPublished && state.questions.length === 0).toBe(false);
  });

  it('delete racing an unpublish-then-publish keeps the rule: published implies at least one question', async () => {
    const { service, quizService, state } = build({ published: true, questionIds: [1] });
    await Promise.allSettled([
      service.deleteQuestions(1, 3),
      quizService.updateQuiz(10, 3, { isPublished: false } as any),
      quizService.updateQuiz(10, 3, { isPublished: true } as any),
    ]);
    expect(state.quiz.isPublished && state.questions.length === 0).toBe(false);
  });
});

const build2 = build;

describe('totalMarks on add and delete', () => {
  it('delete lowers totalMarks to the remaining question marks', async () => {
    const { service, state } = build2({ published: false, questionIds: [1, 2], marks: { 1: 2, 2: 3 } });
    await service.deleteQuestions(1, 3);
    expect(state.quiz.totalMarks).toBe(3);
  });

  it('deleting the last question sets totalMarks to 0', async () => {
    const { service, state } = build2({ published: false, questionIds: [1], marks: { 1: 4 } });
    await service.deleteQuestions(1, 3);
    expect(state.quiz.totalMarks).toBe(0);
  });

  it('adding questions sets totalMarks to the sum of all marks', async () => {
    const { service, state } = build2({ published: false, questionIds: [1], marks: { 1: 2 } });
    const dto: any = { quizId: 10, questions: [
      { question: 'a', type: 'mcq', mark: 3, order: 2, choices: [] },
      { question: 'b', type: 'mcq', mark: 5, order: 3, choices: [] },
    ] };
    await service.addQuestins(3, dto);
    expect(state.quiz.totalMarks).toBe(10);
  });

  it('adding to a non-owned exam changes nothing', async () => {
    const { service, state } = build2({ published: false, questionIds: [1], marks: { 1: 2 } });
    await expect(service.addQuestins(99, { quizId: 10, questions: [{ question: 'a', type: 'mcq', mark: 3, order: 2, choices: [] }] } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.questions).toEqual([1]);
  });
});
