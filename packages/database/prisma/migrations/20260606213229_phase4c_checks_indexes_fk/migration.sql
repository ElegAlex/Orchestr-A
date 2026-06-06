-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actorId_fkey";

-- CreateIndex
CREATE INDEX "audit_logs_created_at_id_desc_idx" ON "audit_logs"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "predefined_task_assignments_userId_idx" ON "predefined_task_assignments"("userId");

-- CreateIndex
CREATE INDEX "telework_schedules_date_userId_idx" ON "telework_schedules"("date", "userId");

-- AddForeignKey
-- DAT-028 — audit_logs.actorId FK: ON UPDATE was CASCADE (asymmetric vs ON DELETE
-- NO ACTION); a users.id rotation would cascade-mutate immutable audit rows. Now
-- NO ACTION on both edges.
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------------
-- DAT-024 / SA-DAT-008 / SA-DAT-009 — events recurrence range bounds.
-- (Prisma PSL cannot express CHECK constraints; raw SQL, ignored by drift.)
-- ---------------------------------------------------------------------------
ALTER TABLE "events"
  ADD CONSTRAINT "events_recurrenceDay_ck" CHECK ("recurrenceDay" IS NULL OR "recurrenceDay" BETWEEN 0 AND 6);
ALTER TABLE "events"
  ADD CONSTRAINT "events_recurrenceWeekInterval_ck" CHECK ("recurrenceWeekInterval" IS NULL OR "recurrenceWeekInterval" >= 1);

-- ---------------------------------------------------------------------------
-- DAT-027 / SA-DAT-008 — telework_recurring_rules.dayOfWeek bounds.
-- (predefined_task_recurring_rules already covered by 20260605201203.)
-- ---------------------------------------------------------------------------
ALTER TABLE "telework_recurring_rules"
  ADD CONSTRAINT "telework_recurring_rules_dayofweek_ck" CHECK ("dayOfWeek" BETWEEN 0 AND 6);

-- ---------------------------------------------------------------------------
-- DAT-029 — documents.contentSha256 must be 64-char lowercase hex (or NULL).
-- ---------------------------------------------------------------------------
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_contentSha256_ck" CHECK ("contentSha256" IS NULL OR "contentSha256" ~ '^[0-9a-f]{64}$');

-- ---------------------------------------------------------------------------
-- SA-DAT-010 — startTime/endTime ordering. The format guard regex
-- ^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$ ADMITS single-digit hours ('9:05'), so a raw
-- string compare is wrong ('9:05' > '17:00' lexically). lpad to 5 chars zero-pads
-- the hour ('9:05'->'09:05') making the comparison correct. NULL-tolerant.
-- ---------------------------------------------------------------------------
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_time_order_ck" CHECK ("startTime" IS NULL OR "endTime" IS NULL OR lpad("endTime", 5, '0') >= lpad("startTime", 5, '0'));
ALTER TABLE "events"
  ADD CONSTRAINT "events_time_order_ck" CHECK ("startTime" IS NULL OR "endTime" IS NULL OR lpad("endTime", 5, '0') >= lpad("startTime", 5, '0'));
ALTER TABLE "predefined_tasks"
  ADD CONSTRAINT "predefined_tasks_time_order_ck" CHECK ("startTime" IS NULL OR "endTime" IS NULL OR lpad("endTime", 5, '0') >= lpad("startTime", 5, '0'));

-- ---------------------------------------------------------------------------
-- SA-DAT-011 — project_members date ordering (endDate >= startDate; NULL-tolerant).
-- ---------------------------------------------------------------------------
ALTER TABLE "project_members"
  ADD CONSTRAINT "project_members_dates_ck" CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate");
