#!/bin/bash
#
# Preflight for migration 20260523124537_drop_max_days_per_year.
# Wave 4 / finding #9 of the uniform-leave-balance remediation.
#
# This script runs on the VPS BEFORE `prisma migrate deploy`. It:
#   1. Captures a read-only snapshot of the rows that carry a non-null
#      `maxDaysPerYear` (the data the DROP COLUMN will discard).
#   2. Creates a committed backup table inside the same DB —
#      `leave_type_configs_max_days_backup_20260523`. The backup MUST
#      live in a transaction separate from the migration that drops the
#      column: a Prisma migration runs atomically, so co-locating
#      `CREATE TABLE ... AS SELECT` with the DROP would lose the snapshot
#      if the DROP rolled back.
#   3. Asserts that row counts match what was captured.
#   4. Exits non-zero on any anomaly so the operator can halt before
#      invoking `prisma migrate deploy`.
#
# The migration itself is left to the operator — this script never runs
# Prisma. Run sequence:
#
#   1. ssh orchestra@vps
#   2. cd /opt/orchestra
#   3. bash scripts/db/preflight-drop-max-days-per-year.sh
#   4. (read output, confirm)
#   5. docker compose --env-file .env.production exec api \
#          pnpm --filter database exec prisma migrate deploy
#   6. (run post-migration assertion — see Wave 0 brief §5)
#
# To restore after the migration: see
# scripts/db/rollback-drop-max-days-per-year.sql in this same directory.

set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-orchestr-a-postgres-prod}"
DATABASE_USER="${DATABASE_USER:-postgres}"
DATABASE_NAME="${DATABASE_NAME:-orchestr_a_prod}"
BACKUP_TABLE="leave_type_configs_max_days_backup_20260523"

run_sql() {
  docker exec -i "${CONTAINER_NAME}" psql \
    -U "${DATABASE_USER}" \
    -d "${DATABASE_NAME}" \
    -v ON_ERROR_STOP=1 \
    --quiet \
    --no-align \
    --tuples-only \
    --field-separator='|' \
    "$@"
}

echo "==> Preflight: drop_max_days_per_year"
echo "    Container: ${CONTAINER_NAME}"
echo "    Database:  ${DATABASE_NAME}"
echo

echo "--- 1. Affected leave_type_configs rows -----------------------------"
AFFECTED_COUNT=$(run_sql -c 'SELECT COUNT(*) FROM "leave_type_configs" WHERE "maxDaysPerYear" IS NOT NULL;')
echo "    rows with non-null maxDaysPerYear: ${AFFECTED_COUNT}"
echo

if [ "${AFFECTED_COUNT}" = "0" ]; then
  echo "    No rows carry a cap. The migration will not lose data."
  echo "    Backup table will still be created for completeness."
fi

echo "--- 2. Distinct affected tuples -------------------------------------"
run_sql -c 'SELECT id, code, name, "maxDaysPerYear" FROM "leave_type_configs" WHERE "maxDaysPerYear" IS NOT NULL ORDER BY code;'
echo

echo "--- 3. Operational blast radius -------------------------------------"
echo "    leaves rows referencing affected types, grouped by status/year:"
run_sql -c '
  SELECT  ltc.code,
          ltc.name,
          ltc."maxDaysPerYear" AS cap,
          l."status" AS status,
          EXTRACT(YEAR FROM l."startDate")::int AS yr,
          COUNT(*) AS leave_rows,
          COALESCE(SUM(l.days), 0) AS total_days
  FROM    "leaves" l
  JOIN    "leave_type_configs" ltc ON ltc.id = l.leave_type_id
  WHERE   ltc."maxDaysPerYear" IS NOT NULL
  GROUP   BY ltc.code, ltc.name, ltc."maxDaysPerYear", l."status", yr
  ORDER   BY ltc.code, yr, status;
'
echo

echo "--- 4. Uniform-balance coverage cross-check -------------------------"
echo "    For each affected type, does a LeaveBalance exist for this year"
echo "    and next year? Zero counts mean dropping the cap leaves users"
echo "    unbounded for that (type, year) until an allocation is seeded."
run_sql -c '
  WITH affected AS (
    SELECT id, code, name, "maxDaysPerYear"
    FROM   "leave_type_configs"
    WHERE  "maxDaysPerYear" IS NOT NULL
  ),
  target_years AS (
    SELECT EXTRACT(YEAR FROM now())::int AS yr
    UNION ALL
    SELECT EXTRACT(YEAR FROM now())::int + 1
  )
  SELECT  a.code,
          a.name,
          a."maxDaysPerYear" AS cap,
          ty.yr,
          COUNT(lb.id) FILTER (WHERE lb."userId" IS NULL)     AS global_balances,
          COUNT(lb.id) FILTER (WHERE lb."userId" IS NOT NULL) AS user_balances
  FROM    affected a
  CROSS   JOIN target_years ty
  LEFT    JOIN "leave_balances" lb
          ON lb."leaveTypeId" = a.id AND lb."year" = ty.yr
  GROUP   BY a.code, a.name, a."maxDaysPerYear", ty.yr
  ORDER   BY a.code, ty.yr;
'
echo

echo "--- 5. Create backup table & snapshot rows --------------------------"
docker exec -i "${CONTAINER_NAME}" psql \
  -U "${DATABASE_USER}" \
  -d "${DATABASE_NAME}" \
  -v ON_ERROR_STOP=1 \
  --quiet <<'SQL'
BEGIN;

CREATE TABLE IF NOT EXISTS "leave_type_configs_max_days_backup_20260523" (
  id               TEXT      PRIMARY KEY,
  code             TEXT      NOT NULL,
  name             TEXT      NOT NULL,
  "maxDaysPerYear" INTEGER,
  snapshot_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Snapshot ALL rows (not only non-null) so restore can reconstruct exact
-- prior state without ambiguity. Idempotent via ON CONFLICT DO NOTHING:
-- re-running the script over a partial snapshot does not corrupt it.
INSERT INTO "leave_type_configs_max_days_backup_20260523" (id, code, name, "maxDaysPerYear")
SELECT id, code, name, "maxDaysPerYear"
FROM   "leave_type_configs"
ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON "leave_type_configs_max_days_backup_20260523" FROM PUBLIC;

DO $$
DECLARE
  src BIGINT;
  dst BIGINT;
BEGIN
  SELECT COUNT(*) INTO src FROM "leave_type_configs";
  SELECT COUNT(*) INTO dst FROM "leave_type_configs_max_days_backup_20260523";
  IF src <> dst THEN
    RAISE EXCEPTION 'Backup row count mismatch: src=%, dst=%', src, dst;
  END IF;
END $$;

COMMIT;
SQL

BACKUP_COUNT=$(run_sql -c "SELECT COUNT(*) FROM \"${BACKUP_TABLE}\";")
SOURCE_COUNT=$(run_sql -c 'SELECT COUNT(*) FROM "leave_type_configs";')

echo "    leave_type_configs rows:                       ${SOURCE_COUNT}"
echo "    ${BACKUP_TABLE} rows: ${BACKUP_COUNT}"

if [ "${BACKUP_COUNT}" != "${SOURCE_COUNT}" ]; then
  echo
  echo "!! Backup row count does not match source. ABORTING — do NOT run"
  echo "!! prisma migrate deploy. Investigate the discrepancy first."
  exit 1
fi

echo
echo "==> Preflight OK. Backup table is committed and matches source."
echo "    Next step (operator action):"
echo
echo "      docker compose --env-file .env.production \\"
echo "        exec api pnpm --filter database exec prisma migrate deploy"
echo
echo "    Post-migration assertions: see Wave 0 brief §5 (staging rehearsal"
echo "    checklist) — the same steps apply to prod."
echo
echo "    Rollback if needed:"
echo "      docker exec -i ${CONTAINER_NAME} psql -U ${DATABASE_USER} \\"
echo "        -d ${DATABASE_NAME} -f /opt/orchestra/scripts/db/rollback-drop-max-days-per-year.sql"
