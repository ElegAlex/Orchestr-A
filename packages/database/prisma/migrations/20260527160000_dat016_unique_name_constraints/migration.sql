-- DAT-016 — enforce name uniqueness at the DB level (defense-in-depth).
--
-- Two departments or two services-within-a-department could be created with
-- identical names: the UI showed indistinguishable duplicates and RBAC scope
-- decisions pivot on department/service membership, so name ambiguity is a
-- security concern. The application layer already pre-checks uniqueness
-- (departments.service.ts findFirst({name}); services.service.ts
-- findFirst({name, departmentId})), but that check is racy (TOCTOU) and is
-- bypassed by any direct-SQL write. These indexes are the DB-level floor.
--
-- Semantics: Department.name is GLOBALLY unique; Service.name is unique PER
-- department (composite), NOT globally — two services named "Support" in two
-- different departments remain legal. This matches the app's existing
-- { name, departmentId } pre-check.
--
-- DSL-expressible: schema.prisma carries @unique / @@unique. This SQL is
-- byte-equivalent to what `prisma migrate dev` generates (CREATE UNIQUE INDEX,
-- Prisma <table>_<col[_col]>_key naming) so a future drift-clean `migrate dev`
-- sees no diff. Hand-authored because the dev DB is migrate-dev-blocked by the
-- pre-existing _dat005_backup_* drift (TOOL-DBSYNC-001); applied via
-- `migrate deploy`, which ignores drift.

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "services_departmentId_name_key" ON "services"("departmentId", "name");
