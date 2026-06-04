-- DAT-008 / DAT-026 — full-erasure user deletion (operator decision 2026-06-04).
-- This app is NOT the SIRH of legal record, so there is no leave/time retention
-- obligation and no anonymisation/tombstone posture. A deleted user is fully
-- erased; their OWNED records (leaves, time entries, balances, memberships,
-- participations) are deleted explicitly in UsersService.hardDelete.
--
-- This migration handles the SECONDARY references only: rows where the deleted
-- user is merely an ACTOR on someone else's / shared data (declaredBy on another
-- user's time entry, createdBy/assignedBy on shared events, holidays, school
-- vacations, predefined tasks, third-party links, reset tokens). Those rows must
-- NOT be deleted when the actor leaves — only the user link is nulled. Each of
-- these 12 FKs was either Restrict (BLOCKED a legitimate deletion with P2003) or
-- Cascade (silently ORPHANED/over-deleted another user's data). They are flipped
-- to nullable + ON DELETE SET NULL.
--
-- NOT touched: users_departmentId_fkey (DAT-022, User->Department: constrains
-- DEPARTMENT deletion, never user deletion — keep Restrict) and
-- audit_logs.actorId (ON DELETE NO ACTION + OBS-002 immutability trigger — its
-- treatment under full-erasure is a pending operator compliance decision).

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_createdById_fkey";

-- DropForeignKey
ALTER TABLE "holidays" DROP CONSTRAINT "holidays_createdById_fkey";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_createdById_fkey";

-- DropForeignKey
ALTER TABLE "predefined_task_assignments" DROP CONSTRAINT "predefined_task_assignments_assignedById_fkey";

-- DropForeignKey
ALTER TABLE "predefined_task_recurring_rules" DROP CONSTRAINT "predefined_task_recurring_rules_createdById_fkey";

-- DropForeignKey
ALTER TABLE "predefined_tasks" DROP CONSTRAINT "predefined_tasks_createdById_fkey";

-- DropForeignKey
ALTER TABLE "project_third_party_members" DROP CONSTRAINT "project_third_party_members_assignedById_fkey";

-- DropForeignKey
ALTER TABLE "school_vacations" DROP CONSTRAINT "school_vacations_createdById_fkey";

-- DropForeignKey
ALTER TABLE "task_third_party_assignees" DROP CONSTRAINT "task_third_party_assignees_assignedById_fkey";

-- DropForeignKey
ALTER TABLE "telework_recurring_rules" DROP CONSTRAINT "telework_recurring_rules_createdById_fkey";

-- DropForeignKey
ALTER TABLE "third_parties" DROP CONSTRAINT "third_parties_createdById_fkey";

-- DropForeignKey
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_declaredById_fkey";

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "holidays" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "predefined_task_assignments" ALTER COLUMN "assignedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "predefined_task_recurring_rules" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "predefined_tasks" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "project_third_party_members" ALTER COLUMN "assignedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "school_vacations" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "task_third_party_assignees" ALTER COLUMN "assignedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "telework_recurring_rules" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "third_parties" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "time_entries" ALTER COLUMN "declaredById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_parties" ADD CONSTRAINT "third_parties_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_third_party_assignees" ADD CONSTRAINT "task_third_party_assignees_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_third_party_members" ADD CONSTRAINT "project_third_party_members_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_vacations" ADD CONSTRAINT "school_vacations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telework_recurring_rules" ADD CONSTRAINT "telework_recurring_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predefined_tasks" ADD CONSTRAINT "predefined_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predefined_task_assignments" ADD CONSTRAINT "predefined_task_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predefined_task_recurring_rules" ADD CONSTRAINT "predefined_task_recurring_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
