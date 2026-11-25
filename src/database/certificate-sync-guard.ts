import { Client } from 'pg';
import * as path from 'path';

type QueryFn = (sql: string) => Promise<Record<string, any>[]>;

/**
 * Outside production the app runs TypeORM with `synchronize: true`, which rewrites the schema at
 * startup with no review step. For certificates."courseId" that is dangerous: rows written while the
 * FK referenced users(id) were never checked against courses, so a sync that re-points the FK would
 * silently remap them, bypassing migration 1764000000003's fail-closed review. This check runs before
 * the app module is created and refuses to start in exactly that one state: the old FK plus existing
 * rows. An empty certificates table is safe to sync, and a fresh or already-migrated database is
 * untouched. It never changes anything and never says what to do with the rows: that is the owner's
 * call, through the migration.
 */
export async function checkCertificateSchemaSafety(query: QueryFn): Promise<void> {
  const table = await query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'certificates'`,
  );
  if (!table.length) return;
  const fks = await query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'certificates'::regclass AND contype = 'f'`,
  );
  const courseFk = fks.find((r) => /^FOREIGN KEY \("courseId"\)/.test(r.def));
  // pg_get_constraintdef quotes identifiers only when needed: REFERENCES courses(id), not "courses"
  if (!courseFk || /REFERENCES "?courses"?\(/.test(courseFk.def)) return;
  const rows = (await query(`SELECT id, "studentId", "courseId" FROM certificates ORDER BY id`)) as {
    id: number;
    studentId: number | null;
    courseId: number | null;
  }[];
  if (!rows.length) return;
  const list = rows.map((r) => `id=${r.id} studentId=${r.studentId} courseId=${r.courseId}`).join('; ');
  throw new Error(
    `Refusing to start: certificates has ${rows.length} row(s) written while "courseId" referenced users(id): ${list}. ` +
      `Schema sync would re-point these rows without review, and a matching course id does not prove the intended mapping. ` +
      `Nothing was changed. Review and reconcile these rows, then run "npm run migration:run" before starting the app again.`,
  );
}

/**
 * Runs the safety check against the configured database. Only needed when synchronize is on
 * (everything except production); there migrations own the schema and stop on their own.
 */
export async function assertCertificateSchemaSafety(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  try {
    process.loadEnvFile(path.resolve(process.cwd(), `.env.${process.env.NODE_ENV}`));
  } catch {
    // no env file: the variables must already be set in the environment
  }
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await client.connect();
  try {
    await checkCertificateSchemaSafety(async (sql) => (await client.query(sql)).rows);
  } finally {
    await client.end();
  }
}
