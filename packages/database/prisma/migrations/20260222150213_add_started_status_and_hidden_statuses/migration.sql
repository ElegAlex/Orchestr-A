-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'STARTED';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "hiddenStatuses" "TaskStatus"[] DEFAULT ARRAY[]::"TaskStatus"[];
