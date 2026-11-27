import { buildCertificatePdf, splitRuns } from './certificate-pdf';

describe('certificate pdf', () => {
  it('builds a real PDF with Arabic and Latin text', async () => {
    const pdf = await buildCertificatePdf({
      studentName: 'محمود عمرو', courseTitle: 'تعلم NestJS من الصفر Part 1', instructorName: 'أحمد علي',
      certificateNumber: 'CERT-2026-ABC123', issuedAt: new Date('2026-11-25T10:00:00Z'), completedAt: new Date('2026-11-24T10:00:00Z'),
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5000);
    if (process.env.CERT_OUT) require('fs').writeFileSync(process.env.CERT_OUT, pdf);
  });
  it('splits a line into Latin and Arabic runs in logical order', () => {
    expect(splitRuns('Hello 123')).toEqual([{ latin: true, text: 'Hello 123' }]);
    expect(splitRuns('تعلم NestJS من الصفر Part 1')).toEqual([
      { latin: false, text: 'تعلم ' }, { latin: true, text: 'NestJS' }, { latin: false, text: ' من الصفر ' }, { latin: true, text: 'Part 1' },
    ]);
  });
});
