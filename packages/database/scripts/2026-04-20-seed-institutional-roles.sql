-- =============================================================================
-- Script de migration prod — Seed des rôles institutionnels + bascule users
-- =============================================================================
--
-- Contexte : post-RBAC V4, les 39 users actifs de la DSI sont rattachés aux
-- 26 rôles système (isSystem=true) seedés au déploiement. Ce script crée
-- 15 rôles institutionnels (isSystem=false) qui portent les libellés métier
-- de la DSI CPAM92, et réaffecte chaque user au rôle institutionnel qui
-- correspond à son scope (template × service principal).
--
-- Préconditions :
--   1. Backup prod frais pris AVANT run (voir backups-prod/pre-v4/).
--   2. 39 users actifs en DB prod, répartis : 2 ADMIN, 4 MANAGER, 5
--      PROJECT_LEAD, 14 PROJECT_CONTRIBUTOR, 14 BASIC_USER.
--   3. Aucun des 15 codes cibles ne doit pré-exister dans la table `roles`.
--
-- Post-conditions (vérifiées par DO $$ en fin de transaction) :
--   - 15 nouveaux rôles isSystem=false insérés.
--   - Les 39 users actifs pointent tous vers un rôle isSystem=false.
--   - Zéro user actif sur un rôle isSystem=true.
--   - Le rollback automatique s'active si un de ces invariants casse.
--
-- Usage (à exécuter dans le conteneur postgres, transaction intégrée) :
--   docker exec -i orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod < 2026-04-20-seed-institutional-roles.sql
--
-- Idempotence : non. À exécuter une seule fois. Le DO $$ final détecte un
-- re-run partiel (codes déjà présents) et échoue.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Guard : aucun des codes cibles ne doit pré-exister
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  existing_count INT;
BEGIN
  SELECT COUNT(*) INTO existing_count FROM roles WHERE code IN (
    'ADMIN_DSI', 'ADMIN_SYSTEM',
    'MANAGER_GESTION_PARC_SUPPORT', 'MANAGER_DEV_PROJETS', 'MANAGER_CFA_FLUX', 'MANAGER_INFRA',
    'CDP_DATA_ANALYTICS', 'CDP_PROJETS', 'CDP_HABILITATIONS',
    'CONTRIB_CFA', 'CONTRIB_DEV', 'CONTRIB_FLUX', 'CONTRIB_GESTION_PARC',
    'USER_SUPPORT', 'USER_INFRASTRUCTURE'
  );
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'Pré-condition violée : % code(s) institutionnel(s) déjà en DB. Script non ré-entrant, rollback.', existing_count;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Insertion des 15 rôles institutionnels (isSystem=false)
-- -----------------------------------------------------------------------------
INSERT INTO roles (id, code, label, "templateKey", description, "isSystem", "isDefault", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'ADMIN_DSI', 'Administrateur DSI', 'ADMIN', 'Rôle institutionnel — Administrateur de la Direction des Systèmes d''Information', false, false, NOW(), NOW()),
  (gen_random_uuid(), 'ADMIN_SYSTEM', 'Administrateur système', 'ADMIN', 'Rôle institutionnel — Compte technique d''administration système', false, false, NOW(), NOW()),

  (gen_random_uuid(), 'MANAGER_GESTION_PARC_SUPPORT', 'Manager Gestion Parc et Support', 'MANAGER', 'Rôle institutionnel — Manager des services Gestion Parc et Support', false, false, NOW(), NOW()),
  (gen_random_uuid(), 'MANAGER_DEV_PROJETS', 'Manager Développement et Projets', 'MANAGER', 'Rôle institutionnel — Manager des services Développement et Projets', false, false, NOW(), NOW()),
  (gen_random_uuid(), 'MANAGER_CFA_FLUX', 'Manager CFA et Flux', 'MANAGER', 'Rôle institutionnel — Manager des services CFA et Flux', false, false, NOW(), NOW()),
  (gen_random_uuid(), 'MANAGER_INFRA', 'Manager Infrastructure', 'MANAGER', 'Rôle institutionnel — Manager du service Infrastructure', false, false, NOW(), NOW()),

  (gen_random_uuid(), 'CDP_DATA_ANALYTICS', 'Chef de projet Data Analytics', 'PROJECT_LEAD', 'Rôle institutionnel — Chef de projet dans le service Data Analytics', false, false, NOW(), NOW()),
  (gen_random_uuid(), 'CDP_PROJETS', 'Chef de projet Projets', 'PROJECT_LEAD', 'Rôle institutionnel — Chef de projet dans le service Projets', false, false, NOW(), NOW()),
  (gen_random_uuid(), 'CDP_HABILITATIONS', 'Chef de projet Habilitations', 'PROJECT_LEAD', 'Rôle institutionnel — Chef de projet dans le service Habilitations', false, false, NOW(), NOW()),

  (gen_random_uuid(), 'CONTRIB_CFA', 'Contributeur CFA', 'PROJECT_CONTRIBUTOR', 'Rôle institutionnel — Contributeur projet dans le service CFA', false, false, NOW(), NOW()),
  (gen_random_uuid(), 'CONTRIB_DEV', 'Contributeur Développement', 'PROJECT_CONTRIBUTOR', 'Rôle institutionnel — Contributeur projet dans le service Développement', false, false, NOW(), NOW()),
  (gen_random_uuid(), 'CONTRIB_FLUX', 'Contributeur Flux', 'PROJECT_CONTRIBUTOR', 'Rôle institutionnel — Contributeur projet dans le service Flux', false, false, NOW(), NOW()),
  (gen_random_uuid(), 'CONTRIB_GESTION_PARC', 'Contributeur Gestion Parc', 'PROJECT_CONTRIBUTOR', 'Rôle institutionnel — Contributeur projet dans le service Gestion Parc', false, false, NOW(), NOW()),

  (gen_random_uuid(), 'USER_SUPPORT', 'Utilisateur Support', 'BASIC_USER', 'Rôle institutionnel — Utilisateur standard du service Support', false, false, NOW(), NOW()),
  (gen_random_uuid(), 'USER_INFRASTRUCTURE', 'Utilisateur Infrastructure', 'BASIC_USER', 'Rôle institutionnel — Utilisateur standard du service Infrastructure', false, false, NOW(), NOW());

-- -----------------------------------------------------------------------------
-- 3. Bascule des users vers les rôles institutionnels (par login, stable)
-- -----------------------------------------------------------------------------
-- Administration
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'ADMIN_DSI'), "updatedAt" = NOW()
  WHERE login = 'alexandre.berge';
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'ADMIN_SYSTEM'), "updatedAt" = NOW()
  WHERE login = 'admin';

-- Management
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'MANAGER_GESTION_PARC_SUPPORT'), "updatedAt" = NOW()
  WHERE login = 'mohamed.diagana';
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'MANAGER_DEV_PROJETS'), "updatedAt" = NOW()
  WHERE login = 'mathieu.messe';
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'MANAGER_CFA_FLUX'), "updatedAt" = NOW()
  WHERE login = 'christophe.redjil';
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'MANAGER_INFRA'), "updatedAt" = NOW()
  WHERE login = 'mohamed.zemouche';

-- Chefs de projet
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'CDP_DATA_ANALYTICS'), "updatedAt" = NOW()
  WHERE login = 'hicham.aitelmadani';
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'CDP_PROJETS'), "updatedAt" = NOW()
  WHERE login IN ('hanan.aitsaoudi', 'laurent.pascal', 'frederic.sarr');
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'CDP_HABILITATIONS'), "updatedAt" = NOW()
  WHERE login = 'angelique.thibeaudau';

-- Contributeurs projet
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'CONTRIB_CFA'), "updatedAt" = NOW()
  WHERE login IN ('agoumallah', 'claude.barrere', 'taquet');
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'CONTRIB_DEV'), "updatedAt" = NOW()
  WHERE login IN ('bem.bolalihongo', 'denis.bouvet', 'mickael.bula', 'geraldine.delcroix-guedon', 'lilan.hammache', 'roni.mahfouf-cairo', 'rayan.sifi');
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'CONTRIB_FLUX'), "updatedAt" = NOW()
  WHERE login IN ('didier.bottaz', 'pires');
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'CONTRIB_GESTION_PARC'), "updatedAt" = NOW()
  WHERE login IN ('fella.ishak', 'carine.raffin');

-- Utilisateurs standards
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'USER_SUPPORT'), "updatedAt" = NOW()
  WHERE login IN ('christophe.blanquart', 'nora.boukined', 'salim.lahmek', 'walid.mahjoub', 'rith.mey', 'killian.poussier', 'antonio.randriamahenina', 'pascal.tran');
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE code = 'USER_INFRASTRUCTURE'), "updatedAt" = NOW()
  WHERE login IN ('bobby.destine', 'fatma.idjeri', 'isaac.malonga', 'blaise.ngoudjou', 'adam.sahnoun', 'alain.strecker');

-- -----------------------------------------------------------------------------
-- 4. Invariants finaux (rollback auto si violation)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_institutional_inserted INT;
  v_active_on_institutional INT;
  v_active_on_system INT;
  v_active_total INT;
  v_expected_mapping RECORD;
BEGIN
  -- 4.1 — 15 rôles institutionnels présents
  SELECT COUNT(*) INTO v_institutional_inserted
  FROM roles
  WHERE code IN (
    'ADMIN_DSI', 'ADMIN_SYSTEM',
    'MANAGER_GESTION_PARC_SUPPORT', 'MANAGER_DEV_PROJETS', 'MANAGER_CFA_FLUX', 'MANAGER_INFRA',
    'CDP_DATA_ANALYTICS', 'CDP_PROJETS', 'CDP_HABILITATIONS',
    'CONTRIB_CFA', 'CONTRIB_DEV', 'CONTRIB_FLUX', 'CONTRIB_GESTION_PARC',
    'USER_SUPPORT', 'USER_INFRASTRUCTURE'
  );
  IF v_institutional_inserted != 15 THEN
    RAISE EXCEPTION 'Invariant violé : attendu 15 rôles institutionnels, trouvé %', v_institutional_inserted;
  END IF;

  -- 4.2 — Tous les users actifs pointent vers un rôle isSystem=false
  SELECT COUNT(*) INTO v_active_total FROM users WHERE "isActive" = true;
  SELECT COUNT(*) INTO v_active_on_institutional
  FROM users u JOIN roles r ON u."roleId" = r.id
  WHERE u."isActive" = true AND r."isSystem" = false
    AND r.code IN (
      'ADMIN_DSI', 'ADMIN_SYSTEM',
      'MANAGER_GESTION_PARC_SUPPORT', 'MANAGER_DEV_PROJETS', 'MANAGER_CFA_FLUX', 'MANAGER_INFRA',
      'CDP_DATA_ANALYTICS', 'CDP_PROJETS', 'CDP_HABILITATIONS',
      'CONTRIB_CFA', 'CONTRIB_DEV', 'CONTRIB_FLUX', 'CONTRIB_GESTION_PARC',
      'USER_SUPPORT', 'USER_INFRASTRUCTURE'
    );
  IF v_active_on_institutional != v_active_total THEN
    RAISE EXCEPTION 'Invariant violé : % users actifs au total, seulement % sur un rôle institutionnel cible', v_active_total, v_active_on_institutional;
  END IF;

  -- 4.3 — Zéro user actif sur rôle système
  SELECT COUNT(*) INTO v_active_on_system
  FROM users u JOIN roles r ON u."roleId" = r.id
  WHERE u."isActive" = true AND r."isSystem" = true;
  IF v_active_on_system > 0 THEN
    RAISE EXCEPTION 'Invariant violé : % users actifs encore sur un rôle système', v_active_on_system;
  END IF;

  -- 4.4 — Vérif de cardinalité par rôle cible
  FOR v_expected_mapping IN
    SELECT * FROM (VALUES
      ('ADMIN_DSI', 1),
      ('ADMIN_SYSTEM', 1),
      ('MANAGER_GESTION_PARC_SUPPORT', 1),
      ('MANAGER_DEV_PROJETS', 1),
      ('MANAGER_CFA_FLUX', 1),
      ('MANAGER_INFRA', 1),
      ('CDP_DATA_ANALYTICS', 1),
      ('CDP_PROJETS', 3),
      ('CDP_HABILITATIONS', 1),
      ('CONTRIB_CFA', 3),
      ('CONTRIB_DEV', 7),
      ('CONTRIB_FLUX', 2),
      ('CONTRIB_GESTION_PARC', 2),
      ('USER_SUPPORT', 8),
      ('USER_INFRASTRUCTURE', 6)
    ) AS t(role_code, expected_count)
  LOOP
    DECLARE
      v_actual INT;
    BEGIN
      SELECT COUNT(*) INTO v_actual
      FROM users u JOIN roles r ON u."roleId" = r.id
      WHERE u."isActive" = true AND r.code = v_expected_mapping.role_code;
      IF v_actual != v_expected_mapping.expected_count THEN
        RAISE EXCEPTION 'Invariant violé : rôle % attendait % users, trouvé %', v_expected_mapping.role_code, v_expected_mapping.expected_count, v_actual;
      END IF;
    END;
  END LOOP;

  RAISE NOTICE 'Migration OK — 15 rôles institutionnels insérés, % users actifs répartis dessus, 0 sur rôle système.', v_active_on_institutional;
END $$;

COMMIT;
