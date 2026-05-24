-- DAT-005 — Safety snapshot (Float → Decimal precision migration)
--
-- Purpose
--   Runs BEFORE the conversion migration (20260524100100_dat005_convert_float_to_decimal).
--   Captures the current Float values of every column targeted by the conversion into
--   per-table backup snapshots so an operator can restore exactly what was on disk if
--   the conversion proves lossy in production.
--
-- Why a separate migration
--   Prisma applies each migration atomically. If the backup and the ALTER ran in the
--   same migration and the ALTER failed mid-transaction, the backup would be rolled
--   back along with everything else. Splitting the snapshot into an earlier file
--   guarantees the backup tables persist independently of the conversion outcome.
--
-- Columns captured
--   - time_entries.hours           (Float → Decimal(5,2))
--   - leaves.days                  (Float → Decimal(6,2))
--   - leave_balances."totalDays"   (Float → Decimal(6,2))
--   - tasks."estimatedHours"       (Float → Decimal(5,2))
--   - project_snapshots.progress   (Float → Decimal(5,2))
--
-- Restoration
--   See scripts/db/rollback-dat005-decimal-conversion.sql for the operator-facing
--   restore procedure. The backup tables stay around indefinitely (small, append-only
--   snapshot, no PII beyond row ids); drop them once you're confident the conversion
--   is stable in prod.

-- Each backup table mirrors (id, <float column>, captured_at). We capture id so the
-- restore is idempotent (UPDATE … WHERE id = …), and captured_at so multiple safety
-- snapshots can be distinguished should we ever re-run the procedure.

CREATE TABLE IF NOT EXISTS "_dat005_backup_time_entries_hours" (
  id           TEXT PRIMARY KEY,
  hours        DOUBLE PRECISION NOT NULL,
  captured_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);
INSERT INTO "_dat005_backup_time_entries_hours" (id, hours)
SELECT id, hours FROM "time_entries"
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS "_dat005_backup_leaves_days" (
  id           TEXT PRIMARY KEY,
  days         DOUBLE PRECISION NOT NULL,
  captured_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);
INSERT INTO "_dat005_backup_leaves_days" (id, days)
SELECT id, days FROM "leaves"
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS "_dat005_backup_leave_balances_total_days" (
  id            TEXT PRIMARY KEY,
  "totalDays"   DOUBLE PRECISION NOT NULL,
  captured_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);
INSERT INTO "_dat005_backup_leave_balances_total_days" (id, "totalDays")
SELECT id, "totalDays" FROM "leave_balances"
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS "_dat005_backup_tasks_estimated_hours" (
  id                TEXT PRIMARY KEY,
  "estimatedHours"  DOUBLE PRECISION,
  captured_at       TIMESTAMPTZ      NOT NULL DEFAULT now()
);
INSERT INTO "_dat005_backup_tasks_estimated_hours" (id, "estimatedHours")
SELECT id, "estimatedHours" FROM "tasks"
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS "_dat005_backup_project_snapshots_progress" (
  id           TEXT PRIMARY KEY,
  progress     DOUBLE PRECISION NOT NULL,
  captured_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);
INSERT INTO "_dat005_backup_project_snapshots_progress" (id, progress)
SELECT id, progress FROM "project_snapshots"
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE "_dat005_backup_time_entries_hours"            IS 'DAT-005 safety snapshot of time_entries.hours (Float) before Decimal conversion.';
COMMENT ON TABLE "_dat005_backup_leaves_days"                   IS 'DAT-005 safety snapshot of leaves.days (Float) before Decimal conversion.';
COMMENT ON TABLE "_dat005_backup_leave_balances_total_days"     IS 'DAT-005 safety snapshot of leave_balances.totalDays (Float) before Decimal conversion.';
COMMENT ON TABLE "_dat005_backup_tasks_estimated_hours"         IS 'DAT-005 safety snapshot of tasks.estimatedHours (Float) before Decimal conversion.';
COMMENT ON TABLE "_dat005_backup_project_snapshots_progress"    IS 'DAT-005 safety snapshot of project_snapshots.progress (Float) before Decimal conversion.';
