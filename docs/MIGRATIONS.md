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

1. `Baseline`: the schema at main f7cc77d. Empty database: creates everything. Database that already has the
   tables: skips. Revert is refused on purpose (it would drop all data).
2. `AttemptTimestampsToTimestamptz`: `startedAt`, `expiresAt`, `submittedAt` (attempts) and `answeredAt` (answers)
   become `timestamptz`. Old values are wall-clock times without a zone, so the migration needs to know which zone
   wrote them. It will not guess. Set:

       MIGRATION_ATTEMPT_APP_TZ=<zone of the Node server that wrote the data, e.g. Africa/Cairo>
       MIGRATION_ATTEMPT_DB_TZ=<PostgreSQL TimeZone when the rows were inserted, from SHOW TimeZone>

   They are not needed when there are no attempt rows. Wall-clock times inside a DST overlap or gap map to one
   instant chosen by PostgreSQL. Revert needs the same two variables.
3. `EnsureAttemptUniqueRules`: adds the one-attempt-per-student and one-answer-per-question unique rules if the
   database does not have them. Stops with a message if existing duplicate rows break a rule. It never deletes data.

## Other tables

Only the exam attempt times were converted. `createdAt` / `updatedAt` columns on other tables are still plain
`timestamp` and are informational.
