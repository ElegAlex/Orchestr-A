-- DAT-017 — task parent-consistency invariant as a DB-level CHECK constraint.
--
-- Task.projectId is nullable to allow legitimate transverse tasks (meetings,
-- cross-cutting work) that belong to no project. But the schema also lets epicId
-- and milestoneId be set INDEPENDENTLY of projectId, so the row combination
-- `projectId IS NULL AND (epicId IS NOT NULL OR milestoneId IS NOT NULL)` —
-- a task linked to an epic/milestone yet to no project — was accepted, which is
-- semantically impossible (an epic/milestone always belongs to exactly one project,
-- both FK columns being NOT NULL). The create DTO does NOT tie the three fields
-- together (projectId/epicId/milestoneId are each @IsOptional with no cross-field
-- @ValidateIf), so nothing rejected the orphan combination before this CHECK.
--
-- This CHECK is the single-row invariant only: it guarantees that if a task hangs
-- off an epic or milestone, it also names a project. It does NOT enforce that the
-- named project is the SAME one the epic/milestone belongs to — that is a
-- cross-table consistency property requiring a trigger (lookup into epics/milestones
-- per write), filed separately as DAT-037 (the audit's permissive "Consider trigger
-- validating epic.projectId = task.projectId").
--
-- CHECK constraints are not expressible in the Prisma 6 schema DSL, so this
-- migration is hand-authored raw SQL (same pattern as 20260527120000 dat003/004,
-- 20260527140000 dat013). schema.prisma is intentionally unchanged.
--
-- Pre-flight (dev DB, 2026-05-27): 0 violating rows, so the ADD CONSTRAINT validates
-- cleanly against existing data.
--
-- NULL semantics: the predicate is fully NON-NULL-valued, so no three-valued-logic
-- surprise — the legitimate all-null transverse task (projectId/epicId/milestoneId
-- all NULL) satisfies the left disjunct's negation cleanly:
--   projectId IS NOT NULL  → FALSE
--   (epicId IS NULL AND milestoneId IS NULL) → TRUE
--   FALSE OR TRUE → TRUE → row accepted.

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_parent_requires_project_ck"
  CHECK ("projectId" IS NOT NULL OR ("epicId" IS NULL AND "milestoneId" IS NULL));
