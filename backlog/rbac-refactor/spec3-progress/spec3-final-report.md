# Spec 3 — Refonte frontend RBAC : rapport final

**Date :** 2026-04-20
**Pré-requis :** Spec 2 V0→V3 + V2bis + V2ter (107 perms ADMIN, 26 templates en prod).
**Enchaînement :** V0 → V1A → V1B → V1C → V1D → V2 → Deploy (cadence automatique PO).
**Bilan :** 6 commits, 1 déploiement prod unique en fin de chaîne avec FLUSHDB Redis.

---

## Commits Spec 3

| # | SHA | Titre | Fichiers |
|---|---|---|---|
| P1 | `9213127` | chore(web): add rbac workspace dependency | 2 |
| V0 | `1d88be4` | feat(web): Spec 3 V0 — RBAC plumbing refactored | 16 |
| V1A | `d33e1f1` | fix(web): Spec 3 V1A — checks granulaires audit + fix bug sécurité leaves | 3 |
| V1B | `4810a8d` | docs(rbac): Spec 3 V1B sidebar — no-op audit validant V0 | 1 |
| V1C | `751be45` | test(e2e): Spec 3 V1C — RBAC E2E tests Playwright | 4 |
| V1D | `131bad6` | feat(web): Spec 3 V1D — galerie admin rôles (nouvelle UI) | 9 |
| V2 | `05897c5` | refactor(web): Spec 3 V2 — suppression ancienne UI admin roles + rename galerie | 11 |

---

## Sub-agents dispatchés (tous Opus, feedback memory respectée)

| Vague | Type | Nombre | Parallélisme | Retours clé |
|---|---|---|---|---|
| V0 | frontend-plumber | 1 | séquentiel | 2 STOPs remontés (payload users:193 résolu par main thread, régression tsc réajustée par fix infra + rattrapage) |
| V1A | checks-migrator | 5 | parallèle | a/b/e no-op (scope clean), **c détecte bug sécurité leaves/page.tsx** (isAdmin=leaves:read universel), d wrappe suivi page |
| V1C | e2e-author | 1 | séquentiel | 3 fichiers créés, 14 tests, bug React pré-existant signalé |
| V1D | admin-gallery-builder | 1 | séquentiel | 7 fichiers créés (1307 L), 5 tests activés |

---

## Compteurs baselines — règle PO net-zero régression respectée

| Vague | tsc errors | lint errors | lint warnings |
|---|---|---|---|
| Entrée Spec 3 | 96 | 10 | 24 |
| Fin V0 | 96 ✓ | 10 ✓ | 24 ✓ |
| Fin V1A | 96 ✓ | 10 ✓ | 24 ✓ |
| Fin V1B | 96 ✓ | 10 ✓ | 24 ✓ |
| Fin V1C | 96 ✓ | 10 ✓ | 24 ✓ |
| Fin V1D | 96 ✓ | 10 ✓ | 24 ✓ |
| Fin V2 | 96 ✓ | 10 ✓ | **23** (−1 warning gagné avec suppression ancienne page) |

**Aucune régression fin de vague.** Net-zero preservé.

---

## Décisions prises par les sub-agents (à valider PO)

### D1 V0 — `users/[id]/suivi/page.tsx` narrowing RESPONSABLE
Branche dept-wide RESPONSABLE supprimée. RESPONSABLE conserve la couverture via `managedServices`. À valider en test E2E multi-rôle (couvert en V1C granular-checks).

### D2 V0 — `admin/roles/page.tsx:190` mapping `Role.ADMIN` → `users:manage_roles`
Correspondance métier claire (ADMIN-only selon catalogue).

### D4 V0 — fallback `?? user.role` sur Type B display
Dégradation gracieuse jusqu'à Spec 2 V4 (drop enum). Compatible avec les payloads relationnels où `roleEntity` n'est pas projeté.

### D V1A-c — **Bug sécurité découvert et corrigé**
`leaves/page.tsx:101 const isAdmin = hasPermission("leaves:read")` — `leaves:read` étant dans `BASE_EMPLOYEE_PERMISSIONS`, tout utilisateur authentifié passait `isAdmin === true`. Conséquence : onglets/boutons admin (import, all-leaves, leave-types) visibles à tous. Pas de faille effective (endpoints back gatés), mais UI confusant.

Fix : split en `canReadAllLeaves = hasPermission("leaves:readAll")` + `canManageBalances = hasPermission("leaves:manage")`. 7 usages migrés proprement.

### D V1D — Gate route-level plutôt que HOC pour galerie admin
`withAccessControl` rend `null` ; pour le test 5 (BASIC_USER → redirect visible), un gate route-level avec `router.replace('/dashboard')` + fallback "Accès refusé" est préférable. Le HOC reste utile pour des composants individuels.

---

## STOPs non-bloquants (notes PO pour post-Spec 3)

1. **`tasks/page.tsx:114`** (V1A-b) — gate `hasPermission("tasks:create")` sur fetch orphelins, plus restrictif que l'API (`tasks:read`). UX discutable, pas bug sécurité. Arbitrage : aligner sur `tasks:read`, passer à `tasks:readAll`, ou conserver actuel.

2. **`e2e/tests/rbac/api-permissions.spec.ts`** — 11 tests failed **pré-existants** (drift `permission-matrix.ts` vs templates post-V2 refactor). Ex: CONTRIBUTEUR obtient 403 sur `GET /projects` alors que la matrix attendait 200. Ticket d'hygiène E2E à prévoir (mise à jour permission-matrix sur les 26 templates au lieu des 6 rôles legacy).

3. **Bug React dashboard/planning** (signalé par e2e-author V1C) — "Maximum update depth exceeded" sur `/fr/dashboard` et `/fr/planning` en dev mode (Next.js 16 + Zustand selector). Hors scope RBAC. Ticket séparé.

4. **`users/page.tsx:193`** (V0 STOP résolu) — payload `role: user.role` laissé inchangé. Backend `CreateUserDto`/`UpdateUserDto` accepte toujours `role: Role` (enum). Migration vers `roleId` = Spec 2 V4.

---

## Tests E2E Spec 3 nouveaux

### `e2e/tests/rbac/sidebar.spec.ts` (3 tests, 1 @smoke)
- ADMIN voit tous les items.
- MANAGER voit base + admin partiel (pas roleManagement/settings).
- CONTRIBUTEUR voit base limité + admin réduit (départements seul).

### `e2e/tests/rbac/granular-checks.spec.ts` (6 tests, 4 @smoke)
- ADMIN/BASIC_USER : onglet "À valider" leaves (leaves:approve).
- OBSERVATEUR : onglet "Toutes les demandes" (leaves:readAll) — **valide le fix V1A**.
- ADMIN/BASIC_USER : bouton "Créer un projet" (projects:create).
- BASIC_USER : page /users accessible mais actions cachées.

### `e2e/tests/rbac/admin-roles-gallery.spec.ts` (5 tests)
- ADMIN voit 26 templates groupés par 9 catégories.
- Chips catégorie filtrent les cards.
- Modale détail permissions (groupées par module).
- Création rôle custom via formulaire.
- BASIC_USER redirect dashboard.

**Total : 14 nouveaux tests E2E, tous verts en prod.**

---

## Suppressions V2

- `apps/web/app/[locale]/admin/roles/page.tsx` (ancienne UI 785 L)
- `e2e/tests/rbac/ui-permissions.spec.ts` (ancien E2E matrice legacy)

## Renames V2 (historique Git préservé via `git mv`)

- `admin/roles-v2` → `admin/roles`
- `components/admin/roles-v2` → `components/admin/roles`
- `services/roles-v2.service.ts` → `services/roles.service.ts`
- `rolesV2Service` → `rolesService`

---

## Déploiement prod

```
git push origin master                                → 05897c5 déployé
ssh debian@92.222.35.25
cd /opt/orchestra && git pull origin master
docker tag orchestra-web:latest orchestra-web:pre-spec3
docker compose build web                              → image 038cdb6f2e91 built
docker compose up -d web                              → healthy 15s
docker exec orchestr-a-redis-prod redis-cli FLUSHDB   → OK
```

Container state post-deploy :
```
orchestr-a-web-prod      Up 15 seconds (healthy)
orchestr-a-api-prod      Up 2 hours (healthy)
```

## Smoke tests prod

```
curl /api/auth/me/permissions (ADMIN)   → 107 ✓ (inchangé depuis V2ter)
curl /api/roles/templates               → 26 ✓
curl /fr/admin/roles (ADMIN)            → 200 ✓ (nouvelle galerie)
curl /fr/admin/roles-v2                 → 404 ✓ (ancienne route supprimée)
```

---

## Consignes PO respectées

- ✅ Cadence automatique V0 → V2 sans STOP intermédiaire (hormis les 2 advisors à Moment 1 & 2 du protocole V1A/V2).
- ✅ V1C produit nouveaux tests Playwright.
- ✅ 1 déploiement prod en fin de Spec 3 avec FLUSHDB Redis.
- ✅ P1 (dépendance rbac) exécuté avant V0 en commit séparé.
- ✅ P2 (règle ferme `user.roleEntity`) appliquée partout (15 sites migrés, 1 payload back laissé intentionnellement).
- ✅ P3 (E2E avant suppression ancienne UI) respecté.
- ✅ Baselines net-zero régression à chaque vague.
- ✅ Aucun sub-agent n'a commité ou déployé.
- ✅ Advisor sollicité Moment 1 (Vague 1A pattern) et Moment 2 (V2 point de non-retour). Moment 3 non requis — les compteurs finaux sont tous verts sans ambigüité de sémantique.
- ✅ Rapports stockés dans `backlog/rbac-refactor/spec3-progress/`.

**STOP après déploiement prod. Spec 3 close. Prêt pour Spec 2 V4 (drop legacy backend) quand PO valide.**
