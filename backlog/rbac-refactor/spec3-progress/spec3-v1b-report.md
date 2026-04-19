# Spec 3 V1B — Sidebar conditionnelle

**Date :** 2026-04-20
**Main thread (pas de sub-agent).**

## Audit `apps/web/src/components/MainLayout.tsx`

Mapping items → permissions actuel :

| Item | Gate | Verdict |
|---|---|---|
| dashboard | `undefined` (public) | OK (accessible à tout authentifié) |
| projects | `projects:read` | OK |
| tasks | `tasks:read` | OK |
| events | `events:read` | OK |
| planning | `undefined` (public) | OK (toute personne voit son planning) |
| timeTracking | `time_tracking:read` | OK |
| leaves | `leaves:read` | OK |
| telework | `telework:read` | OK |
| **reports** | `reports:view` | OK (D5 — remplace analytics:read) |
| **users** | `users:manage` | OK (USERS_PAGE_ACCESS — accès page sans CRUD) |
| departments | `departments:read` | OK |
| skills | `skills:read` | OK |
| thirdParties | `third_parties:read` | OK |
| roleManagement | `adminOnly` → `users:manage_roles` | OK (admin scope) |
| settings | `adminOnly` → `users:manage_roles` | Note : choix UX restrictif (settings:read plus large) ; conforme à l'intent actuel — laisse |

**Note contract-05 §5.2 "D6 #5 : users:manage → users:read"** — ce point du contract-05 est obsolète après la correction PO 2026-04-19 qui a introduit `USERS_PAGE_ACCESS = ['users:manage']`. `users:manage` donne accès à la page (lister + détails) sans conférer les droits CRUD (`USERS_CRUD`). C'est la bonne gate. Pas de modification.

## Typage `PermissionCode`

Effectué en V0 (net-zero rattrapage) : `navigation[].permission: PermissionCode` + `adminNavigation[].permission: PermissionCode` + import `type { PermissionCode } from "rbac"`. Le typage strict empêche toute string hors catalogue à la compilation.

## Loading state

Le hook `usePermissions()` retourne `permissionsLoaded: boolean`. `hasPermission(...)` retourne `false` tant que `permissionsLoaded === false`. Résultat : tous les items conditionnels sont hidden au premier render, pas de flash. **OK sans modification.**

## V1B — verdict

**No-op** : le travail sidebar est intégralement couvert par V0 (typage strict + rename D7). Aucune modification additionnelle requise.

## Compteurs bruts

```
tsc --noEmit | grep -c "error TS"    → 96  (baseline — EXACT)
lint | grep "✖"                       → 10 errors, 24 warnings  (baseline — EXACT)
```

Net-zero régression.
