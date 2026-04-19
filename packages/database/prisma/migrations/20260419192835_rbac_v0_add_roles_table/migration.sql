-- ============================================================================
-- V0 RBAC refactor — création table `roles` + ajout users.role_id (nullable)
-- + seed des 26 templates système + backfill users.role_id depuis enum legacy
-- ============================================================================
-- Conforme contract-03 §3 (étapes 1-4) + contract-02 LEGACY_ROLE_MIGRATION.
-- Idempotent : INSERT ... ON CONFLICT DO NOTHING ; UPDATE ... WHERE role_id IS NULL.
-- Anciennes tables role_configs/permissions/role_permissions CONSERVÉES (drop V4).
-- ============================================================================

-- ─── 1. Schema (additif) ───────────────────────────────────────────────────

-- AlterTable : ajout users.role_id nullable (devient NOT NULL en V4)
ALTER TABLE "users" ADD COLUMN     "roleId" TEXT;

-- CreateTable : table roles unifiée
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");
CREATE INDEX "roles_templateKey_idx" ON "roles"("templateKey");
CREATE INDEX "roles_isDefault_idx" ON "roles"("isDefault");

ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 2. Seed des 26 rôles templates système ───────────────────────────────
-- code = templateKey. isSystem=TRUE pour les 26. isDefault=TRUE uniquement
-- pour BASIC_USER (rôle par défaut nouvel utilisateur — remplace l'actuel
-- `@default(CONTRIBUTEUR)` sur User.role lors de la transition V4).
-- Idempotent via ON CONFLICT (code) DO NOTHING.

INSERT INTO "roles" (id, code, label, "templateKey", "isSystem", "isDefault", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'ADMIN', 'Administrateur', 'ADMIN', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'ADMIN_DELEGATED', 'Directeur adjoint', 'ADMIN_DELEGATED', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'PORTFOLIO_MANAGER', 'Manager de portefeuille', 'PORTFOLIO_MANAGER', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'MANAGER', 'Manager', 'MANAGER', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'MANAGER_PROJECT_FOCUS', 'Manager projet', 'MANAGER_PROJECT_FOCUS', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'MANAGER_HR_FOCUS', 'Chef de service', 'MANAGER_HR_FOCUS', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'PROJECT_LEAD', 'Chef de projet', 'PROJECT_LEAD', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'PROJECT_LEAD_JUNIOR', 'Chef de projet junior', 'PROJECT_LEAD_JUNIOR', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'TECHNICAL_LEAD', 'Référent technique', 'TECHNICAL_LEAD', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'PROJECT_CONTRIBUTOR', 'Contributeur projet', 'PROJECT_CONTRIBUTOR', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'PROJECT_CONTRIBUTOR_LIGHT', 'Contributeur projet junior', 'PROJECT_CONTRIBUTOR_LIGHT', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'FUNCTIONAL_REFERENT', 'Référent fonctionnel', 'FUNCTIONAL_REFERENT', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'HR_OFFICER', 'Gestionnaire RH', 'HR_OFFICER', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'HR_OFFICER_LIGHT', 'Assistant RH', 'HR_OFFICER_LIGHT', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'THIRD_PARTY_MANAGER', 'Gestionnaire prestataires', 'THIRD_PARTY_MANAGER', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'CONTROLLER', 'Contrôleur de gestion', 'CONTROLLER', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'BUDGET_ANALYST', 'Analyste budgétaire', 'BUDGET_ANALYST', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'DATA_ANALYST', 'Analyste données', 'DATA_ANALYST', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'IT_SUPPORT', 'Technicien support', 'IT_SUPPORT', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'IT_INFRASTRUCTURE', 'Équipe infrastructure', 'IT_INFRASTRUCTURE', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'OBSERVER_FULL', 'Observateur global', 'OBSERVER_FULL', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'OBSERVER_PROJECTS_ONLY', 'Sponsor projet', 'OBSERVER_PROJECTS_ONLY', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'OBSERVER_HR_ONLY', 'Audit social', 'OBSERVER_HR_ONLY', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'BASIC_USER', 'Utilisateur standard', 'BASIC_USER', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid()::text, 'EXTERNAL_PRESTATAIRE', 'Prestataire externe', 'EXTERNAL_PRESTATAIRE', TRUE, FALSE, NOW(), NOW()),
  (gen_random_uuid()::text, 'STAGIAIRE_ALTERNANT', 'Stagiaire / alternant', 'STAGIAIRE_ALTERNANT', TRUE, FALSE, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- ─── 3. Backfill users.role_id depuis enum legacy `role` ────────────────────
-- Mapping conforme LEGACY_ROLE_MIGRATION de contract-02-templates.ts.
-- Idempotent : ne touche que les users sans role_id.

UPDATE "users" u SET "roleId" = r.id
FROM "roles" r
WHERE u."roleId" IS NULL
  AND r.code = CASE u.role::TEXT
    WHEN 'ADMIN' THEN 'ADMIN'
    WHEN 'RESPONSABLE' THEN 'ADMIN_DELEGATED'
    WHEN 'MANAGER' THEN 'MANAGER'
    WHEN 'CHEF_DE_PROJET' THEN 'PROJECT_LEAD'
    WHEN 'CHARGE_DE_MISSION' THEN 'PROJECT_CONTRIBUTOR'
    WHEN 'CONSULTANT_TECHNOLOGIE_SI' THEN 'PROJECT_CONTRIBUTOR'
    WHEN 'CORRESPONDANT_FONCTIONNEL_APPLICATION' THEN 'PROJECT_CONTRIBUTOR'
    WHEN 'DEVELOPPEUR_CONCEPTEUR' THEN 'PROJECT_CONTRIBUTOR'
    WHEN 'REFERENT_TECHNIQUE' THEN 'TECHNICAL_LEAD'
    WHEN 'OBSERVATEUR' THEN 'OBSERVER_FULL'
    WHEN 'ADMINISTRATEUR_IML' THEN 'BASIC_USER'
    WHEN 'CONTRIBUTEUR' THEN 'BASIC_USER'
    WHEN 'GESTIONNAIRE_IML' THEN 'BASIC_USER'
    WHEN 'GESTIONNAIRE_PARC' THEN 'BASIC_USER'
    WHEN 'TECHNICIEN_SUPPORT' THEN 'BASIC_USER'
  END;

-- ─── 4. Vérification post-backfill — ZÉRO user avec roleId NULL ────────────
-- Si un user a un enum role inattendu (corruption, valeur hors mapping), la
-- migration échoue ici plutôt que de poursuivre silencieusement.
DO $$
DECLARE cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM "users" WHERE "roleId" IS NULL;
  IF cnt > 0 THEN
    RAISE EXCEPTION 'Migration RBAC V0 : % users sans roleId après backfill — STOP, arbitrage PO requis', cnt;
  END IF;
END $$;
