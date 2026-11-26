import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentinfoService } from './paymentinfo.service';
import { UserRoles } from 'src/utils/enums/userRole.enum';

const info = { id: 7, instapay: 'ip', vodafonCach: '010', orangeCash: 'oc', bankAccount: 'ba', ownerName: 'Ali', instractor: { id: 3 } };

function build(opts: { course?: any; payment?: any } = {}) {
  const payRepo: any = { findOne: jest.fn(async () => (opts.payment === undefined ? info : opts.payment)) };
  const courseRepo: any = { findOne: jest.fn(async () => (opts.course === undefined ? { id: 5, Instractor: { id: 3 } } : opts.course)) };
  return { svc: new PaymentinfoService(payRepo, courseRepo), payRepo, courseRepo };
}

describe('payment info is private', () => {
  it('the owner and an admin can read it', async () => {
    const { svc } = build();
    expect(await svc.getInsPatmentInfoForViewer(3, { id: 3, role: UserRoles.INSTRACTOR } as any)).toBe(info);
    expect(await svc.getInsPatmentInfoForViewer(3, { id: 1, role: UserRoles.ADMIN } as any)).toBe(info);
  });

  it('another instructor or a student is refused and nothing is read', async () => {
    const { svc, payRepo } = build();
    await expect(svc.getInsPatmentInfoForViewer(3, { id: 4, role: UserRoles.INSTRACTOR } as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.getInsPatmentInfoForViewer(3, { id: 9, role: UserRoles.STUDENT } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(payRepo.findOne).not.toHaveBeenCalled();
  });
});

describe('getPaymentInfoForCourse (student about to pay)', () => {
  it('returns only the payment fields of the course instructor, only for a published course', async () => {
    const { svc, courseRepo, payRepo } = build();
    const r = await svc.getPaymentInfoForCourse(5);
    expect(r).toEqual({ instapay: 'ip', vodafonCach: '010', orangeCash: 'oc', bankAccount: 'ba', ownerName: 'Ali' });
    expect(courseRepo.findOne.mock.calls[0][0].where).toEqual({ id: 5, isPublished: true });
    expect(payRepo.findOne.mock.calls[0][0].where).toEqual({ instractor: { id: 3 } });
  });

  it('unknown or unpublished course: 404 and no payment lookup', async () => {
    const { svc, payRepo } = build({ course: null });
    await expect(svc.getPaymentInfoForCourse(5)).rejects.toBeInstanceOf(NotFoundException);
    expect(payRepo.findOne).not.toHaveBeenCalled();
  });

  it('instructor without payment info: 404', async () => {
    const { svc } = build({ payment: null });
    await expect(svc.getPaymentInfoForCourse(5)).rejects.toBeInstanceOf(NotFoundException);
  });
});
