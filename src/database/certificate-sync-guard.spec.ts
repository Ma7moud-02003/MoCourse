import { checkCertificateSchemaSafety } from './certificate-sync-guard';

const USERS_FK = { def: 'FOREIGN KEY ("courseId") REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION' };
const COURSES_FK = { def: 'FOREIGN KEY ("courseId") REFERENCES courses(id) ON DELETE NO ACTION ON UPDATE NO ACTION' };

type Scenario = {
  table?: boolean;
  fks?: { def: string }[];
  rows?: { id: number; studentId: number; courseId: number }[];
};

const queryFor = (s: Scenario) => {
  const calls: string[] = [];
  const query = async (sql: string) => {
    calls.push(sql);
    if (sql.includes('information_schema.tables')) return s.table === false ? [] : [1];
    if (sql.includes('pg_get_constraintdef')) return s.fks ?? [];
    if (sql.includes('SELECT id, "studentId", "courseId"')) return s.rows ?? [];
    throw new Error('unexpected SQL: ' + sql);
  };
  return { query, calls };
};

describe('checkCertificateSchemaSafety', () => {
  it('passes on a fresh database with no certificates table', async () => {
    const { query } = queryFor({ table: false });
    await expect(checkCertificateSchemaSafety(query)).resolves.toBeUndefined();
  });

  it('passes when the FK already points at courses', async () => {
    const { query } = queryFor({ fks: [COURSES_FK], rows: [{ id: 1, studentId: 2, courseId: 3 }] });
    await expect(checkCertificateSchemaSafety(query)).resolves.toBeUndefined();
  });

  it('passes when the old users FK is still there but the table is empty', async () => {
    const { query } = queryFor({ fks: [USERS_FK], rows: [] });
    await expect(checkCertificateSchemaSafety(query)).resolves.toBeUndefined();
  });

  it('refuses to start when rows exist under the old users FK, and lists them', async () => {
    const { query } = queryFor({ fks: [USERS_FK], rows: [{ id: 4, studentId: 2, courseId: 2 }] });
    await expect(checkCertificateSchemaSafety(query)).rejects.toThrow(/Refusing to start.*id=4 studentId=2 courseId=2/s);
  });

  it('reads only: it never issues a write, even when refusing', async () => {
    const { query, calls } = queryFor({ fks: [USERS_FK], rows: [{ id: 1, studentId: 1, courseId: 1 }] });
    await expect(checkCertificateSchemaSafety(query)).rejects.toThrow();
    expect(calls.every((c) => c.trimStart().toUpperCase().startsWith('SELECT'))).toBe(true);
  });
});
