-- DAT-005 — ROLLBACK script for the Float → Decimal conversion
-- ===============================================================
--
-- Use this only if the conversion migration
-- (packages/database/prisma/migrations/20260524100100_dat005_convert_float_to_decimal)
-- needs to be undone in production.
--
-- IMPORTANT
--   - This script ALSO depends on the safety-snapshot migration
--     (20260524100000_dat005_backup_float_columns) having run BEFORE the conversion.
--     If for any reason the backup tables are missing, restoring from them is impossible —
--     restore from a database-level backup instead.
--   - In Postgres, ALTER TYPE NUMERIC → DOUBLE PRECISION is NOT exactly reversible. Floats
--     cannot represent some decimal fractions exactly. The values you get back after step 1
--     below will be the IEEE 754 approximation of the current Decimal — usually identical
--     to the pre-conversion Float at single-row level (we round-tripped, not invented
--     precision), but if rows were UPDATED with new precision-significant fractional
--     digits AFTER the conversion landed, step 2 restores the original snapshot value
--     and overwrites those post-conversion changes.
--
-- USAGE (run as DB superuser or migration role)
-- ---------------------------------------------
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db/rollback-dat005-decimal-conversion.sql
--
-- After running, manually delete the two migration rows from `_prisma_migrations`
-- so Prisma re-applies them on the next deploy (if you intend to re-attempt later):
--   DELETE FROM "_prisma_migrations" WHERE migration_name IN (
--     '20260524100100_dat005_convert_float_to_decimal',
--     '20260524100000_dat005_backup_float_columns'
--   );

BEGIN;

-- ─── 1. Revert column types Decimal → Float ─────────────────────────────────
-- USING ::double precision rounds the NUMERIC values to IEEE 754. Any sub-IEEE-754
-- precision held in Decimal is unrecoverable at this point; step 2 corrects rows
-- whose original Float still lives in the safety snapshot.

ALTER TABLE "time_entries"
  ALTER COLUMN "hours" TYPE DOUBLE PRECISION
  USING ("hours"::double precision);

ALTER TABLE "leaves"
  ALTER COLUMN "days" TYPE DOUBLE PRECISION
  USING ("days"::double precision);

ALTER TABLE "leave_balances"
  ALTER COLUMN "totalDays" TYPE DOUBLE PRECISION
  USING ("totalDays"::double precision);

ALTER TABLE "tasks"
  ALTER COLUMN "estimatedHours" TYPE DOUBLE PRECISION
  USING ("estimatedHours"::double precision);

ALTER TABLE "project_snapshots"
  ALTER COLUMN "progress" TYPE DOUBLE PRECISION
  USING ("progress"::double precision);

-- ─── 2. Restore original Float values from safety-snapshot tables ───────────
-- This overwrites the current column with the exact byte representation captured
-- before the conversion. Rows inserted AFTER the conversion (not present in the
-- snapshot) are left alone.

UPDATE "time_entries" t
  SET "hours" = b."hours"
  FROM "_dat005_backup_time_entries_hours" b
  WHERE t.id = b.id;

UPDATE "leaves" l
  SET "days" = b."days"
  FROM "_dat005_backup_leaves_days" b
  WHERE l.id = b.id;

UPDATE "leave_balances" lb
  SET "totalDays" = b."totalDays"
  FROM "_dat005_backup_leave_balances_total_days" b
  WHERE lb.id = b.id;

UPDATE "tasks" tsk
  SET "estimatedHours" = b."estimatedHours"
  FROM "_dat005_backup_tasks_estimated_hours" b
  WHERE tsk.id = b.id;

UPDATE "project_snapshots" ps
  SET "progress" = b."progress"
  FROM "_dat005_backup_project_snapshots_progress" b
  WHERE ps.id = b.id;

COMMIT;

-- ─── 3. (optional) Drop the safety-snapshot tables ────────────────────────
-- Keep them around if you intend to re-attempt the migration. Drop only once you
-- have confirmed no further rollback is needed.
--
--   DROP TABLE "_dat005_backup_time_entries_hours";
--   DROP TABLE "_dat005_backup_leaves_days";
--   DROP TABLE "_dat005_backup_leave_balances_total_days";
--   DROP TABLE "_dat005_backup_tasks_estimated_hours";
--   DROP TABLE "_dat005_backup_project_snapshots_progress";
