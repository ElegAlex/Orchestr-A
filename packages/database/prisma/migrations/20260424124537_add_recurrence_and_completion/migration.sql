-- AlterTable
ALTER TABLE "predefined_task_assignments" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "completionStatus" TEXT NOT NULL DEFAULT 'NOT_DONE',
ADD COLUMN     "notApplicableReason" TEXT;

-- AlterTable
ALTER TABLE "predefined_task_recurring_rules" ADD COLUMN     "monthlyDayOfMonth" INTEGER,
ADD COLUMN     "monthlyOrdinal" INTEGER,
ADD COLUMN     "recurrenceType" TEXT NOT NULL DEFAULT 'WEEKLY',
ALTER COLUMN "dayOfWeek" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "predefined_task_assignments_date_userId_idx" ON "predefined_task_assignments"("date", "userId");

-- CreateIndex
CREATE INDEX "predefined_task_assignments_completionStatus_date_idx" ON "predefined_task_assignments"("completionStatus", "date");

-- AddForeignKey
ALTER TABLE "predefined_task_assignments" ADD CONSTRAINT "predefined_task_assignments_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
