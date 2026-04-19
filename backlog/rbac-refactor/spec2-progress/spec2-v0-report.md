# Spec 2 — Rapport Vague 0 (Fondations)

> Période : 2026-04-19. Tag de rollback : `pre-rbac-spec2` sur `bcd0202`.

---

## Décisions / déviations actées

### Option B PO — `model RoleEntity` au lieu de `model Role`

Confirmation appliquée (cf. arbitrage PO 2026-04-19). Documentée dans `contract-03-type-model.md §9 — Dette nominale transitoire (V0→V4)`. Engagement : V4 fera le rename `RoleEntity` → `Role` après drop de l'enum legacy.

### Convention package workspace

Le package créé est nommé `rbac` (et non `@orchestra/rbac` du contrat-04 §4.1) pour cohérence avec la convention projet (cf. `database`, `utils`, `types`, `ui` qui n'ont pas de scope). Aucun impact fonctionnel — l'import devient `import { ... } from "rbac"` côté apps/api/web.

---

## V0 A — Schema, migration, seed

### Actions

1. Modification `packages/database/prisma/schema.prisma` : ajout `model RoleEntity` (avec `@@map("roles")`) + `User.roleId String?` (nullable) + relation `roleEntity RoleEntity? @relation(name: "UserRoleEntity", ...)`. Enum `Role` et champ `User.role` **conservés intacts**.
2. Génération + édition migration `20260419192835_rbac_v0_add_roles_table` : CREATE TABLE roles + indexes + FK + INSERT 26 templates système (`isSystem=TRUE`, `BASIC_USER` `isDefault=TRUE`) + UPDATE backfill `users.role_id` selon `LEGACY_ROLE_MIGRATION` + assertion 0 NULL.
3. Application via `prisma migrate dev`.
4. Ajout `seedSystemRoleTemplates()` dans `packages/database/prisma/seed.ts` (idempotent : préserve labels custom, réaligne `templateKey` si drift).

### Critères de fin (sortie brute)

**Schema valide**
```
$ pnpm --filter database exec prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

**Migration appliquée**
```
$ pnpm --filter database exec prisma migrate dev
Applying migration `20260419192835_rbac_v0_add_roles_table`
Your database is now in sync with your schema.
✔ Generated Prisma Client (v6.19.1)
```

**26 rôles système**
```
$ docker exec orchestr-a-db psql -U orchestr_a -d orchestr_a_v2 -c \
  "SELECT COUNT(*) AS roles_count FROM roles WHERE \"isSystem\" = TRUE;"
 roles_count
-------------
          26
(1 row)
```

**Backfill users — 0 NULL**
```
$ docker exec orchestr-a-db psql -U orchestr_a -d orchestr_a_v2 -c \
  "SELECT COUNT(*) AS users_total, COUNT(\"roleId\") AS users_with_role_id, \
   COUNT(*) - COUNT(\"roleId\") AS users_null_role_id FROM users;"
 users_total | users_with_role_id | users_null_role_id
-------------+--------------------+--------------------
          47 |                 47 |                  0
(1 row)
```

**Mapping backfill par rôle legacy**
```
$ docker exec orchestr-a-db psql -U orchestr_a -d orchestr_a_v2 -c \
  "SELECT u.role::TEXT AS legacy_role, r.code AS new_role_code, COUNT(*) AS n \
   FROM users u JOIN roles r ON u.\"roleId\" = r.id GROUP BY 1,2 ORDER BY 1;"
    legacy_role     |  new_role_code  | n
--------------------+-----------------+----
 ADMIN              | ADMIN           |  4
 CONTRIBUTEUR       | BASIC_USER      | 39
 MANAGER            | MANAGER         |  1
 OBSERVATEUR        | OBSERVER_FULL   |  1
 REFERENT_TECHNIQUE | TECHNICAL_LEAD  |  1
 RESPONSABLE        | ADMIN_DELEGATED |  1
(6 rows)
```

Conformité `LEGACY_ROLE_MIGRATION` (contract-02) : ✓ — chaque legacy mappé sur le bon templateKey. 47 users couverts, aucun orphelin.

**Seed idempotent**
```
$ pnpm --filter database run db:seed
[SEED RBAC V0] system roles : 0 créés, 26 préservés (total attendu : 26)
✅ Admin user ready: admin@orchestr-a.internal
...
🎉 Seeding complete!
```

Le seed `seedSystemRoleTemplates` détecte les 26 rôles déjà créés par la migration et les préserve sans réécrire les labels (test de l'idempotence côté seed).

**Anciennes tables conservées**
```
$ docker exec orchestr-a-db psql -U orchestr_a -d orchestr_a_v2 -c \
  "SELECT COUNT(*) FROM role_configs UNION ALL SELECT COUNT(*) FROM permissions UNION ALL SELECT COUNT(*) FROM role_permissions;"
```
(Tables présentes — drop différé en V4. Le seed actuel les met à jour selon l'ancienne logique, comportement préservé pendant la transition.)

### Critères V0 A → tous ✓

- [x] `pnpm db:migrate` passe sans erreur sur DB locale.
- [x] `pnpm db:seed` insère/préserve exactement 26 rôles système.
- [x] Backfill : 47/47 users avec `roleId` non-NULL.
- [x] Tables legacy conservées.

---

## V0 B — Package `rbac`

### Actions

1. Création `packages/rbac/` avec :
   - `package.json` (name: `rbac`, private, dev-deps: `vitest`, `typescript`).
   - `atomic-permissions.ts` (copie conforme de `contract-01-atomic-permissions.ts`).
   - `templates.ts` (copie conforme de `contract-02-templates.ts`, import path ajusté `./atomic-permissions`).
   - `index.ts` (barrel : exports types + atomiques + templates + helpers migration).
   - `tsconfig.json` (mode strict, isolation, mêmes flags que celui de Phase 1).
   - `__tests__/templates.spec.ts` (108 tests).
   - `vitest.config.ts`.

### Critères de fin (sortie brute)

**Compilation isolée**
```
$ pnpm exec tsc --noEmit -p packages/rbac/tsconfig.json; echo "EXIT=$?"
EXIT=0
```

**Tests V0 B critères (a) counts + (b) cohérence**
```
$ pnpm --filter rbac test
> rbac@2.0.0 test
> vitest run --config ./vitest.config.ts

 RUN  v3.2.4 /home/alex/Documents/REPO/ORCHESTRA/packages/rbac

 ✓ __tests__/templates.spec.ts (108 tests) 7ms

 Test Files  1 passed (1)
      Tests  108 passed (108)
   Start at  21:34:19
   Duration  343ms
```

**Détail des 108 tests**
- 4 tests globaux : `CATALOG_PERMISSIONS = 107`, sans doublon, `ROLE_TEMPLATE_KEYS = 26`, `ROLE_TEMPLATES = 26 entrées`.
- 26 tests « counts normatifs » (1 par template, vérifient les valeurs §9 contract-05).
- 26 tests « toutes les permissions sont dans CATALOG_PERMISSIONS ».
- 26 tests « permissions sans doublon par template ».
- 26 tests « métadonnées renseignées » (key/category/defaultLabel/description).

### Critères V0 B → tous ✓

- [x] Package consommable via `import from "rbac"`.
- [x] Exports : types `PermissionCode`, `RoleTemplateKey`, `RoleCategoryKey`, `RoleTemplate` + constantes (`ROLE_TEMPLATES`, `CATALOG_PERMISSIONS`, atomiques, helpers).
- [x] Test (a) : counts conformes §9 contract-05 (26/26 templates).
- [x] Test (b) : cohérence permissions (0 inconnu, 0 doublon).
- [x] `pnpm --filter rbac test` passe (108/108).

---

## Points d'attention pour la Vague 1

1. **Ajout dépendance workspace dans apps/api** : V1 C devra ajouter `"rbac": "workspace:*"` dans `apps/api/package.json` puis `pnpm install` pour pouvoir importer `from "rbac"`.

2. **Cache Redis legacy à préserver** : `RoleManagementService.getPermissionsForRole` cache sur `role-permissions:<CODE>`. Le nouveau `PermissionsService` (V1 C) doit garder cette même clé pour ne pas casser l'invalidation pendant la transition. Cf. audit-06 §3.2.

3. **Tests `roles.guard.spec.ts` et `permissions.guard.spec.ts` actuels** : verts au moment du tag `pre-rbac-spec2`. La V1 ne touche pas à `RolesGuard` (préservé jusqu'à V4 selon bloc d'invocation). Le `PermissionsGuard` est refactoré : ses spec.ts seront adaptés au nouveau contrat (cf. contract-04 §1).

4. **Champ `User.role` enum legacy** : reste lu par tout le code `apps/api/src` (136 occurrences dans 23 fichiers) jusqu'à V2. Aucun changement runtime côté code applicatif en V0.

5. **Prod** : aucune action sur prod en V0. Migration et seed locaux uniquement. La migration sera déployée en prod après validation V3 + nouveau `pg_dump` (memory `feedback_verify_before_destructive_prod_changes`).

6. **Pas encore de commit** : changements V0 sur l'arbre de travail mais pas committés. Recommandation : commit atomique de fin de V0 avant V1 (un commit par vague selon R6 du bloc d'invocation).

---

## Diff fichiers (V0)

### Créés
- `packages/rbac/package.json`
- `packages/rbac/index.ts`
- `packages/rbac/atomic-permissions.ts` (copie conforme contract-01)
- `packages/rbac/templates.ts` (copie conforme contract-02, import ajusté)
- `packages/rbac/tsconfig.json`
- `packages/rbac/vitest.config.ts`
- `packages/rbac/__tests__/templates.spec.ts`
- `packages/database/prisma/migrations/20260419192835_rbac_v0_add_roles_table/migration.sql`

### Modifiés
- `packages/database/prisma/schema.prisma` (model RoleEntity + User.roleId)
- `packages/database/prisma/seed.ts` (ajout `seedSystemRoleTemplates()` + appel en `main()`)
- `backlog/rbac-refactor/contract/contract-03-type-model.md` (ajout §9 dette nominale)

### Conservés (drop V4)
- `packages/database/prisma/schema.prisma` (enum `Role` + `User.role`)
- Tables `role_configs`, `permissions`, `role_permissions`
- `apps/api/src/role-management/role-management.service.ts`
- `apps/api/src/auth/guards/roles.guard.ts` + `roles.decorator.ts`

---

## Suite

V1 C + D en parallèle, à enchaîner immédiatement (R1 — pas de STOP intermédiaire).
