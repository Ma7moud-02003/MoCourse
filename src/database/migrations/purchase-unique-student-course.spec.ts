import { PurchaseUniqueStudentCourse1764000000007 } from './1764000000007-PurchaseUniqueStudentCourse';

type Scenario = { haveUnique?: boolean; dups?: any[] };

const runnerFor = (s: Scenario) => {
  const calls: string[] = [];
  const query = jest.fn(async (sql: string) => {
    calls.push(sql);
    if (sql.includes('pg_constraint WHERE conname')) return s.haveUnique ? [1] : [];
    if (sql.includes('HAVING count(*) > 1')) return s.dups ?? [];
    if (sql.startsWith('ALTER')) return [];
    throw new Error('unexpected SQL: ' + sql);
  });
  return { queryRunner: { query } as any, calls };
};

const dup = {
  userId: 10,
  courseId: 1,
  n: 2,
  rows: [
    { id: 3, status: 'PAID', amount: 100, paymentMethod: 'VODAFONE_CASH', transactionId: 't1', enrolledAt: '2026-11-01' },
    { id: 8, status: 'PAID', amount: 100, paymentMethod: 'VODAFONE_CASH', transactionId: 't2', enrolledAt: '2026-11-02' },
  ],
};

describe('PurchaseUniqueStudentCourse migration', () => {
  const m = new PurchaseUniqueStudentCourse1764000000007();

  it('adds the unique rule when there are no duplicate pairs', async () => {
    const { queryRunner, calls } = runnerFor({});
    await m.up(queryRunner);
    expect(calls.filter((c) => c.startsWith('ALTER'))).toEqual([
      'ALTER TABLE "purchase" ADD CONSTRAINT "UQ_purchase_user_course" UNIQUE ("userId", "courseId")',
    ]);
    const firstAlter = calls.findIndex((c) => c.startsWith('ALTER'));
    expect(calls.slice(0, firstAlter).every((c) => c.startsWith('SELECT'))).toBe(true);
  });

  it('refuses to run, changes and deletes nothing while duplicate pairs exist', async () => {
    const { queryRunner, calls } = runnerFor({ dups: [dup] });
    await expect(m.up(queryRunner)).rejects.toThrow(/duplicate \(userId, courseId\) group/);
    expect(calls.every((c) => c.startsWith('SELECT'))).toBe(true);
  });

  it('lists the duplicate rows with status so the owner can decide', async () => {
    const { queryRunner } = runnerFor({ dups: [dup] });
    await expect(m.up(queryRunner)).rejects.toThrow(/userId=10 courseId=1 purchase: #3 \(PAID.*#8 \(PAID/);
  });

  it('is a no-op when the constraint already exists', async () => {
    const { queryRunner, calls } = runnerFor({ haveUnique: true });
    await m.up(queryRunner);
    expect(calls.some((c) => c.startsWith('ALTER'))).toBe(false);
  });

  it('down drops only the unique rule', async () => {
    const { queryRunner, calls } = runnerFor({});
    await m.down(queryRunner);
    expect(calls).toEqual(['ALTER TABLE "purchase" DROP CONSTRAINT IF EXISTS "UQ_purchase_user_course"']);
  });
});
