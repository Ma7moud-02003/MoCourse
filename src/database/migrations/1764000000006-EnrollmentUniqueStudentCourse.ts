import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One enrollment per student per course. This migration adds UNIQUE("userId", "courseId") on enrollments,
 * so even two requests arriving at the same moment cannot create a second row.
 * It refuses to run while duplicate pairs exist: it stops, lists every row involved (id, status,
 * enrolledAt, completedAt) and changes nothing. The owner reviews the listed rows and decides which to keep;
 * it never deletes or merges an enrollment on its own. Idempotent: a database that already has the
 * constraint is left alone. The constraint name matches the entity's
 * @Unique('UQ_enrollments_user_course', ['user', 'course']) so `migration:drift` stays at "no drift".
 */
const TABLE = 'enrollments';
const UNIQUE_NAME = 'UQ_enrollments_user_course';

export class EnrollmentUniqueStudentCourse1764000000006 implements MigrationInterface {
  name = 'EnrollmentUniqueStudentCourse1764000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const haveUnique = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [UNIQUE_NAME]);
    if (haveUnique.length) return; // already in the target state

    const dups: {
      userId: number | null;
      courseId: number | null;
      n: number;
      rows: { id: number; status: string; enrolledAt: string | null; completedAt: string | null }[];
    }[] = await queryRunner.query(
      `SELECT "userId", "courseId", count(*) AS n,
              json_agg(json_build_object('id', id, 'status', status, 'enrolledAt', "enrolledAt", 'completedAt', "completedAt") ORDER BY id) AS rows
         FROM "${TABLE}" GROUP BY "userId", "courseId" HAVING count(*) > 1 ORDER BY "userId", "courseId"`,
    );
    if (dups.length) {
      const list = dups
        .map(
          (d) =>
            `userId=${d.userId} courseId=${d.courseId} enrollments: ` +
            d.rows.map((r) => `#${r.id} (${r.status}, enrolledAt=${r.enrolledAt}, completedAt=${r.completedAt})`).join(', '),
        )
        .join('; ');
      throw new Error(
        `${TABLE} has ${dups.length} duplicate (userId, courseId) group(s) blocking the one-enrollment-per-course rule: ${list}. ` +
          `Nothing was changed. The owner reviews each group and decides which enrollment to keep; reconcile them, then run the migration again.`,
      );
    }

    await queryRunner.query(`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${UNIQUE_NAME}" UNIQUE ("userId", "courseId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${UNIQUE_NAME}"`);
  }
}
