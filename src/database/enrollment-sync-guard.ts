import { Client } from 'pg';
import * as path from 'path';

type QueryFn = (sql: string) => Promise<Record<string, any>[]>;

const UNIQUE_NAME = 'UQ_enrollments_user_course';

/**
 * Outside production the app runs TypeORM with `synchronize: true`. Adding the one-enrollment-per-student-
 * and-course rule while duplicate rows exist makes that sync fail with a raw index error and a misleading
 * "Unable to connect to the database. Retrying" loop. This check runs before the app module is created and
 * refuses to start in exactly that state: the rule is missing and duplicate (userId, courseId) rows exist.
 * It lists the rows (id, status, enrolledAt, completedAt), only reads, and never decides which one to keep:
 * that is the owner's call. A fresh database, one that already has the rule, or one without duplicates is
 * untouched.
 */
export async function checkEnrollmentSchemaSafety(query: QueryFn): Promise<void> {
  const table = await query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enrollments'`,
  );
  if (!table.length) return;
  const haveRule = await query(`SELECT 1 FROM pg_constraint WHERE conname = '${UNIQUE_NAME}'`);
  if (haveRule.length) return;
  const dups = (await query(
    `SELECT "userId", "courseId", json_agg(json_build_object('id', id, 'status', status, 'enrolledAt', "enrolledAt", 'completedAt', "completedAt") ORDER BY id) AS rows
       FROM enrollments GROUP BY "userId", "courseId" HAVING count(*) > 1 ORDER BY "userId", "courseId"`,
  )) as {
    userId: number | null;
    courseId: number | null;
    rows: { id: number; status: string; enrolledAt: string | null; completedAt: string | null }[];
  }[];
  if (!dups.length) return;
  const list = dups
    .map(
      (d) =>
        `userId=${d.userId} courseId=${d.courseId} enrollments: ` +
        d.rows.map((r) => `#${r.id} (${r.status}, enrolledAt=${r.enrolledAt}, completedAt=${r.completedAt})`).join(', '),
    )
    .join('; ');
  throw new Error(
    `Refusing to start: enrollments has ${dups.length} duplicate (userId, courseId) group(s) blocking the one-enrollment-per-course rule: ${list}. ` +
      `Nothing was changed. Review each group and keep one enrollment per student and course, then start the app again. If this database is managed with migrations, run "npm run migration:run" first; a database that the app syncs itself needs no migration command.`,
  );
}

/** Runs the check against the configured database. Only needed when synchronize is on (everything except production). */
export async function assertEnrollmentSchemaSafety(): Promise<void> {
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
    await checkEnrollmentSchemaSafety(async (sql) => (await client.query(sql)).rows);
  } finally {
    await client.end();
  }
}
