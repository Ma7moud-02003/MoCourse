import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The one-attempt-per-student rule and the one-answer-per-question rule are database unique constraints.
 * A fresh database already has them (baseline). An older database built before those rules existed may not.
 * This adds each one only if it is missing, and stops with a clear message if existing rows break it.
 * It never deletes or merges data: duplicates are a decision for the owner.
 */
const RULES = [
  { table: 'quiz_attempt_entity', name: 'UQ_799718b1a9e63ba907478362210', cols: ['quizId', 'userId'] },
  { table: 'student_answer_entity', name: 'UQ_90ee15bc1d081da10b2072d6856', cols: ['attemptId', 'questionId'] },
];

export class EnsureAttemptUniqueRules1764000000002 implements MigrationInterface {
  name = 'EnsureAttemptUniqueRules1764000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const r of RULES) {
      const have = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [r.name]);
      if (have.length) continue;
      const cols = r.cols.map((c) => `"${c}"`).join(', ');
      const dup = await queryRunner.query(
        `SELECT count(*) AS n FROM (SELECT 1 FROM "${r.table}" GROUP BY ${cols} HAVING count(*) > 1) d`,
      );
      if (Number(dup[0].n) > 0) {
        throw new Error(
          `${dup[0].n} group(s) of duplicate rows in ${r.table} on (${r.cols.join(', ')}) block the unique rule ${r.name}. ` +
            `Nothing was changed. Decide which rows to keep, clean them up, then run the migration again.`,
        );
      }
      await queryRunner.query(`ALTER TABLE "${r.table}" ADD CONSTRAINT "${r.name}" UNIQUE (${cols})`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const r of [...RULES].reverse()) {
      await queryRunner.query(`ALTER TABLE "${r.table}" DROP CONSTRAINT IF EXISTS "${r.name}"`);
    }
  }
}
