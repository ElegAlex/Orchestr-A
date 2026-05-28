-- DAT-036 — Client.name globally unique (defense-in-depth, DAT-016 follow-up).
--
-- DAT-016 closed the missing-UNIQUE failure mode for Department.name and the
-- composite Service(departmentId, name) but its literal Suggested-fix list
-- omitted Client.name (named in DAT-016's Description as the third instance).
-- This migration closes that gap with the same mechanism: a UNIQUE INDEX
-- byte-equivalent to `prisma migrate dev` output (Prisma `<table>_<col>_key`
-- naming) so a future drift-clean `migrate dev` sees no diff. schema.prisma
-- DOES carry the matching `@unique` (DSL-expressible — DAT-016 precedent),
-- and the redundant plain `@@index([name])` is dropped (a unique index already
-- serves the lookup).
--
-- Pre-flight (dev, 2026-05-28): 0 duplicate names across 200 clients;
-- CREATE UNIQUE INDEX validates clean.
--
-- TOCTOU note: the app's `clients.service.ts` pre-check via findFirst is racy.
-- This unique index closes the race-window 23505; mapping that 23505 to a
-- clean 409 ConflictException is COR-034's third surface (added in same arc).

-- DropIndex (the existing non-unique name index becomes redundant: the unique
-- index covers the same lookup).
DROP INDEX "clients_name_idx";

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");
