-- DAT-032 + DAT-033 — defense-in-depth completion of the DAT-004 numeric-bound family.
--
-- Bundle rationale: same source file (schema.prisma), same SQL mechanism (single-column
-- CHECK), same witness path (TST-DB-001 *.int.spec.ts). Two columns that DAT-004 left
-- uncovered — Subtask.position fell between DAT-004's Description and Suggested-fix list,
-- and TimeEntry.hours was scoped out of COR-022's service-level cap by Invariant 1
-- (no DB CHECK inside that commit). Both close that gap.
--
-- CHECK constraints are not expressible in the Prisma 6 DSL, so this migration is
-- hand-authored raw SQL (same pattern as 20260527120000_dat003_dat004_business_invariants).
-- schema.prisma is intentionally unchanged.
--
-- Pre-flight (dev DB, 2026-05-28):
--   subtasks.position < 0                              → 0 rows
--   time_entries: hours < 0                            → 0 rows
--   time_entries: hours > 24                           → 0 rows
--   time_entries: 0 < hours < 0.25 (partial-hour class)→ 0 rows
--   time_entries: hours = 0 (legitimate dismissals)    → 101 rows  (must be admitted)
-- Both ADD CONSTRAINTs validate cleanly against existing data.
--
-- Floor predicate rationale (DAT-033): the DTO bound `@Min(0.25) @Max(24)` applies
-- only when `!isDismissal` (see CreateTimeEntryDto `@ValidateIf`), and TimeTrackingService
-- creates dismissal rows with `hours: 0`. The legitimate persisted range is therefore
-- {0} ∪ [0.25, 24], NOT [0.25, 24]. The DB floor must admit hours = 0 — `hours >= 0
-- AND hours <= 24` is the correct superset. Encoding 0.25 at the DB layer would reject
-- legitimate dismissals (101 rows in dev today).
--
-- Out of scope: the COR-022 per-(userId, date) aggregate cap is cross-row and NOT
-- expressible as a per-row CHECK. The non-transactional read-then-write TOCTOU race
-- (two concurrent same-day requests both reading pre-state and both committing past
-- 24h) is NOT closed by this migration. Fully closing the aggregate invariant under
-- concurrency requires a serializable transaction or a DB trigger — a heavier, separate
-- decision; do not fold it into this CHECK. Same residual applies to DAT-034's
-- third-party path.

-- ---------------------------------------------------------------------------
-- DAT-032 — Subtask.position >= 0.
-- ---------------------------------------------------------------------------
ALTER TABLE "subtasks"
  ADD CONSTRAINT "subtasks_position_ck" CHECK ("position" >= 0);

-- ---------------------------------------------------------------------------
-- DAT-033 — TimeEntry.hours within [0, 24] (single-row floor + ceiling).
-- ---------------------------------------------------------------------------
ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_hours_ck" CHECK ("hours" >= 0 AND "hours" <= 24);
