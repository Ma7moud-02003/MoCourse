import { checkEnrollmentSchemaSafety } from './enrollment-sync-guard';

type Scenario = { table?: boolean; haveRule?: boolean; dups?: any[] };

const queryFor = (s: Scenario) => {
  const calls: string[] = [];
  const query = async (sql: string) => {
    calls.push(sql);
    if (sql.includes('information_schema.tables')) return s.table === false ? [] : [1];
    if (sql.includes('pg_constraint')) return s.haveRule ? [1] : [];
    if (sql.includes('HAVING count(*) > 1')) return s.dups ?? [];
    throw new Error('unexpected SQL: ' + sql);
  };
  return { query, calls };
};

const dup = {
  userId: 2,
  courseId: 1,
  rows: [
    { id: 1, status: 'completed', enrolledAt: '2026-01-01', completedAt: '2026-02-01' },
    { id: 8, status: 'in_progress', enrolledAt: '2026-01-05', completedAt: null },
  ],
};

describe('checkEnrollmentSchemaSafety', () => {
  it('passes on a fresh database without the table', async () => {
    await expect(checkEnrollmentSchemaSafety(queryFor({ table: false }).query)).resolves.toBeUndefined();
  });
  it('passes when the unique rule already exists', async () => {
    await expect(checkEnrollmentSchemaSafety(queryFor({ haveRule: true, dups: [dup] }).query)).resolves.toBeUndefined();
  });
  it('passes when the rule is missing but there are no duplicates', async () => {
    await expect(checkEnrollmentSchemaSafety(queryFor({}).query)).resolves.toBeUndefined();
  });
  it('refuses to start with duplicates and lists the rows', async () => {
    await expect(checkEnrollmentSchemaSafety(queryFor({ dups: [dup] }).query)).rejects.toThrow(
      /Refusing to start.*userId=2 courseId=1 enrollments: #1 \(completed.*#8 \(in_progress/s,
    );
  });
  it('only reads', async () => {
    const { query, calls } = queryFor({ dups: [dup] });
    await expect(checkEnrollmentSchemaSafety(query)).rejects.toThrow();
    expect(calls.every((c) => c.trimStart().toUpperCase().startsWith('SELECT'))).toBe(true);
  });
});
