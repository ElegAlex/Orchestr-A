# Spec 3 V1A — Checks granulaires

**Date :** 2026-04-20
**Sub-agents :** 5× `checks-migrator` (Opus) parallèles
**Durée :** ~13 min en parallèle

## Résultats sub-agents

| Groupe | Scope | Modifs | Flag |
|---|---|---|---|
| V1A-a | projects | 0 | — |
| V1A-b | tasks | 0 | STOP sémantique non-bloquant (tasks/page.tsx:114) |
| V1A-c | leaves+telework | **1 fichier — bug sécurité corrigé** | — |
| V1A-d | users+departments | **1 fichier wrappé `withAccessControl`** | — |
| V1A-e | time-tracking+planning+skills | 0 | — |

## Modifs main thread

### Bug sécurité `leaves/page.tsx` (V1A-c)

**Avant V1A :** `const isAdmin = hasPermission("leaves:read")` — or `leaves:read` est dans `BASE_EMPLOYEE_PERMISSIONS` (`packages/rbac/atomic-permissions.ts:253`), donc **tout utilisateur authentifié** passait `isAdmin === true`. Conséquence : onglets/boutons admin exposés à n'importe quel user (L839 import, L888 all-leaves tab, L912 leave-types tab, L982 section, L1111 section).

**Faille réelle ?** Non — les endpoints back sont gatés `@RequirePermissions('leaves:manage')` / `leaves:readAll` (audit `leaves.controller.ts` : 22 endpoints protégés). L'utilisateur aurait vu le bouton, cliqué, et reçu 403. **UI confusant, pas faille sécurité.**

**Fix appliqué :**
```diff
-  const isAdmin = hasPermission("leaves:read");
-  const canValidate = hasPermission("leaves:approve") || isAdmin;
-  const canManageBalances = hasPermission("leaves:manage");
+  const canReadAllLeaves = hasPermission("leaves:readAll");
+  const canValidate = hasPermission("leaves:approve");
+  const canManageBalances = hasPermission("leaves:manage");
```

Puis remplacement des 7 usages :
| Ligne | Avant | Après |
|---|---|---|
| 157 (`fetchAllLeaves` gate) | `!isAdmin` | `!canReadAllLeaves` |
| 839 (bouton import) | `isAdmin` | `canManageBalances` |
| 888 (onglet all-leaves) | `isAdmin` | `canReadAllLeaves` |
| 912 (onglet leave-types) | `isAdmin` | `canManageBalances` |
| 982 (section all-leaves) | `isAdmin` | `canReadAllLeaves` |
| 1111 (section leave-types) | `isAdmin` | `canManageBalances` |

**Simplification** : `canValidate` perd son `|| isAdmin` — `leaves:approve` suffit (vérifié : ADMIN/RESPONSABLE/MANAGER l'ont tous dans leurs templates).

### `users/[id]/suivi/page.tsx` wrappé (V1A-d)

Wrapping via `withAccessControl(['users:read', 'users:manage'])`. La logique interne `checkAccess` (self, `users:manage_roles`, `users:manage` + `managedServices`) reste dans le composant pour le narrowing par user.

Export du composant wrappé en EOF avec commentaire explicatif.

## STOP V1A-b non-bloquant (note PO)

`tasks/page.tsx:114` gate `hasPermission("tasks:create")` pour `tasksService.getOrphans()`. L'API `GET /tasks/orphans` exige `tasks:read` côté back. Le gate frontend est **plus restrictif** que le back — impact : user avec `tasks:read` mais sans `tasks:create` (rôle observer étendu) ne voit pas les orphelins globaux. Intent UX discutable :
1. Aligner sur `tasks:read` (tous les lecteurs voient les orphelins).
2. Passer à `tasks:readAll` (scope global).
3. Conserver `tasks:create` (UX : ne montre que ce que l'user peut gérer).

Décision PO à prendre en post-mortem Spec 3, hors scope V1A. Pas un bug sécurité.

## Autres notes signalées

- `telework:self_service` cité dans le brief du sub-agent n'existe pas dans le catalogue. Aucun usage détecté — à nettoyer dans la doc.

## Compteurs bruts fin V1A

```
tsc --noEmit | grep -c "error TS"    → 96  (baseline — EXACT)
lint | grep "✖"                       → 10 errors, 24 warnings  (baseline — EXACT)
```

Aucune régression. Règle net-zero respectée.

## Fichiers modifiés

- `apps/web/app/[locale]/leaves/page.tsx` (+3 lignes/−3 pour declarations, +6 remplacements `isAdmin` → perms spécifiques)
- `apps/web/app/[locale]/users/[id]/suivi/page.tsx` (wrap `withAccessControl`, commentaire explicatif, export en EOF)
