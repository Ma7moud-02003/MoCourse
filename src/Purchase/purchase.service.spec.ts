import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { StatusEnum } from 'src/utils/enums/purchaseStatus.enum';

/**
 * In-memory fake database with transaction semantics: writes made in a transaction are discarded if the
 * callback throws, and transactions run one at a time (like a row lock on the purchase).
 */
function fakeDb(initialStatus: StatusEnum, opts: { failStatusUpdate?: boolean; alreadyEnrolled?: boolean } = {}) {
  const state = { status: initialStatus, enrollments: opts.alreadyEnrolled ? [{ u: 3, c: 5 }] : ([] as any[]) };
  let queue: Promise<any> = Promise.resolve();
  const purchaseRow = () => ({ id: 1, status: state.status, course: { id: 5, title: 'C', Instractor: { id: 9 } }, user: { id: 3 } });
  const repo = {
    findOne: jest.fn(async () => purchaseRow()),
    update: jest.fn(async (_id: number, patch: any) => {
      if (opts.failStatusUpdate) throw new Error('db down');
      state.status = patch.status;
    }),
  };
  const manager: any = { getRepository: () => repo };
  const transaction = (cb: any) => {
    const run = queue.then(async () => {
      const snapshot = { status: state.status, enrollments: [...state.enrollments] };
      try {
        return await cb(manager);
      } catch (e) {
        state.status = snapshot.status;
        state.enrollments = snapshot.enrollments;
        throw e;
      }
    });
    queue = run.catch(() => undefined);
    return run;
  };
  return { state, purchaseRepo: { manager: { transaction } } as any };
}

function setup(db: ReturnType<typeof fakeDb>) {
  const enroll: any = {
    enrollCourseInTransaction: jest.fn(async (_m: any, c: number, u: number) => {
      if (db.state.enrollments.some((e) => e.u === u && e.c === c)) return false;
      db.state.enrollments.push({ u, c });
      return true;
    }),
  };
  const notif: any = { creatNotification: jest.fn().mockResolvedValue(undefined) };
  const svc = new PurchaseService(db.purchaseRepo, {} as any, enroll, {} as any, notif);
  return { svc, enroll, notif };
}

describe('updatPurchaseStatus', () => {
  it('PAID enrolls the student and saves PAID together', async () => {
    const db = fakeDb(StatusEnum.WAITING_APPROVAL);
    const { svc, notif } = setup(db);
    await svc.updatPurchaseStatus(1, StatusEnum.PAID, 9);
    expect(db.state.status).toBe(StatusEnum.PAID);
    expect(db.state.enrollments).toEqual([{ u: 3, c: 5 }]);
    expect(notif.creatNotification).toHaveBeenCalledTimes(1);
  });

  it('rolls back the enrollment if saving the PAID status fails', async () => {
    const db = fakeDb(StatusEnum.WAITING_APPROVAL, { failStatusUpdate: true });
    const { svc } = setup(db);
    await expect(svc.updatPurchaseStatus(1, StatusEnum.PAID, 9)).rejects.toThrow('db down');
    expect(db.state.enrollments).toEqual([]);
    expect(db.state.status).toBe(StatusEnum.WAITING_APPROVAL);
  });

  it('does not mark PAID if enrollment fails (e.g. unpublished course)', async () => {
    const db = fakeDb(StatusEnum.WAITING_APPROVAL);
    const { svc, enroll } = setup(db);
    enroll.enrollCourseInTransaction.mockRejectedValue(new BadRequestException('Course is not Published Yet'));
    await expect(svc.updatPurchaseStatus(1, StatusEnum.PAID, 9)).rejects.toThrow(BadRequestException);
    expect(db.state.status).toBe(StatusEnum.WAITING_APPROVAL);
  });

  it('two simultaneous approvals: one succeeds, the other is rejected, one enrollment only', async () => {
    const db = fakeDb(StatusEnum.WAITING_APPROVAL);
    const { svc, enroll } = setup(db);
    const results = await Promise.allSettled([
      svc.updatPurchaseStatus(1, StatusEnum.PAID, 9),
      svc.updatPurchaseStatus(1, StatusEnum.PAID, 9),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(enroll.enrollCourseInTransaction).toHaveBeenCalledTimes(1);
    expect(db.state.enrollments).toHaveLength(1);
  });

  it('FAILED never enrolls', async () => {
    const db = fakeDb(StatusEnum.WAITING_APPROVAL);
    const { svc, enroll } = setup(db);
    await svc.updatPurchaseStatus(1, StatusEnum.FAILED, 9);
    expect(enroll.enrollCourseInTransaction).not.toHaveBeenCalled();
    expect(db.state.status).toBe(StatusEnum.FAILED);
  });

  it('rejects PENDING / WAITING_APPROVAL as target status (no free enrollment)', async () => {
    for (const st of [StatusEnum.PENDING, StatusEnum.WAITING_APPROVAL]) {
      const db = fakeDb(StatusEnum.WAITING_APPROVAL);
      const { svc } = setup(db);
      await expect(svc.updatPurchaseStatus(1, st, 9)).rejects.toThrow(BadRequestException);
      expect(db.state.enrollments).toEqual([]);
    }
  });

  it('rejects approving a purchase that is not waiting for approval', async () => {
    const db = fakeDb(StatusEnum.PENDING);
    const { svc } = setup(db);
    await expect(svc.updatPurchaseStatus(1, StatusEnum.PAID, 9)).rejects.toThrow(BadRequestException);
    expect(db.state.enrollments).toEqual([]);
  });

  it('rejects another instructor', async () => {
    const db = fakeDb(StatusEnum.WAITING_APPROVAL);
    const { svc } = setup(db);
    await expect(svc.updatPurchaseStatus(1, StatusEnum.PAID, 77)).rejects.toThrow(UnauthorizedException);
    expect(db.state.status).toBe(StatusEnum.WAITING_APPROVAL);
  });
});
