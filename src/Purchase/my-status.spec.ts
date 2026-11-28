import { BadRequestException } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { StatusEnum } from 'src/utils/enums/purchaseStatus.enum';

function make(row: any, owns = false) {
  const repo: any = { findOne: jest.fn(async () => row), find: jest.fn(async () => (row ? [row] : [])) };
  const enroll: any = { verifyStudentEnrollment: jest.fn(async () => owns) };
  return { svc: new PurchaseService(repo, {} as any, enroll, {} as any, {} as any), repo };
}

describe('student purchase status', () => {
  it('NONE when no request and not enrolled', async () => {
    expect((await make(null).svc.getMyPurchaseStatus(3, 5)).status).toBe('NONE');
  });
  it('PAID when enrolled without a request', async () => {
    expect((await make(null, true).svc.getMyPurchaseStatus(3, 5)).status).toBe(StatusEnum.PAID);
  });
  it('returns the request status and lets a rejected one retry', async () => {
    const r: any = await make({ id: 1, status: StatusEnum.FAILED, amount: 100 }).svc.getMyPurchaseStatus(3, 5);
    expect(r).toMatchObject({ status: 'FAILED', canRetry: true, purchaseId: 1 });
    const w: any = await make({ id: 1, status: StatusEnum.WAITING_APPROVAL, amount: 100 }).svc.getMyPurchaseStatus(3, 5);
    expect(w.canRetry).toBe(false);
  });
  it('lists own requests and rejects a bad status filter', async () => {
    const { svc, repo } = make({ id: 2, status: StatusEnum.PENDING, amount: 50, course: { id: 5 } });
    const list = await svc.getMyPurchases(3, StatusEnum.PENDING);
    expect(list[0]).toMatchObject({ purchaseId: 2, status: 'PENDING' });
    expect(repo.find.mock.calls[0][0].where.user.id).toBe(3);
    await expect(svc.getMyPurchases(3, 'X' as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
