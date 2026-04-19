# contract-03 — Modèle de données cible

> Schéma Prisma cible + stratégie de migration de l'état actuel (3 tables `role_configs` / `permissions` / `role_permissions` + enum `Role`) vers l'état cible (1 table `roles` + `User.roleId` FK). Implémente la décision PO **D1** (table `roles` unifiée) et **D7** (rename `telework:manage_others` → `telework:manage_any`), **D12** (suppression `@Roles()` et `RolesGuard`), **D4** (drop permissions mortes), **D6 #4** (add `documents:manage_any`).
>
> **Statut** : contrat de Phase 1. Le schéma lui-même n'est PAS intégré dans `packages/database/prisma/schema.prisma` à ce stade — c'est Spec 2 Vague 0 qui le fait.

---

## 1. État actuel (avant refactor)

Extrait du schéma Prisma (`packages/database/prisma/schema.prisma`) :

```prisma
model User {
  id           String   @id @default(uuid())
  role         Role     @default(CONTRIBUTEUR)   // enum figé 15 valeurs
  // ... (~50 relations)
}

enum Role {
  ADMIN
  RESPONSABLE
  MANAGER
  CHEF_DE_PROJET
  REFERENT_TECHNIQUE
  CONTRIBUTEUR
  OBSERVATEUR
  TECHNICIEN_SUPPORT
  GESTIONNAIRE_PARC
  ADMINISTRATEUR_IML
  DEVELOPPEUR_CONCEPTEUR
  CORRESPONDANT_FONCTIONNEL_APPLICATION
  CHARGE_DE_MISSION
  GESTIONNAIRE_IML
  CONSULTANT_TECHNOLOGIE_SI
}

model Permission {
  id              String           @id @default(uuid())
  code            String           @unique
  module          String
  action          String
  description     String?
  rolePermissions RolePermission[]
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  @@map("permissions")
}

model RoleConfig {
  id          String           @id @default(uuid())
  code        String           @unique
  name        String
  description String?
  isSystem    Boolean          @default(false)
  isDefault   Boolean          @default(false)
  permissions RolePermission[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  @@map("role_configs")
}

model RolePermission {
  roleConfigId String
  roleConfig   RoleConfig @relation(fields: [roleConfigId], references: [id], onDelete: Cascade)
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleConfigId, permissionId])
  @@map("role_permissions")
}
```

**Problèmes résolus par le refactor** :

1. Enum `Role` figé ≠ `RoleConfig` dynamique → impossible d'assigner un rôle custom à un user.
2. 3 tables pour représenter un lien rôle↔permissions, là où 1 table (`roles` + pointeur vers template code) suffit (permissions sont des constantes compilées).
3. Seed complexe (`RoleManagementService.seedPermissionsAndRoles`) pour reproduire la config en DB alors que le template est canonique dans le code.
4. Faille `isSystem` : les permissions d'un rôle système peuvent être réécrites via `PUT /role-management/roles/:id/permissions` (D9 à corriger).

---

## 2. Schéma cible (Prisma DSL complet)

### 2.1 Nouvelle table `roles`

```prisma
/// Rôle d'un utilisateur. Chaque rôle pointe sur un template hardcodé qui
/// détermine entièrement ses permissions (cf. contract-02-templates.ts,
/// enum RoleTemplateKey). Un template peut être rattaché à 0, 1 ou N rôles.
model Role {
  id          String   @id @default(uuid())

  /// Identifiant stable, unique (ex: "ADMIN", "CHEF_DE_PROJET_SENIOR"). Sert
  /// de clé à PermissionsService.getPermissionsForRole(code).
  code        String   @unique

  /// Libellé affiché dans l'UI (éditable par l'admin). Ex: "Chef de projet
  /// senior", "Gestionnaire IML".
  label       String

  /// Rattachement au template hardcodé. Détermine les permissions effectives.
  /// NOT NULL — un rôle sans templateKey est invalide (orphelin).
  /// Stocké en string (pas d'enum Prisma) pour conserver la cohérence typage
  /// avec contract-02 sans générer une seconde enum figée côté Prisma.
  templateKey String

  /// Description libre (optionnelle).
  description String?

  /// Flag "rôle système non modifiable et non supprimable". Les rôles système
  /// sont 1 par template, créés par le seed d'onboarding, jamais modifiables
  /// via l'API admin (cf. D9).
  isSystem    Boolean  @default(false)

  /// Flag "rôle par défaut pour un nouvel utilisateur" (remplace l'actuel
  /// `@default(CONTRIBUTEUR)` sur User.role).
  isDefault   Boolean  @default(false)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       User[]

  @@map("roles")
  @@index([templateKey])
  @@index([isDefault])
}
```

### 2.2 Modification `User`

```prisma
model User {
  id                  String   @id @default(uuid())
  email               String   @unique
  login               String   @unique
  passwordHash        String
  firstName           String
  lastName            String

  // ─── Changement clé D1 ───────────────────────────────────────────────
  // AVANT : role Role @default(CONTRIBUTEUR)
  // APRÈS : FK vers roles.id. Le rôle par défaut est résolu runtime depuis
  // la table `roles` (premier où isDefault = true). Pas de default Prisma
  // possible car l'id du rôle est dynamique.
  roleId              String
  role                Role     @relation(fields: [roleId], references: [id])

  departmentId        String?
  isActive            Boolean  @default(true)
  avatarUrl           String?
  avatarPreset        String?
  forcePasswordChange Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // ... (autres relations inchangées : département, projets, tâches, etc.)
  @@map("users")
  @@index([roleId])
}
```

### 2.3 Enum Prisma `Role` — SUPPRIMÉ

```prisma
// enum Role { ... 15 valeurs ... }
//
// SUPPRIMÉ en Vague 0 de Spec 2 après que tous les usages applicatifs aient
// été migrés. La suppression physique se fait en Vague 4 (après une période
// de vérification en prod).
```

### 2.4 Tables `permissions` / `role_configs` / `role_permissions` — SUPPRIMÉES

Ces 3 tables n'ont plus de raison d'être :

- **`permissions`** : le catalogue des permissions est maintenant le type
  `PermissionCode` compilé (`contract-01-atomic-permissions.ts`).
- **`role_configs`** : remplacée par la table `roles` ci-dessus.
- **`role_permissions`** : le lien rôle↔permissions est déterminé par
  `ROLE_TEMPLATES[role.templateKey].permissions` (résolution in-memory +
  cache Redis).

Suppression physique en Vague 4 de Spec 2, après migration vérifiée et
période de validation en prod (2 semaines minimum recommandées).

---

## 3. Stratégie de migration (étapes SQL idempotentes)

**Principe directeur** : migration en place (pas de downtime), backfill avant
suppression, chaque étape idempotente pour permettre retry et rollback.

### Étape 1 — Création de la table `roles` (additive, sans impact prod)

```sql
-- Idempotent : CREATE TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS roles (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  template_key TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_template_key ON roles(template_key);
CREATE INDEX IF NOT EXISTS idx_roles_is_default ON roles(is_default);
```

### Étape 2 — Seed de la table `roles` (1 ligne par template, `isSystem=true`)

```sql
-- Seed idempotent via INSERT ... ON CONFLICT. Un rôle système par
-- RoleTemplateKey. Le label par défaut est le `defaultLabel` du template.
INSERT INTO roles (code, label, template_key, is_system, is_default)
VALUES
  ('ADMIN', 'Administrateur', 'ADMIN', TRUE, FALSE),
  ('ADMIN_DELEGATED', 'Directeur adjoint', 'ADMIN_DELEGATED', TRUE, FALSE),
  ('PORTFOLIO_MANAGER', 'Manager de portefeuille', 'PORTFOLIO_MANAGER', TRUE, FALSE),
  ('MANAGER', 'Manager', 'MANAGER', TRUE, FALSE),
  ('MANAGER_PROJECT_FOCUS', 'Manager projet', 'MANAGER_PROJECT_FOCUS', TRUE, FALSE),
  ('MANAGER_HR_FOCUS', 'Chef de service', 'MANAGER_HR_FOCUS', TRUE, FALSE),
  ('PROJECT_LEAD', 'Chef de projet', 'PROJECT_LEAD', TRUE, FALSE),
  ('PROJECT_LEAD_JUNIOR', 'Chef de projet junior', 'PROJECT_LEAD_JUNIOR', TRUE, FALSE),
  ('TECHNICAL_LEAD', 'Référent technique', 'TECHNICAL_LEAD', TRUE, FALSE),
  ('PROJECT_CONTRIBUTOR', 'Contributeur projet', 'PROJECT_CONTRIBUTOR', TRUE, FALSE),
  ('PROJECT_CONTRIBUTOR_LIGHT', 'Contributeur projet junior', 'PROJECT_CONTRIBUTOR_LIGHT', TRUE, FALSE),
  ('FUNCTIONAL_REFERENT', 'Référent fonctionnel', 'FUNCTIONAL_REFERENT', TRUE, FALSE),
  ('HR_OFFICER', 'Gestionnaire RH', 'HR_OFFICER', TRUE, FALSE),
  ('HR_OFFICER_LIGHT', 'Assistant RH', 'HR_OFFICER_LIGHT', TRUE, FALSE),
  ('THIRD_PARTY_MANAGER', 'Gestionnaire prestataires', 'THIRD_PARTY_MANAGER', TRUE, FALSE),
  ('CONTROLLER', 'Contrôleur de gestion', 'CONTROLLER', TRUE, FALSE),
  ('BUDGET_ANALYST', 'Analyste budgétaire', 'BUDGET_ANALYST', TRUE, FALSE),
  ('DATA_ANALYST', 'Analyste données', 'DATA_ANALYST', TRUE, FALSE),
  ('IT_SUPPORT', 'Technicien support', 'IT_SUPPORT', TRUE, FALSE),
  ('IT_INFRASTRUCTURE', 'Équipe infrastructure', 'IT_INFRASTRUCTURE', TRUE, FALSE),
  ('OBSERVER_FULL', 'Observateur global', 'OBSERVER_FULL', TRUE, FALSE),
  ('OBSERVER_PROJECTS_ONLY', 'Sponsor projet', 'OBSERVER_PROJECTS_ONLY', TRUE, FALSE),
  ('OBSERVER_HR_ONLY', 'Audit social', 'OBSERVER_HR_ONLY', TRUE, FALSE),
  ('BASIC_USER', 'Utilisateur standard', 'BASIC_USER', TRUE, TRUE),  -- is_default = TRUE
  ('EXTERNAL_PRESTATAIRE', 'Prestataire externe', 'EXTERNAL_PRESTATAIRE', TRUE, FALSE),
  ('STAGIAIRE_ALTERNANT', 'Stagiaire / alternant', 'STAGIAIRE_ALTERNANT', TRUE, FALSE)
ON CONFLICT (code) DO UPDATE SET
  -- Ne pas écraser le `label` si l'admin l'a modifié. Seul template_key peut
  -- être ajusté en cas de re-seed (et uniquement pour les rôles system).
  template_key = EXCLUDED.template_key
WHERE roles.is_system = TRUE;
```

### Étape 3 — Seed des alias pour les libellés DB actuels

Pour conserver un rattachement historique, on crée aussi les 15 rôles legacy
avec leurs codes actuels, pointant vers leur template cible (table de mapping
issue de `LEGACY_ROLE_MIGRATION` dans contract-02) :

```sql
-- Note : ces rôles legacy sont distincts des rôles "système templates" créés
-- en étape 2. Ils portent le code historique (ex: CHEF_DE_PROJET) et pointent
-- vers le même template (ex: PROJECT_LEAD). Ils servent à conserver l'identité
-- visible côté UI le temps de la transition, puis les users sont réassignés
-- aux rôles templates en étape 4.
--
-- Alternative : ne PAS créer les 15 rôles legacy, faire directement le
-- backfill User.roleId vers les rôles templates. À arbitrer en Spec 2 Vague 0
-- — le choix impacte l'expérience admin à la migration (rôles visibles par
-- le nom historique vs directement réassignés).
--
-- Recommandation Phase 1 : backfill direct vers rôles templates (plus propre,
-- évite une dette de 15 lignes "legacy" à nettoyer plus tard).

-- Conclusion : étape 3 NON EXÉCUTÉE. Passer directement à l'étape 4.
```

### Étape 4 — Ajout de `users.role_id` (nullable pendant la transition)

```sql
-- Ajout nullable puis backfill, avant mise en NOT NULL à l'étape 6.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id TEXT;

-- Backfill : mapping entre users.role (enum) et roles.code (via
-- LEGACY_ROLE_MIGRATION du contract-02).
UPDATE users u SET role_id = r.id
FROM roles r
WHERE u.role_id IS NULL
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

-- Vérification post-backfill : aucun user avec role_id NULL.
DO $$
DECLARE cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM users WHERE role_id IS NULL;
  IF cnt > 0 THEN
    RAISE EXCEPTION 'Migration rôles : % users sans role_id après backfill', cnt;
  END IF;
END $$;
```

### Étape 5 — Application du code applicatif (Spec 2 Vague 2)

À cette étape, le code applicatif bascule :

- `User.role` (enum) n'est plus lu. Lecture `user.roleId` + join sur `roles`.
- `PermissionsService.getPermissionsForRole(roleCode)` :
  - Résout `roleCode` → `templateKey` via `roles` (DB + cache Redis).
  - Retourne `ROLE_TEMPLATES[templateKey].permissions` (in-memory).
  - Le TTL Redis reste 5min (clé `role-permissions:<code>`).
- `JwtStrategy.validate` : charge `user` avec `include: { role: true }` et
  attache `request.user = { ..., role: user.role.code, templateKey:
  user.role.templateKey }`. Les guards consomment `request.user.role` en
  string comme avant (SEC-03 contract préservé).
- `RolesGuard` devient no-op (cf. D12 — suppression en Vague 4).

### Étape 6 — Lock : `users.role_id` NOT NULL + drop colonne legacy

Après déploiement stable et vérification en prod (1-2 jours minimum) :

```sql
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_role_id_fkey
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT;

-- Drop enum column (Vague 4)
ALTER TABLE users DROP COLUMN role;
```

### Étape 7 — Drop enum Prisma `Role` + tables legacy

```sql
DROP TYPE IF EXISTS "Role";

-- Drop tables legacy (Vague 4, après période d'observation 2 semaines)
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS role_configs;
```

---

## 4. Stratégie de rollback

Le rollback s'applique **par étape**, pas en bloc. Chaque étape ayant été
idempotente additive (sauf la 6 et la 7), les rollback sont localisés :

| Étape | Rollback |
|---|---|
| 1 (CREATE TABLE roles) | `DROP TABLE IF EXISTS roles CASCADE;` |
| 2 (seed roles) | `TRUNCATE roles CASCADE;` puis DROP si étape 1 à retirer. |
| 4 (ADD COLUMN role_id + backfill) | `ALTER TABLE users DROP COLUMN IF EXISTS role_id;` — l'enum `role` existe toujours, service continue à fonctionner dessus. |
| 5 (applicatif) | Revert commit Git ; l'étape 4 a laissé la colonne enum intacte. |
| 6 (NOT NULL + drop col role) | **Irréversible** sans dump pg_dump préalable. Obligatoire : `pg_dump` complet avant l'étape 6. Rollback = `pg_restore` partielle de la colonne `role`. |
| 7 (DROP enum + tables legacy) | **Irréversible** sans dump. Obligatoire : `pg_dump` complet avant l'étape 7. |

**Règle opérationnelle** :

- Étapes 1 à 5 : réversibles en moins de 5 minutes.
- Étapes 6 et 7 : sauvegarde DB obligatoire avant exécution (conforme memory
  `feedback_verify_before_destructive_prod_changes`).

---

## 5. Enum Prisma `Role` — recommandation justifiée

Le PO demande (cf. D1 de `Po decisions.md`) la **suppression de l'enum `Role`
Prisma**. Analyse :

### Arguments pour la suppression immédiate

- Un seul code source de vérité (la table `roles`).
- `User.role` string → `User.roleId` string (cohérent, pas de deux façons de
  représenter le rôle).
- Compatible avec rôles custom créés par l'admin (alors que l'enum les
  rejetterait).

### Arguments pour une dépréciation progressive

- Breaking change côté code (tous les imports de `Role` doivent être enlevés).
- Les tests `permissions.guard.spec.ts` utilisent déjà `'CUSTOM_PROJECTS_ONLY' as Role` → conforme à la cible (rôle string arbitraire).
- Les tests `roles.guard.spec.ts` utilisent l'enum `Role` directement → à
  adapter en même temps que la migration.

### Recommandation retenue

**Suppression en Vague 4 de Spec 2** (après Vague 2 qui migre les usages et
Vague 3 qui valide par tests). La Vague 0 (schema) **ajoute** la table
`roles` sans toucher à l'enum. La Vague 2 **déprécie** l'enum (imports
remplacés, `user.role` → `user.role.code` via relation Prisma). La Vague 4
**supprime** physiquement.

Justification : l'enum a des usages disséminés (15 valeurs référencées à 200+
endroits). Une dépréciation progressive permet de valider par lot.

**Le contrat Phase 1 fige la décision : l'enum sera supprimé.** La temporalité
(Vague 0 vs Vague 4) est laissée à l'appréciation de Spec 2.

---

## 6. Modification associée : retrait du service `RoleManagementService`

Le service actuel (`apps/api/src/role-management/role-management.service.ts`,
~1400 lignes) gère :

- Seed de permissions + role_configs + role_permissions au boot.
- CRUD rôles custom (via `/role-management/*` API).
- `getPermissionsForRole(code)` avec cache Redis.

Post-refactor :

- **Seed simplifié** : création des 26 rôles templates `isSystem=true` en DB
  (pas de seed de permissions — elles ne sont plus en DB).
- **CRUD rôles** : l'admin peut créer/modifier des rôles **custom**
  (`isSystem=false`) mais doit choisir un `templateKey` parmi les 26. Pas de
  matrice de permissions éditable (faille D9 corrigée).
- **`getPermissionsForRole(roleCode)`** devient :

```ts
async getPermissionsForRole(roleCode: string): Promise<PermissionCode[]> {
  const cached = await redis.get(`role-permissions:${roleCode}`);
  if (cached) return JSON.parse(cached);

  const role = await prisma.role.findUnique({
    where: { code: roleCode },
    select: { templateKey: true },
  });
  if (!role) return [];

  const template = ROLE_TEMPLATES[role.templateKey as RoleTemplateKey];
  if (!template) return []; // templateKey obsolète

  const perms = template.permissions;
  await redis.setex(`role-permissions:${roleCode}`, 300, JSON.stringify(perms));
  return [...perms];
}
```

**Invalidation Redis** :
- Lors de `PATCH /roles/:id` (changement `templateKey`) : invalider le cache
  du rôle.
- Aucune invalidation nécessaire à chaque re-seed du template (les templates
  sont des constantes compilées — changent uniquement via merge Git + redémarrage).

Le cache Redis reste utile uniquement pour éviter la lecture DB sur chaque
requête (la résolution `template.permissions` est O(1) in-memory, mais la
lecture `roles.findUnique` est un aller-retour DB).

---

## 7. Impact sur `packages/types`

`packages/types` exporte actuellement l'enum `Role`. Post-refactor :

- L'enum est supprimé.
- Les types `PermissionCode`, `RoleTemplateKey`, `RoleCategoryKey` sont exposés
  depuis un nouveau package `packages/rbac/` (détails en contract-04).
- `packages/types` conserve les autres types du domaine (User, Project, etc.)
  mais `User.role` change de shape :

```ts
// Avant
interface User {
  role: Role; // enum string
}

// Après
interface User {
  roleId: string;
  role: {
    id: string;
    code: string;
    label: string;
    templateKey: RoleTemplateKey;
  };
}
```

**Impact frontend Spec 3** : chaque lecture de `user.role` (actuellement ~80
endroits, dont `usePermissions.ts`) devient `user.role.code` ou `user.role.templateKey`. Le refactor est mécanique mais étendu.

---

## 8. Checklist récapitulative (inputs Spec 2 Vague 0)

- [ ] Ajouter `model Role` à `schema.prisma` (§2.1) — ne pas toucher à `User.role` encore.
- [ ] Générer et appliquer la migration initiale (étape 1).
- [ ] Seeder les 26 rôles templates (étape 2).
- [ ] Ajouter `users.role_id` nullable (étape 4, partie 1).
- [ ] Script SQL de backfill `users.role_id` depuis l'enum legacy (étape 4, partie 2).
- [ ] **`pg_dump` obligatoire** avant étape 6.
- [ ] Après validation stable en prod : Vague 4 = drop colonne `role` + enum + tables legacy.
- [ ] Tests d'intégration : vérifier que `getPermissionsForRole('ADMIN')` retourne exactement 107 permissions, et pour chaque template, le nombre attendu (cf. §NOTE 2 de contract-02 et comptes design doc).

---

## 9. Dette nominale transitoire (V0 → V4)

> Ajout PO du 2026-04-19, suite à incohérence détectée en début de Spec 2 V0.

### Constat

Prisma exige des noms uniques entre `model` et `enum` du même schema. Le contrat-03 §2.1 prescrit `model Role`, mais l'enum `Role` (§2.3) ne peut être supprimé en V0 sans casser **136 occurrences dans 23 fichiers** sous `apps/api/src/`, ce qui déclencherait le STOP impératif R5 du bloc d'invocation Spec 2 (« STOP si un test précédemment vert passe rouge »).

### Convention transitoire retenue (Option B PO)

**De V0 à V3** :

- Le modèle Prisma est nommé `RoleEntity` avec `@@map("roles")` côté SQL. La table sur disque s'appelle bien `roles`, conforme au schéma cible.
- La relation côté `User` est nommée `roleEntity: RoleEntity?` (nullable jusqu'à V4) avec `@relation(name: "UserRoleEntity", fields: [roleId], references: [id])`.
- L'enum Prisma `Role` reste **intact** (15 valeurs).
- Le champ `User.role` (enum) reste **intact** jusqu'à V4. Cohabite avec `User.roleId String?` (FK vers `RoleEntity`).
- Le code applicatif continue à compiler — les imports `import { Role } from '@prisma/client'` fonctionnent. La migration des 136 usages se fait en V2 (Spec 2) puis V1 C/D de Spec 3.

**En V4** (drop legacy, hors scope actuel) :

- DROP enum Prisma `Role` du schema.
- DROP `users.role` (colonne enum legacy).
- Migration Prisma de **rename** : `RoleEntity` → `Role` (nom métier final). Génère un `ALTER TABLE roles RENAME` rien (la table s'appelle déjà `roles` via `@@map`), seul le nom Prisma change.
- Renommage `roleEntity` → `role` dans la relation `User`.
- Propagation du rename dans tout le code applicatif (`user.roleEntity.code` → `user.role.code`).

### Filet anti-oubli

Cette §9 est le contrat de la dette à payer en V4. Toute Spec 2 ou Spec 3 PR qui touche au schema Prisma doit relire cette section pour ne pas figer la dette.

Côté code : ajouter un commentaire au-dessus de `model RoleEntity` dans `schema.prisma` pointant vers cette section :

```prisma
// TRANSITOIRE V0→V4 : nommé RoleEntity car enum `Role` cohabite jusqu'à V4
// (cf. backlog/rbac-refactor/contract/contract-03-type-model.md §9).
// Sera renommé `Role` quand l'enum sera dropé.
model RoleEntity {
  // ...
  @@map("roles")
}
```
