# Spec 2 — Rapport Vague 2 (Migration déclarative + zero-trust + câblages)

> Période : 2026-04-19. Aucun STOP imposé. Mode `PermissionsGuardV2` activé en `permissive` (logue, ne refuse pas) ; bascule `enforce` différée à la fin de V3 selon stabilité des tests.

---

## Sous-étapes V2 E exécutées

### (e) Corrections de naming D6 + D7

- **D6 #1** — `projects.controller.ts:88` : `@Permissions('admin:access')` → `@RequirePermissions('reports:export')`. Endpoint `POST /projects/snapshots/capture` désormais accessible aux templates qui ont `reports:export` (ADMIN, ADMIN_DELEGATED, MANAGER, PORTFOLIO_MANAGER, etc.).
- **D6 #2** — `leaves.controller.ts:292` : check runtime `permissions.includes('leaves:validate')` → `permissions.includes('leaves:approve')`. Le check fantôme historique (toujours `false`) est corrigé.
- **D6 #4** — `documents:manage_any` câblée via `OwnershipGuard` adapté V1 C : pour les users dont le `code` matche un templateKey (ADMIN, MANAGER), le path nouveau retourne le set du template qui inclut `documents:manage_any` → bypass `OwnershipCheck` actif.
- **D7** — rename `telework:manage_others` → `telework:manage_any` dans 6 fichiers : `telework.controller.ts` (3 `@OwnershipCheck`), `telework.service.ts`, `dto/create-recurring-rule.dto.ts`, `telework.controller.spec.ts`, `telework.service.spec.ts`, `role-management.service.ts` (seed legacy + matrice par rôle, ~7 occurrences).

### (b) Migration déclarative `@Permissions` → `@RequirePermissions`

Sed batch sur **27 controllers** : remplacement de l'import `Permissions` par `RequirePermissions` (même clé de métadonnées `'permissions'` → compat descendante avec PermissionsGuard legacy actif). Remplacement décorateur `@Permissions(` → `@RequirePermissions(`.

Le typage strict `PermissionCode` du nouveau décorateur n'a remonté **aucune erreur** au build, ce qui prouve que toutes les permissions actuellement référencées existent au catalogue post-D4/D5/D6/D7.

### (c) Câblage D3 — 8 endpoints mutants sans `@Permissions`

| Endpoint | Décorateur ajouté |
|---|---|
| `POST /tasks` (`tasks.controller.ts:47`) | `@RequirePermissions('tasks:create')` |
| `DELETE /tasks/:id` (`tasks.controller.ts:227`) | `@RequirePermissions('tasks:delete')` |
| `POST /leaves` (`leaves.controller.ts:48`) | `@RequirePermissions('leaves:create')` |
| `PATCH /leaves/:id` (`leaves.controller.ts:344`) | `@RequirePermissions('leaves:update')` |
| `DELETE /leaves/:id` (`leaves.controller.ts:375`) | `@RequirePermissions('leaves:delete')` |
| `DELETE /leaves/delegations/:id` (`leaves.controller.ts:625`) | `@RequirePermissions('leaves:manage_delegations')` |
| `POST /planning-export/ics/import/preview` | `@RequirePermissions('leaves:create')` |
| `POST /planning-export/ics/import` | `@RequirePermissions('leaves:create')` |

Note : tests d'intégration spécifiques à ces 8 routes (positifs + 403) — déférés à V3 F (qui couvre les 26 templates × 6 tests + non-régression D3).

### (d) Câblage D4 Cat B — 7 lectures à protéger

| Module | Routes câblées | Décorateur |
|---|---|---|
| comments | `GET /comments`, `GET /comments/:id` | `@RequirePermissions('comments:read')` |
| epics | `GET /epics`, `GET /epics/:id` | `@RequirePermissions('epics:read')` |
| holidays | `GET /holidays`, `/year/:year`, `/range`, `/:id`, `/working-days/count` | `@RequirePermissions('holidays:read')` |
| milestones | `GET /milestones`, `/:id`, `/project/:projectId/export`, `/project/:projectId/import-template` | `@RequirePermissions('milestones:read')` |
| school-vacations | `GET /school-vacations`, `/range`, `/:id` | `@RequirePermissions('school_vacations:read')` |
| services | `GET /services`, `/department/:departmentId`, `/:id`, `/:id/stats` | `@RequirePermissions('services:read')` |
| settings | `GET /settings`, `/category/:category`, `/:key` | `@RequirePermissions('settings:read')` |
| leave-types | `GET /leave-types`, `/:id`, `/code/:code` | `@RequirePermissions('leaves:read')` |

Injection automatisée via awk pour les 5 derniers modules (script générique `add_perm`). Insertion manuelle ciblée pour les 3 premiers (comments, epics, holidays — fichiers déjà partiellement édités).

### (f) D8 — Coercion `readAll` dans `time-tracking`

`time-tracking.service.ts:191-227` : remplacement du `throw new ForbiddenException(...)` par une coercion silencieuse `userId = currentUser.id` quand le caller n'a pas `time_tracking:view_any`. Aligné sur le pattern coercion de tasks/leaves/telework/events (cf. audit-03 §3.5).

Test adapté : `time-tracking.service.spec.ts:322` — l'ancien test attendait `ForbiddenException`, le nouveau test vérifie que `where.userId === currentUser.id` (coercion). Test passe ✓.

### (g) D12 — Migration `@Roles()` dans `role-management.controller.ts`

Les 8 occurrences de `@Roles(Role.ADMIN)` remplacées par `@RequirePermissions('users:manage_roles')`. Import `Roles` retiré ; import `RequirePermissions` ajouté. La 9e route (`POST /reset-to-defaults`) utilisait déjà `@Permissions('users:manage_roles')`, migrée elle aussi vers `@RequirePermissions`.

Note : `RolesGuard` reste actif comme APP_GUARD (suppression V4). Tant qu'aucune route ne porte plus `@Roles()`, le guard est un no-op.

### (h) Allowlist — 26 endpoints `@AllowSelfService`

Tous les endpoints self-service du contract-05 §2 ont reçu `@AllowSelfService()` (marqueur consommé par `PermissionsGuardV2`).

| Module | Routes |
|---|---|
| auth | `POST /logout`, `GET /profile`, `GET /me`, `GET /me/permissions` |
| personal-todos | `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| leaves | `GET /me`, `GET /me/balance`, `POST /:id/request-cancel`, `GET /delegations/me` |
| time-tracking | `GET /` (avec coercion D8), `GET /me`, `GET /me/report`, `GET /:id` |
| telework | `GET /me/week`, `GET /me/stats` |
| skills | `POST /me/assign`, `DELETE /me/remove/:skillId`, `GET /me/my-skills` |
| users | `POST /me/avatar`, `PATCH /me/avatar/preset`, `DELETE /me/avatar`, `PATCH /me/change-password` |
| planning-export | `GET /ics` (export personnel) |
| app | `GET /` → `@Public()` (hello-world statique) |

### (a) + (i) Activation `PermissionsGuardV2`

`PermissionsGuardV2` enregistré comme `APP_GUARD` dans `RbacModule`. **Mode par défaut : `permissive`** (env `RBAC_GUARD_MODE`, fallback `permissive`).

Comportement actuel :
- `@Public` / `@AllowSelfService` / `@RequirePermissions(...)` / `@RequireAnyPermission(...)` : checks effectifs.
- Route sans aucun décorateur RBAC : log warning `[RBAC permissive] route SERAIT refusée en enforce` mais autorise.

**Bascule enforce différée à la fin de V3** (smoke test prod). En attendant, l'ancien `PermissionsGuard` legacy reste l'autorité sur les routes `@Permissions(...)` (clé identique, donc compat).

---

## Critères de fin V2 E (sortie brute)

**Build NestJS**
```
$ pnpm --filter api build
> api@2.0.0 build
> nest build
EXIT=0
```

**Suite de tests existants — 1036/1036 ✓**
```
$ pnpm --filter api test
 ✓ src/users/users.service.spec.ts (32 tests) 2157ms
 ...
 Test Files  49 passed (49)
      Tests  1036 passed (1036)
   Duration  3.69s
EXIT=0
```

Les 2 tests adaptés (D6 #2, D8) passent. Aucune régression.

**Verification côté metadata @Permissions résiduel**
```
$ grep -rn "@Permissions(" /home/alex/Documents/REPO/ORCHESTRA/apps/api/src --include="*.controller.ts"
(0 occurrences)
$ grep -rn "@Roles(" /home/alex/Documents/REPO/ORCHESTRA/apps/api/src --include="*.controller.ts"
(0 occurrences)
```

Toute la migration déclarative est terminée. Plus aucun `@Permissions` ni `@Roles` côté code applicatif.

---

## Points d'attention pour la Vague 3

1. **Tests d'intégration nouveaux** : la V3 F doit ajouter :
   - 26 templates × ≥ 6 tests (3 positifs / 3 négatifs) → 156 tests minimum.
   - Tests `manage_any` × 6 perms (incl. `documents:manage_any` D6 #4) → 12 tests.
   - Tests des 8 endpoints mutants D3 (positifs + 403 sans perm).
   - Tests du module `roles` (CRUD + blocage isSystem D9 + 409 users rattachés).
   - Tests du nouveau `PermissionsGuardV2` (mode permissive + enforce simulé via env).

2. **Bascule enforce** : à activer **après** que tous les tests de V3 passent en mode `RBAC_GUARD_MODE=enforce`. Si un test échoue, c'est qu'une route oubliée n'a ni `@Public`, ni `@AllowSelfService`, ni `@RequirePermissions` → STOP impératif et arbitrage PO.

3. **Logs `[RBAC permissive]`** : à passer au peigne fin une fois l'app lancée localement pour V3. Toute occurrence indique une route oubliée à la cartographie de l'allowlist.

4. **Couverture cible > 80%** : à mesurer via `pnpm --filter api test:cov` en V3.

5. **OwnershipGuard / PermissionsService** : V1 C a basculé l'OwnershipGuard sur le nouveau `PermissionsService`. Pour les rôles legacy (CONTRIBUTEUR, RESPONSABLE...), le fallback legacy continue de fonctionner. Pour les codes qui matchent un templateKey (ADMIN, MANAGER), le set des permissions est **désormais celui du template** (post-D4/D5/D6/D7). À tester explicitement en V3.

6. **Cache Redis** : non flushé en V2. Les permissions servies sont à jour (TTL 5 min). Si un test V3 capture un état "ADMIN avec 119 perms" (cache pré-V0), il échouera. → V3 doit flush avant baseline (`docker exec orchestr-a-redis redis-cli FLUSHDB` ou `--reset-cache` à prévoir).

---

## Diff fichiers (V2 E)

### Modifiés (catégorisés)

- **27 controllers** (`apps/api/src/**/*.controller.ts`) : import + decorator migration `@Permissions → @RequirePermissions` + `@AllowSelfService` ajout sur l'allowlist + câblages D3/D4 Cat B.
- `apps/api/src/projects/projects.controller.ts` : D6 #1 (admin:access → reports:export).
- `apps/api/src/leaves/leaves.controller.ts` : D6 #2 (leaves:validate → leaves:approve), câblage D3 (5 routes), allowlist (3 routes).
- `apps/api/src/leaves/leaves.controller.spec.ts` : test D6 #2 adapté.
- `apps/api/src/telework/{telework.controller.ts,telework.service.ts,dto/create-recurring-rule.dto.ts,telework.controller.spec.ts,telework.service.spec.ts}` : D7 rename `telework:manage_others → telework:manage_any`.
- `apps/api/src/role-management/role-management.controller.ts` : D12 migration `@Roles → @RequirePermissions`.
- `apps/api/src/role-management/role-management.service.ts` : D7 dans seed legacy (la perm s'appelle `telework:manage_any` côté DB legacy aussi, par cohérence avec le code applicatif).
- `apps/api/src/time-tracking/time-tracking.service.ts` : D8 coercion silencieuse au lieu de 403.
- `apps/api/src/time-tracking/time-tracking.service.spec.ts` : test D8 adapté.
- `apps/api/src/app.controller.ts` : `GET /` → `@Public()`.
- `apps/api/src/personal-todos/personal-todos.controller.ts` : `@AllowSelfService` sur les 4 routes.
- `apps/api/src/rbac/rbac.module.ts` : enregistrement `PermissionsGuardV2` comme `APP_GUARD` (mode permissive par défaut).

### Conservés intacts (drop V4)

- `apps/api/src/auth/guards/permissions.guard.ts` (legacy, actif).
- `apps/api/src/auth/guards/roles.guard.ts` (legacy, no-op après D12).
- `apps/api/src/auth/decorators/permissions.decorator.ts` (`@Permissions()`).
- `apps/api/src/auth/decorators/roles.decorator.ts` (`@Roles()`).
- `apps/api/src/role-management/*` (ancien module).

---

## Suite

V3 F à enchaîner immédiatement (R1 du bloc d'invocation). Critères : tests d'intégration RBAC + couverture > 80%.
