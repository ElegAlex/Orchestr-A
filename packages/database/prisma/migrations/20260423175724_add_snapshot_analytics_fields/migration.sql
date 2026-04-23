-- AlterTable
ALTER TABLE "project_snapshots" ADD COLUMN     "milestonesOverdue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "milestonesReached" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "milestonesUpcoming" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tasksBlocked" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tasksInProgress" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "project_snapshots_projectId_date_idx" ON "project_snapshots"("projectId", "date");

-- CreateIndex
CREATE INDEX "project_snapshots_date_idx" ON "project_snapshots"("date");
