-- Migration: Remove STARTED status from TaskStatus enum
-- Step 1: Migrate all tasks with STARTED status to IN_PROGRESS
UPDATE "tasks" SET "status" = 'IN_PROGRESS' WHERE "status" = 'STARTED';

-- Step 2: Remove STARTED from hiddenStatuses arrays in projects
UPDATE "projects"
SET "hiddenStatuses" = array_remove("hiddenStatuses"::"text"[], 'STARTED')::"TaskStatus"[]
WHERE 'STARTED' = ANY("hiddenStatuses"::text[]);

-- Step 3: Remove STARTED from the TaskStatus enum
-- Create new enum without STARTED
CREATE TYPE "TaskStatus_new" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED');

-- Drop defaults before type change (PostgreSQL requires this)
ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;

-- Alter columns to use new enum
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'TODO'::"TaskStatus_new";

-- Update hiddenStatuses column in projects
ALTER TABLE "projects" ALTER COLUMN "hiddenStatuses" DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "hiddenStatuses" TYPE "TaskStatus_new"[] USING ("hiddenStatuses"::text[]::"TaskStatus_new"[]);
ALTER TABLE "projects" ALTER COLUMN "hiddenStatuses" SET DEFAULT '{}';

-- Drop old enum and rename new one
DROP TYPE "TaskStatus";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
