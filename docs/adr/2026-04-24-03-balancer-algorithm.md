# ADR-03 — Algorithme d'équilibrage glouton V1 (PlanningBalancerService)

**Date :** 2026-04-24
**Statut :** Accepté
**Décideurs :** A. Berge (DSI), L. Preschez (CDG, PO)
**Lot :** Planning d'activités récurrentes (besoin IA nº01 CDG) — épopée E4

## Contexte

L'épopée E4 (US E4.1) exige un service `PlanningBalancerService.balance(input)` qui produit une répartition équilibrée des occurrences de tâches entre agents d'un service sur une plage donnée. Contraintes métier :

- Heuristique simple, explicable, déterministe.
- Temps d'exécution < 3 s pour 20 agents × 30 tâches sur un mois.
- Écartement des agents absents sur une date d'occurrence.
- Support optionnel de contraintes de compétence (skills requis par tâche).
- Couverture unitaire ≥ 95 % avec jeux de données déterministes.

## Décision

Heuristique gloutonne avec départage stable. Pas de programmation par contraintes, pas d'optimisation globale.

### Types

```typescript
// apps/api/src/predefined-tasks/planning-balancer.types.ts

export type BalancerPeriod = 'MORNING' | 'AFTERNOON' | 'FULL_DAY';

export interface BalancerOccurrence {
  taskId: string;
  weight: number;       // 1..5, pondération récupérée depuis PredefinedTask.weight
  date: Date;
  period: BalancerPeriod;
}

export interface BalancerAgent {
  userId: string;
  skills?: string[];    // codes skills détenus
}

export interface BalancerAbsence {
  startDate: Date;
  endDate: Date;
}

export interface BalancerInput {
  occurrences: BalancerOccurrence[];
  agents: BalancerAgent[];
  absences: Map<string /* userId */, BalancerAbsence[]>;
  taskRequiredSkills?: Map<string /* taskId */, string[]>;
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
  equityRatio: number;                       // 1 - σ/µ, plus proche de 1 = meilleur équilibre
  unassignedOccurrences: BalancerUnassigned[];
}
```

### Pseudo-code

```
function balance(input: BalancerInput): BalancerOutput {
  workload := Map<userId, number> initialisé à 0 pour chaque agent de input.agents
  proposedAssignments := []
  unassigned := []

  occurrences := input.occurrences triées par (date asc, period asc, taskId asc)
  // Tri stable et reproductible — zéro dépendance à l'ordre d'entrée.

  for occ in occurrences:
    requiredSkills := input.taskRequiredSkills?.get(occ.taskId) ?? []

    eligibles := input.agents filtrés par:
      - non absents sur occ.date (vs. input.absences[userId])
      - possèdent TOUS les skills requis si requiredSkills non vide

    if eligibles vide:
      unassigned.push({ taskId: occ.taskId, date: occ.date, period: occ.period, reason: 'NO_ELIGIBLE_AGENT' })
      continue

    // Départage stable : charge minimale, puis userId lexicographique
    chosen := argmin(eligibles, agent -> (workload[agent.userId], agent.userId))

    proposedAssignments.push({
      taskId: occ.taskId,
      userId: chosen.userId,
      date: occ.date,
      period: occ.period,
      weight: occ.weight,
    })
    workload[chosen.userId] += occ.weight

  workloadByAgent := workload.entries().map(...).sort by userId asc

  loads := workloadByAgent.map(a -> a.weightedLoad)
  µ := moyenne(loads)
  σ := écart-type(loads)
  equityRatio := µ > 0 ? clamp(1 - σ/µ, 0, 1) : 1

  return { proposedAssignments, workloadByAgent, equityRatio, unassignedOccurrences: unassigned }
}

function isAbsentOn(absences, date):
  return absences.some(a -> a.startDate <= date <= a.endDate)
```

### Complexité

- Tri initial : O(N log N) avec N = nombre d'occurrences.
- Boucle principale : O(N × A) où A = nombre d'agents (filtrage + argmin linéaires).
- Cas cible (20 agents × 30 tâches × 30 jours × 1 période) : N ≈ 900, A = 20 → 18 000 opérations, largement sous la seconde.

### Idempotence de l'apply

La contrainte `@@unique([predefinedTaskId, userId, date, period])` sur `PredefinedTaskAssignment` garantit qu'un replay sur la même plage ne produit aucun doublon. L'implémentation persistance utilise `prisma.$transaction(tx => tx.predefinedTaskAssignment.createMany({ data: ..., skipDuplicates: true }))`. Si la même plage est rejouée :

- `createMany` insère uniquement les tuples absents.
- L'`AuditLog` `BALANCER_APPLIED` est écrit avec `assignmentsCreated` = count des vraies créations (peut être 0 sur replay).

### Jeux de tests déterministes (≥ 7, livrés en W3.1)

1. **Trivial** — 1 agent, 1 occurrence → 1 assignation, equity = 1.
2. **Répartition parfaite** — 2 agents, 4 occurrences poids=1 → 2 par agent, equity = 1.
3. **Poids asymétriques** — 3 agents, poids [5,5,1,1,1,1] → les deux 5 sont chez 2 agents différents.
4. **Absence bloquante** — 2 agents, 2 occurrences, agent u1 absent jour 1 → occ1 va à u2, occ2 va à u1 (u2 avait déjà charge).
5. **Compétence requise** — 3 agents, 1 occ skill X requis, seul b possède X → assignation forcée à b.
6. **Aucun éligible** — 2 agents tous absents → `unassignedOccurrences` non vide, reason `NO_ELIGIBLE_AGENT`.
7. **Départage stable** — 2 agents charges égales, userId `user-a` et `user-b` → `user-a` gagne (ordre lexico).
8. **Bench** — 20 agents × 30 tâches × 30 jours (= 900 occurrences) → durée mesurée < 3000 ms.

Les tests utilisent des dates fixes (type `new Date('2026-05-01')`) et des ids fixes pour reproductibilité. Aucun `Math.random`, aucun `Date.now()` non-mockés dans le code du service.

## Décisions explicites et hors-périmètre

### Décisions

- **Tri par `(date, period, taskId)`** : la date domine, puis période (MORNING avant AFTERNOON avant FULL_DAY lexicographiquement), puis taskId pour stabilité absolue.
- **Départage `userId` lexicographique** : garantit la reproductibilité inter-exécutions (mêmes entrées → même sortie).
- **Absences = plage fermée** : `startDate <= date <= endDate`.
- **Compétences = AND strict** : toutes les compétences requises doivent être présentes dans `agent.skills`.
- **Absents = écartés par occurrence** : un agent absent sur une date ne reçoit pas d'assignation ce jour-là, mais reste éligible les autres jours.
- **Stateless par appel** : chaque invocation repart avec `workload = 0` pour tous les agents. Pas de rééquilibrage inter-plages.

### Hors périmètre V1

- **Jours fériés comme contrainte** : non gérés par le balancer. Si une règle mensuelle tombe un férié, l'occurrence est créée. Le responsable peut manuellement réassigner ou supprimer. Conforme à §5 du backlog.
- **Rotation d'équité inter-plages** : la V1 ne mémorise pas la charge historique. Si le balancer est rejoué sur deux mois consécutifs, le même agent pourrait cumuler des charges élevées. À traiter hors V1 si besoin.
- **Contraintes "pas deux fois la même tâche au même agent sur N jours"** : non gérées.
- **Préférences agents** (télétravail, horaires) : non gérées. Hors périmètre.
- **Optimisation globale** (programmation par contraintes, ILP, recuit simulé) : exclue par spec §5. Une heuristique gloutonne est suffisante pour la V1.

## Conséquences

### Positives

- Implémentation simple, lisible, testable unitairement sans DB.
- Déterminisme total → tests fiables, débogage aisé.
- Performance largement sous les contraintes NF.
- Extensions futures (rotation, préférences) possibles sans refactor structurel : ajouter des critères au tri ou au filtrage.

### Négatives / contraintes

- L'heuristique gloutonne n'est pas optimale : pour certaines configurations, un solveur global trouverait un meilleur équilibre. Le ratio d'équité doit être présenté au PO comme un indicateur, pas une garantie.
- Pas d'anticipation inter-plages : l'utilisateur doit comprendre que chaque génération repart à zéro.
- Le service est "pure" (pas d'I/O DB) → la responsabilité de fetcher occurrences/absences/skills échoit au `PredefinedTasksService` qui orchestre l'appel.

## Références

- Backlog source §E4.1 et §E4.2
- Plan d'implémentation §W3.1 (spec détaillée + 7 jeux de tests)
- ADR-01 (schéma Prisma cible, incluant contrainte unique utilisée pour l'idempotence)
- ADR-02 (stratégie d'audit pour `BALANCER_APPLIED`)
