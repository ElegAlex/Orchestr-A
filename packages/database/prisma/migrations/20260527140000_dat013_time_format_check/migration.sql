-- DAT-013 — time-of-day format as a DB-level CHECK constraint.
--
-- Six columns store a time of day as free String today (Task.startTime/endTime,
-- Event.startTime/endTime, PredefinedTask.startTime/endTime). The audit named
-- '9:5', '25:99' and '' as accepted-but-invalid. The HH:MM format is validated
-- at the DTO layer (class-validator @Matches), but a buggy service path or a
-- direct admin SQL write bypasses it. These CHECKs are the second line —
-- same defense-in-depth shape as DAT-003/004 (the DB rejects malformed,
-- independent of the application validators).
--
-- Mechanism rationale (option (c), String + CHECK — see DAT-013 Learnings):
-- option (a) @db.Time requires a DateTime Prisma scalar, which maps to a JS
-- Date in this repo's generated client (verified: DateTime fields are `Date`),
-- cascading string→Date through 6 DTO fields, planning-export's `split(':')`,
-- the predefined-tasks service, the frontend (`localeCompare`, `<input type=time>`)
-- and packages/types — >20 adjacent edits, a scope-creep bail. The codebase does
-- no minutes-since-midnight arithmetic, so option (b) Int is unjustified. (c) has
-- zero TS surface change and delivers the same invariant: the DB rejects malformed.
--
-- CHECK constraints are not expressible in the Prisma 6 schema DSL, so this
-- migration is hand-authored raw SQL (same pattern as 20260527120000 dat003/dat004).
-- schema.prisma is intentionally unchanged (the columns stay `String?`).
--
-- Regex `^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$` is the LENIENT pattern: it is exactly
-- the Task/Event DTO regex and a strict superset of the PredefinedTask DTO regex
-- (`^([01]\d|2[0-3]):[0-5]\d$`). Chosen so nothing the application layer accepts is
-- rejected by the DB (no app-accepts/DB-rejects mismatch); per-table DTOs may stay
-- stricter. It rejects all three audit-named invalids ('9:5', '25:99', '') plus
-- '24:00', '12:60' and leading/trailing whitespace.
--
-- Pre-flight (dev DB, 2026-05-27): the only non-null values are 4 well-formed
-- HH:MM rows in predefined_tasks (07:30/16:00/09:30/17:15); tasks and events have
-- zero non-null time values. Every ADD CONSTRAINT validates instantly.
--
-- NULL semantics: a CHECK passes when its expression is NULL (SQL three-valued
-- logic), so these nullable columns need no explicit IS NULL guard — only present
-- values are format-checked.

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_startTime_format_ck" CHECK ("startTime" ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_endTime_format_ck" CHECK ("endTime" ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "events"
  ADD CONSTRAINT "events_startTime_format_ck" CHECK ("startTime" ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "events"
  ADD CONSTRAINT "events_endTime_format_ck" CHECK ("endTime" ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "predefined_tasks"
  ADD CONSTRAINT "predefined_tasks_startTime_format_ck" CHECK ("startTime" ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "predefined_tasks"
  ADD CONSTRAINT "predefined_tasks_endTime_format_ck" CHECK ("endTime" ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');
