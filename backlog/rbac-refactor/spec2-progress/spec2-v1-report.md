# Spec 2 — Rapport Vague 1 (Services & consommation)

> Période : 2026-04-19. V1 C + V1 D enchaînés (le bloc d'invocation autorise la parallélisation). Aucun STOP rencontré.

---

## V1 C — PermissionsService + décorateurs + guards

### Fichiers créés

- `apps/api/src/rbac/permissions.service.ts` — service central RBAC. Lookup `roleCode → roles.templateKey → ROLE_TEMPLATES[templateKey].permissions`. Cache Redis `role-permissions:<code>` TTL 5min (clé identique à l'ancien service). Fallback `RoleManagementService.getPermissionsForRole` pour les codes legacy non encore migrés (CONTRIBUTEUR, RESPONSABLE, etc.). Méthodes : `getPermissionsForRole`, `getPermissionsForUser`, `roleHasAll`, `roleHasAny`, `invalidateRoleCache`.
- `apps/api/src/rbac/permissions.guard.ts` — `PermissionsGuardV2` zero-trust. Lit `@Public`, `@AllowSelfService`, `@RequirePermissions` (AND), `@RequireAnyPermission` (OR). Modes `permissive` (logue ce qui serait refusé) / `enforce` (refuse). Sélection via env `RBAC_GUARD_MODE`. **Non enregistré comme APP_GUARD** en V1 — activation V2 (E.a → permissive, E.i → enforce).
- `apps/api/src/rbac/decorators/require-permissions.decorator.ts` — `@RequirePermissions(...PermissionCode[])` (AND) + `@RequireAnyPermission(...)` (OR). Réutilise la clé de métadonnées `'permissions'` de l'ancien `@Permissions()` pour compat descendante.
- `apps/api/src/rbac/decorators/allow-self-service.decorator.ts` — `@AllowSelfService()`. Marqueur pour l'allowlist (cf. contract-05 §2).
- `apps/api/src/rbac/rbac.module.ts` — `@Global()`. Importe ConfigModule + PrismaModule + RoleManagementModule. Expose PermissionsService, PermissionsGuardV2.

### Fichiers modifiés

- `apps/api/src/auth/strategies/jwt.strategy.ts` — `validate()` charge désormais aussi `roleId` + `roleEntity { id, code, label, templateKey, isSystem }`. **Additif** : `user.role` (enum legacy) reste exposé. Aucun breaking change pour les handlers existants.
- `apps/api/src/common/guards/ownership.guard.ts` — bascule l'injection de `RoleManagementService` vers `PermissionsService`. Le bypass `manage_any` consomme `permissionsService.getPermissionsForUser(user)` (path nouveau si `user.roleEntity` chargé, fallback legacy sinon). Inclut désormais `documents:manage_any` (D6 #4) côté path nouveau pour les codes qui matchent un templateKey (ADMIN, MANAGER...).
- `apps/api/src/common/common.module.ts` — import + export ajoutés pour `RbacModule`. RoleManagementModule conservé (consommé par PermissionsGuard legacy + fallback PermissionsService).
- `apps/api/src/common/guards/ownership.guard.spec.ts` — adaptation du mock : `roleManagementService.getPermissionsForRole` → `permissionsService.getPermissionsForUser`.
- `apps/api/package.json` — ajout `"rbac": "workspace:*"`.

### Conservés (à supprimer V4 selon bloc d'invocation)

- `apps/api/src/role-management/*` (service + controller + module).
- `apps/api/src/auth/guards/roles.guard.ts` + `roles.guard.spec.ts`.
- `apps/api/src/auth/decorators/roles.decorator.ts`.
- `apps/api/src/auth/guards/permissions.guard.ts` + `permissions.guard.spec.ts` (legacy actif jusqu'à V2 E.i).
- `apps/api/src/auth/decorators/permissions.decorator.ts` (`@Permissions()`).

### Critères de fin V1 C (sortie brute)

**Build NestJS**
```
$ pnpm --filter api build
> api@2.0.0 build
> nest build
EXIT=0
```

**Tests OwnershipGuard adaptés (régression évitée)**
```
$ pnpm --filter api test -- --run common/guards/ownership.guard
 RUN  v4.0.9 /home/alex/Documents/REPO/ORCHESTRA/apps/api
 ✓ src/common/guards/ownership.guard.spec.ts (9 tests) 10ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

Les 9 tests existants sur `OwnershipGuard` continuent à passer après la bascule de l'injection vers `PermissionsService` — le mock a été renommé conformément à la nouvelle signature.

### Notes V1 C

1. **Path nouveau actif partiellement dès V1** : pour les users dont `user.role` legacy = `ADMIN` ou `MANAGER` (ou `OBSERVATEUR` mais celui-ci ne matche pas, son code template est `OBSERVER_FULL`), le `PermissionsService.getPermissionsForRole` trouve directement le rôle dans la table `roles` (les 26 templates seedés ont `code = templateKey`). Ces deux rôles voient donc **dès V1** leur permission set basculer vers `ROLE_TEMPLATES[ADMIN/MANAGER].permissions` (107/79 perms post-refactor) au lieu du set legacy DB. Les autres codes legacy (RESPONSABLE, CONTRIBUTEUR, etc.) tombent en fallback legacy → comportement inchangé.

2. **`documents:manage_any`** : nouvelle perm dans `OWNERSHIP_BYPASS_ALL` (contract-01). Pour les users ADMIN, le bypass `documents:manage_any` est désormais reconnu côté path nouveau via `PermissionsService` (qui retourne le set ADMIN du template = inclut `documents:manage_any`). Pour les autres rôles, fallback legacy → la perm n'existe pas en DB legacy → bypass non actif (comportement actuel préservé).

3. **JWT relation `roleEntity`** : tous les users authentifiés post-V1 ont `request.user.roleEntity` chargée. Cela permet à V2 E de basculer progressivement les guards vers le path nouveau sans nouvelle modif de strategy.

---

## V1 D — Endpoints CRUD rôles

### Fichiers créés

- `apps/api/src/rbac/roles.service.ts` — `RolesService`. CRUD rôles (table `roles`). Méthodes : `listRoles`, `listTemplates` (vue galerie 26 templates in-memory), `getRoleById`, `createRole`, `updateRole`, `deleteRole`. **Verrouillage `isSystem`** sur update/delete (D9 PO). Suppression refusée si users rattachés (409 + liste). Invalidation cache Redis sur changement de `templateKey`. Force `isSystem=false` à la création (la création de rôles système est l'apanage du seed).
- `apps/api/src/rbac/roles.controller.ts` — `RolesController`. Endpoints `/api/roles/templates`, `GET /roles`, `GET /roles/:id`, `POST /roles`, `PATCH /roles/:id`, `DELETE /roles/:id`. Tous protégés par `@Permissions('users:manage_roles')`. Préfixe distinct de l'ancien `/api/role-management/*` qui coexiste jusqu'à V4.
- `apps/api/src/rbac/dto/create-role.dto.ts` — `CreateRoleDto` (code SCREAMING_SNAKE_CASE, label, templateKey ∈ ROLE_TEMPLATE_KEYS, description optionnelle, isDefault optionnel).
- `apps/api/src/rbac/dto/update-role.dto.ts` — `UpdateRoleDto` (champs label/templateKey/description/isDefault optionnels). `code` immutable.

### Fichiers modifiés

- `apps/api/src/rbac/rbac.module.ts` — ajout `controllers: [RolesController]`, providers `RolesService`.

### Critères de fin V1 D (sortie brute)

**Build NestJS**
```
$ pnpm --filter api build
> api@2.0.0 build
> nest build
EXIT=0
```

Le build inclut désormais le `RolesController` enregistré globalement via `RbacModule` (importé par `CommonModule` qui est `@Global`). Aucun warning nouveau.

### Notes V1 D

1. **Coexistence `role-management/*` ↔ `roles/*`** : les deux sets d'endpoints sont actifs simultanément en V1-V2. La galerie UI (Spec 3) consommera le nouveau préfixe `/api/roles/*`. L'ancien `/api/role-management/*` reste accessible pour rollback. Suppression V4.

2. **Pas encore de tests d'intégration `RolesController`** : prévu en V3 F (cf. critère « tests du module roles » du bloc d'invocation V3). En V1, seule la compilation est validée.

3. **`isDefault` exclusif** : si un rôle est créé/modifié avec `isDefault=true`, le service unset les autres `isDefault=true` via `updateMany`. Un seul rôle par défaut à tout instant — utilisé par la création d'un user (V2/V3 — pas encore implémenté côté `users.service`).

---

## Points d'attention pour la Vague 2

1. **PermissionsGuardV2 non actif** : V2 E.a doit le passer en mode `permissive` (env `RBAC_GUARD_MODE=permissive` + enregistrement APP_GUARD). E.i bascule en `enforce` après tous les câblages.

2. **Migration `@Permissions()` → `@RequirePermissions()`** : 186 occurrences à remplacer dans 28 controllers (audit-02 §1). Comme les deux décorateurs émettent la même clé de métadonnées (`'permissions'`), la migration peut se faire **fichier par fichier** sans casser le PermissionsGuard legacy actif.

3. **JWT relation** : tous les `@CurrentUser()` callers qui font `user.role` continuent à fonctionner. Les nouveaux callers peuvent utiliser `user.roleEntity?.code` ou `user.roleEntity?.templateKey`. Migration progressive pendant V2/Spec 3.

4. **Tests `permissions.guard.spec.ts`** legacy : restent verts (le guard legacy n'est pas modifié). Les tests du nouveau `PermissionsGuardV2` seront ajoutés en V3 F.

5. **Couverture des nouveaux fichiers** : nuls en V1 (aucun spec.ts pour `PermissionsService`/`RolesService`/`PermissionsGuardV2`/`RolesController`). Sera traité en V3 F (objectif > 80%).

6. **Risque cache Redis pendant la transition** : la même clé `role-permissions:<CODE>` est utilisée par les deux services (legacy + nouveau). Si V2 E modifie un templateKey, l'invalidation côté nouveau service (`PermissionsService.invalidateRoleCache`) suffit pour purger l'ancien cache aussi. Pas d'incohérence attendue.

---

## Diff fichiers (V1)

### Créés (10)
- `apps/api/src/rbac/rbac.module.ts`
- `apps/api/src/rbac/permissions.service.ts`
- `apps/api/src/rbac/permissions.guard.ts`
- `apps/api/src/rbac/roles.service.ts`
- `apps/api/src/rbac/roles.controller.ts`
- `apps/api/src/rbac/decorators/require-permissions.decorator.ts`
- `apps/api/src/rbac/decorators/allow-self-service.decorator.ts`
- `apps/api/src/rbac/dto/create-role.dto.ts`
- `apps/api/src/rbac/dto/update-role.dto.ts`

### Modifiés (4)
- `apps/api/src/common/common.module.ts` (import + export RbacModule)
- `apps/api/src/common/guards/ownership.guard.ts` (PermissionsService au lieu de RoleManagementService)
- `apps/api/src/common/guards/ownership.guard.spec.ts` (mock adapté)
- `apps/api/src/auth/strategies/jwt.strategy.ts` (charge roleEntity)
- `apps/api/package.json` (ajout dep `rbac`)

### Conservés intacts (drop V4)
- `apps/api/src/role-management/*` (service + controller + module)
- `apps/api/src/auth/guards/roles.guard.{ts,spec.ts}`
- `apps/api/src/auth/decorators/roles.decorator.ts`
- `apps/api/src/auth/guards/permissions.guard.{ts,spec.ts}` (legacy)
- `apps/api/src/auth/decorators/permissions.decorator.ts`

---

## Suite

V2 E à enchaîner immédiatement (R1 du bloc d'invocation).
