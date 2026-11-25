import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline: the schema as it was at main f7cc77d (what `synchronize` produced from the entities).
 *
 * - Empty database: creates everything.
 * - Database that already has the tables (built earlier by synchronize): does nothing. Check that
 *   it matches with `npm run migration:drift` (it must report no pending changes) before relying on
 *   the later migrations.
 * - down() refuses on purpose: reverting the baseline would drop every table and all data.
 */
const QUERIES: string[] = [
  "CREATE TABLE \"categorise\" (\"id\" SERIAL NOT NULL, \"name\" character varying(200) NOT NULL, \"createdAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, CONSTRAINT \"PK_0946f41c69369b74514e0c0e024\" PRIMARY KEY (\"id\"))",
  "CREATE TYPE \"public\".\"enrollments_status_enum\" AS ENUM('in_progress', 'completed')",
  "CREATE TABLE \"enrollments\" (\"id\" SERIAL NOT NULL, \"enrolledAt\" TIMESTAMP DEFAULT ('now'::text)::timestamp(6) with time zone, \"status\" \"public\".\"enrollments_status_enum\" NOT NULL DEFAULT 'in_progress', \"completedAt\" TIMESTAMP DEFAULT ('now'::text)::timestamp(6) with time zone, \"userId\" integer, \"courseId\" integer, CONSTRAINT \"PK_7c0f752f9fb68bf6ed7367ab00f\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE \"progreses\" (\"id\" SERIAL NOT NULL, \"lastPosition\" integer NOT NULL DEFAULT '0', \"completed\" boolean NOT NULL DEFAULT false, \"startedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"completedAt\" TIMESTAMP, \"lessonId\" integer, \"userId\" integer, CONSTRAINT \"UQ_9b16674ff8f81571a0cd568b384\" UNIQUE (\"userId\", \"lessonId\"), CONSTRAINT \"PK_6ce522cdd0a1365d191da676ca3\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE \"sections\" (\"id\" SERIAL NOT NULL, \"title\" character varying(100) NOT NULL, \"order\" integer NOT NULL, \"createdAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"courseId\" integer, CONSTRAINT \"PK_f9749dd3bffd880a497d007e450\" PRIMARY KEY (\"id\"))",
  "CREATE TYPE \"public\".\"lessons_type_enum\" AS ENUM('video', 'pdf', 'text')",
  "CREATE TABLE \"lessons\" (\"id\" SERIAL NOT NULL, \"title\" character varying(100) NOT NULL, \"description\" character varying, \"type\" \"public\".\"lessons_type_enum\" NOT NULL DEFAULT 'pdf', \"videoUrl\" character varying, \"pdfUrl\" character varying, \"videoPublicId\" character varying, \"pdfPublicId\" character varying, \"content\" character varying, \"duration\" integer, \"order\" integer NOT NULL, \"fileSize\" integer, \"isPreview\" boolean NOT NULL DEFAULT true, \"createdAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"sectionId\" integer, CONSTRAINT \"PK_9b9a8d455cac672d262d7275730\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE \"quiz_attempt_entity\" (\"id\" SERIAL NOT NULL, \"score\" integer NOT NULL DEFAULT '0', \"passed\" boolean NOT NULL DEFAULT false, \"submitted\" boolean NOT NULL DEFAULT false, \"attemptNumber\" integer NOT NULL DEFAULT '1', \"startedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"expiresAt\" TIMESTAMP NOT NULL, \"submittedAt\" TIMESTAMP, \"userId\" integer, \"quizId\" integer, CONSTRAINT \"UQ_799718b1a9e63ba907478362210\" UNIQUE (\"quizId\", \"userId\"), CONSTRAINT \"PK_97a287b4036696674d02d6e1f99\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE \"student_answer_entity\" (\"id\" SERIAL NOT NULL, \"isCorrect\" boolean NOT NULL DEFAULT false, \"earnedMark\" integer NOT NULL DEFAULT '0', \"answeredAt\" TIMESTAMP NOT NULL DEFAULT now(), \"attemptId\" integer, \"questionId\" integer, \"choiceId\" integer, CONSTRAINT \"UQ_90ee15bc1d081da10b2072d6856\" UNIQUE (\"attemptId\", \"questionId\"), CONSTRAINT \"PK_40cae9fbcc31fc80b87f386b4f3\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE \"choice_entity\" (\"id\" SERIAL NOT NULL, \"text\" text NOT NULL, \"isCorrect\" boolean NOT NULL DEFAULT false, \"order\" integer NOT NULL DEFAULT '1', \"createdAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"questionId\" integer, CONSTRAINT \"PK_34809813272cd8b19d4b364f9a0\" PRIMARY KEY (\"id\"))",
  "CREATE TYPE \"public\".\"question_entity_type_enum\" AS ENUM('mcq', 'true_false')",
  "CREATE TABLE \"question_entity\" (\"id\" SERIAL NOT NULL, \"type\" \"public\".\"question_entity_type_enum\" NOT NULL DEFAULT 'mcq', \"question\" text NOT NULL, \"mark\" integer NOT NULL DEFAULT '1', \"order\" integer NOT NULL DEFAULT '1', \"createdAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"quizId\" integer, CONSTRAINT \"PK_14a0a509f33d8cd3a96a448dcd7\" PRIMARY KEY (\"id\"))",
  "CREATE TYPE \"public\".\"quiz_entity_quiztarget_enum\" AS ENUM('course', 'section', 'lesson')",
  "CREATE TABLE \"quiz_entity\" (\"id\" SERIAL NOT NULL, \"title\" character varying(150) NOT NULL, \"description\" character varying, \"passMark\" integer NOT NULL, \"timeLimit\" integer NOT NULL, \"opensAt\" TIMESTAMP WITH TIME ZONE, \"closesAt\" TIMESTAMP WITH TIME ZONE, \"maxAttempts\" integer NOT NULL DEFAULT '1', \"shuffleQuestions\" boolean NOT NULL DEFAULT false, \"shuffleChoices\" boolean NOT NULL DEFAULT false, \"totalMarks\" integer NOT NULL DEFAULT '0', \"instructions\" text, \"showResultImmediately\" boolean NOT NULL DEFAULT false, \"quizTarget\" \"public\".\"quiz_entity_quiztarget_enum\" NOT NULL, \"isPublished\" boolean NOT NULL DEFAULT false, \"createdAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"courseId\" integer NOT NULL, \"sectionId\" integer, \"lessonId\" integer, CONSTRAINT \"PK_49aa5018c097da2f6c16121c4f3\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE \"reviews\" (\"id\" SERIAL NOT NULL, \"comment\" character varying(150) NOT NULL, \"rateing\" integer NOT NULL, \"createdAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"courseId\" integer, \"userId\" integer, CONSTRAINT \"PK_231ae565c273ee700b283f15c1d\" PRIMARY KEY (\"id\"))",
  "CREATE TYPE \"public\".\"courses_level_enum\" AS ENUM('beginner', 'intermediate', 'advanced')",
  "CREATE TABLE \"courses\" (\"id\" SERIAL NOT NULL, \"title\" character varying(100) NOT NULL, \"describtion\" character varying, \"price\" integer NOT NULL, \"covers\" text array NOT NULL, \"requirements\" text array NOT NULL DEFAULT '{}', \"thumbnail\" character varying, \"publicId\" character varying NOT NULL, \"level\" \"public\".\"courses_level_enum\" NOT NULL DEFAULT 'intermediate', \"isPublished\" boolean NOT NULL DEFAULT true, \"discountPrice\" integer, \"duration\" integer NOT NULL DEFAULT '0', \"createdAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"instractorId\" integer, \"categoryId\" integer, CONSTRAINT \"PK_3f70a487cc718ad8eda4e6d58c9\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE \"certificates\" (\"id\" SERIAL NOT NULL, \"certificateNumber\" character varying NOT NULL, \"issuedAt\" TIMESTAMP NOT NULL, \"completedAt\" TIMESTAMP, \"courseTitle\" character varying NOT NULL, \"studentId\" integer, \"courseId\" integer, CONSTRAINT \"UQ_9742ea65bce69db989c2e676936\" UNIQUE (\"certificateNumber\"), CONSTRAINT \"PK_e4c7e31e2144300bea7d89eb165\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE \"payment_info\" (\"id\" SERIAL NOT NULL, \"instapay\" character varying, \"vodafonCach\" character varying, \"orangeCash\" character varying, \"bankAccount\" character varying, \"ownerName\" character varying, \"instractorId\" integer, CONSTRAINT \"REL_562d86bc1fbec3354a6e63de46\" UNIQUE (\"instractorId\"), CONSTRAINT \"PK_b2ba4f3b3f40c6a37e54fb8b252\" PRIMARY KEY (\"id\"))",
  "CREATE TYPE \"public\".\"notification_entity_type_enum\" AS ENUM('purchase', 'enrollment', 'course', 'certificate', 'quiz', 'system')",
  "CREATE TABLE \"notification_entity\" (\"id\" SERIAL NOT NULL, \"title\" character varying NOT NULL, \"message\" text NOT NULL, \"type\" \"public\".\"notification_entity_type_enum\" NOT NULL, \"isRead\" boolean NOT NULL DEFAULT false, \"resourceId\" integer, \"createdAt\" TIMESTAMP NOT NULL DEFAULT now(), \"userId\" integer, CONSTRAINT \"PK_112676de71a3a708b914daed289\" PRIMARY KEY (\"id\"))",
  "CREATE TYPE \"public\".\"users_role_enum\" AS ENUM('student', 'Instructor', 'admin')",
  "CREATE TABLE \"users\" (\"id\" SERIAL NOT NULL, \"fullName\" character varying(100) NOT NULL, \"email\" character varying NOT NULL, \"password\" character varying(150) NOT NULL, \"role\" \"public\".\"users_role_enum\" NOT NULL DEFAULT 'student', \"avatar\" character varying, \"isVerified\" boolean NOT NULL DEFAULT false, \"createdAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, CONSTRAINT \"UQ_97672ac88f789774dd47f7c8be3\" UNIQUE (\"email\"), CONSTRAINT \"PK_a3ffb1c0c8416b9fc6f907b7433\" PRIMARY KEY (\"id\"))",
  "CREATE TYPE \"public\".\"purchase_status_enum\" AS ENUM('PENDING', 'WAITING_APPROVAL', 'PAID', 'FAILED')",
  "CREATE TYPE \"public\".\"purchase_paymentmethod_enum\" AS ENUM('instapay', 'vodafonCach', 'orangeCash', 'bankAccount')",
  "CREATE TABLE \"purchase\" (\"id\" SERIAL NOT NULL, \"enrolledAt\" TIMESTAMP DEFAULT ('now'::text)::timestamp(6) with time zone, \"status\" \"public\".\"purchase_status_enum\" NOT NULL DEFAULT 'PENDING', \"paymentMethod\" \"public\".\"purchase_paymentmethod_enum\", \"transactionId\" character varying, \"amount\" integer NOT NULL, \"thumbnail\" character varying, \"publicId\" character varying, \"userId\" integer, \"courseId\" integer, CONSTRAINT \"PK_86cc2ebeb9e17fc9c0774b05f69\" PRIMARY KEY (\"id\"))",
  "ALTER TABLE \"enrollments\" ADD CONSTRAINT \"FK_de33d443c8ae36800c37c58c929\" FOREIGN KEY (\"userId\") REFERENCES \"users\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"enrollments\" ADD CONSTRAINT \"FK_60dd0ae4e21002e63a5fdefeec8\" FOREIGN KEY (\"courseId\") REFERENCES \"courses\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"progreses\" ADD CONSTRAINT \"FK_fd4521a4ae5fb8916e387bddb6b\" FOREIGN KEY (\"lessonId\") REFERENCES \"lessons\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"progreses\" ADD CONSTRAINT \"FK_20114d023b885096b9031b39ba2\" FOREIGN KEY (\"userId\") REFERENCES \"users\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"sections\" ADD CONSTRAINT \"FK_0fc0dc8ce98e7dc47c273f85e3d\" FOREIGN KEY (\"courseId\") REFERENCES \"courses\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"lessons\" ADD CONSTRAINT \"FK_6dc4890fa16a7a866b6144f4929\" FOREIGN KEY (\"sectionId\") REFERENCES \"sections\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"quiz_attempt_entity\" ADD CONSTRAINT \"FK_e873f52f71d2341707b9cf75aa6\" FOREIGN KEY (\"userId\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"quiz_attempt_entity\" ADD CONSTRAINT \"FK_08778bedbe5a233f7cfc583bab7\" FOREIGN KEY (\"quizId\") REFERENCES \"quiz_entity\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"student_answer_entity\" ADD CONSTRAINT \"FK_7e2a6c30c497c60f3c810fa7580\" FOREIGN KEY (\"attemptId\") REFERENCES \"quiz_attempt_entity\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"student_answer_entity\" ADD CONSTRAINT \"FK_330725a54cb330abd3252431f8c\" FOREIGN KEY (\"questionId\") REFERENCES \"question_entity\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"student_answer_entity\" ADD CONSTRAINT \"FK_63c867bdd0235bd73ed8b2082b4\" FOREIGN KEY (\"choiceId\") REFERENCES \"choice_entity\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"choice_entity\" ADD CONSTRAINT \"FK_fefdd97a13b44be87e7593029bf\" FOREIGN KEY (\"questionId\") REFERENCES \"question_entity\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"question_entity\" ADD CONSTRAINT \"FK_f9fe3f64d4d2c5e6179b2af1a69\" FOREIGN KEY (\"quizId\") REFERENCES \"quiz_entity\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"quiz_entity\" ADD CONSTRAINT \"FK_3ef7a31a22393487825dd70dbc4\" FOREIGN KEY (\"courseId\") REFERENCES \"courses\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"quiz_entity\" ADD CONSTRAINT \"FK_c57c2c5c3a445e1a25316fd7398\" FOREIGN KEY (\"sectionId\") REFERENCES \"sections\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"quiz_entity\" ADD CONSTRAINT \"FK_e280d0b7d1973c70c81f2cafd87\" FOREIGN KEY (\"lessonId\") REFERENCES \"lessons\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"reviews\" ADD CONSTRAINT \"FK_01ad76b89c3d4f612209556e2c3\" FOREIGN KEY (\"courseId\") REFERENCES \"courses\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"reviews\" ADD CONSTRAINT \"FK_7ed5659e7139fc8bc039198cc1f\" FOREIGN KEY (\"userId\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"courses\" ADD CONSTRAINT \"FK_6c9fcf7ae13ab07d3ab08e66b7b\" FOREIGN KEY (\"instractorId\") REFERENCES \"users\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"courses\" ADD CONSTRAINT \"FK_c730473dfb837b3e62057cd9447\" FOREIGN KEY (\"categoryId\") REFERENCES \"categorise\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"certificates\" ADD CONSTRAINT \"FK_dd01ec6501540780943fe16cf75\" FOREIGN KEY (\"studentId\") REFERENCES \"users\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"certificates\" ADD CONSTRAINT \"FK_e50e73bc3bdcfb0eb3d561f1494\" FOREIGN KEY (\"courseId\") REFERENCES \"users\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"payment_info\" ADD CONSTRAINT \"FK_562d86bc1fbec3354a6e63de467\" FOREIGN KEY (\"instractorId\") REFERENCES \"users\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"notification_entity\" ADD CONSTRAINT \"FK_dd9edd17abec9f32798a1f1e22d\" FOREIGN KEY (\"userId\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION",
  "ALTER TABLE \"purchase\" ADD CONSTRAINT \"FK_33520b6c46e1b3971c0a649d38b\" FOREIGN KEY (\"userId\") REFERENCES \"users\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION",
  "ALTER TABLE \"purchase\" ADD CONSTRAINT \"FK_de02d16582b8f768a0a9cf3cb00\" FOREIGN KEY (\"courseId\") REFERENCES \"courses\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION"
];

export class Baseline1764000000000 implements MigrationInterface {
  name = 'Baseline1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.query(`SELECT to_regclass('public.users') AS t`);
    if (exists[0]?.t) {
      console.log('[baseline] tables already exist, skipping schema creation (verify with migration:drift)');
      return;
    }
    for (const sql of QUERIES) await queryRunner.query(sql);
  }

  public async down(): Promise<void> {
    throw new Error('Refusing to revert the baseline: it would drop every table and all data. Restore from a backup instead.');
  }
}
