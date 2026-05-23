-- Rollback for migration 20260523124537_drop_max_days_per_year.
-- Wave 4 / finding #9.
--
-- Run sequence (operator):
--   1. Confirm the backup table exists and is populated:
--        SELECT COUNT(*) FROM "leave_type_configs_max_days_backup_20260523";
--   2. Apply this script:
--        docker exec -i orchestr-a-postgres-prod psql -U postgres \
--          -d orchestr_a_prod -v ON_ERROR_STOP=1 \
--          -f /opt/orchestra/scripts/db/rollback-drop-max-days-per-year.sql
--   3. Remove the migration row from Prisma's history so a subsequent
--      `prisma migrate deploy` does not try to re-drop the column:
--        DELETE FROM "_prisma_migrations"
--        WHERE migration_name = '20260523124537_drop_max_days_per_year';
--      (This step is NOT in the script — it is a deliberate operator
--      acknowledgement: rolling back a migration is a state the team
--      should know about.)
--   4. Once application behavior is confirmed healthy, drop the backup
--      table manually:
--        DROP TABLE "leave_type_configs_max_days_backup_20260523";

BEGIN;

-- Re-add the column with original type and nullability (matches the
-- definition from migration 20251215120000_add_missing_tables).
ALTER TABLE "leave_type_configs"
  ADD COLUMN IF NOT EXISTS "maxDaysPerYear" INTEGER;

-- Restore values from the backup table. Rows that had NULL in the
-- snapshot stay NULL (we backed up ALL rows, not only non-null ones).
UPDATE "leave_type_configs" ltc
SET    "maxDaysPerYear" = b."maxDaysPerYear"
FROM   "leave_type_configs_max_days_backup_20260523" b
WHERE  b.id = ltc.id;

-- Sanity: count of restored non-null rows must match the snapshot.
DO $$
DECLARE
  restored BIGINT;
  expected BIGINT;
BEGIN
  SELECT COUNT(*) INTO restored
  FROM   "leave_type_configs"
  WHERE  "maxDaysPerYear" IS NOT NULL;

  SELECT COUNT(*) INTO expected
  FROM   "leave_type_configs_max_days_backup_20260523"
  WHERE  "maxDaysPerYear" IS NOT NULL;

  IF restored <> expected THEN
    RAISE EXCEPTION 'Restore mismatch: restored=%, expected=%', restored, expected;
  END IF;
END $$;

COMMIT;

-- DO NOT drop the backup table from inside this script. Operator must
-- run `DROP TABLE "leave_type_configs_max_days_backup_20260523";`
-- manually after confirming application health.
