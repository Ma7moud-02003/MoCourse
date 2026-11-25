import { fakeAttemptDb } from './attempt-fake-db-spec';
import { AttemptExpiryJob } from './attempt-expiry.job';

const questions = { 1: { mark: 2, choices: [{ id: 10, isCorrect: false }, { id: 11, isCorrect: true }] } };
const att = (id: number, extra: any = {}) => ({ id, quiz: { id: 10 }, user: { id: 7 + id }, submitted: false, score: 0, passed: false, expiresAt: new Date('2026-01-01T10:30:00Z'), submittedAt: null, ...extra });

describe('background expiry sweep', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setTimeout', 'nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-01-01T11:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('grades and closes expired unsubmitted attempts using saved answers, stamped with the deadline', async () => {
    const { service, state } = fakeAttemptDb({ questions, attempts: [att(1)], answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }] });
    const r = await service.closeExpiredAttempts();
    expect(r).toMatchObject({ found: 1, closed: 1, failed: 0 });
    expect(state.attempts[0]).toMatchObject({ submitted: true, score: 2 });
    expect(state.attempts[0].submittedAt).toEqual(new Date('2026-01-01T10:30:00Z'));
  });

  it('leaves attempts still running and already submitted ones alone', async () => {
    const { service, state } = fakeAttemptDb({ questions, attempts: [att(1, { expiresAt: new Date('2026-01-01T12:00:00Z') }), att(2, { submitted: true, score: 5, submittedAt: new Date('2026-01-01T10:20:00Z') })] });
    expect(await service.closeExpiredAttempts()).toMatchObject({ found: 0 });
    expect(state.attempts[0].submitted).toBe(false);
    expect(state.attempts[1].score).toBe(5);
  });

  it('is bounded per sweep (oldest first) and the next sweep continues', async () => {
    const attempts = [att(1, { expiresAt: new Date('2026-01-01T10:10:00Z') }), att(2, { expiresAt: new Date('2026-01-01T10:20:00Z') }), att(3)];
    const { service, state } = fakeAttemptDb({ questions, attempts });
    expect(await service.closeExpiredAttempts(2)).toMatchObject({ found: 2, closed: 2, hasMore: true });
    expect(state.attempts.map((a) => a.submitted)).toEqual([true, true, false]);
    expect(await service.closeExpiredAttempts(2)).toMatchObject({ found: 1, hasMore: false });
    expect(state.attempts[2].submitted).toBe(true);
  });

  it('two sweeps at once (two instances) grade each attempt once', async () => {
    const { service, state } = fakeAttemptDb({ questions, attempts: [att(1)], answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }] });
    await Promise.all([service.closeExpiredAttempts(), service.closeExpiredAttempts()]);
    expect(state.attempts[0]).toMatchObject({ submitted: true, score: 2 });
    expect(state.answers).toHaveLength(1);
  });

  it('a sweep racing the student submit gives one consistent result', async () => {
    const { service, state } = fakeAttemptDb({ questions, attempts: [att(1)], answers: [{ attemptId: 1, questionId: 1, choiceId: 11 }] });
    const [, sub] = await Promise.all([service.closeExpiredAttempts(), service.submitAttempt(1, 8)]);
    expect(sub.score).toBe(2);
    expect(state.attempts[0]).toMatchObject({ submitted: true, score: 2 });
  });

  it('a failing attempt does not stop the others', async () => {
    const { service, state } = fakeAttemptDb({ questions, attempts: [att(1, { quiz: { id: 10 } }), att(2)] });
    const orig = (service as any).finalize.bind(service);
    jest.spyOn(service as any, 'finalize').mockImplementationOnce(async () => { throw new Error('boom'); }).mockImplementation(orig);
    expect(await service.closeExpiredAttempts()).toMatchObject({ found: 2, closed: 1, failed: 1 });
    expect(state.attempts.filter((a) => a.submitted)).toHaveLength(1);
  });

  it('job: no overlapping sweeps, survives errors, interval is configurable with a floor', async () => {
    let calls = 0;
    let release!: () => void;
    const svc: any = { closeExpiredAttempts: jest.fn(() => { calls++; return new Promise((r) => (release = () => r({ found: 0, closed: 0, failed: 0, hasMore: false }))); }) };
    const job = new AttemptExpiryJob(svc);
    const first = job.sweep();
    expect(await job.sweep()).toBeNull();
    expect(calls).toBe(1);
    release();
    await first;
    svc.closeExpiredAttempts.mockRejectedValueOnce(new Error('db down'));
    expect(await job.sweep()).toBeNull();
    expect(AttemptExpiryJob.intervalMs(undefined)).toBe(60000);
    expect(AttemptExpiryJob.intervalMs('5')).toBe(60000);
    expect(AttemptExpiryJob.intervalMs('30')).toBe(30000);
  });

  it('job does not start a timer under NODE_ENV=test', () => {
    const job = new AttemptExpiryJob({} as any);
    job.onModuleInit();
    expect((job as any).timer).toBeUndefined();
  });
});
