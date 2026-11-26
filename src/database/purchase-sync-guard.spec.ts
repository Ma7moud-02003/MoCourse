import { checkPurchaseSchemaSafety } from './purchase-sync-guard';

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
    { id: 1, status: 'PAID', amount: 100, paymentMethod: 'X', transactionId: 'a', enrolledAt: '2026-01-01' },
    { id: 8, status: 'PAID', amount: 100, paymentMethod: 'X', transactionId: 'b', enrolledAt: '2026-01-05' },
  ],
};

describe('checkPurchaseSchemaSafety', () => {
  it('passes on a fresh database without the table', async () => {
    await expect(checkPurchaseSchemaSafety(queryFor({ table: false }).query)).resolves.toBeUndefined();
  });
  it('passes when the unique rule already exists', async () => {
    await expect(checkPurchaseSchemaSafety(queryFor({ haveRule: true, dups: [dup] }).query)).resolves.toBeUndefined();
  });
  it('passes when the rule is missing but there are no duplicates', async () => {
    await expect(checkPurchaseSchemaSafety(queryFor({}).query)).resolves.toBeUndefined();
  });
  it('refuses to start with duplicates and lists the rows', async () => {
    await expect(checkPurchaseSchemaSafety(queryFor({ dups: [dup] }).query)).rejects.toThrow(
      /Refusing to start.*userId=2 courseId=1 purchase: #1 \(PAID.*#8 \(PAID/s,
    );
  });
  it('only reads', async () => {
    const { query, calls } = queryFor({ dups: [dup] });
    await expect(checkPurchaseSchemaSafety(query)).rejects.toThrow();
    expect(calls.every((c) => c.trimStart().toUpperCase().startsWith('SELECT'))).toBe(true);
  });
});
