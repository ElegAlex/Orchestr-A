# ADR-02 — Stratégie d'audit persistant V1 pour Planning d'activités récurrentes

**Date :** 2026-04-24
**Statut :** Accepté
**Décideurs :** A. Berge (DSI), L. Preschez (CDG, PO)
**Lot :** Planning d'activités récurrentes (besoin IA nº01 CDG)

## Contexte

Les épopées E3 (statut d'exécution) et E4 (apply du balancer) exigent une traçabilité RGPD des actions utilisateur effectuées sur le planning. Deux options ont été évaluées :

- **Option A (retenue)** : créer une table DB dédiée `audit_logs` et y persister les événements.
- **Option B (rejetée)** : se contenter des champs `completedAt` + `completedById` sur l'assignation et d'un log console via l'`AuditService` existant.

### État avant cette décision

L'`AuditService` existant (`apps/api/src/audit/audit.service.ts`) expose une méthode `log(event)` qui écrit uniquement sur le logger applicatif (Winston/NestJS Logger), sans persistance DB. Aucune table `audit*` n'existe dans le schéma Prisma. L'enum `AuditAction` actuel couvre uniquement des événements d'auth et de congés (`LOGIN_SUCCESS`, `LOGIN_FAILURE`, `REGISTER`, `ACCESS_DENIED`, `ROLE_CHANGE`, `USER_DEACTIVATED`, `PASSWORD_CHANGED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`).

### Arbitrage

L'option A a été validée par le PO le 2026-04-24. Arguments décisifs :

- Conformité RGPD : trace exploitable (qui, quand, quoi, avant/après) au-delà d'un simple log rotated.
- Évolutivité : l'infrastructure est réutilisable pour d'autres modules (congés, projets) sans nouvelle migration.
- Coût V1 marginal : 1 table + 1 service = +1 jour effort par rapport à l'option B.

## Décision

### Modèle `AuditLog`

Défini dans ADR-01 §"Migration 1 — W1". Champs :

- `id` (uuid)
- `action` (string) — code identifiant l'événement (enum côté TS, string côté DB pour évolutivité)
- `entityType` (string) — type de ressource concernée
- `entityId` (string) — id de la ressource (ou id composite en string pour une plage)
- `actorId` (string, nullable) — FK vers `User`, nullable pour évènements système (cron, job)
- `payload` (JSON, nullable) — contexte libre (before/after, raison, plage…)
- `createdAt` (timestamp)
- Index `(entityType, entityId)` et `(actorId, createdAt)`
- Immuable : pas de `updatedAt`, pas de méthode `update` dans le service (convention).

### Service `AuditPersistenceService`

Nouveau service NestJS, séparé de l'`AuditService` console existant (qui reste pour les événements éphémères).

**Localisation :** `apps/api/src/audit/audit-persistence.service.ts`

**Signature :**

```typescript
@Injectable()
export class AuditPersistenceService {
  constructor(private prisma: PrismaService) {}

  async log(event: {
    action: string;
    entityType: string;
    entityId: string;
    actorId?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<void>;
}
```

Exporté depuis `audit.module.ts`. À injecter dans les modules consommateurs.

### Scope V1 strict — actions à tracer

Seules 2 actions écrivent dans `audit_logs` en V1. Extension future hors lot.

| Déclencheur | `action` | `entityType` | `entityId` | `payload` |
|---|---|---|---|---|
| `PATCH /predefined-tasks/assignments/:id/completion` (E3.1) | `ASSIGNMENT_STATUS_CHANGED` | `PredefinedTaskAssignment` | `assignment.id` | `{ before: string, after: string, reason?: string }` |
| `POST /predefined-tasks/recurring-rules/generate-balanced` mode `apply` (E4.2) | `BALANCER_APPLIED` | `PredefinedTaskRange` | `${startDate}_${endDate}` | `{ range, taskIds, userIds, assignmentsProposed, assignmentsCreated, equityRatio }` |

### Règles d'écriture

- **Transactionnel** : l'insertion `AuditLog` se fait DANS la même transaction que l'action métier (mutation d'assignation ou `createMany` du balancer). Si la transaction échoue, aucune ligne d'audit n'est écrite.
- **Pas de best-effort** : pas de try/catch qui swallow l'erreur d'insertion. Un échec d'audit = échec de l'action (priorité conformité > disponibilité).
- **Pas de mutation** : aucune mise à jour ni suppression de ligne `audit_logs` via service. La table est append-only par convention applicative. Toute purge future passe par un job dédié, hors V1.

## Conséquences

### Positives

- Traçabilité exploitable pour tout audit RGPD / investigation.
- Service réutilisable pour d'autres modules (extension future sans migration).
- Pas de duplication avec `AuditService` console, qui reste pour les événements d'auth rapides.

### Négatives / contraintes

- Coût I/O supplémentaire à chaque transition de statut et à chaque apply balancer (1 INSERT). Acceptable vu la volumétrie attendue (~50-200 transitions/jour × 6 agents CDG).
- Dépendance nouvelle : `predefined-tasks` module importera `AuditModule`. Documenter l'injection dans le `predefined-tasks.module.ts`.
- Pas de policy de rétention en V1. À surveiller si la table dépasse 100k lignes ou 1 Go.

### Hors périmètre V1

- Tracage des CRUD existants sur `PredefinedTask`, `PredefinedTaskRecurringRule`, `PredefinedTaskAssignment` (hors transitions de statut).
- Tracage des actions RBAC (assignation de rôles, modifications de permissions).
- UI de consultation de l'audit (la table est accessible via DB direct ou endpoint futur).
- Purge / archivage automatique.

## Références

- ADR-01 (schéma Prisma cible, inclut la définition du modèle `AuditLog`)
- Plan W1 tâche W1.1 (migration), W2 tâche W2.4 (intégration endpoint completion), W3 tâche W3.2 (intégration endpoint balancer)
- Backlog source §6.2 (nouveaux endpoints), §E3.1 (critères d'acceptation audit)
