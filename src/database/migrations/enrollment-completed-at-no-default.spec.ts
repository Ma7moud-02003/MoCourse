import { getMetadataArgsStorage } from 'typeorm';
import { EnrollmentEntity } from '../../enrollment/enrollment.entity';
import { EnrollmentCompletedAtNoDefault1764000000008 } from './1764000000008-EnrollmentCompletedAtNoDefault';
import { classifyEnrollment } from '../enrollment-completed-at-report';

const runnerFor = (columnDefault: string | null) => {
  const calls: string[] = [];
  const query = jest.fn(async (sql: string) => {
    calls.push(sql);
    if (sql.includes('information_schema.columns')) return [{ column_default: columnDefault }];
    if (sql.startsWith('ALTER')) return [];
    throw new Error('unexpected SQL: ' + sql);
  });
  return { queryRunner: { query } as any, calls };
};

describe('EnrollmentCompletedAtNoDefault migration', () => {
  const m = new EnrollmentCompletedAtNoDefault1764000000008();

  it('drops the default and touches no row', async () => {
    const { queryRunner, calls } = runnerFor("('now'::text)::timestamp(6) with time zone");
    await m.up(queryRunner);
    expect(calls.filter((c) => !c.includes('information_schema'))).toEqual([
      'ALTER TABLE "enrollments" ALTER COLUMN "completedAt" DROP DEFAULT',
    ]);
    expect(calls.some((c) => /^(UPDATE|DELETE)/i.test(c))).toBe(false);
  });
  it('is a no-op when there is no default', async () => {
    const { queryRunner, calls } = runnerFor(null);
    await m.up(queryRunner);
    expect(calls.some((c) => c.startsWith('ALTER'))).toBe(false);
  });
  it('down restores the old default only when missing', async () => {
    const a = runnerFor(null);
    await m.down(a.queryRunner);
    expect(a.calls.filter((c) => c.startsWith('ALTER'))).toHaveLength(1);
    const b = runnerFor('now()');
    await m.down(b.queryRunner);
    expect(b.calls.some((c) => c.startsWith('ALTER'))).toBe(false);
  });
});

describe('EnrollmentEntity.completedAt', () => {
  it('is nullable and has no default', () => {
    const col = getMetadataArgsStorage().columns.find((c) => c.target === EnrollmentEntity && c.propertyName === 'completedAt');
    expect(col?.options.nullable).toBe(true);
    expect(col?.options.default).toBeUndefined();
  });
});

describe('classifyEnrollment (read-only review)', () => {
  const base = { id: 1, userId: 1, courseId: 1 };
  it('flags an in-progress row that has a date', () => {
    expect(classifyEnrollment({ ...base, status: 'in_progress', enrolledAt: '2026-11-01 10:00:00', completedAt: '2026-11-01 10:00:00' })).toBe('IN_PROGRESS_HAS_COMPLETED_AT');
  });
  it('accepts an in-progress row without a date', () => {
    expect(classifyEnrollment({ ...base, status: 'in_progress', enrolledAt: '2026-11-01 10:00:00', completedAt: null })).toBeNull();
  });
  it('flags completed rows with no date or a date equal to enrolment', () => {
    expect(classifyEnrollment({ ...base, status: 'completed', enrolledAt: '2026-11-01 10:00:00', completedAt: null })).toBe('COMPLETED_WITHOUT_DATE');
    expect(classifyEnrollment({ ...base, status: 'completed', enrolledAt: '2026-11-01 10:00:00', completedAt: '2026-11-01 10:00:01' })).toBe('COMPLETED_AT_EQUALS_ENROLLED_AT');
  });
  it('accepts a completed row with a later date', () => {
    expect(classifyEnrollment({ ...base, status: 'completed', enrolledAt: '2026-11-01 10:00:00', completedAt: '2026-11-20 09:00:00' })).toBeNull();
  });
});
