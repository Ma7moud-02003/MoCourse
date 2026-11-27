import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { fakeAttemptDb, FakeOpts } from './attempt-fake-db-spec';
import { QuizAttemptEntity } from './quiz-attemp.entity';

const build = (o: FakeOpts = {}) => fakeAttemptDb(o);

describe('QuizAttemptService.startAttempt', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setTimeout', 'nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-01-01T10:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('first start creates the attempt with deadline = start + timeLimit, capped at the closing time (here both give 10:30)', async () => {
    const { service, state } = build();
    const res = await service.startAttempt(10, 7);
    expect(res.resumed).toBe(false);
    expect(res.expiresAt.toISOString()).toBe('2026-01-01T10:30:00.000Z');
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0].expiresAt.toISOString()).toBe('2026-01-01T10:30:00.000Z');
    expect(state.attempts[0]).toMatchObject({ attemptNumber: 1, submitted: false, score: 0, submittedAt: null });
  });

  it('start again before the deadline resumes the same attempt and keeps the original deadline', async () => {
    const { service, state } = build();
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
    const { service, state } = build();
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
    expect(state.courseLocks).toEqual(['pessimistic_read']); // course row is locked (shared) before the exam row
  });

  it('the attempt table has a unique rule on (quiz, user)', () => {
    const u = getMetadataArgsStorage().uniques.find((x) => x.target === QuizAttemptEntity);
    expect(u?.columns).toEqual(['quiz', 'user']);
  });

  it('a late entrant gets only the rest of the shared window', async () => {
    const { service } = build({ opensAt: new Date('2026-01-01T09:00:00Z'), closesAt: new Date('2026-01-01T10:00:00Z') });
    jest.setSystemTime(new Date('2026-01-01T09:30:00Z'));
    const res = await service.startAttempt(10, 7);
    expect(res.expiresAt.toISOString()).toBe('2026-01-01T10:00:00.000Z');
  });

  it('two students starting at different times get the same deadline when the time limit reaches past the close', async () => {
    const { service } = build();
    const a = await service.startAttempt(10, 7);
    jest.setSystemTime(new Date('2026-01-01T10:20:00Z'));
    const b = await service.startAttempt(10, 8);
    expect(a.expiresAt.getTime()).toBe(b.expiresAt.getTime());
  });

  it('timeLimit shorter than the window: deadline = start + timeLimit', async () => {
    const { service, state } = build({ timeLimit: 20, opensAt: new Date('2026-01-01T09:00:00Z'), closesAt: new Date('2026-01-01T11:00:00Z') });
    const res = await service.startAttempt(10, 7);
    expect(res.expiresAt.toISOString()).toBe('2026-01-01T10:20:00.000Z');
    expect(state.attempts[0].expiresAt.toISOString()).toBe('2026-01-01T10:20:00.000Z');
  });

  it('each student gets their own timer from their own start', async () => {
    const { service } = build({ timeLimit: 20, opensAt: new Date('2026-01-01T09:00:00Z'), closesAt: new Date('2026-01-01T11:00:00Z') });
    const a = await service.startAttempt(10, 7);
    jest.setSystemTime(new Date('2026-01-01T10:30:00Z'));
    const b = await service.startAttempt(10, 8);
    expect(a.expiresAt.toISOString()).toBe('2026-01-01T10:20:00.000Z');
    expect(b.expiresAt.toISOString()).toBe('2026-01-01T10:50:00.000Z');
  });

  it('a late student is capped at the closing time even if timeLimit would go past it', async () => {
    const { service } = build({ timeLimit: 60, opensAt: new Date('2026-01-01T09:00:00Z'), closesAt: new Date('2026-01-01T10:30:00Z') });
    jest.setSystemTime(new Date('2026-01-01T10:15:00Z'));
    const res = await service.startAttempt(10, 7);
    expect(res.expiresAt.toISOString()).toBe('2026-01-01T10:30:00.000Z');
  });

  it('resuming keeps the original timer, it does not restart', async () => {
    const { service } = build({ timeLimit: 20, opensAt: new Date('2026-01-01T09:00:00Z'), closesAt: new Date('2026-01-01T11:00:00Z') });
    const first = await service.startAttempt(10, 7);
    jest.setSystemTime(new Date('2026-01-01T10:10:00Z'));
    const again = await service.startAttempt(10, 7);
    expect(again.resumed).toBe(true);
    expect(again.expiresAt.getTime()).toBe(first.expiresAt.getTime());
  });

  it('before the exam opens: refused with 403, nothing created', async () => {
    const { service, state } = build({ opensAt: new Date('2026-01-01T10:30:00Z'), closesAt: new Date('2026-01-01T11:30:00Z') });
    await expect(service.startAttempt(10, 7)).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.attempts).toHaveLength(0);
  });

  it('exactly at opening time is allowed', async () => {
    const { service } = build({ opensAt: new Date('2026-01-01T10:00:00Z') });
    await expect(service.startAttempt(10, 7)).resolves.toMatchObject({ resumed: false });
  });

  it('after the exam closes with no attempt: 409 and no attempt (so no zero result) is created', async () => {
    const { service, state } = build();
    jest.setSystemTime(new Date('2026-01-01T10:30:00Z'));
    await expect(service.startAttempt(10, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(state.attempts).toHaveLength(0);
  });

  it('an exam with no window (old exam) cannot be started', async () => {
    const { service, state } = build({ opensAt: null, closesAt: null });
    await expect(service.startAttempt(10, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(state.attempts).toHaveLength(0);
  });

  it('re-entry after close with an unfinished attempt still grades it (409 with result)', async () => {
    const { service, state } = build();
    await service.startAttempt(10, 7);
    jest.setSystemTime(new Date('2026-01-01T10:45:00Z'));
    const err: any = await service.startAttempt(10, 7).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().result).toMatchObject({ submitted: true });
    expect(state.attempts[0].submitted).toBe(true);
  });
});

describe('start lock order (account deletion safety, no deadlock)', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setTimeout', 'nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-01-01T10:00:00Z')));
  afterEach(() => jest.useRealTimers());
  it('locks the user row first (shared), then the course (shared), then the exam (shared)', async () => {
    const { service, state } = fakeAttemptDb() as any;
    await service.startAttempt(10, 7);
    expect(state.lockOrder.slice(0, 3)).toEqual(['user:pessimistic_read', 'course:pessimistic_read', 'quiz:pessimistic_read']);
  });
});
