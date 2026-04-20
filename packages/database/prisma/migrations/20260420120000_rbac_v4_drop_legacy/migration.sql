-- RBAC V4 — Drop legacy enum + tables + colonne users.role
-- Voir backlog/rbac-refactor/contract/contract-03-type-model.md §9
-- ACTION IRRÉVERSIBLE — Assurer un backup avant déploiement prod.

-- 1. Drop FK contrainte role_permissions
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_permissionId_fkey";
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_roleConfigId_fkey";

-- 2. Drop tables legacy
DROP TABLE IF EXISTS "role_permissions";
DROP TABLE IF EXISTS "permissions";
DROP TABLE IF EXISTS "role_configs";

-- 3. Drop colonne users.role
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";

-- 4. Drop enum type
DROP TYPE IF EXISTS "Role";
