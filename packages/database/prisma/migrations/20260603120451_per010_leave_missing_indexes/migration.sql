-- CreateIndex
CREATE INDEX "leaves_userId_startDate_idx" ON "leaves"("userId", "startDate");

-- CreateIndex
CREATE INDEX "leaves_status_startDate_idx" ON "leaves"("status", "startDate");

-- CreateIndex
CREATE INDEX "leaves_userId_leave_type_id_startDate_idx" ON "leaves"("userId", "leave_type_id", "startDate");
