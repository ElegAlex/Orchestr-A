# SPEC 2 — Backend : schema, migration, guards, endpoints

> **Statut** : spec ready-to-paste pour Claude Code. **Portée** : refonte complète du backend RBAC : schema Prisma unifié, migration SQL, seed des 26 templates, refactor `PermissionsService`, décorateurs et guards, endpoints d'administration des rôles custom. **Le frontend n'est pas touché ici** (Spec 3). **Pré-requis obligatoire** : le dossier `backlog/rbac-refactor/contract/` produit par Spec 1 doit exister et être validé par le PO. Cette spec consomme intégralement ses livrables.

---

## 0. Inputs de la spec

Avant toute action, Claude Code lit et intègre :

1. **`backlog/rbac-templates-library-design.md`** — biblio finale des 26 templates, catégorisation, mapping de migration.
2. **`backlog/rbac-refactor/audit/`** (6 fichiers) — pour comprendre l'existant à refactorer.
3. **`backlog/rbac-refactor/contract/`** (5 fichiers) — **spécification technique qui fait foi** :
    - `contract-01-atomic-permissions.ts` — constantes atomiques à intégrer.
    - `contract-02-templates.ts` — 26 templates à intégrer.
    - `contract-03-type-model.md` — schema Prisma + stratégie migration.
    - `contract-04-helpers-api.md` — signatures backend (service, décorateurs).
    - `contract-05-spec2-spec3-inputs.md` — liste des fichiers à créer/modifier et leur ordre d'exécution.

Claude Code **ne reprend pas les décisions techniques** prises en Spec 1. Les signatures, types, noms de fichiers, stratégie de migration sont imposés par le contrat. Tout écart nécessite validation PO avant poursuite.

---

## 1. Phase 0 — Audit de cohérence (court, <30 min)

Avant de commencer, Claude Code vérifie que l'environnement est aligné avec le contrat. **Aucun code applicatif modifié durant cette phase.**

**Livrable** : un court fichier `backlog/rbac-refactor/spec2-readiness.md` contenant :

- Vérification que les 5 fichiers du contrat existent et sont lisibles.
- Exécution de `pnpm tsc --noEmit` sur `contract-01` et `contract-02` isolés : doivent type-check.
- Confirmation que la liste de fichiers backend à modifier (§contract-05) correspond à la réalité actuelle du repo (aucun fichier attendu n'a disparu depuis Spec 1).
- Vérification que la branche git actuelle est bien dédiée au refactor (nommage cohérent, ex : `refactor/rbac-templates`).
- Confirmation qu'aucune migration Prisma pending (non appliquée) n'existe dans `packages/database/prisma/migrations/` qui pourrait interférer.
- Liste des tests d'intégration backend existants qui **touchent** au RBAC (à faire tourner en baseline pour détecter les régressions).

**Validation PO requise** avant Vague 0.

---

## 2. Matrice de conflits fichiers

Les chemins exacts viennent de `contract-05-spec2-spec3-inputs.md`. La matrice ci-dessous est la structure logique — les paths réels seront substitués par Claude Code à partir du contrat.

|Domaine|Teammate|Fichiers (types)|
|---|---|---|
|Schema Prisma + migration SQL + seed|**A**|`packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/<timestamp>_rbac_refactor/migration.sql`, `packages/database/prisma/seed.ts` + nouveaux helpers|
|Constantes atomiques + templates (code applicatif)|**B**|`packages/types/` ou package dédié (selon contrat-04), exports TS|
|`PermissionsService` refactorisé + décorateurs|**C**|`apps/api/src/auth/` (ou chemin existant) — service, décorateurs, guards|
|Endpoints CRUD rôles custom|**D**|`apps/api/src/roles/` (ou équivalent existant) — controller, service, DTOs|
|Tests d'intégration RBAC|**E**|`apps/api/src/**/*.spec.ts` — ajouts et mises à jour|
|Suppression ancien code RBAC|**F**|Fichiers de l'ancien système (identifiés en audit §1.5 et contrat-05)|

**Règle de parallélisation** : A et B sont prérequis pour C et D. C et D peuvent s'exécuter en parallèle une fois A et B terminés. E démarre quand C et D sont livrés. F se fait en dernier avec vigilance (suppression agressive de code mort).

---

## 3. Séquencement

### Vague 0 — Fondations (séquentiel, A puis B)

**Teammate A** — Schema, migration, seed

1. Intègre le schema Prisma défini par `contract-03-type-model.md` dans `schema.prisma`.
2. Génère la migration SQL (nommée `<timestamp>_rbac_refactor`) avec les étapes idempotentes définies en §contract-03.
3. Écrit le seed pour insérer les 26 templates système (`isSystem=true`) + backfill des `roleId` sur `User` selon le mapping de migration (§5 du design doc).
4. Conserve les tables `role_configs`, `permissions`, `role_permissions` à ce stade (suppression en Vague 4).
5. **Vérification locale** : `pnpm db:migrate && pnpm db:seed` sur une DB fraîche, puis sur un dump de la prod (si disponible via un dump anonymisé en local).
6. **Critère** : zéro user avec `roleId` NULL après backfill. Si user résiduel, stop et remonter au PO.

**Teammate B** — Constantes atomiques + templates (code applicatif)

1. Intègre `contract-01-atomic-permissions.ts` au chemin décidé en contrat-04 (probablement `packages/types/src/rbac/permissions.ts` ou `packages/rbac/src/permissions.ts`).
2. Intègre `contract-02-templates.ts` au même package.
3. Exporte les types (`PermissionCode`, `RoleTemplateKey`, `RoleCategoryKey`, `RoleTemplate`) et la constante `ROLE_TEMPLATES`.
4. Écrit un test unitaire : pour chaque template, vérifier que le nombre de permissions effectives correspond à la valeur attendue (cf. design doc §4).
5. Écrit un test de cohérence : aucun template ne contient de permission inconnue (toutes les permissions sont présentes dans le catalogue atomique).

**Ne pas démarrer Vague 1 avant validation A+B.**

### Vague 1 — Guards et service (parallèle C + D, après validation Vague 0)

**Teammate C** — `PermissionsService` + décorateurs + guards

1. Refactor de `PermissionsService` selon la signature `contract-04-helpers-api.md` :
    - Consulte les permissions **via la constante `ROLE_TEMPLATES`** (pas de query DB pour les permissions — seulement pour récupérer le `templateKey` associé au `roleId` du user).
    - Cache en mémoire au niveau de l'instance (les templates sont immutables, cache safe).
    - Méthode `userHasPermission(userId, permission)` : lookup user → `roleId` → `role.templateKey` → `ROLE_TEMPLATES[templateKey].permissions.includes(permission)`.
    - Méthode `userHasAnyTemplate(userId, templates[])` pour checks gros grain.
2. Nouveau décorateur `@RequirePermission('tasks:create')` et `@RequirePermissions(['x:y', 'a:b'])` (AND) et `@RequireAnyPermission([...])` (OR). Signatures exactes du contrat-04.
3. Nouveau guard `PermissionsGuard` qui applique ces décorateurs.
4. `OwnershipGuard` adapté : consomme le nouveau `PermissionsService` pour détecter `manage_any` (bypass).
5. **Conservation temporaire** de l'ancien `RolesGuard` et du décorateur `@Roles()` pour permettre une migration progressive des endpoints (suppression finale en Vague 3).

**Teammate D** — Endpoints CRUD rôles custom

1. Création du module `roles` (ou refactor de l'existant `role-configs`) selon convention NestJS du projet.
2. Endpoints :
    - `GET /api/roles` — liste de tous les rôles (système + custom), avec `templateKey` et métadonnées du template associé (catégorie, description).
    - `GET /api/roles/templates` — liste des 26 templates avec catégories, descriptions, preview des permissions (consommée par la galerie UI en Spec 3).
    - `POST /api/roles` — création d'un rôle custom (label + templateKey). `isSystem` forcé à `false`.
    - `PATCH /api/roles/:id` — modification du label ou du template d'un rôle custom uniquement (blocage si `isSystem=true`).
    - `DELETE /api/roles/:id` — suppression d'un rôle custom uniquement (blocage si `isSystem=true` ou si des users y sont rattachés — retourner 409 avec liste des users concernés).
3. DTOs avec `class-validator`.
4. Guards appliqués : `@RequirePermission('users:manage_roles')` sur tous les endpoints d'écriture.

**Ne pas démarrer Vague 2 avant validation C+D.**

### Vague 2 — Migration des endpoints existants (teammate E, séquentiel)

**Teammate E** — Remplacement des décorateurs RBAC sur les endpoints existants

1. Pour chaque controller identifié dans `audit-02-endpoints-permissions-map.md` :
    - Remplacer `@Roles('ADMIN', 'RESPONSABLE')` par `@RequireAnyPermission([...])` avec les permissions effectives correspondantes du template.
    - Supprimer les `@Roles()` redondants si le `@RequirePermission` couvre déjà le besoin.
2. **Ne pas supprimer l'ancien `RolesGuard` ni `@Roles` à ce stade** — conservés pour rollback.
3. Pour chaque endpoint qui vérifie une permission en inline dans le service, migrer vers le décorateur si possible.
4. **Critère** : toute la matrice permission ↔ endpoint (audit §1.2) est re-vérifiée : chaque permission a au moins un endpoint qui la consomme (sauf si elle est marquée morte dans l'audit §1.6).

### Vague 3 — Tests (teammate F, séquentiel)

**Teammate F** — Tests d'intégration RBAC

1. Pour chaque des 26 templates, un test d'intégration qui :
    - Crée un user avec ce template.
    - Appelle 3-5 endpoints représentatifs des permissions du template (positif).
    - Appelle 3-5 endpoints explicitement interdits par le template (négatif, attend 403).
2. Tests spécifiques pour les permissions `manage_any` (bypass OwnershipGuard) : vérifier qu'un user `ADMIN` peut modifier une tâche d'un autre user, et qu'un user `BASIC_USER` ne le peut pas.
3. Tests de non-régression sur les endpoints sensibles identifiés en §audit-06 (trous de sécurité corrigés).
4. Tests du module `roles` (endpoints CRUD) — bloquer suppression d'un rôle système, bloquer suppression d'un rôle avec users rattachés, etc.
5. **Critère** : couverture RBAC backend > 80% (métrique à exécuter et inscrire dans le rapport de vague).

### Vague 4 — Nettoyage (teammate G, séquentiel, après validation des 3 précédentes)

**Teammate G** — Suppression du code mort

1. Suppression de l'ancien `RolesGuard` et du décorateur `@Roles()`.
2. Suppression du module `role-configs` s'il existait séparément (migré vers `roles`).
3. Suppression des endpoints `role-configs/*` obsolètes.
4. Migration SQL additionnelle (`<timestamp>_rbac_cleanup`) pour **drop** des tables `role_configs`, `permissions`, `role_permissions` après backup de précaution.
5. Suppression des permissions mortes identifiées en audit §1.6 (déjà absentes du code, maintenant absentes de la DB).
6. **Grep final** : zéro référence à `RolesGuard`, `@Roles`, `role_configs`, `role_permissions` dans le code.
7. Build backend complet (`pnpm --filter api build`) doit passer sans warning nouveau.

---

## 4. Risques identifiés

### Risque 1 — Backfill des `roleId` échoue sur users orphelins

Des users peuvent avoir un `role` enum qui ne mappe à aucun template de la table cible (ex : valeur corrompue, ou migration passée mal appliquée). **Mitigation** : la migration échoue dur si un user n'a pas pu être rattaché. Le PO doit alors faire un triage manuel avant de relancer.

### Risque 2 — Cache in-memory désynchronisé après modification de rôle

Si l'admin change le `templateKey` d'un rôle custom, les users qui y sont rattachés doivent voir leurs permissions recalculées immédiatement. **Mitigation** : invalidation du cache `PermissionsService` à chaque mutation du module `roles`. Si l'app tourne en multi-instance derrière Nginx, **pas de cache cross-request persistent** — le cache est au niveau de la requête HTTP uniquement (ou par instance Node, négligeable puisque les templates sont immutables et seule l'association user→role peut changer).

### Risque 3 — Endpoints dépendant de permissions mortes

Si un endpoint vérifiait une permission morte (ex : `leaves:manage_any` définie mais jamais attribuée à aucun user en prod), le refactor peut le rendre inatteignable silencieusement. **Mitigation** : la Vague 3 E teste les 26 templates end-to-end, ce qui expose immédiatement les trous. Si un endpoint reste inatteignable, décision PO : supprimer l'endpoint ou attribuer la permission à un template existant.

### Risque 4 — Seed non idempotent sur prod

Si la Vague 0 A est relancée sur la prod (crash, reprise), le seed ne doit pas dupliquer les templates ni reset les users. **Mitigation** : le seed utilise `upsert` sur `roles` avec contrainte sur `templateKey` pour les rôles système, et **ne touche pas** aux users existants. Tests unitaires du seed avec double exécution.

### Risque 5 — Migration SQL lourde en prod

La création de la table `roles`, le backfill de `roleId` sur tous les users, et la contrainte FK sont non triviaux sur une DB en charge. **Mitigation** : migration structurée en étapes non bloquantes :

1. Créer `roles` (DDL rapide).
2. Seed templates système dans `roles`.
3. Ajouter `roleId` sur `users` en nullable.
4. Backfill en UPDATE batched (100 users à la fois si volume > 1000).
5. Ajouter contrainte FK `NOT NULL`.
6. (Vague 4) Drop des anciennes tables.

### Risque 6 — Rollback impossible après drop

Si les anciennes tables sont droppées (Vague 4) et qu'un bug émerge, revenir en arrière nécessiterait restore DB complet. **Mitigation** : Vague 4 ne démarre qu'après **minimum 7 jours en prod** avec le nouveau système, et après backup explicite nommé `pre-rbac-dropold`. La décision de démarrer Vague 4 appartient au PO, pas à Claude Code — la spec ne pousse pas Claude à enchaîner automatiquement.

### Risque 7 — OwnershipGuard bypass non couvert par tests

Les permissions `manage_any` sont critiques et souvent sous-testées. Un régression silencieuse (un user `BASIC_USER` qui passerait soudain par le bypass) est un trou de sécu majeur. **Mitigation** : Vague 3 E inclut **au moins 10 tests dédiés** couvrant chaque permission `*:manage_any`, en positif (ADMIN passe) et négatif (BASIC_USER bloqué).

---

## 5. Critères d'acceptation (Spec 2)

- [ ] Le schema Prisma cible est intégré et `pnpm db:migrate` passe sans erreur.
- [ ] Le seed insère 26 rôles système (`isSystem=true`) et les 15 libellés actuels sont mappés vers les bons templates (aucune régression de permission par user).
- [ ] La constante `ROLE_TEMPLATES` est importée et consommée par `PermissionsService`.
- [ ] Les endpoints CRUD rôles custom (`/api/roles`) fonctionnent avec guards appropriés.
- [ ] Tous les endpoints existants ont été migrés vers les nouveaux décorateurs (Vague 2).
- [ ] Les 26 templates ont chacun ≥ 6 tests d'intégration (3 positifs + 3 négatifs) qui passent.
- [ ] Les tests `manage_any` couvrent les 5 permissions de bypass et passent.
- [ ] Après Vague 4 : aucune référence à l'ancien système RBAC dans le code (`grep` final).
- [ ] `pnpm --filter api build` passe sans warning nouveau.
- [ ] `pnpm --filter api test:cov` affiche une couverture RBAC > 80%.
- [ ] Aucune modification du code frontend (`apps/web/`) n'a été faite durant Spec 2.

---

## 6. Out of scope (Spec 2)

- UI d'administration des rôles côté frontend (Spec 3).
- Sidebar conditionnelle et checks UI granulaires (Spec 3).
- Tests E2E Playwright (Spec 3).
- Documentation utilisateur (admin guide post-refonte) — ticket séparé.
- Optimisation cache Redis pour `PermissionsService` (futur, non critique).
- Migration vers httpOnly cookies pour JWT (déjà identifié hors scope dans le KB).