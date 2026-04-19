# contract-05 — Inputs pour Spec 2 (backend) et Spec 3 (frontend)

> Orchestrateur de la suite : liste exhaustive des fichiers à créer/modifier, ordre d'exécution des vagues, allowlist D2, endpoints à câbler D3/D4 Cat B/D6, critères d'acceptation globaux.
>
> Source : `Po decisions.md` + contract-01 à 04 + audit-01 à 06. **Pas de code applicatif ici.** Ce document pilote Spec 2 et Spec 3.

---

## 1. Vue d'ensemble

### 1.1 Architecture cible (rappel)

- **Package** `packages/rbac/` = source unique des 107 permissions canoniques + 26 templates (cf. contract-01, contract-02).
- **Backend** : `PermissionsService` résout `role.code → templateKey → permissions` avec cache Redis. `@RequirePermissions(PermissionCode...)` remplace `@Permissions(string...)`. `RolesGuard` et `@Roles()` supprimés (D12).
- **Base de données** : table `roles` unifiée remplace `role_configs`/`permissions`/`role_permissions`. `User.roleId` FK. Enum Prisma `Role` supprimé (D1).
- **Frontend** : `usePermissions()` typée `PermissionCode`. HOC `withAccessControl(permission)` pour gate proactif des pages (D10). Sidebar et matrice admin refactorées (D6 #5, D9).

### 1.2 Séquencement Spec 2 × Spec 3

```
Spec 2 Vague 0 (schema)
     ↓
Spec 2 Vague 1 (backfill + services)
     ↓
Spec 2 Vague 2 (migration déclarative + nouveaux câblages + zero-trust)
     ↓
Spec 2 Vague 3 (tests intégration + couverture)
     ↓
Spec 3 Vagues 1 A-D (frontend refactor)
     ↓
Spec 2 Vague 4 (drop legacy)
```

Spec 3 **peut démarrer après Spec 2 Vague 2** (le backend est stable, les permissions typées sont exposées via `@orchestra/rbac`). Les deux specs peuvent ensuite se poursuivre en parallèle pour les vagues ultérieures.

---

## 2. Allowlist définitive (D2)

Routes **authentifiées sans `@RequirePermissions`** autorisées à passer post-zero-trust.

**Règle** : une route est dans l'allowlist **uniquement si** elle agit sur les ressources **propres** de l'utilisateur courant (`userId === currentUserId` forcé par le service) OU si c'est un endpoint d'introspection auth. Toute autre route mutante/de lecture doit être câblée.

### 2.1 Routes `/auth/*` (5)

| Endpoint | Justification |
|---|---|
| `POST /auth/logout` | Chaque user peut se déconnecter. Aucune donnée tierce touchée. |
| `GET /auth/profile` | Profil personnel. Service force `userId === request.user.id`. |
| `GET /auth/me` | Idem. |
| `GET /auth/me/permissions` | Retourne **uniquement** les permissions du user courant (résolution via `PermissionsService`). Consommé par `useAuthBootstrap` front. |
| `POST /auth/reset-password-token` | Déjà protégé par `@RequirePermissions('users:reset_password')` — hors allowlist, listé ici pour complétude. |

### 2.2 Routes `/personal-todos/*` (4)

| Endpoint | Justification |
|---|---|
| `GET /personal-todos` | Service force `userId = currentUser.id`. Self-service strict. |
| `POST /personal-todos` | Idem. |
| `PATCH /personal-todos/:id` | Idem + check ownership implicite. |
| `DELETE /personal-todos/:id` | Idem. |

### 2.3 Routes `/leaves/me*` (2)

| Endpoint | Justification |
|---|---|
| `GET /leaves/me` | Lecture de ses propres congés. |
| `GET /leaves/me/balance` | Lecture de son propre solde. |

### 2.4 Routes `/time-tracking/me*` (3)

| Endpoint | Justification |
|---|---|
| `GET /time-tracking/me` | Lecture de ses propres saisies. |
| `GET /time-tracking/me/report` | Rapport personnel. |
| `GET /time-tracking` | **Semi-allowlist** : liste sans `userId` → force current user ; liste avec `userId` cross-user → exige `time_tracking:view_any`. Logique dans le service, pas dans le décorateur. **Nécessite harmonisation D8 (coercion au lieu de 403)**. |

### 2.5 Routes `/telework/me*` (2)

| Endpoint | Justification |
|---|---|
| `GET /telework/me/week` | Lecture de son propre télétravail (semaine). |
| `GET /telework/me/stats` | Stats personnelles. |

### 2.6 Routes `/skills/me*` (3)

| Endpoint | Justification |
|---|---|
| `POST /skills/me/assign` | Self-déclaration de compétence. |
| `DELETE /skills/me/remove/:skillId` | Retrait de sa propre compétence. |
| `GET /skills/me/my-skills` | Lecture personnelle. |

### 2.7 Routes `/users/me*` (4)

| Endpoint | Justification |
|---|---|
| `POST /users/me/avatar` | Upload avatar personnel. |
| `PATCH /users/me/avatar/preset` | Sélection preset avatar. |
| `DELETE /users/me/avatar` | Suppression avatar. |
| `PATCH /users/me/change-password` | Changement mot de passe personnel. |

### 2.8 Routes racine (1)

| Endpoint | Justification |
|---|---|
| `GET /` | **`@Public()`** tranché Phase 1. Le handler `AppController.getRoot()` (`apps/api/src/app.controller.ts:6-22`) retourne un payload statique (nom de l'API, version, status, liste d'endpoints publics, message d'accueil). Aucune info user-spécifique, aucune donnée sensible — c'est un hello-world d'API. Déclarer `@Public()` est cohérent avec `GET /health` (ligne 24 du même fichier, déjà public). |

### 2.9 Routes `/leaves/*/request-cancel` (1)

| Endpoint | Justification |
|---|---|
| `POST /leaves/:id/request-cancel` | Demande d'annulation de son propre congé. Service vérifie `leave.userId === currentUser.id`. |

### 2.10 Routes `/leaves/delegations/me` (1)

| Endpoint | Justification |
|---|---|
| `GET /leaves/delegations/me` | Lecture de ses propres délégations. |

### 2.11 Total allowlist

**26 endpoints** (= 5 auth + 4 todos + 2 leaves/me + 3 time-tracking/me + 2 telework/me + 3 skills/me + 4 users/me + 1 racine + 1 leave/request-cancel + 1 delegations/me).

### 2.12 Implémentation

Option retenue : **décorateur `@Public()` sur l'allowlist** uniquement pour les routes auth. Les autres routes self-service gardent la sémantique "authentifié" (`JwtAuthGuard` actif) + `@AllowSelfService()` (nouveau décorateur marqueur, sans effet runtime, juste documentaire pour le zero-trust guard).

```ts
// Nouvelle annotation marquée
export const AllowSelfService = () => SetMetadata(ALLOW_SELF_SERVICE_KEY, true);
```

Le `PermissionsGuard` modifié (post-D2) :

```
if (@Public()) return true;
if (@RequirePermissions) return check normal;
if (@AllowSelfService) return true;  // self-service explicite
return false;  // fail-closed
```

---

## 3. Endpoints à câbler en Spec 2 Vague 2

### 3.1 D3 — 8 endpoints mutants sans `@Permissions` (trous critiques)

| Endpoint | `@RequirePermissions` à ajouter |
|---|---|
| `POST /tasks` | `tasks:create` (OR `create_in_project` OR `create_orphan` — à décider ; service conserve la logique fine) |
| `DELETE /tasks/:id` | `tasks:delete` |
| `POST /leaves` | `leaves:create` |
| `PATCH /leaves/:id` | `leaves:update` |
| `DELETE /leaves/:id` | `leaves:delete` |
| `DELETE /leaves/delegations/:id` | `leaves:manage_delegations` |
| `POST /planning-export/ics/import/preview` | `leaves:create` |
| `POST /planning-export/ics/import` | `leaves:create` |

**Note `POST /tasks`** : la logique service distingue déjà `create_in_project` vs `create_orphan`. Le décorateur peut poser `tasks:create` (plus général) et laisser le service affiner. **Alternative** : utiliser un décorateur `@RequireAnyPermission()` (cf. contract-04 §2.4, NON retenu par défaut). Arbitrer en Spec 2.

### 3.2 D4 Cat B — 7 endpoints de lecture à câbler

| Endpoint | `@RequirePermissions` à ajouter |
|---|---|
| `GET /comments` + `/comments/:id` | `comments:read` |
| `GET /epics` + `/epics/:id` | `epics:read` |
| `GET /holidays` + `/holidays/year/:year` + `/holidays/range` + `/holidays/:id` + `/holidays/working-days/count` | `holidays:read` |
| `GET /milestones` + `/milestones/:id` + `/milestones/project/:projectId/export` + `/milestones/project/:projectId/import-template` | `milestones:read` |
| `GET /school-vacations` + `/school-vacations/range` + `/school-vacations/:id` | `school_vacations:read` |
| `GET /services` + `/services/department/:departmentId` + `/services/:id` + `/services/:id/stats` | `services:read` |
| `GET /settings` + `/settings/category/:category` + `/settings/:key` | `settings:read` |
| `GET /leave-types` + `/leave-types/:id` + `/leave-types/code/:code` | `leaves:read` (référentiel consommé par UI congés) |

**Total routes GET concernées** : ~26 endpoints.

**Impact templates** (§NOTE 2 de contract-02) : certains templates doivent **gagner** les perms `:read` nouvellement câblées. Le contract-02 les intègre déjà. Pas d'action supplémentaire Spec 2 côté data — juste la décoration des controllers.

### 3.3 D6 — 2 bugs de naming backend

| # | Fichier:ligne | Action |
|---|---|---|
| 1 | `projects.controller.ts:88` | Remplacer `@Permissions('admin:access')` par `@RequirePermissions('reports:export')` |
| 2 | `leaves.controller.ts:292` | Remplacer check runtime `permissions.includes('leaves:validate')` par `permissions.includes('leaves:approve')` |

### 3.4 D6 #4 — Nouvelle permission `documents:manage_any`

| Action | Détails |
|---|---|
| Ajout au catalogue | Déjà fait dans contract-01 |
| Ajout aux templates | ADMIN (via CATALOG complet), ADMIN_DELEGATED (via sans 5 exclusions) — déjà fait dans contract-02 |
| Câblage endpoints | Rien à faire : `documents.controller.ts:73, 85` utilisent déjà ce code comme `bypassPermission` dans `@OwnershipCheck` |

### 3.5 D7 — Rename `telework:manage_others` → `telework:manage_any`

| Action | Fichier(s) |
|---|---|
| Code : mise à jour 3 `@OwnershipCheck` | `telework.controller.ts:190, 210, 235` |
| Catalogue | Déjà mis à jour dans contract-01 |
| Templates | Déjà mis à jour dans contract-02 |
| Migration DB | Mise à jour de toute DB `permissions.code` (si conservée transitoirement). Vue l'architecture cible qui supprime cette table en Vague 4, l'impact est limité. |

### 3.6 D8 — Harmonisation `readAll` = coercion partout

| Fichier | Ligne | Changement |
|---|---|---|
| `time-tracking.service.ts` | 191-227 | Remplacer rejet 403 par coercion silencieuse `userId = currentUserId` (aligné sur tasks/leaves/telework/events). |
| Tests | `time-tracking.service.spec.ts` | Mettre à jour les assertions de 403 → pas d'erreur, filtrage silencieux. |

### 3.7 D9 — Protection `isSystem` back

| Fichier | Méthode | Garde à ajouter |
|---|---|---|
| `roles.service.ts` | `updateRole(id, dto)` | `if (role.isSystem) throw new ForbiddenException('Cannot modify system role')` |
| `roles.service.ts` | `deleteRole(id)` | (déjà fait dans l'ancien `RoleManagementService.removeRole`, à conserver) |
| `roles.service.ts` | `createRole(dto)` | Force `isSystem: false` (ignorer input) |

### 3.8 D12 — Migration `@Roles()` → `@RequirePermissions()`

| Fichier | Route | Migration |
|---|---|---|
| `role-management.controller.ts` | `GET/POST/GET/PATCH/DELETE /role-management/roles` + `GET /role-management/permissions` + `PUT /role-management/roles/:id/permissions` + `POST /role-management/seed` | Remplacer `@Roles(Role.ADMIN)` par `@RequirePermissions('users:manage_roles')` |
| Même fichier | `POST /role-management/reset-to-defaults` | Déjà en `@Permissions('users:manage_roles')` — simple rename déclaratif |

---

## 4. Spec 2 — fichiers back à créer/modifier

### 4.1 Vague 0 — Schema & package RBAC

| Action | Chemin |
|---|---|
| CRÉER | `packages/rbac/package.json` |
| CRÉER | `packages/rbac/tsconfig.json` |
| CRÉER | `packages/rbac/src/index.ts` (barrel) |
| CRÉER | `packages/rbac/src/atomic-permissions.ts` (intégration contract-01) |
| CRÉER | `packages/rbac/src/templates.ts` (intégration contract-02) |
| MODIFIER | `pnpm-workspace.yaml` (déjà couvre `packages/*`, vérifier) |
| MODIFIER | `turbo.json` (pipelines build/test) |
| MODIFIER | `apps/api/package.json` (ajouter `@orchestra/rbac: workspace:*`) |
| MODIFIER | `apps/web/package.json` (idem) |
| MODIFIER | `packages/database/prisma/schema.prisma` — ajouter `model Role` (contract-03 §2.1) |
| MODIFIER | `packages/database/prisma/schema.prisma` — ajouter `User.roleId` nullable + relation |
| CRÉER | `packages/database/prisma/migrations/<ts>_add_roles_table/migration.sql` |
| CRÉER | `packages/database/prisma/migrations/<ts>_seed_system_roles/migration.sql` |

### 4.2 Vague 1 — Services & backfill

| Action | Chemin |
|---|---|
| CRÉER | `apps/api/src/rbac/rbac.module.ts` |
| CRÉER | `apps/api/src/rbac/permissions.service.ts` (résolution role.code → templateKey → permissions) |
| CRÉER | `apps/api/src/rbac/permissions.service.spec.ts` |
| CRÉER | `apps/api/src/rbac/roles.service.ts` (CRUD rôles + D9 blocage isSystem) |
| CRÉER | `apps/api/src/rbac/roles.service.spec.ts` |
| CRÉER | `apps/api/src/rbac/roles.controller.ts` (remplace `role-management.controller.ts`) |
| SCRIPT | `packages/database/prisma/migrations/<ts>_backfill_user_role_id/migration.sql` — backfill `users.role_id` depuis `users.role` (enum) via `LEGACY_ROLE_MIGRATION` |
| MODIFIER | `apps/api/src/auth/strategies/jwt.strategy.ts` — adapter validate() pour charger la relation `role` |
| CONSERVER | `apps/api/src/role-management/role-management.service.ts` (temporaire) — sera supprimé en Vague 4 |

### 4.3 Vague 2 — Migration déclarative + nouveaux câblages + zero-trust

| Action | Chemin | Détails |
|---|---|---|
| MODIFIER | `apps/api/src/auth/guards/permissions.guard.ts` | Intégrer D2 (fail-closed) + support `@AllowSelfService()` |
| CRÉER | `apps/api/src/rbac/decorators/require-permissions.decorator.ts` | `@RequirePermissions(PermissionCode...)` |
| CRÉER | `apps/api/src/rbac/decorators/allow-self-service.decorator.ts` | Marqueur pour allowlist |
| MODIFIER | 28 controllers pour migrer `@Permissions` → `@RequirePermissions` | audit-02 §1 pour la liste exhaustive |
| MODIFIER | `apps/api/src/tasks/tasks.controller.ts` | D3 : `@RequirePermissions('tasks:create')` sur `POST /tasks` ; `@RequirePermissions('tasks:delete')` sur `DELETE /tasks/:id` |
| MODIFIER | `apps/api/src/leaves/leaves.controller.ts` | D3 (5 routes) + D6 #2 |
| MODIFIER | `apps/api/src/planning-export/planning-export.controller.ts` | D3 (2 routes) |
| MODIFIER | `apps/api/src/comments/comments.controller.ts` | D4 Cat B : `@RequirePermissions('comments:read')` sur GET routes |
| MODIFIER | `apps/api/src/epics/epics.controller.ts` | D4 Cat B : `epics:read` |
| MODIFIER | `apps/api/src/holidays/holidays.controller.ts` | D4 Cat B : `holidays:read` |
| MODIFIER | `apps/api/src/milestones/milestones.controller.ts` | D4 Cat B : `milestones:read` |
| MODIFIER | `apps/api/src/school-vacations/school-vacations.controller.ts` | D4 Cat B : `school_vacations:read` |
| MODIFIER | `apps/api/src/services/services.controller.ts` | D4 Cat B : `services:read` |
| MODIFIER | `apps/api/src/settings/settings.controller.ts` | D4 Cat B : `settings:read` |
| MODIFIER | `apps/api/src/leave-types/leave-types.controller.ts` | D4 Cat B : `leaves:read` |
| MODIFIER | `apps/api/src/telework/telework.controller.ts` | D7 : rename 3 bypassPermission |
| MODIFIER | `apps/api/src/time-tracking/time-tracking.service.ts` | D8 : coercion |
| MODIFIER | `apps/api/src/projects/projects.controller.ts` | D6 #1 : `admin:access` → `reports:export` |
| MODIFIER | `apps/api/src/leaves/leaves.controller.ts` | D6 #2 : `leaves:validate` → `leaves:approve` |
| MODIFIER | `apps/api/src/role-management/role-management.controller.ts` | D12 : `@Roles()` → `@RequirePermissions()` |
| MODIFIER | Ajouter `@AllowSelfService()` aux 26 endpoints de la §2 allowlist | |

### 4.4 Vague 3 — Tests

| Action | Chemin |
|---|---|
| ADAPTER | `apps/api/src/auth/guards/permissions.guard.spec.ts` — couvrir invariants P1-P8 post-refactor + cas fail-closed |
| SUPPRIMER | `apps/api/src/auth/guards/roles.guard.spec.ts` (en Vague 4) |
| CRÉER | `apps/api/src/rbac/permissions.service.spec.ts` avec tests P1-P8 + granularité |
| CRÉER | Tests intégration pour chaque endpoint câblé en Vague 2 (403 sans perm, 200 avec perm) |
| CRÉER | Test migration : chaque libellé DB legacy → template cible correct (LEGACY_ROLE_MIGRATION) |
| CRÉER | Test `documents:manage_any` bypass OwnershipGuard présent et fonctionnel |
| CRÉER | Test D9 : `PATCH /roles/:id` sur role `isSystem=true` → 403 |

### 4.5 Vague 4 — Drop legacy

| Action | Chemin |
|---|---|
| SUPPRIMER | `apps/api/src/auth/guards/roles.guard.ts` (D12) |
| SUPPRIMER | `apps/api/src/auth/guards/roles.guard.spec.ts` (D12) |
| SUPPRIMER | `apps/api/src/auth/decorators/roles.decorator.ts` (D12) |
| SUPPRIMER | `apps/api/src/role-management/role-management.module.ts` (remplacé par `rbac.module.ts`) |
| SUPPRIMER | `apps/api/src/role-management/role-management.service.ts` |
| SUPPRIMER | `apps/api/src/role-management/role-management.controller.ts` |
| SUPPRIMER | `apps/api/src/auth/decorators/permissions.decorator.ts` (ancien `@Permissions`, toutes occurrences migrées) |
| MODIFIER | `packages/database/prisma/schema.prisma` — supprimer `enum Role` + `User.role` + models `Permission`, `RoleConfig`, `RolePermission` |
| CRÉER | Migration SQL : `DROP COLUMN users.role`, `DROP TYPE Role`, `DROP TABLE role_permissions`, `DROP TABLE permissions`, `DROP TABLE role_configs` |

---

## 5. Spec 3 — fichiers front à créer/modifier

### 5.1 Vague 1 A — Types & hook

| Action | Chemin | Détails |
|---|---|---|
| MODIFIER | `apps/web/src/hooks/usePermissions.ts` | Typage `PermissionCode` strict + sélecteurs atomiques Zustand (perf) |
| MODIFIER | `apps/web/src/stores/auth.store.ts` | Shape `user.role` → objet (id, code, label, templateKey) |
| MODIFIER | `apps/web/src/types/index.ts` | Mise à jour interface `User` |
| SUPPRIMER | `apps/web/src/types/index.ts` — enum `Role` (legacy) |
| CRÉER | `apps/web/src/components/withAccessControl.tsx` — HOC D10 |

### 5.2 Vague 1 B — Sidebar

| Action | Chemin | Détails |
|---|---|---|
| MODIFIER | `apps/web/src/components/MainLayout.tsx` | D6 #5 : `users:manage` → `users:read` ; typage `PermissionCode` partout |

### 5.3 Vague 1 C — Checks granulaires

| Action | Chemin | Détails |
|---|---|---|
| MODIFIER | `apps/web/src/components/predefined-tasks/AssignmentModal.tsx` | D6 #3 : `predefined_tasks:manage` → `predefined_tasks:edit` |
| MODIFIER | ~25 fichiers `app/[locale]/*/page.tsx` | Appliquer `withAccessControl(permission)` aux pages privilégiées (cf. audit-04 §4) |
| MODIFIER | Composants qui consomment `user.role` directement (ex. `admin/roles/page.tsx:190`) | Passer par `user.role.code` ou `useHasAnyOfTemplates` |

### 5.4 Vague 1 D — Nouvelle galerie de templates (admin)

| Action | Chemin | Détails |
|---|---|---|
| SUPPRIMER | `apps/web/app/[locale]/admin/roles/page.tsx` (786 lignes inline actuelles) | Remplacé par galerie de templates |
| CRÉER | `apps/web/app/[locale]/admin/roles/page.tsx` | Gallerie templates (read-only pour system roles, création custom possible) |
| CRÉER | `apps/web/src/components/roles/TemplateGalleryCard.tsx` | Card d'un template (badge couleur par catégorie) |
| CRÉER | `apps/web/src/components/roles/RoleFromTemplateModal.tsx` | Form "Créer rôle custom depuis template" |
| CRÉER | `apps/web/src/components/roles/SystemBadge.tsx` | Badge "Rôle système" réutilisable |
| CRÉER | `apps/web/src/components/roles/UserRoleSelect.tsx` | Sélecteur rôle extrait de users/page.tsx |
| MODIFIER | `apps/web/src/services/role-management.service.ts` | Renommer en `roles.service.ts`, simplifier API (pas de `replaceRolePermissions`) |

### 5.5 Vague 1 E — Tests E2E

| Action | Chemin | Détails |
|---|---|---|
| CRÉER | `e2e/fixtures/permission-matrix.ts` | Mise à jour : couvrir les 26 templates au lieu des 6 rôles actuels |
| CRÉER | `e2e/rbac/templates.spec.ts` | Pour chaque template : visibilité sidebar, pages accessibles, boutons |
| CRÉER | `e2e/rbac/zero-trust.spec.ts` | Vérifier 403 sur endpoints non câblés (audit de régression) |
| CRÉER | `e2e/rbac/system-role-immutable.spec.ts` | D9 : tentative de modification d'un rôle système → bloqué côté UI et côté API |

---

## 6. Critères d'acceptation globaux

Validation de la fin de Spec 3 (refonte RBAC complète).

### 6.1 Migration sans régression

- [ ] Chaque user prod existant a exactement le même set de permissions effectives post-migration que pré-migration (aux extensions D4 Cat B près — documentées §NOTE 2 de contract-02).
- [ ] Aucun libellé DB legacy n'est perdu : les 15 rôles historiques sont mappés vers leur template cible.
- [ ] Les éventuels `role_configs` avec `isSystem=false` présents en DB prod au moment de la migration sont traités selon la procédure §8 (extension de `LEGACY_ROLE_MIGRATION` si leur permission set correspond à un cluster existant, STOP + arbitrage PO sinon). À date : zéro cas détecté dans la prod CPAM.

### 6.2 Sécurité (zero-trust)

- [ ] Aucune route applicative accessible sans `@Public()`, `@RequirePermissions(...)` ou `@AllowSelfService()`.
- [ ] Les 8 endpoints mutants précédemment non protégés (D3) renvoient 403 pour un user sans la perm requise.
- [ ] Les 5 bugs de naming (D6) sont corrigés et les routes fonctionnent.
- [ ] Zero route front conditionne son affichage sur un code permission inconnu du back.
- [ ] `request.user.role.code` est la source unique du rôle côté guards (SEC-03 préservé).

### 6.3 Fonctionnel

- [ ] ADMIN conserve accès à toutes les features.
- [ ] ADMIN_DELEGATED garde tout sauf `users:manage_roles`, `settings:update` et `leaves:manage_any` (104 permissions). Les droits sur `holidays:*` et `school_vacations:*` sont préservés (décision PO 2026-04-19 : pas de régression vs RESPONSABLE actuel).
- [ ] MANAGER / PROJECT_LEAD / BASIC_USER ont leurs droits habituels (tests E2E templates).
- [ ] OBSERVATEUR (→ OBSERVER_FULL) conserve la vue lecture large (settings:read, users:read inclus — décision D11 préservée).
- [ ] Le filtre `readAll` coerce silencieusement partout (D8 — plus de 403 surprise côté time-tracking).

### 6.4 UI admin

- [ ] L'ancienne matrice de permissions éditable a disparu.
- [ ] La nouvelle galerie affiche les 26 templates groupés par catégorie.
- [ ] Les rôles système ne sont ni éditables ni supprimables (D9) — badges + boutons désactivés.
- [ ] L'admin peut créer un rôle custom en choisissant un templateKey.
- [ ] L'admin peut renommer le libellé d'un rôle custom sans toucher aux permissions.
- [ ] La sidebar affiche les bons items pour chaque template (test matrice E2E).

### 6.5 Performance

- [ ] Cache Redis `role-permissions:<code>` hit rate > 95 % en prod (TTL 5min inchangé).
- [ ] `usePermissions` front : aucun re-render inutile sur changement `isLoading` / `displayCache` (sélecteurs atomiques implémentés).

### 6.6 Tests

- [ ] `pnpm test` passe sur `apps/api` et `apps/web`.
- [ ] `pnpm run test:e2e` passe pour les 26 templates (matrice complète).
- [ ] Couverture de tests unitaires `PermissionsGuard` ≥ 90 % (invariants S1-S5 et P1-P8 couverts).
- [ ] Test intégration backfill : sur une DB dump de prod, exécuter le script de migration et vérifier qu'aucun user ne perd de droit.

### 6.7 Documentation

- [ ] `CLAUDE.md` mis à jour avec le nouveau nom du décorateur (`@RequirePermissions`).
- [ ] `docs/rbac/ROLES-PERMISSIONS.md` régénéré depuis la nouvelle DB (107 permissions, 26 templates).
- [ ] Le `README.md` de `packages/rbac` décrit l'API publique.

---

## 7. Ordre d'exécution recommandé (checklist)

### Spec 2

1. **V0** : schema Prisma + `model Role` + `User.roleId` nullable + package `@orchestra/rbac` + seed 26 rôles système.
2. **V1** : services `PermissionsService` + `RolesService`, backfill `users.role_id`, validation DB.
3. **V2** : migration déclarative `@Permissions → @RequirePermissions`, câblage D3/D4 Cat B/D6, activation zero-trust, D8 coercion, D12 dernière migration `@Roles()`.
4. **V3** : tests (matrice complète + invariants + migration).
5. **Déploiement prod** de la V0–V3 → validation 1 semaine avant V4.
6. **V4** : drop legacy (enum `Role`, `@Roles()`, `RolesGuard`, tables `permissions`/`role_configs`/`role_permissions`, colonne `users.role`).

### Spec 3 (en parallèle après Spec 2 V2 stable)

1. **V1 A** : types + hook refactorés + HOC `withAccessControl`.
2. **V1 B** : sidebar (fix `users:manage`).
3. **V1 C** : checks granulaires dans tous les composants + `withAccessControl` sur pages privilégiées.
4. **V1 D** : nouvelle galerie templates admin.
5. **V1 E** : tests E2E matrice 26 templates.

---

## 8. Points d'attention transversaux

- **Backup prod obligatoire** avant Spec 2 V0 (création `model Role`), V1 (backfill) et V4 (drop legacy). Cf. memory `feedback_verify_before_destructive_prod_changes`.
- **Déploiement V4 séparé** (pas la même release que V0-V3) : la suppression physique de colonnes et enums est irréversible sans dump.
- **Cache Redis** : en cas de déploiement back + front synchrone, prévoir un `FLUSHDB` de la clé `role-permissions:*` pour éviter les résolutions obsolètes.
- **Memory read** : `feedback_deploy_workflow_is_fake` — le déploiement prod nécessite SSH réel sur VPS + rebuild Docker, pas un GitHub Action seul.
- **Rôles `isSystem=false` en prod (cas éventuel)** : si la DB prod contient des `role_configs` avec `isSystem=false`, dumper leur libellé et leur permission set **avant migration**. Deux cas :
  - Leur permission set correspond exactement à l'un des 8 clusters actuels (ADMIN/RESPONSABLE/MANAGER/CHEF_DE_PROJET/cluster 5/REFERENT_TECHNIQUE/OBSERVATEUR/cluster 8) → extension triviale de `LEGACY_ROLE_MIGRATION` dans `contract-02-templates.ts` : ajouter une entrée `{<code>: <templateCible>}` pour préserver le libellé dans la nouvelle table `roles`, `isSystem=false`.
  - Leur permission set ne correspond à aucun cluster → **STOP migration et arbitrage PO**. Le nouveau modèle n'accepte pas de permission set sur-mesure ; l'admin devra choisir un template existant quitte à ajuster manuellement les droits de quelques users post-migration.
  - À date (audit 2026-04-19), zéro rôle `isSystem=false` détecté dans la DB prod CPAM (cf. fichiers roles-permissions.json et rbac-dump.sql uploadés en Phase 0). Le cas est documenté pour robustesse future, pas parce qu'il se présente aujourd'hui.

---

## 9. Counts de référence post-arbitrages (normatif)

Les counts « ≈ » du design doc `rbac-templates-library-design.md` §4 étaient indicatifs, rédigés **pré-arbitrages** D4/D5/D6/D7/§NOTE 2/§NOTE 3 + corrections PO 2026-04-19. Les counts **normatifs** pour la validation Spec 2/Spec 3 sont ceux de `contract-02-templates.ts`, calculés mécaniquement à l'exécution.

Source : script `_count-templates.mts` (exécution du 2026-04-19 post-corrections PO, sur les branches finales de `contract-01-atomic-permissions.ts` et `contract-02-templates.ts`).

**Catalogue total** : 107 permissions.

| Template | Nb permissions |
| --- | ---: |
| `ADMIN` | 107 |
| `ADMIN_DELEGATED` | 104 |
| `PORTFOLIO_MANAGER` | 73 |
| `MANAGER` | 79 |
| `MANAGER_PROJECT_FOCUS` | 72 |
| `MANAGER_HR_FOCUS` | 45 |
| `PROJECT_LEAD` | 62 |
| `PROJECT_LEAD_JUNIOR` | 59 |
| `TECHNICAL_LEAD` | 45 |
| `PROJECT_CONTRIBUTOR` | 54 |
| `PROJECT_CONTRIBUTOR_LIGHT` | 46 |
| `FUNCTIONAL_REFERENT` | 41 |
| `HR_OFFICER` | 38 |
| `HR_OFFICER_LIGHT` | 20 |
| `THIRD_PARTY_MANAGER` | 52 |
| `CONTROLLER` | 27 |
| `BUDGET_ANALYST` | 17 |
| `DATA_ANALYST` | 14 |
| `IT_SUPPORT` | 28 |
| `IT_INFRASTRUCTURE` | 33 |
| `OBSERVER_FULL` | 24 |
| `OBSERVER_PROJECTS_ONLY` | 20 |
| `OBSERVER_HR_ONLY` | 13 |
| `BASIC_USER` | 28 |
| `EXTERNAL_PRESTATAIRE` | 43 |
| `STAGIAIRE_ALTERNANT` | 27 |

**Règle** : ce tableau est **régénéré** à chaque modification de `contract-01` ou `contract-02`, via `node --experimental-strip-types backlog/rbac-refactor/contract/_count-templates.mts` (le script utilise les imports avec extension `.ts` — prévoir un wrapper ou transformation pour l'exécution si la résolution de modules change). Les tests d'intégration Spec 2 Vague 3 doivent comparer à ces counts et non aux valeurs ≈ du design doc.

### 9.1 Écarts volontaires vs counts « ≈ » du design doc

| Template | Design doc ≈ | Normatif | Écart | Cause |
|---|---:|---:|---:|---|
| ADMIN | 119 | 107 | −12 | D4 A (10) + D5 (2) + D4 C (1) − D6 #4 (+1) = −12 |
| ADMIN_DELEGATED | 116 | 104 | −12 | idem ADMIN, conserve holidays:write (Correction PO 2026-04-19) et exclut leaves:manage_any |
| PORTFOLIO_MANAGER | 85 | 73 | −12 | D4 Cat A drops + corrections PO (time_tracking:declare_for_third_party) |
| MANAGER | 80 | 79 | −1 | Net : D4 A drops compensés par gains D4 Cat B + corrections PO (users:manage, time_tracking:declare_for_third_party, settings:read) |
| MANAGER_PROJECT_FOCUS | 65 | 72 | +7 | Gains D4 Cat B + corrections PO dominent |
| MANAGER_HR_FOCUS | 40 | 45 | +5 | Gains D4 Cat B |
| PROJECT_LEAD | 60 | 62 | +2 | Gains D4 Cat B + time_tracking:declare_for_third_party |
| PROJECT_LEAD_JUNIOR | 45 | 59 | +14 | Gains D4 Cat B (nouveau socle collaboration universel) |
| TECHNICAL_LEAD | 41 | 45 | +4 | Gains D4 Cat B |
| PROJECT_CONTRIBUTOR | 52 | 54 | +2 | Gains D4 Cat B compensent drops D4 A |
| PROJECT_CONTRIBUTOR_LIGHT | 30 | 46 | +16 | Gains D4 Cat B majeurs |
| FUNCTIONAL_REFERENT | 35 | 41 | +6 | Gains D4 Cat B |
| HR_OFFICER | 40 | 38 | −2 | D4 A drops > gains D4 Cat B |
| HR_OFFICER_LIGHT | 20 | 20 | 0 | Équilibre |
| THIRD_PARTY_MANAGER | 35 | 52 | +17 | Gains D4 Cat B + corrections |
| CONTROLLER | 45 | 27 | −18 | Redéfinition post-D5 (analytics:* supprimées, set resserré) |
| BUDGET_ANALYST | 20 | 17 | −3 | idem |
| DATA_ANALYST | 15 | 14 | −1 | idem |
| IT_SUPPORT | 30 | 28 | −2 | D4 A drops |
| IT_INFRASTRUCTURE | 35 | 33 | −2 | idem |
| OBSERVER_FULL | 31 | 24 | −7 | D4 A drops (6 view variants) + D5 (1 analytics:read) |
| OBSERVER_PROJECTS_ONLY | 18 | 20 | +2 | Gains D4 Cat B |
| OBSERVER_HR_ONLY | 15 | 13 | −2 | D4 A drops (leaves:view, telework:view) |
| BASIC_USER | 23 | 28 | +5 | Gains D4 Cat B (collaboration + calendar + services universels) |
| EXTERNAL_PRESTATAIRE | 25 | 43 | +18 | Dérivation post-corrections via PROJECT_CONTRIBUTOR_LIGHT |
| STAGIAIRE_ALTERNANT | 18 | 27 | +9 | Gains D4 Cat B |

Aucun écart ne reflète une régression de droit métier (vérifié par script `_migration-fidelity.mts` — 0 régression sur les 15 rôles legacy). Les gains reflètent soit l'extension D4 Cat B (« câblage quasi-universel »), soit les corrections PO 2026-04-19.
