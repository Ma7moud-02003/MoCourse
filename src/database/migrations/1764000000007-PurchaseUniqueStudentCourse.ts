import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One purchase request per student per course. This migration adds UNIQUE("userId", "courseId") on purchase,
 * so even two requests arriving at the same moment cannot create a second row.
 * It refuses to run while duplicate pairs exist: it stops, lists every row involved (id, status,
 * amount, payment method, transaction id) and changes nothing. The owner reviews the listed rows and decides which to keep;
 * it never deletes or merges a purchase on its own. Idempotent: a database that already has the
 * constraint is left alone. The constraint name matches the entity's
 * @Unique('UQ_purchase_user_course', ['user', 'course']) so `migration:drift` stays at "no drift".
 */
const TABLE = 'purchase';
const UNIQUE_NAME = 'UQ_purchase_user_course';

export class PurchaseUniqueStudentCourse1764000000007 implements MigrationInterface {
  name = 'PurchaseUniqueStudentCourse1764000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const haveUnique = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [UNIQUE_NAME]);
    if (haveUnique.length) return; // already in the target state

    const dups: {
      userId: number | null;
      courseId: number | null;
      n: number;
      rows: { id: number; status: string; amount: number; paymentMethod: string | null; transactionId: string | null; enrolledAt: string | null }[];
    }[] = await queryRunner.query(
      `SELECT "userId", "courseId", count(*) AS n,
              json_agg(json_build_object('id', id, 'status', status, 'amount', amount, 'paymentMethod', "paymentMethod", 'transactionId', "transactionId", 'enrolledAt', "enrolledAt") ORDER BY id) AS rows
         FROM "${TABLE}" GROUP BY "userId", "courseId" HAVING count(*) > 1 ORDER BY "userId", "courseId"`,
    );
    if (dups.length) {
      const list = dups
        .map(
          (d) =>
            `userId=${d.userId} courseId=${d.courseId} purchase: ` +
            d.rows.map((r) => `#${r.id} (${r.status}, amount=${r.amount}, ${r.paymentMethod}, transactionId=${r.transactionId}, enrolledAt=${r.enrolledAt})`).join(', '),
        )
        .join('; ');
      throw new Error(
        `${TABLE} has ${dups.length} duplicate (userId, courseId) group(s) blocking the one-purchase-request-per-course rule: ${list}. ` +
          `Nothing was changed. The owner reviews each group and decides which purchase request to keep (rows marked PAID also count in sales totals); reconcile them, then run the migration again.`,
      );
    }

    await queryRunner.query(`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${UNIQUE_NAME}" UNIQUE ("userId", "courseId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${UNIQUE_NAME}"`);
  }
}
