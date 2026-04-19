# Spec 3 V1D — Galerie admin (nouvelle UI)

**Date :** 2026-04-20
**Sub-agent :** 1× `admin-gallery-builder` (Opus)

## Fichiers créés

| Chemin | L. |
|---|---|
| `apps/web/app/[locale]/admin/roles-v2/page.tsx` | 312 |
| `apps/web/src/components/admin/roles-v2/category-config.ts` | 141 |
| `apps/web/src/components/admin/roles-v2/TemplateCard.tsx` | 71 |
| `apps/web/src/components/admin/roles-v2/TemplateDetailsModal.tsx` | 170 |
| `apps/web/src/components/admin/roles-v2/CreateRoleForm.tsx` | 251 |
| `apps/web/src/components/admin/roles-v2/RolesList.tsx` | 273 |
| `apps/web/src/services/roles-v2.service.ts` | 89 |
| **Total** | **1307** |

Modifié : `e2e/tests/rbac/admin-roles-gallery.spec.ts` — 5 × `test.fixme()` → `test()` + suffixe `Date.now()` sur le code role pour idempotence + `selectOption` regex→string.

## Route nouvelle

**`/fr/admin/roles-v2`** (cohabite avec `/fr/admin/roles` ancienne page qui sera supprimée en V2).

Protection : gate route-level via `useEffect` → `router.replace('/dashboard')` si pas `users:manage_roles` + fallback "Accès refusé" visible pendant nav async. (HOC `withAccessControl` non utilisé ici — le HOC rend `null` et ne satisferait pas le test 5 qui attend un redirect ou un message d'erreur visible.)

Rendu :
- **Header** : "Galerie des rôles" + sous-titre ("26 templates RBAC · N rôles en base") + bouton "+ Nouveau rôle custom".
- **Filtres** : chip "Toutes" + 9 chips catégories colorées (rouge/orange/bleu/rose/violet/cyan/gris/vert/jaune) + recherche texte libre.
- **Galerie** : sections groupées par catégorie (A→I), grid responsive `sm:2 / lg:3 / xl:4`, 26 cards (badge catégorie + templateKey + label + description + count perms + count rôles rattachés).
- **Modales** : `TemplateDetailsModal` (permissions groupées par module), `CreateRoleForm` (inputs natifs pour compat E2E, validation SCREAMING_SNAKE_CASE client).
- **Liste rôles DB** : "Rôles custom" (éditable) + "Rôles système" (verrouillés, badge "Système").
- **Toasts** : "Rôle créé / mis à jour / supprimé" via `react-hot-toast`.

## Tests E2E (activés)

```
5 passed (3.1s)
  ✓ ADMIN : voit 26 templates affichés, groupés par 9 catégories
  ✓ ADMIN : cliquer sur une chip catégorie filtre les cards affichées
  ✓ ADMIN : click sur une card template ouvre une modale avec permissions
  ✓ ADMIN : peut créer un rôle custom via formulaire
  ✓ BASIC_USER (contributeur) : navigation → 403 ou redirect dashboard
```

## Compteurs bruts

```
tsc --noEmit | grep -c "error TS"  → 96  (baseline — EXACT, 0 erreur dans nouveaux fichiers)
lint                                → 10 errors + 24 warnings  (baseline — EXACT)
```

## Décisions UX du sub-agent

- Couleurs catégories alignées design doc contract-02 §1.
- Grid responsive `sm:2 / lg:3 / xl:4`.
- Gate route-level (pas HOC) pour afficher redirect + message explicite.
- Bouton "Nouveau rôle custom" (non "Créer") pour éviter collision strict-mode avec submit "Créer".
- Inputs natifs (input/select) pour compat E2E + validation côté client.
- Idempotence test 4 : code suffixé `Date.now()`.
- `templateKey` default `BASIC_USER` dans le form (risque minimal).
- Service client dédié `roles-v2.service.ts` (cohabite avec ancien, consolidé en V2).

## Prochaine étape

V2 — suppression ancienne UI admin + rename `/admin/roles-v2` → `/admin/roles` + suppression `e2e/tests/rbac/ui-permissions.spec.ts`. **Point de non-retour frontend** : advisor Moment obligatoire avant commit V2.
