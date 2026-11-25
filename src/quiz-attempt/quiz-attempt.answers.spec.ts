import { ConflictException, NotFoundException } from '@nestjs/common';
import { fakeAttemptDb, FakeOpts } from './attempt-fake-db-spec';

const questions = {
  1: { mark: 2, choices: [{ id: 10, isCorrect: false }, { id: 11, isCorrect: true }] },
  2: { mark: 3, choices: [{ id: 20, isCorrect: false }, { id: 21, isCorrect: true }] },
};
const attempt = (extra: any = {}) => ({ id: 1, quiz: { id: 10 }, user: { id: 7 }, submitted: false, score: 0, passed: false, expiresAt: new Date('2026-01-01T10:30:00Z'), submittedAt: null, ...extra });
const build = (o: FakeOpts = {}) => fakeAttemptDb({ questions, attempts: [attempt()], ...o });

describe('QuizAttemptService.saveAnswer', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setTimeout', 'nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-01-01T10:10:00Z')));
  afterEach(() => jest.useRealTimers());

  it('saves a choice, then changing it updates the same row', async () => {
    const { service, state } = build();
    await service.saveAnswer(1, 7, 1, 10);
    expect(state.answers).toHaveLength(1);
    await service.saveAnswer(1, 7, 1, 11);
    expect(state.answers).toHaveLength(1);
    expect(state.answers[0]).toMatchObject({ questionId: 1, choiceId: 11 });
    await service.saveAnswer(1, 7, 2, 20);
    expect(state.answers).toHaveLength(2);
  });

  it('never stores correctness at save time and does not return it', async () => {
    const { service, state } = build();
    const res = await service.saveAnswer(1, 7, 1, 11);
    expect(state.answers[0]).toMatchObject({ isCorrect: false, earnedMark: 0 });
    expect(JSON.stringify(res)).not.toMatch(/isCorrect|earnedMark|score/);
  });

  it('refuses a choice from another question, and a question from another exam', async () => {
    const a = build();
    await expect(a.service.saveAnswer(1, 7, 1, 21)).rejects.toBeInstanceOf(NotFoundException);
    const b = build({ quizOfQuestion: { 1: 99 } });
    await expect(b.service.saveAnswer(1, 7, 1, 11)).rejects.toBeInstanceOf(NotFoundException);
    expect(a.state.answers).toHaveLength(0);
    expect(b.state.answers).toHaveLength(0);
  });

  it("another student's attempt looks missing and nothing is saved", async () => {
    const { service, state } = build();
    await expect(service.saveAnswer(1, 8, 1, 11)).rejects.toBeInstanceOf(NotFoundException);
    expect(state.answers).toHaveLength(0);
  });

  it('refuses after submit', async () => {
    const { service, state } = build({ attempts: [attempt({ submitted: true })] });
    await expect(service.saveAnswer(1, 7, 1, 11)).rejects.toBeInstanceOf(ConflictException);
    expect(state.answers).toHaveLength(0);
  });

  it('after the deadline nothing is saved; saved answers are graded and the attempt closed (409 with result)', async () => {
    const { service, state } = build({ answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }] });
    jest.setSystemTime(new Date('2026-01-01T10:31:00Z'));
    const err: any = await service.saveAnswer(1, 7, 2, 21).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().result).toMatchObject({ score: 2, submitted: true });
    expect(state.answers).toHaveLength(1);
    expect(state.attempts[0].submitted).toBe(true);
  });

  it('exactly at the deadline is already too late', async () => {
    const { service, state } = build();
    jest.setSystemTime(new Date('2026-01-01T10:30:00Z'));
    await expect(service.saveAnswer(1, 7, 1, 11)).rejects.toBeInstanceOf(ConflictException);
    expect(state.answers).toHaveLength(0);
  });

  it('concurrent saves for the same question leave one row; a save racing a submit is graded or refused, never lost silently', async () => {
    const a = build();
    await Promise.all([a.service.saveAnswer(1, 7, 1, 10), a.service.saveAnswer(1, 7, 1, 11)]);
    expect(a.state.answers).toHaveLength(1);
    const b = build();
    const [save, sub] = await Promise.allSettled([b.service.saveAnswer(1, 7, 1, 11), b.service.submitAttempt(1, 7)]);
    expect(sub.status).toBe('fulfilled');
    expect(b.state.attempts[0].submitted).toBe(true);
    const saved = b.state.answers.length === 1;
    expect(save.status).toBe(saved ? 'fulfilled' : 'rejected');
    expect((sub as any).value.score).toBe(saved ? 2 : 0);
  });

  it('resume returns the saved choices only; a new attempt returns none', async () => {
    const { service } = build({ attempts: [], answers: [] });
    const first: any = await service.startAttempt(10, 7);
    expect(first.answers).toEqual([]);
    await service.saveAnswer(first.attemptId, 7, 1, 10);
    await service.saveAnswer(first.attemptId, 7, 1, 11);
    await service.saveAnswer(first.attemptId, 7, 2, 20);
    const again: any = await service.startAttempt(10, 7);
    expect(again.resumed).toBe(true);
    expect(again.answers).toEqual([{ questionId: 1, choiceId: 11 }, { questionId: 2, choiceId: 20 }]);
    expect(JSON.stringify(again)).not.toMatch(/isCorrect|earnedMark/);
  });
});
