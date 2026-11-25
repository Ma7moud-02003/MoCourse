import { PurchaseService } from './Purchase/purchase.service';
import { ProgressService } from './progress/progress.service';

describe('instructor totalProfite', () => {
  const svc = (row: any) => {
    const qb: any = {};
    for (const m of ['innerJoin', 'where', 'andWhere', 'select']) qb[m] = jest.fn().mockReturnValue(qb);
    qb.getRawOne = jest.fn().mockResolvedValue(row);
    return new PurchaseService({ createQueryBuilder: () => qb } as any, {} as any, {} as any, {} as any, {} as any);
  };
  it('is "0" (not null) when there are no paid purchases', async () => {
    expect(await svc({ totalAmount: null }).getTotalProfite(1)).toBe('0');
    expect(await svc(undefined).getTotalProfite(1)).toBe('0');
  });
  it('keeps the existing string type when there are paid purchases (SUM comes back as text)', async () => {
    expect(await svc({ totalAmount: '350' }).getTotalProfite(1)).toBe('350');
  });
});

describe('student last lesson ("continue learning")', () => {
  it('asks for the most recently updated progress first, ties by newest id', async () => {
    const find = jest.fn().mockResolvedValue({ id: 3 });
    const svc = new ProgressService({ findOne: find } as any, {} as any, {} as any, {} as any);
    await svc.getLastLessonForStudnt(5);
    expect(find.mock.calls[0][0].order).toEqual({ updatedAt: 'DESC', id: 'DESC' });
  });
});
