import { ConflictException, NotFoundException } from '@nestjs/common';
import { fakeAttemptDb, FakeOpts } from './attempt-fake-db-spec';

const questions = {
  1: { mark: 2, choices: [{ id: 10, isCorrect: false }, { id: 11, isCorrect: true }] },
  2: { mark: 3, choices: [{ id: 20, isCorrect: false }, { id: 21, isCorrect: true }] },
};
const attempt = (extra: any = {}) => ({ id: 1, quiz: { id: 10 }, user: { id: 7 }, submitted: false, score: 0, passed: false, expiresAt: new Date('2026-01-01T10:30:00Z'), submittedAt: null, ...extra });
const build = (o: FakeOpts = {}) => fakeAttemptDb({ questions, attempts: [attempt()], ...o });

describe('QuizAttemptService.getResult (request-driven grading, no timer)', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setTimeout', 'nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-01-01T10:10:00Z')));
  afterEach(() => jest.useRealTimers());

  it('while the attempt is running there is no result (409) and nothing is graded', async () => {
    const { service, state } = build();
    await expect(service.getResult(1, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(state.attempts[0].submitted).toBe(false);
  });

  it('after the deadline an unsubmitted attempt is graded from the saved answers and closed, stamped with the deadline', async () => {
    const { service, state } = build({ answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }, { attemptId: 1, questionId: 2, choiceId: 20 }] });
    jest.setSystemTime(new Date('2026-01-01T14:00:00Z'));
    const res = await service.getResult(1, 7);
    expect(res).toMatchObject({ submitted: true, score: 2, totalMarks: 5, percentage: 40 });
    expect(res.submittedAt.toISOString()).toBe('2026-01-01T10:30:00.000Z');
    expect(state.attempts[0].submitted).toBe(true);
  });

  it('asking twice returns the same result without regrading', async () => {
    const { service } = build({ answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }] });
    jest.setSystemTime(new Date('2026-01-01T10:31:00Z'));
    const a = await service.getResult(1, 7);
    const b = await service.getResult(1, 7);
    expect(b).toEqual(a);
  });

  it('a submitted attempt returns its stored result right away', async () => {
    const { service } = build({ attempts: [attempt({ submitted: true, score: 5, passed: true, submittedAt: new Date('2026-01-01T10:05:00Z') })] });
    expect(await service.getResult(1, 7)).toMatchObject({ score: 5, passed: true });
  });

  it("another student's attempt looks missing", async () => {
    const { service } = build();
    await expect(service.getResult(1, 8)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('result carries scores only, never choices or correctness of answers', async () => {
    const { service } = build({ answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }] });
    jest.setSystemTime(new Date('2026-01-01T10:31:00Z'));
    const res = await service.getResult(1, 7);
    expect(Object.keys(res).sort()).toEqual(['attemptId', 'passMark', 'passed', 'percentage', 'quizId', 'score', 'submitted', 'submittedAt', 'totalMarks']);
  });

  it('result request racing the student submit gives one result', async () => {
    const { service } = build({ answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }] });
    jest.setSystemTime(new Date('2026-01-01T10:31:00Z'));
    const [a, b] = await Promise.all([service.getResult(1, 7), service.submitAttempt(1, 7)]);
    expect(a).toEqual(b);
  });
});
