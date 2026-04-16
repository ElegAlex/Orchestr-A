# Audit Gantt — Phase 0

**Projet** : Orchestr'A V2 — Gantt unifié Portfolio ↔ Projet interne
**Date** : 2026-04-16
**Statut** : Phase 0 complète — en attente de ratification pour Vague 1.

---

## 4.1. Portfolio Gantt actuel

### Chemins

| Rôle | Chemin |
|---|---|
| Composant principal | `apps/web/app/[locale]/reports/components/PortfolioGantt.tsx` (903 lignes) |
| Page hôte | `apps/web/app/[locale]/reports/page.tsx` (onglet index 2, ligne 398) |
| Service d'export | `apps/web/src/services/export.service.ts` (lignes 621-722) |
| CSS custom (non utilisé par Portfolio) | `apps/web/src/gantt-custom.css` |
| i18n FR | `apps/web/messages/fr/admin.json` |
| i18n EN | `apps/web/messages/en/admin.json` (lignes 267-306) |

Le Portfolio Gantt est un composant **100% custom** (divs + Tailwind + inline styles). Il n'utilise **pas** `@rsagiev/gantt-task-react-19`.

### Sous-composants (tous inline dans PortfolioGantt.tsx)

Le fichier est **monolithique** — aucun sous-composant extrait. Tout est rendu inline :

- **Timeline Header** (lignes 607-639) : sticky `div`, colonnes temporelles avec `col.label` / `col.sublabel`, ligne "Aujourd'hui" en pointillé rouge.
- **Project Row / Left Cell** (lignes 659-688) : cellule fixe `w-64` avec triangle expand/collapse (Unicode), `<ProjectIcon>`, nom du projet, badge statut + pourcentage.
- **Bar** (lignes 703-734) : barre extérieure `rounded-full h-8` (couleur RAG à 20% opacité), barre intérieure = progression. Click → navigation vers `/projects/[id]`.
- **Milestone Sub-rows** (lignes 750-807) : affichées quand un projet est déplié. Marqueur diamant `&#9670;` positionné à la date d'échéance.
- **Tooltip** (lignes 819-882) : `div` position fixe, z-50, déclenchement par `onMouseMove` avec debounce 300ms.
- **Legend / Filter Chips** (lignes 562-601, 884-898) : 5 pastilles colorées + labels, toggle-ables, avec compteurs.

### Fonction de classification santé (RAG)

**Emplacement** : `PortfolioGantt.tsx`, lignes 87-106.

```typescript
const getRagStatus = (project: Project): RagStatus => {
  const status = project.status.toLowerCase();
  if (status === 'completed' || status === 'cancelled') return 'completed';

  const now = new Date();
  const start = new Date(project.startDate);
  if (start > now) return 'upcoming';

  const end = project.dueDate ? new Date(project.dueDate) : new Date();
  const totalDuration = end.getTime() - start.getTime();
  if (totalDuration <= 0) return 'onTrack';

  const elapsed = now.getTime() - start.getTime();
  const timeElapsedPct = Math.min((elapsed / totalDuration) * 100, 100);
  const progress = project.progress;

  if (progress >= timeElapsedPct - 10) return 'onTrack';
  if (progress >= timeElapsedPct - 25) return 'atRisk';
  return 'late';
};
```

| Statut | Condition |
|---|---|
| **Completed** | `project.status` = completed ou cancelled |
| **Upcoming** | `startDate` dans le futur |
| **On Track** | `totalDuration <= 0` OU `progress >= timeElapsedPct - 10` |
| **At Risk** | `progress >= timeElapsedPct - 25` (retard 10-25 pp) |
| **Late** | `progress < timeElapsedPct - 25` (retard > 25 pp) |

⚠️ **Cas limite** : si `dueDate` est null, `end = new Date()`, donc `timeElapsedPct = 100%`. Un projet sans date de fin et < 75% de progression sera classé **Late**.

### Export PDF

**Librairies** : `jsPDF` (client) + `html-to-image` (`toPng`) pour rasteriser le DOM.

**Méthode** : `ExportService.exportGanttPortfolioToPDF(ganttElement, dateRange)` (`export.service.ts`, lignes 621-722).

**Processus** (100% client) :
1. Crée un document `jsPDF` paysage A4.
2. Supprime temporairement `overflow` sur le conteneur.
3. `toPng(ganttElement, { pixelRatio: 2, backgroundColor: '#ffffff' })`.
4. Scale l'image pour tenir dans la page.
5. `doc.addImage()` + footer avec timestamp.
6. `doc.save(filename)`.

**Invocation** dans `page.tsx` (lignes 107-113) via `ganttRef` passé au composant (forwardRef).

### Tokens / CSS

**Pas de CSS custom properties ni design tokens.** Tout est en Tailwind + inline styles hardcodés.

**Couleurs RAG** (lignes 108-114) :
```typescript
const RAG_COLORS = {
  onTrack:   '#22c55e',  // green-500
  atRisk:    '#f59e0b',  // amber-500
  late:      '#ef4444',  // red-500
  upcoming:  '#60a5fa',  // blue-400
  completed: '#9ca3af',  // gray-400
};
```

**Couleurs Milestones** (lignes 128-133) :
```typescript
const MILESTONE_COLORS = {
  PENDING:     '#9ca3af',  // gray-400
  IN_PROGRESS: '#60a5fa',  // blue-400
  COMPLETED:   '#22c55e',  // green-500
  DELAYED:     '#ef4444',  // red-500
};
```

**Dimensions clés** : left column `w-64` (256px), bar `h-8` (32px), project row `min-h-[50px]`, milestone row `min-h-[36px]`.

**Typographie** : project name `text-sm font-semibold`, bar label `text-xs font-semibold text-white`, header `text-xs font-semibold`.

### Zoom et navigation

**Échelles** : `"day"` | `"week"` | `"month"` — défaut `"month"`.

| Échelle | Fenêtre visible | Pas de navigation |
|---|---|---|
| Day | ±15 jours (31j) | 30 jours |
| Week | ±15 semaines (~7 mois) | 7 semaines |
| Month | -6 / +5 mois (12 mois) | 12 mois |

Zoom in : month → week → day. Zoom out : day → week → month. Boutons désactivés aux extrêmes.

UI : sélecteur `<select>`, boutons ←/→, bouton "Aujourd'hui", boutons zoom +/−.

---

## 4.2. Gantt projet interne actuel

### Chemin

| Rôle | Chemin |
|---|---|
| Composant Gantt | `apps/web/src/components/GanttChart.tsx` |
| Page hôte | `apps/web/app/[locale]/projects/[id]/page.tsx` (import dynamique, ligne 44, `ssr: false`) |
| CSS custom | `apps/web/src/gantt-custom.css` |

### Props passées à `<Gantt>` de la lib

```tsx
<Gantt
  tasks={ganttTasks}
  viewMode={viewMode}
  locale="fr"
  listCellWidth="250px"
  columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 65}
  arrowColor="#6b7280"
  arrowIndent={20}
  onClick={handleTaskClick}
  onDoubleClick={handleTaskDoubleClick}
/>
```

**8 props sur ~30+ disponibles.** Props NON passées : `onDateChange`, `onProgressChange`, `onDelete`, `onSelect`, `onExpanderClick`, `TooltipContent`, `TaskListHeader`, `TaskListTable`.

### Transformation des données

`useEffect` lignes 120-215 de `GanttChart.tsx` :

1. **Groupement par jalon** : tasks buckétées dans `Map<string, GanttTask[]>` par `milestoneId`. Tâches sans jalon → tableau séparé.
2. **Conversion tâche** (`convertTask()`, lignes 143-171) :
   - ID : `"task-${task.id}"`
   - Start/End : parsé depuis ISO, défauts = `projectStartDate` / start + 7j
   - Type : toujours `"task"`
   - Dépendances : `task.dependencies[].dependsOnTaskId` → `"task-${id}"`
   - Couleurs par statut : bleu (défaut), vert (DONE), amber (IN_PROGRESS), rouge (BLOCKED)
3. **Conversion jalons** (lignes 174-206) :
   - ID : `"milestone-${id}"`
   - Type : `"milestone"` (diamant)
   - Dépendances : tous les IDs de tâches enfants
4. **Ordre** : jalons en premier (suivis de leurs tâches), puis tâches orphelines en fin.

### Fonctionnalités effectivement utilisées

| Fonctionnalité | Statut |
|---|---|
| **Dépendances (flèches)** | ✅ Actif — `arrowColor="#6b7280"`, CSS hover dans `gantt-custom.css` |
| **Drag-resize** | ❌ **ZOMBIE** — les handles de drag s'affichent mais `onDateChange`/`onProgressChange` ne sont pas passés → tout drag est annulé |
| **Tooltip** | ⚠️ Défaut lib uniquement — pas de `TooltipContent` custom |
| **Click** | ✅ Actif — ouvre popover `TaskDependencyInfo` (timeout 250ms pour distinguer du double-click) |
| **Double-click** | ✅ Actif — ouvre modale `TaskDependencyModal` (édition dépendances) |
| **Export PDF** | ✅ Actif — externe à la lib (voir ci-dessous) |

### Export PDF côté projet

Implémenté dans `apps/web/app/[locale]/projects/[id]/page.tsx`, lignes 407-493.

**Mécanisme** :
1. Container wrappé dans `<div id="gantt-container">`.
2. Import dynamique de `html-to-image` + `jspdf`.
3. Suppression temporaire `overflow`, capture `toPng()` à 2x.
4. PDF A4 portrait, support multi-pages (slicing via canvas temporaire).
5. Sauvegarde : `gantt-{project-name}.pdf`.

⚠️ **Bug mineur** : `locale="fr"` est hardcodé (ligne 273) au lieu d'utiliser le locale Next-intl disponible ligne 49.

### Vues (Day / Week / Month)

State local `useState<ViewMode>(ViewMode.Day)`. Trois boutons pour basculer. `columnWidth` adaptatif (65/250/300 px). Pas de persistance (reset à Day à chaque montage).

---

## 4.3. Données et services

### Types TypeScript

Tous dans `apps/web/src/types/index.ts` :

| Type | Lignes | Champs clés pour le Gantt |
|---|---|---|
| `Task` | 380-410 | `id`, `title`, `status: TaskStatus`, `progress`, `startDate?`, `endDate?`, `epicId?`, `milestoneId?`, `dependencies?: TaskDependency[]`, `epic?: Epic`, `milestone?: Milestone` |
| `Project` | 221-260 | `id`, `name`, `status`, `progress`, `startDate?`, `endDate?`, `epics?: Epic[]`, `milestones?: Milestone[]`, `tasks?: Task[]` |
| `TaskDependency` | 361-370 | `id?`, `dependsOnTaskId`, `dependsOnTask?: { id, title, status, endDate? }` |
| `Milestone` | 345-355 | `id`, `name`, `projectId`, `dueDate`, `status: MilestoneStatus`, `tasks?: Task[]` |
| `Epic` | 332-343 | `id`, `name`, `projectId`, `progress`, `startDate?`, `endDate?`, `tasks?: Task[]` |

⚠️ `packages/types/index.ts` ne contient que des enums (`Role`, `TaskStatus`) et types RBAC — les types métier sont exclusivement dans `apps/web/src/types/`.

⚠️ Le Portfolio Gantt utilise une interface `Project` **locale** (PortfolioGantt.tsx lignes 23-35) différente du type partagé — notamment `dueDate` au lieu de `endDate`, plus `code`/`managerDepartment`/`priority` qui viennent de la shape `ProjectDetail` de l'analytics.

### Endpoints consommés

**Gantt Projet** :
1. `GET /projects/:id` → détails projet
2. `GET /projects/:id/stats` → stats
3. `GET /tasks/project/:projectId` → toutes les tâches du projet
4. `GET /milestones?limit=1000` → **tous les jalons** (toutes projets confondus), filtrage client-side par `projectId`

**Gantt Portfolio** :
1. `GET /analytics?dateRange=...` → `AnalyticsData` incluant `projectDetails[]`
2. `GET /projects` → pour le filtre dropdown
3. `GET /milestones?projectId=...&limit=100` → à la demande quand un projet est déplié

### Format des dépendances

**Finish-to-Start (FS) uniquement.** Pas de champ `type`/`linkType`/`dependencyType` dans le schéma Prisma ni dans les types TS. La sémantique est implicite : `taskId` dépend de `dependsOnTaskId` qui doit être terminée d'abord.

Confirmation dans `apps/web/src/utils/dependencyValidation.ts` : vérifie `currentTask.startDate <= dependency.endDate` — logique FS pure.

---

## 4.4. Dépendance `@rsagiev/gantt-task-react-19`

### Fichiers qui importent la lib

**1 seul composant** consomme la lib en runtime : `GanttChart.tsx`.

| Fichier | Nature |
|---|---|
| `apps/web/package.json` | Déclaration de dépendance |
| `apps/web/src/components/GanttChart.tsx` | Import runtime (`Gantt`, `Task`, `ViewMode` + CSS) |
| `apps/web/src/gantt-custom.css` | Overrides CSS (importé par GanttChart) |

Documentation mentionnant la lib : `KNOWLEDGE-BASE.md`, `STACK-TECHNIQUE.md`, `GETTING-STARTED.md`, `CHANGELOG.md`.

### Version

- **Déclarée** : `"^0.3.9"` dans `apps/web/package.json`
- **Résolue** : `0.3.9` dans `pnpm-lock.yaml`

### Statut maintenance

**⚠️ Préoccupant.** Unique version publiée le 2024-12-15. Fork de `gantt-task-react` par MaTeMaTuK pour compatibilité React 19. Auteur fork : rsagiev. Aucune mise à jour depuis 16 mois. Pas de maintenance active.

### Taille bundle

- Taille non-packée (npm) : ~617 KB
- Sur disque : ~748 KB (dist + source maps + types)
- Modeste pour un composant chart.

---

## 4.5. Tests existants

### Tests unitaires touchant le Gantt

**Zéro.** Aucun fichier `.test.ts(x)` ou `.spec.ts(x)` ne mentionne "gantt" (insensible à la casse). Les 34 fichiers de test web ne couvrent ni `GanttChart.tsx` ni `PortfolioGantt.tsx`.

### Tests E2E Playwright

**Aucun test E2E n'exerce les Gantt.** Les tests existants touchant `/reports` ne testent que le RBAC :

| Fichier | Ce qu'il teste |
|---|---|
| `e2e/tests/rbac/ui-permissions.spec.ts` | MANAGER accès `/reports`, CONTRIBUTEUR refusé |
| `e2e/tests/multi-role/leave-lifecycle.spec.ts` | ADMIN voit données congés sur `/reports` |
| `e2e/permissions.spec.ts` | Smoke test accessibilité routes incluant `/reports` |

Aucun test E2E pour le Gantt de `/projects/[id]`.

---

## 4.6. Données jalons/épopées (spécifique D4)

### Relation Jalon-Tâche

**FK directe sur Task.** Schéma Prisma (`schema.prisma`, ligne 284) :

```prisma
milestoneId  String?
milestone    Milestone?  @relation(fields: [milestoneId], references: [id], onDelete: SetNull)
```

**One-to-many** : un jalon → N tâches, une tâche → 0 ou 1 jalon. Pas de table pivot. Suppression d'un jalon → `milestoneId = NULL` sur les tâches associées.

### Relation Épopée-Tâche

**Même pattern — FK directe sur Task.** Schéma Prisma (`schema.prisma`, ligne 283) :

```prisma
epicId  String?
epic    Epic?  @relation(fields: [epicId], references: [id], onDelete: SetNull)
```

**One-to-many** : une épopée → N tâches, une tâche → 0 ou 1 épopée. Pas de table pivot.

### Tâches sans jalon/épopée

- `milestoneId` et `epicId` sont tous deux `String?` (nullable).
- Dans le Gantt projet actuel : tâches sans jalon → `tasksWithoutMilestone`, appended en fin de liste.
- Les épopées sont **complètement ignorées** par les deux vues Gantt actuelles.
- À la détachement d'un projet (`detachFromProject`), `epicId` et `milestoneId` sont mis à `null`.

### Comportement attendu pour le groupement (confirmé par la spec)

- `groupBy='milestone'` : tâches sans jalon → groupe "Sans jalon" en bas.
- `groupBy='epic'` : tâches sans épopée → groupe "Sans épopée" en bas.

La structure de données (FK directe, nullable) **supporte directement** ce comportement sans changement de schéma.

---

## Signalements (§10 — Points d'attention)

### 🔴 Alertes

1. **Drag-resize = zombie confirmé.** Les handles s'affichent dans le Gantt projet mais n'ont aucun effet (pas de callbacks). Décision D3 (DROP) est validée par l'usage réel.

2. **Fetch milestones non optimal** : le Gantt projet fait `GET /milestones?limit=1000` (tous projets) puis filtre client-side. Scalabilité faible. Recommandation : créer ou utiliser `GET /milestones?projectId=X` (endpoint déjà utilisé par Portfolio).

### 🟡 Observations

3. **Locale hardcodée `"fr"`** dans `GanttChart.tsx` ligne 273 — bug mineur à corriger durant Vague 3.2.

4. **Interface `Project` dupliquée** : PortfolioGantt utilise un type local avec `dueDate` au lieu du type partagé qui a `endDate`. L'adaptateur Portfolio (Vague 3.1) devra gérer cette divergence.

5. **Aucun test existant** (ni unitaire ni E2E) sur les composants Gantt — la Vague 6 part de zéro mais il n'y a pas de régression test à maintenir pendant les Vagues 1-5.

6. **Export PDF couplé aux pages** et non au composant Gantt — les deux implémentations d'export (Portfolio et Projet) utilisent le même pattern (`html-to-image` + `jsPDF`) mais dans des fichiers différents. Vague 4.2 peut les unifier.

7. **PortfolioGantt.tsx = 903 lignes monolithiques.** L'extraction en sous-composants se fera naturellement lors de la Vague 3.1.

### ✅ Points favorables

8. **Relations Jalon/Épopée-Tâche** : FK directes, nullables, schema propre — `types.ts` et `grouping.ts` (Vague 1) n'ont aucune surprise de modèle de données.

9. **Dépendances FS uniquement** — pas de complexité multi-types à gérer en V1.

10. **Seul `GanttChart.tsx` importe la lib** — le retrait (Vague 5) sera chirurgical.

---

**Phase 0 terminée. STOP. En attente de ratification pour Vague 1.**
