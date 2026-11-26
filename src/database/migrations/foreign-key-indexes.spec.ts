import { AddForeignKeyIndexes1764000000009, FK_INDEXES } from './1764000000009-AddForeignKeyIndexes';

describe('AddForeignKeyIndexes migration', () => {
  it('creates every index with IF NOT EXISTS and drops them on down', async () => {
    const run = jest.fn().mockResolvedValue([]);
    const m = new AddForeignKeyIndexes1764000000009();
    await m.up({ query: run } as any);
    expect(run).toHaveBeenCalledTimes(FK_INDEXES.length);
    for (const [sql] of run.mock.calls) expect(sql).toMatch(/^CREATE INDEX IF NOT EXISTS /);
    run.mockClear();
    await m.down({ query: run } as any);
    expect(run).toHaveBeenCalledTimes(FK_INDEXES.length);
    for (const [sql] of run.mock.calls) expect(sql).toMatch(/^DROP INDEX IF EXISTS /);
  });
  it('has unique index names', () => {
    expect(new Set(FK_INDEXES.map((i) => i.name)).size).toBe(FK_INDEXES.length);
  });
});
