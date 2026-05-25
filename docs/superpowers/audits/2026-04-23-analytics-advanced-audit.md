# AUDIT — Refonte Analytics Avancés (tab Reports) V1

> **Phase 0** — Constats factuels du repo, sourcés (`fichier:ligne`). Aucune implémentation effectuée.
> **Date** : 2026-04-23
> **Périmètre audité** : tab "Analytics Avancés" dans `/reports`, schéma data, scheduler, i18n, tests.
> **Statut** : en attente de ratification Alexandre sur les **6 décisions de pivot** identifiées en §8.

---

## 1. Schéma Prisma — `ProjectSnapshot`

### Modèle `ProjectSnapshot` — **PRÉSENT** (mais shape ≠ spec)

`packages/database/prisma/schema.prisma:172-184` :

```prisma
model ProjectSnapshot {
  id         String   @id @default(uuid())
  projectId  String
  progress   Float
  tasksDone  Int
  tasksTotal Int
  date       DateTime @default(now())
  createdAt  DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("project_snapshots")
}
```

**Champs présents** : `id` (UUID), `projectId` (FK CASCADE), `progress` (Float), `tasksDone` (Int), `tasksTotal` (Int), `date` (DateTime, default `now`), `createdAt` (DateTime, default `now`).

**Indexes** : aucun `@@index` déclaré. Seules la PK et la FK implicite existent.

**Migration source** : `packages/database/prisma/migrations/20260404211126_add_project_snapshots/migration.sql` (unique migration touchant le mot "snapshot").

### Écarts avec la shape cible du spec (§4)

| Spec V1 attend | Présent en DB | Écart |
|---|---|---|
| `progressPct` | `progress` | renommage |
| `capturedAt` | `date` | renommage |
| `tasksInProgress` | absent | ajout |
| `tasksBlocked` | absent | ajout |
| `milestonesReached` | absent | ajout |
| `milestonesOverdue` | absent | ajout |
| `milestonesUpcoming` | absent | ajout |
| `@@index([projectId, capturedAt])` | absent | ajout |
| `@@index([capturedAt])` | absent | ajout |

**Conséquence** : Wave 1.A devient une migration ALTER (rename + addColumn + addIndex), pas un CREATE. Compatibilité ascendante du code existant à vérifier.

### Modèles voisins (extraits utiles)

**`Project`** (`schema.prisma:136-170`) :
- Scalaires : `id`, `name`, `status` (enum `ProjectStatus` : DRAFT/ACTIVE/SUSPENDED/COMPLETED/CANCELLED), `priority`, `startDate`, `endDate`, `budgetHours`, `managerId?`.
- Relations : `manager`, `members`, `milestones[]`, `tasks[]`, `snapshots[]` (ProjectSnapshot).

**`Task`** (`schema.prisma:262-300`) :
- Scalaires : `id`, `title`, `status` (enum `TaskStatus` : TODO / IN_PROGRESS / IN_REVIEW / DONE / BLOCKED), `priority`, `projectId?`, `milestoneId?`, `assigneeId?`, `progress`, `startDate`, `endDate`.
- Relations : `assignee` (User?), `assignees` (TaskAssignee[]).
- Indexes : `@@index([projectId])`, `@@index([assigneeId])`, `@@index([status])`.

**`Milestone`** (`schema.prisma:234-249`) :
- Scalaires : `id`, `name`, `projectId`, `dueDate`, `status` (enum `MilestoneStatus` : PENDING / IN_PROGRESS / COMPLETED / DELAYED).

---

## 2. Endpoints analytics — `apps/api/src/analytics/`

### Arborescence

```
apps/api/src/analytics/
├── analytics.controller.ts          29 lignes
├── analytics.controller.spec.ts     74 lignes
├── analytics.module.ts              12 lignes
├── analytics.service.ts            382 lignes
├── analytics.service.spec.ts       582 lignes
└── dto/
    ├── analytics-query.dto.ts       28 lignes
    └── analytics-response.dto.ts   156 lignes
                              TOTAL 1263 lignes
```

### Endpoints exposés (2)

Guards globaux : `JwtAuthGuard` via `APP_GUARD` (`apps/api/src/auth/auth.module.ts:47`) + `PermissionsGuardV2` via `APP_GUARD` (`apps/api/src/rbac/rbac.module.ts:43`). Pas de `@UseGuards` ni `@Roles` au niveau controller.

| # | Méthode | Route | Permission | Query | Retour |
|---|---|---|---|---|---|
| 1 | GET | `/analytics` | `@RequirePermissions('reports:view')` (`analytics.controller.ts:15`) | `AnalyticsQueryDto` : `dateRange?` (week/month/quarter/year, défaut `month`) + `projectId?` (UUID) | `Promise<AnalyticsResponseDto>` |
| 2 | GET | `/analytics/export` | `@RequirePermissions('reports:export')` (`analytics.controller.ts:24`) | idem | non typé (retour de `exportAnalytics(query)`) |

### DTOs de réponse (`analytics-response.dto.ts`)

- `AnalyticsResponseDto` (l.105) : `metrics: MetricDto[]`, `projectProgressData: ProjectProgressDataDto[]`, `taskStatusData: TaskStatusDataDto[]`, `projectDetails: ProjectDetailDto[]`.
- DTOs auxiliaires définis mais non consommés : `WorkloadUserDto` (l.119), `VelocityPeriodDto` (l.136), `BurndownPointDto` (l.147).

### Endpoint snapshots existant — `apps/api/src/projects/`

- `POST /projects/snapshots/capture` (`apps/api/src/projects/projects.controller.ts:105`)
- `GET /projects/:id/snapshots?from=&to=` (`apps/api/src/projects/projects.controller.ts:159`)

### Module `apps/api/src/reports/` — **ABSENT**

Aucun fichier sous `apps/api/src/reports/`. Pas de surface API parallèle.

### Quel endpoint le tab "Analytics Avancés" consomme-t-il ?

**Aucun des 2 endpoints `/analytics`.** Les 6 sous-composants tapent directement les endpoints génériques (cf. §3). L'endpoint `/analytics` est consommé uniquement par le **tab "Vue d'ensemble"** (`page.tsx:68`, `activeTab === 0`) ; `/analytics/export` par le bouton export JSON (`page.tsx:138-139`).

**Conséquence** : la phrase du spec « ajout de 6 endpoints dans `apps/api/src/analytics/**` » entrera en cohabitation avec 2 endpoints existants utilisés ailleurs — voir décision §8.

---

## 3. Composant tab "Analytics Avancés" + sous-composants

### Arborescence `apps/web/app/[locale]/reports/`

```
apps/web/app/[locale]/reports/
├── page.tsx                                    426 lignes
├── types.ts                                     56 lignes
└── components/
    ├── CollaboratorWorkloadChart.tsx            254 lignes
    ├── MetricCard.tsx                            51 lignes
    ├── MilestoneCompletionChart.tsx             271 lignes
    ├── PortfolioGantt.tsx                        96 lignes
    ├── PriorityDistributionChart.tsx            283 lignes
    ├── ProgressTrendChart.tsx                   332 lignes
    ├── ProjectProgressChart.tsx                 135 lignes
    ├── ProjectProgressionChart.tsx              212 lignes
    ├── ProjectsDetailTable.tsx                  507 lignes
    ├── RecentActivityCards.tsx                  256 lignes
    ├── TaskStatusCards.tsx                       36 lignes
    └── TaskStatusChart.tsx                       42 lignes
```

### Pas de composant tab dédié

Le tab "Avancés" est rendu **inline** dans `apps/web/app/[locale]/reports/page.tsx:377-414`, sous le bloc `{activeTab === 1 && ...}`. Label : `t("tabs.advanced")` (`page.tsx:244`). Layout : `grid grid-cols-1 lg:grid-cols-2`, 3 lignes.

### Mapping des 6 sous-blocs actuels

| Sous-bloc | Composant | Source data | Référence |
|---|---|---|---|
| 1. Progression projets | `ProjectProgressionChart` | `GET /projects` | `ProjectProgressionChart.tsx:56` |
| 2. Répartition charge | `CollaboratorWorkloadChart` | `GET /tasks[?projectId=]` | `CollaboratorWorkloadChart.tsx:64` |
| 3. Tendance progression | `ProgressTrendChart` | `GET /projects` + boucle `GET /projects/{id}/snapshots` + `GET /projects/{id}` | `ProgressTrendChart.tsx:112,128,137` |
| 4. Complétion jalons | `MilestoneCompletionChart` | `GET /milestones[?projectId=]` | `MilestoneCompletionChart.tsx:47-48` |
| 5. Répartition priorité | `PriorityDistributionChart` | `GET /tasks[?projectId=]` | `PriorityDistributionChart.tsx:63` |
| 6. Activité récente | `RecentActivityCards` | `GET /tasks[?projectId=]` | `RecentActivityCards.tsx:52` |

Tous reçoivent les mêmes props : `dateRange: string`, `projectId?: string`. Tous appellent `useTranslations("admin.reports.analytics")`.

### Service front Axios — `apps/web/src/services/analytics.service.ts` (104 lignes)

Trois méthodes définies sur l'objet `analyticsService` (l.68) :
- `getAnalytics(dateRange, projectId?) → GET /analytics?dateRange=...&projectId=...` (l.69-78)
- `exportAnalytics(...) → GET /analytics/export?...` (l.80-89)
- `getProjectSnapshots(projectId, from?, to?) → GET /projects/{projectId}/snapshots?...` (l.91-103)

**`analyticsService` n'est utilisé par AUCUN des 6 composants du tab.** Tous appellent `api.get()` directement (import `@/lib/api`). `page.tsx` lui-même appelle `api.get('/analytics?...')` sans passer par le service (l.68).

### Hooks — TanStack Query / Zustand : **ABSENTS**

Aucun `useQuery`, `useMutation`, `useInfiniteQuery` dans `apps/web/app/[locale]/reports/`. Tous les composants utilisent `useState` + `useEffect` + `api.get()`. Aucun store Zustand consommé. Seul `usePermissions` est utilisé (`page.tsx:21,29`) pour les guards `reports:view` / `reports:export`.

### Mini-diagramme

```
page.tsx (activeTab === 1, inline)
├── ProjectProgressionChart       → api.get("/projects")
├── CollaboratorWorkloadChart     → api.get("/tasks[?projectId=]")
├── ProgressTrendChart            → api.get("/projects") + N × api.get("/projects/{id}/snapshots") + N × api.get("/projects/{id}")
├── MilestoneCompletionChart      → api.get("/milestones[?projectId=]")
├── PriorityDistributionChart     → api.get("/tasks[?projectId=]")
└── RecentActivityCards           → api.get("/tasks[?projectId=]")

Service défini mais NON consommé par le tab :
  analyticsService → getAnalytics / exportAnalytics / getProjectSnapshots
```

---

## 4. Scheduler — `@nestjs/schedule` et crons existants

- **Dépendance** : `"@nestjs/schedule": "^6.0.1"` PRÉSENTE dans `apps/api/package.json`.
- **Imports `ScheduleModule`** dans `apps/api/src/**` : **AUCUN** (`grep -rn "ScheduleModule" apps/api/src/` → 0 résultat).
- **Décorateurs `@Cron` / `@Interval` / `@Timeout`** : **AUCUN** dans `apps/api/src/**`.
- **`ScheduleModule.forRoot()` dans `app.module.ts`** : **ABSENT**.

**Conclusion** : package installé mais jamais initialisé ni utilisé. Wave 1.C = ajouter `ScheduleModule.forRoot()` à `app.module.ts` + déclarer le job. Aucune cohabitation à gérer.

---

## 5. i18n — namespace `admin.reports.analytics`

### Structure

- Fichiers : `apps/web/messages/{en,fr}/admin.json`. Le namespace `admin.reports.analytics` correspond au chemin JSON `reports → analytics` (le préfixe `admin` = nom du fichier).
- Bloc `analytics` ouvert à la ligne `:223` dans EN et FR.
- 41 clés présentes, EN et FR symétriques (mêmes clés des deux côtés).

### Clés présentes (extrait)

`projectProgression`, `seeAllProjects`, `collaboratorWorkload`, `tasks`, `average`, `overloadDetected`, `seeAllCollaborators`, `projectHealth`, `remainingTasks`, `overdueTasks`, `upcomingMilestones`, `endDate`, `projectManager`, `noMilestone`, `progressTrend`, `globalAverage`, `byProject`, `stagnationDetected`, `historyBuilding`, `milestoneCompletion`, `milestonesOnTime`, `noMilestoneDefined`, `onTime`, `late`, `upcoming`, `priorityDistribution`, `activeTasks`, `critical`, `high`, `normal`, `low`, `recentActivity`, `completed`, `created`, `becameOverdue`, `completionRatio`, `backlogGrowing`, `backlogShrinking`, `noData`, `progress`, `project`, `status`.

### Clés citées dans le code mais ABSENTES — **12 clés** (pas 5 comme estimé dans le spec)

| Clé manquante | Référence code | Manque dans |
|---|---|---|
| `todo` | `PriorityDistributionChart.tsx:134` | EN + FR |
| `inProgress` | `PriorityDistributionChart.tsx:135` | EN + FR |
| `inReview` | `PriorityDistributionChart.tsx:136` | EN + FR |
| `blocked` | `PriorityDistributionChart.tsx:137` | EN + FR |
| `filteredBy` | `PriorityDistributionChart.tsx:243` | EN + FR |
| `clearFilter` | `PriorityDistributionChart.tsx:249` | EN + FR |
| `completedLast7Days` | `RecentActivityCards.tsx:241` | EN + FR |
| `completedTooltip` | `RecentActivityCards.tsx:171` | EN + FR |
| `createdTooltip` | `RecentActivityCards.tsx:187` | EN + FR |
| `overdueTooltip` | `RecentActivityCards.tsx:203` | EN + FR |
| `ratioTooltip` | `RecentActivityCards.tsx:222` | EN + FR |
| `showLess` | `ProjectProgressionChart.tsx:206` | EN + FR |

Note : `todo`, `inProgress`, `blocked` existent dans d'autres namespaces (`common`, `projects`, `tasks`) mais **pas dans `admin.reports.analytics`** — d'où la fuite UI.

---

## 6. Relations data User ↔ Task

### Coexistence des deux relations

- **`Task.assigneeId String?`** (`schema.prisma:271`) — FK nullable vers `users.id`, onDelete SetNull. Commentaire : « Assigné principal (rétrocompatibilité) ». Inverse : `User.tasks Task[]` (`schema.prisma:43`).
- **`TaskAssignee`** (`schema.prisma:303-317`) — table de liaison N-M, PK `id`, contrainte `@@unique([taskId, userId])`, indexes `[taskId]` et `[userId]`. Inverse : `User.taskAssignments TaskAssignee[]` (`schema.prisma:44`).

### Écriture (création / update)

- **`tasks.service.ts:209-272`** (création) : les deux sont écrites simultanément. `assigneeId = primaryAssigneeId` (l.215) + `assignees: { create: assigneeIds.map(...) }` (l.222-226).
- **`tasks.service.ts:680-743`** (update) : transaction `tx.taskAssignee.deleteMany` puis `createMany` (l.685-692) + mise à jour `assigneeId` (l.703-705).
- **`tasks.service.ts:1317-1330`** (import CSV en masse) : seulement `assigneeId` (l.1324). `TaskAssignee` n'est pas peuplée à l'import. **Asymétrie à noter.**

### Lecture (find*)

Toutes les méthodes `include` les deux relations (`tasks.service.ts:347-388, 407-529, 1011-1056, 1115-1173`). Le filtre RBAC (`tasks.service.ts:306-308`) et `getTasksByAssignee` (l.1012-1013) utilisent **explicitement l'union** :

```ts
where.OR = [
  { assigneeId: currentUser.id },
  { assignees: { some: { userId: currentUser.id } } },
];
```

### Verdict

Pour calculer **« tâches actives par user »** (bloc 3 — répartition de charge), la source canonique est l'**UNION** `Task.assigneeId ∪ TaskAssignee.userId`. Toute requête qui n'interroge que l'une des deux sous-comptera (et ratera les imports CSV pour `TaskAssignee` seul).

---

## 7. Couverture tests — tab Analytics

### Backend (Vitest, `*.spec.ts`)

| Fichier | Tests | Périmètre |
|---|---|---|
| `apps/api/src/analytics/analytics.controller.spec.ts` | 3 | Délégation pure aux 2 méthodes service (mock) |
| `apps/api/src/analytics/analytics.service.spec.ts` | 28 | Calcul métriques par dateRange (WEEK/MONTH/QUARTER/YEAR), filtre projectId, progression par heures, retards, intégration timeEntries, taux complétion, cas limites |
| `apps/api/src/projects/projects.controller.spec.ts` | — | **0 test snapshot** (`POST /projects/snapshots/capture`, `GET /projects/:id/snapshots`) |
| `apps/api/src/projects/projects.service.spec.ts` | — | **0 test snapshot** |

### Frontend (Jest)

- `apps/web/src/services/__tests__/export.service.test.ts` : 4 tests sur `ExportService.exportToExcel()` (PDF skippé). Pas un test du tab.
- **0 test** pour les 7 composants du tab analytics (recherche exhaustive par nom de composant et chemin `apps/web/app/[locale]/reports/`).

### E2E Playwright

| Fichier | Couverture |
|---|---|
| `e2e/permissions.spec.ts:20` | `/reports` listé dans routes RBAC admin (accès, pas contenu) |
| `e2e/tests/multi-role/leave-lifecycle.spec.ts:189-193` | ADMIN navigue `/reports` (test accès) |
| `e2e/tests/rbac/sidebar.spec.ts` | Item sidebar "reports" visible selon rôle |
| `e2e/fixtures/permission-matrix.ts:359-374` | Déclare `reports:view → /api/analytics` et `reports:export → /api/analytics/export` |

**0 test E2E fonctionnel** sur le tab "Analytics Avancés" (pas de rendu graphique vérifié, pas de sélecteur date, pas de drill-down).

### Verdict couverture

- Backend `/analytics/*` : 2/2 endpoints couverts (mais service uniquement, pas E2E).
- Backend snapshots (utilisés par le tab) : **0/2** endpoints testés.
- Frontend composants tab : **0/7** testés.
- E2E fonctionnel : **0**.
- **Couverture globale : minimale.**

---

## 8. Synthèse — Pivots à arbitrer AVANT Wave 1

L'audit révèle **6 décisions structurantes** que la spec V1 n'avait pas pu prendre. Aucune ne bloque la refonte, mais chacune change la nature de Wave 1, 2 ou 3. Demande de ratification explicite.

### D1. Migration `ProjectSnapshot` — ALTER, pas CREATE

Le modèle existe avec une shape réduite (`progress`, `date`, `tasksDone`, `tasksTotal`). 7 champs et 2 indexes manquent par rapport à la spec §4.

**Options** :
- **D1.a** — Migration ALTER additive : renommage `progress → progressPct`, `date → capturedAt`, ajout des 5 colonnes manquantes (`tasksInProgress`, `tasksBlocked`, `milestonesReached/Overdue/Upcoming`), ajout des 2 indexes. Conserver la table existante et ses données potentielles.
- **D1.b** — Drop & recreate : abandonner les snapshots existants (vraisemblablement vides — à confirmer en DB), créer la table conforme à la spec.

Recommandation : **D1.a**. Plus prudent (cf. mémoire `feedback_verify_before_destructive_prod_changes`).

### D2. Cohabitation avec les 2 endpoints `/analytics` existants

`GET /analytics` et `GET /analytics/export` existent déjà, sont consommés par le tab "Vue d'ensemble" (hors scope V1) et le bouton export. La spec V1 ajoute 6 nouveaux endpoints dans le même module.

**Options** :
- **D2.a** — Ajouter les 6 nouveaux à côté des 2 existants. Coexistence dans `analytics.controller.ts`. Risque de confusion sur le rôle du module.
- **D2.b** — Renommer les 2 existants en `/analytics/overview` et `/analytics/export-overview`, exposer les 6 nouveaux à plat. Cohérence du namespace, mais casse les consommateurs du tab "Vue d'ensemble".
- **D2.c** — Créer un sous-module `apps/api/src/analytics/advanced/` ou un module séparé `apps/api/src/analytics-advanced/`. Isolation propre, pas de casse.

Recommandation : **D2.c** (sous-module). Cohérent avec la persona senior — pas de casse, séparation claire des responsabilités.

### D3. Permissions des nouveaux endpoints

Les 2 endpoints existants utilisent `reports:view` / `reports:export` (système RBAC dynamique via `PermissionsGuardV2`). La spec V1 §6 parle de « hypothèse RBAC à confirmer ».

**Options** :
- **D3.a** — Réutiliser `reports:view` pour les 6 nouveaux endpoints (cohérent avec l'existant).
- **D3.b** — Créer 6 permissions granulaires (`analytics:snapshots`, `analytics:workload`, `analytics:project-health`, etc.) — granularité fine mais explosion du nombre de permissions à gérer.
- **D3.c** — Une nouvelle permission `analytics:advanced` qui couvre les 6.

Recommandation : **D3.a**. YAGNI strict (`feedback_no_overdesign`), cohérence avec l'existant.

### D4. Stratégie « tâches actives par user » pour bloc 3

Spec §1 (décision ratifiée) : « compteur de tâches actives par utilisateur, statuts actifs = TODO + IN_PROGRESS + IN_REVIEW + BLOCKED ». Mais §6 de l'audit montre que la vérité métier actuelle est **UNION** `assigneeId ∪ TaskAssignee`.

**Options** :
- **D4.a** — Implémenter l'UNION (cohérent avec le filtre RBAC existant). Une tâche avec `assigneeId=A` + `TaskAssignee=[B, C]` compte 1 chez A, 1 chez B, 1 chez C.
- **D4.b** — N'utiliser que `TaskAssignee` (modèle "futur"), ignorer `assigneeId`. Mais : casse les imports CSV qui ne peuplent que `assigneeId`.
- **D4.c** — N'utiliser que `assigneeId` (modèle "rétrocompat"), ignorer co-assignés. Sous-comptage.

Recommandation : **D4.a** (UNION). Conforme à la sémantique métier déjà en place.

### D5. Nettoyage du service `analyticsService` non utilisé + adoption TanStack Query

État actuel : `analyticsService` est défini mais aucun composant du tab ne l'utilise — tous tapent `api.get()` direct. Aucun `useQuery` dans le tab. Anti-pattern flagrant (cf. mémoire `feedback_senior_engineer_persona`, point 7 + anti-patterns).

**Options** :
- **D5.a** — Wave 3 : refonte du `analyticsService` (6 méthodes typées, conservation de `getProjectSnapshots`, ajout des 6 nouvelles), ET migration des composants vers `useQuery` TanStack Query (déjà dépendance projet). Gain : cache, retry, loading states standardisés.
- **D5.b** — Conserver le pattern actuel (`useState/useEffect/api.get`) pour minimiser le scope de la refonte.

Recommandation : **D5.a**. Non négociable selon la persona senior — l'occasion ne se représentera pas, et le code mort actuel est une dette.

### D6. Composant tab dédié vs render inline

État actuel : tab rendu inline dans `page.tsx:377-414` (38 lignes inline). Spec §7 W3.D parle de « page tab `analytics-avances` ». Page actuelle = 426 lignes avec 3 tabs cohabitant.

**Options** :
- **D6.a** — Extraire un composant `AdvancedAnalyticsTab.tsx` dans `components/`. Page se contente d'orchestrer les 3 tabs.
- **D6.b** — Conserver l'inline.

Recommandation : **D6.a**. Cohérent avec la séparation des responsabilités (persona senior, point 2) et facilite les tests Wave 4.

---

## 9. Points additionnels d'attention (non bloquants)

- **Bloc 4 « Project health table »** (nouveau dans spec §3) : `ProjectsDetailTable.tsx` existe déjà (507 lignes). À évaluer comme base de départ ou à supprimer en Wave 3.A.
- **Bloc 7 « Activité récente »** : la spec demande une courbe 30j ; le composant actuel `RecentActivityCards.tsx` génère une sparkline 7j (l.110-124) — refonte ciblée à prévoir dans le bloc.
- **Suppression « ancien service analytics front »** (spec W3.A) : ambiguë puisque `analyticsService` n'est PAS l'ancien service du tab. Préciser : on parle du *pattern* `api.get()` direct dans les composants, à remplacer par le service typé.
- **Endpoint `/analytics/snapshots`** (spec §6) : à câbler sur l'endpoint existant `GET /projects/:id/snapshots` (l.159 du controller projects) pour éviter de dupliquer la logique de fetch snapshots — sauf si la spec veut explicitement un endpoint d'agrégation multi-projets en une requête (préférable pour le bloc 1 qui charge N projets).
- **Tests existants** `analytics.service.spec.ts` (28 tests) : à NE PAS jeter — ils couvrent la logique de calcul du tab "Vue d'ensemble" qui reste hors scope.
- **Rétention `ProjectSnapshot`** : spec §5 flag « point de vigilance futur ». À noter dans le backlog.

---

## 10. Statut

✅ Audit complet, 7 sections du spec §2 couvertes avec sources `fichier:ligne`.
🛑 **STOP** — attente des arbitrages D1 → D6 (§8) avant déclenchement Wave 1.

Aucune autre action prévue. Pas de modification de fichier hors ce document.
