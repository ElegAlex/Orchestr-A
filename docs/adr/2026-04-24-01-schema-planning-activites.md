# ADR-01 — Schéma Prisma cible pour Planning d'activités récurrentes

**Date :** 2026-04-24
**Statut :** Accepté
**Décideurs :** A. Berge (DSI), L. Preschez (CDG, PO), A. Beouch (CDG, support)
**Lot :** Planning d'activités récurrentes (besoin IA nº01 CDG)

## Contexte

Le lot "Planning d'activités récurrentes" introduit 5 épopées (E1 pondération, E2 récurrence mensuelle, E3 statut d'exécution, E4 équilibrage, E5 Vue Activité). Chacune nécessite des extensions du schéma Prisma. Cet ADR consolide ces extensions et les séquence en migrations disjointes, une par vague d'implémentation, afin de limiter le risque de rollback inter-vague.

La source de vérité du schéma est `packages/database/prisma/schema.prisma`. Aucune autre application ne modifie ce schéma.

## Décision

Trois migrations disjointes sont livrées, dans l'ordre des vagues W1 et W2 du plan d'implémentation.

### Migration 1 — W1 : `add_weight_and_audit_log`

**Extension 1a — `PredefinedTask.weight`**

```prisma
model PredefinedTask {
  // ... champs existants
  weight Int @default(1) // 1..5, pondération pour équilibrage
}
```

- Valeurs autorisées 1 à 5, validation applicative (DTO `@Min(1) @Max(5)`).
- Pas de contrainte `CHECK` SQL (cohérence avec le reste du schéma qui s'appuie sur la couche applicative).
- Défaut 1 → migration non destructive sur les enregistrements existants.

**Extension 1b — Nouveau modèle `AuditLog`**

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  action     String   // ASSIGNMENT_STATUS_CHANGED | BALANCER_APPLIED | ...
  entityType String   // PredefinedTaskAssignment | PredefinedTaskRecurringRule | PredefinedTaskRange | ...
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

- Relation inverse à ajouter sur `User` : `auditLogs AuditLog[] @relation("AuditActor")`.
- `payload` stocké en JSONB, pas de schéma imposé (convention par `action`).
- Index `(entityType, entityId)` pour la consultation par ressource.
- Index `(actorId, createdAt)` pour les audits par utilisateur.

### Migration 2 — W2 : `add_recurrence_and_completion`

**Extension 2a — `PredefinedTaskRecurringRule` enrichi**

```prisma
model PredefinedTaskRecurringRule {
  // ... champs existants
  recurrenceType     String @default("WEEKLY") // WEEKLY | MONTHLY_ORDINAL | MONTHLY_DAY
  monthlyOrdinal     Int?   // 1..5 (5 = dernière occurrence)
  monthlyDayOfMonth  Int?   // 1..31
  dayOfWeek          Int?   // devient NULLABLE (nécessaire pour MONTHLY_DAY)
}
```

- Défaut `recurrenceType = "WEEKLY"` : toutes les règles existantes sont conservées sémantiquement.
- Validation croisée au niveau DTO (cf. E2.1) :
  - `WEEKLY` → `dayOfWeek` requis, autres nuls
  - `MONTHLY_DAY` → `monthlyDayOfMonth` requis, `dayOfWeek` interdit
  - `MONTHLY_ORDINAL` → `monthlyOrdinal` + `dayOfWeek` requis

**Extension 2b — `PredefinedTaskAssignment` enrichi**

```prisma
model PredefinedTaskAssignment {
  // ... champs existants
  completionStatus    String    @default("NOT_DONE") // NOT_DONE | IN_PROGRESS | DONE | NOT_APPLICABLE
  completedAt         DateTime?
  completedById       String?
  completedBy         User?     @relation("AssignmentCompletedBy", fields: [completedById], references: [id])
  notApplicableReason String?

  @@unique([predefinedTaskId, userId, date, period])
  @@index([date, userId])                // performance GET /planning/overview
  @@index([completionStatus, date])      // performance alerte retard
  @@map("predefined_task_assignments")
}
```

- Relation inverse à ajouter sur `User` : `completedAssignments PredefinedTaskAssignment[] @relation("AssignmentCompletedBy")`.
- Contrainte unique composite déjà existante (prévient les doublons, supporte l'idempotence du balancer).
- Deux index additionnels pour les requêtes fréquentes :
  - `(date, userId)` : lookup d'assignations d'un user sur une plage (overview).
  - `(completionStatus, date)` : filtre des tâches en retard.

## Conséquences

### Positives

- Chaque migration est isolée par vague, facilitant le rollback indépendant.
- Aucune migration ne casse les données existantes (valeurs par défaut adaptées).
- `AuditLog` arrive dès W1, ce qui permet de l'utiliser dès W2 pour la traçabilité des transitions de statut (E3) sans migration supplémentaire.
- Les index sur `predefined_task_assignments` adressent directement l'exigence NF de performance sur `/planning/overview` (<500 ms sur plage mensuelle pour 200 utilisateurs).

### Négatives / contraintes

- 3 migrations = 3 moments de déploiement distincts avec `pnpm prisma migrate deploy`. Chaque deploy doit être testé en montée ET en descente localement avant merge (cf. DoD §10 du backlog).
- La relation `User → AuditLog` et `User → PredefinedTaskAssignment (completedBy)` alourdit le modèle `User`. Acceptable en V1 ; si le modèle devient trop gros, envisager un split de fichier Prisma (hors périmètre V1).
- Pas de purge de `audit_logs` en V1 ; à prévoir hors lot si la volumétrie dépasse ~100k lignes/mois (policy RGPD).

### Hors périmètre V1

- Jours fériés comme contrainte sur la génération des occurrences (cf. ADR-03, choix : les jours fériés ne décalent pas les assignations).
- Optimisation d'équilibrage par ILP / contraintes (cf. ADR-03, V1 en heuristique gloutonne).
- Purge automatique de `audit_logs`.
- Intégration OSCARR / SI externes.

## Références

- Backlog source : `backlog/planning-activites-recurrentes/BACKLOG - Planning activites recurrentes.md`
- Plan d'implémentation : `docs/superpowers/plans/2026-04-24-planning-activites-recurrentes.md`
- ADR connexe : ADR-02 (stratégie d'audit), ADR-03 (algorithme balancer)
