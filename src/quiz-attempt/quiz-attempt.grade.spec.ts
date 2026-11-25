import { ConflictException, NotFoundException } from '@nestjs/common';
import { fakeAttemptDb, FakeOpts } from './attempt-fake-db-spec';

// exam: Q1 (2 marks, correct choice 11), Q2 (3 marks, correct 21), Q3 (5 marks, correct 31); total 10
const questions = {
  1: { mark: 2, choices: [{ id: 10, isCorrect: false }, { id: 11, isCorrect: true }] },
  2: { mark: 3, choices: [{ id: 20, isCorrect: false }, { id: 21, isCorrect: true }] },
  3: { mark: 5, choices: [{ id: 30, isCorrect: false }, { id: 31, isCorrect: true }] },
};
const attempt = (extra: any = {}) => ({ id: 1, quiz: { id: 10 }, user: { id: 7 }, submitted: false, score: 0, passed: false, expiresAt: new Date('2026-01-01T10:30:00Z'), submittedAt: null, ...extra });
const build = (o: FakeOpts = {}) => fakeAttemptDb({ questions, attempts: [attempt()], ...o });

describe('QuizAttemptService.submitAttempt grading', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setTimeout', 'nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-01-01T10:10:00Z')));
  afterEach(() => jest.useRealTimers());

  it('scores the sum of marks of correct answers and applies passMark as a percentage', async () => {
    const { service, state } = build({ passMark: 60, answers: [
      { attemptId: 1, questionId: 1, choiceId: 11 }, // 2 correct
      { attemptId: 1, questionId: 2, choiceId: 20 }, // wrong
      { attemptId: 1, questionId: 3, choiceId: 31 }, // 5 correct
    ] });
    const res = await service.submitAttempt(1, 7);
    expect(res).toMatchObject({ score: 7, totalMarks: 10, percentage: 70, passMark: 60, passed: true, submitted: true });
    expect(state.attempts[0]).toMatchObject({ submitted: true, score: 7, passed: true });
    expect(state.answers.map((a) => [a.isCorrect, a.earnedMark])).toEqual([[true, 2], [false, 0], [true, 5]]);
  });

  it('fails when the percentage is below passMark, and passes exactly at passMark', async () => {
    const low = build({ passMark: 60, answers: [{ attemptId: 1, questionId: 3, choiceId: 31 }] }); // 5 of 10 = 50%
    expect((await low.service.submitAttempt(1, 7)).passed).toBe(false);
    const edge = build({ passMark: 50, answers: [{ attemptId: 1, questionId: 3, choiceId: 31 }] });
    expect((await edge.service.submitAttempt(1, 7)).passed).toBe(true);
  });

  it('unanswered questions earn 0, and passMark 0 passes with a zero score', async () => {
    const { service } = build({ passMark: 0 });
    expect(await service.submitAttempt(1, 7)).toMatchObject({ score: 0, passed: true });
    const other = build({ passMark: 1 });
    expect(await other.service.submitAttempt(1, 7)).toMatchObject({ score: 0, passed: false });
  });

  it('uses the real sum of question marks as the total, not the stored totalMarks (stale 999)', async () => {
    const { service } = build({ answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }] });
    expect((await service.submitAttempt(1, 7)).totalMarks).toBe(10);
  });

  it('a choice that belongs to another question earns nothing', async () => {
    const { service } = build({ answers: [{ attemptId: 1, questionId: 1, choiceId: 31 }] }); // choice 31 is Q3's correct choice
    expect((await service.submitAttempt(1, 7)).score).toBe(0);
  });

  it('a question from another exam earns nothing', async () => {
    const { service } = build({ quizOfQuestion: { 1: 99 }, answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }] });
    expect((await service.submitAttempt(1, 7)).score).toBe(0);
  });

  it('counts only the latest answer when a question somehow has two', async () => {
    const { service } = build({ answers: [{ attemptId: 1, questionId: 1, choiceId: 10 }, { attemptId: 1, questionId: 1, choiceId: 11 }] });
    expect((await service.submitAttempt(1, 7)).score).toBe(2);
  });

  it('ignores answers of other attempts', async () => {
    const { service } = build({ attempts: [attempt(), attempt({ id: 2, user: { id: 8 } })], answers: [{ attemptId: 2, questionId: 3, choiceId: 31 }] });
    expect((await service.submitAttempt(1, 7)).score).toBe(0);
  });

  it('submitting again returns the same result and does not regrade', async () => {
    const { service, state } = build({ answers: [{ attemptId: 1, questionId: 3, choiceId: 31 }] });
    const first = await service.submitAttempt(1, 7);
    state.answers[0].earnedMark = 123; // would change if regraded
    const second = await service.submitAttempt(1, 7);
    expect(second).toEqual(first);
    expect(state.answers[0].earnedMark).toBe(123);
  });

  it('two simultaneous submits grade once', async () => {
    const { service, state } = build({ answers: [{ attemptId: 1, questionId: 3, choiceId: 31 }] });
    const [a, b] = await Promise.all([service.submitAttempt(1, 7), service.submitAttempt(1, 7)]);
    expect(a).toEqual(b);
    expect(state.attempts[0].score).toBe(5);
  });

  it('someone else attempt looks missing and is not touched', async () => {
    const { service, state } = build();
    await expect(service.submitAttempt(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.submitAttempt(555, 7)).rejects.toBeInstanceOf(NotFoundException);
    expect(state.attempts[0].submitted).toBe(false);
  });

  it('a submit on time is stamped with the time of the submit', async () => {
    const { service } = build();
    expect((await service.submitAttempt(1, 7)).submittedAt.toISOString()).toBe('2026-01-01T10:10:00.000Z');
  });

  it('a late submit is graded on the saved answers and stamped with the deadline', async () => {
    const { service } = build({ answers: [{ attemptId: 1, questionId: 3, choiceId: 31 }] });
    jest.setSystemTime(new Date('2026-01-01T11:00:00Z'));
    const res = await service.submitAttempt(1, 7);
    expect(res.score).toBe(5);
    expect(res.submittedAt.toISOString()).toBe('2026-01-01T10:30:00.000Z');
  });
});

describe('expiry through start (auto-submit on re-entry)', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setTimeout', 'nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-01-01T10:31:00Z')));
  afterEach(() => jest.useRealTimers());

  it('start after the deadline grades the saved answers, closes the attempt, then returns 409 with the result', async () => {
    const { service, state } = build({ answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }, { attemptId: 1, questionId: 3, choiceId: 31 }] });
    const err: any = await service.startAttempt(10, 7).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().result).toMatchObject({ score: 7, totalMarks: 10, passed: true });
    // the grading was committed, not rolled back with the 409
    expect(state.attempts[0]).toMatchObject({ submitted: true, score: 7 });
    expect(state.attempts[0].submittedAt.toISOString()).toBe('2026-01-01T10:30:00.000Z');
  });

  it('starting again after that returns the same stored result', async () => {
    const { service } = build({ answers: [{ attemptId: 1, questionId: 3, choiceId: 31 }] });
    const first: any = await service.startAttempt(10, 7).catch((e) => e);
    const second: any = await service.startAttempt(10, 7).catch((e) => e);
    expect(second.getResponse().result).toEqual(first.getResponse().result);
  });
});
