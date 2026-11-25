import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * certificates."courseId" was created by a relation that pointed at UserEntity, so its foreign key
 * references users(id) instead of courses(id) (baseline FK_e50e73bc3bdcfb0eb3d561f1494). Every value
 * written while that FK existed was only guaranteed to match some user id, so a stored value that also
 * matches a course id does NOT prove it was meant as a course id. This migration therefore refuses to
 * remap a table that has any rows: it stops with the row ids and changes nothing, and the owner decides
 * what those rows mean. On an empty table it:
 *   1. drops the FK to users(id) and adds one to courses(id),
 *   2. adds UNIQUE("studentId", "courseId") so one student gets one certificate per course.
 * It is idempotent: a database already in the target state is left alone. down() restores the exact
 * previous (wrong) FK so a revert matches the schema it replaces.
 * TypeORM derives foreign key names from the table and column names only, so the fixed FK gets the
 * same generated name the wrong one had; keeping that name keeps `migration:drift` at "no drift".
 */
const TABLE = 'certificates';
const UNIQUE_NAME = 'UQ_certificates_student_course';
const FK_NAME = 'FK_e50e73bc3bdcfb0eb3d561f1494';

export class CertificateCourseFk1764000000003 implements MigrationInterface {
  name = 'CertificateCourseFk1764000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const fks: { conname: string; def: string }[] = await queryRunner.query(
      `SELECT co.conname AS conname, pg_get_constraintdef(co.oid) AS def
         FROM pg_constraint co
         JOIN pg_class cl ON cl.oid = co.conrelid
         JOIN pg_namespace ns ON ns.oid = cl.relnamespace
        WHERE ns.nspname = 'public' AND cl.relname = $1 AND co.contype = 'f'`,
      [TABLE],
    );
    const courseFk = fks.find((f) => /^FOREIGN KEY \("courseId"\)/.test(f.def));
    // pg_get_constraintdef quotes identifiers only when needed: REFERENCES courses(id), not "courses"
    const pointsAtCourses = !!courseFk && /REFERENCES "?courses"?\(/.test(courseFk.def);
    const haveUnique = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [UNIQUE_NAME]);

    if (pointsAtCourses && haveUnique.length) return; // already in the target state

    // No remapping of existing rows: their courseId was validated against users, not courses.
    const rows: { id: number; studentId: number | null; courseId: number | null }[] = await queryRunner.query(
      `SELECT id, "studentId", "courseId" FROM "${TABLE}" ORDER BY id`,
    );
    if (rows.length && !pointsAtCourses) {
      const list = rows.map((r) => `id=${r.id} studentId=${r.studentId} courseId=${r.courseId}`).join('; ');
      throw new Error(
        `${TABLE} has ${rows.length} row(s) written while "courseId" referenced users(id): ${list}. ` +
          `A value that matches a course id does not prove it was meant as one, so this migration will not guess. ` +
          `Nothing was changed. Review and reconcile these rows, then run the migration again.`,
      );
    }

    if (haveUnique.length === 0) {
      const dup = await queryRunner.query(
        `SELECT count(*) AS n FROM (SELECT 1 FROM "${TABLE}" GROUP BY "studentId", "courseId" HAVING count(*) > 1) d`,
      );
      if (Number(dup[0].n) > 0) {
        throw new Error(
          `${dup[0].n} group(s) of duplicate rows in ${TABLE} on (studentId, courseId) block the unique rule ${UNIQUE_NAME}. ` +
            `Nothing was changed. Decide which rows to keep, clean them up, then run the migration again.`,
        );
      }
    }

    if (courseFk && !pointsAtCourses) {
      await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT "${courseFk.conname}"`);
    }
    if (!pointsAtCourses) {
      await queryRunner.query(
        `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${FK_NAME}" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      );
    }

    if (haveUnique.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${UNIQUE_NAME}" UNIQUE ("studentId", "courseId")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${UNIQUE_NAME}"`);
    await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${FK_NAME}"`);
    // Restore the exact constraint this migration replaced (the wrong FK to users).
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${FK_NAME}" FOREIGN KEY ("courseId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
