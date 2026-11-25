import { ReviewCommentLength2001764000000005 } from './1764000000005-ReviewCommentLength200';

const runnerFor = (currentLength: number) => {
  const calls: string[] = [];
  const query = jest.fn(async (sql: string) => {
    calls.push(sql);
    if (sql.includes('information_schema.columns')) {
      return [{ character_maximum_length: currentLength }];
    }
    if (sql.startsWith('ALTER')) return [];
    throw new Error('unexpected SQL: ' + sql);
  });
  return { queryRunner: { query } as any, calls };
};

describe('ReviewCommentLength200 migration', () => {
  const m = new ReviewCommentLength2001764000000005();

  it('widens reviews.comment from varchar(150) to varchar(200)', async () => {
    const { queryRunner, calls } = runnerFor(150);
    await m.up(queryRunner);
    expect(calls.filter((c) => c.startsWith('ALTER'))).toEqual([
      'ALTER TABLE "reviews" ALTER COLUMN "comment" TYPE varchar(200)',
    ]);
    // the current length is read before any change
    expect(calls[0]).toContain('information_schema.columns');
  });

  it('is a no-op when the column is already varchar(200)', async () => {
    const { queryRunner, calls } = runnerFor(200);
    await m.up(queryRunner);
    expect(calls.some((c) => c.startsWith('ALTER'))).toBe(false);
  });

  it('down narrows back to varchar(150)', async () => {
    const { queryRunner, calls } = runnerFor(200);
    await m.down(queryRunner);
    expect(calls.filter((c) => c.startsWith('ALTER'))).toEqual([
      'ALTER TABLE "reviews" ALTER COLUMN "comment" TYPE varchar(150)',
    ]);
  });

  it('down is a no-op when already at varchar(150)', async () => {
    const { queryRunner, calls } = runnerFor(150);
    await m.down(queryRunner);
    expect(calls.some((c) => c.startsWith('ALTER'))).toBe(false);
  });
});
