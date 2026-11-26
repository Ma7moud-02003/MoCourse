# Database migrations

The app no longer has to rely on `synchronize` in production. Migrations live in `src/database/migrations`.

## Commands

    npm run migration:show     # which migrations ran
    npm run migration:run      # apply pending migrations (builds first)
    npm run migration:revert   # undo the last one
    npm run migration:drift    # compare the real database with the entities; must print "no drift"

They read `.env.<NODE_ENV>` (DB_HOST optional, default localhost, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE).
Always run them on a copy of the data first, and take a backup before running on the real database.

## What is in them

1. `Baseline`: the schema at main f7cc77d. Empty database: creates everything (the simple, tested path for a new
   setup: create an empty database, run `npm run migration:run`). Database that already has tables: the baseline is
   built in a scratch schema and compared with the real one. If they match, it is adopted; if not, the migration
   stops with the list of differences and changes nothing. Databases built by main at 9e946f4 or f7cc77d match;
   older ones (before the exam window and unique rules) do not, so use an empty database for those.
   Revert is refused on purpose (it would drop all data).
2. `AttemptTimestampsToTimestamptz`: `startedAt`, `expiresAt`, `submittedAt` (attempts) and `answeredAt` (answers)
   become `timestamptz`. Old values are wall-clock times without a zone, so the migration needs to know which zone
   wrote them. It will not guess. Set:

       MIGRATION_ATTEMPT_APP_TZ=<zone of the Node server that wrote the data, e.g. Africa/Cairo>
       MIGRATION_ATTEMPT_DB_TZ=<PostgreSQL TimeZone when the rows were inserted, from SHOW TimeZone>

   They are not needed when there are no attempt rows. Wall-clock times inside a DST overlap or gap map to one
   instant chosen by PostgreSQL. Revert needs the same two variables.
3. `EnsureAttemptUniqueRules`: adds the one-attempt-per-student and one-answer-per-question unique rules if the
   database does not have them. Stops with a message if existing duplicate rows break a rule. It never deletes data.

6. `EnrollmentUniqueStudentCourse`: adds UNIQUE("userId", "courseId") on `enrollments` (one enrollment per student per
   course). If duplicate rows already exist it stops, prints every row involved (id, status, enrolledAt, completedAt)
   and changes nothing. The owner reviews them, keeps one row per student and course, then runs it again. It never
   deletes or merges enrollments on its own.
   - Outside production the app syncs the schema on start. A start guard (like the certificate one) refuses to start
     while the rule is missing and duplicates exist, lists the rows, and changes nothing. Once there are no
     duplicates the sync creates the same rule itself; `migration:run` then records the migration as a no-op.
   - Deploy order in production: run `npm run migration:run` BEFORE starting the new code. Without the rule the new
     code refuses to enroll (the purchase approval fails and rolls back, nothing is half-saved).

7. `PurchaseUniqueStudentCourse`: adds UNIQUE("userId", "courseId") on `purchase` (one purchase request per student per
   course; a rejected request is retried on the same row). Same behavior as 6: refuses and lists every row (id, status,
   amount, payment method, transaction id) when duplicates exist, never deletes or merges. Rows marked PAID count in
   the instructor's sales totals, so which duplicate to keep is an accounting decision for the owner. The start guard
   works the same way. A database that the app syncs itself needs no migration command: just pull and start.

## Other tables

Only the exam attempt times were converted. `createdAt` / `updatedAt` columns on other tables are still plain
`timestamp` and are informational.
