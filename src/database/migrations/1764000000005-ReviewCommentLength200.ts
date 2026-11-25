import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns the reviews.comment column with the API contract (owner-approved): the review DTOs have
 * always allowed comments up to 200 characters, but the column was varchar(150), so a 151-200
 * character comment passed validation and then died with a 500 at insert. This migration widens
 * the column to varchar(200). Widening is lossless: every existing row fits, nothing is rewritten
 * or truncated. Idempotent: a database already at varchar(200) is left alone. The entity declares
 * @Column({ length: 200 }) so `migration:drift` stays at "no drift".
 * down() narrows back to 150; Postgres refuses that while any comment longer than 150 exists, so
 * rollback can never silently truncate a review.
 */
const TABLE = 'reviews';
const COLUMN = 'comment';

export class ReviewCommentLength2001764000000005 implements MigrationInterface {
  name = 'ReviewCommentLength2001764000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { character_maximum_length: number | null }[] = await queryRunner.query(
      `SELECT character_maximum_length FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2`,
      [TABLE, COLUMN],
    );
    if (rows.length && rows[0].character_maximum_length === 200) return; // already in the target state

    await queryRunner.query(`ALTER TABLE "${TABLE}" ALTER COLUMN "${COLUMN}" TYPE varchar(200)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: { character_maximum_length: number | null }[] = await queryRunner.query(
      `SELECT character_maximum_length FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2`,
        [TABLE, COLUMN],
    );
    if (rows.length && rows[0].character_maximum_length === 150) return;

    await queryRunner.query(`ALTER TABLE "${TABLE}" ALTER COLUMN "${COLUMN}" TYPE varchar(150)`);
  }
}
