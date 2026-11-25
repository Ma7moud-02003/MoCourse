import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { fakeAttemptDb, FakeOpts } from './attempt-fake-db-spec';
import { QuizAttemptEntity } from './quiz-attemp.entity';

const build = (o: FakeOpts = {}) => fakeAttemptDb(o);

describe('QuizAttemptService.startAttempt', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setTimeout', 'nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-01-01T10:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('first start creates the attempt with deadline = now + timeLimit minutes', async () => {
    const { service, state } = build({ timeLimit: 30 });
    const res = await service.startAttempt(10, 7);
    expect(res.resumed).toBe(false);
    expect(res.expiresAt.toISOString()).toBe('2026-01-01T10:30:00.000Z');
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0]).toMatchObject({ attemptNumber: 1, submitted: false, score: 0, submittedAt: null });
  });

  it('start again before the deadline resumes the same attempt and keeps the original deadline', async () => {
    const { service, state } = build({ timeLimit: 30 });
    const first = await service.startAttempt(10, 7);
    jest.setSystemTime(new Date('2026-01-01T10:10:00Z'));
    const again = await service.startAttempt(10, 7);
    expect(again.resumed).toBe(true);
    expect(again.attemptId).toBe(first.attemptId);
    expect(again.expiresAt.toISOString()).toBe('2026-01-01T10:30:00.000Z');
    expect(again.serverNow.toISOString()).toBe('2026-01-01T10:10:00.000Z');
    expect(state.attempts).toHaveLength(1);
  });

  it('two simultaneous starts by the same student create one attempt', async () => {
    const { service, state } = build();
    const [a, b] = await Promise.all([service.startAttempt(10, 7), service.startAttempt(10, 7)]);
    expect(state.attempts).toHaveLength(1);
    expect(a.attemptId).toBe(b.attemptId);
    expect([a.resumed, b.resumed].sort()).toEqual([false, true]);
  });

  it('different students each get their own attempt', async () => {
    const { service, state } = build();
    await service.startAttempt(10, 7);
    await service.startAttempt(10, 8);
    expect(state.attempts).toHaveLength(2);
  });

  it('after the deadline start does not resume: the attempt is closed with a 409 carrying the result', async () => {
    const { service, state } = build({ timeLimit: 30 });
    await service.startAttempt(10, 7);
    jest.setSystemTime(new Date('2026-01-01T10:30:00Z'));
    const err: any = await service.startAttempt(10, 7).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().result).toMatchObject({ submitted: true, score: 0 });
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0].submitted).toBe(true);
  });

  it('a submitted attempt cannot be started again and the 409 carries the stored result', async () => {
    const { service, state } = build({ attempts: [{ id: 1, quiz: { id: 10 }, user: { id: 7 }, submitted: true, score: 4, passed: true, submittedAt: new Date('2026-01-01T09:30:00Z'), expiresAt: new Date('2026-01-01T09:45:00Z') }] });
    const err: any = await service.startAttempt(10, 7).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().result).toMatchObject({ attemptId: 1, score: 4, passed: true });
    expect(state.attempts).toHaveLength(1);
  });

  it('rejects a missing or unpublished exam with 404', async () => {
    const { service } = build({ published: false });
    await expect(service.startAttempt(10, 7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a student who is not enrolled and creates nothing', async () => {
    const { service, state } = build({ enrolled: false });
    await expect(service.startAttempt(10, 7)).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.attempts).toHaveLength(0);
  });

  it('checks enrollment against the exam course', async () => {
    const { service, enroll } = build();
    await service.startAttempt(10, 7);
    expect(enroll.verifyStudentEnrollment).toHaveBeenCalledWith(7, 5);
  });

  it('takes a shared (read) lock on the exam row, so starts do not block each other', async () => {
    const { service, state } = build();
    await service.startAttempt(10, 7);
    expect(state.lockModes).toEqual(['pessimistic_read']);
  });

  it('the attempt table has a unique rule on (quiz, user)', () => {
    const u = getMetadataArgsStorage().uniques.find((x) => x.target === QuizAttemptEntity);
    expect(u?.columns).toEqual(['quiz', 'user']);
  });
});
