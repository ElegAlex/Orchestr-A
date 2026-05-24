-- DAT-005 — Convert Float (double precision) to NUMERIC(p,s) for HR/precision-sensitive columns
--
-- The companion safety-snapshot migration (20260524100000_dat005_backup_float_columns)
-- captured the current Float values into per-table backup tables BEFORE this conversion
-- runs. See scripts/db/rollback-dat005-decimal-conversion.sql to restore those values.
--
-- Precision/scale rationale (per column)
-- ---------------------------------------
--   time_entries.hours         → NUMERIC(5,2)   max 999.99 hours / row (single TimeEntry).
--                                                Daily entries cap well under 24h; 999.99
--                                                leaves three orders of magnitude of headroom.
--   leaves.days                → NUMERIC(6,2)   max 9999.99 days / leave row. A single
--                                                leave never exceeds a year (~366d); the
--                                                wider scale absorbs any future multi-year
--                                                accommodation without another migration.
--   leave_balances.totalDays   → NUMERIC(6,2)   same domain as Leave.days; balances may
--                                                aggregate years of carryover.
--   tasks.estimatedHours       → NUMERIC(5,2)   same domain as TimeEntry.hours.
--   project_snapshots.progress → NUMERIC(5,2)   percentage 0.00–100.00; surplus headroom
--                                                preserved so an analytics consumer that
--                                                stores e.g. weighted scores >100 isn't
--                                                broken by a future widening.
--
-- No monetary columns exist in this schema; the audit's "money" hint does not apply.
--
-- Conversion is in-place via ALTER COLUMN … TYPE … USING (… ::numeric). Postgres rewrites
-- the table; for the dataset size in this product this is acceptable as a one-shot
-- maintenance-window migration. If you ever need a zero-downtime variant, the pattern
-- is: add a new NUMERIC column, dual-write, backfill, switch reads, drop old column.

ALTER TABLE "time_entries"
  ALTER COLUMN "hours" TYPE NUMERIC(5,2)
  USING ("hours"::numeric(5,2));

ALTER TABLE "leaves"
  ALTER COLUMN "days" TYPE NUMERIC(6,2)
  USING ("days"::numeric(6,2));

ALTER TABLE "leave_balances"
  ALTER COLUMN "totalDays" TYPE NUMERIC(6,2)
  USING ("totalDays"::numeric(6,2));

ALTER TABLE "tasks"
  ALTER COLUMN "estimatedHours" TYPE NUMERIC(5,2)
  USING ("estimatedHours"::numeric(5,2));

ALTER TABLE "project_snapshots"
  ALTER COLUMN "progress" TYPE NUMERIC(5,2)
  USING ("progress"::numeric(5,2));
