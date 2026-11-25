import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { QuizAttemptService } from './quiz-attempt.service';
import { QuizAttemptEntity } from './quiz-attemp.entity';
import { QuizEntity } from 'src/quiz/quiz.entity';

const tick = () => new Promise((r) => setTimeout(r, 1));

function build(opts: { published?: boolean; enrolled?: boolean; timeLimit?: number; attempts?: any[] } = {}) {
  const state = {
    quiz: { id: 10, isPublished: opts.published ?? true, timeLimit: opts.timeLimit ?? 30, course: { id: 5 } } as any,
    attempts: [...(opts.attempts ?? [])] as any[],
    lockModes: [] as string[],
  };
  let mutex: Promise<void> = Promise.resolve();
  const transaction = async (fn: any) => {
    // starts in the test are serialised like the unique rule would force on duplicates
    const prev = mutex;
    let release!: () => void;
    mutex = new Promise<void>((r) => (release = r));
    await prev;
    try {
      const manager: any = {
        findOne: async (entity: any, o: any) => {
          await tick();
          if (entity === QuizEntity) {
            if (o?.lock) state.lockModes.push(o.lock.mode);
            return { ...state.quiz };
          }
          return state.attempts.find((a) => a.quiz.id === o.where.quiz.id && a.user.id === o.where.user.id) ?? null;
        },
        create: (_e: any, x: any) => ({ ...x }),
        save: async (x: any) => {
          await tick();
          const row = { id: state.attempts.length + 1, startedAt: new Date(), ...x };
          state.attempts.push(row);
          return row;
        },
      };
      return await fn(manager);
    } finally {
      release();
    }
  };
  const attemptRepo: any = { manager: { transaction } };
  const quizRepo: any = { findOne: jest.fn(async () => ({ ...state.quiz })) };
  const enroll: any = { verifyStudentEnrollment: jest.fn(async () => opts.enrolled ?? true) };
  const service = new QuizAttemptService(attemptRepo, quizRepo, enroll);
  return { service, state, enroll };
}

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

  it('after the deadline an unfinished attempt is not resumed and not duplicated', async () => {
    const { service, state } = build({ timeLimit: 30 });
    await service.startAttempt(10, 7);
    jest.setSystemTime(new Date('2026-01-01T10:30:00Z'));
    await expect(service.startAttempt(10, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(state.attempts).toHaveLength(1);
  });

  it('a submitted attempt cannot be started again', async () => {
    const { service, state } = build({ attempts: [{ id: 1, quiz: { id: 10 }, user: { id: 7 }, submitted: true, expiresAt: new Date('2026-01-01T09:00:00Z') }] });
    await expect(service.startAttempt(10, 7)).rejects.toBeInstanceOf(ConflictException);
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
