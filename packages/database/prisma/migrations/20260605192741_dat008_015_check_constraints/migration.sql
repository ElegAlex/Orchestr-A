-- DAT-008 — project_third_party_members.allocation must be a 0–100 percentage.
-- Column is nullable; allow NULL but reject out-of-range integers at the DB layer
-- (the service-layer validation was the only guard before).
ALTER TABLE "project_third_party_members"
  ADD CONSTRAINT "project_third_party_members_allocation_ck"
  CHECK ("allocation" IS NULL OR ("allocation" >= 0 AND "allocation" <= 100));

-- DAT-015 — project_snapshots numeric sanity (mirrors DAT-003/004 column hygiene):
-- progress is a 0–100 percentage; tasksDone/tasksTotal are non-negative counts.
ALTER TABLE "project_snapshots"
  ADD CONSTRAINT "project_snapshots_progress_ck"
  CHECK ("progress" >= 0 AND "progress" <= 100);
ALTER TABLE "project_snapshots"
  ADD CONSTRAINT "project_snapshots_task_counts_ck"
  CHECK ("tasksDone" >= 0 AND "tasksTotal" >= 0);
