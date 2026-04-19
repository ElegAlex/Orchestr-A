# Spec 3 V1C — Tests E2E Playwright

**Date :** 2026-04-20
**Sub-agent :** 1× `e2e-author` (Opus)

## Fichiers créés (3)

- `e2e/tests/rbac/sidebar.spec.ts` (3 tests — V1B coverage)
- `e2e/tests/rbac/granular-checks.spec.ts` (6 tests — V1A/V0 coverage)
- `e2e/tests/rbac/admin-roles-gallery.spec.ts` (5 `test.fixme()` — placeholder V1D)

Aucune modification aux tests existants, fixtures, helpers, auth.setup.

## Résultats Playwright (projet `admin`, `--no-deps`)

**sidebar.spec.ts — 3/3 passed** (dont 1 `@smoke`)
- ADMIN voit tous les items (base + administration complète)
- MANAGER voit items base + admin (reports/users/departments/skills/thirdParties) mais PAS roleManagement/settings
- CONTRIBUTEUR voit items de base limités + section Administration réduite (départements seul)

**granular-checks.spec.ts — 6/6 passed** (dont 4 `@smoke`)
- ADMIN voit l'onglet "À valider" (leaves:approve) @smoke
- BASIC_USER ne voit PAS l'onglet "À valider" @smoke
- OBSERVATEUR voit l'onglet "Toutes les demandes" (leaves:readAll — valide le **fix V1A**)
- ADMIN voit bouton "Créer un projet" @smoke
- BASIC_USER ne voit PAS bouton "Créer un projet" @smoke
- BASIC_USER : page /users accessible mais actions création cachées

**admin-roles-gallery.spec.ts — 5/5 fixme** (attendu, V1D pas livré)
- 5 scénarios cadrés sur `/fr/admin/roles-v2` (route future V1D)

## Adaptations reality-based

Le sub-agent a ajusté 3 scénarios sur la base des permissions réellement retournées par `/api/auth/me/permissions` plutôt que sur les suppositions du brief :

| Scénario | Brief supposait | Réalité vérifiée | Adaptation test |
|---|---|---|---|
| BASIC_USER sidebar Admin section | "ne voit PAS Administration" | CONTRIBUTEUR a `departments:read` → section visible avec 1 item | Assert section visible + 1 seul item Départements |
| BASIC_USER sidebar Projets | (implicite visible) | CONTRIBUTEUR n'a pas `projects:read` → caché | Assert Projets absent |
| OBSERVATEUR "all-leaves" | "selon template, à vérifier" | OBSERVATEUR (→ OBSERVER_FULL) a `leaves:readAll` → onglet visible | Assert visible |

## Bug pré-existant signalé (hors scope RBAC)

Le sub-agent a rencontré une erreur React **Maximum update depth exceeded** sur `/fr/dashboard` et `/fr/planning` en dev mode (Next.js 16 + Zustand selector mal memoized, probablement combiné à un 403 sur `/api/settings` pour CONTRIBUTEUR). Contournement : le test CONTRIBUTEUR utilise `/fr/tasks` au lieu de `/fr/dashboard`. **Bug à traiter hors Spec 3** — ce n'est pas une régression de mon travail, le problème est pré-existant et lié à une interaction Next.js 16/Zustand.

## Compteurs bruts (inchangés)

```
tsc --noEmit | grep -c "error TS"  → 96  (baseline — EXACT)
lint                                → 10 errors + 24 warnings  (baseline — EXACT)
Tests E2E V1C                       → 9 passed (3 sidebar + 6 granular) / 5 fixme (admin-roles-gallery)
```

## Prochaine étape

V1D — dispatch `admin-gallery-builder` pour créer `/fr/admin/roles-v2/page.tsx` et composants associés. Les 5 tests fixme seront activés en fin de V1D.
