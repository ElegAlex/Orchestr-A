-- CreateTable
CREATE TABLE "project_snapshots" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL,
    "tasksDone" INTEGER NOT NULL,
    "tasksTotal" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_snapshots_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
