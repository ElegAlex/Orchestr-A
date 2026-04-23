# Composant Gantt unifie

Diagramme de Gantt generique utilise dans deux contextes :

- **Portfolio** (`scope: 'portfolio'`) : vue macro de tous les projets d'une collectivite, barres colorees par sante (RAG).
- **Projet** (`scope: 'project'`) : vue detaillee des taches d'un projet, avec jalons (losanges), dependances (fleches SVG) et groupement par jalon/epopee.

Le composant gere en interne la navigation temporelle, le zoom (4 niveaux), le groupement et le calcul pixel/date.

---

## Installation / Import

```tsx
import { Gantt } from "@/components/gantt";
import type {
  GanttProps,
  GanttPortfolioRow,
  GanttTaskRow,
  GanttDependency,
  GanttView,
  GanttGrouping,
  GanttGroup,
  HealthStatus,
} from "@/components/gantt";
```

Tout est reexporte depuis `index.ts`. Ne pas importer les sous-composants internes directement.

---

## API publique

`GanttProps` est une **union discriminee** sur le champ `scope`.

### Scope `portfolio`

| Prop         | Type                               | Requis | Description                                   |
| ------------ | ---------------------------------- | ------ | --------------------------------------------- |
| `scope`      | `'portfolio'`                      | oui    | Discriminant                                  |
| `rows`       | `GanttPortfolioRow[]`              | oui    | Lignes projets                                |
| `view`       | `GanttView`                        | oui    | Vue initiale (`day` `week` `month` `quarter`) |
| `onRowClick` | `(row: GanttPortfolioRow) => void` | non    | Clic sur une ligne                            |

### Scope `project`

| Prop               | Type                          | Requis | Description                                  |
| ------------------ | ----------------------------- | ------ | -------------------------------------------- |
| `scope`            | `'project'`                   | oui    | Discriminant                                 |
| `rows`             | `GanttTaskRow[]`              | oui    | Taches du projet                             |
| `view`             | `GanttView`                   | oui    | Vue initiale                                 |
| `dependencies`     | `GanttDependency[]`           | non    | Liens Finish-to-Start entre taches           |
| `groupBy`          | `GanttGrouping`               | non    | `'milestone'` (defaut) / `'epic'` / `'none'` |
| `onRowClick`       | `(row: GanttTaskRow) => void` | non    | Clic sur une ligne                           |
| `onRowDoubleClick` | `(row: GanttTaskRow) => void` | non    | Double-clic sur une ligne                    |

---

## Exemples

### Portfolio — minimal

```tsx
const rows: GanttPortfolioRow[] = [
  {
    id: "p1",
    name: "Refonte portail",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-06-30"),
    progress: 45,
    status: "active",
    health: "on-track",
  },
];

<Gantt scope="portfolio" rows={rows} view="month" />;
```

### Projet — avec dependances et groupement

```tsx
const tasks: GanttTaskRow[] = [
  {
    id: "t1",
    name: "Cahier des charges",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-15"),
    progress: 100,
    status: TaskStatus.DONE,
    milestoneId: "m1",
    milestoneName: "Conception",
    isMilestone: false,
  },
  {
    id: "t2",
    name: "Validation",
    startDate: new Date("2026-01-15"),
    endDate: new Date("2026-01-15"),
    progress: 0,
    status: TaskStatus.TODO,
    milestoneId: "m1",
    milestoneName: "Conception",
    isMilestone: true,
  },
];

const deps: GanttDependency[] = [{ fromId: "t1", toId: "t2" }];

<Gantt
  scope="project"
  rows={tasks}
  view="week"
  dependencies={deps}
  groupBy="milestone"
  onRowClick={(row) => console.log(row.id)}
/>;
```

Page de dev complete : `app/[locale]/_dev/gantt-base/page.tsx`.

---

## Types — reference rapide

| Type                | Fichier                | Description                                                          |
| ------------------- | ---------------------- | -------------------------------------------------------------------- |
| `GanttView`         | `types.ts`             | `'day' \| 'week' \| 'month' \| 'quarter'`                            |
| `GanttGrouping`     | `types.ts`             | `'milestone' \| 'epic' \| 'none'`                                    |
| `HealthStatus`      | `types.ts`             | `'on-track' \| 'at-risk' \| 'late' \| 'upcoming' \| 'done'`          |
| `GanttPortfolioRow` | `types.ts`             | Ligne portfolio (id, name, dates, progress, health, ...)             |
| `GanttTaskRow`      | `types.ts`             | Ligne tache (id, name, dates, status, milestoneId, isMilestone, ...) |
| `GanttDependency`   | `types.ts`             | `{ fromId: string; toId: string }` (Finish-to-Start)                 |
| `GanttGroup`        | `types.ts`             | Groupe de taches (key, label, rows, isExpanded)                      |
| `TimelineBucket`    | `timeline-math.ts`     | Colonne de la grille (label, start, end, widthFraction)              |
| `ClassifiableRow`   | `status-classifier.ts` | Interface pour `classify()` (startDate, endDate, progress)           |

---

## Design tokens

Tous les tokens sont dans `tokens.ts` — constantes TS (pas CSS).

### Couleurs

| Token                       | Usage                               |
| --------------------------- | ----------------------------------- |
| `HEALTH_COLORS`             | Barres portfolio par `HealthStatus` |
| `TASK_STATUS_COLORS`        | Barres taches par `TaskStatus`      |
| `TASK_STATUS_DEFAULT_COLOR` | Fallback statut inconnu             |
| `MILESTONE_STATUS_COLORS`   | Couleurs jalons                     |
| `ARROW_COLOR`               | Fleches de dependance (`#6b7280`)   |
| `TODAY_LINE_COLOR`          | Ligne "aujourd'hui" (`#ef4444`)     |

### Dimensions (px)

| Token                  | Valeur |
| ---------------------- | ------ |
| `LEFT_COLUMN_WIDTH`    | 256    |
| `BAR_HEIGHT`           | 32     |
| `PROJECT_ROW_HEIGHT`   | 50     |
| `TASK_ROW_HEIGHT`      | 40     |
| `MILESTONE_ROW_HEIGHT` | 36     |
| `GROUP_HEADER_HEIGHT`  | 32     |

### Surcharge

Les tokens sont des `const` TS. Pour modifier les valeurs, editer `tokens.ts` directement. Il n'y a pas de systeme de theming dynamique — c'est volontaire pour la performance.

---

## Sous-composants internes

Ces composants ne font pas partie de l'API publique. Ils sont consommes par `GanttBase`.

| Composant              | Role                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `GanttHeader`          | Barre d'outils (navigation, zoom, vue, groupBy) + en-tetes de colonnes |
| `GanttBar`             | Barre de progression ou losange jalon                                  |
| `GanttGroupHeader`     | En-tete de groupe (expand/collapse)                                    |
| `GanttDependencyLayer` | Couche SVG des fleches de dependance                                   |
| `GanttTodayLine`       | Ligne verticale rouge "aujourd'hui"                                    |
| `GanttLegend`          | Legende des couleurs (adaptee au scope)                                |
| `GanttEmptyState`      | Etat vide quand `rows.length === 0`                                    |
| `GanttRow`             | (reserve, pas utilise actuellement)                                    |

---

## Ajout d'un nouveau scope

1. Ajouter le nouveau type de ligne dans `types.ts` (ex. `GanttBudgetRow`).
2. Etendre l'union `GanttProps` avec un nouveau membre discrimine (`scope: 'budget'`).
3. Exporter le nouveau type depuis `index.ts`.
4. Dans `GanttBase.tsx` : ajouter les branches de rendu (`renderLeftColumn`, `renderTimelineRows`) pour le nouveau scope.
5. Dans `tokens.ts` : ajouter les couleurs/dimensions specifiques si necessaire.
6. Ajouter un exemple dans la page de dev `/_dev/gantt-base/page.tsx`.
7. Ecrire les tests E2E correspondants.

---

## Ajout d'une nouvelle vue

1. Ajouter la valeur a `GanttView` dans `types.ts` (ex. `'year'`).
2. Dans `timeline-math.ts` :
   - Ajouter l'entree dans `DEFAULT_PIXELS`.
   - Implementer `dateToFractionalUnits` et `fractionalUnitsToDate` pour la nouvelle granularite.
   - Ajouter une fonction `yearBuckets` et l'appeler dans `bucketsForRange`.
3. Dans `GanttBase.tsx` : ajouter le cas dans `getVisibleRange` et `navigateTime`.
4. Mettre a jour `VIEW_ORDER` dans `GanttBase.tsx`.
5. Tests unitaires dans `timeline-math.spec.ts` (buckets, dateToX, xToDate).

---

## Ajout d'une cle de groupement

1. Ajouter la valeur a `GanttGrouping` dans `types.ts` (ex. `'assignee'`).
2. Ajouter les champs optionnels correspondants dans `GanttTaskRow` (ex. `assigneeId`, `assigneeName`).
3. Dans `grouping.ts` : etendre les mappings `idField` / `nameField` / `ungroupedLabel` dans `groupTasks`.
4. Mettre a jour `GanttHeader` pour afficher l'option dans le selecteur de groupement.
5. Tests unitaires dans `grouping.spec.ts`.

---

## Tests

```bash
# Tests unitaires des utilitaires
pnpm vitest run src/components/gantt/timeline-math
pnpm vitest run src/components/gantt/status-classifier
pnpm vitest run src/components/gantt/grouping

# Tests E2E
pnpm run test:e2e -- gantt-portfolio.spec.ts
pnpm run test:e2e -- gantt-project.spec.ts

# Verification types
npx tsc --noEmit
```

### Couverture

- `timeline-math.ts` : conversions date/pixel, generation de buckets pour chaque vue.
- `status-classifier.ts` : classification sante (on-track, at-risk, late, upcoming, done).
- `grouping.ts` : groupement par jalon, epopee, aucun ; tri par startDate.
- E2E : rendu portfolio, rendu projet avec dependances, navigation, zoom, groupement.

### Ajouter un test

Les utilitaires purs (`timeline-math`, `status-classifier`, `grouping`) se testent avec Vitest (`*.spec.ts`). Les tests de rendu et interaction passent par Playwright E2E.

---

## Checklist avant modification

- [ ] Types a jour dans `types.ts`
- [ ] Tokens a jour dans `tokens.ts`
- [ ] Tests unitaires `timeline-math`, `status-classifier`, `grouping` verts
- [ ] Page de dev `/_dev/gantt-base` testee visuellement
- [ ] E2E `gantt-portfolio.spec.ts` et `gantt-project.spec.ts` verts
- [ ] `npx tsc --noEmit` sans erreur
