-- CreateIndex
CREATE INDEX "tasks_endDate_idx" ON "tasks"("endDate");

-- CreateIndex
CREATE INDEX "tasks_startDate_idx" ON "tasks"("startDate");

-- CreateIndex
CREATE INDEX "tasks_milestoneId_idx" ON "tasks"("milestoneId");

-- CreateIndex
CREATE INDEX "tasks_epicId_idx" ON "tasks"("epicId");

-- CreateIndex
CREATE INDEX "tasks_projectId_status_idx" ON "tasks"("projectId", "status");
