import { CertificateService } from './certificate.service';

describe('CertificateService.verifyCrttificate', () => {
  const make = (found: any) => {
    const repo: any = { findOne: jest.fn().mockResolvedValue(found) };
    return { service: new CertificateService(repo, {} as any), repo };
  };

  it('returns only what is needed to check a certificate and never the student email or ids', async () => {
    const { service } = make({
      id: 9, certificateNumber: 'Mo-AAA', issuedAt: new Date('2026-11-21'), completedAt: new Date('2026-11-20'), courseTitle: 'T',
      student: { id: 5, fullName: 'Sara', email: 'sara@x.com', password: 'h' },
      course: { id: 7, title: 'T', duration: 120, Instractor: { id: 3, fullName: 'Teacher', email: 't@x.com' } },
    });
    const res: any = await service.verifyCrttificate('Mo-AAA');
    expect(res).toEqual({
      certificateNumber: 'Mo-AAA', issuedAt: new Date('2026-11-21'), completedAt: new Date('2026-11-20'), courseTitle: 'T',
      student: { fullName: 'Sara' },
      course: { title: 'T', duration: 120, Instractor: { fullName: 'Teacher' } },
    });
    expect(JSON.stringify(res)).not.toMatch(/email|@x\.com|password/);
  });

  it('answers with the not-found message for an unknown code', async () => {
    const { service } = make(null);
    expect(await service.verifyCrttificate('nope')).toEqual({ message: 'لا يوجد شهاده مخصصه لهذا الكود' });
  });
});
