import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * enrollments."completedAt" must stay empty (NULL) until the student really completes the course. The old column
 * had DEFAULT now(), so every new enrollment got the enrollment time as its "completion" time. This migration only
 * drops that default, so new rows get NULL. It does not read or change any existing row: old rows keep whatever
 * they have, nothing is guessed or deleted. `npm run report:enrollment-completed-at` lists the old rows whose date
 * looks misleading so the owner can review them. Idempotent: a column without the default is left alone.
 * Revert puts the old default back (existing rows are not touched either way).
 */
const TABLE = 'enrollments';
const COLUMN = 'completedAt';

export class EnrollmentCompletedAtNoDefault1764000000008 implements MigrationInterface {
  name = 'EnrollmentCompletedAtNoDefault1764000000008';

  private async hasDefault(queryRunner: QueryRunner): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 AND table_schema = current_schema()`,
      [TABLE, COLUMN],
    );
    return rows.length > 0 && rows[0].column_default != null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasDefault(queryRunner))) return; // already in the target state
    await queryRunner.query(`ALTER TABLE "${TABLE}" ALTER COLUMN "${COLUMN}" DROP DEFAULT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasDefault(queryRunner)) return;
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ALTER COLUMN "${COLUMN}" SET DEFAULT ('now'::text)::timestamp(6) with time zone`,
    );
  }
}
