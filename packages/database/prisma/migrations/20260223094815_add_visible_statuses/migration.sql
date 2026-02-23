-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "visibleStatuses" TEXT[] DEFAULT ARRAY[]::TEXT[];
