-- DAT-018 — TaskDependency cycle prevention at the DB level.
--
-- TaskDependency(taskId → dependsOnTaskId) models "task depends on dependsOnTask".
-- At the DB level NOTHING stopped two pathological shapes:
--   (a) the 1-hop self-loop  A → A;
--   (b) longer cycles        A → B, B → A  or  A → B, B → C, C → A.
-- Either makes a topological ordering of the dependency graph impossible, so any
-- scheduler / "can this task start?" rollup that walks the graph loops forever or
-- returns nonsense.
--
-- The service layer (apps/api/src/tasks/tasks.service.ts addDependency →
-- checkCircularDependency) ALREADY rejects both shapes with a 400 BadRequest. This
-- migration is the Phase-3 DB FLOOR for the same invariant: it closes the path the
-- service can't guard — a direct SQL write, an admin console, or a future code path
-- that doesn't route through addDependency. Defense-in-depth, not a replacement; the
-- service check stays (see DAT-018 Learnings).
--
-- Two complementary guards:
--
--   Item 1 — CHECK "task_dependencies_no_self_ck" ("taskId" <> "dependsOnTaskId").
--     Blocks the 1-hop self-loop. A plain single-row predicate; cheapest possible.
--
--   Item 2 — BEFORE INSERT OR UPDATE trigger "task_dependencies_no_cycle_trg"
--     (function task_dependencies_check_cycle). Blocks multi-hop cycles, which a CHECK
--     cannot express (it needs to walk the rest of the graph). For the candidate edge
--     (NEW.taskId → NEW.dependsOnTaskId) it walks the EXISTING graph FORWARD starting
--     at NEW."dependsOnTaskId" (i.e. "what does the thing I'd depend on itself depend
--     on, transitively?"). If that traversal reaches NEW."taskId", then NEW.taskId is
--     already (transitively) depended-upon by NEW.dependsOnTaskId, so adding the edge
--     would close a cycle → RAISE EXCEPTION (P0001) carrying the identifier
--     `task_dependencies_no_cycle`.
--
-- Why the self-loop is left to the CHECK, not the trigger: for a 1-hop self-loop
-- (NEW.taskId = NEW.dependsOnTaskId = X) the forward walk seeds from X's EXISTING
-- outgoing edges. In a valid DAG X is never reachable from itself, so the reachable
-- set never contains X → the trigger stays silent → the CHECK fires and surfaces
-- 23514 with `task_dependencies_no_self_ck`. The two guards therefore never both fire
-- on the same row, and each negative test asserts a distinct, documented signal.
--
-- UPDATE correctness (NOT just INSERT): during a BEFORE UPDATE the OLD row is still
-- physically present in the table, so a naive forward walk would traverse the very
-- edge being replaced and false-reject a legitimate re-point (e.g. UPDATE (A→B) to
-- (A→C): the stale A→B row would make B look reachable). Both CTE arms therefore
-- exclude the row under modification via `(TG_OP = 'INSERT' OR <id> <> OLD.id)`, so
-- the walk reflects the POST-update graph minus the new edge (which is represented by
-- NEW directly). `TG_OP` is the discriminator because on INSERT the OLD record's
-- FIELDS are NULL but OLD itself is not a NULL composite.
--
-- The recursive CTE uses UNION (not UNION ALL): Postgres dedups by row and therefore
-- terminates even if the existing graph somehow already contains a cycle (it can't,
-- given this trigger, but the guard is free). Columns are text (Prisma String → text),
-- so no uuid[] cast is involved.
--
-- Pre-flight (dev DB :5433, 2026-05-27): task_dependencies holds 0 rows — 0 direct
-- self-loops, 0 multi-hop cycles — so both ADD CONSTRAINT and the trigger attach
-- cleanly with nothing to reject. No in-migration cleanup was needed.
--
-- Neither a CHECK nor a trigger is expressible in the Prisma 6 schema DSL, so this
-- migration is hand-authored raw SQL (same pattern as 20260527120000 dat003/004,
-- 20260527140000 dat013, 20260527150000 dat014). schema.prisma is intentionally
-- unchanged.

-- Item 1: self-loop CHECK.
ALTER TABLE "task_dependencies"
  ADD CONSTRAINT "task_dependencies_no_self_ck"
  CHECK ("taskId" <> "dependsOnTaskId");

-- Item 2: multi-hop cycle-prevention trigger.
CREATE OR REPLACE FUNCTION task_dependencies_check_cycle()
  RETURNS TRIGGER AS $$
DECLARE
  creates_cycle BOOLEAN;
BEGIN
  -- Walk the existing graph forward from the edge's dependsOnTaskId. If NEW.taskId
  -- is reachable, the new edge would close a cycle. On UPDATE, exclude the OLD row
  -- (it is being replaced by NEW and must not be traversed).
  WITH RECURSIVE reachable(node) AS (
    SELECT "dependsOnTaskId"
    FROM "task_dependencies"
    WHERE "taskId" = NEW."dependsOnTaskId"
      AND (TG_OP = 'INSERT' OR "id" <> OLD."id")
    UNION
    SELECT td."dependsOnTaskId"
    FROM "task_dependencies" td
    JOIN reachable r ON td."taskId" = r.node
    WHERE TG_OP = 'INSERT' OR td."id" <> OLD."id"
  )
  SELECT EXISTS (SELECT 1 FROM reachable WHERE node = NEW."taskId") INTO creates_cycle;

  IF creates_cycle THEN
    RAISE EXCEPTION
      'task_dependencies_no_cycle: dependency % -> % would create a circular dependency',
      NEW."taskId", NEW."dependsOnTaskId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_dependencies_no_cycle_trg
  BEFORE INSERT OR UPDATE ON "task_dependencies"
  FOR EACH ROW
  EXECUTE FUNCTION task_dependencies_check_cycle();
