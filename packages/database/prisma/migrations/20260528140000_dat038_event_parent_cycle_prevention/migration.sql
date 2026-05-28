-- DAT-038 — Event.parentEventId cycle prevention (DAT-018 analog on a self-FK column).
--
-- Event.parentEventId is a single nullable self-FK (Event? @relation("EventRecurrence"),
-- onDelete: Cascade) used by the recurrence model. Pre-DAT-038 nothing at the DB stopped
-- two pathological shapes:
--   (a) the 1-hop self-loop  X.parentEventId = X.id
--   (b) longer cycles        A.parent=B, B.parent=A   or   A→B→C→A
-- Either makes the recurrence parent chain non-terminating, so any walk up the parent
-- chain (recurrence expansion, "is this the master event?" rollups) loops forever.
--
-- Unlike DAT-018 (TaskDependency — a join table whose rows are edges), this guard is on
-- a single nullable column on the events node table: the walk goes node → node via the
-- parent FK, not via separate edge rows. There is also NO service-side cycle guard
-- (events.service.ts has no events_check_*_cycle equivalent) — the trigger is the only
-- line of defense, contrast DAT-018 which is a DB floor on top of a service-layer 400.
-- So even though this is "defense-in-depth", a follow-up COR-style typed exception for
-- a controller-path INSERT/UPDATE hitting the trigger raw is plausible (left for a later
-- arc; the trigger is the load-bearing guarantee).
--
-- Two complementary guards:
--
--   Item 1 — CHECK "events_parent_no_self_ck"  ("parentEventId" IS DISTINCT FROM "id").
--     Blocks the 1-hop self-loop. `IS DISTINCT FROM` tolerates the common NULL case
--     (most events have no parent — dev: 0 of 195 events parented), so the NULL row
--     passes cleanly. A column = column compare would NULL-out under three-valued logic
--     and also pass, but `IS DISTINCT FROM` makes the intent explicit and survives any
--     future tightening of CHECK semantics.
--
--   Item 2 — BEFORE INSERT OR UPDATE trigger "events_parent_no_cycle_trg"
--     (function events_check_parent_cycle). Blocks multi-hop cycles. For the candidate
--     edge (NEW.id → NEW.parentEventId — "this event's parent is parentEventId") walk
--     the EXISTING graph UPWARD starting at NEW.parentEventId, following each row's
--     own parentEventId. If that walk reaches NEW.id, then NEW.id is already (transitively)
--     an ancestor of NEW.parentEventId — adding the edge would close a cycle → RAISE
--     EXCEPTION (P0001) carrying the identifier `events_parent_no_cycle`.
--
--     Short-circuit: NEW.parentEventId IS NULL → no chain to walk, no possible cycle.
--     Most events have no parent (dev: 0/195), so this path is the hot one.
--
-- Why the self-loop is left to the CHECK, not the trigger: for a 1-hop self-loop
-- (NEW.parentEventId = NEW.id) the walk seeds at id=NEW.id and reads its parentEventId
-- field from the table. In a valid acyclic forest NEW.id is never reachable from
-- itself via OTHER rows' parent fields → the reachable set is exactly NEW.parentEventId's
-- own chain, which does not loop back → the trigger stays silent → the CHECK fires and
-- surfaces 23514 with `events_parent_no_self_ck`. The two guards never both fire on the
-- same row, and each negative test asserts a distinct, documented signal.
--
-- UPDATE correctness (NOT just INSERT): on a BEFORE UPDATE the OLD row is still
-- physically present, so a naive walk would re-traverse OLD's stale parentEventId.
-- Both CTE arms therefore exclude the row under modification via
-- `(TG_OP = 'INSERT' OR e.id <> OLD."id")`, so the walk reflects the post-update graph
-- minus the new edge (which is represented by NEW directly). `TG_OP` is the discriminator
-- because on INSERT OLD's fields are NULL but OLD itself is not a NULL composite.
-- Carries DAT-018's load-bearing learning #3 verbatim.
--
-- The recursive CTE uses UNION (not UNION ALL): Postgres dedups by row and therefore
-- terminates even if the existing graph somehow already contains a cycle (it can't,
-- given this trigger, but the guard is free). Columns are text (Prisma String → text),
-- so no uuid[] cast is involved.
--
-- Pre-flight (dev DB :5433, 2026-05-28): events holds 195 rows; 0 self-loops
-- (parentEventId = id), 0 multi-hop cycles (recursive-CTE scan), 0 of 195 events
-- parented at all → both ADD CONSTRAINT and the trigger attach cleanly with nothing
-- to reject. No in-migration cleanup was needed.
--
-- Neither a CHECK nor a trigger is expressible in the Prisma 6 schema DSL, so this
-- migration is hand-authored raw SQL (DAT-018 precedent). schema.prisma is intentionally
-- unchanged.

-- Item 1: self-loop CHECK.
ALTER TABLE "events"
  ADD CONSTRAINT "events_parent_no_self_ck"
  CHECK ("parentEventId" IS DISTINCT FROM "id");

-- Item 2: multi-hop cycle-prevention trigger.
CREATE OR REPLACE FUNCTION events_check_parent_cycle()
  RETURNS TRIGGER AS $$
DECLARE
  creates_cycle BOOLEAN;
BEGIN
  -- Short-circuit: no parent → no chain → no possible cycle. This is the dominant
  -- hot path (dev: 0/195 events parented).
  IF NEW."parentEventId" IS NULL THEN
    RETURN NEW;
  END IF;

  -- Walk the existing parent chain UPWARD starting from NEW.parentEventId, following
  -- each ancestor row's own parentEventId. If NEW.id appears in that chain, the edge
  -- (NEW.id → NEW.parentEventId) would close a cycle. The OLD-row exclusion keeps the
  -- walk on the post-update graph (DAT-018 learning #3).
  WITH RECURSIVE ancestors(node) AS (
    SELECT e."parentEventId"
    FROM "events" e
    WHERE e."id" = NEW."parentEventId"
      AND e."parentEventId" IS NOT NULL
      AND (TG_OP = 'INSERT' OR e."id" <> OLD."id")
    UNION
    SELECT e."parentEventId"
    FROM "events" e
    JOIN ancestors a ON e."id" = a.node
    WHERE e."parentEventId" IS NOT NULL
      AND (TG_OP = 'INSERT' OR e."id" <> OLD."id")
  )
  SELECT EXISTS (SELECT 1 FROM ancestors WHERE node = NEW."id") INTO creates_cycle;

  IF creates_cycle THEN
    RAISE EXCEPTION
      'events_parent_no_cycle: event % parented to % would create a cyclic recurrence chain',
      NEW."id", NEW."parentEventId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_parent_no_cycle_trg
  BEFORE INSERT OR UPDATE ON "events"
  FOR EACH ROW
  EXECUTE FUNCTION events_check_parent_cycle();
