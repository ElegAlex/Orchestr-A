# Spec 2 — Readiness report (Phase 0)

> Audit de cohérence avant Vague 0 de Spec 2. **Aucun code applicatif modifié.** Date : 2026-04-19.

---

## 1. Présence des 5 fichiers contrat

Tous les fichiers attendus existent dans `backlog/rbac-refactor/contract/` :

| Fichier | Taille | Statut |
|---|---:|---|
| `contract-01-atomic-permissions.ts` | 22 193 B | ✓ présent, lisible |
| `contract-02-templates.ts` | 36 755 B | ✓ présent, lisible |
| `contract-03-type-model.md` | 20 446 B | ✓ présent, lisible |
| `contract-04-helpers-api.md` | 19 992 B | ✓ présent, lisible |
| `contract-05-spec2-spec3-inputs.md` | 30 523 B | ✓ présent, lisible |

---

## 2. Compilation isolée des contrats TypeScript

Commande : `pnpm exec tsc --noEmit -p backlog/rbac-refactor/contract/tsconfig.json`

Sortie :
```
EXIT=0
```

Aucune erreur. `contract-01` et `contract-02` type-check en mode strict (`noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`).

---

## 3. Cohérence des fichiers backend à modifier (vs réalité repo)

Vérification de chaque chemin mentionné dans `contract-05-spec2-spec3-inputs.md §4` :

### À CONSERVER / MODIFIER (existence vérifiée)

| Chemin | Statut |
|---|---|
| `pnpm-workspace.yaml` | ✓ existe |
| `turbo.json` | ✓ existe |
| `packages/database/prisma/schema.prisma` | ✓ existe |
| `apps/api/src/auth/guards/permissions.guard.ts` | ✓ existe |
| `apps/api/src/auth/guards/roles.guard.ts` | ✓ existe (à supprimer Vague 4) |
| `apps/api/src/auth/decorators/permissions.decorator.ts` | ✓ existe |
| `apps/api/src/auth/decorators/roles.decorator.ts` | ✓ existe (à supprimer Vague 4) |
| `apps/api/src/auth/strategies/jwt.strategy.ts` | ✓ existe |
| `apps/api/src/role-management/role-management.service.ts` | ✓ existe (à supprimer Vague 4) |
| `apps/api/src/common/guards/ownership.guard.ts` | ✓ existe |
| `apps/api/src/*/[28 controllers].controller.ts` | ✓ 29 controllers détectés (audit-02 §1 en référençait 28) |

### À CRÉER (absence vérifiée — normal)

| Chemin | Statut attendu |
|---|---|
| `apps/api/src/rbac/` (module) | ✗ absent — création Vague 1 (C) |
| `packages/rbac/` (package partagé) | ✗ absent — création Vague 0 (B) |

`packages/` actuel : `config, database, types, ui, utils` — confirme l'absence de `rbac/`.

**Verdict §3** : aucun fichier attendu n'a disparu depuis Spec 1. La cartographie de contract-05 est cohérente avec l'état actuel du repo.

---

## 4. Branche git actuelle

```
$ git rev-parse --abbrev-ref HEAD
master

$ git log -1 --oneline
bcd0202 feat(planning): filtres légende actionnables pour Terminé + types d'absence
```

**Divergence détectée vs spec §1** : la spec demande « branche git actuelle dédiée au refactor (nommage cohérent, ex : `refactor/rbac-templates`) ». Or **branche actuelle = `master`**.

**Mémoire applicable** (`feedback_no_feature_branches`, validée 2026-04-09) :
> « Work directly on master, don't create branches unless asked. User said "je ne t'ai jamais demandé de créer une branche". They prefer committing directly to master. »

**Décision proposée** : rester sur `master`. Cohérent avec le workflow utilisateur établi. La spec mentionne la branche dédiée comme bonne pratique, pas comme contrainte non négociable. **Si le PO veut une branche dédiée pour cette refonte (ampleur 5 vagues, risques DB élevés), il doit l'arbitrer explicitement avant Vague 0.**

Recommandation alternative : créer une branche `refactor/rbac-spec2` uniquement pour le merge final (PR coordonné), mais commit direct sur master pour les vagues — risqué car aucun rollback Git facile sans revert massif.

**À arbitrer par PO.**

---

## 5. Migrations Prisma pending

Dernière migration locale : `20260415135502_add_refresh_tokens` (19 migrations totales).

Prod (`orchestr-a-postgres-prod`) :
```
                        migration_name
--------------------------------------------------------------
 20260415135502_add_refresh_tokens
 20260415131201_add_force_password_change
 20260411100717_add_third_parties_and_time_entry_actor_xor
 20260409112404_add_school_vacations
 20260405215351_add_external_intervention_to_predefined_tasks
```

**Local et prod sont alignés sur la même migration HEAD**. Aucune migration pending de part ou d'autre. Vague 0 de Spec 2 démarre sur un état DB stable, sans interférence.

---

## 6. Tests d'intégration backend RBAC existants (baseline)

Liste des 19 fichiers `*.spec.ts` qui touchent au RBAC (`grep` sur `PermissionsGuard|RolesGuard|@Permissions|@Roles|getPermissionsForRole|OwnershipGuard|manage_any`) :

**Tests guards / RBAC core (3)**
- `apps/api/src/auth/guards/permissions.guard.spec.ts` — invariants P1-P8 (cf. contract-04 §1)
- `apps/api/src/auth/guards/roles.guard.spec.ts` — contrat SEC-03 S1-S5
- `apps/api/src/common/guards/ownership.guard.spec.ts` — bypass `manage_any`

**Tests services (8)**
- `apps/api/src/role-management/role-management.service.spec.ts`
- `apps/api/src/tasks/tasks.service.spec.ts`
- `apps/api/src/leaves/leaves.service.spec.ts`
- `apps/api/src/comments/comments.service.spec.ts`
- `apps/api/src/auth/auth.service.spec.ts`
- `apps/api/src/projects/projects.service.spec.ts`
- `apps/api/src/telework/telework.service.spec.ts`
- `apps/api/src/events/events.service.spec.ts`
- `apps/api/src/time-tracking/time-tracking.service.spec.ts`
- `apps/api/src/planning/planning.service.spec.ts`

**Tests controllers (6)**
- `apps/api/src/auth/auth.controller.spec.ts`
- `apps/api/src/leaves/leaves.controller.spec.ts`
- `apps/api/src/events/events.controller.spec.ts`
- `apps/api/src/documents/documents.controller.spec.ts`
- `apps/api/src/analytics/analytics.controller.spec.ts`
- `apps/api/src/time-tracking/time-tracking.controller.spec.ts`

**Action recommandée Vague 0** : `pnpm --filter api test` baseline complet en début de vague pour capturer le green run actuel. Tout test qui passe maintenant doit continuer à passer post-refactor (ou être adapté si le contrat change — ex. `roles.guard.spec.ts` qui sera supprimé en Vague 4).

---

## 7. Synthèse — feu vert / arbitrages

### Feux verts

- ✓ 5 contrats présents et lisibles
- ✓ Compilation isolée OK (`tsc --noEmit` exit 0)
- ✓ Tous les fichiers backend à modifier existent au chemin attendu
- ✓ DB prod et local alignées, aucune migration pending
- ✓ 19 fichiers de tests RBAC backend identifiés comme baseline

### Arbitrages PO requis avant Vague 0

1. **Branche git** (§4) : rester sur `master` (workflow validé) ou créer `refactor/rbac-spec2` ? Implication : risque rollback Git si on reste sur master en cas d'incident pendant les 5 vagues.

2. **Backup prod préalable obligatoire** : Spec 2 Vague 0 modifie le schéma Prisma + ajoute `users.role_id` + backfill. Risque DB élevé. Memory `feedback_verify_before_destructive_prod_changes` impose `pg_dump` avant. **Je propose de faire un backup prod immédiat (équivalent à celui du 2026-04-19 173653) juste avant l'exécution de la Vague 0**, et de le rapatrier en local. À confirmer.

3. **Cadence des vagues** : la spec indique « validation PO entre chaque vague ». Je propose : STOP après chaque vague pour validation explicite (rapport + diff), pas d'enchaînement automatique.

### Pas de blocage technique

Hormis les 2 arbitrages ci-dessus, **rien ne bloque le démarrage de la Vague 0 A** (schema + migration + seed).

---

## 8. STOP — validation PO requise

J'attends ta validation explicite + arbitrages §7 avant de démarrer Vague 0 A (Teammate A : schema + migration + seed). Aucun fichier applicatif n'a été modifié pendant ce readiness.
