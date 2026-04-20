# Spec 3 V2 — Suppression ancienne UI admin + rename

**Date :** 2026-04-20
**Main thread (point de non-retour frontend).**

## Advisor Moment 2 — 2 blockers validés avant action

1. **Tests multi-role** (`predefined-task-assignment.spec.ts`, `rbac-escalation.spec.ts` × 8 refs) pouvaient casser si assertions legacy text-based. **Vérifié** : assertions URL-based + regex `/accès restreint|réservé aux administrateurs/i`. La nouvelle galerie fait redirect dashboard pour non-admin → `isRedirected === true` → tests passent (même si message "Accès refusé" ne matche pas regex, l'OR avec isRedirected suffit).

2. **Ordre filesystem ops** : `git mv` échoue si dir non-vide. Procédure suivie :
   - `git rm apps/web/app/[locale]/admin/roles/page.tsx`
   - `git mv admin/roles-v2 admin/roles-new-tmp` (rename intermédiaire pour éviter collision)
   - `git mv admin/roles-new-tmp admin/roles` (destination finale)
   - Préservation historique Git via `git mv` partout.

## Opérations V2

```
git rm apps/web/app/[locale]/admin/roles/page.tsx              # ancienne 785 L
git mv apps/web/app/[locale]/admin/roles-v2 admin/roles-new-tmp
git mv apps/web/app/[locale]/admin/roles-new-tmp admin/roles
git mv apps/web/src/components/admin/roles-v2 .../admin/roles
git mv apps/web/src/services/roles-v2.service.ts .../roles.service.ts
sed -i 's|roles-v2|roles|g; s|rolesV2Service|rolesService|g' (7 fichiers consommateurs)
git rm e2e/tests/rbac/ui-permissions.spec.ts
```

## Vérifications

```
pnpm --filter web exec tsc --noEmit | grep -c "error TS"   → 96  (baseline — EXACT)
pnpm --filter web lint | grep "✖"                           → 10 errors + 23 warnings  (−1 warning)
pnpm --filter web build                                     → passed
```

E2E V1C/V1D post-rename (14 tests) :

```
✓ sidebar.spec.ts (3)
✓ granular-checks.spec.ts (6)
✓ admin-roles-gallery.spec.ts (5)
14 passed in 6.3s
```

Advisor a signalé que `e2e/tests/rbac/api-permissions.spec.ts` a 11 failures — **vérifié pré-existant** via `git stash` (même 11 failures sur master pré-V2). Drift `permission-matrix.ts` vs templates post-V2 refactor. Hors scope Spec 3.

## Fichiers supprimés

- `apps/web/app/[locale]/admin/roles/page.tsx` (ancienne UI, 785 L)
- `e2e/tests/rbac/ui-permissions.spec.ts` (ancien E2E matrice legacy)

## Renames

- `apps/web/app/[locale]/admin/roles-v2` → `apps/web/app/[locale]/admin/roles`
- `apps/web/src/components/admin/roles-v2` → `apps/web/src/components/admin/roles`
- `apps/web/src/services/roles-v2.service.ts` → `apps/web/src/services/roles.service.ts`
- `rolesV2Service` → `rolesService` (dans 4 consommateurs)

## Prochaine étape

**Phase Deploy** :
- `git push origin master`
- SSH VPS → `docker tag orchestra-web:pre-spec3`, rebuild web, `FLUSHDB` Redis.
- Smoke test prod : login ADMIN → `/admin/roles` (26 templates visibles), login BASIC_USER → `/admin/roles` redirect.
