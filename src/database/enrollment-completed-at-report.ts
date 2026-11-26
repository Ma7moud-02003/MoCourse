import { DataSource } from 'typeorm';
import base from './data-source';

export interface EnrollmentDateRow {
  id: number;
  userId: number | null;
  courseId: number | null;
  status: string;
  enrolledAt: string | null;
  completedAt: string | null;
}

export type CompletedAtFinding = 'IN_PROGRESS_HAS_COMPLETED_AT' | 'COMPLETED_WITHOUT_DATE' | 'COMPLETED_AT_EQUALS_ENROLLED_AT';

/**
 * Read-only review of enrollments.completedAt. Classifies a row; it never proposes a replacement date.
 * - IN_PROGRESS_HAS_COMPLETED_AT: not completed, yet has a date (almost surely the old "default now()" stamp).
 * - COMPLETED_WITHOUT_DATE: completed but no date.
 * - COMPLETED_AT_EQUALS_ENROLLED_AT: completed and the date is within 2 seconds of enrolment (suspicious, could be the old default).
 * Rows with no finding are fine.
 */
export function classifyEnrollment(r: EnrollmentDateRow): CompletedAtFinding | null {
  if (r.status !== 'completed') return r.completedAt != null ? 'IN_PROGRESS_HAS_COMPLETED_AT' : null;
  if (r.completedAt == null) return 'COMPLETED_WITHOUT_DATE';
  if (r.enrolledAt != null && Math.abs(new Date(r.completedAt).getTime() - new Date(r.enrolledAt).getTime()) <= 2000)
    return 'COMPLETED_AT_EQUALS_ENROLLED_AT';
  return null;
}

// npm run report:enrollment-completed-at
// Prints the enrollments whose completedAt needs the owner's review. It only runs SELECT: nothing is changed or deleted.
async function main() {
  const ds = new DataSource({ ...(base.options as any) });
  await ds.initialize();
  try {
    const rows: EnrollmentDateRow[] = await ds.query(
      `SELECT id, "userId", "courseId", status::text AS status, "enrolledAt"::text AS "enrolledAt", "completedAt"::text AS "completedAt" FROM enrollments ORDER BY id`,
    );
    const counts: Record<string, number> = {};
    const flagged = rows
      .map((r) => ({ r, f: classifyEnrollment(r) }))
      .filter((x): x is { r: EnrollmentDateRow; f: CompletedAtFinding } => x.f !== null);
    for (const { f } of flagged) counts[f] = (counts[f] ?? 0) + 1;
    console.log(`${rows.length} enrollment(s), ${flagged.length} need review. Nothing was changed.`);
    for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
    for (const { r, f } of flagged)
      console.log(`  #${r.id} user=${r.userId} course=${r.courseId} status=${r.status} enrolledAt=${r.enrolledAt} completedAt=${r.completedAt} -> ${f}`);
  } finally {
    await ds.destroy();
  }
}
if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
