# Migration runbook — `drop_max_days_per_year` + `self_approved_and_global_balance_unique`

**Date prepared:** 2026-05-23
**Operator:** ab@alexandre-berge.fr
**Target:** prod VPS (orchestra)
**Migrations to apply (in order):**

1. `20260523124537_drop_max_days_per_year`
2. `20260523171000_self_approved_and_global_balance_unique`

The first is irreversible at the column level. The second is reversible
(`DROP COLUMN selfApproved` and `DROP INDEX leave_balances_global_unique`)
but should be considered append-only.

---

## 0. Pre-flight checklist (run on operator workstation)

- [ ] Latest `master` on the VPS: `ssh orchestra@vps "cd /opt/orchestra && git status"` reports clean working tree and `HEAD == origin/master`.
- [ ] Backup directory has space for one full DB dump: `ssh orchestra@vps "df -h /opt/orchestra/backups"`.
- [ ] App in low-traffic window. Notify users if needed.
- [ ] Second operator on standby (rollback drill, comms).

---

## 1. Capture a full DB dump

The Prisma migrations are not destructive in a way that fast-forwards (the
`leave_type_configs` column is restorable from the backup table — see step
3). But the operator should always carry a pre-migration dump in case
something else goes wrong on the same window.

```bash
ssh orchestra@vps "bash /opt/orchestra/scripts/backup-database.sh"
ssh orchestra@vps "ls -lh /opt/orchestra/backups | tail -1"
```

Expected: a fresh `orchestr-a-backup-YYYYMMDD_HHMMSS.sql` file ~few MB.

---

## 2. Pre-flight diagnostic + backup table (drop_max_days_per_year)

This is the safety wrapper for the first migration. The script runs the
Wave 0 diagnostic queries (read-only) and commits the
`leave_type_configs_max_days_backup_20260523` table in a transaction
separate from the migration (the migration cannot create its own backup —
a single Prisma migration runs atomically, so a DROP rollback would lose
the snapshot too).

```bash
ssh orchestra@vps "bash /opt/orchestra/scripts/db/preflight-drop-max-days-per-year.sh"
```

Expected output:

- **§0 Connectivity smoke check:** `psql reachable.`
- **§1 Affected rows count:** record this number — call it `N_TYPES`. Save to your notes.
- **§2 Distinct affected tuples:** verify the list against the spec (the
  feature owner should have approved exactly these types losing their
  cap). If anything unexpected appears, **STOP**.
- **§3 Blast radius:** counts of `leaves` rows pointing at affected
  types, grouped by status × year. Use this to estimate operational
  impact if the cap is silently lost.
- **§4 Uniform-balance coverage cross-check:** for each affected `(type,
year)` and current/next year, the count of global and per-user
  LeaveBalance rows. **Any row with `global_balances=0 AND
user_balances=0` is a blocker**: dropping the cap leaves users
  unbounded for that slice until an allocation is seeded. If this
  appears, seed the missing global before continuing (see step 2a).
- **§5 Backup table created and matches source.** The script will
  abort with non-zero if the row counts diverge.

Record the printed `leave_type_configs rows` count — call it `N_ROWS`.

### 2a. (Conditional) Seed missing global balances

If §4 surfaced an uncovered (type, year), provision the global balance:

```sql
-- Example: provision RTT global for 2027 at the value the operations
-- team confirmed.
docker exec -it orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod <<SQL
INSERT INTO "leave_balances" ("id", "userId", "leaveTypeId", "year", "totalDays", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, id, 2027, 25, now(), now()
FROM "leave_type_configs" WHERE code = 'RTT';
SQL
```

Re-run the preflight script (step 2) and confirm §4 is now clean.

---

## 3. Apply Prisma migrations

Both migrations land in one `prisma migrate deploy`. Prisma applies them
in timestamp order: `20260523124537_drop_max_days_per_year` runs first,
then `20260523171000_self_approved_and_global_balance_unique`.

```bash
ssh orchestra@vps "cd /opt/orchestra && docker compose --env-file .env.production exec -T api pnpm --filter database exec prisma migrate deploy"
```

Expected:

```
2 migrations found in prisma/migrations
Applying migration `20260523124537_drop_max_days_per_year`
Applying migration `20260523171000_self_approved_and_global_balance_unique`
The following migrations have been applied: …
```

If either migration fails, **DO NOT** proceed to step 4 — go to step 5
(rollback).

---

## 4. Post-migration assertions

Run from operator workstation:

```bash
ssh orchestra@vps "docker exec orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod --tuples-only --no-align -c '
SELECT
  -- 1. column maxDaysPerYear is gone
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name=''leave_type_configs'' AND column_name=''maxDaysPerYear'') AS max_days_col_count,
  -- 2. column selfApproved is present
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name=''leaves'' AND column_name=''selfApproved'') AS self_approved_col_count,
  -- 3. partial unique index is present
  (SELECT COUNT(*) FROM pg_indexes
     WHERE tablename=''leave_balances'' AND indexname=''leave_balances_global_unique'') AS global_unique_idx,
  -- 4. leave_type_configs row count unchanged
  (SELECT COUNT(*) FROM leave_type_configs) AS configs_rows,
  -- 5. backup table populated
  (SELECT COUNT(*) FROM leave_type_configs_max_days_backup_20260523) AS backup_rows,
  -- 6. _prisma_migrations now lists both migrations with non-null finished_at
  (SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name IN
     (''20260523124537_drop_max_days_per_year'', ''20260523171000_self_approved_and_global_balance_unique'')
     AND finished_at IS NOT NULL) AS applied_migrations;
'"
```

Expected: `0|1|1|N_ROWS|N_ROWS|2`.

Smoke test the API:

```bash
ssh orchestra@vps "curl -sf https://orchestra.example.fr/api/leave-types | jq 'length'"
```

Expected: same count as before the migration (the leave-types list is
unaffected).

Run the cross-year balance gating E2E smoke if practical (manual UI: log
in as ADMIN, create a Dec 30 → Jan 5 leave on CP). Expect status APPROVED
and the new "selfApproved" flag set.

---

## 5. Backfill decisions (informational — not part of the migration)

Three queries to run **after** the migration is healthy. Output goes into
the Wave 5 closeout report.

```sql
-- 5.1 Pre-Wave-3 self-approved orphans
SELECT COUNT(*) FROM leaves
  WHERE status = 'APPROVED'
    AND "selfApproved" = false
    AND "validatorId" IS NULL
    AND "createdAt" >= '2026-05-23';

-- 5.2 Historical type/leaveTypeId drift.
-- IMPORTANT: filter on `c.code IN (enum members)` — otherwise the query
-- flags rows where the config code is a custom value (ALTERNANCE,
-- FORMATION, etc.) and the service correctly persists `type=OTHER` as
-- the fall-through. Those are NOT drift.
SELECT COUNT(*) FROM leaves l
  JOIN leave_type_configs c ON c.id = l.leave_type_id
  WHERE l."type"::text != c.code
    AND l."type" IS NOT NULL
    AND c.code IN ('CP', 'RTT', 'SICK_LEAVE', 'UNPAID', 'OTHER');

-- 5.3 Affected maxDaysPerYear rows (already captured in step 2 §1)
SELECT COUNT(*) FROM leave_type_configs_max_days_backup_20260523
  WHERE "maxDaysPerYear" IS NOT NULL;
```

For 5.1 and 5.2, if the count is non-zero, decide:

- Backfill (UPDATE the rows to match the new invariant), or
- Accept the historical drift (document it in the closeout).

The migrations themselves do **not** backfill — they only close the write
path. Backfill is a separate, idempotent operator action.

---

## 6. Rollback (only if step 3 or 4 fails)

### 6.1 Roll back `self_approved_and_global_balance_unique`

```sql
docker exec -i orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -v ON_ERROR_STOP=1 <<SQL
BEGIN;
DROP INDEX IF EXISTS "leave_balances_global_unique";
ALTER TABLE "leaves" DROP COLUMN IF EXISTS "selfApproved";
DELETE FROM "_prisma_migrations"
  WHERE migration_name = '20260523171000_self_approved_and_global_balance_unique';
COMMIT;
SQL
```

### 6.2 Roll back `drop_max_days_per_year`

```bash
ssh orchestra@vps "docker exec -i orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -v ON_ERROR_STOP=1 -f /opt/orchestra/scripts/db/rollback-drop-max-days-per-year.sql"
ssh orchestra@vps "docker exec -i orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -c \"DELETE FROM \\\"_prisma_migrations\\\" WHERE migration_name = '20260523124537_drop_max_days_per_year';\""
```

After rollback, restart the API container so the Prisma client picks up
the restored schema:

```bash
ssh orchestra@vps "cd /opt/orchestra && docker compose --env-file .env.production restart api"
```

---

## 7. Cleanup (run only after a stable production run)

After at least one week of healthy operation, the backup table can be
dropped:

```sql
DROP TABLE "leave_type_configs_max_days_backup_20260523";
```

Document in this runbook (append a line to step 7) when this is done.
