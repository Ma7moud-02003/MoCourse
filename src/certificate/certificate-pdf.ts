import PDFDocument from 'pdfkit';
import { NASKH_BASE64, SANS_BASE64 } from './arabic-font';

export interface CertificatePdfData {
  studentName: string;
  courseTitle: string;
  instructorName?: string;
  certificateNumber: string;
  issuedAt: Date;
  completedAt?: Date | null;
}

const LATIN_RUN = /[A-Za-z0-9](?:[A-Za-z0-9 .\-_/]*[A-Za-z0-9])?/g;

/** Splits a line into runs in logical order: Latin/number runs use the Latin font, everything else the Arabic font. */
export function splitRuns(text: string): { latin: boolean; text: string }[] {
  const runs: { latin: boolean; text: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    const i = m.index ?? 0;
    if (i > last) runs.push({ latin: false, text: text.slice(last, i) });
    runs.push({ latin: true, text: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) runs.push({ latin: false, text: text.slice(last) });
  return runs;
}

function formatDate(d?: Date | null): string {
  if (!d) return '';
  const date = new Date(d);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Builds the certificate as a landscape A4 PDF and returns its bytes. */
export function buildCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: 'MoCourse certificate' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Naskh', Buffer.from(NASKH_BASE64, 'base64'));
    doc.registerFont('Sans', Buffer.from(SANS_BASE64, 'base64'));
    const W = doc.page.width;
    const H = doc.page.height;
    const plum = '#5B2A6E';
    const orange = '#E8863A';
    const ink = '#2B2233';

    // border
    doc.rect(24, 24, W - 48, H - 48).lineWidth(3).stroke(plum);
    doc.rect(34, 34, W - 68, H - 68).lineWidth(1).stroke(orange);

    // Right-to-left line, centered. PDFKit shapes Arabic and orders the letters inside one Arabic run;
    // the runs themselves are placed right to left here so Latin names and numbers read correctly.
    const center = (text: string, y: number, size: number, color: string) => {
      // one unit per Arabic word or Latin run, in logical order; spaces are drawn as explicit gaps
      // (the Arabic font drops some spaces at run edges)
      const units = splitRuns(text).flatMap((r) =>
        r.latin ? [{ latin: true, text: r.text }] : r.text.split(/\s+/).filter(Boolean).map((t) => ({ latin: false, text: t })),
      );
      const maxWidth = W - 140;
      let fs = size;
      const widthOf = (u: { latin: boolean; text: string }) => doc.font(u.latin ? 'Sans' : 'Naskh').fontSize(fs).widthOfString(u.text);
      const total = () => units.reduce((sum, u) => sum + widthOf(u), 0) + Math.max(0, units.length - 1) * fs * 0.3;
      while (total() > maxWidth && fs > 12) fs -= 1;
      let x = (W + total()) / 2;
      doc.fillColor(color);
      for (const u of units) {
        const w = widthOf(u);
        x -= w;
        doc.font(u.latin ? 'Sans' : 'Naskh').fontSize(fs).text(u.text, x, y, { lineBreak: false });
        x -= fs * 0.3;
      }
    };

    center('MoCourse', 70, 26, orange);
    center('شهادة إتمام', 110, 46, plum);
    center('تشهد منصة MoCourse بأن', 190, 22, ink);
    center(data.studentName, 230, 38, plum);
    center('قد أتم بنجاح كورس', 295, 22, ink);
    center(data.courseTitle, 330, 32, ink);
    if (data.instructorName) center(`المدرس: ${data.instructorName}`, 400, 18, ink);

    const dates = [`تاريخ الإصدار: ${formatDate(data.issuedAt)}`];
    if (data.completedAt) dates.push(`تاريخ الإتمام: ${formatDate(data.completedAt)}`);
    center(dates.join('      '), 450, 16, ink);
    center(`رقم الشهادة: ${data.certificateNumber}`, 485, 14, plum);

    doc.end();
  });
}
