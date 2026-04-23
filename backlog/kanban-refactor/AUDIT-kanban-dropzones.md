# Audit Kanban Drop-zones — Orchestr'A V2

> Date : 2026-04-22 | Scope : deux pages inlinant un Kanban identique à extraire.

---

## §1. Résumé exécutif

Les deux pages `tasks/page.tsx` (808 lignes) et `projects/[id]/page.tsx` (2528 lignes) embarquent un
bloc Kanban quasi-identique : 5 colonnes, DnD HTML5 natif, états partagés, même mutation PATCH.
Les divergences sont mineures (badge overdue, cursor, `setData`, refetch strategy, colonne filtrables).
Extraire un composant `<TaskKanban>` partagé éliminerait ~250 lignes dupliquées et centraliserait les
clés i18n aujourd'hui éparpillées entre les namespaces `tasks.card.*` et `tasks.kanban.*`.

---

## §2. Inventaire — `apps/web/app/[locale]/tasks/page.tsx`

### États DnD

Lignes **61–63** :

```
61  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
62  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
63  const [isDragging, setIsDragging] = useState(false);
```

### Handlers DnD

| Handler           | Lignes  |
| ----------------- | ------- |
| `handleDragStart` | 301–308 |
| `handleDragEnd`   | 310–315 |
| `handleDragOver`  | 317–321 |
| `handleDragLeave` | 323–325 |
| `handleDrop`      | 327–343 |

`handleTaskClick` (345–350) dépend de `isDragging` — garde pendant refactor.

### Constante `columns`

Lignes **352–370** : tableau inline `{ status, title, color }[]`, 5 entrées.

### JSX Kanban (grid 5 colonnes)

Lignes **505–743** : bloc `{viewMode === "kanban" ? (…) : (<TaskListView …/>)}`.
La grid elle-même : lignes **506–742**.

### Helpers — usage Kanban vs. usage global

| Helper                  | Lignes définition | Utilisé Kanban         | Utilisé ailleurs                   | Sort après refactor     |
| ----------------------- | ----------------- | ---------------------- | ---------------------------------- | ----------------------- |
| `getTasksByStatus`      | 269–271           | oui (l.509)            | non                                | **à supprimer**         |
| `getFilteredTasks`      | 228–257           | via `getTasksByStatus` | oui (l.393, 746)                   | **à garder**            |
| `isTaskOverdue`         | 208–214           | oui (l.652)            | oui via `getFilteredTasks` (l.249) | **à garder**            |
| `getTaskProgress`       | importé (l.24)    | oui (l.672)            | non dans cette page                | dépendance du composant |
| `getPriorityBadgeColor` | 273–286           | oui (l.580)            | non                                | passer en prop/util     |
| `getPriorityLabel`      | 288–292           | oui (l.584)            | non                                | passer en prop/util     |
| `handleStatusChange`    | 161–169           | oui (l.701, 721)       | oui (l.747 TaskListView)           | **à garder**            |

---

## §3. Inventaire — `apps/web/app/[locale]/projects/[id]/page.tsx`

### États DnD

Lignes **83–85** :

```
83  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
84  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
85  const [isDragging, setIsDragging] = useState(false);
```

### Handlers DnD

| Handler           | Lignes  |
| ----------------- | ------- |
| `handleDragStart` | 242–247 |
| `handleDragEnd`   | 249–254 |
| `handleDragOver`  | 256–260 |
| `handleDragLeave` | 262–264 |
| `handleDrop`      | 266–284 |

`handleTaskClick` (286–290) dépend de `isDragging` — garde pendant refactor.

### Constante `columns`

Pas de constante nommée. Tableau littéral **inline dans le JSX**, lignes **1404–1430**, suivi de
`.filter((column) => !hiddenStatuses.includes(column.status))` (l.1431).

### JSX Kanban (grid 5 colonnes)

Lignes **1392–1597** : bloc `{taskViewMode === "list" ? (<TaskListView…/>) : (<div…>…</div>)}`.
La grid : lignes **1402–1596**.

### Helpers — usage Kanban vs. usage global

| Helper                   | Lignes définition  | Utilisé Kanban            | Utilisé ailleurs             | Sort après refactor     |
| ------------------------ | ------------------ | ------------------------- | ---------------------------- | ----------------------- |
| `getTasksByStatus`       | 301–303            | oui (l.1433)              | non                          | **à supprimer**         |
| `filteredTasks`          | 292–299 (variable) | via `getTasksByStatus`    | oui (l.1395 TaskListView)    | **à garder**            |
| `getTaskProgress`        | importé (l.40)     | oui (l.1566)              | non dans cette page          | dépendance du composant |
| `getPriorityBadgeColor`  | 222–235            | oui (l.1501)              | oui (l.1021 projet priority) | **à garder**            |
| `getPriorityLabel`       | 237–239            | oui (l.1505)              | oui (l.1025 projet priority) | **à garder**            |
| `handleTaskStatusChange` | 305–315            | non (boutons ←/→ absents) | oui (l.1396 TaskListView)    | **à garder**            |

---

## §4. Divergences fonctionnelles

| Fonctionnalité                   | `tasks/page.tsx`                                         | `projects/[id]/page.tsx`                                       |
| -------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Badge overdue                    | Présent (l.652–662) avec date formatée                   | Absent                                                         |
| Badge orphan (tâche sans projet) | Présent (l.601–606, `t("card.orphanLabel")`)             | Absent (contexte projet implicite)                             |
| Boutons ←/→ navigation statut    | Présents (l.692–731)                                     | Absents                                                        |
| Tri colonnes                     | Aucun (`getFilteredTasks()` sans sort)                   | Aucun (`filteredTasks` sans sort)                              |
| Filtrage colonnes visibles       | Aucun — toutes 5 colonnes toujours visibles              | `.filter(!hiddenStatuses.includes)` (l.1431)                   |
| Cursor carte draggable           | `cursor-move active:cursor-grabbing select-none` (l.552) | `cursor-pointer` uniquement (l.1476)                           |
| Transition inline style          | `style={{ transition: "all 0.2s ease" }}` (l.554)        | Absente                                                        |
| `dataTransfer.setData`           | `setData("text/html", innerHTML)` (l.305)                | Absent                                                         |
| Namespace i18n colonne vide      | `t("noTasks")` → `tasks.noTasks` (l.542)                 | `tTasks("kanban.noTasks")` → `tasks.kanban.noTasks` (l.1466)   |
| Namespace i18n assignés          | `t("card.assignees", {count})` (l.632)                   | `tTasks("kanban.assignees", {count})` (l.1540)                 |
| Namespace i18n heures            | `t("card.estimatedHours", {hours})` (l.666)              | `tTasks("kanban.estimatedHours", {hours})` (l.1560)            |
| Namespace i18n progression       | `t("card.progress")` (l.675)                             | `tTasks("kanban.progress")` (l.1570)                           |
| Refetch post-drop                | `fetchData()` (l.335) — refetch global                   | `tasksService.getByProject(projectId)` (l.275) — refetch ciblé |

---

## §5. i18n — clés exactes lues par le bloc Kanban

Fichier de référence : `apps/web/messages/fr/tasks.json` (et son équivalent `en/`).

### `tasks/page.tsx` — `t = useTranslations("tasks")`

`tasks.status.{TODO,IN_PROGRESS,IN_REVIEW,DONE,BLOCKED}` (l.353–367) · `tasks.noTasks` (l.542) ·
`tasks.card.orphanLabel` (l.604) · `tasks.card.assignees` (l.632) · `tasks.filters.overdue` (l.655) ·
`tasks.card.estimatedHours` (l.666) · `tasks.card.progress` (l.675) ·
`tasks.messages.statusUpdateSuccess` (l.334) · `tasks.messages.statusUpdateError` (l.337)

### `projects/[id]/page.tsx` — `tTasks = useTranslations("tasks")`

`tasks.status.{TODO,IN_PROGRESS,IN_REVIEW,DONE,BLOCKED}` (l.1407–1427) · `tasks.kanban.noTasks` (l.1466) ·
`tasks.kanban.assignees` (l.1540) · `tasks.kanban.estimatedHours` (l.1560) ·
`tasks.kanban.progress` (l.1570) ·
`tasks.messages.statusUpdateSuccess` (l.273) · `tasks.messages.statusUpdateError` (l.278)

**Doublon constaté** : `tasks.card.{assignees,estimatedHours,progress}` et `tasks.kanban.{assignees,estimatedHours,progress}` sont sémantiquement identiques dans deux sous-namespaces différents.

---

## §6. Handlers DnD — pseudo-code normalisé (version unifiée)

```
handleDragStart(e, task):
  setDraggedTask(task)
  setIsDragging(true)
  e.dataTransfer.effectAllowed = "move"
  // NE PAS appeler setData — voir §8
  e.currentTarget.style.opacity = "0.4"

handleDragEnd(e):
  setDraggedTask(null)
  setDragOverColumn(null)
  setIsDragging(false)
  e.currentTarget.style.opacity = "1"

handleDragOver(e, status):
  e.preventDefault()
  e.dataTransfer.dropEffect = "move"
  setDragOverColumn(status)

handleDragLeave():
  setDragOverColumn(null)

handleDrop(e, newStatus):
  e.preventDefault()
  setDragOverColumn(null)
  if draggedTask && draggedTask.status !== newStatus:
    try:
      await tasksService.update(draggedTask.id, { status: newStatus })
      toast.success(t("messages.statusUpdateSuccess"))
      onRefetch()                   // prop callback — chaque page fournit son refetch
    catch:
      toast.error(t("messages.statusUpdateError"))
  setDraggedTask(null)
  setIsDragging(false)
```

`onRefetch` : dans `tasks/page.tsx` → `fetchData()` ; dans `projects/[id]/page.tsx` →
`setTasks(await tasksService.getByProject(projectId))`. Le composant reçoit un callback.

---

## §7. Imports morts attendus après refactor

### `apps/web/app/[locale]/tasks/page.tsx`

| Symbole                  | Restera utilisé ? | Raison                                              |
| ------------------------ | ----------------- | --------------------------------------------------- |
| `useState` (draggedTask) | Non               | Les 3 états DnD migrent dans le composant           |
| `TaskStatus`             | Oui               | Utilisé dans `getFilteredTasks`, filtres URL, etc.  |
| `Task` (type)            | Oui               | Encore utilisé pour `tasks`, `orphanTasks`, etc.    |
| `toast`                  | Oui               | Reste dans `handleStatusChange`, `handleDeleteTask` |
| `getTaskProgress`        | Non (si extrait)  | Uniquement dans le JSX Kanban — migre               |
| `getPriorityBadgeColor`  | Non               | Uniquement dans le JSX Kanban — migre               |
| `getPriorityLabel`       | Non               | Uniquement dans le JSX Kanban — migre               |
| `getTasksByStatus`       | Non               | Uniquement dans le Kanban — à supprimer             |

### `apps/web/app/[locale]/projects/[id]/page.tsx`

| Symbole                  | Restera utilisé ? | Raison                                       |
| ------------------------ | ----------------- | -------------------------------------------- |
| `useState` (draggedTask) | Non               | Les 3 états DnD migrent dans le composant    |
| `TaskStatus`             | Oui               | Utilisé dans status config UI, filtres, etc. |
| `Task` (type)            | Oui               | Reste dans états du projet                   |
| `toast`                  | Oui               | Reste dans de nombreux handlers (l.190–742)  |
| `getTaskProgress`        | Non (si extrait)  | Uniquement dans le JSX Kanban — migre        |
| `getPriorityBadgeColor`  | Oui               | Utilisé aussi l.1021 pour la priorité projet |
| `getPriorityLabel`       | Oui               | Utilisé aussi l.1025 pour la priorité projet |
| `getTasksByStatus`       | Non               | Uniquement dans le Kanban — à supprimer      |

---

## §8. Bruit à NE PAS reproduire dans le composant extrait

1. **`e.dataTransfer.setData("text/html", e.currentTarget.innerHTML)`** (tasks/page.tsx l.305) :
   présent uniquement dans cette implémentation, absent de l'autre. `innerHTML` du drag ghost n'est
   pas lu au drop — appel inutile et source potentielle de fuite mémoire sur longs arbres DOM.

2. **`style={{ transition: "all 0.2s ease" }}` inline sur la carte** (tasks/page.tsx l.554) :
   doublon avec la classe Tailwind `transition-all` déjà appliquée sur le même élément (l.552).
   La propriété `transition` CSS inline prend la priorité et casse l'override Tailwind au besoin.

3. **`select-none` absent de la page projets** (l.1476) : comportement incohérent — le refactor doit
   choisir une seule valeur (recommandation : inclure `select-none` + `cursor-move`).

---

## §9. Confiance et risques

1. **Confiance élevée** sur la parité structurelle des handlers DnD : les deux implémentations sont
   quasi-identiques ligne à ligne ; la différence de `refetch` est le seul delta comportemental réel.

2. **Risque modéré** sur les clés i18n : les doublons `tasks.card.*` / `tasks.kanban.*` devront être
   consolidés avant ou pendant le refactor pour éviter de prop-driller deux namespaces.

3. **Risque faible** sur `hiddenStatuses` : cette feature (filtrage colonnes) existe uniquement dans
   la page projets et devra être passée en prop optionnelle au composant extrait.
