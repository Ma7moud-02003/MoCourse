import { PurchaseService } from './purchase.service';

describe('getLastPendingPurchase', () => {
  it('asks for the newest waiting purchases first', async () => {
    const find = jest.fn(async () => []);
    const svc = new PurchaseService({ find } as any, {} as any, {} as any, {} as any, {} as any);
    await svc.getLastPendingPurchase(9);
    const args: any = (find.mock.calls[0] as any[])[0];
    expect(args.order).toEqual({ enrolledAt: 'DESC', id: 'DESC' });
    expect(args.take).toBe(2);
  });
});
