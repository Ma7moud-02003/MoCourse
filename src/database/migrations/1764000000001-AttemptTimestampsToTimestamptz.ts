import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Exam attempt times were stored as `timestamp` (no time zone). That value is a wall-clock time whose
 * zone is not stored, so it only meant the right moment while the server used the same zone as when it
 * was written. This converts them to `timestamptz` (a real instant).
 *
 * Which zone did the old data use? Two different ones, and the migration will not guess:
 *  - expiresAt, submittedAt: written by the Node app. The pg driver sent the Date as the Node process's
 *    local time, so the stored wall-clock is in the zone of the Node server at that time.
 *  - startedAt, answeredAt: filled by the database (DEFAULT now()), so the stored wall-clock is in the
 *    PostgreSQL `TimeZone` setting of the session that inserted the row.
 * Set both before running (IANA names, e.g. Africa/Cairo or UTC):
 *    MIGRATION_ATTEMPT_APP_TZ   zone of the Node server that wrote the data
 *    MIGRATION_ATTEMPT_DB_TZ    PostgreSQL TimeZone at the time (run `SHOW TimeZone;` on the live DB)
 * If both tables hold no rows, the variables are not needed.
 *
 * Limits: a wall-clock time inside the repeated hour when clocks go back (or the skipped hour when they go
 * forward) in a DST zone has no single correct instant; PostgreSQL picks one. Use UTC if the server never
 * used a DST zone.
 */
const COLUMNS: { table: string; column: string; zoneVar: 'APP' | 'DB' }[] = [
  { table: 'quiz_attempt_entity', column: 'startedAt', zoneVar: 'DB' },
  { table: 'quiz_attempt_entity', column: 'expiresAt', zoneVar: 'APP' },
  { table: 'quiz_attempt_entity', column: 'submittedAt', zoneVar: 'APP' },
  { table: 'student_answer_entity', column: 'answeredAt', zoneVar: 'DB' },
];

async function zones(queryRunner: QueryRunner) {
  const rows = await queryRunner.query(
    `SELECT (SELECT count(*) FROM quiz_attempt_entity) AS a, (SELECT count(*) FROM student_answer_entity) AS s`,
  );
  const hasData = Number(rows[0].a) + Number(rows[0].s) > 0;
  const current = (await queryRunner.query(`SHOW TimeZone`))[0].TimeZone;
  const out: Record<'APP' | 'DB', string> = { APP: 'UTC', DB: 'UTC' };
  for (const k of ['APP', 'DB'] as const) {
    const v = process.env[`MIGRATION_ATTEMPT_${k}_TZ`];
    if (!v) {
      if (hasData) {
        throw new Error(
          `Attempt rows exist. Set MIGRATION_ATTEMPT_APP_TZ and MIGRATION_ATTEMPT_DB_TZ (IANA names) to the zones the old data was written in. ` +
            `This session's PostgreSQL TimeZone is "${current}" (not necessarily the one used when the rows were written). See the comment in this migration.`,
        );
      }
      continue;
    }
    const ok = await queryRunner.query(`SELECT 1 FROM pg_timezone_names WHERE name = $1`, [v]);
    if (!ok.length) throw new Error(`MIGRATION_ATTEMPT_${k}_TZ="${v}" is not a time zone name PostgreSQL knows`);
    out[k] = v;
  }
  return out;
}

export class AttemptTimestampsToTimestamptz1764000000001 implements MigrationInterface {
  name = 'AttemptTimestampsToTimestamptz1764000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const z = await zones(queryRunner);
    for (const c of COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${c.table}" ALTER COLUMN "${c.column}" TYPE timestamptz USING "${c.column}" AT TIME ZONE '${z[c.zoneVar]}'`,
      );
    }
  }

  // Back to wall-clock `timestamp`, in the same zones (set the same variables). Exact except in DST gaps/overlaps.
  public async down(queryRunner: QueryRunner): Promise<void> {
    const z = await zones(queryRunner);
    for (const c of COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${c.table}" ALTER COLUMN "${c.column}" TYPE timestamp USING "${c.column}" AT TIME ZONE '${z[c.zoneVar]}'`,
      );
    }
  }
}
