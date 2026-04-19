# Audit 06 — Synthèse & risques

> Phase 0, §1.6 — Synthèse du dossier d'audit (fichiers 01 → 05) + contraintes et risques pour Spec 2 (backend) et Spec 3 (frontend).

---

## 1. Permissions mortes — liste définitive à supprimer en Spec 2

### 1.1 Catégorie A — Doublons `:view` / `:edit` non consommés (10 permissions)

La variante `:read` (ou `:update`) est consultée partout ; la variante `:view` (ou `:edit`) n'apparaît **que dans le seed** `role-management.service.ts`. À supprimer sans risque.

| # | Permission morte | Variante conservée | Preuve |
|---|---|---|---|
| 1 | `departments:edit` | `departments:update` | seed `:374` uniquement |
| 2 | `departments:view` | `departments:read` | seed `:367` uniquement |
| 3 | `projects:edit` | `projects:update` | seed `:344` uniquement |
| 4 | `projects:view` | `projects:read` | seed `:337` uniquement |
| 5 | `skills:edit` | `skills:update` | seed `:389` uniquement |
| 6 | `skills:view` | `skills:read` | seed `:382` uniquement |
| 7 | `users:edit` | `users:update` | seed `:359` uniquement |
| 8 | `users:view` | `users:read` | seed `:352` uniquement |
| 9 | `leaves:view` | `leaves:read` | seed `:322` uniquement |
| 10 | `telework:view` | `telework:read` | seed `:329` uniquement |

### 1.2 Catégorie B — Permissions de lecture orphelines (9 permissions)

Endpoints de lecture qui ne vérifient rien → permissions du catalogue jamais consultées.

| # | Permission | Raison |
|---|---|---|
| 11 | `comments:read` | GET `/comments` + `/comments/:id` non gardés |
| 12 | `epics:read` | GET `/epics` + `/epics/:id` non gardés |
| 13 | `holidays:read` | 5 endpoints `/holidays*` GET non gardés |
| 14 | `milestones:read` | 4 endpoints `/milestones*` GET non gardés |
| 15 | `school_vacations:read` | 3 endpoints `/school-vacations*` GET non gardés |
| 16 | `services:read` | 4 endpoints `/services*` GET non gardés |
| 17 | `settings:read` | 3 endpoints `/settings*` GET non gardés |
| 18 | `analytics:read` | Remplacée partout par `reports:view` |
| 19 | `analytics:export` | Remplacée partout par `reports:export` |

**Deux choix pour Spec 2** :
- (a) Supprimer ces permissions (cohérent avec l'usage réel : lecture ouverte à tout user loggué).
- (b) Les **câbler** : ajouter `@Permissions('comments:read')` etc. sur les GET concernés — pose la question métier (veut-on vraiment contraindre la lecture ?).

### 1.3 Catégorie C — Permissions jamais vérifiées, à arbitrer (2 permissions)

| # | Permission | Cas |
|---|---|---|
| 20 | `tasks:delete` | `DELETE /tasks/:id` n'utilise pas `@Permissions`. À **câbler** (cohérent avec le reste du CRUD) ou à **supprimer** si la décision est de garder la protection service-side uniquement. |
| 21 | `telework:manage_recurring` | Attribuée à 4 rôles mais jamais vérifiée. Les endpoints `/telework/recurring-rules*` utilisent `telework:create/update/delete/read`. À **supprimer** sauf si on veut un contrôle séparé des règles récurrentes. |

### 1.4 Catégorie D — Permissions vérifiées uniquement via scope-filter service

**5 permissions** qui ne sont pas dans `@Permissions()` mais utilisées dans la logique service :
`tasks:readAll`, `leaves:readAll`, `telework:readAll`, `events:readAll`, `leaves:manage_any`.

**À conserver** — elles sont opérationnelles. Choix de cohérence Phase 1 : migrer en `@Permissions()` déclaratif ou garder en scope-filter ?

---

## 2. Endpoints à corriger en priorité (trous de sécurité)

### 2.1 Endpoints mutants sans `@Permissions` (risque critique)

Une route mutante sans `@Permissions()` est accessible à **tout utilisateur authentifié**. La protection dépend entièrement de la logique service (checks runtime). À couvrir en Spec 2 avec tests de non-régression avant refactor.

| # | Endpoint | Risque |
|---|---|---|
| 1 | `POST /tasks` | Création tâche sans check RBAC déclaratif. Service vérifie `tasks:create_in_project`/`tasks:create_orphan` runtime. |
| 2 | `DELETE /tasks/:id` | Permission `tasks:delete` existe mais jamais utilisée. |
| 3 | `POST /leaves` | Création congé sans check. |
| 4 | `PATCH /leaves/:id` | Modification sans `@Permissions`, ownership déléguée au service. |
| 5 | `DELETE /leaves/:id` | Suppression sans `@Permissions`. |
| 6 | `DELETE /leaves/delegations/:id` | Aucune garantie RBAC. |
| 7 | `POST /planning-export/ics/import/preview` | Import ICS sans garde. |
| 8 | `POST /planning-export/ics/import` | Import ICS sans garde. |

### 2.2 Codes de permissions inexistants référencés (bugs bloquants)

| # | Code | Emplacement | Impact |
|---|---|---|---|
| 9 | `admin:access` | `projects.controller.ts:88` (`@Permissions`) | `POST /projects/snapshots/capture` refusé à **tous** — endpoint mort |
| 10 | `leaves:validate` | `leaves.controller.ts:292` (check runtime) | Route `/leaves/balance/:userId` bloquée pour rôles légitimes. Typo probable pour `leaves:approve`. |
| 11 | `predefined_tasks:manage` | `AssignmentModal.tsx:250` (front) | Lien "Configurer" masqué pour tous sauf ADMIN |
| 12 | `documents:manage_any` | `documents.controller.ts:73, 85` (`bypassPermission`) | Permission absente du catalogue → bypass ne peut jamais s'activer |
| 13 | `users:manage` | `MainLayout.tsx:54` (sidebar front) | Item "Users" invisible pour tout non-ADMIN même avec `users:create`/`users:update` |

### 2.3 Endpoints de lecture non gardés

Liste non reproduite ici (cf. audit-02 §5.2) : environ **26 routes GET** de modules comptant une `:read` au catalogue mais non vérifiée (`/comments`, `/epics`, `/holidays*`, `/milestones*`, `/school-vacations*`, `/services*`, `/settings*`). À trancher : câbler ou déclarer ouvertes.

### 2.4 Incohérences front/back masquant des trous

| Permission | Front check | Back check | Effet |
|---|---|---|---|
| `tasks:create_orphan` | Oui | Non | Utilisateur sans la perm peut faire `POST /tasks` avec succès |
| `tasks:create_in_project` | Oui | Non | idem |
| `tasks:assign_any_user` | Oui | Service seulement | Contournable via HTTP direct |
| `time_tracking:declare_for_third_party` | Oui | Non | Contournable |
| `leaves:declare_for_others` | Oui | Service seulement | Contournable |

---

## 3. Contraintes techniques sur le refactor backend (Spec 2)

### 3.1 Architecture des guards — stable et saine

- 5 guards globaux via `APP_GUARD`, ordre d'exécution déterministe (`ThrottlerBehindProxyGuard` → `JwtAuthGuard` → `RolesGuard` → `PermissionsGuard` → `OwnershipGuard`).
- `RolesGuard` bypass automatique quand `@Permissions` présent.
- `OwnershipGuard` opt-in via `@OwnershipCheck` — 15 routes instrumentées.
- Pas de `@UseGuards` manuel nécessaire dans les controllers hormis 3 cas redondants (à nettoyer — cf. audit-01 §3.4).

### 3.2 Cache Redis du RBAC — fail-soft

- `role-permissions:<CODE>` TTL 5min via `RoleManagementService.getPermissionsForRole`.
- **Fail-soft en cas de panne Redis** (warning console, exécution continue → chaque requête touche la DB).
- Invalidation explicite après `replaceRolePermissions`, `removeRole`, seed ayant ajouté des permissions.
- **Spec 2 doit préserver** ce pattern (critique perf en prod) et idéalement migrer vers un circuit breaker/Sentry alert sur erreur Redis.

### 3.3 Ownership — indépendant du RBAC (à préserver tel quel)

- `OwnershipService` : 100% FK Prisma, aucun couplage `role_permissions`. Refactor RBAC sans impact.
- `OwnershipGuard` : couplé uniquement via `bypassPermission` → réceptif au refactor.
- **6 resources** : `leave`, `telework`, `timeEntry`, `project`, `event`, `document`.

### 3.4 Scope périmètre services — pur FK

- `getManagedUserIds` dans `leaves.service.ts:80-115` : pur FK (`Service.managerId`, `UserService`).
- **Dupliqué 4× à la main** dans le même fichier (create, getPendingForValidator, getSubordinates, canValidate).
- **Opportunité Spec 2** : extraire en `ScopeService` générique réutilisable par tasks/telework/events/time-tracking (où le scope n'existe pas encore, mais est pertinent métier).

### 3.5 Seed idempotent — garde-fou à préserver

- `seedPermissionsAndRoles` appelé à chaque `onModuleInit`.
- Idempotent (`createMany ... skipDuplicates`) — n'écrase jamais les perms ajoutées manuellement.
- **Mémoire opérationnelle** (`project_rbac_seed_silent_skip`) : le seed a déjà "silently skipped" des permissions manquantes en prod (log `0 added` alors que la DB était incomplète). Spec 2 doit ajouter un **diag post-seed** qui compare l'état DB au référentiel attendu.
- Mode force (`resetRolesToDefaults`) disponible via `POST /role-management/reset-to-defaults` mais **non exposé dans l'UI**.

### 3.6 Enum `Role` Prisma vs RoleConfig dynamique — incohérence à trancher

Le champ `User.role` est typé via enum Prisma figé (15 valeurs). Mais `RoleConfig` permet de créer des rôles custom (`isSystem: false`). **Impossible aujourd'hui d'assigner un rôle custom à un user** (enum Prisma rejette).

**Décision structurante pour Spec 2** :
- Option (a) : garder l'enum Prisma figé, abandonner les rôles custom (alignement avec la philosophie "templates").
- Option (b) : migrer `User.role` vers une string libre (FK vers `RoleConfig.code`).
- Option (c) : migrer vers FK `roleId → roles.id` (design doc §5 de `rbac-templates-library-design.md` prévoit cette table unifiée).

### 3.7 Fail-open vs zero-trust

`PermissionsGuard` laisse passer toute route sans `@Permissions()`. Conséquence : **63 routes authentifiées sans RBAC**, dont 33 oublis probables. Décision structurante Spec 2 : inverser la convention en **fail-closed** (toute route privée doit `@Public()` ou `@Permissions()`).

### 3.8 `@Permissions` typé `string[]` ouvert

Aucune union type stricte. Typo silencieuse produit un 403. Spec 2 devrait introduire `type PermissionCode = …` compilable (issu de `contract-01-atomic-permissions.ts` Phase 1).

### 3.9 `@Roles()` quasi-déprécié

1 seule occurrence restante (`role-management.controller.ts`). Formaliser la dépréciation et migrer la dernière route vers `@Permissions('users:manage_roles')`.

---

## 4. Contraintes techniques sur le refactor frontend (Spec 3)

### 4.1 Hook `usePermissions` consommé à **80 endroits**

Refactor à coordonner en une passe (pas de migration graduelle possible sur la même branche).

### 4.2 Pattern actuel — destructuration sans sélecteur (perf)

- `usePermissions` destructure le store sans sélecteur → chaque changement de `isLoading` / `displayCache` / `setUser` re-render tous les consumers.
- Spec 3 doit migrer vers sélecteurs atomiques et mémoïser les handlers.

### 4.3 Sidebar inline — à refactorer

`MainLayout.tsx` contient la liste de navigation **en dur** avec les permissions associées. Spec 3 doit refactorer pour aligner sur le contrat Phase 1 (constantes atomiques + types).

### 4.4 Aucune route guard côté Next.js

- Uniquement `<AuthProvider>` global + 2 redirects ad-hoc (settings, admin/roles).
- **Toutes les pages privilégiées sont accessibles par URL directe** — la sécurité repose 100% sur les guards backend.
- Spec 3 doit décider : rester sur ce modèle (cosmetic UI + back authoritative) OU ajouter un `withAccessControl(permissionCode)` HOC pour rediriger proactivement.

### 4.5 UI admin roles — à démanteler largement

Cf. audit-05 : tout est coalescé dans `admin/roles/page.tsx` (786 lignes, inline), aucune externalisation. Composants à **JETER** (matrice, edit modal), **REFACTORER** (create, confirm delete, table, sélecteur), **CONSERVER** (badge système).

### 4.6 Faille `isSystem` sur la matrice de permissions

L'UI permet actuellement de **réécrire** les permissions d'un rôle système (ADMIN, RESPONSABLE, etc.) via `PUT /role-management/roles/:id/permissions`. Aucune garde ni front ni back. Le seed non-force ne restaurera pas automatiquement. Spec 3 doit bloquer cette action OU assumer + rollback UI.

### 4.7 Sélecteur `<select role>` — interop enum figé / RoleConfig dynamique

`users/page.tsx:819-831 / 1214-1226` cast `formData.role as Role` — incompatible avec rôles custom. Dépend de la décision §3.6.

---

## 5. Risques de régression — scénarios de test à couvrir en Spec 2/3

### 5.1 RBAC fonctionnel (Spec 2, tests d'intégration)

- Chaque endpoint protégé par `@Permissions(X)` : test avec un user sans X (attendu 403), test avec un user ayant X (attendu 200).
- Endpoints ownership : test avec owner (200), non-owner sans bypass (403), non-owner avec bypass (200).
- `readAll` vs `read` : test coercion silencieuse (tasks/leaves/telework/events) ET rejet 403 (time-tracking) — décider d'un pattern unique et couvrir.
- Seed idempotent : diagnostic post-seed DB vs référentiel, aucune perte/ajout non attendu.

### 5.2 Migration données (Spec 2, tests de migration)

- Chaque user avant migration doit conserver **exactement** le même set de permissions après (design doc §5 : "aucune régression"). Tests : dump pre-migration, run migration, dump post-migration, diff permissions par user.
- Permissions mortes supprimées : aucun user ne perd un droit effectif (parce que ces permissions n'étaient jamais consultées).
- Rôles custom (`isSystem: false`) : décider de leur traitement (migration vers template ou conservation en custom-role post-migration).

### 5.3 UI frontend (Spec 3, tests Playwright E2E)

- Permission matrix E2E pour chaque template : vérifier visibilité items sidebar, boutons d'action, pages accessibles.
- Redirect settings page pour non-admin.
- Sélecteur de rôle utilisateur : option disponibles cohérentes avec les rôles instanciés.
- Cas `users:manage` → `users:read` (sidebar) : vérifier que le fix affiche l'item pour les nouveaux templates qui ont cette permission.
- Cas `predefined_tasks:manage` : vérifier que le lien "Configurer" s'affiche correctement après le fix.

### 5.4 Sécurité (Spec 2, tests d'intrusion manuels ou scripts)

- Script de fuzzing : pour chaque endpoint mutant, tester avec un user minimal (OBSERVER_FULL) et vérifier 403.
- Détection régression : chaque PR touchant un controller doit prouver que les `@Permissions` sont présents (CI lint custom).

---

## 6. Incertitudes restantes à arbitrer avec le PO avant Spec 2

1. **`admin:access`** (projects.controller.ts:88) : endpoint `/projects/snapshots/capture` actuellement mort. Créer la permission, la renommer (`reports:export` ?), ou supprimer l'endpoint ?

2. **`leaves:validate`** (runtime leaves.controller.ts:292) : typo pour `leaves:approve` ? Ou permission à créer ? La route `/leaves/balance/:userId` est bloquée silencieusement aujourd'hui.

3. **`documents:manage_any`** : créer la permission (avec attribution aux rôles ADMIN/RESPONSABLE) ou remplacer par un autre bypass ? Les 2 endpoints `documents` perdent la fonctionnalité de bypass tant que ce n'est pas résolu.

4. **`predefined_tasks:manage`** (front) : remplacer par `predefined_tasks:edit` ou `:create` ? Impact UX direct.

5. **`users:manage`** (front) : remplacer par `users:read` (trivial) ? Impact UX direct — sans ce fix, la sidebar "Users" reste réservée à ADMIN.

6. **`analytics:*` vs `reports:*`** : fusionner en un seul module ? Aujourd'hui `analytics:read`/`analytics:export` sont orphelines, `reports:view`/`reports:export` gouvernent les endpoints `/analytics/*`. Proposition : supprimer `analytics:*` et garder `reports:*`.

7. **Routes self-service (`/me/*`, `/personal-todos/*`, etc.)** : formaliser la liste des routes qui **doivent** rester sans `@Permissions` (self-service légitime). Tout le reste devrait être gardé.

8. **`POST /tasks` + `DELETE /tasks/:id`** : convention à trancher — `@Permissions` déclaratif (proposition : `@Permissions('tasks:create')` et `@Permissions('tasks:delete')`) ou logique service uniquement ?

9. **`readAll` pattern** : coercition silencieuse (tasks/leaves/telework/events) vs 403 explicite (time-tracking). Unifier : quel comportement ? Proposition : coercion (meilleure UX, pas de 403 surprise).

10. **`permissions.guard.ts` fail-open** : inversion en zero-trust ? Impact : toute route actuellement non protégée devient inaccessible jusqu'à ajout de `@Public()` ou `@Permissions()`. Migration risquée mais posture sécurité préférable.

11. **Enum Prisma `Role` vs rôles dynamiques** : option (a) figer, (b) string libre, (c) migration vers table `roles` unifiée (design doc §5). Décision structurante qui conditionne toute la Spec 2.

12. **`isSystem` verrouillage** : Spec 3 bloque-t-elle la modification des rôles système par l'UI ou prévoit-elle un rollback explicite ? Proposition : bloquer complètement (cohérent avec philosophie templates).

13. **`telework:manage_others`** vs **`*:manage_any`** : harmoniser la convention nominale ? Proposition : renommer en `telework:manage_any` pour cohérence (impact : migration DB et update des 3 `@OwnershipCheck`).

14. **Tests unitaires existants** (`roles.guard.spec.ts`, `permissions.guard.spec.ts`) non consultés : peuvent révéler des contrats implicites. À lire avant d'écrire Spec 2.

15. **`OBSERVATEUR` trop large** : seed filtre `action === 'read' || action === 'view'` → inclut `users:read`, `analytics:read`, `settings:read`. Valider métier pour la catégorie `OBSERVATION` (3 templates dans le design doc : `OBSERVER_FULL`, `OBSERVER_PROJECTS_ONLY`, `OBSERVER_HR_ONLY`).

---

## 7. Synthèse des fichiers d'audit produits

| # | Fichier | Contenu clé |
|---|---|---|
| 01 | `audit-01-guards-decorators.md` | 5 guards globaux + 5 decorators ; flow de vérification (Redis + Prisma) ; pattern d'injection |
| 02 | `audit-02-endpoints-permissions-map.md` | Inventaire 28 controllers + 119 permissions ; 21 orphelines ; 63 routes sans RBAC ; 5 bugs de naming |
| 03 | `audit-03-ownership-scope-logic.md` | OwnershipGuard/Service FK-only ; scope périmètre pur FK dans leaves ; verdict "refactor simple" |
| 04 | `audit-04-frontend-checks.md` | `usePermissions` seul hook ; pas de route guard ; 2 trous de naming front (`users:manage`, `predefined_tasks:manage`) |
| 05 | `audit-05-admin-role-management-ui.md` | Page admin/roles monolithique (786 lignes) ; verdicts conserver/refactorer/jeter ; faille `isSystem` |
| 06 | `audit-06-summary-and-risks.md` | (ce fichier) |

---

## 8. Prêt pour Phase 1 ?

**Conditions OK** :
- Architecture guards saine et cartographiée.
- Ownership/scope indépendants du RBAC (refactor sans conflit).
- Liste de 21 permissions mortes identifiée et validable d'une lecture.
- Trous de sécurité localisés et cartographiés (8 endpoints mutants + 5 bugs de naming).

**Blocages potentiels à lever avec le PO avant Phase 1** :
- Décision §3.6 (enum Role vs RoleConfig dynamique) : conditionne toute la stratégie de migration.
- Décisions §6.1-6.5 (codes cassés `admin:access`, `leaves:validate`, `documents:manage_any`, `predefined_tasks:manage`, `users:manage`) : à trancher avant de figer le contrat atomique Phase 1.
- Décision §6.10 (fail-open vs zero-trust) : impact sur les 33 routes non gardées.

**Recommandation** : valider ce dossier d'audit et arbitrer les 15 incertitudes ci-dessus, puis démarrer Phase 1 (`backlog/rbac-refactor/contract/`).
