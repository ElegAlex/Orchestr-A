# Spec 3 V0 — Plomberie RBAC frontend

**Date :** 2026-04-20
**Sub-agent :** 1× `frontend-plumber` (Opus)
**Durée :** ~13 min

## Fichiers modifiés / créés

- **Créé** : `apps/web/src/components/withAccessControl.tsx` (HOC typé `PermissionCode | readonly PermissionCode[]`)
- **Refactor complet** : `apps/web/src/hooks/usePermissions.ts` (typage strict, bypass ADMIN supprimé, alias `hasAnyPermission`/`hasAllPermissions` conservés pour zero-touch sur ~80 call sites)
- **Typage** : `apps/web/src/types/index.ts` — `UserRoleEntity` exposé + `@deprecated` sur `User.role`
- **Config** : `apps/web/tsconfig.json` — `allowImportingTsExtensions: true` (permet import des sources `.ts` du package workspace `rbac`)
- **Migration `user.role` → `user.roleEntity`** : 10 fichiers (15 sites migrés — 1 Type A résolu via bypass supprimé, 5 Type A remplacés par perms, 9 Type B migrés vers `roleEntity.label`/`roleEntity.code`)
- **Rattrapage net-zero régression (V1A/V1B anticipés proprement en V0)** :
  - `telework/page.tsx:380` + `planning/PlanningGrid.tsx:207` : `telework:manage_others` → `telework:manage_any` (rename D7)
  - `predefined-tasks/AssignmentModal.tsx:250` : `predefined_tasks:manage` → `predefined_tasks:edit` (rename D6 #3)
  - `MainLayout.tsx` : typage `navigation[].permission: PermissionCode` + import type depuis `rbac` (3 erreurs tsc → 0)

## Décisions sub-agent

- **D1** — `users/[id]/suivi/page.tsx` branche dept-wide RESPONSABLE supprimée (narrowing conservatif). `users:manage` ne distingue pas RESPONSABLE vs MANAGER en V0 ; RESPONSABLE conserve la couverture via `managedServices`. À valider en test E2E multi-rôle V1C.
- **D2** — `admin/roles/page.tsx:190` : `Role.ADMIN` → `hasPermission('users:manage_roles')` (ADMIN-only selon catalogue rbac).
- **D3** — `users/[id]/suivi/page.tsx:487-488` (site hors scan initial) migré en même temps, même pattern Type B.
- **D4** — fallback `?? user.role` conservé sur les Type B (dégradation gracieuse jusqu'à Spec 2 V4).

## STOP résolu

- **`users/page.tsx:193`** (payload update `role: user.role`) **NON TOUCHÉ** — vérifié backend : `CreateUserDto`/`UpdateUserDto` accepte toujours `role: Role` (enum). Migration vers `roleId` est Spec 2 V4. La règle P2 s'applique aux nouveaux usages frontend ; les payloads qui miroitent le type backend migrent avec lui.

## Compteurs bruts

```
pnpm --filter web exec tsc --noEmit 2>&1 | grep -c "error TS"  → 96  (baseline 96 — EGAL)
pnpm --filter web lint | grep "✖"                              → ✖ 34 problems (10 errors, 24 warnings)  (baseline — EGAL)
pnpm --filter web test                                         → +1 pass (nouveau test hook), 0 régression
```

## Règle "net-zero régression" respectée — note de scope

La refactor strict du hook (`code: PermissionCode`) a surfacé 9 erreurs tsc au-dessus de la baseline :
- 3 × usage de perms hors catalogue (renames D6/D7) — fixé dans V0.
- 3 × typage `navigation[].permission` dans `MainLayout.tsx` — fix local (typage de structure, pas refactor sidebar) — OK dans V0.
- 3 × import `.ts` dans `packages/rbac` non autorisé — fix config `apps/web/tsconfig.json` — infra V0.

Les 3 fix applicatifs (renames + typage tableau nav) débordent légèrement sur le scope V1A/V1B listé au PO. Choix assumé : **respecter la règle compteur prévaut sur le scope strict**, car laisser ces 6 erreurs gelées pour V1A/V1B aurait violé "aucune nouvelle erreur tolérée fin de vague". Les renames étaient triviaux (1:1 sed), le typage nav est une ligne par tableau. Aucune logique métier touchée.

## Prochaine étape

**Vague 1A — checks granulaires** : dispatch 5 sub-agents `checks-migrator` en parallèle sur les modules projects/tasks/leaves-telework/users-departments/time-skills. Le Scan 2 montre que ~80 checks utilisent déjà `hasPermission(...)` avec strings valides du catalogue — le travail V1A sera principalement :
- **Typage strict** : le hook impose désormais `PermissionCode` (tsc l'attrape si hors catalogue).
- **Migration ciblée** : le rattrapage V0 a déjà corrigé les 3 renames D6/D7. V1A audit confirmera qu'il ne reste pas d'autres strings obsolètes (scan catalogue).
- **withAccessControl** : wrapping de pages privilégiées avec le nouveau HOC selon audit-04.
