-- COR-014: Add unique constraint on (projectId, date) in project_snapshots
-- Prevents duplicate snapshots from concurrent scheduler ticks.
-- date is stored as startOfDay (midnight UTC), so this enforces one row per project per day.
-- DropIndex replaces the plain index with the unique index (subsumes it).
DROP INDEX IF EXISTS "project_snapshots_projectId_date_idx";

-- CreateIndex
CREATE UNIQUE INDEX "project_snapshots_projectId_date_key" ON "project_snapshots"("projectId", "date");
