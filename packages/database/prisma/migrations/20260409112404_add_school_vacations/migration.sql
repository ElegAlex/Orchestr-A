-- CreateEnum
CREATE TYPE "SchoolVacationZone" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "SchoolVacationSource" AS ENUM ('IMPORT', 'MANUAL');

-- CreateTable
CREATE TABLE "school_vacations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "zone" "SchoolVacationZone" NOT NULL,
    "year" INTEGER NOT NULL,
    "source" "SchoolVacationSource" NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_vacations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_vacations_startDate_endDate_idx" ON "school_vacations"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "school_vacations_zone_year_idx" ON "school_vacations"("zone", "year");

-- CreateIndex
CREATE UNIQUE INDEX "school_vacations_name_zone_year_key" ON "school_vacations"("name", "zone", "year");

-- AddForeignKey
ALTER TABLE "school_vacations" ADD CONSTRAINT "school_vacations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
