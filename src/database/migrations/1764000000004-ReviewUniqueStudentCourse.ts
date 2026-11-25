import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One review per student per course (owner-approved rule): a changed opinion updates the existing
 * review instead of stacking duplicates. This migration adds UNIQUE("userId", "courseId") on reviews.
 * It refuses to run while duplicate pairs exist: it stops, lists the rows involved, and changes
 * nothing; the owner decides which rows to keep, then runs it again. It never deletes or rewrites a
 * review on its own. Idempotent: a database that already has the constraint is left alone. The
 * constraint name matches the entity's @Unique('UQ_reviews_user_course', ['user', 'course']) so
 * `migration:drift` stays at "no drift".
 */
const TABLE = 'reviews';
const UNIQUE_NAME = 'UQ_reviews_user_course';

export class ReviewUniqueStudentCourse1764000000004 implements MigrationInterface {
  name = 'ReviewUniqueStudentCourse1764000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const haveUnique = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [UNIQUE_NAME]);
    if (haveUnique.length) return; // already in the target state

    const dups: { userId: number | null; courseId: number | null; n: number; ids: number[] }[] =
      await queryRunner.query(
        `SELECT "userId", "courseId", count(*) AS n, array_agg(id ORDER BY id) AS ids
           FROM "${TABLE}" GROUP BY "userId", "courseId" HAVING count(*) > 1 ORDER BY "userId", "courseId"`,
      );
    if (dups.length) {
      const list = dups.map((d) => `userId=${d.userId} courseId=${d.courseId} review ids=${d.ids.join(',')}`).join('; ');
      throw new Error(
        `${TABLE} has ${dups.length} duplicate (userId, courseId) group(s) blocking the one-review-per-course rule: ${list}. ` +
          `Nothing was changed. The owner decides which review to keep in each group; reconcile them, then run the migration again.`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${UNIQUE_NAME}" UNIQUE ("userId", "courseId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${UNIQUE_NAME}"`);
  }
}
