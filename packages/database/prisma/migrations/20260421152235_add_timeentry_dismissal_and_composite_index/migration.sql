-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "isDismissal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "time_entries_taskId_userId_idx" ON "time_entries"("taskId", "userId");
