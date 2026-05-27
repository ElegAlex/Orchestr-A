-- DAT-012 — Promote closed free-string value sets to native Postgres enums.
--
-- Hand-authored (not `migrate dev`-generated): the dev DB carries pre-existing
-- `_dat005_backup_*` drift that aborts non-interactive `migrate dev` (see
-- TOOL-DBSYNC-001); this migration is applied via `migrate deploy`, which
-- ignores drift. Mirrors the DAT-003/DAT-004 hand-authored precedent.
--
-- Scope: 6 columns → 5 enums. ProjectMember.role stays String (free-form
-- institutional labels — bailed, filed session-derived). AuditLog.action /
-- entityType stay String (documented canonical codes — see
-- docs/audit/canonical-action-codes.md).
--
-- Defaults must be DROPped before ALTER TYPE (a text default cannot implicitly
-- cast to the new enum type), then re-SET with the enum literal.

-- CreateEnum
CREATE TYPE "PredefinedTaskDuration" AS ENUM ('HALF_DAY', 'FULL_DAY', 'TIME_SLOT');
CREATE TYPE "DayPeriod" AS ENUM ('MORNING', 'AFTERNOON', 'FULL_DAY');
CREATE TYPE "AssignmentCompletionStatus" AS ENUM ('NOT_DONE', 'IN_PROGRESS', 'DONE', 'NOT_APPLICABLE');
CREATE TYPE "RecurrenceType" AS ENUM ('WEEKLY', 'MONTHLY_ORDINAL', 'MONTHLY_DAY');
CREATE TYPE "AppSettingsCategory" AS ENUM ('display', 'general', 'planning');

-- AlterTable: predefined_tasks.defaultDuration (no default)
ALTER TABLE "predefined_tasks"
  ALTER COLUMN "defaultDuration" TYPE "PredefinedTaskDuration"
  USING ("defaultDuration"::"PredefinedTaskDuration");

-- AlterTable: predefined_task_assignments.period (no default) + completionStatus (default 'NOT_DONE')
ALTER TABLE "predefined_task_assignments"
  ALTER COLUMN "period" TYPE "DayPeriod"
  USING ("period"::"DayPeriod");

ALTER TABLE "predefined_task_assignments" ALTER COLUMN "completionStatus" DROP DEFAULT;
ALTER TABLE "predefined_task_assignments"
  ALTER COLUMN "completionStatus" TYPE "AssignmentCompletionStatus"
  USING ("completionStatus"::"AssignmentCompletionStatus");
ALTER TABLE "predefined_task_assignments" ALTER COLUMN "completionStatus" SET DEFAULT 'NOT_DONE';

-- AlterTable: predefined_task_recurring_rules.period (no default) + recurrenceType (default 'WEEKLY')
ALTER TABLE "predefined_task_recurring_rules"
  ALTER COLUMN "period" TYPE "DayPeriod"
  USING ("period"::"DayPeriod");

ALTER TABLE "predefined_task_recurring_rules" ALTER COLUMN "recurrenceType" DROP DEFAULT;
ALTER TABLE "predefined_task_recurring_rules"
  ALTER COLUMN "recurrenceType" TYPE "RecurrenceType"
  USING ("recurrenceType"::"RecurrenceType");
ALTER TABLE "predefined_task_recurring_rules" ALTER COLUMN "recurrenceType" SET DEFAULT 'WEEKLY';

-- AlterTable: app_settings.category (default 'general')
ALTER TABLE "app_settings" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "app_settings"
  ALTER COLUMN "category" TYPE "AppSettingsCategory"
  USING ("category"::"AppSettingsCategory");
ALTER TABLE "app_settings" ALTER COLUMN "category" SET DEFAULT 'general';
