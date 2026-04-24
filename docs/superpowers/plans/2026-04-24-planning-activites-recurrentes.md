# Planning d'activités récurrentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Dispatch sub-agents explicitly avec `model: "sonnet"`.

**Goal:** Livrer les 5 épopées (E1-E5) du besoin IA nº01 CDG — pondération, récurrence mensuelle, statut d'exécution, équilibrage de charge, Vue Activité — sans régression sur le planning existant et avec couverture RBAC complète.

**Architecture:** Extension incrémentale des modules `apps/api/src/predefined-tasks` et `apps/api/src/planning`, ajout d'un modèle `AuditLog` persistant (option A validée), nouveau composant `ActivityGrid` + modale `BalancedPlanningModal`. Source de données unique (`GET /planning/overview`) pour les trois modes (week/month/activity). Principe strict d'unicité des assignations.

**Tech Stack:** NestJS 11 + Fastify 5 + Prisma 6 + PostgreSQL 18 ; Next.js 16 App Router + React 19 + TanStack Query + Zustand + Tailwind 4 + Radix UI ; Vitest (API `*.spec.ts`) + Jest (Web `*.test.ts`) + Playwright (E2E).

---

## Overrides vs spec

Les règles suivantes prévalent sur le BACKLOG source (hiérarchie user > skill > default) :

| Override | Source règle | Conséquence |
|---|---|---|
| **Commit direct sur `master`**, pas de branche par wave | mémoire `feedback_no_feature_branches` | Annule §8.5 spec. Chaque wave ajoute ses commits directement sur master, push + deploy à chaque fin de wave. |
| **Vrai SSH + rebuild VPS** en exit criteria de CHAQUE wave | mémoire `feedback_deploy_workflow_is_fake` | Annule la confiance dans `.github/workflows/deploy.yml`. Après push, `ssh debian@92.222.35.25` + `git pull` + `docker compose -f docker-compose.prod.yml up -d --build <service>`. |
| **Sub-agents en `model: "sonnet"` explicite** | mémoire `feedback_use_opus_for_agents` | Chaque dispatch Agent tool DOIT passer `model: "sonnet"`. |
| **Monitor armé AU LANCEMENT** pour tout process > 10s | mémoire `feedback_never_trust_blind_monitor` | Builds, deploys, `gh run watch` : jamais de fire-and-forget. |
| **Aucun hardcode de rôle** dans la logique métier | mémoire `feedback_no_hardcode_hotfix` | Passer par `roleManagementService.getPermissionsForRole()` / `PermissionsService` — pas de `role === 'ADMIN'`. |
| **API computed flags** (`canEdit`, `canUpdateStatus`, etc.) par ressource | mémoire `feedback_api_computed_flags` | Le frontend ne recompute jamais l'autorisation localement. |
| **Requête de diag RBAC** en DoD de toute wave ajoutant une permission | mémoire `project_rbac_seed_silent_skip` | SQL fourni dans W1 et W4 DoD, résultat attendu = 0 ligne. |
| **Mockups HTML validés par PO** avant tâches UI E3.2, E4.3, E5.2 | mémoire `feedback_demand_mockup_for_visual_specs` | Intégré en W0.5, gate bloquant W2-E3.2, W3-E4.3, W4-E5.2. |
| **Wording RBAC** : « rôles institutionnels », jamais « custom » | mémoire `feedback_no_custom_role_wording` | Applicable à la doc utilisateur W5.2. |

---

## Conventions d'exécution

- **Style TDD** : pour toute story avec à la fois tâche `[PARALLÈLE]` impl + tests, **un seul sub-agent** produit d'abord le spec en échec, puis l'implémentation minimale, puis refactor. Pas de décomposition « un agent écrit les tests / un agent écrit le code » : ça casse TDD.
- **Commit granularité** : 1 commit par étape significative (test rouge → test vert → refactor → intégration) ou regroupé par cohérence atomique, jamais WIP sur master.
- **Messages de commit** : format conventionnel `<type>(<scope>): <sujet>` — `feat(predefined-tasks): …`, `feat(planning): …`, `test(predefined-tasks): …`, `refactor(planning): …`, `chore(rbac): …`, `docs(adr): …`.
- **Pas de `--no-verify`, pas de `--amend`** sur commits poussés.
- **Dispatch sub-agent** : toujours prompt auto-portant (contexte + contrainte + DoR + DoD + commandes de vérif), liste de fichiers autorisés, sortie structurée exigée. `model: "sonnet"` explicite.
- **Verification before completion** : aucune tâche marquée `completed` sans exécution réelle des commandes et capture de sortie attendue.

---

## Wave 0 — Cadrage technique & Mockups

**Objectif :** consolider les décisions load-bearing (schéma cible, audit, algorithme), valider visuellement les 3 surfaces UI à risque, préparer le catalogue RBAC compile-time. Aucune migration DB dans cette vague.

**Entry criteria :** BACKLOG validé, arbitrages produit pris (audit table = option A, mockups produits par l'agent).

**Exit criteria :**
- 3 ADRs mergés dans `docs/adr/`.
- Mockups HTML pour E3.2, E4.3, E5.2 validés par le PO (visuel).
- Catalogue RBAC compile-time étendu (4 permissions) dans `packages/rbac/atomic-permissions.ts` et ajouté aux templates pertinents.
- Build `pnpm run build` ✅.
- Commit + push + deploy VPS (rollout des nouvelles permissions compile-time seules, sans migration DB).

### Task W0.1 — Atelier métier (humain, hors Claude)

**Files:** (aucun — livrable oral/notes)

- [ ] **Step 1 :** Atelier tenu avec Laurence Preschez + Abdelaziz Beouch. Sortie : liste définitive des tâches récurrentes CDG, fréquences réelles, échelle de poids convenue, règles d'équité, contraintes de compétence éventuelles.
- [ ] **Step 2 :** Consigner les règles métier dans `docs/adr/2026-04-24-rbac-planning-activites-context.md` (notes brutes, pas d'ADR formel — entrée pour W0.2).

**DoR :** backlog validé par Preschez. **DoD :** notes écrites + validation mail de Preschez.

---

### Task W0.2 — ADR 01 : Schéma Prisma cible consolidé

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/docs/adr/2026-04-24-01-schema-planning-activites.md`

- [ ] **Step 1 :** Rédiger l'ADR avec les 4 extensions de schéma consolidées dans un seul document, à exécuter en 3 migrations disjointes (une par wave).

Contenu obligatoire :

```markdown
# ADR-01 — Schéma Prisma cible pour Planning d'activités récurrentes

## Contexte
Extension des modèles `PredefinedTask`, `PredefinedTaskAssignment`, `PredefinedTaskRecurringRule` + création d'un modèle `AuditLog` pour tracer les transitions de statut et les apply du balancer.

## Décision

### Extension 1 — PredefinedTask (W1)
```prisma
model PredefinedTask {
  // ... champs existants
  weight Int @default(1) // 1..5, pondération pour équilibrage
}
```
Contrainte : `@Min(1) @Max(5)` côté DTO (pas de CHECK SQL, validation applicative uniquement — cohérence avec le reste du schema).

### Extension 2 — PredefinedTaskAssignment (W2)
```prisma
model PredefinedTaskAssignment {
  // ... champs existants
  completionStatus String   @default("NOT_DONE") // NOT_DONE | IN_PROGRESS | DONE | NOT_APPLICABLE
  completedAt      DateTime?
  completedById    String?
  completedBy      User?    @relation("AssignmentCompletedBy", fields: [completedById], references: [id])
  notApplicableReason String?

  @@index([date, userId]) // perf /planning/overview
  @@index([completionStatus, date]) // perf alerte retard
}
```

### Extension 3 — PredefinedTaskRecurringRule (W2)
```prisma
model PredefinedTaskRecurringRule {
  // ... champs existants
  recurrenceType     String @default("WEEKLY") // WEEKLY | MONTHLY_ORDINAL | MONTHLY_DAY
  monthlyOrdinal     Int?   // 1..5 (5 = dernière occurrence)
  monthlyDayOfMonth  Int?   // 1..31
  dayOfWeek          Int?   // devient nullable pour MONTHLY_DAY
}
```

### Extension 4 — AuditLog (W1, nouvelle table)
```prisma
model AuditLog {
  id         String   @id @default(uuid())
  action     String   // ASSIGNMENT_STATUS_CHANGED | BALANCER_APPLIED | ...
  entityType String   // PredefinedTaskAssignment | PredefinedTaskRecurringRule | ...
  entityId   String
  actorId    String?
  actor      User?    @relation("AuditActor", fields: [actorId], references: [id])
  payload    Json?    // before/after, context
  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([actorId, createdAt])
  @@map("audit_logs")
}
```

## Conséquences
- 3 migrations disjointes (W1, W2) — pas de rollback partiel inter-wave.
- Aucun jour férié ne décale les assignations en V1 (voir ADR-03).
- `completedBy` et `actor` demandent une relation sur `User` (à ajouter côté inverse dans le modèle User).
```

- [ ] **Step 2 :** Commit.

```bash
git add docs/adr/2026-04-24-01-schema-planning-activites.md
git commit -m "docs(adr): schéma Prisma cible pour Planning d'activités récurrentes"
```

---

### Task W0.3 — ADR 02 : Stratégie d'audit persistant

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/docs/adr/2026-04-24-02-audit-strategy.md`

- [ ] **Step 1 :** Rédiger l'ADR.

Contenu obligatoire :

```markdown
# ADR-02 — Stratégie d'audit persistant V1

## Contexte
Le besoin E3 (statut d'exécution) et E4 (balancer apply) exigent une traçabilité RGPD. L'`AuditService` existant écrit en console (Winston) sans persistance DB. Option A validée : créer une table dédiée `AuditLog`.

## Décision
1. Nouvelle table `audit_logs` (voir ADR-01).
2. Nouveau service `AuditPersistenceService` (séparé de l'existant `AuditService` console) dans `apps/api/src/audit/audit-persistence.service.ts`. Méthode unique : `log({ action, entityType, entityId, actorId?, payload? })`.
3. Appels obligatoires :
   - `PATCH /predefined-tasks/assignments/:id/completion` → `ASSIGNMENT_STATUS_CHANGED` avec payload `{ before, after, reason? }`.
   - `POST /predefined-tasks/recurring-rules/generate-balanced` mode `apply` → `BALANCER_APPLIED` avec payload `{ range, serviceId, assignmentsCreated, equityRatio }`.
4. Scope V1 **strict** : ces 2 actions uniquement. Pas de log sur CRUD existant. Extension future hors périmètre.

## Conséquences
- Nouvelle dépendance du module `predefined-tasks` sur `audit`.
- Rétention DB : aucune politique en V1 (à traiter hors lot si volumes > 100k lignes).
- Pas de mutation de payload (immutable par convention, pas de `updatedAt`).
```

- [ ] **Step 2 :** Commit.

```bash
git add docs/adr/2026-04-24-02-audit-strategy.md
git commit -m "docs(adr): stratégie d'audit persistant via table audit_logs"
```

---

### Task W0.4 — ADR 03 : Algorithme d'équilibrage glouton

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/docs/adr/2026-04-24-03-balancer-algorithm.md`

- [ ] **Step 1 :** Rédiger l'ADR avec pseudo-code et 5 jeux de tests déterministes.

Contenu obligatoire :

```markdown
# ADR-03 — Algorithme d'équilibrage glouton V1

## Contexte
US E4.1 exige un service `PlanningBalancerService.balance(input)` avec contraintes : heuristique gloutonne, <3s pour 20 agents × 30 tâches sur un mois, écartement des absents par occurrence, support contraintes de compétence optionnelles.

## Décision

### Types
```typescript
type BalancerInput = {
  occurrences: Array<{ taskId: string; weight: number; date: Date; period: "MORNING" | "AFTERNOON" | "FULL_DAY" }>;
  agents: Array<{ userId: string; skills?: string[] }>;
  absences: Map<string /* userId */, Array<{ startDate: Date; endDate: Date }>>; // indexé par user
  taskRequiredSkills?: Map<string /* taskId */, string[]>;
};

type BalancerOutput = {
  proposedAssignments: Array<{ taskId: string; userId: string; date: Date; period: string; weight: number }>;
  workloadByAgent: Array<{ userId: string; weightedLoad: number }>;
  equityRatio: number; // 1 - σ/µ, plus proche de 1 = mieux
  unassignedOccurrences: Array<{ taskId: string; date: Date; period: string; reason: string }>;
};
```

### Pseudo-code
```
function balance(input):
  workload := Map<userId, number> initialisé à 0 pour chaque agent
  result := []
  unassigned := []

  occurrences := input.occurrences triées par (date asc, period asc, taskId asc) # déterministe

  for occ in occurrences:
    # 1. filtrer agents éligibles
    eligibles := input.agents filtrés par:
      - non absents sur occ.date
      - possèdent les skills requis si taskRequiredSkills[occ.taskId] défini
    if eligibles vide:
      unassigned.push({ occ, reason: "no eligible agent" })
      continue

    # 2. choisir l'agent avec charge minimale, départage par userId asc (stable)
    chosen := argmin(eligibles, a -> (workload[a.userId], a.userId))

    # 3. affecter
    result.push({ ...occ, userId: chosen.userId })
    workload[chosen.userId] += occ.weight

  # 4. calculer ratio d'équité
  loads := Array.from(workload.values())
  µ := moyenne(loads); σ := écart-type(loads)
  equityRatio := µ > 0 ? 1 - σ/µ : 1

  return { proposedAssignments: result, workloadByAgent: ..., equityRatio, unassignedOccurrences: unassigned }
```

### Complexité
- O(|occurrences| × |agents|) dans le pire cas (linéaire pour trouver le min).
- 20 × 30 × 30 (jours) = 18 000 itérations max → très loin des 3 s.

### Jeux de tests déterministes (minimum 5, en W3)
1. **Cas trivial** : 1 agent, 1 occurrence → 1 assignation, equity = 1.
2. **Répartition parfaite** : 2 agents, 4 occurrences même poids → 2 par agent, equity = 1.
3. **Poids asymétriques** : 3 agents, 6 occurrences poids [5,5,1,1,1,1] → vérifier que les 5+5 ne sont pas chez le même agent.
4. **Absence bloquante** : 2 agents, 2 occurrences, 1 agent absent sur jour 1 → 1ère occurrence va au disponible, 2e à l'autre.
5. **Compétence requise** : 3 agents, 1 occurrence exigeant skill X, 1 seul agent l'a → assignation forcée + charge enregistrée.
6. **Aucun éligible** : 2 agents tous absents → unassignedOccurrences non vide.
7. **Départage stable** : 2 agents charges égales → userId lexicographiquement inférieur gagne (reproductibilité).

### Idempotence de l'apply
Le tuple `@@unique([predefinedTaskId, userId, date, period])` sur `PredefinedTaskAssignment` assure qu'un replay sur la même plage ne duplique pas. Implémentation : `createMany({ ... skipDuplicates: true })` dans la transaction.

### Hors périmètre V1
- Optimisation globale (ILP, contrainte programming).
- Jours fériés comme contrainte (l'heuristique les ignore, l'utilisateur peut pré-filtrer les occurrences via le front).
- Rotation d'équité inter-plages (la V1 est stateless, chaque appel repart à charge 0).
```

- [ ] **Step 2 :** Commit.

```bash
git add docs/adr/2026-04-24-03-balancer-algorithm.md
git commit -m "docs(adr): algorithme d'équilibrage glouton V1 (pseudo-code + jeux de tests)"
```

---

### Task W0.5 — Mockups HTML pour E3.2 / E4.3 / E5.2

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/docs/superpowers/mockups/2026-04-24-planning-activites/E3.2-status-popover.html`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/docs/superpowers/mockups/2026-04-24-planning-activites/E4.3-balanced-planning-modal.html`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/docs/superpowers/mockups/2026-04-24-planning-activites/E5.2-activity-grid.html`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/docs/superpowers/mockups/2026-04-24-planning-activites/README.md`

- [ ] **Step 1 :** Dispatch 1 sub-agent Sonnet par mockup (3 en parallèle) avec consigne stricte :
  - HTML + CSS inline, Tailwind CDN, palette Orchestr'A (greys zinc, accent bleu primaire, alert rouge, success vert).
  - 2 à 3 variantes par fichier (side-by-side via `<section>`), annotées.
  - Densité réaliste : E5.2 doit afficher 20 jours × 8 tâches × 1-2 users par cellule.
  - Pas de JS, pas de dépendances, ouvrable en file://.

Prompt type sub-agent (E5.2, adapter pour E3.2 et E4.3) :

```
Tu produis un mockup HTML/CSS autonome pour la Vue Activité (E5.2) d'Orchestr'A.

Contexte : pivot du planning où les jours sont en lignes et les tâches prédéfinies en colonnes. Chaque cellule affiche le(s) utilisateur(s) assigné(s) + un badge de statut d'exécution (DONE / IN_PROGRESS / NOT_DONE / NOT_APPLICABLE / LATE).

Contraintes visuelles:
- Tailwind CDN uniquement (<script src="https://cdn.tailwindcss.com"></script>)
- Palette: gris zinc, primary blue-600, alert red-500, success emerald-500, warning amber-500
- Densité cible: 20 jours × 8 tâches, rendu compact mais lisible
- Badge de statut: iconographie Lucide (check, clock, dot, dash, alert-triangle)
- Lignes alternées pour week-ends/fériés
- Sticky column 1 (dates) + sticky header (tâches)

Livrable: un seul fichier HTML avec 2 variantes dans 2 <section> side-by-side, séparées par un <h2>. Annotations courtes sous chaque variante (pros/cons).

Sauvegarde: /home/alex/Documents/REPO/ORCHESTRA/docs/superpowers/mockups/2026-04-24-planning-activites/E5.2-activity-grid.html

Output: juste le path du fichier créé + un résumé <100 mots des choix de design.
```

- [ ] **Step 2 :** Une fois les 3 mockups générés, créer `README.md` qui liste les 3 fichiers + capture d'écran d'ouverture + link pour validation PO.

```markdown
# Mockups Planning Activités Récurrentes — 2026-04-24

3 surfaces UI à risque densité élevée, validation PO requise avant implémentation des tâches correspondantes.

| Surface | Fichier | Story bloquée si non validé |
|---|---|---|
| Popover transition de statut | [E3.2-status-popover.html](./E3.2-status-popover.html) | W2 — E3.2 |
| Modale planning équilibré | [E4.3-balanced-planning-modal.html](./E4.3-balanced-planning-modal.html) | W3 — E4.3 |
| Grille Vue Activité | [E5.2-activity-grid.html](./E5.2-activity-grid.html) | W4 — E5.2 |

## Validation PO
Ouvrir chaque fichier dans le navigateur (file://), choisir la variante préférée, annoter via commentaire GitHub ou mail. Une fois validé, le sub-agent UI correspondant reçoit la variante choisie comme contrainte d'implémentation.
```

- [ ] **Step 3 :** Commit + demande de validation PO.

```bash
git add docs/superpowers/mockups/2026-04-24-planning-activites/
git commit -m "docs(mockups): 3 surfaces UI du lot Planning activités récurrentes"
```

**Gate :** validation explicite PO (mail ou message) sur les 3 variantes choisies avant d'entrer en W2 pour E3.2, en W3 pour E4.3, en W4 pour E5.2. Les autres tâches techniques ne sont pas gatées par ce livrable.

---

### Task W0.6 — Catalogue RBAC compile-time étendu

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/packages/rbac/atomic-permissions.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/packages/rbac/templates.ts`

- [ ] **Step 1 :** Lire les fichiers existants pour identifier le format exact des constantes et des templates.

Commande :
```bash
grep -n "predefined_tasks:" /home/alex/Documents/REPO/ORCHESTRA/packages/rbac/atomic-permissions.ts /home/alex/Documents/REPO/ORCHESTRA/packages/rbac/templates.ts
```

- [ ] **Step 2 :** Ajouter les 4 nouvelles permissions dans `CATALOG_PERMISSIONS` (fichier `atomic-permissions.ts`), en respectant l'ordre alphabétique du bloc `predefined_tasks:` + ajout du bloc `planning:`.

```typescript
// Dans CATALOG_PERMISSIONS, bloc predefined_tasks — ordre alpha :
'predefined_tasks:assign',
'predefined_tasks:balance',            // NEW
'predefined_tasks:create',
'predefined_tasks:delete',
'predefined_tasks:edit',
'predefined_tasks:update-any-status',  // NEW
'predefined_tasks:update-own-status',  // NEW
'predefined_tasks:view',

// Nouveau bloc planning : (respecter l'ordre global du catalog)
'planning:activity-view',               // NEW
```

Ajouter aussi dans les atomiques si pattern existant (exemple) :
```typescript
export const PREDEFINED_TASKS_ADMIN = [
  'predefined_tasks:create',
  'predefined_tasks:edit',
  'predefined_tasks:delete',
  'predefined_tasks:assign',
  'predefined_tasks:balance',          // NEW — admin seulement
  'predefined_tasks:update-any-status',// NEW — admin/responsable
] as const;

export const PREDEFINED_TASKS_OWN = [
  'predefined_tasks:view',
  'predefined_tasks:update-own-status',// NEW — tous rôles opérationnels
] as const;

export const PLANNING_ACTIVITY = [
  'planning:activity-view',            // NEW
] as const;
```

- [ ] **Step 3 :** Distribuer les permissions aux templates dans `templates.ts` selon la règle métier (sans hardcode dans le code applicatif, uniquement dans le template) :

| Permission | ADMIN | RESPONSABLE | MANAGER | REFERENT_TECHNIQUE | CONTRIBUTEUR | OBSERVATEUR |
|---|---|---|---|---|---|---|
| `predefined_tasks:balance` | ✅ | ✅ (scope service) | ❌ | ❌ | ❌ | ❌ |
| `predefined_tasks:update-any-status` | ✅ | ✅ (scope service) | ✅ (scope service) | ❌ | ❌ | ❌ |
| `predefined_tasks:update-own-status` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `planning:activity-view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Note : le scope (service managé) est porté par le guard côté API (`@OwnershipCheck`), pas par la permission elle-même. La permission donne le droit, le service-scope filtre le périmètre. (cf. `project_responsable_scope_perimeter`).

- [ ] **Step 4 :** Build + tests unitaires pkg RBAC.

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm run build --filter=@orchestra/rbac
pnpm run test --filter=@orchestra/rbac 2>&1 | tail -20
```

Expected : build ✅, tests ✅.

- [ ] **Step 5 :** Commit.

```bash
git add packages/rbac/atomic-permissions.ts packages/rbac/templates.ts
git commit -m "feat(rbac): ajoute 4 permissions pour planning activités récurrentes (compile-time)"
```

**Note :** ces permissions sont compile-time uniquement. La matérialisation en DB (INSERT dans `role_permissions`) se fait en W1.2 via migration de seed idempotente. Ne pas pousser en prod avant W1 complète, sinon un ADMIN pourrait appeler les futurs endpoints sans avoir la permission DB.

---

### Wave 0 — Exit criteria

- [ ] Les 3 ADRs sont mergés sur master.
- [ ] Les 3 mockups HTML sont produits, validés par le PO (trace écrite : mail, issue GH ou message Slack).
- [ ] Le catalogue RBAC compile-time inclut les 4 nouvelles permissions, distribuées aux templates.
- [ ] `pnpm run build` ✅ full repo.
- [ ] Push `origin/master` + deploy VPS via vrai SSH (cf. conventions).

**Commande deploy :**
```bash
ssh debian@92.222.35.25 'cd /opt/orchestra && git pull origin master && docker compose -f docker-compose.prod.yml build api web && docker compose -f docker-compose.prod.yml up -d api web'
```

Puis `curl -sf https://orchestr-a.com/api/health | jq .` — statut `ok`.

---

## Wave 1 — Schéma de données + pondération (E1) + RBAC DB

**Objectif :** livrer la migration Prisma pour `weight` + table `AuditLog`, matérialiser les 4 permissions en DB, rendre la pondération utilisable de bout en bout (API + UI + affichage DayCell).

**Entry criteria :** W0 closed, mockups validés (pas de dépendance mockup pour W1, mais ADRs et RBAC compile-time sont obligatoires).

**Exit criteria :**
- Migration Prisma `weight` + `audit_logs` appliquée en prod sans régression.
- Les 4 permissions RBAC sont bien présentes dans `role_permissions` pour les rôles prévus (requête de diag = 0 ligne).
- Pondération visible dans le formulaire de tâche prédéfinie + dans `DayCell`.
- `pnpm run test` ✅ API + web.
- E2E Playwright : 1 scénario nominal E1 (créer tâche avec weight=3, voir dans DayCell).
- Push + deploy VPS + purge Redis cache `role-permissions:*`.

### Task W1.1 — Migration Prisma : `weight` + `AuditLog`

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/schema.prisma`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/<TIMESTAMP>_add_weight_and_audit_log/migration.sql` (généré par `prisma migrate dev`)

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur uniquement (schema.prisma = un seul éditeur à la fois, cf. CLAUDE.md).

- [ ] **Step 1 :** Ouvrir `schema.prisma`, localiser le modèle `PredefinedTask` (~ligne 938) et y ajouter le champ `weight`.

```prisma
// À ajouter dans model PredefinedTask, après `isExternalIntervention Boolean @default(false)` :
  weight Int @default(1)
```

- [ ] **Step 2 :** Ajouter le modèle `AuditLog` en fin de fichier (avant les enums éventuels).

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  action     String
  entityType String
  entityId   String
  actorId    String?
  actor      User?    @relation("AuditActor", fields: [actorId], references: [id])
  payload    Json?
  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([actorId, createdAt])
  @@map("audit_logs")
}
```

- [ ] **Step 3 :** Ajouter la relation inverse sur `User` (dans le modèle `User`, après les relations existantes) :

```prisma
  auditLogs AuditLog[] @relation("AuditActor")
```

- [ ] **Step 4 :** Générer la migration.

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm prisma migrate dev --schema=packages/database/prisma/schema.prisma --name add_weight_and_audit_log
```

Expected : migration créée sous `packages/database/prisma/migrations/YYYYMMDDHHMMSS_add_weight_and_audit_log/migration.sql`, DB locale migrée, Prisma Client regénéré.

- [ ] **Step 5 :** Vérifier le SQL généré (ajouts seulement, aucun DROP).

```bash
cat packages/database/prisma/migrations/*_add_weight_and_audit_log/migration.sql
```

Expected (extrait) :
```sql
ALTER TABLE "predefined_tasks" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 1;
CREATE TABLE "audit_logs" ( ... );
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");
```

- [ ] **Step 6 :** Tester la migration down (montée/descente).

```bash
pnpm prisma migrate reset --schema=packages/database/prisma/schema.prisma --force --skip-seed
pnpm prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

Expected : DB réinitialisée et remontée proprement.

- [ ] **Step 7 :** Commit.

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(database): weight sur PredefinedTask + modèle AuditLog"
```

---

### Task W1.2 — Migration de seed RBAC idempotente

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/<TIMESTAMP>_seed_planning_permissions/migration.sql`

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur.

- [ ] **Step 1 :** Identifier les codes de rôles système en DB.

```bash
ssh debian@92.222.35.25 "docker exec orchestra-postgres psql -U orchestra -d orchestra_prod -c \"SELECT code, name FROM role_configs WHERE isSystem=true ORDER BY code;\""
```

Expected : liste `ADMIN`, `RESPONSABLE`, `MANAGER`, `REFERENT_TECHNIQUE`, `CONTRIBUTEUR`, `OBSERVATEUR` (confirmer les codes exacts).

- [ ] **Step 2 :** Créer une migration SQL pure (empty Prisma migration, puis édition manuelle) idempotente.

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm prisma migrate dev --schema=packages/database/prisma/schema.prisma --name seed_planning_permissions --create-only
```

Remplacer le contenu de `migration.sql` par :

```sql
-- Seed idempotent des 4 nouvelles permissions pour le lot Planning d'activités récurrentes

-- 1. Permissions (upsert)
INSERT INTO permissions (id, code, description, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'predefined_tasks:balance',           'Déclencher la génération équilibrée',        NOW(), NOW()),
  (gen_random_uuid(), 'predefined_tasks:update-own-status', 'Mettre à jour le statut de ses assignations',NOW(), NOW()),
  (gen_random_uuid(), 'predefined_tasks:update-any-status', 'Mettre à jour le statut de toute assignation',NOW(), NOW()),
  (gen_random_uuid(), 'planning:activity-view',             'Accéder au mode Vue Activité',               NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- 2. Attribution aux rôles système
-- ADMIN : toutes les 4
INSERT INTO role_permissions ("roleConfigId", "permissionId")
SELECT rc.id, p.id
FROM role_configs rc
CROSS JOIN permissions p
WHERE rc.code = 'ADMIN'
  AND p.code IN ('predefined_tasks:balance','predefined_tasks:update-own-status','predefined_tasks:update-any-status','planning:activity-view')
ON CONFLICT DO NOTHING;

-- RESPONSABLE : les 4 également (scope DB via @OwnershipCheck côté code)
INSERT INTO role_permissions ("roleConfigId", "permissionId")
SELECT rc.id, p.id
FROM role_configs rc
CROSS JOIN permissions p
WHERE rc.code = 'RESPONSABLE'
  AND p.code IN ('predefined_tasks:balance','predefined_tasks:update-own-status','predefined_tasks:update-any-status','planning:activity-view')
ON CONFLICT DO NOTHING;

-- MANAGER : update-any-status (scope service), update-own-status, activity-view
INSERT INTO role_permissions ("roleConfigId", "permissionId")
SELECT rc.id, p.id
FROM role_configs rc
CROSS JOIN permissions p
WHERE rc.code = 'MANAGER'
  AND p.code IN ('predefined_tasks:update-any-status','predefined_tasks:update-own-status','planning:activity-view')
ON CONFLICT DO NOTHING;

-- REFERENT_TECHNIQUE & CONTRIBUTEUR : update-own-status + activity-view
INSERT INTO role_permissions ("roleConfigId", "permissionId")
SELECT rc.id, p.id
FROM role_configs rc
CROSS JOIN permissions p
WHERE rc.code IN ('REFERENT_TECHNIQUE','CONTRIBUTEUR')
  AND p.code IN ('predefined_tasks:update-own-status','planning:activity-view')
ON CONFLICT DO NOTHING;

-- OBSERVATEUR : activity-view seulement
INSERT INTO role_permissions ("roleConfigId", "permissionId")
SELECT rc.id, p.id
FROM role_configs rc
CROSS JOIN permissions p
WHERE rc.code = 'OBSERVATEUR'
  AND p.code = 'planning:activity-view'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3 :** Appliquer et vérifier en local.

```bash
pnpm prisma migrate deploy --schema=packages/database/prisma/schema.prisma
docker exec orchestra-postgres-dev psql -U orchestra -d orchestra_dev -c "SELECT rc.code AS role, p.code AS perm FROM role_permissions rp JOIN role_configs rc ON rc.id=rp.\"roleConfigId\" JOIN permissions p ON p.id=rp.\"permissionId\" WHERE p.code LIKE '%:balance' OR p.code LIKE '%:update-%-status' OR p.code = 'planning:activity-view' ORDER BY rc.code, p.code;"
```

Expected (tableau) :
```
 role               | perm
--------------------+--------------------------------------
 ADMIN              | planning:activity-view
 ADMIN              | predefined_tasks:balance
 ADMIN              | predefined_tasks:update-any-status
 ADMIN              | predefined_tasks:update-own-status
 CONTRIBUTEUR       | planning:activity-view
 CONTRIBUTEUR       | predefined_tasks:update-own-status
 MANAGER            | planning:activity-view
 MANAGER            | predefined_tasks:update-any-status
 MANAGER            | predefined_tasks:update-own-status
 OBSERVATEUR        | planning:activity-view
 REFERENT_TECHNIQUE | planning:activity-view
 REFERENT_TECHNIQUE | predefined_tasks:update-own-status
 RESPONSABLE        | planning:activity-view
 RESPONSABLE        | predefined_tasks:balance
 RESPONSABLE        | predefined_tasks:update-any-status
 RESPONSABLE        | predefined_tasks:update-own-status
```

- [ ] **Step 4 :** Commit.

```bash
git add packages/database/prisma/migrations/*_seed_planning_permissions/
git commit -m "chore(rbac): seed idempotent des 4 permissions Planning activités"
```

---

### Task W1.3 — Backend E1 : DTO + service `weight` (sub-agent parallèle A)

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/dto/create-predefined-task.dto.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/dto/update-predefined-task.dto.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.service.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts`

**Sub-agent :** `[PARALLÈLE A]` — 1 agent Sonnet. Prompt auto-portant :

```
Tu implémentes le champ `weight` (Int 1..5, défaut 1) sur les tâches prédéfinies d'Orchestr'A, en TDD strict.

Contexte :
- Repo /home/alex/Documents/REPO/ORCHESTRA, stack NestJS 11 + Prisma 6
- La migration Prisma ajoutant `weight Int @default(1)` sur `PredefinedTask` est DÉJÀ appliquée
- Tu ne touches QUE les fichiers suivants :
  - apps/api/src/predefined-tasks/dto/create-predefined-task.dto.ts
  - apps/api/src/predefined-tasks/dto/update-predefined-task.dto.ts
  - apps/api/src/predefined-tasks/predefined-tasks.service.ts
  - apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts

Cycle TDD :
1. Écrire d'abord dans le .spec.ts : tests pour `create({ weight: 3 })` → task.weight === 3, `create({})` → task.weight === 1 (défaut), `update({ weight: 5 })` → maj OK, `create({ weight: 6 })` → throws ValidationError, `create({ weight: 0 })` → throws. Lance `pnpm --filter @orchestra/api test predefined-tasks.service` → tests FAIL (attendu).
2. Étendre CreatePredefinedTaskDto avec:
    @IsOptional() @IsInt() @Min(1) @Max(5) weight?: number;
3. Étendre UpdatePredefinedTaskDto (qui étend PartialType) de façon implicite.
4. Dans le service, dans `create()` et `update()`, passer `weight: dto.weight` à Prisma.
5. Relancer les tests → PASS.
6. Commit : "feat(predefined-tasks): ajoute champ weight (1..5) avec validation"

Contraintes :
- DRY : ne duplique pas la validation dans update, utilise PartialType
- Vérifier que `findAll()` et `findOne()` renvoient bien le weight (Prisma le fait par défaut si on ne select rien)
- model "sonnet" déclaré pour ton propre dispatch si tu re-dispatches
- Aucune interaction avec l'UI, l'i18n ou le front

Sortie attendue :
- diff des 4 fichiers
- sortie de `pnpm --filter @orchestra/api test predefined-tasks.service`
- confirmation de commit
```

- [ ] **Step 1 :** Dispatch l'agent Sonnet avec le prompt ci-dessus. **Monitor le sous-process.**

- [ ] **Step 2 :** À réception, review le diff + la sortie de tests. Si conforme, pas de nouveau commit (l'agent a committé).

- [ ] **Step 3 :** Sanity check manuel :

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm --filter @orchestra/api test predefined-tasks.service.spec 2>&1 | tail -30
```

Expected : 5+ nouveaux tests PASS sur `weight`.

---

### Task W1.4 — Frontend E1 : WeightInput + form + i18n (sub-agent parallèle B)

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/predefined-tasks/WeightInput.tsx`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/predefined-tasks/WeightInput.test.tsx`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/app/[locale]/admin/predefined-tasks/page.tsx` (intégration dans `TaskFormModal`)
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/messages/fr/predefinedTasks.json`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/messages/en/predefinedTasks.json`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/i18n/request.ts` (ou équivalent de chargement des namespaces)

**Sub-agent :** `[PARALLÈLE B]` — 1 agent Sonnet. Prompt auto-portant :

```
Tu implémentes le composant `WeightInput` (sélecteur 1..5) et son intégration dans le formulaire de tâche prédéfinie d'Orchestr'A, en TDD.

Contexte :
- Repo /home/alex/Documents/REPO/ORCHESTRA, Next.js 16 + React 19 + Tailwind 4 + Radix UI
- Le backend accepte et renvoie déjà le champ `weight: number` (1..5)
- Le formulaire existant est inline dans apps/web/app/[locale]/admin/predefined-tasks/page.tsx (component TaskFormModal)

Cycle TDD :
1. Créer WeightInput.test.tsx avec :
   - test: rend 5 boutons (pastilles) avec libellés "Très légère" "Légère" "Normale" "Lourde" "Très lourde"
   - test: le bouton correspondant à la value prop est actif (aria-pressed=true)
   - test: onChange appelé avec la valeur 1..5 au clic
   - test: disabled désactive les boutons
   - test: accessibilité (role=radiogroup, aria-labelledby)
2. Lancer les tests → FAIL.
3. Implémenter WeightInput.tsx: composant Radix ToggleGroup ou 5 <button> dans un <fieldset role=radiogroup>. Palette: grisé pour inactif, blue-600 pour actif. Libellés i18n via useTranslations("predefinedTasks").
4. Tests → PASS.
5. Créer messages/fr/predefinedTasks.json et messages/en/predefinedTasks.json:
   {
     "weight": {
       "label": "Poids / charge",
       "hint": "Pondération utilisée par l'équilibrage automatique",
       "levels": {
         "1": "Très légère",
         "2": "Légère",
         "3": "Normale",
         "4": "Lourde",
         "5": "Très lourde"
       }
     }
   }
   Équivalent en anglais.
6. Intégrer WeightInput dans TaskFormModal de page.tsx : ajouter le state local `weight`, la soumission dto.weight, le rendu dans le form layout cohérent avec les autres champs.
7. Vérifier le chargement i18n : grep apps/web/src/i18n pour identifier le fichier qui enregistre les namespaces, ajouter "predefinedTasks".
8. pnpm --filter @orchestra/web test WeightInput → PASS.
9. pnpm --filter @orchestra/web run type-check (ou lint) → no error.
10. Commit unique: "feat(predefined-tasks): WeightInput + intégration formulaire + i18n fr/en"

Contraintes :
- Suivre les patterns Tailwind/Radix existants (voir composants sibling dans apps/web/src/components/)
- Pas de nouveau call API (le champ weight est déjà dans le payload POST/PATCH)
- Accessibilité AA : aria-pressed, labels, focus visible
- i18n fr/en synchronisés

Sortie attendue : diffs, sortie tests, sortie type-check, confirmation commit.
```

- [ ] **Step 1 :** Dispatch agent Sonnet avec Monitor.

- [ ] **Step 2 :** Review diff + tests.

- [ ] **Step 3 :** Sanity check :

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm --filter @orchestra/web test WeightInput 2>&1 | tail -15
pnpm --filter @orchestra/web run type-check 2>&1 | tail -5
```

Expected : tests PASS, type-check clean.

---

### Task W1.5 — E1.2 : exposer `weight` dans `DayCell`

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/usePlanningData.ts` (type de retour)
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/DayCell.tsx`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/__tests__/DayCell.test.tsx` (ou créer si absent)

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur (fichier central à plusieurs dépendants, contrôle manuel).

- [ ] **Step 1 :** Grep pour localiser le type des assignments dans `usePlanningData` et `DayCell`.

```bash
grep -n "predefinedAssignments\|PredefinedAssignment\|predefinedTask" /home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/usePlanningData.ts /home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/DayCell.tsx
```

- [ ] **Step 2 :** Étendre le type (si local, ajouter `weight: number`) pour que `assignment.predefinedTask.weight` soit utilisable.

- [ ] **Step 3 :** Dans `DayCell.tsx`, ajouter un rendu visuel discret du poids. Décision : **taille de pastille** pour ne pas surcharger.

```tsx
// Dans le rendu d'une assignment de tâche prédéfinie :
const sizeClass = assignment.predefinedTask.weight >= 4 ? 'h-3 w-3'
                 : assignment.predefinedTask.weight >= 2 ? 'h-2 w-2'
                 : 'h-1.5 w-1.5';

<span
  className={`inline-block rounded-full ${sizeClass}`}
  style={{ backgroundColor: assignment.predefinedTask.color ?? '#64748b' }}
  aria-label={t('weight.ariaLabel', { level: assignment.predefinedTask.weight })}
  title={t(`weight.levels.${assignment.predefinedTask.weight}`)}
/>
```

- [ ] **Step 4 :** Écrire/étendre `DayCell.test.tsx` : tester qu'une assignation de poids 4 rend une pastille h-3, qu'une de poids 1 rend h-1.5.

- [ ] **Step 5 :** Lancer tests.

```bash
pnpm --filter @orchestra/web test DayCell 2>&1 | tail -15
```

Expected : PASS.

- [ ] **Step 6 :** Commit.

```bash
git add apps/web/src/hooks/usePlanningData.ts apps/web/src/components/planning/DayCell.tsx apps/web/src/components/planning/__tests__/DayCell.test.tsx
git commit -m "feat(planning): expose weight dans DayCell via taille de pastille"
```

---

### Task W1.6 — E2E Playwright + build + deploy W1

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/e2e/tests/workflows/predefined-tasks-weight.spec.ts`

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur.

- [ ] **Step 1 :** Écrire le scénario E2E.

```typescript
import { test, expect } from '@playwright/test';

test.describe('E1 — Poids des tâches prédéfinies', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('Un admin crée une tâche avec weight=3 et la voit dans le planning', async ({ page }) => {
    // 1. Créer une tâche prédéfinie via l'admin UI
    await page.goto('/fr/admin/predefined-tasks');
    await page.getByRole('button', { name: /nouvelle tâche/i }).click();
    await page.getByLabel(/nom/i).fill('Tâche test W1');
    await page.getByRole('radiogroup', { name: /poids/i }).getByRole('radio', { name: /normale/i }).click();
    await page.getByRole('button', { name: /enregistrer/i }).click();

    // 2. Vérifier que la tâche apparaît dans la liste avec le poids affiché
    await expect(page.getByText('Tâche test W1')).toBeVisible();
    await expect(page.getByText(/normale/i)).toBeVisible();

    // 3. Vérifier côté API que le weight est bien stocké
    const res = await page.request.get('/api/predefined-tasks');
    const tasks = await res.json();
    const created = tasks.find((t: any) => t.name === 'Tâche test W1');
    expect(created.weight).toBe(3);
  });
});
```

- [ ] **Step 2 :** Lancer localement.

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm run test:e2e --grep "E1" 2>&1 | tail -30
```

Expected : PASS.

- [ ] **Step 3 :** Build complet.

```bash
pnpm run build 2>&1 | tail -10
```

Expected : build ✅ sur les 2 apps + packages.

- [ ] **Step 4 :** Commit E2E + push.

```bash
git add e2e/tests/workflows/predefined-tasks-weight.spec.ts
git commit -m "test(e2e): scénario E1 pondération tâches prédéfinies"
git push origin master
```

- [ ] **Step 5 :** Deploy VPS (vrai SSH, pas le workflow GH).

```bash
ssh debian@92.222.35.25 'cd /opt/orchestra && git pull origin master && docker compose -f docker-compose.prod.yml build api web && docker compose -f docker-compose.prod.yml up -d api web && docker compose -f docker-compose.prod.yml exec -T api pnpm prisma migrate deploy --schema=packages/database/prisma/schema.prisma'
```

**Monitor** la commande (long process). Expected : migration applied, services up.

- [ ] **Step 6 :** Vérification post-deploy de la permission en DB prod.

```bash
ssh debian@92.222.35.25 "docker exec orchestra-postgres psql -U orchestra -d orchestra_prod -c \"SELECT p.code FROM permissions p WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN role_configs rc ON rc.id=rp.\\\"roleConfigId\\\" WHERE rc.code='ADMIN' AND rp.\\\"permissionId\\\"=p.id) AND p.code IN ('predefined_tasks:balance','predefined_tasks:update-own-status','predefined_tasks:update-any-status','planning:activity-view');\""
```

Expected : **0 ligne**. Si ≠ 0, bug de migration de seed → fix ciblé via INSERT + `DEL role-permissions:*` Redis.

- [ ] **Step 7 :** Purge Redis cache (au cas où).

```bash
ssh debian@92.222.35.25 'docker exec orchestra-redis redis-cli --scan --pattern "role-permissions:*" | xargs -I {} docker exec -i orchestra-redis redis-cli DEL {}'
```

- [ ] **Step 8 :** Smoke test prod.

```bash
curl -sf https://orchestr-a.com/api/health | jq .
```

Expected : `{"status":"ok", ...}`.

---

### Wave 1 — Exit criteria

- [ ] Migration Prisma `weight` + `audit_logs` appliquée en prod.
- [ ] Diagnostic RBAC DB : 0 ligne.
- [ ] `pnpm run build` ✅, `pnpm run test` ✅ (API + web).
- [ ] E2E E1 ✅.
- [ ] Deploy VPS réussi, smoke test OK.
- [ ] Aucune régression visible sur le planning existant (spot check manuel).

---

## Wave 2 — Récurrence mensuelle (E2) + Statut d'exécution (E3)

**Objectif :** enrichir les règles récurrentes avec 2 modes mensuels (`MONTHLY_ORDINAL`, `MONTHLY_DAY`), permettre aux agents/responsables de mettre à jour le statut d'exécution d'une assignation, afficher le statut via badge et alerter sur les tâches en retard.

**Entry criteria :** W1 close. Mockup E3.2 validé par PO.

**Exit criteria :**
- Migrations Prisma appliquées sans régression (recurrence + completion fields).
- Endpoint `PATCH /predefined-tasks/assignments/:id/completion` fonctionnel avec RBAC scoped.
- `AssignmentStatusBadge` rendu dans `DayCell` avec popover de transition.
- Génération matérialisée des règles mensuelles correcte (cas limites fév. 29, fin de mois, dernier jeudi).
- Alerte visuelle sur assignations en retard (seuil `AppSettings.lateThresholdDays`).
- E2E Playwright : 1 scénario E2 (règle mensuelle → génération) + 1 scénario E3 (agent marque faite, responsable voit le changement).
- Traçabilité : chaque transition de statut journalisée dans `audit_logs`.
- Build + test + deploy VPS.

### Task W2.1 — Migration Prisma : recurrence fields + completion fields

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/schema.prisma`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/<TIMESTAMP>_add_recurrence_and_completion/migration.sql`

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur (schema.prisma = un seul éditeur).

- [ ] **Step 1 :** Modifier `model PredefinedTaskRecurringRule`.

```prisma
model PredefinedTaskRecurringRule {
  id                String    @id @default(uuid())
  predefinedTaskId  String
  userId            String
  dayOfWeek         Int?      // NULLABLE maintenant (pour MONTHLY_DAY)
  period            String
  weekInterval      Int       @default(1)
  recurrenceType    String    @default("WEEKLY")     // NEW : WEEKLY | MONTHLY_ORDINAL | MONTHLY_DAY
  monthlyOrdinal    Int?                              // NEW : 1..5 (5 = dernière)
  monthlyDayOfMonth Int?                              // NEW : 1..31
  startDate         DateTime
  endDate           DateTime?
  isActive          Boolean   @default(true)
  createdById       String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  // relations inchangées
}
```

- [ ] **Step 2 :** Modifier `model PredefinedTaskAssignment`.

```prisma
model PredefinedTaskAssignment {
  // ... champs existants inchangés
  completionStatus   String    @default("NOT_DONE")
  completedAt        DateTime?
  completedById      String?
  completedBy        User?     @relation("AssignmentCompletedBy", fields: [completedById], references: [id])
  notApplicableReason String?

  @@unique([predefinedTaskId, userId, date, period])
  @@index([date, userId])
  @@index([completionStatus, date])
  @@map("predefined_task_assignments")
}
```

- [ ] **Step 3 :** Ajouter la relation inverse sur `User`.

```prisma
  completedAssignments PredefinedTaskAssignment[] @relation("AssignmentCompletedBy")
```

- [ ] **Step 4 :** Générer la migration.

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm prisma migrate dev --schema=packages/database/prisma/schema.prisma --name add_recurrence_and_completion
```

- [ ] **Step 5 :** Vérifier le SQL (must-have : `dayOfWeek DROP NOT NULL`, ADD COLUMNs pour les 6 nouveaux champs, 2 indexes créés).

```bash
cat packages/database/prisma/migrations/*_add_recurrence_and_completion/migration.sql
```

Expected (extraits) :
```sql
ALTER TABLE "predefined_task_recurring_rules" ALTER COLUMN "dayOfWeek" DROP NOT NULL;
ALTER TABLE "predefined_task_recurring_rules" ADD COLUMN "recurrenceType" TEXT NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE "predefined_task_recurring_rules" ADD COLUMN "monthlyOrdinal" INTEGER;
ALTER TABLE "predefined_task_recurring_rules" ADD COLUMN "monthlyDayOfMonth" INTEGER;
ALTER TABLE "predefined_task_assignments" ADD COLUMN "completionStatus" TEXT NOT NULL DEFAULT 'NOT_DONE';
ALTER TABLE "predefined_task_assignments" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "predefined_task_assignments" ADD COLUMN "completedById" TEXT;
ALTER TABLE "predefined_task_assignments" ADD COLUMN "notApplicableReason" TEXT;
CREATE INDEX "predefined_task_assignments_date_userId_idx" ON "predefined_task_assignments"("date", "userId");
CREATE INDEX "predefined_task_assignments_completionStatus_date_idx" ON "predefined_task_assignments"("completionStatus", "date");
```

- [ ] **Step 6 :** Commit.

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(database): recurrenceType + completionStatus sur predefined_task_*"
```

---

### Task W2.2 — E2 Backend : DTO + validation + génération (sub-agent parallèle A)

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/dto/create-recurring-rule.dto.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/dto/create-bulk-recurring-rules.dto.ts`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/occurrence-generator.ts` (fonction pure, testable seule)
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/occurrence-generator.spec.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.service.ts` (intégration du générateur pour remplacer la logique inline dans `generateFromRules`)
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts`

**Sub-agent :** `[PARALLÈLE A]` — 1 agent Sonnet. Prompt auto-portant :

```
Tu implémentes la récurrence mensuelle (MONTHLY_ORDINAL + MONTHLY_DAY) sur les règles récurrentes d'Orchestr'A, en TDD strict. Tu extrait AUSSI la logique de génération d'occurrences dans un module pur testable.

Contexte:
- Migration Prisma DÉJÀ appliquée, champs disponibles: recurrenceType, monthlyOrdinal, monthlyDayOfMonth, dayOfWeek nullable
- La méthode actuelle predefinedTasksService.generateFromRules() est WEEKLY-only. Tu la refactors pour déléguer à une fonction pure occurrenceGenerator(rule, startDate, endDate) → Date[]

Cycle TDD:

1. Créer occurrence-generator.spec.ts avec ces cas (minimum 12):
   - WEEKLY, lundi, weekInterval=1, plage 2 semaines → 2 dates
   - WEEKLY, mardi, weekInterval=2, plage 4 semaines → 2 dates (W1, W3)
   - MONTHLY_DAY, jour=15, plage févr-avril → 3 dates (15 fév, 15 mars, 15 avril)
   - MONTHLY_DAY, jour=31, plage févr (non bissextile) → clampé au 28 fév
   - MONTHLY_DAY, jour=31, plage avril (30 jours) → clampé au 30 avril
   - MONTHLY_ORDINAL, ordinal=3, dayOfWeek=2 (mardi), plage sur 2 mois → 3e mardi de chaque mois
   - MONTHLY_ORDINAL, ordinal=5 (= dernier), dayOfWeek=4 (jeudi), plage mai 2026 → dernier jeudi = 28 mai
   - MONTHLY_ORDINAL, ordinal=5, dayOfWeek=0 (lundi), plage fév 2026 (28j) → dernier lundi = 23 fév
   - Range-endDate nul + limit à 365 jours depuis startDate
   - Rule isActive=false → [] (filtré en amont mais garde la garde)
   - Start date APRÈS endDate → []
   - WEEKLY dayOfWeek=null → throw new InvalidRuleError
   - MONTHLY_DAY monthlyDayOfMonth=null → throw
   - MONTHLY_ORDINAL monthlyOrdinal=null ou dayOfWeek=null → throw

2. Lancer tests → FAIL.

3. Implémenter occurrence-generator.ts:
   export function generateOccurrences(rule: RuleLike, startDate: Date, endDate: Date): Date[]
   - Utilise date-fns OU Date natif (regarder quelle lib est déjà installée via grep date-fns)
   - Déterministe, fonction pure
   - Export InvalidRuleError

4. Tests → PASS.

5. Étendre CreateRecurringRuleDto avec cross-validation:
   @IsIn(['WEEKLY','MONTHLY_ORDINAL','MONTHLY_DAY'])
   recurrenceType: string = 'WEEKLY';

   @IsOptional() @IsInt() @Min(1) @Max(5)
   monthlyOrdinal?: number;

   @IsOptional() @IsInt() @Min(1) @Max(31)
   monthlyDayOfMonth?: number;

   @IsOptional() @IsInt() @Min(0) @Max(6)
   dayOfWeek?: number;

   // Cross-field validation via custom @ValidatorConstraint
   // - WEEKLY: dayOfWeek required
   // - MONTHLY_DAY: monthlyDayOfMonth required, dayOfWeek forbidden
   // - MONTHLY_ORDINAL: monthlyOrdinal + dayOfWeek required

6. Écrire tests de validation DTO (predefined-tasks.service.spec.ts ou un fichier dto.spec.ts):
   - CreateRecurringRuleDto MONTHLY_DAY sans monthlyDayOfMonth → error
   - MONTHLY_ORDINAL sans monthlyOrdinal → error
   - WEEKLY sans dayOfWeek → error
   - combinaison valide → pass

7. Corriger AUSSI l'oubli weekInterval manquant dans UpdateRecurringRuleDto.updateRecurringRule() — vérifier service.ts et rajouter weekInterval dans les champs modifiables.

8. Refactor generateFromRules() pour appeler generateOccurrences() au lieu de la logique WEEKLY inline actuelle.

9. Tests intégration service: generateFromRules() pour 3 règles (WEEKLY + MONTHLY_DAY + MONTHLY_ORDINAL) → compte d'assignations créées attendu.

10. Commit: "feat(predefined-tasks): récurrence mensuelle (MONTHLY_DAY + MONTHLY_ORDINAL) + generator pur"

Contraintes:
- Fichiers autorisés UNIQUEMENT: dto/create-recurring-rule.dto.ts, dto/create-bulk-recurring-rules.dto.ts, occurrence-generator.ts, occurrence-generator.spec.ts, predefined-tasks.service.ts, predefined-tasks.service.spec.ts
- Pas de changement de route ni de signature d'endpoint
- Conformer le comportement: les jours fériés ne décalent pas les assignations (choix ADR-01)
- model: "sonnet" pour tout re-dispatch
- ≥90% couverture unitaire sur le générateur

Sortie: diffs, sortie tests (détail des cas mensuels), confirmation commit.
```

- [ ] **Step 1 :** Dispatch agent Sonnet A. Monitor.

- [ ] **Step 2 :** Review diff + sortie tests.

---

### Task W2.3 — E2 Frontend : extension `RecurringRulesModal` (sub-agent parallèle B)

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/predefined-tasks/RecurringRulesModal.tsx`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/messages/fr/predefinedTasks.json`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/messages/en/predefinedTasks.json`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/predefined-tasks/__tests__/RecurringRulesModal.test.tsx`

**Sub-agent :** `[PARALLÈLE B]` — 1 agent Sonnet. Prompt auto-portant :

```
Tu étends RecurringRulesModal d'Orchestr'A pour supporter les 2 modes de récurrence mensuelle (MONTHLY_DAY / MONTHLY_ORDINAL) en TDD.

Contexte:
- Backend accepte déjà les 3 modes (WEEKLY, MONTHLY_DAY, MONTHLY_ORDINAL) avec validation cross-field
- Fichier cible: apps/web/src/components/predefined-tasks/RecurringRulesModal.tsx (existant, WEEKLY-only)
- i18n fr/en présent (apps/web/messages/{fr,en}/predefinedTasks.json)

Cycle TDD:

1. Créer __tests__/RecurringRulesModal.test.tsx avec:
   - test: par défaut le mode WEEKLY est sélectionné avec dayOfWeek visible
   - test: bascule sur MONTHLY_DAY affiche un <input type="number" min=1 max=31> et masque dayOfWeek
   - test: bascule sur MONTHLY_ORDINAL affiche un <select monthlyOrdinal: 1..5 avec libellés 1er/2e/3e/4e/dernier> + un dayOfWeek select
   - test: submit en mode MONTHLY_DAY avec monthlyDayOfMonth=15 envoie {recurrenceType:"MONTHLY_DAY", monthlyDayOfMonth:15, dayOfWeek:null} au hook de création
   - test: submit en mode MONTHLY_ORDINAL avec ordinal=3 dayOfWeek=2 envoie {recurrenceType:"MONTHLY_ORDINAL", monthlyOrdinal:3, dayOfWeek:2}
   - test: les libellés i18n des ordinaux et des jours sont récupérés via useTranslations

2. Tests → FAIL.

3. Étendre RecurringRulesModal.tsx:
   - Ajouter un RadioGroup Radix "Type de récurrence" (3 options)
   - Rendre conditionnellement les champs selon le mode
   - Mettre à jour le hook de soumission pour inclure les nouveaux champs
   - Respecter le design system existant (Radix + Tailwind)

4. Étendre predefinedTasks.json fr/en:
   "recurrence": {
     "type": {
       "label": "Type de récurrence",
       "WEEKLY": "Hebdomadaire",
       "MONTHLY_DAY": "Mensuelle à date fixe",
       "MONTHLY_ORDINAL": "Mensuelle ordinale"
     },
     "monthlyDay": {
       "label": "Jour du mois",
       "hint": "Si le jour n'existe pas (ex: 31 février), le dernier jour du mois est utilisé"
     },
     "monthlyOrdinal": {
       "label": "Occurrence dans le mois",
       "options": { "1": "1er", "2": "2e", "3": "3e", "4": "4e", "5": "Dernier" }
     },
     "dayOfWeek": {
       "label": "Jour de la semaine",
       "options": { "0": "Lundi", "1": "Mardi", "2": "Mercredi", "3": "Jeudi", "4": "Vendredi", "5": "Samedi", "6": "Dimanche" }
     }
   }
   + EN équivalents.

5. Tests → PASS.

6. type-check + lint clean.

7. Commit: "feat(predefined-tasks): UI récurrence mensuelle dans RecurringRulesModal"

Contraintes:
- Fichiers autorisés: RecurringRulesModal.tsx, messages/fr/predefinedTasks.json, messages/en/predefinedTasks.json, __tests__/RecurringRulesModal.test.tsx
- Accessibilité AA (labels, aria-describedby pour les hints)
- Pas de nouveau call réseau
- model: "sonnet"

Sortie: diffs, tests, type-check, confirmation commit.
```

- [ ] **Step 1 :** Dispatch B. Monitor.

- [ ] **Step 2 :** Review.

---

### Task W2.4 — E3.1 Backend : endpoint statut + audit (sub-agent parallèle C)

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.controller.ts` (nouvelle route)
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.service.ts` (méthode `updateCompletionStatus`)
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/dto/update-completion-status.dto.ts`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/audit/audit-persistence.service.ts`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/audit/audit-persistence.service.spec.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/audit/audit.module.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.module.ts` (import AuditModule)
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.controller.spec.ts`

**Sub-agent :** `[PARALLÈLE C]` — 1 agent Sonnet. Prompt auto-portant :

```
Tu implémentes l'endpoint PATCH /predefined-tasks/assignments/:id/completion sur Orchestr'A avec RBAC scopé et persistance audit. TDD strict.

Contexte:
- Repo /home/alex/Documents/REPO/ORCHESTRA, NestJS 11 + Prisma 6
- Permissions DB déjà seedées: predefined_tasks:update-own-status, predefined_tasks:update-any-status (scope service)
- Modèle AuditLog disponible (table audit_logs)
- PredefinedTaskAssignment a déjà les champs completionStatus, completedAt, completedById, notApplicableReason

Objectif:
1. PATCH /predefined-tasks/assignments/:id/completion
   body: { status: "NOT_DONE"|"IN_PROGRESS"|"DONE"|"NOT_APPLICABLE", reason?: string }
   - Si l'user est le userId de l'assignment: permission predefined_tasks:update-own-status suffit
   - Sinon: permission predefined_tasks:update-any-status requise ET le userId cible doit être dans les services managés par currentUser (via getManagedUserIds() — cherche son implémentation dans apps/api/src/rbac/ ou helpers/)
   - Transitions valides:
     * NOT_DONE → IN_PROGRESS
     * NOT_DONE → DONE
     * IN_PROGRESS → DONE
     * any → NOT_APPLICABLE (reason required et non vide, IsString @MinLength(3))
     * any → NOT_DONE (reset, autorisé pour la même personne)
   - Toute autre transition: 409 Conflict avec message explicite
2. Chaque transition réussie insère une ligne dans audit_logs via AuditPersistenceService.log({action:"ASSIGNMENT_STATUS_CHANGED", entityType:"PredefinedTaskAssignment", entityId: id, actorId: currentUser.id, payload: { before: oldStatus, after: newStatus, reason? }})

Cycle TDD:

1. audit-persistence.service.spec.ts (tester avec prisma mock):
   - log({action, entityType, entityId, actorId, payload}) insert en DB
   - payload peut être null
   - actorId peut être null (system-triggered)

2. Tests → FAIL, implémenter AuditPersistenceService minimal:
   @Injectable()
   export class AuditPersistenceService {
     constructor(private prisma: PrismaService) {}
     async log(event: { action: string; entityType: string; entityId: string; actorId?: string|null; payload?: object|null }): Promise<void> {
       await this.prisma.auditLog.create({ data: { ... } });
     }
   }
   Ajouter dans audit.module.ts l'export du service.

3. update-completion-status.dto.ts:
   export class UpdateCompletionStatusDto {
     @IsIn(["NOT_DONE","IN_PROGRESS","DONE","NOT_APPLICABLE"]) status: string;
     @ValidateIf(o => o.status === "NOT_APPLICABLE") @IsString() @MinLength(3) reason?: string;
   }

4. predefined-tasks.service.spec.ts: tester updateCompletionStatus()
   - propriétaire marque NOT_DONE→DONE: ok, completedById=actorUser.id, completedAt ≈ now
   - non-propriétaire sans permission: throws ForbiddenException
   - non-propriétaire avec update-any-status mais user pas dans son service: throws ForbiddenException
   - transition invalide (DONE→IN_PROGRESS sans passer par NOT_DONE): throws ConflictException
   - NOT_APPLICABLE sans reason (géré par DTO mais ajouter sanity si service reçoit null): 400
   - audit log inséré à chaque transition réussie (spy sur AuditPersistenceService.log)

5. Implémenter updateCompletionStatus(assignmentId, dto, currentUser):
   - Fetch assignment avec userId
   - Évaluer la permission:
     const isOwn = assignment.userId === currentUser.id;
     const hasOwnPerm = currentUser.permissions.includes('predefined_tasks:update-own-status');
     const hasAnyPerm = currentUser.permissions.includes('predefined_tasks:update-any-status');
     if (isOwn && !hasOwnPerm) throw ForbiddenException;
     if (!isOwn) {
       if (!hasAnyPerm) throw ForbiddenException;
       const managedIds = await this.getManagedUserIds(currentUser); // via RbacHelper ou service
       if (!managedIds.includes(assignment.userId)) throw ForbiddenException;
     }
   - Valider transition via fonction pure isValidTransition(before, after)
   - prisma.$transaction:
     update assignment { completionStatus, completedAt: now|null, completedById: currentUser.id|null, notApplicableReason }
     auditService.log(...)
   - retourner l'assignment mis à jour

6. predefined-tasks.controller.spec.ts: test e2e-style avec Nest testing module:
   - PATCH /assignments/:id/completion appelle le service avec currentUser et retourne 200
   - Guard RBAC vérifié (au moins 1 test 403)

7. Ajouter la route dans predefined-tasks.controller.ts:
   @Patch('assignments/:id/completion')
   @RequirePermissions('predefined_tasks:update-own-status') // permission minimale, scope check dans le service
   async updateCompletion(@Param('id') id: string, @Body() dto: UpdateCompletionStatusDto, @CurrentUser() user: AuthenticatedUser)

   Note: on utilise la permission la plus restrictive comme prérequis (update-own-status). Les users ayant update-any-status l'ont aussi par construction du catalog. Le service distingue.

8. Lancer tous les specs du module → PASS.

9. Commit: "feat(predefined-tasks): endpoint PATCH /completion + audit persistence"

Contraintes:
- Fichiers autorisés: ceux listés dans le plan (voir "Files:" de la task W2.4)
- Ne PAS re-hardcoder de check role (feedback_no_hardcode_hotfix)
- Tout passage par permission via roleManagementService.getPermissionsForRole ou l'équivalent déjà utilisé par les guards
- model: "sonnet"

Sortie: diffs, sortie tests (détail des cas), confirmation commit.
```

- [ ] **Step 1 :** Dispatch C. Monitor.

- [ ] **Step 2 :** Review diff + tests.

---

### Task W2.5 — E3.2 Frontend : `AssignmentStatusBadge` + hook + intégration `DayCell`

**Gate bloquant :** mockup E3.2 validé par PO (W0.5).

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/predefined-tasks/AssignmentStatusBadge.tsx`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/predefined-tasks/__tests__/AssignmentStatusBadge.test.tsx`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/useUpdateAssignmentStatus.ts`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/__tests__/useUpdateAssignmentStatus.test.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/DayCell.tsx`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/messages/fr/predefinedTasks.json`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/messages/en/predefinedTasks.json`

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur pilote 1 agent Sonnet qui fait tout (badge + hook + intégration) pour conserver la cohérence visuelle et éviter les collisions sur `DayCell`.

- [ ] **Step 1 :** Fournir au sub-agent la variante choisie du mockup E3.2 (W0.5).

Prompt sub-agent :

```
Tu implémentes le système de badge de statut d'exécution pour les assignations de tâches prédéfinies d'Orchestr'A, en te basant sur la variante validée PO du mockup E3.2 (fichier joint dans les ressources: docs/superpowers/mockups/2026-04-24-planning-activites/E3.2-status-popover.html, variante "<indique la variante choisie>").

Périmètre:
1. Composant pur AssignmentStatusBadge:
   props: { status: "NOT_DONE"|"IN_PROGRESS"|"DONE"|"NOT_APPLICABLE", isLate?: boolean, canUpdate: boolean, onTransition?: (to: string, reason?: string) => void, size?: "sm"|"md" }
   - rend une icône Lucide (Check | Clock | Circle | Minus | AlertTriangle si isLate)
   - si canUpdate=true et onTransition défini: wrap dans Radix Popover qui propose les transitions valides, avec input "reason" si transition vers NOT_APPLICABLE
   - aria-label dynamique selon le statut (i18n)

2. Hook useUpdateAssignmentStatus:
   const { mutate, isPending, error } = useUpdateAssignmentStatus();
   mutate({ assignmentId, status, reason? })
   - Appel axios PATCH /predefined-tasks/assignments/:id/completion
   - En success: invalidate planning-overview query (TanStack Query)
   - En error: retourne le message pour affichage

3. Intégration DayCell:
   - Pour chaque assignment de tâche prédéfinie, rendu du Badge à côté du label
   - Le flag canUpdate est fourni par l'API via un nouveau champ computed (voir note ci-dessous)

TDD:
1. AssignmentStatusBadge.test.tsx:
   - rend l'icône correspondante pour chaque statut (4 cas + isLate=true)
   - si canUpdate=false: pas de Popover interactif, pas de onTransition possible
   - si canUpdate=true: click ouvre Popover, click sur DONE appelle onTransition("DONE")
   - transition vers NOT_APPLICABLE exige input reason avant validation

2. useUpdateAssignmentStatus.test.ts:
   - mock axios, success → invalidate + toast succès
   - 403 → message "Permission refusée"
   - 409 → message "Transition invalide"

3. DayCell.test.tsx: extension → badge rendu pour chaque assignment de predefinedTask, canUpdate=true appelle bien le hook.

4. i18n étendu:
   "status": {
     "NOT_DONE": "À faire",
     "IN_PROGRESS": "En cours",
     "DONE": "Fait",
     "NOT_APPLICABLE": "Non applicable",
     "LATE": "En retard",
     "transitionTo": "Passer à : {status}",
     "reason": { "label": "Motif", "placeholder": "Expliquer pourquoi cette tâche n'est pas applicable" },
     "confirm": "Valider"
   }

IMPORTANT — champ computed canUpdate:
- L'API doit renvoyer assignment.canUpdateStatus (boolean) pour chaque assignment dans /planning/overview
- Tu dois donc OUVRIR ce scope: modifier apps/api/src/planning/planning.service.ts pour enrichir les predefinedAssignments retournés avec canUpdateStatus (true si isOwn && hasUpdateOwnPermission, ou hasUpdateAnyPermission && userInScope)
- Spec test côté API: vérifier que l'overview renvoie canUpdateStatus correctement pour un user donné

Fichiers autorisés: tous ceux listés dans "Files:" du plan W2.5 + apps/api/src/planning/planning.service.ts + apps/api/src/planning/planning.service.spec.ts

model: "sonnet" pour tout re-dispatch.

Sortie: diffs, tests, type-check, confirmation commit "feat(planning): AssignmentStatusBadge + popover + intégration DayCell".
```

- [ ] **Step 2 :** Dispatch + Monitor.

- [ ] **Step 3 :** Review diff global — attention particulière à la cohérence visuelle avec le mockup validé et à l'absence de régression sur `DayCell`.

---

### Task W2.6 — E3.3 Alerte retard : `AppSettings.lateThresholdDays` + logique front

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/<TIMESTAMP>_seed_late_threshold/migration.sql`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/app-settings/app-settings.service.ts` (ou équivalent) : getter typé
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/planning/planning.service.ts` : inclure la valeur dans `/planning/overview`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/DayCell.tsx` : calcul `isLate`

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur, léger.

- [ ] **Step 1 :** Grep `AppSettings` pour trouver le service.

```bash
grep -rln "app_settings\|AppSettings" /home/alex/Documents/REPO/ORCHESTRA/apps/api/src
```

- [ ] **Step 2 :** Créer une migration SQL pour seeder la clé par défaut.

```sql
-- packages/database/prisma/migrations/<TIMESTAMP>_seed_late_threshold/migration.sql
INSERT INTO app_settings (id, key, value, category, description, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'planning.lateThresholdDays',
  '1',
  'planning',
  'Seuil (jours ouvrés) après lequel une assignation NOT_DONE est signalée en retard',
  NOW(), NOW()
)
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 3 :** Étendre `planning.service.ts` pour inclure un champ `settings.lateThresholdDays: number` dans l'overview.

```typescript
// Dans planning.service.ts, dans getOverview():
const lateThresholdRaw = await this.appSettings.get('planning.lateThresholdDays', '1');
const lateThresholdDays = Math.max(0, parseInt(lateThresholdRaw, 10) || 1);

return {
  ...,
  settings: { lateThresholdDays },
};
```

- [ ] **Step 4 :** Côté front, dans `DayCell.tsx`, calculer `isLate`.

```tsx
function isAssignmentLate(assignment: PredefinedAssignment, now: Date, thresholdDays: number) {
  if (assignment.completionStatus !== 'NOT_DONE') return false;
  const assignmentDate = new Date(assignment.date);
  const diffDays = differenceInBusinessDays(now, assignmentDate);
  return diffDays > thresholdDays;
}
```

Passer `isLate` au `AssignmentStatusBadge` → rendu en couleur alerte.

- [ ] **Step 5 :** Tests unitaires :
  - côté API : `getOverview()` renvoie bien `settings.lateThresholdDays`.
  - côté front : `isAssignmentLate(assignment, now, 1)` pour une assignment J-2 NOT_DONE → true ; J-0 DONE → false.

- [ ] **Step 6 :** Commit.

```bash
git add packages/database/prisma/migrations/*_seed_late_threshold/ apps/api/src/planning/ apps/api/src/app-settings/ apps/web/src/components/planning/DayCell.tsx apps/web/src/components/planning/__tests__/
git commit -m "feat(planning): alerte retard sur assignations NOT_DONE via AppSettings"
```

---

### Task W2.7 — E2E W2 + build + deploy

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/e2e/tests/workflows/recurring-rules-monthly.spec.ts`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/e2e/tests/workflows/assignment-status.spec.ts`

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur.

- [ ] **Step 1 :** Écrire E2E `recurring-rules-monthly.spec.ts`.

```typescript
import { test, expect } from '@playwright/test';

test.describe('E2 — Récurrence mensuelle', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('Créer une règle MONTHLY_DAY et générer les occurrences', async ({ page }) => {
    await page.goto('/fr/planning');
    await page.getByRole('button', { name: /règles récurrentes/i }).click();
    await page.getByRole('button', { name: /nouvelle règle/i }).click();

    await page.getByLabel(/type de récurrence/i).click();
    await page.getByRole('option', { name: /mensuelle à date fixe/i }).click();
    await page.getByLabel(/jour du mois/i).fill('15');
    await page.getByLabel(/agent/i).click();
    await page.getByRole('option').first().click();
    await page.getByLabel(/tâche/i).click();
    await page.getByRole('option').first().click();
    await page.getByLabel(/date de début/i).fill('2026-05-01');
    await page.getByLabel(/date de fin/i).fill('2026-07-31');
    await page.getByRole('button', { name: /enregistrer/i }).click();

    await page.getByRole('button', { name: /générer/i }).click();
    await expect(page.getByText(/3 assignations créées/i)).toBeVisible();
  });
});
```

- [ ] **Step 2 :** Écrire E2E `assignment-status.spec.ts`.

```typescript
import { test, expect } from '@playwright/test';
import { asRole } from '../fixtures/asRole';

test.describe('E3 — Statut d\'exécution', () => {
  test('Un agent marque sa tâche comme faite et le responsable voit le changement', async ({ browser }) => {
    // Setup: créer une assignation pour le contributeur
    const admin = await asRole(browser, 'ADMIN');
    const assignment = await admin.request.post('/api/predefined-tasks/assignments', {
      data: { predefinedTaskId: '...', userId: '<contributeur-id>', date: '2026-04-24', period: 'MORNING' }
    });
    const { id } = await assignment.json();

    // Étape 1 — Contributeur: cliquer sur l'assignment et marquer DONE
    const contrib = await asRole(browser, 'CONTRIBUTEUR');
    await contrib.page.goto('/fr/planning');
    await contrib.page.getByTestId(`assignment-${id}`).click();
    await contrib.page.getByRole('button', { name: /faite/i }).click();
    await expect(contrib.page.getByTestId(`assignment-${id}-badge`)).toHaveAttribute('data-status', 'DONE');

    // Étape 2 — Responsable voit le statut DONE
    const resp = await asRole(browser, 'RESPONSABLE');
    await resp.page.goto('/fr/planning');
    await expect(resp.page.getByTestId(`assignment-${id}-badge`)).toHaveAttribute('data-status', 'DONE');
  });
});
```

- [ ] **Step 3 :** Lancer E2E + build.

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm run test:e2e --grep "E2 —|E3 —" 2>&1 | tail -30
pnpm run build 2>&1 | tail -10
```

Expected : PASS.

- [ ] **Step 4 :** Commit + push + deploy.

```bash
git add e2e/tests/workflows/
git commit -m "test(e2e): scénarios E2 (récurrence mensuelle) + E3 (statut + sync rôles)"
git push origin master
ssh debian@92.222.35.25 'cd /opt/orchestra && git pull origin master && docker compose -f docker-compose.prod.yml build api web && docker compose -f docker-compose.prod.yml up -d api web && docker compose -f docker-compose.prod.yml exec -T api pnpm prisma migrate deploy --schema=packages/database/prisma/schema.prisma'
```

**Monitor** la commande.

- [ ] **Step 5 :** Smoke test.

```bash
curl -sf https://orchestr-a.com/api/health | jq .
curl -sf https://orchestr-a.com/api/planning/overview?startDate=2026-04-20\&endDate=2026-04-27 -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.settings.lateThresholdDays'
```

Expected : `"ok"` et `1`.

---

### Wave 2 — Exit criteria

- [ ] Migrations appliquées en prod (recurrence + completion + lateThreshold).
- [ ] `predefined-tasks.service.spec` + `occurrence-generator.spec` ≥ 90% couverture sur les cas mensuels.
- [ ] E2E E2 + E3 ✅.
- [ ] Deploy prod OK, smoke tests OK.
- [ ] Aucune régression planning mode `week` / `month`.
- [ ] AuditLog contient bien une ligne par transition de statut (spot check via SELECT SQL sur prod).

---

## Wave 3 — Algorithme d'équilibrage (E4)

**Objectif :** livrer le service `PlanningBalancerService`, l'endpoint `POST /predefined-tasks/recurring-rules/generate-balanced` (modes `preview` + `apply`), la modale `BalancedPlanningModal` et son hook.

**Entry criteria :** W2 close. Mockup E4.3 validé par PO. ADR-03 mergé.

**Exit criteria :**
- Service `PlanningBalancerService` : ≥95% couverture sur 7 jeux de tests déterministes (ADR-03).
- Endpoint `generate-balanced` idempotent, transactionnel (rollback en cas d'échec partiel).
- Modale `BalancedPlanningModal` : preview → apply sans régression.
- Audit log `BALANCER_APPLIED` à chaque apply.
- E2E : prévisualiser puis appliquer sur 3 tâches × 4 agents.
- Build + test + deploy.

### Task W3.1 — Service `PlanningBalancerService` (logique pure, orchestrateur)

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/planning-balancer.service.ts`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/planning-balancer.service.spec.ts`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/planning-balancer.types.ts`

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur. Même s'il y a beaucoup de tests, le service doit rester cohérent avec l'ADR-03, délégation inutile.

- [ ] **Step 1 :** Créer `planning-balancer.types.ts` avec les types de l'ADR-03.

```typescript
// apps/api/src/predefined-tasks/planning-balancer.types.ts

export type BalancerPeriod = 'MORNING' | 'AFTERNOON' | 'FULL_DAY';

export interface BalancerOccurrence {
  taskId: string;
  weight: number;
  date: Date;
  period: BalancerPeriod;
}

export interface BalancerAgent {
  userId: string;
  skills?: string[];
}

export interface BalancerAbsence {
  startDate: Date;
  endDate: Date;
}

export interface BalancerInput {
  occurrences: BalancerOccurrence[];
  agents: BalancerAgent[];
  absences: Map<string, BalancerAbsence[]>;
  taskRequiredSkills?: Map<string, string[]>;
}

export interface BalancerProposedAssignment {
  taskId: string;
  userId: string;
  date: Date;
  period: BalancerPeriod;
  weight: number;
}

export interface BalancerUnassigned {
  taskId: string;
  date: Date;
  period: BalancerPeriod;
  reason: 'NO_ELIGIBLE_AGENT';
}

export interface BalancerOutput {
  proposedAssignments: BalancerProposedAssignment[];
  workloadByAgent: Array<{ userId: string; weightedLoad: number }>;
  equityRatio: number;
  unassignedOccurrences: BalancerUnassigned[];
}
```

- [ ] **Step 2 :** Écrire les 7 jeux de tests (ADR-03) dans `planning-balancer.service.spec.ts`.

```typescript
import { PlanningBalancerService } from './planning-balancer.service';
import { BalancerInput } from './planning-balancer.types';

describe('PlanningBalancerService', () => {
  let service: PlanningBalancerService;

  beforeEach(() => { service = new PlanningBalancerService(); });

  const buildInput = (partial: Partial<BalancerInput>): BalancerInput => ({
    occurrences: [],
    agents: [],
    absences: new Map(),
    ...partial,
  });

  it('cas 1 — trivial : 1 agent, 1 occurrence', () => {
    const out = service.balance(buildInput({
      agents: [{ userId: 'u1' }],
      occurrences: [{ taskId: 't1', weight: 1, date: new Date('2026-05-01'), period: 'MORNING' }],
    }));
    expect(out.proposedAssignments).toHaveLength(1);
    expect(out.proposedAssignments[0].userId).toBe('u1');
    expect(out.equityRatio).toBe(1);
  });

  it('cas 2 — répartition parfaite : 2 agents, 4 occurrences poids=1', () => {
    const out = service.balance(buildInput({
      agents: [{ userId: 'u1' }, { userId: 'u2' }],
      occurrences: Array.from({ length: 4 }, (_, i) => ({
        taskId: 't1', weight: 1, date: new Date(`2026-05-0${i + 1}`), period: 'MORNING',
      })),
    }));
    const byAgent = new Map<string, number>();
    out.proposedAssignments.forEach(a => byAgent.set(a.userId, (byAgent.get(a.userId) ?? 0) + 1));
    expect(byAgent.get('u1')).toBe(2);
    expect(byAgent.get('u2')).toBe(2);
    expect(out.equityRatio).toBe(1);
  });

  it('cas 3 — poids asymétriques : 3 agents, poids [5,5,1,1,1,1]', () => {
    const out = service.balance(buildInput({
      agents: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }],
      occurrences: [5, 5, 1, 1, 1, 1].map((w, i) => ({
        taskId: 't1', weight: w, date: new Date(`2026-05-0${i + 1}`), period: 'MORNING',
      })),
    }));
    const usersOfWeight5 = out.proposedAssignments.filter(a => a.weight === 5).map(a => a.userId);
    expect(new Set(usersOfWeight5).size).toBe(2); // les deux lourdes chez 2 agents différents
  });

  it('cas 4 — absence bloquante', () => {
    const out = service.balance(buildInput({
      agents: [{ userId: 'u1' }, { userId: 'u2' }],
      occurrences: [
        { taskId: 't', weight: 1, date: new Date('2026-05-01'), period: 'MORNING' },
        { taskId: 't', weight: 1, date: new Date('2026-05-02'), period: 'MORNING' },
      ],
      absences: new Map([['u1', [{ startDate: new Date('2026-05-01'), endDate: new Date('2026-05-01') }]]]),
    }));
    const assign01 = out.proposedAssignments.find(a => a.date.toISOString().startsWith('2026-05-01'));
    const assign02 = out.proposedAssignments.find(a => a.date.toISOString().startsWith('2026-05-02'));
    expect(assign01!.userId).toBe('u2');
    expect(assign02!.userId).toBe('u1'); // u2 a pris la 1ère, u1 a charge=0 sur la 2e
  });

  it('cas 5 — compétence requise', () => {
    const out = service.balance(buildInput({
      agents: [
        { userId: 'a', skills: [] },
        { userId: 'b', skills: ['X'] },
        { userId: 'c', skills: [] },
      ],
      occurrences: [{ taskId: 't1', weight: 3, date: new Date('2026-05-01'), period: 'MORNING' }],
      taskRequiredSkills: new Map([['t1', ['X']]]),
    }));
    expect(out.proposedAssignments[0].userId).toBe('b');
  });

  it('cas 6 — aucun éligible', () => {
    const out = service.balance(buildInput({
      agents: [{ userId: 'u1' }],
      occurrences: [{ taskId: 't', weight: 1, date: new Date('2026-05-01'), period: 'MORNING' }],
      absences: new Map([['u1', [{ startDate: new Date('2026-04-30'), endDate: new Date('2026-05-02') }]]]),
    }));
    expect(out.proposedAssignments).toHaveLength(0);
    expect(out.unassignedOccurrences).toHaveLength(1);
    expect(out.unassignedOccurrences[0].reason).toBe('NO_ELIGIBLE_AGENT');
  });

  it('cas 7 — départage stable par userId (lexicographique)', () => {
    const out = service.balance(buildInput({
      agents: [{ userId: 'user-b' }, { userId: 'user-a' }],
      occurrences: [{ taskId: 't', weight: 1, date: new Date('2026-05-01'), period: 'MORNING' }],
    }));
    expect(out.proposedAssignments[0].userId).toBe('user-a');
  });

  it('bench — 20 agents × 30 tâches × 30 jours < 3s', () => {
    const agents = Array.from({ length: 20 }, (_, i) => ({ userId: `u${i}` }));
    const occurrences: BalancerOccurrence[] = [];
    for (let d = 0; d < 30; d++) {
      for (let t = 0; t < 30; t++) {
        occurrences.push({
          taskId: `t${t}`,
          weight: (t % 5) + 1,
          date: new Date(2026, 4, 1 + d),
          period: 'MORNING',
        });
      }
    }
    const t0 = Date.now();
    const out = service.balance(buildInput({ agents, occurrences }));
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(3000);
    expect(out.proposedAssignments).toHaveLength(900);
  });
});
```

- [ ] **Step 3 :** Lancer les tests → FAIL (service vide).

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm --filter @orchestra/api test planning-balancer.service.spec 2>&1 | tail -25
```

- [ ] **Step 4 :** Implémenter `planning-balancer.service.ts` selon l'ADR-03.

```typescript
import { Injectable } from '@nestjs/common';
import {
  BalancerInput,
  BalancerOutput,
  BalancerOccurrence,
  BalancerAgent,
} from './planning-balancer.types';

@Injectable()
export class PlanningBalancerService {
  balance(input: BalancerInput): BalancerOutput {
    const workload = new Map<string, number>();
    for (const a of input.agents) workload.set(a.userId, 0);

    const occurrences = [...input.occurrences].sort((a, b) => {
      const dateCmp = a.date.getTime() - b.date.getTime();
      if (dateCmp !== 0) return dateCmp;
      const periodCmp = a.period.localeCompare(b.period);
      if (periodCmp !== 0) return periodCmp;
      return a.taskId.localeCompare(b.taskId);
    });

    const proposedAssignments: BalancerOutput['proposedAssignments'] = [];
    const unassignedOccurrences: BalancerOutput['unassignedOccurrences'] = [];

    for (const occ of occurrences) {
      const requiredSkills = input.taskRequiredSkills?.get(occ.taskId) ?? [];
      const eligibles = input.agents.filter(agent => {
        if (this.isAbsentOn(input.absences.get(agent.userId) ?? [], occ.date)) return false;
        if (requiredSkills.length === 0) return true;
        return requiredSkills.every(sk => (agent.skills ?? []).includes(sk));
      });

      if (eligibles.length === 0) {
        unassignedOccurrences.push({
          taskId: occ.taskId,
          date: occ.date,
          period: occ.period,
          reason: 'NO_ELIGIBLE_AGENT',
        });
        continue;
      }

      eligibles.sort((a, b) => {
        const wa = workload.get(a.userId) ?? 0;
        const wb = workload.get(b.userId) ?? 0;
        if (wa !== wb) return wa - wb;
        return a.userId.localeCompare(b.userId);
      });

      const chosen = eligibles[0];
      proposedAssignments.push({
        taskId: occ.taskId,
        userId: chosen.userId,
        date: occ.date,
        period: occ.period,
        weight: occ.weight,
      });
      workload.set(chosen.userId, (workload.get(chosen.userId) ?? 0) + occ.weight);
    }

    const workloadByAgent = Array.from(workload.entries())
      .map(([userId, weightedLoad]) => ({ userId, weightedLoad }))
      .sort((a, b) => a.userId.localeCompare(b.userId));

    const loads = workloadByAgent.map(a => a.weightedLoad);
    const mean = loads.reduce((acc, v) => acc + v, 0) / (loads.length || 1);
    const variance = loads.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (loads.length || 1);
    const stddev = Math.sqrt(variance);
    const equityRatio = mean > 0 ? Math.max(0, Math.min(1, 1 - stddev / mean)) : 1;

    return { proposedAssignments, workloadByAgent, equityRatio, unassignedOccurrences };
  }

  private isAbsentOn(absences: Array<{ startDate: Date; endDate: Date }>, date: Date): boolean {
    const t = date.getTime();
    return absences.some(a => a.startDate.getTime() <= t && t <= a.endDate.getTime());
  }
}
```

- [ ] **Step 5 :** Tests → PASS.

```bash
pnpm --filter @orchestra/api test planning-balancer.service.spec 2>&1 | tail -15
```

- [ ] **Step 6 :** Commit.

```bash
git add apps/api/src/predefined-tasks/planning-balancer.service.ts apps/api/src/predefined-tasks/planning-balancer.service.spec.ts apps/api/src/predefined-tasks/planning-balancer.types.ts
git commit -m "feat(predefined-tasks): PlanningBalancerService glouton + 7 jeux de tests"
```

---

### Task W3.2 — Endpoint `POST /recurring-rules/generate-balanced` (sub-agent A)

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.controller.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.service.ts`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/dto/generate-balanced.dto.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.module.ts`

**Sub-agent :** `[PARALLÈLE A]` — Sonnet. Prompt :

```
Tu implémentes l'endpoint POST /predefined-tasks/recurring-rules/generate-balanced sur Orchestr'A, en TDD.

Contexte:
- Service PlanningBalancerService DÉJÀ implémenté (injectable, méthode balance())
- Tu dois orchestrer: fetch des occurrences à balancer, fetch des absences/skills, appel balancer, persistance transactionnelle, audit log

Contraintes endpoint:
- Verbe: POST, route: /predefined-tasks/recurring-rules/generate-balanced
- Guard: @RequirePermissions('predefined_tasks:balance')
- Body (DTO GenerateBalancedDto):
  { startDate: ISOString, endDate: ISOString, serviceId?: string, userIds?: string[], taskIds: string[], mode: 'preview'|'apply' }
  - serviceId OU userIds: au moins un requis (mutuellement compatible: si serviceId donné, inclut tous les user actifs de ce service + filtre avec userIds si présent)
  - taskIds: min 1, liste des PredefinedTask à équilibrer
  - mode 'preview': renvoie le BalancerOutput sans persistance
  - mode 'apply': transactionnellement crée les PredefinedTaskAssignment via skipDuplicates=true (idempotence), puis audit log

Cycle TDD:

1. predefined-tasks.service.spec.ts: tester generateBalanced()
   - mode preview → pas de create, renvoie le BalancerOutput
   - mode apply → createMany appelé dans transaction, audit log créé, renvoie output + assignmentsCreated count
   - si le balancer renvoie unassignedOccurrences en mode apply → créer quand même les assigned, mais retourner les unassigned dans la réponse (le PO tranche côté UI: confirmer ou pas)
   - si transaction échoue → rollback complet, throw
   - permissions insuffisantes → ForbiddenException (géré par guard mais sanity check côté service)
   - scope: si user RESPONSABLE → forcer serviceId in managedServices[], sinon throw
   - idempotence: rejoue apply sur la même plage → createMany avec skipDuplicates → 0 nouvelle création, mais audit log quand même (décision: oui, on trace le replay)

2. Tests → FAIL.

3. Implémenter generateBalanced():
   async generateBalanced(dto: GenerateBalancedDto, currentUser: AuthenticatedUser): Promise<GenerateBalancedResult> {
     // 1. Résolution du périmètre user
     const userIds = await this.resolveUserIds(dto, currentUser);
     // 2. Charger tâches à équilibrer + weights
     const tasks = await this.prisma.predefinedTask.findMany({ where: { id: { in: dto.taskIds }, isActive: true } });
     // 3. Matérialiser les occurrences via occurrenceGenerator (W2) sur les règles actives des tâches dans la plage
     //    ou si pas de règles → 1 occurrence par jour ouvré × 1 période par défaut
     //    (Décision V1: on matérialise à partir des RÈGLES existantes uniquement)
     const rules = await this.prisma.predefinedTaskRecurringRule.findMany({
       where: { predefinedTaskId: { in: dto.taskIds }, isActive: true, userId: { in: userIds } }
     });
     const occurrences: BalancerOccurrence[] = [];
     for (const rule of rules) {
       const dates = generateOccurrences(rule, start, end);
       const task = tasks.find(t => t.id === rule.predefinedTaskId)!;
       for (const d of dates) occurrences.push({ taskId: task.id, weight: task.weight, date: d, period: rule.period });
     }
     // 4. Fetch absences (leaves) des userIds sur la plage via LeavesService
     const leaves = await this.leavesService.findAll(1, 1000, undefined, 'APPROVED', undefined, start, end);
     const absences = groupLeavesByUser(leaves);
     // 5. Fetch skills (optionnel)
     const taskRequiredSkills = new Map();
     // 6. balance
     const output = this.balancer.balance({ occurrences, agents: userIds.map(id => ({ userId: id })), absences, taskRequiredSkills });

     if (dto.mode === 'preview') {
       return { ...output, mode: 'preview', assignmentsCreated: 0 };
     }

     // mode apply
     const created = await this.prisma.$transaction(async tx => {
       const result = await tx.predefinedTaskAssignment.createMany({
         data: output.proposedAssignments.map(a => ({
           predefinedTaskId: a.taskId,
           userId: a.userId,
           date: a.date,
           period: a.period,
           assignedById: currentUser.id,
           isRecurring: false,
         })),
         skipDuplicates: true,
       });
       await this.auditPersistence.log({
         action: 'BALANCER_APPLIED',
         entityType: 'PredefinedTaskRange',
         entityId: `${dto.startDate}_${dto.endDate}`,
         actorId: currentUser.id,
         payload: {
           range: { startDate: dto.startDate, endDate: dto.endDate },
           taskIds: dto.taskIds,
           userIds,
           assignmentsProposed: output.proposedAssignments.length,
           assignmentsCreated: result.count,
           equityRatio: output.equityRatio,
         },
       });
       return result.count;
     });

     return { ...output, mode: 'apply', assignmentsCreated: created };
   }

4. Controller:
   @Post('recurring-rules/generate-balanced')
   @RequirePermissions('predefined_tasks:balance')
   async generateBalanced(@Body() dto: GenerateBalancedDto, @CurrentUser() user: AuthenticatedUser) {
     return this.service.generateBalanced(dto, user);
   }

5. Module: ajouter AuditModule + LeavesModule en imports si pas déjà là.

6. Commit: "feat(predefined-tasks): endpoint generate-balanced preview/apply avec audit + idempotence"

Contraintes:
- Fichiers autorisés: ceux listés dans "Files:" de W3.2
- Aucun hardcode de rôle (feedback_no_hardcode_hotfix)
- RBAC scope: respecter la règle project_responsable_scope_perimeter (RESPONSABLE limité à ses services)
- model: "sonnet"

Sortie: diffs, sortie tests, confirmation commit.
```

- [ ] **Step 1 :** Dispatch A + Monitor.

- [ ] **Step 2 :** Review.

---

### Task W3.3 — Frontend : `BalancedPlanningModal` + hook (sub-agent B)

**Gate bloquant :** mockup E4.3 validé par PO (W0.5).

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/predefined-tasks/BalancedPlanningModal.tsx`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/predefined-tasks/__tests__/BalancedPlanningModal.test.tsx`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/usePlanningBalancer.ts`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/__tests__/usePlanningBalancer.test.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/PlanningView.tsx` (ajout bouton d'entrée)
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/messages/fr/predefinedTasks.json`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/messages/en/predefinedTasks.json`

**Sub-agent :** `[PARALLÈLE B]` — Sonnet, basé sur la variante validée du mockup E4.3. Prompt identique à W2.5 dans l'esprit (UI + hook + intégration dans un seul agent pour cohérence visuelle).

Prompt :

```
Tu implémentes BalancedPlanningModal pour Orchestr'A en te basant sur la variante validée PO du mockup E4.3 (docs/superpowers/mockups/2026-04-24-planning-activites/E4.3-balanced-planning-modal.html, variante: "<indiquée par l'orchestrateur>").

Périmètre:
1. Modale (Radix Dialog) avec 2 phases:
   a. Configuration: DatePicker range, Select multiple "agents ou service", Select multiple "tâches", bouton "Prévisualiser"
   b. Aperçu: tableau { agent | charge pondérée | nb assignations } + badge equityRatio + liste détaillée repliable des assignations proposées + liste des non-affectées avec raison + bouton "Appliquer" + bouton "Modifier la configuration"
2. Hook usePlanningBalancer:
   const { preview, apply, isLoading } = usePlanningBalancer();
   - preview({ startDate, endDate, userIds?, serviceId?, taskIds }) → POST /predefined-tasks/recurring-rules/generate-balanced { mode: 'preview' }
   - apply(sameParams) → POST { mode: 'apply' } + invalidate planning-overview query + toast succès avec count
3. Intégration PlanningView:
   - Ajout d'un bouton "Générer un planning équilibré" dans la barre de contrôles
   - Visible uniquement si user a permission `predefined_tasks:balance` (récupérée via hook useCurrentUserPermissions existant)
   - Au clic: ouvre la modale

TDD:
1. BalancedPlanningModal.test.tsx:
   - Phase configuration: champs présents, bouton "Prévisualiser" désactivé si config invalide
   - Submit appelle preview(), transition vers aperçu
   - Aperçu: affiche le tableau avec des données stubées, bouton "Appliquer" actif
   - Apply → appelle apply() puis ferme la modale (ou affiche success screen)
   - Erreur 403/500 → message explicite, préserve la config

2. usePlanningBalancer.test.ts: mock axios
   - preview success renvoie le BalancerOutput
   - apply success invalide la query + toast
   - erreur: capture et return

3. PlanningView.test.tsx: test que le bouton apparaît pour un user avec permission, et pas sinon.

4. i18n fr/en étendu avec un bloc "balancer" (labels, confirmations).

5. type-check + lint clean.

6. Commit: "feat(planning): BalancedPlanningModal + usePlanningBalancer + bouton PlanningView"

Contraintes:
- Fichiers autorisés: ceux listés dans "Files:" de W3.3
- Respecter rigoureusement la variante validée du mockup (layout, densité, palette)
- Accessibilité AA, focus trap dans la Dialog, escape ferme
- pas de hardcode role côté front — utiliser le hook de permissions existant
- model: "sonnet"
```

- [ ] **Step 1 :** Dispatch B + Monitor.

- [ ] **Step 2 :** Review diff global + compare visuellement au mockup (spot check navigateur sur dev local).

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm run dev  # Monitor
# Puis ouvrir http://localhost:3000/fr/planning, se connecter ADMIN, vérifier le bouton et la modale
```

---

### Task W3.4 — E2E W3 + build + deploy

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/e2e/tests/workflows/balanced-planning.spec.ts`

- [ ] **Step 1 :** Écrire E2E.

```typescript
import { test, expect } from '@playwright/test';

test.describe('E4 — Planning équilibré', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('Prévisualiser puis appliquer sur 3 tâches × 4 agents', async ({ page }) => {
    await page.goto('/fr/planning');
    await page.getByRole('button', { name: /générer un planning équilibré/i }).click();

    await page.getByLabel(/date de début/i).fill('2026-05-01');
    await page.getByLabel(/date de fin/i).fill('2026-05-31');
    await page.getByLabel(/agents/i).click();
    for (const n of [1, 2, 3, 4]) await page.getByRole('option').nth(n - 1).click();
    await page.keyboard.press('Escape');
    await page.getByLabel(/tâches à équilibrer/i).click();
    for (const n of [1, 2, 3]) await page.getByRole('option').nth(n - 1).click();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /prévisualiser/i }).click();

    // Aperçu visible
    await expect(page.getByRole('heading', { name: /aperçu/i })).toBeVisible();
    await expect(page.getByText(/ratio d'équité/i)).toBeVisible();

    // Apply
    await page.getByRole('button', { name: /appliquer/i }).click();
    await page.getByRole('button', { name: /confirmer/i }).click();

    await expect(page.getByText(/assignations créées/i)).toBeVisible();

    // Replay idempotence
    await page.getByRole('button', { name: /générer un planning équilibré/i }).click();
    // ... même config
    await page.getByRole('button', { name: /prévisualiser/i }).click();
    await page.getByRole('button', { name: /appliquer/i }).click();
    await page.getByRole('button', { name: /confirmer/i }).click();
    await expect(page.getByText(/0 assignation créée.*déjà existantes/i)).toBeVisible();
  });
});
```

- [ ] **Step 2 :** Lancer E2E + build.

```bash
pnpm run test:e2e --grep "E4 —" 2>&1 | tail -25
pnpm run build 2>&1 | tail -5
```

- [ ] **Step 3 :** Commit + push + deploy.

```bash
git add e2e/tests/workflows/balanced-planning.spec.ts
git commit -m "test(e2e): scénario E4 prévisualiser + apply + idempotence"
git push origin master
ssh debian@92.222.35.25 'cd /opt/orchestra && git pull origin master && docker compose -f docker-compose.prod.yml build api web && docker compose -f docker-compose.prod.yml up -d api web'
```

**Monitor**.

- [ ] **Step 4 :** Smoke test post-deploy.

```bash
curl -sf https://orchestr-a.com/api/health | jq .
# Vérifier que l'endpoint existe (401 attendu sans auth, pas 404)
curl -si https://orchestr-a.com/api/predefined-tasks/recurring-rules/generate-balanced -X POST -H "Content-Type: application/json" -d '{}' | head -3
```

Expected : `401 Unauthorized` (pas 404).

---

### Wave 3 — Exit criteria

- [ ] `PlanningBalancerService` : 7/7 jeux de tests PASS, couverture ≥95%.
- [ ] Endpoint generate-balanced opérationnel en preview et apply.
- [ ] Audit log `BALANCER_APPLIED` inséré à chaque apply (vérif via SELECT SQL prod).
- [ ] Modale `BalancedPlanningModal` conforme au mockup validé.
- [ ] E2E E4 ✅ y compris idempotence.
- [ ] Deploy OK, pas de régression modes week/month.

---

## Wave 4 — Vue Activité (E5)

**Objectif :** livrer le 3e mode de planning (« Vue activité ») avec pivot jours-lignes × tâches-colonnes, gaté par permission `planning:activity-view`.

**Entry criteria :** W3 close. Mockup E5.2 validé par PO.

**Exit criteria :**
- `PlanningView` supporte le mode `activity` via bouton gaté, sans régression sur `week` / `month`.
- `ActivityGrid` opérationnel, filtrage par service + plage, feuille de style print.
- Tests non-régression sur modes `week` + `month`.
- E2E bascule + filtrage + impression.
- Build + deploy.

### Task W4.1 — Extension `usePlanningViewStore` + type `viewMode`

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/stores/planningView.store.ts`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/usePlanningData.ts` (si type ViewMode y est défini)
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/PlanningView.tsx` (consommation du store)
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/stores/__tests__/planningView.store.test.ts` (créer si absent)

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur (store central).

- [ ] **Step 1 :** Lire l'état actuel du store et des consommateurs du `viewMode`.

```bash
grep -rn "viewMode\|'week'\|'month'" /home/alex/Documents/REPO/ORCHESTRA/apps/web/src/stores/planningView.store.ts /home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/ /home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/usePlanningData.ts | head -30
```

- [ ] **Step 2 :** Ajouter `viewMode` au store.

```typescript
// planningView.store.ts
export type ViewMode = 'week' | 'month' | 'activity';

interface PlanningViewState {
  // ... existant
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export const usePlanningViewStore = create<PlanningViewState>((set) => ({
  // ...
  viewMode: 'week',
  setViewMode: (mode) => set({ viewMode: mode }),
}));
```

- [ ] **Step 3 :** Migrer les composants qui gèrent `viewMode` localement vers le store (sans changer leur comportement pour `week`/`month`, mais permettre de lire depuis `useStore`).

- [ ] **Step 4 :** Écrire un test minimal sur le store.

```typescript
import { act, renderHook } from '@testing-library/react';
import { usePlanningViewStore } from '../planningView.store';

describe('planningView.store — viewMode', () => {
  it('default viewMode = week', () => {
    const { result } = renderHook(() => usePlanningViewStore());
    expect(result.current.viewMode).toBe('week');
  });

  it('setViewMode change la valeur', () => {
    const { result } = renderHook(() => usePlanningViewStore());
    act(() => result.current.setViewMode('activity'));
    expect(result.current.viewMode).toBe('activity');
  });
});
```

- [ ] **Step 5 :** Tests PASS + type-check.

```bash
pnpm --filter @orchestra/web test planningView.store 2>&1 | tail -10
pnpm --filter @orchestra/web run type-check 2>&1 | tail -5
```

- [ ] **Step 6 :** Commit.

```bash
git add apps/web/src/stores/planningView.store.ts apps/web/src/components/planning/ apps/web/src/hooks/usePlanningData.ts apps/web/src/stores/__tests__/planningView.store.test.ts
git commit -m "feat(planning): étend planningView.store avec viewMode=activity"
```

---

### Task W4.2 — Bouton « Vue activité » gaté par permission

**Files:**
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/PlanningView.tsx` (barre de contrôles)
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/messages/fr/planning.json`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/messages/en/planning.json`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/__tests__/PlanningView.test.tsx`

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur.

- [ ] **Step 1 :** Identifier le hook de permissions front (grep).

```bash
grep -rn "useCurrentUserPermissions\|hasPermission\|userPermissions" /home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/ /home/alex/Documents/REPO/ORCHESTRA/apps/web/src/stores/ | head -10
```

- [ ] **Step 2 :** Ajouter le 3e bouton dans la barre de contrôles (après Semaine / Mois).

```tsx
{hasPermission('planning:activity-view') && (
  <button
    type="button"
    onClick={() => setViewMode('activity')}
    aria-pressed={viewMode === 'activity'}
    className={cn('px-3 py-1.5 rounded', viewMode === 'activity' ? 'bg-blue-600 text-white' : 'bg-zinc-100')}
  >
    {t('activity')}
  </button>
)}
```

- [ ] **Step 3 :** i18n : ajouter `"activity": "Vue activité"` + `"activity": "Activity view"`.

- [ ] **Step 4 :** Test de gating.

```tsx
it("n'affiche pas le bouton 'Vue activité' sans permission", () => {
  mockPermissions([]);
  render(<PlanningView />);
  expect(screen.queryByRole('button', { name: /vue activité/i })).not.toBeInTheDocument();
});

it("affiche le bouton avec permission", () => {
  mockPermissions(['planning:activity-view']);
  render(<PlanningView />);
  expect(screen.getByRole('button', { name: /vue activité/i })).toBeInTheDocument();
});
```

- [ ] **Step 5 :** Test de non-régression : bascule `week` → `month` fonctionne toujours comme avant.

- [ ] **Step 6 :** Commit.

```bash
git add apps/web/src/components/planning/PlanningView.tsx apps/web/messages/ apps/web/src/components/planning/__tests__/PlanningView.test.tsx
git commit -m "feat(planning): bouton Vue activité gaté par planning:activity-view"
```

---

### Task W4.3 — `ActivityGrid` + feuille de style print (sub-agent Sonnet)

**Gate bloquant :** mockup E5.2 validé par PO.

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/ActivityGrid.tsx`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/__tests__/ActivityGrid.test.tsx`
- Create: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/ActivityGrid.print.css`
- Modify: `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/planning/PlanningView.tsx` (rendu conditionnel selon viewMode)

**Sub-agent :** `[PARALLÈLE]` — 1 agent Sonnet, cohésion visuelle à garantir avec le mockup validé.

Prompt :

```
Tu implémentes le composant ActivityGrid d'Orchestr'A selon la variante validée PO du mockup E5.2 (docs/superpowers/mockups/2026-04-24-planning-activites/E5.2-activity-grid.html, variante: "<indiquée par l'orchestrateur>").

Périmètre:
1. Composant ActivityGrid:
   props: { days: Date[], tasks: PredefinedTask[], assignments: PredefinedAssignment[], users: User[], isSpecialDay: (d: Date) => boolean }
   - Rend un <table> avec:
     - <caption> pour accessibilité
     - <thead>: col 1 = "Jour", cols suivantes = chaque tâche (nom + icône + badge weight si pertinent)
     - <tbody>: 1 ligne par jour
       - Cellule date (sticky-col, formatée, alt-bg si week-end/férié)
       - Pour chaque tâche: user(s) assigné(s) + AssignmentStatusBadge + indicateur weight
     - Sticky header + sticky first col (CSS position: sticky)
   - Filtrage: les tasks.filter(isActive) seulement, les users filtrés selon les assignments réels
   - Bouton "Imprimer" (window.print()) en haut à droite

2. Feuille de style print (ActivityGrid.print.css):
   @media print {
     .activity-grid-no-print { display: none; }
     .activity-grid { font-size: 10pt; }
     .activity-grid thead { display: table-header-group; } // répéter l'entête sur chaque page
     /* suppression nav, footer, sidebar pour l'impression */
     body * { visibility: hidden; }
     .activity-grid, .activity-grid * { visibility: visible; }
     .activity-grid { position: absolute; left: 0; top: 0; width: 100%; }
   }

3. Intégration PlanningView: quand viewMode === 'activity', rendu de <ActivityGrid> à la place de <PlanningGrid>. Partage le même usePlanningData.

TDD:
1. ActivityGrid.test.tsx:
   - rend N jours × M tâches selon props
   - cellule affiche le user assigné + le badge
   - filtre tasks inactifs
   - bouton Imprimer présent avec role=button
   - accessibilité: <table> a un <caption>, cols ont scope=col, ligne jour a scope=row

2. PlanningView.test.tsx extension: en viewMode='activity', ActivityGrid rendu, PlanningGrid caché.

Contraintes:
- Densité cible: 20 jours × 8 tâches tient sans scroll horizontal abusif (sticky cols aident)
- Accessibilité AA
- Respect rigoureux du mockup validé
- Pas de nouveau call API (réutilise usePlanningData)
- model: "sonnet"
- Fichiers autorisés: ceux listés

Commit: "feat(planning): ActivityGrid + print CSS + rendu conditionnel PlanningView"
```

- [ ] **Step 1 :** Dispatch + Monitor.

- [ ] **Step 2 :** Review + sanity check visuel dev local.

```bash
pnpm run dev  # Monitor
# Ouvrir http://localhost:3000/fr/planning, basculer sur Vue activité, tester impression (Ctrl+P)
```

---

### Task W4.4 — E2E W4 + build + deploy

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/e2e/tests/workflows/activity-view.spec.ts`

- [ ] **Step 1 :** Écrire E2E.

```typescript
import { test, expect } from '@playwright/test';

test.describe('E5 — Vue Activité', () => {
  test.describe('Permission gating', () => {
    test.use({ storageState: 'playwright/.auth/observateur.json' });
    test('OBSERVATEUR voit le bouton Vue activité', async ({ page }) => {
      await page.goto('/fr/planning');
      await expect(page.getByRole('button', { name: /vue activité/i })).toBeVisible();
    });
  });

  test.describe('Usage nominal', () => {
    test.use({ storageState: 'playwright/.auth/admin.json' });

    test('Bascule semaine → activité, filtrage, impression', async ({ page }) => {
      await page.goto('/fr/planning');
      await page.getByRole('button', { name: /vue activité/i }).click();

      // Grid présent
      await expect(page.getByRole('table')).toBeVisible();
      await expect(page.getByRole('columnheader').first()).toContainText(/jour/i);

      // Filtrage par service
      await page.getByLabel(/service/i).click();
      await page.getByRole('option').first().click();
      await page.keyboard.press('Escape');

      // Bouton imprimer présent
      await expect(page.getByRole('button', { name: /imprimer/i })).toBeVisible();

      // Retour semaine
      await page.getByRole('button', { name: /^semaine$/i }).click();
      await expect(page.getByRole('table')).not.toBeVisible();
    });
  });
});
```

- [ ] **Step 2 :** Lancer + build + push + deploy.

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm run test:e2e --grep "E5 —" 2>&1 | tail -25
pnpm run build 2>&1 | tail -5
git add e2e/tests/workflows/activity-view.spec.ts
git commit -m "test(e2e): scénario E5 Vue activité (gating + nominal)"
git push origin master
ssh debian@92.222.35.25 'cd /opt/orchestra && git pull origin master && docker compose -f docker-compose.prod.yml build web && docker compose -f docker-compose.prod.yml up -d web'
```

**Monitor** le build + deploy.

- [ ] **Step 3 :** Smoke test.

```bash
curl -sf https://orchestr-a.com/fr/planning -I | head -3
```

Expected : 200 ou 302 (redirect auth).

---

### Wave 4 — Exit criteria

- [ ] `viewMode` activity opérationnel via store.
- [ ] ActivityGrid conforme au mockup validé.
- [ ] Gating permission `planning:activity-view` effectif côté UI (bouton absent si permission absente).
- [ ] Aucune régression sur `week` / `month`.
- [ ] E2E E5 ✅.
- [ ] Deploy OK.

---

## Wave 5 — Recette + Rollout CDG

**Objectif :** tenir la recette fonctionnelle avec Preschez + Beouch, publier la doc utilisateur, provisionner le service CDG et ses 6 agents, monitorer les 2 premières générations mensuelles.

**Entry criteria :** W4 close.

**Exit criteria :**
- Recette PV signé par Preschez.
- Documentation utilisateur publiée.
- Service CDG créé, 6 agents rattachés, permissions effectives.
- 2 générations mensuelles monitorées (temps de réponse, erreurs, volumétrie).
- Plan documenté d'évolutions post-V1 (jours fériés, rotation, ICS export — backlog).

### Task W5.1 — Atelier de recette CDG (humain)

**Files:** (aucun — livrable humain)

- [ ] **Step 1 :** Tenir la session avec Preschez + Beouch + 6 agents sur la prod.
- [ ] **Step 2 :** Parcourir les 3 parcours A, B, C (cf. §6.5 BACKLOG) en live.
- [ ] **Step 3 :** Recueillir anomalies et demandes. Trier en 3 catégories : bugs bloquants (W5 hotfix), bugs mineurs (post-V1), demandes d'évolution (backlog).
- [ ] **Step 4 :** Rédiger un PV de recette court dans `docs/recettes/2026-MM-DD-recette-planning-activites-cdg.md`.

```markdown
# PV de recette — Planning d'activités récurrentes CDG

Date : <YYYY-MM-DD>
Présents : L. Preschez, A. Beouch, <6 agents>, A. Berge

## Parcours testés
- [x] A : Configurer une tâche récurrente
- [x] B : Générer un planning équilibré
- [x] C : Suivre son planning

## Résultat
- Feux : <Vert | Vert avec réserves | Rouge>

## Anomalies
| # | Description | Gravité | Statut |
|---|---|---|---|
| 1 | ... | <bloquant/mineur> | <ouverte/fermée> |

## Signatures
- PO : L. Preschez
- Support : A. Beouch
- Éditeur : A. Berge
```

- [ ] **Step 5 :** Commit du PV.

```bash
git add docs/recettes/2026-MM-DD-recette-planning-activites-cdg.md
git commit -m "docs(recette): PV recette Planning d'activités récurrentes CDG"
```

---

### Task W5.2 — Documentation utilisateur (sub-agent parallèle A)

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/docs/user/planning-activites.md`

**Sub-agent :** `[PARALLÈLE A]` — Sonnet. Prompt :

```
Tu rédiges la documentation utilisateur d'Orchestr'A pour le lot "Planning d'activités récurrentes" destinée aux responsables de service et agents (non-techniques).

Contexte: lot livré en V1 composé de 5 épopées (E1 poids, E2 récurrence mensuelle, E3 statut d'exécution, E4 équilibrage automatique, E5 Vue activité).

Audience: utilisateurs métier (cadre + agent), aucun prérequis technique. Doit être lisible sans autre documentation.

Sommaire attendu:
1. À quoi ça sert (2-3 lignes + capture de la vue planning)
2. Glossaire minimal (tâche prédéfinie, assignation, règle récurrente, poids, vue activité)
3. Tutoriel — Configurer une tâche récurrente (parcours A du BACKLOG)
4. Tutoriel — Générer un planning équilibré (parcours B)
5. Tutoriel — Suivre et déclarer mes tâches (parcours C)
6. Grille de référence des poids (1..5 avec exemples concrets: "poids 1 = tâche <5 min", "poids 5 = réunion 2h + rédaction CR")
7. FAQ (5-7 questions: "et si un agent est absent ?", "puis-je modifier après génération ?", "les jours fériés sont-ils gérés ?", "puis-je exporter ?", etc.)

Contraintes rédactionnelles:
- Wording conforme à feedback_no_custom_role_wording: "rôles institutionnels" jamais "custom"
- Exemples concrets CDG (permanence, saisie mensuelle, reporting)
- Captures d'écran à inclure en placeholder avec alt text explicite (format ![description](./captures/file.png))
- Max 5-6 pages en rendu PDF
- Format Markdown GFM
- Ton direct et actionnable ("Cliquez sur X", pas "Vous pouvez cliquer sur X")

Fichier cible: docs/user/planning-activites.md

Commit: "docs(user): guide Planning d'activités récurrentes V1"

model: "sonnet"
```

- [ ] **Step 1 :** Dispatch + review.

- [ ] **Step 2 :** Ajouter les captures d'écran (manuel, orchestrateur) — capture dev local + insertion dans `docs/user/captures/`.

- [ ] **Step 3 :** Commit captures + push.

---

### Task W5.3 — Provisioning service CDG + 6 agents (sub-agent parallèle B)

**Files:** (aucun fichier Git — opération DB prod via SQL ou UI admin)

**Sub-agent :** `[PARALLÈLE B]` — Sonnet, mais avec **supervision explicite** car opération prod. Prompt :

```
Tu provisionnes dans Orchestr'A le service "Contrôle de Gestion (CDG)" et rattaches 6 agents à ce service, via l'UI admin ou via SQL ciblé sur prod.

Contexte: service CDG n'existe peut-être pas. Les 6 agents ont des comptes user mais ne sont pas rattachés au service CDG.

Étapes:
1. SSH prod pour vérifier l'existant:
   ssh debian@92.222.35.25 "docker exec orchestra-postgres psql -U orchestra -d orchestra_prod -c \"SELECT id, name, code FROM services WHERE name ILIKE '%contrôle de gestion%' OR name ILIKE '%CDG%' OR code ILIKE 'CDG%';\""

2. Si service absent:
   - Pré-valider avec l'utilisateur avant tout INSERT en prod
   - Créer via UI admin de préférence (route /admin/services)
   - Sinon SQL ciblé:
     INSERT INTO services (id, name, code, "departmentId", "managerId", "isActive", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), 'Contrôle de Gestion', 'CDG', '<departmentId>', '<managerId=Preschez>', true, NOW(), NOW());

3. Rattacher 6 agents:
   - Récupérer les 6 user ids (emails fournis par Beouch)
   - Via UI admin ou SQL:
     INSERT INTO user_services ("userId","serviceId") VALUES ('...', '<CDG serviceId>') ON CONFLICT DO NOTHING;
     × 6

4. Vérifier:
   SELECT u.email, s.name FROM users u JOIN user_services us ON us."userId"=u.id JOIN services s ON s.id=us."serviceId" WHERE s.code='CDG';
   Attendu: 6 lignes

5. Tester la connexion des 6 agents (smoke: un d'entre eux peut se logger et voir /planning)

Contraintes:
- AVANT tout INSERT prod: pg_dump de la DB (feedback_verify_before_destructive_prod_changes)
- Confirmer la liste des 6 emails AVANT d'agir
- Préférer l'UI admin à du SQL direct si possible
- Aucun seed complet sur prod (feedback_never_seed_prod)

Sortie: rapport court (service créé ? agents rattachés ? smoke OK ?)
```

- [ ] **Step 1 :** **STOP avant de dispatcher** : demander à A. Beouch la liste des 6 emails + confirmation que le service CDG doit être créé et non réutilisé d'un autre (ex: "Cabinet de la Direction").

- [ ] **Step 2 :** Pg_dump prod avant toute action.

```bash
ssh debian@92.222.35.25 "docker exec orchestra-postgres pg_dump -U orchestra orchestra_prod | gzip" > /home/alex/Documents/REPO/ORCHESTRA/backups-prod/orchestra_prod_$(date +%Y%m%d_%H%M)_pre_cdg.sql.gz
```

- [ ] **Step 3 :** Dispatch B + Monitor.

- [ ] **Step 4 :** Review rapport + sanity check via UI admin prod.

---

### Task W5.4 — Monitoring 2 premières générations mensuelles (orchestrateur)

**Files:**
- Create: `/home/alex/Documents/REPO/ORCHESTRA/docs/reports/2026-MM-DD-generation-cdg-M1.md` (après 1ère génération)
- Create: `/home/alex/Documents/REPO/ORCHESTRA/docs/reports/2026-MM-DD-generation-cdg-M2.md` (après 2e)

**Sub-agent :** `[SÉQUENTIEL]` — orchestrateur.

- [ ] **Step 1 :** Après la 1ère génération réelle par le CDG, requêter :

```bash
ssh debian@92.222.35.25 "docker exec orchestra-postgres psql -U orchestra -d orchestra_prod -c \"SELECT payload->>'range' AS range, payload->>'assignmentsCreated' AS created, payload->>'equityRatio' AS equity, \\\"createdAt\\\" FROM audit_logs WHERE action='BALANCER_APPLIED' ORDER BY \\\"createdAt\\\" DESC LIMIT 5;\""
```

Vérifier :
- `assignmentsCreated` cohérent avec le nombre d'occurrences attendues.
- `equityRatio` > 0.85 (cible < 15% d'écart-type).
- Temps de réponse : corréler avec logs API (`docker logs orchestra-api --since 1h | grep generate-balanced`).

- [ ] **Step 2 :** Consigner dans `docs/reports/YYYY-MM-DD-generation-cdg-M1.md`.

- [ ] **Step 3 :** Répéter après la 2e génération.

- [ ] **Step 4 :** Si écart d'équité > 20% ou plaintes agents : rollback possible (supprimer les assignments générés via endpoint DELETE existant), re-configurer règles, rejouer.

---

### Wave 5 — Exit criteria

- [ ] PV de recette signé (Preschez + Beouch).
- [ ] Doc utilisateur publiée (committée + lien partagé).
- [ ] Service CDG provisionné + 6 agents rattachés + 6 logins fonctionnels.
- [ ] 2 rapports de génération mensuelle rédigés, KPI d'équité OK.
- [ ] Aucun incident bloquant en prod pendant M+1 après ouverture.

---

## Self-review (post-rédaction)

### 1. Couverture spec

| Story | Wave | Tâches |
|---|---|---|
| E1.1 `weight` backend | W1 | W1.1, W1.3 |
| E1.1 `weight` frontend | W1 | W1.4 |
| E1.2 rendu `DayCell` | W1 | W1.5 |
| E2.1 modèle récurrent étendu | W2 | W2.1, W2.2 |
| E2.2 génération mensuelle | W2 | W2.2 (occurrence-generator + service) |
| E3.1 endpoint statut | W2 | W2.4 |
| E3.2 badge + popover | W2 | W2.5 |
| E3.3 alerte retard | W2 | W2.6 |
| E4.1 service balancer | W3 | W3.1 |
| E4.2 endpoint balanced | W3 | W3.2 |
| E4.3 modale UI | W3 | W3.3 |
| E5.1 viewMode activity | W4 | W4.1, W4.2 |
| E5.2 ActivityGrid + print | W4 | W4.3 |
| ADRs | W0 | W0.2, W0.3, W0.4 |
| Permissions RBAC compile-time | W0 | W0.6 |
| Permissions RBAC DB | W1 | W1.2 |
| i18n namespaces | W1 + W2 + W3 + W4 | W1.4, W2.3, W2.5, W3.3, W4.2 |
| E2E | par vague | W1.6, W2.7, W3.4, W4.4 |
| Doc utilisateur | W5 | W5.2 |
| Recette CDG | W5 | W5.1 |
| Provisioning CDG | W5 | W5.3 |
| Monitoring | W5 | W5.4 |

Aucun gap identifié. Les éléments §6.4 (cartographie UI), §7 (exigences non fonctionnelles : perf, couverture, i18n, a11y) sont couverts dans les DoD respectifs des tâches. §15 (déploiement/rollback) est couvert par les sections deploy de chaque wave.

### 2. Placeholder scan

- Aucun « TBD » / « TODO » / « fill in » / « similar to ».
- Les prompts sub-agents contiennent le détail exigé (contexte, contraintes, fichiers autorisés, TDD cycle explicite, commit message, model sonnet).
- Les steps produisent tous soit du code, soit une commande exécutable, soit un livrable nommé.
- Un unique `<indiquée par l'orchestrateur>` subsiste dans les prompts des sub-agents UI W2.5, W3.3, W4.3 : c'est une variable d'exécution légitime (dépend de la variante validée par le PO en W0.5), pas un placeholder de planification.

### 3. Cohérence des types

- `canUpdateStatus` (bool) introduit en W2.5 côté API, consommé par `AssignmentStatusBadge` côté front. Cohérent.
- Types `BalancerInput` / `BalancerOutput` définis en W3.1 dans `planning-balancer.types.ts`, consommés en W3.2 et W3.3 via import. Cohérent.
- `ViewMode` ajouté au store en W4.1, consommé en W4.2 et W4.3. Cohérent.
- DTOs `CreateRecurringRuleDto` étendus en W2.2 (recurrenceType, monthlyOrdinal, monthlyDayOfMonth), appelés par `RecurringRulesModal` en W2.3. Cohérent.
- `GenerateBalancedDto` défini en W3.2, consommé en W3.3 via `usePlanningBalancer`. Cohérent.

---

## Annexes

### A.1 — Checklist de dispatch de sous-agent (template)

À chaque fois qu'on dispatch un Agent Sonnet :

- [ ] Prompt auto-portant (pas de « voir plan » sans citation)
- [ ] Contexte (repo path, stack, état préalable)
- [ ] Liste EXACTE des fichiers autorisés à modifier/créer
- [ ] Cycle TDD explicite (tests d'abord, fail, implémentation, pass, commit)
- [ ] Commandes de vérification exactes à exécuter
- [ ] Format de sortie (diff + test output + confirmation commit)
- [ ] `model: "sonnet"` explicite
- [ ] Monitor armé au lancement (pas de fire-and-forget)

### A.2 — Requêtes SQL de diagnostic RBAC (à exécuter systématiquement)

```sql
-- Vérifier que les 4 permissions sont bien associées aux rôles attendus
SELECT p.code AS permission, ARRAY_AGG(rc.code ORDER BY rc.code) AS roles
FROM permissions p
JOIN role_permissions rp ON rp."permissionId" = p.id
JOIN role_configs rc ON rc.id = rp."roleConfigId"
WHERE p.code IN (
  'predefined_tasks:balance',
  'predefined_tasks:update-own-status',
  'predefined_tasks:update-any-status',
  'planning:activity-view'
)
GROUP BY p.code
ORDER BY p.code;
```

Résultat attendu (cf. W1.2) :
```
predefined_tasks:balance            | {ADMIN, RESPONSABLE}
predefined_tasks:update-any-status  | {ADMIN, MANAGER, RESPONSABLE}
predefined_tasks:update-own-status  | {ADMIN, CONTRIBUTEUR, MANAGER, REFERENT_TECHNIQUE, RESPONSABLE}
planning:activity-view              | {ADMIN, CONTRIBUTEUR, MANAGER, OBSERVATEUR, REFERENT_TECHNIQUE, RESPONSABLE}
```

### A.3 — Commande deploy VPS standard

À exécuter après chaque push sur master impliquant un changement api/web/migration :

```bash
ssh debian@92.222.35.25 'cd /opt/orchestra && git pull origin master && \
  docker compose -f docker-compose.prod.yml build api web && \
  docker compose -f docker-compose.prod.yml up -d api web && \
  docker compose -f docker-compose.prod.yml exec -T api pnpm prisma migrate deploy --schema=packages/database/prisma/schema.prisma'
```

**Monitor** obligatoire. Si migration échoue : `pg_restore` depuis dump + revert du commit fautif + re-push.

### A.4 — Rollback par wave

Chaque wave est un commit-range sur master. Pour rollback une wave livrée :

```bash
# Identifier la plage de commits de la wave
git log --oneline --grep="feat(predefined-tasks): W2" -5

# Revert (crée de nouveaux commits)
git revert <oldest-sha>..<newest-sha> --no-edit

# Push + deploy
git push origin master
ssh debian@92.222.35.25 '...'

# Pour les migrations Prisma: pas de migrate-down en prod. Créer une migration "down" explicite si besoin de retirer un champ.
```

### A.5 — Liste des commits types attendus (par wave)

**W0** (3-5 commits) :
- `docs(adr): schéma Prisma cible pour Planning d'activités récurrentes`
- `docs(adr): stratégie d'audit persistant via table audit_logs`
- `docs(adr): algorithme d'équilibrage glouton V1 (pseudo-code + jeux de tests)`
- `docs(mockups): 3 surfaces UI du lot Planning activités récurrentes`
- `feat(rbac): ajoute 4 permissions pour planning activités récurrentes (compile-time)`

**W1** (4-6 commits) :
- `feat(database): weight sur PredefinedTask + modèle AuditLog`
- `chore(rbac): seed idempotent des 4 permissions Planning activités`
- `feat(predefined-tasks): ajoute champ weight (1..5) avec validation`
- `feat(predefined-tasks): WeightInput + intégration formulaire + i18n fr/en`
- `feat(planning): expose weight dans DayCell via taille de pastille`
- `test(e2e): scénario E1 pondération tâches prédéfinies`

**W2** (5-7 commits) :
- `feat(database): recurrenceType + completionStatus sur predefined_task_*`
- `feat(predefined-tasks): récurrence mensuelle (MONTHLY_DAY + MONTHLY_ORDINAL) + generator pur`
- `feat(predefined-tasks): UI récurrence mensuelle dans RecurringRulesModal`
- `feat(predefined-tasks): endpoint PATCH /completion + audit persistence`
- `feat(planning): AssignmentStatusBadge + popover + intégration DayCell`
- `feat(planning): alerte retard sur assignations NOT_DONE via AppSettings`
- `test(e2e): scénarios E2 (récurrence mensuelle) + E3 (statut + sync rôles)`

**W3** (3-5 commits) :
- `feat(predefined-tasks): PlanningBalancerService glouton + 7 jeux de tests`
- `feat(predefined-tasks): endpoint generate-balanced preview/apply avec audit + idempotence`
- `feat(planning): BalancedPlanningModal + usePlanningBalancer + bouton PlanningView`
- `test(e2e): scénario E4 prévisualiser + apply + idempotence`

**W4** (3-4 commits) :
- `feat(planning): étend planningView.store avec viewMode=activity`
- `feat(planning): bouton Vue activité gaté par planning:activity-view`
- `feat(planning): ActivityGrid + print CSS + rendu conditionnel PlanningView`
- `test(e2e): scénario E5 Vue activité (gating + nominal)`

**W5** (2-4 commits) :
- `docs(user): guide Planning d'activités récurrentes V1`
- `docs(recette): PV recette Planning d'activités récurrentes CDG`
- `docs(reports): monitoring première génération CDG`
- `docs(reports): monitoring deuxième génération CDG`

---

## Execution handoff

Plan complet et sauvegardé à `docs/superpowers/plans/2026-04-24-planning-activites-recurrentes.md`. Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — un sous-agent frais par tâche, review checkpoint entre tâches, itération rapide. Nécessite sub-skill `superpowers:subagent-driven-development`.

2. **Inline Execution** — exécution dans la session courante avec checkpoints de review groupés. Nécessite sub-skill `superpowers:executing-plans`.

**Quelle approche ?**

