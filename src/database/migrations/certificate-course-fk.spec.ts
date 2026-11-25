import { CertificateCourseFk1764000000003 } from './1764000000003-CertificateCourseFk';

const USERS_FK = {
  conname: 'FK_e50e73bc3bdcfb0eb3d561f1494',
  def: 'FOREIGN KEY ("courseId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
};
const COURSES_FK = {
  conname: 'FK_e50e73bc3bdcfb0eb3d561f1494',
  def: 'FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
};

type Scenario = {
  fks?: { conname: string; def: string }[];
  haveUnique?: boolean;
  rows?: { id: number; studentId: number; courseId: number }[];
  dupGroups?: number;
};

const runnerFor = (s: Scenario) => {
  const calls: string[] = [];
  const query = jest.fn(async (sql: string) => {
    calls.push(sql);
    if (sql.includes('pg_get_constraintdef')) return s.fks ?? [];
    if (sql.includes('pg_constraint WHERE conname')) return s.haveUnique ? [1] : [];
    if (sql.includes('SELECT id, "studentId", "courseId"')) return s.rows ?? [];
    if (sql.includes('HAVING count(*) > 1')) return [{ n: s.dupGroups ?? 0 }];
    if (sql.startsWith('ALTER')) return [];
    throw new Error('unexpected SQL: ' + sql);
  });
  return { queryRunner: { query } as any, calls };
};

describe('CertificateCourseFk migration', () => {
  const m = new CertificateCourseFk1764000000003();

  it('swaps the users FK for a courses FK and adds the unique rule on an empty table', async () => {
    const { queryRunner, calls } = runnerFor({ fks: [USERS_FK] });
    await m.up(queryRunner);
    const alters = calls.filter((c) => c.startsWith('ALTER'));
    expect(alters).toEqual([
      'ALTER TABLE "certificates" DROP CONSTRAINT "FK_e50e73bc3bdcfb0eb3d561f1494"',
      'ALTER TABLE "certificates" ADD CONSTRAINT "FK_e50e73bc3bdcfb0eb3d561f1494" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
      'ALTER TABLE "certificates" ADD CONSTRAINT "UQ_certificates_student_course" UNIQUE ("studentId", "courseId")',
    ]);
    // every check ran before any change
    const firstAlter = calls.findIndex((c) => c.startsWith('ALTER'));
    expect(firstAlter).toBeGreaterThan(-1);
    expect(calls.slice(0, firstAlter).every((c) => c.startsWith('SELECT'))).toBe(true);
  });

  it('refuses to remap existing rows and changes nothing', async () => {
    const { queryRunner, calls } = runnerFor({
      fks: [USERS_FK],
      rows: [{ id: 4, studentId: 2, courseId: 2 }],
    });
    await expect(m.up(queryRunner)).rejects.toThrow(/will not guess/);
    expect(calls.some((c) => c.startsWith('ALTER'))).toBe(false);
  });

  it('does nothing when the database is already in the target state', async () => {
    const { queryRunner, calls } = runnerFor({ fks: [COURSES_FK], haveUnique: true });
    await m.up(queryRunner);
    expect(calls.some((c) => c.startsWith('ALTER'))).toBe(false);
  });

  it('still blocks on duplicates when only the unique rule is missing', async () => {
    const { queryRunner, calls } = runnerFor({
      fks: [COURSES_FK],
      rows: [
        { id: 1, studentId: 2, courseId: 3 },
        { id: 2, studentId: 2, courseId: 3 },
      ],
      dupGroups: 1,
    });
    await expect(m.up(queryRunner)).rejects.toThrow(/duplicate rows/);
    expect(calls.some((c) => c.startsWith('ALTER'))).toBe(false);
  });

  it('down restores the exact constraint it replaced', async () => {
    const { queryRunner, calls } = runnerFor({});
    await m.down(queryRunner);
    expect(calls).toEqual([
      'ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "UQ_certificates_student_course"',
      'ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "FK_e50e73bc3bdcfb0eb3d561f1494"',
      'ALTER TABLE "certificates" ADD CONSTRAINT "FK_e50e73bc3bdcfb0eb3d561f1494" FOREIGN KEY ("courseId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    ]);
  });
});
