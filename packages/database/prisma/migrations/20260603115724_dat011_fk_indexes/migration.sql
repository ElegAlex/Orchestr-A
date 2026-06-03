-- CreateIndex
CREATE INDEX "comments_taskId_idx" ON "comments"("taskId");

-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");

-- CreateIndex
CREATE INDEX "departments_managerId_idx" ON "departments"("managerId");

-- CreateIndex
CREATE INDEX "documents_projectId_idx" ON "documents"("projectId");

-- CreateIndex
CREATE INDEX "documents_uploadedBy_idx" ON "documents"("uploadedBy");

-- CreateIndex
CREATE INDEX "epics_projectId_idx" ON "epics"("projectId");

-- CreateIndex
CREATE INDEX "events_projectId_idx" ON "events"("projectId");

-- CreateIndex
CREATE INDEX "events_createdById_idx" ON "events"("createdById");

-- CreateIndex
CREATE INDEX "events_parentEventId_idx" ON "events"("parentEventId");

-- CreateIndex
CREATE INDEX "holidays_createdById_idx" ON "holidays"("createdById");

-- CreateIndex
CREATE INDEX "leave_validation_delegates_delegator_id_idx" ON "leave_validation_delegates"("delegator_id");

-- CreateIndex
CREATE INDEX "leave_validation_delegates_delegate_id_idx" ON "leave_validation_delegates"("delegate_id");

-- CreateIndex
CREATE INDEX "leaves_validated_by_id_idx" ON "leaves"("validated_by_id");

-- CreateIndex
CREATE INDEX "milestones_projectId_idx" ON "milestones"("projectId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_createdById_idx" ON "password_reset_tokens"("createdById");

-- CreateIndex
CREATE INDEX "predefined_task_recurring_rules_predefinedTaskId_idx" ON "predefined_task_recurring_rules"("predefinedTaskId");

-- CreateIndex
CREATE INDEX "predefined_task_recurring_rules_userId_idx" ON "predefined_task_recurring_rules"("userId");

-- CreateIndex
CREATE INDEX "predefined_task_recurring_rules_createdById_idx" ON "predefined_task_recurring_rules"("createdById");

-- CreateIndex
CREATE INDEX "predefined_tasks_createdById_idx" ON "predefined_tasks"("createdById");

-- CreateIndex
CREATE INDEX "projects_createdById_idx" ON "projects"("createdById");

-- CreateIndex
CREATE INDEX "projects_managerId_idx" ON "projects"("managerId");

-- CreateIndex
CREATE INDEX "projects_sponsorId_idx" ON "projects"("sponsorId");

-- CreateIndex
CREATE INDEX "projects_archivedById_idx" ON "projects"("archivedById");

-- CreateIndex
CREATE INDEX "services_managerId_idx" ON "services"("managerId");
