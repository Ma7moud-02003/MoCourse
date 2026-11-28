import { QueryFailedError } from 'typeorm';
import { CertificateService } from './certificate.service';

const uniqueViolation = (constraint: string) =>
  new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505', constraint }));

const makeService = () => {
  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
  };
  const notifications = { creatNotification: jest.fn() };
  const service = new CertificateService(repo as any, notifications as any);
  return { service, repo, notifications };
};

describe('CertificateService.creatCertification', () => {
  it('returns the exists message when the certificate is already there', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValue({ id: 1 });
    const res = await service.creatCertification(1, 2, 't', new Date());
    expect(res).toEqual({ message: 'الشهاده موجوده بالفعل' });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('saves, notifies the student and returns the certificate', async () => {
    const { service, repo, notifications } = makeService();
    repo.findOne.mockResolvedValue(null);
    repo.save.mockResolvedValue({ id: 7 });
    const res: any = await service.creatCertification(1, 2, 't', new Date());
    expect(res.id).toBe(7);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(notifications.creatNotification).toHaveBeenCalledTimes(1);
    expect(notifications.creatNotification.mock.calls[0][0]).toBe(7);
    expect(notifications.creatNotification.mock.calls[0][1]).toBe(1);
  });

  it('treats a student/course unique violation from a concurrent save as already existing', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValue(null);
    repo.save.mockRejectedValue(uniqueViolation('UQ_certificates_student_course'));
    const res = await service.creatCertification(1, 2, 't', new Date());
    expect(res).toEqual({ message: 'الشهاده موجوده بالفعل' });
  });

  it('draws a new certificate number on a number collision and succeeds', async () => {
    const { service, repo, notifications } = makeService();
    repo.findOne.mockResolvedValue(null);
    repo.save
      .mockRejectedValueOnce(uniqueViolation('UQ_9742ea65bce69db989c2e676936'))
      .mockRejectedValueOnce(uniqueViolation('UQ_9742ea65bce69db989c2e676936'))
      .mockResolvedValue({ id: 9 });
    const res: any = await service.creatCertification(1, 2, 't', new Date());
    expect(res.id).toBe(9);
    expect(repo.save).toHaveBeenCalledTimes(3);
    const numbers = repo.create.mock.calls.map((c) => c[0].certificateNumber);
    expect(new Set(numbers).size).toBe(3);
    for (const n of numbers) expect(n).toMatch(/^Mo-[0-9A-F]{12}$/);
    expect(notifications.creatNotification).toHaveBeenCalledTimes(1);
  });

  it('gives up after repeated number collisions instead of looping forever', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValue(null);
    repo.save.mockRejectedValue(uniqueViolation('UQ_9742ea65bce69db989c2e676936'));
    await expect(service.creatCertification(1, 2, 't', new Date())).rejects.toThrow(
      'unique certificate number',
    );
    expect(repo.save).toHaveBeenCalledTimes(5);
  });

  it('rethrows unrelated database errors', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValue(null);
    repo.save.mockRejectedValue(new Error('connection lost'));
    await expect(service.creatCertification(1, 2, 't', new Date())).rejects.toThrow('connection lost');
  });
});

describe('CertificateService.getCertificatePdf', () => {
  const row = { id: 4, certificateNumber: 'Mo-ABC', issuedAt: new Date(), completedAt: null, courseTitle: 'كورس NestJS',
    student: { id: 3, fullName: 'محمود' }, course: { title: 'x', Instractor: { fullName: 'أحمد' } } };
  it('returns a PDF for the owner', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValue(row);
    const r = await service.getCertificatePdf(3, 4);
    expect(r.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(r.fileName).toBe('certificate-Mo-ABC.pdf');
  });
  it('refuses another student', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValue(row);
    await expect(service.getCertificatePdf(9, 4)).rejects.toThrow();
  });
});
