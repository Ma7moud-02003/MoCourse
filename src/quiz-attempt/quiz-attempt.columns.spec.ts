import { getMetadataArgsStorage } from 'typeorm';
import { QuizAttemptEntity } from './quiz-attemp.entity';

const col = (name: string) =>
  getMetadataArgsStorage().columns.find((c) => c.target === QuizAttemptEntity && c.propertyName === name);

describe('QuizAttemptEntity timestamps', () => {
  it('expiresAt is a plain required column with no auto value', () => {
    const c: any = col('expiresAt');
    expect(c.mode).toBe('regular');
    expect(c.options.default).toBeUndefined();
    expect(c.options.nullable).toBeFalsy();
  });

  it('submittedAt is a plain nullable column that never updates by itself', () => {
    const c: any = col('submittedAt');
    expect(c.mode).toBe('regular');
    expect(c.options.nullable).toBe(true);
    expect(c.options.default).toBeUndefined();
    expect(c.options.onUpdate).toBeUndefined();
  });

  it('startedAt still records creation time', () => {
    expect((col('startedAt') as any).mode).toBe('createDate');
  });

  it('has a partial index on expiresAt for unsubmitted attempts (used by the expiry sweep)', () => {
    const idx: any = getMetadataArgsStorage().indices.find((x: any) => x.target === QuizAttemptEntity && x.name === 'IDX_quiz_attempt_open_expiry');
    expect(idx).toBeDefined();
    expect(idx.columns).toEqual(['expiresAt']);
    expect(idx.where).toBe('"submitted" = false');
  });
});
