import { ReviewUniqueStudentCourse1764000000004 } from './1764000000004-ReviewUniqueStudentCourse';

type Scenario = {
  haveUnique?: boolean;
  dups?: { userId: number; courseId: number; n: number; ids: number[] }[];
};

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

describe('ReviewUniqueStudentCourse migration', () => {
  const m = new ReviewUniqueStudentCourse1764000000004();

  it('adds the unique rule when there are no duplicate pairs', async () => {
    const { queryRunner, calls } = runnerFor({});
    await m.up(queryRunner);
    const alters = calls.filter((c) => c.startsWith('ALTER'));
    expect(alters).toEqual([
      'ALTER TABLE "reviews" ADD CONSTRAINT "UQ_reviews_user_course" UNIQUE ("userId", "courseId")',
    ]);
    // the duplicate check ran before any change
    const firstAlter = calls.findIndex((c) => c.startsWith('ALTER'));
    expect(calls.slice(0, firstAlter).every((c) => c.startsWith('SELECT'))).toBe(true);
  });

  it('refuses to run and changes nothing while duplicate pairs exist', async () => {
    const { queryRunner, calls } = runnerFor({
      dups: [{ userId: 10, courseId: 1, n: 2, ids: [3, 8] }],
    });
    await expect(m.up(queryRunner)).rejects.toThrow(/duplicate \(userId, courseId\) group/);
    expect(calls.some((c) => c.startsWith('ALTER'))).toBe(false);
  });

  it('lists the duplicate rows so the owner can decide which to keep', async () => {
    const { queryRunner } = runnerFor({
      dups: [{ userId: 10, courseId: 1, n: 2, ids: [3, 8] }],
    });
    await expect(m.up(queryRunner)).rejects.toThrow(/userId=10 courseId=1 review ids=3,8/);
  });

  it('is a no-op when the constraint already exists', async () => {
    const { queryRunner, calls } = runnerFor({ haveUnique: true });
    await m.up(queryRunner);
    expect(calls.some((c) => c.startsWith('ALTER'))).toBe(false);
  });

  it('down drops only the unique rule', async () => {
    const { queryRunner, calls } = runnerFor({});
    await m.down(queryRunner);
    expect(calls).toEqual(['ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "UQ_reviews_user_course"']);
  });
});
