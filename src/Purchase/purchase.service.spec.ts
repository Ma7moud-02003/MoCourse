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

describe('buyCourse: one purchase request per student and course', () => {
  const make = (opts: { enrolled?: boolean; existing?: any; saveError?: any; winner?: any }) => {
    const repo: any = {
      findOne: jest.fn().mockResolvedValueOnce(opts.existing ?? null).mockResolvedValue(opts.winner ?? null),
      create: jest.fn((x) => x),
      save: opts.saveError ? jest.fn().mockRejectedValue(opts.saveError) : jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const course: any = { getSingleCourse: jest.fn().mockResolvedValue({ id: 5, isPublished: true, price: 100, discountPrice: null }) };
    const enroll: any = { verifyStudentEnrollment: jest.fn().mockResolvedValue(!!opts.enrolled) };
    return { svc: new PurchaseService(repo, course, enroll, {} as any, {} as any), repo };
  };
  const uniqueViolation = () => {
    const { QueryFailedError } = require('typeorm');
    return new QueryFailedError('insert', [], Object.assign(new Error('dup'), { code: '23505' }));
  };

  it('an enrolled student gets no new purchase request', async () => {
    const { svc, repo } = make({ enrolled: true });
    await expect(svc.buyCourse(3, 5)).rejects.toThrow(/alrealdy own/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('first request creates one PENDING purchase', async () => {
    const { svc, repo } = make({});
    await svc.buyCourse(3, 5);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ status: StatusEnum.PENDING, amount: 100 }));
  });

  it('a request waiting for approval stays the one to follow: nothing created or changed', async () => {
    const { svc, repo } = make({ existing: { id: 7, status: StatusEnum.WAITING_APPROVAL } });
    const r: any = await svc.buyCourse(3, 5);
    expect(r.message).toMatch(/قيد المراجعة/);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('a pending request is followed, not duplicated', async () => {
    const { svc, repo } = make({ existing: { id: 7, status: StatusEnum.PENDING } });
    await svc.buyCourse(3, 5);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('a rejected request is retried on the same row, only while it is still rejected', async () => {
    const { svc, repo } = make({ existing: { id: 7, status: StatusEnum.FAILED } });
    await svc.buyCourse(3, 5);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith({ id: 7, status: StatusEnum.FAILED }, { status: StatusEnum.PENDING });
  });

  it('two simultaneous first requests: the loser follows the winner instead of failing', async () => {
    const { svc } = make({ saveError: uniqueViolation(), winner: { id: 9, status: StatusEnum.PENDING } });
    const r: any = await svc.buyCourse(3, 5);
    expect(r.message).toMatch(/اذهب للدفع/);
  });

  it('other save errors are not swallowed', async () => {
    const { svc } = make({ saveError: new Error('db down') });
    await expect(svc.buyCourse(3, 5)).rejects.toThrow('db down');
  });
});

describe('confirmCheckOut: proof submit and instructor notification', () => {
  const png: any = { buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]), mimetype: 'image/png', size: 10, originalname: 'a.png' };
  const dto: any = { transactionId: 't', paymentMethod: 'instapay' };
  function make(affected: number, notifyFails = false) {
    const row = { id: 1, status: StatusEnum.PENDING, user: { id: 3 }, course: { id: 5, title: 'C', Instractor: { id: 9 } } };
    const repo: any = {
      findOne: jest.fn(async () => row),
      createQueryBuilder: () => { const b: any = {}; b.update = () => b; b.set = () => b; b.where = () => b; b.execute = async () => ({ affected }); return b; },
    };
    const cloud: any = { uploadFile: jest.fn(async () => ({ secure_url: 'u', public_id: 'p' })), destroyAsset: jest.fn(async () => true) };
    const notif: any = { creatNotification: jest.fn(notifyFails ? async () => { throw new Error('boom'); } : async () => undefined) };
    return { svc: new PurchaseService(repo, {} as any, {} as any, cloud, notif), repo, notif, cloud };
  }
  it('loads the course and its instructor, and notifies that instructor once', async () => {
    const { svc, repo, notif } = make(1);
    await expect(svc.confirmCheckOut(5, dto, 3, png)).resolves.toBeUndefined();
    expect(repo.findOne.mock.calls[0][0].relations).toEqual({ user: true, course: { Instractor: true } });
    expect(notif.creatNotification).toHaveBeenCalledTimes(1);
    expect(notif.creatNotification.mock.calls[0][1]).toBe(9);
  });
  it('a stale submit (row already decided) gets 400 and sends no notification', async () => {
    const { svc, notif } = make(0);
    await expect(svc.confirmCheckOut(5, dto, 3, png)).rejects.toBeInstanceOf(BadRequestException);
    expect(notif.creatNotification).not.toHaveBeenCalled();
  });
  it('the loser of a race deletes only its own just-uploaded file', async () => {
    const { svc, cloud } = make(0);
    await expect(svc.confirmCheckOut(5, dto, 3, png)).rejects.toBeInstanceOf(BadRequestException);
    expect(cloud.destroyAsset).toHaveBeenCalledTimes(1);
    expect(cloud.destroyAsset).toHaveBeenCalledWith('p');
  });
  it('the winner keeps its upload (nothing is destroyed)', async () => {
    const { svc, cloud } = make(1);
    await svc.confirmCheckOut(5, dto, 3, png);
    expect(cloud.destroyAsset).not.toHaveBeenCalled();
  });
  it('a failing cleanup never changes the answer', async () => {
    const { svc, cloud } = make(0);
    cloud.destroyAsset.mockResolvedValue(false);
    await expect(svc.confirmCheckOut(5, dto, 3, png)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('a database error while saving also removes the unreferenced upload and rethrows', async () => {
    const { svc, repo, cloud } = make(1);
    repo.createQueryBuilder = () => { const b: any = {}; b.update = () => b; b.set = () => b; b.where = () => b; b.execute = async () => { throw new Error('db'); }; return b; };
    await expect(svc.confirmCheckOut(5, dto, 3, png)).rejects.toThrow('db');
    expect(cloud.destroyAsset).toHaveBeenCalledWith('p');
  });
  it('a notification failure does not turn a saved submission into an error', async () => {
    const { svc } = make(1, true);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(svc.confirmCheckOut(5, dto, 3, png)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
