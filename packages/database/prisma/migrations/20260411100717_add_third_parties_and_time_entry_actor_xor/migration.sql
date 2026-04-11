-- ============================================================================
-- Migration: add_third_parties_and_time_entry_actor_xor
-- Introduit ThirdParty, tables de liaison, et étend TimeEntry avec
-- thirdPartyId + declaredById + contrainte XOR stricte userId ⊕ thirdPartyId.
-- SQL manuel — ne PAS relancer `prisma migrate dev` après édition.
-- Rollback plan documenté : docs/rollbacks/20260411100717_add_third_parties.md
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PRÉ-CHECKS DÉFENSIFS : échouer bruyamment si l'état initial est inattendu
-- ----------------------------------------------------------------------------

-- 1. time_entries.userId doit exister et être NOT NULL au départ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries'
      AND column_name = 'userId'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Pre-check failed: time_entries.userId must exist and be NOT NULL before this migration';
  END IF;
END $$;

-- 2. Les nouvelles colonnes ne doivent pas déjà exister
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'thirdPartyId'
  ) THEN
    RAISE EXCEPTION 'Pre-check failed: time_entries.thirdPartyId already exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'declaredById'
  ) THEN
    RAISE EXCEPTION 'Pre-check failed: time_entries.declaredById already exists';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. CreateEnum ThirdPartyType
-- ----------------------------------------------------------------------------
CREATE TYPE "ThirdPartyType" AS ENUM ('EXTERNAL_PROVIDER', 'INTERNAL_NON_USER', 'LEGAL_ENTITY');

-- ----------------------------------------------------------------------------
-- 2. CreateTable third_parties
-- ----------------------------------------------------------------------------
CREATE TABLE "third_parties" (
  "id"               TEXT NOT NULL,
  "type"             "ThirdPartyType" NOT NULL,
  "organizationName" TEXT NOT NULL,
  "contactFirstName" TEXT,
  "contactLastName"  TEXT,
  "contactEmail"     TEXT,
  "notes"            TEXT,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdById"      TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "third_parties_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "third_parties_type_isActive_idx"    ON "third_parties"("type", "isActive");
CREATE INDEX "third_parties_organizationName_idx" ON "third_parties"("organizationName");

ALTER TABLE "third_parties"
  ADD CONSTRAINT "third_parties_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 3. CreateTable task_third_party_assignees
-- ----------------------------------------------------------------------------
CREATE TABLE "task_third_party_assignees" (
  "id"            TEXT NOT NULL,
  "taskId"        TEXT NOT NULL,
  "thirdPartyId"  TEXT NOT NULL,
  "assignedById"  TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_third_party_assignees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_third_party_assignees_taskId_thirdPartyId_key"
  ON "task_third_party_assignees"("taskId", "thirdPartyId");
CREATE INDEX "task_third_party_assignees_taskId_idx"       ON "task_third_party_assignees"("taskId");
CREATE INDEX "task_third_party_assignees_thirdPartyId_idx" ON "task_third_party_assignees"("thirdPartyId");

ALTER TABLE "task_third_party_assignees"
  ADD CONSTRAINT "task_third_party_assignees_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_third_party_assignees"
  ADD CONSTRAINT "task_third_party_assignees_thirdPartyId_fkey"
  FOREIGN KEY ("thirdPartyId") REFERENCES "third_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_third_party_assignees"
  ADD CONSTRAINT "task_third_party_assignees_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 4. CreateTable project_third_party_members
-- ----------------------------------------------------------------------------
CREATE TABLE "project_third_party_members" (
  "id"            TEXT NOT NULL,
  "projectId"     TEXT NOT NULL,
  "thirdPartyId"  TEXT NOT NULL,
  "allocation"    INTEGER,
  "assignedById"  TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_third_party_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_third_party_members_projectId_thirdPartyId_key"
  ON "project_third_party_members"("projectId", "thirdPartyId");
CREATE INDEX "project_third_party_members_projectId_idx"    ON "project_third_party_members"("projectId");
CREATE INDEX "project_third_party_members_thirdPartyId_idx" ON "project_third_party_members"("thirdPartyId");

ALTER TABLE "project_third_party_members"
  ADD CONSTRAINT "project_third_party_members_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_third_party_members"
  ADD CONSTRAINT "project_third_party_members_thirdPartyId_fkey"
  FOREIGN KEY ("thirdPartyId") REFERENCES "third_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_third_party_members"
  ADD CONSTRAINT "project_third_party_members_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 5. Étendre time_entries : nouvelles colonnes nullable, backfill, contraintes
-- ----------------------------------------------------------------------------

-- 5a. Ajouter les colonnes nouvelles en nullable temporairement
ALTER TABLE "time_entries" ADD COLUMN "thirdPartyId" TEXT;
ALTER TABLE "time_entries" ADD COLUMN "declaredById" TEXT;

-- 5b. Backfill : declaredById = userId pour toutes les entries existantes
UPDATE "time_entries" SET "declaredById" = "userId";

-- 5c. Vérifier que le backfill est complet (aucun NULL résiduel)
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "time_entries" WHERE "declaredById" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % rows with NULL declaredById', null_count;
  END IF;
END $$;

-- 5d. Passer declaredById en NOT NULL
ALTER TABLE "time_entries" ALTER COLUMN "declaredById" SET NOT NULL;

-- 5e. Rendre userId nullable (anciennement NOT NULL)
ALTER TABLE "time_entries" ALTER COLUMN "userId" DROP NOT NULL;

-- 5f. FK vers third_parties
ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_thirdPartyId_fkey"
  FOREIGN KEY ("thirdPartyId") REFERENCES "third_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5g. FK declaredBy vers users
ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_declaredById_fkey"
  FOREIGN KEY ("declaredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5h. Contrainte XOR : exactement un de (userId, thirdPartyId) non null
ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_actor_xor_check"
  CHECK (
    ("userId" IS NOT NULL AND "thirdPartyId" IS NULL)
    OR ("userId" IS NULL AND "thirdPartyId" IS NOT NULL)
  );

-- 5i. Indexes
CREATE INDEX "time_entries_userId_date_idx"       ON "time_entries"("userId", "date");
CREATE INDEX "time_entries_thirdPartyId_date_idx" ON "time_entries"("thirdPartyId", "date");
CREATE INDEX "time_entries_declaredById_idx"      ON "time_entries"("declaredById");
CREATE INDEX "time_entries_projectId_date_idx"    ON "time_entries"("projectId", "date");
CREATE INDEX "time_entries_taskId_idx"            ON "time_entries"("taskId");

COMMIT;
