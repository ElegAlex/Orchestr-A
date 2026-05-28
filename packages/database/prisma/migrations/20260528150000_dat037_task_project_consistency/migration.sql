-- DAT-037 — cross-table task.projectId consistency with its epic/milestone parent.
--
-- DAT-017 closed the orphan combination (epic/milestone set without projectId) via a
-- single-row CHECK. DAT-037 closes the cross-row equality: task.projectId MUST equal
-- the parent's projectId when the task is linked to an epic or milestone. Single-row
-- CHECKs can't express cross-table predicates, so this is a trigger pair.
--
-- DESIGN CHOICE — Option A (operator-decided, see BACKLOG DAT-037 Learnings):
--   1. Task-side BEFORE INSERT/UPDATE trigger: REJECT (RAISE) if NEW.projectId differs
--      from epic.projectId (when epicId set) or milestone.projectId (when milestoneId
--      set). Closes drift at the write side.
--   2. Parent-side AFTER UPDATE OF projectId triggers on `epics` AND `milestones`:
--      cascade the new projectId to dependent tasks. Without these, a legitimate
--      "move an epic between projects" workflow would deadlock at the DB
--      (task-side BEFORE rejects every direction).
--
-- The pair is non-deadlocking by construction: when the AFTER trigger on the parent
-- fires, the parent row already holds NEW.projectId (AFTER trigger sees post-row-
-- update state). The cascade UPDATE on tasks then fires the task-side BEFORE trigger,
-- which reads the parent's now-NEW.projectId via SELECT — agrees with the task's
-- being-set NEW.projectId → accepted.
--
-- Topology pre-flight (dev, 2026-05-28):
--   - tasks with BOTH epicId AND milestoneId set: 435.
--   - of those, where epic.projectId <> milestone.projectId: 0 — the "competing
--     parents" sub-halt criterion does NOT fire on actual data; the trigger pair
--     naturally rejects any future task that would land in disagreeing parents.
--   - drift task.projectId vs epic.projectId: 0; vs milestone.projectId: 0. No
--     in-migration cleanup needed.
--
-- DEADLOCK EDGE CASE (carried into Learnings + Operational notes): if a task has BOTH
-- epicId AND milestoneId from different projects (impossible in current data but
-- newly preventable by these triggers), the parent-side cascade on one parent would
-- push the task's projectId to disagree with the OTHER parent — the task-side BEFORE
-- on the cascade UPDATE then rejects → cascade fails → parent UPDATE aborts. Operator
-- workflow to move both: update milestone first (cascade to tasks), THEN update epic
-- (cascade re-aligns — accepts because milestone now also matches). Documented in the
-- deploy doc's Operational notes.
--
-- AUDIT IMPLICATIONS (documented for Cour des Comptes): the parent-side CASCADE
-- silently rewrites N task rows in one DDL fire. Today this is invariant maintenance
-- (the task's "true" project IS the parent's), but a future auditor may want a row in
-- audit_logs for each affected task. NOT added here — the existing OBS-002 trigger
-- pipeline doesn't cover system-derived consistency writes (only user mutations
-- through the app), and adding it now would be scope creep. Operator should expect
-- the cascade to be silent at the audit_logs layer; the change is fully derivable
-- from the parent's audit row (which DOES exist for epic/milestone updates).
--
-- Neither a CHECK nor a trigger is expressible in the Prisma 6 DSL, so this migration
-- is hand-authored raw SQL (DAT-014/DAT-018/DAT-038 precedent). schema.prisma stays
-- untouched.

-- ---------------------------------------------------------------------------
-- Item 1 — task-side BEFORE INSERT/UPDATE: REJECT mismatch.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tasks_check_project_consistency()
  RETURNS TRIGGER AS $$
DECLARE
  epic_project_id text;
  milestone_project_id text;
BEGIN
  -- Layer-of-rejection contract: when NEW.projectId IS NULL but a parent is set,
  -- DAT-017's CHECK `tasks_parent_requires_project_ck` owns that case and surfaces
  -- 23514 with its constraint name. Skip the comparison here so we don't shadow
  -- DAT-017 (the DAT-017 spec asserts the 23514 signature). The cross-table
  -- equality this trigger enforces is meaningful only when both sides exist.
  IF NEW."epicId" IS NOT NULL AND NEW."projectId" IS NOT NULL THEN
    SELECT "projectId" INTO epic_project_id FROM "epics" WHERE id = NEW."epicId";
    IF NEW."projectId" IS DISTINCT FROM epic_project_id THEN
      RAISE EXCEPTION
        'tasks_project_matches_epic: task projectId % does not match epic % projectId %',
        NEW."projectId", NEW."epicId", epic_project_id;
    END IF;
  END IF;

  IF NEW."milestoneId" IS NOT NULL AND NEW."projectId" IS NOT NULL THEN
    SELECT "projectId" INTO milestone_project_id FROM "milestones" WHERE id = NEW."milestoneId";
    IF NEW."projectId" IS DISTINCT FROM milestone_project_id THEN
      RAISE EXCEPTION
        'tasks_project_matches_milestone: task projectId % does not match milestone % projectId %',
        NEW."projectId", NEW."milestoneId", milestone_project_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_project_consistency_trg
  BEFORE INSERT OR UPDATE ON "tasks"
  FOR EACH ROW
  EXECUTE FUNCTION tasks_check_project_consistency();

-- ---------------------------------------------------------------------------
-- Item 2a — epic AFTER UPDATE OF projectId: CASCADE to dependent tasks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION epics_cascade_projectid_to_tasks()
  RETURNS TRIGGER AS $$
BEGIN
  IF NEW."projectId" IS DISTINCT FROM OLD."projectId" THEN
    UPDATE "tasks"
      SET "projectId" = NEW."projectId"
      WHERE "epicId" = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER epics_cascade_projectid_trg
  AFTER UPDATE OF "projectId" ON "epics"
  FOR EACH ROW
  EXECUTE FUNCTION epics_cascade_projectid_to_tasks();

-- ---------------------------------------------------------------------------
-- Item 2b — milestone AFTER UPDATE OF projectId: CASCADE to dependent tasks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION milestones_cascade_projectid_to_tasks()
  RETURNS TRIGGER AS $$
BEGIN
  IF NEW."projectId" IS DISTINCT FROM OLD."projectId" THEN
    UPDATE "tasks"
      SET "projectId" = NEW."projectId"
      WHERE "milestoneId" = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER milestones_cascade_projectid_trg
  AFTER UPDATE OF "projectId" ON "milestones"
  FOR EACH ROW
  EXECUTE FUNCTION milestones_cascade_projectid_to_tasks();
