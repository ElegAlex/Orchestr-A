-- CreateIndex
CREATE INDEX "leaves_userId_status_idx" ON "leaves"("userId", "status");

-- CreateIndex
CREATE INDEX "leaves_validator_id_status_idx" ON "leaves"("validator_id", "status");

-- CreateIndex
CREATE INDEX "leaves_startDate_endDate_idx" ON "leaves"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "leaves_leave_type_id_status_idx" ON "leaves"("leave_type_id", "status");
