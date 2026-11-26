import { EnrollmentService } from './enrollment.service';
import { EnrollmentStatus } from 'src/utils/enums/enroll.enum';

const make = (enroll: any) => {
  const enrollRepo: any = { findOne: jest.fn().mockResolvedValue(enroll), save: jest.fn(async (e) => e) };
  const certificateService: any = { creatCertification: jest.fn().mockResolvedValue({}) };
  const svc = new EnrollmentService(enrollRepo, {} as any, certificateService, {} as any);
  return { svc, enrollRepo, certificateService };
};

describe('EnrollmentService.updateEnrollStatus certificate retry', () => {
  it('completes an in-progress enrollment and issues the certificate with the same time', async () => {
    const e = { status: EnrollmentStatus.IN_PROGRESS, completedAt: null, course: { title: 'T' } };
    const { svc, enrollRepo, certificateService } = make(e);
    await svc.updateEnrollStatus(7, 5);
    expect(e.status).toBe(EnrollmentStatus.COMPLETED);
    expect(e.completedAt).toBeInstanceOf(Date);
    expect(enrollRepo.save).toHaveBeenCalledTimes(1);
    expect(certificateService.creatCertification).toHaveBeenCalledWith(5, 7, 'T', e.completedAt);
  });

  it('on an already completed enrollment retries the certificate and changes nothing else', async () => {
    const done = new Date('2026-11-20T09:00:00Z');
    const e = { status: EnrollmentStatus.COMPLETED, completedAt: done, course: { title: 'T' } };
    const { svc, enrollRepo, certificateService } = make(e);
    await svc.updateEnrollStatus(7, 5);
    expect(enrollRepo.save).not.toHaveBeenCalled();
    expect(e.completedAt).toBe(done);
    expect(certificateService.creatCertification).toHaveBeenCalledWith(5, 7, 'T', done);
  });

  it('does not make up a date for an old completed enrollment without one', async () => {
    const e = { status: EnrollmentStatus.COMPLETED, completedAt: null, course: { title: 'T' } };
    const { svc, enrollRepo, certificateService } = make(e);
    await svc.updateEnrollStatus(7, 5);
    expect(enrollRepo.save).not.toHaveBeenCalled();
    expect(e.completedAt).toBeNull();
    expect(certificateService.creatCertification).toHaveBeenCalledWith(5, 7, 'T', null);
  });

  it('passes a certificate failure on to the caller', async () => {
    const e = { status: EnrollmentStatus.COMPLETED, completedAt: null, course: { title: 'T' } };
    const { svc, certificateService } = make(e);
    certificateService.creatCertification.mockRejectedValue(new Error('boom'));
    await expect(svc.updateEnrollStatus(7, 5)).rejects.toThrow('boom');
  });
});
