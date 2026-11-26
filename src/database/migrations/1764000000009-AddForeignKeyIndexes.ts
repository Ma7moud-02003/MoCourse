import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Postgres does not index foreign keys by itself. These indexes speed up the common lookups
 * ("lessons of a section", "enrollments of a course", "a user's notifications", ...).
 * Only adds indexes: no data is changed, and running it twice is harmless (IF NOT EXISTS).
 * Names and columns match the @Index decorators on the entities, so `migration:drift` stays at "no drift".
 */
export const FK_INDEXES: { name: string; table: string; column: string }[] = [
  { name: 'IDX_courses_instractor', table: 'courses', column: 'instractorId' },
  { name: 'IDX_courses_category', table: 'courses', column: 'categoryId' },
  { name: 'IDX_sections_course', table: 'sections', column: 'courseId' },
  { name: 'IDX_lessons_section', table: 'lessons', column: 'sectionId' },
  { name: 'IDX_enrollments_course', table: 'enrollments', column: 'courseId' },
  { name: 'IDX_purchase_course', table: 'purchase', column: 'courseId' },
  { name: 'IDX_progreses_lesson', table: 'progreses', column: 'lessonId' },
  { name: 'IDX_certificates_course', table: 'certificates', column: 'courseId' },
  { name: 'IDX_reviews_course', table: 'reviews', column: 'courseId' },
  { name: 'IDX_notification_user', table: 'notification_entity', column: 'userId' },
  { name: 'IDX_question_quiz', table: 'question_entity', column: 'quizId' },
  { name: 'IDX_choice_question', table: 'choice_entity', column: 'questionId' },
  { name: 'IDX_quiz_attempt_user', table: 'quiz_attempt_entity', column: 'userId' },
  { name: 'IDX_student_answer_question', table: 'student_answer_entity', column: 'questionId' },
];

export class AddForeignKeyIndexes1764000000009 implements MigrationInterface {
  name = 'AddForeignKeyIndexes1764000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const i of FK_INDEXES) {
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${i.name}" ON "${i.table}" ("${i.column}")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const i of FK_INDEXES) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${i.name}"`);
    }
  }
}
