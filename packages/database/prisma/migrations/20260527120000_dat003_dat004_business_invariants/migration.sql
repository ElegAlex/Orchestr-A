-- DAT-003 + DAT-004 — defense-in-depth business invariants as DB-level CHECK constraints.
--
-- Bundle rationale: same source file (schema.prisma), same SQL mechanism (CHECK),
-- same witness path (TST-DB-001 *.int.spec.ts). Today these invariants live only in
-- DTO/Zod validators — a buggy service path or a direct admin SQL fix can write
-- inverted date ranges or out-of-range numbers. These CHECKs are the second line.
--
-- CHECK constraints are not expressible in the Prisma 6 schema DSL, so this migration
-- is hand-authored raw SQL (same pattern as 20260525190000 immutability, 20260525200000
-- dat007, 20260526120000 dat021). schema.prisma is intentionally unchanged.
--
-- Pre-flight (dev DB, 2026-05-27): 0 violating rows for all 14 predicates, so every
-- ADD CONSTRAINT validates cleanly against existing data.
--
-- NULL semantics: a CHECK passes when its expression is NULL (SQL three-valued logic),
-- so nullable columns (projects/epics/telework_recurring_rules date ranges,
-- project_members.allocation, events.recurrenceEndDate) need no explicit IS NULL guard.

-- ---------------------------------------------------------------------------
-- DAT-003 — date-range ordering: end >= start (and recurrenceEndDate >= date).
-- ---------------------------------------------------------------------------
ALTER TABLE "leaves"
  ADD CONSTRAINT "leaves_dates_ck" CHECK ("endDate" >= "startDate");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_dates_ck" CHECK ("endDate" >= "startDate");

ALTER TABLE "epics"
  ADD CONSTRAINT "epics_dates_ck" CHECK ("endDate" >= "startDate");

ALTER TABLE "telework_recurring_rules"
  ADD CONSTRAINT "telework_recurring_rules_dates_ck" CHECK ("endDate" >= "startDate");

-- leave_validation_delegates maps startDate/endDate to physical columns start_date/end_date.
ALTER TABLE "leave_validation_delegates"
  ADD CONSTRAINT "leave_validation_delegates_dates_ck" CHECK (end_date >= start_date);

ALTER TABLE "school_vacations"
  ADD CONSTRAINT "school_vacations_dates_ck" CHECK ("endDate" >= "startDate");

-- events is the column-name variant: the recurrence end must not precede the event date.
ALTER TABLE "events"
  ADD CONSTRAINT "events_recurrence_end_ck" CHECK ("recurrenceEndDate" >= "date");

-- ---------------------------------------------------------------------------
-- DAT-004 — numeric bounds.
-- ---------------------------------------------------------------------------
ALTER TABLE "leave_balances"
  ADD CONSTRAINT "leave_balances_totaldays_ck" CHECK ("totalDays" >= 0);

-- Strict > 0: calculateLeaveDays() is floored at 0.5 globally, so a positive
-- minimum is the product invariant; a 0-day leave is always a bug.
ALTER TABLE "leaves"
  ADD CONSTRAINT "leaves_days_ck" CHECK ("days" > 0);

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_progress_ck" CHECK ("progress" BETWEEN 0 AND 100);

ALTER TABLE "epics"
  ADD CONSTRAINT "epics_progress_ck" CHECK ("progress" BETWEEN 0 AND 100);

ALTER TABLE "predefined_tasks"
  ADD CONSTRAINT "predefined_tasks_weight_ck" CHECK ("weight" BETWEEN 1 AND 5);

ALTER TABLE "project_members"
  ADD CONSTRAINT "project_members_allocation_ck" CHECK ("allocation" BETWEEN 0 AND 100);

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_size_ck" CHECK ("size" >= 0);
