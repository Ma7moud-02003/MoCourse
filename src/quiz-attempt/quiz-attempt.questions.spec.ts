import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuizAttemptService } from './quiz-attempt.service';
import { QuizAttemptEntity } from './quiz-attemp.entity';
import { QuizEntity } from 'src/quiz/quiz.entity';
import { QuestionEntity } from 'src/question/question.entity';

const future = new Date(Date.now() + 3600e3);
function build(o: { shuffleQuestions?: boolean; shuffleChoices?: boolean; attempt?: any; ownerId?: number } = {}) {
  const questions = [1, 2, 3, 4, 5, 6].map((i) => ({ id: i, question: 'Q' + i, type: 'mcq', mark: 1, order: i, choices: [1, 2, 3, 4].map((k) => ({ id: i * 10 + k, text: 'c' + k, order: k, isCorrect: k === 1 })) }));
  const attempt = { id: 9, user: 7, quiz: 10, submitted: false, expiresAt: future, ...(o.attempt ?? {}) };
  const manager: any = {
    findOne: jest.fn(async (e: any) => (e === QuizAttemptEntity ? attempt : e === QuizEntity ? { id: 10, shuffleQuestions: !!o.shuffleQuestions, shuffleChoices: !!o.shuffleChoices } : null)),
    find: jest.fn(async (e: any) => (e === QuestionEntity ? [...questions].reverse() : [])),
  };
  const quizRepo: any = { findOne: jest.fn(async () => ({ id: 10, passMark: 50, course: { Instractor: { id: o.ownerId ?? 3 } } })) };
  return new QuizAttemptService({ manager } as any, quizRepo, {} as any);
}

describe('QuizAttemptService.getQuestions', () => {
  it('never exposes which choice is correct (explicit fields only)', async () => {
    const res: any = await build().getQuestions(9, 7);
    expect(JSON.stringify(res)).not.toMatch(/isCorrect|correct/i);
    expect(Object.keys(res.questions[0]).sort()).toEqual(['choices', 'id', 'mark', 'question', 'type']);
    expect(Object.keys(res.questions[0].choices[0]).sort()).toEqual(['id', 'text']);
  });
  it('without shuffle: teacher order (order, then id)', async () => {
    const res: any = await build().getQuestions(9, 7);
    expect(res.questions.map((q: any) => q.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(res.questions[0].choices.map((c: any) => c.id)).toEqual([11, 12, 13, 14]);
  });
  it('with shuffle: same order on every call (resume), different from the teacher order', async () => {
    const svc = build({ shuffleQuestions: true, shuffleChoices: true });
    const a: any = await svc.getQuestions(9, 7);
    const b: any = await svc.getQuestions(9, 7);
    expect(b.questions.map((q: any) => [q.id, q.choices.map((c: any) => c.id)])).toEqual(a.questions.map((q: any) => [q.id, q.choices.map((c: any) => c.id)]));
    expect(a.questions.map((q: any) => q.id)).not.toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("another student's attempt -> 404; submitted or expired -> 409", async () => {
    await expect(build().getQuestions(9, 8)).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ attempt: { submitted: true } }).getQuestions(9, 7)).rejects.toBeInstanceOf(ConflictException);
    await expect(build({ attempt: { expiresAt: new Date(Date.now() - 1000) } }).getQuestions(9, 7)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('QuizAttemptService.getExamResults ownership', () => {
  it('only the owning instructor', async () => {
    await expect(build({ ownerId: 3 }).getExamResults(10, 99)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('getExamResults when more attempts are due than one request grades', () => {
  const past = new Date(Date.now() - 60e3);
  function svcWith(stillDue: number) {
    const rows = [
      { id: 1, submitted: true, score: 4, passed: true, startedAt: past, submittedAt: past, expiresAt: past, user: { id: 1, fullName: 'A', email: 'a@x' } },
      { id: 2, submitted: false, score: 0, passed: false, startedAt: past, submittedAt: null, expiresAt: past, user: { id: 2, fullName: 'B', email: 'b@x' } },
      { id: 3, submitted: false, score: 0, passed: false, startedAt: past, submittedAt: null, expiresAt: new Date(Date.now() + 3600e3), user: { id: 3, fullName: 'C', email: 'c@x' } },
    ];
    let dueCalls = 0;
    const manager: any = {
      transaction: jest.fn(async () => undefined),
      find: jest.fn(async () => []),
      // 1st count = due-check after grading; others = submitted / passed
      count: jest.fn(async (_e: any, o: any) => (o.where.submitted === false ? stillDue : o.where.passed ? 1 : 1)),
      findAndCount: jest.fn(async () => [rows, 3]),
      sum: jest.fn(async () => 4),
    };
    const quizRepo: any = { findOne: jest.fn(async () => ({ id: 10, passMark: 50, course: { Instractor: { id: 3 } } })) };
    const svc: any = new QuizAttemptService({ manager } as any, quizRepo, {} as any);
    svc.totalMarksOf = jest.fn(async () => 5);
    return svc as QuizAttemptService;
  }
  it('ungraded expired attempts are pending_grading with null score, never zero or failed, and not in the average', async () => {
    const r: any = await svcWith(1).getExamResults(10, 3);
    const pending = r.attempts.find((a: any) => a.attemptId === 2);
    expect(pending.status).toBe('pending_grading');
    expect(pending.score).toBeNull();
    expect(pending.passed).toBeNull();
    expect(pending.percentage).toBeNull();
    expect(r.attempts.find((a: any) => a.attemptId === 3).status).toBe('in_progress');
    expect(r.summary).toMatchObject({ attempts: 3, submitted: 1, gradedAttempts: 1, pendingGrading: 1, inProgress: 1, complete: false, averageScore: 4, passed: 1, failed: 0 });
  });
  it('complete is true once nothing is pending', async () => {
    const r: any = await svcWith(0).getExamResults(10, 3);
    expect(r.summary.complete).toBe(true);
  });
});
