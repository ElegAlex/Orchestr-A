# Kanban Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Orchestrator = Opus (this conversation), every dispatched teammate = Sonnet (`model: "sonnet"`) via the `Agent` tool. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Extraire le Kanban de tâches dupliqué sur `/tasks` et `/projects/[id]` vers un composant partagé `<TaskKanban>`, corriger la drop-zone trop étroite (drop reconnu sur tout le wrapper de colonne, en-tête inclus), trier alphabétiquement les cartes, et valider le tout par tests unitaires Jest + smoke Playwright.

**Architecture :** Composant React 19 / Next.js 16 client-side, DnD HTML5 natif (pas de lib), `next-intl` pour l'i18n, mutation via `tasksService.update`. Handlers DnD exclusivement sur le wrapper extérieur de colonne ; la liste interne reste scrollable mais n'intercepte plus les events. Tri alphabétique front-only (`localeCompare`). Aucune migration Prisma, aucun changement backend.

**Tech Stack :** Next.js 16 App Router, React 19, TypeScript strict, `next-intl`, `react-hot-toast`, Jest + Testing Library (JSDOM), Playwright (E2E @smoke).

---

## 0. Divergences détectées vs. spec v1.0 (à intégrer dans l'exécution)

| #   | Fait                                                                                                                                                                                   | Implication                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D-a | `AUDIT-kanban-dropzones.md` référencé comme "validé" (SPEC §1) **n'existe pas** dans le repo                                                                                           | Ajouter une **Wave 0a** qui produit l'audit in-situ avant tout refactor — sinon les numéros de lignes cités par la spec sont non vérifiables. |
| D-b | i18n ≠ un fichier monolithique : la réalité est un **fichier par namespace** (`apps/web/messages/fr/tasks.json`, `apps/web/messages/en/tasks.json`)                                    | Wave 0b écrit dans `fr/tasks.json` et `en/tasks.json`, pas `fr.json`.                                                                         |
| D-c | Locales présentes : **fr + en** uniquement                                                                                                                                             | Pas d'autres traductions à produire.                                                                                                          |
| D-d | Lignes citées dans la spec périmées : `/tasks/page.tsx` fait **808 lignes** (spec cite "~505-735"), `/projects/[id]/page.tsx` fait **2528 lignes** (spec cite "~1402-1580")            | Les agents Wave 2 localisent les blocs par **pattern/grep**, pas par n° de ligne.                                                             |
| D-e | Test runner web confirmé : **Jest** (`apps/web/package.json`), pas Vitest                                                                                                              | Wave 1 utilise `jest.mock`, fichier `*.test.tsx`.                                                                                             |
| D-f | Convention des mocks existants : cf. `apps/web/src/components/tasks/__tests__/TaskForm.test.tsx` (`jest.mock("next-intl", () => ({ useTranslations: () => (key) => key }))`)           | Wave 1 s'y aligne.                                                                                                                            |
| D-g | Pas de `status` column `BLOCKED` + `IN_REVIEW` visible directement dans `fr/tasks.json` sous `columns.*` — existent sous `tasks.status.*`                                              | Wave 0b crée la sous-clé `tasks.kanban.columns` en dupliquant les libellés de `tasks.status.*`.                                               |
| D-h | Mémoire projet : commit direct sur `master` (pas de branche), push auto après validation, deploy VPS manuel SSH (`debian@92.222.35.25:/opt/orchestra`), workflow `deploy.yml` = leurre | Wave 4 (orchestrateur) fait le vrai SSH+rebuild.                                                                                              |

---

## 1. File structure

### À créer

- `backlog/kanban-refactor/AUDIT-kanban-dropzones.md` — audit in-situ (Wave 0a)
- `apps/web/src/components/tasks/TaskKanban.tsx` — composant partagé (Wave 1)
- `apps/web/src/components/tasks/__tests__/TaskKanban.test.tsx` — unit tests Jest (Wave 1)
- `e2e/kanban.spec.ts` — smoke Playwright (Wave 3)
- `backlog/kanban-refactor/VERIF-kanban-dropzones.md` — checklist de validation (Wave 3)

### À modifier

- `apps/web/messages/fr/tasks.json` — compléter `tasks.kanban.*` (Wave 0b)
- `apps/web/messages/en/tasks.json` — compléter `tasks.kanban.*` (Wave 0b)
- `apps/web/app/[locale]/tasks/page.tsx` — retirer ~230 l DnD inline, ajouter import `<TaskKanban>` (Wave 2a)
- `apps/web/app/[locale]/projects/[id]/page.tsx` — idem côté projet (Wave 2b)

### Pas touché

- `packages/database/prisma/schema.prisma` — aucune migration
- `apps/api/**` — aucun changement backend
- `apps/web/src/components/tasks/TaskListView.tsx`, `TaskLineCard.tsx`, `TaskForm.tsx` — conservés tels quels, clés `tasks.card.*` préservées

---

## 2. Séquencement global

```
Wave 0a (audit-dropzones)  ──┐
                             ├──▶ Wave 1 (kanban-builder) ──▶ Wave 2a (refactor-global-tasks) ──┐
Wave 0b (i18n-kanban)      ──┘                           ╲─▶ Wave 2b (refactor-project-tasks) ─┴──▶ Wave 3 (e2e-verifier) ──▶ Wave 4 (ship)
```

- **W0a + W0b en parallèle** (2 Agents dispatch simultané, 1 message, 2 `Agent` tool calls).
- **W1 après** W0a **ET** W0b (l'orchestrateur vérifie les deliverables avant de lancer W1).
- **W2a + W2b en parallèle** après W1 mergé.
- **W3 après** W2a **ET** W2b.
- **W4 = orchestrateur** (commit global + push + SSH deploy).

Tous les agents sont dispatchés via `Agent` tool avec `model: "sonnet"` et `subagent_type: "general-purpose"` sauf Wave 3 qui peut utiliser `subagent_type: "general-purpose"` + accès Playwright MCP.

---

## Wave 0a — Audit in-situ (solo, ~15 min)

**Agent :** `audit-dropzones` | **Modèle :** Sonnet | **Dépend de :** rien | **Peut tourner en parallèle de :** Wave 0b

**Files:**

- Create: `backlog/kanban-refactor/AUDIT-kanban-dropzones.md`

**Objectif :** produire une cartographie précise (avec n° de lignes exacts au moment de l'audit) des blocs à retirer des deux pages, pour que les agents Wave 2 aient des ancres fiables.

- [ ] **Step 0a.1 — Dispatch agent**

```text
Agent (model: "sonnet", subagent_type: "general-purpose", description: "Audit kanban drop-zones"):

Tu produis un audit in-situ du Kanban de tâches dupliqué pour préparer un refactor.

Contexte :
- Monorepo Orchestr'A V2 (Next.js 16, React 19, next-intl).
- Deux pages contiennent un Kanban inliné à extraire vers un composant partagé :
  1. apps/web/app/[locale]/tasks/page.tsx (808 l.)
  2. apps/web/app/[locale]/projects/[id]/page.tsx (2528 l.)

Livrable : écrire backlog/kanban-refactor/AUDIT-kanban-dropzones.md avec EXACTEMENT ces sections :

§1. Résumé exécutif (5 lignes max)
§2. Inventaire des blocs dans /tasks/page.tsx :
  - Plage de lignes des états DnD (draggedTask, dragOverColumn, isDragging)
  - Plage de lignes des handlers DnD (handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop)
  - Plage de lignes de la constante columns / COLUMNS
  - Plage de lignes du JSX Kanban (la grid 5 colonnes)
  - Plage de lignes de helpers morts après refactor (ex: getTasksByStatus) — liste celles utilisées UNIQUEMENT par le bloc Kanban (à supprimer) vs. utilisées aussi ailleurs dans la page (à garder)
§3. Inventaire équivalent dans /projects/[id]/page.tsx (même structure)
§4. Divergences fonctionnelles entre les deux implémentations (en tableau) : badges, tri actuel, filtrage par statut, boutons ←/→, i18n utilisée, cursor, transitions
§5. i18n utilisée (clés exactes avec leur fichier) : lister TOUTES les clés de messages lues par le bloc Kanban des deux pages
§6. Handlers DnD — pseudo-code normalisé (une seule version) qui couvre les deux implémentations : setDraggedTask, dragOverColumn, mutation PATCH, toast, refetch
§7. Imports morts attendus après refactor (lister par fichier) : ex. `toast` reste-t-il utilisé ailleurs ? useState de draggedTask à retirer ? etc.
§8. Bruit identifié à ne PAS reproduire dans le composant extrait (ex: dataTransfer.setData('text/html', …) si inutile)

Méthode :
- Utiliser Grep et Read. Ne modifier AUCUN fichier sauf l'audit.
- Citer des lignes EXACTES (lu dans Read), pas des estimations.
- Grep patterns utiles :
    'draggedTask|dragOverColumn|isDragging'
    'handleDrag|handleDrop'
    'onDragStart|onDragOver|onDragLeave|onDrop|onDragEnd'
    'useTranslations|t\(' dans les deux fichiers
    '<div.*column|columns\.map|COLUMNS'

Contraintes :
- Pas de proposition de solution ici — description uniquement.
- Le doc doit tenir en <= 250 lignes markdown.
- À la fin du doc, une section §9 "Confiance et risques" avec 3 points max.

Output final (dernier message) : le chemin du fichier créé et le nombre de lignes. Rien d'autre.
```

- [ ] **Step 0a.2 — Orchestrator gate**

Vérifier :

```bash
test -s /home/alex/Documents/REPO/ORCHESTRA/backlog/kanban-refactor/AUDIT-kanban-dropzones.md && echo "OK" || echo "MISSING"
wc -l /home/alex/Documents/REPO/ORCHESTRA/backlog/kanban-refactor/AUDIT-kanban-dropzones.md
```

Expected : `OK` + `<250` lignes. Si manquant → redispatch avec feedback.

---

## Wave 0b — Consolidation i18n (solo, ~15 min)

**Agent :** `i18n-kanban` | **Modèle :** Sonnet | **Dépend de :** rien | **Peut tourner en parallèle de :** Wave 0a

**Files:**

- Modify: `apps/web/messages/fr/tasks.json`
- Modify: `apps/web/messages/en/tasks.json`

- [ ] **Step 0b.1 — Dispatch agent**

````text
Agent (model: "sonnet", subagent_type: "general-purpose", description: "Consolidate tasks.kanban i18n"):

Tu consolides les clés i18n du Kanban dans un namespace unique `tasks.kanban.*` pour les locales fr et en.

Contexte :
- apps/web/messages/{fr,en}/tasks.json sont les deux fichiers à éditer (structure : 1 fichier par namespace, PAS un fichier monolithique).
- La sous-clé `tasks.kanban.*` existe déjà partiellement (noTasks, assignees, estimatedHours, progress) mais est INCOMPLÈTE.
- Les clés `tasks.card.*` sont utilisées ailleurs (TaskListView, TaskLineCard) — NE PAS LES SUPPRIMER.
- Les libellés de colonnes existent déjà sous `tasks.status.*` (TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED).

Objectif :
1. Lire apps/web/messages/fr/tasks.json et apps/web/messages/en/tasks.json.
2. Compléter `tasks.kanban` pour qu'elle contienne EXACTEMENT cette forme dans chaque locale :

```json
"kanban": {
  "noTasks": "...",
  "assignees": "{count} assignés",
  "estimatedHours": "⏱️ {hours}h estimées",
  "progress": "Progression",
  "orphanTask": "Tâche indépendante",
  "overdue": "En retard",
  "columns": {
    "TODO": "À faire",
    "IN_PROGRESS": "En cours",
    "IN_REVIEW": "En revue",
    "DONE": "Terminé",
    "BLOCKED": "Bloqué"
  },
  "messages": {
    "statusUpdateSuccess": "Statut mis à jour",
    "statusUpdateError": "Erreur lors de la mise à jour du statut"
  }
}
````

3. Traduire les libellés pour en/tasks.json (anglais idiomatique, même sémantique).
4. Vérifier qu'AUCUNE clé existante n'est supprimée (diff strictement additif sur `tasks.kanban.*`, tout le reste inchangé).
5. Si une clé cible existe déjà (ex: noTasks), conserver la valeur existante.
6. Préserver : indentation 2 spaces, encoding UTF-8, trailing newline.

Validation :

- `cd /home/alex/Documents/REPO/ORCHESTRA && node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/fr/tasks.json','utf8'))"` doit ne rien afficher (JSON valide).
- Idem pour en.
- Rechercher les clés nouvelles :
  `node -e "const j=require('./apps/web/messages/fr/tasks.json'); console.log(j.kanban.orphanTask, j.kanban.overdue, j.kanban.columns.BLOCKED, j.kanban.messages.statusUpdateSuccess)"`
  doit imprimer 4 chaînes non vides.

Livrable (dernier message) : diff unified des deux fichiers + résultat de la commande de validation. 10 lignes max de prose.

````

- [ ] **Step 0b.2 — Orchestrator gate**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
node -e "const fr=require('./apps/web/messages/fr/tasks.json'); const en=require('./apps/web/messages/en/tasks.json'); ['noTasks','assignees','estimatedHours','progress','orphanTask','overdue'].forEach(k => { if(!fr.kanban[k]||!en.kanban[k]) throw new Error('missing '+k); }); ['TODO','IN_PROGRESS','IN_REVIEW','DONE','BLOCKED'].forEach(k => { if(!fr.kanban.columns[k]||!en.kanban.columns[k]) throw new Error('missing col '+k); }); if(!fr.kanban.messages.statusUpdateSuccess||!en.kanban.messages.statusUpdateSuccess) throw new Error('missing messages'); console.log('OK');"
````

Expected : `OK`. Puis checker diff Git strictement additif :

```bash
git -C /home/alex/Documents/REPO/ORCHESTRA diff --stat apps/web/messages/
```

Expected : 2 fichiers touchés, uniquement insertions (pas de suppression de clé legacy).

---

## Wave 1 — Composant `<TaskKanban>` + tests (solo, ~50 min)

**Agent :** `kanban-builder` | **Modèle :** Sonnet | **Dépend de :** W0a + W0b mergées

**Files:**

- Create: `apps/web/src/components/tasks/TaskKanban.tsx`
- Create: `apps/web/src/components/tasks/__tests__/TaskKanban.test.tsx`

- [ ] **Step 1.1 — Dispatch agent**

````text
Agent (model: "sonnet", subagent_type: "general-purpose", description: "Build TaskKanban shared component + Jest tests"):

Tu crées le composant React partagé <TaskKanban> et sa suite de tests Jest.

Contexte :
- Monorepo Orchestr'A V2 (Next.js 16 App Router, React 19, TypeScript strict, next-intl 4, react-hot-toast).
- Spec : backlog/kanban-refactor/SPEC — Kanban tâches.md (§3 contrat, §5 Wave 1, §6 critères).
- Audit : backlog/kanban-refactor/AUDIT-kanban-dropzones.md (à LIRE pour identifier la logique DnD source).
- Test runner : Jest (apps/web/jest.config.js), convention alignée sur apps/web/src/components/tasks/__tests__/TaskForm.test.tsx.
- i18n : namespace "tasks", clés sous tasks.kanban.* (déjà consolidées en Wave 0b).

=== FICHIER 1 : apps/web/src/components/tasks/TaskKanban.tsx ===

Contrat de props (exact) :

```tsx
import type { Task, TaskStatus } from "@/types";

export interface TaskKanbanProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAfterStatusChange?: () => void | Promise<void>;
  hiddenStatuses?: TaskStatus[];
  showProjectBadge?: boolean;
  showOverdueBadge?: boolean;
  showStatusArrows?: boolean;
}
````

Responsabilités internes :

- État DnD local (draggedTask, dragOverColumn, isDragging)
- Handlers DnD
- Appel mutation : tasksService.update(task.id, { status })
- Toast success/error (react-hot-toast) avec clés tasks.kanban.messages.\*
- Tri alphabétique par title via localeCompare(locale, { sensitivity: 'base' })
- Filtrage par statut
- Rendu colonnes + cartes
- data-testid sur wrapper (`kanban-column-${status}`) et carte (`kanban-card-${task.id}`)

Structure de chaque colonne (wrapper droppable) :

```tsx
<div
  key={column.status}
  data-testid={`kanban-column-${column.status}`}
  onDragOver={(e) => handleDragOver(e, column.status)}
  onDragLeave={handleDragLeave}
  onDrop={(e) => handleDrop(e, column.status)}
  className={[
    "min-w-0 rounded-lg shadow-sm border transition-colors",
    isDropTarget
      ? "bg-blue-50 border-2 border-dashed border-blue-400"
      : "bg-white border-gray-200",
  ].join(" ")}
>
  <div
    className={`${column.color} px-4 py-3 rounded-t-lg border-b border-gray-200`}
  >
    {/* header : titre + count */}
  </div>
  <div className="p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto">
    {/* cartes triées — PAS de handler DnD ici */}
  </div>
</div>
```

CRITIQUE : les handlers DnD sont UNIQUEMENT sur le wrapper extérieur. La div interne scrollable n'a PAS de handlers.

Handlers (logique exacte) :

- handleDragStart(e, task) : setIsDragging(true); setDraggedTask(task); e.dataTransfer.effectAllowed='move'
  (NE PAS appeler e.dataTransfer.setData('text/html', …) — bruit retiré par la spec §5 W1.7)
- handleDragEnd() : setIsDragging(false); setDraggedTask(null); setDragOverColumn(null)
- handleDragOver(e, status) : e.preventDefault(); e.dataTransfer.dropEffect='move'; setDragOverColumn(status)
- handleDragLeave() : setDragOverColumn(null)
- handleDrop(e, newStatus) :
  e.preventDefault()
  setDragOverColumn(null)
  if (draggedTask && draggedTask.status !== newStatus) {
  try {
  await tasksService.update(draggedTask.id, { status: newStatus });
  toast.success(t('kanban.messages.statusUpdateSuccess'));
  await onAfterStatusChange?.();
  } catch {
  toast.error(t('kanban.messages.statusUpdateError'));
  }
  }
  setDraggedTask(null); setIsDragging(false);

Tri (useMemo) :
const locale = useLocale();
const sortedTasks = useMemo(
() => [...tasks].sort((a, b) => a.title.localeCompare(b.title, locale, { sensitivity: 'base' })),
[tasks, locale]
);
const getTasksByStatus = (status: TaskStatus) => sortedTasks.filter(t => t.status === status);

Définition des colonnes (const locale au composant) :
const ALL_COLUMNS: Array<{ status: TaskStatus; color: string }> = [
{ status: 'TODO', color: 'bg-gray-100' },
{ status: 'IN_PROGRESS', color: 'bg-blue-100' },
{ status: 'IN_REVIEW', color: 'bg-yellow-100' },
{ status: 'DONE', color: 'bg-green-100' },
{ status: 'BLOCKED', color: 'bg-red-100' },
];
const columns = ALL_COLUMNS.filter(c => !(hiddenStatuses ?? []).includes(c.status))
.map(c => ({ ...c, title: t(`kanban.columns.${c.status}`) }));

Carte : rendu conditionnel selon showProjectBadge / showOverdueBadge / showStatusArrows.

- Wrapper <article> avec :
  draggable
  data-testid={`kanban-card-${task.id}`}
  onDragStart, onDragEnd
  onClick={() => onTaskClick(task)}
  className="cursor-move active:cursor-grabbing select-none ..."
  style={{ transition: "all 0.2s ease" }}
- Contenu : titre, ligne meta (assignees count + estimatedHours si > 0 + progress si défini)
- Si showProjectBadge : afficher t('kanban.orphanTask') si task.projectId null, sinon le nom du projet (via task.project?.name)
- Si showOverdueBadge : badge t('kanban.overdue') si task.endDate < now && status !== DONE
- Si showStatusArrows : deux boutons ← / → pour muter via tasksService.update (même logique que handleDrop)

Imports nécessaires (exacts) :
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { tasksService } from "@/services/tasks.service";
import type { Task, TaskStatus } from "@/types";

Export : export default function TaskKanban(props: TaskKanbanProps) { … }

=== FICHIER 2 : apps/web/src/components/tasks/**tests**/TaskKanban.test.tsx ===

Pattern de mock aligné sur TaskForm.test.tsx :

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TaskKanban from "../TaskKanban";
import type { Task } from "@/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "fr",
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/services/tasks.service", () => ({
  tasksService: {
    update: jest.fn().mockResolvedValue(undefined),
  },
}));

// Helper factory
const makeTask = (overrides: Partial<Task>): Task =>
  ({
    id: "t1",
    title: "T1",
    status: "TODO",
    priority: "NORMAL",
    assignees: [],
    ...overrides,
  }) as Task;
```

Cas à couvrir (1 test chacun, tous asynchrones si nécessaire) :

1. "renders 5 columns by default" — render avec tasks=[] → screen.getByTestId('kanban-column-TODO') … BLOCKED visibles.
2. "hides columns listed in hiddenStatuses" — render avec hiddenStatuses=['CANCELLED','BLOCKED'] (le type Task n'a pas CANCELLED, passer juste ['BLOCKED']) → queryByTestId('kanban-column-BLOCKED') === null.
3. "sorts tasks alphabetically by title within a column" — tasks=[{title:'Charlie'},{title:'Alpha'},{title:'Bravo'}] tous status TODO → l'ordre des data-testid dans kanban-column-TODO est Alpha, Bravo, Charlie (utiliser within + getAllByTestId).
4. "distributes tasks by status into correct columns" — tasks=[A:TODO, B:IN_PROGRESS, C:DONE] → chacune dans sa colonne.
5. "calls tasksService.update with new status on drop" :
   - Render tasks=[A:TODO].
   - fireEvent.dragStart sur kanban-card-a (un <DragEvent> synthétique suffit).
   - fireEvent.dragOver sur kanban-column-IN_PROGRESS avec { dataTransfer: { dropEffect: '', effectAllowed: '' } }.
   - fireEvent.drop sur kanban-column-IN_PROGRESS.
   - await waitFor(() => expect(tasksService.update).toHaveBeenCalledWith('a', { status: 'IN_PROGRESS' })).
   - expect(onAfterStatusChange).toHaveBeenCalled().
6. "does not call update on drop into same status column" — drop TODO sur TODO → update non appelé.
7. "shows error toast when update fails" — mock tasksService.update.mockRejectedValueOnce(new Error()) → toast.error appelé avec 'kanban.messages.statusUpdateError' (vérifier via require('react-hot-toast').default.error).
8. "calls onTaskClick when card clicked (not dragged)" — fireEvent.click sur kanban-card-a → onTaskClick appelé avec la tâche.

Convention DnD JSDOM : HTML5 DnD n'est pas implémenté dans JSDOM, donc fireEvent.dragStart/dragOver/drop fonctionnent mais dataTransfer est null par défaut. Dans handleDragOver, tester e.dataTransfer avant d'écrire dropEffect (if (e.dataTransfer) { e.dataTransfer.dropEffect = 'move'; }) pour ne pas crasher les tests.

=== QUALITÉ ===

Avant de rendre la main :

1. `pnpm --filter web run lint` → 0 erreur, 0 warning nouveau
2. `pnpm --filter web test -- TaskKanban` → 8/8 tests verts
3. `pnpm --filter web test -- --coverage --collectCoverageFrom='src/components/tasks/TaskKanban.tsx' TaskKanban` → couverture ≥ 80% lignes sur TaskKanban.tsx
4. Pas de `any` dans le composant ni dans les tests (hors casts nécessaires pour les mocks Task)
5. Exports : `export default function TaskKanban` + `export type { TaskKanbanProps }` (si la structure le requiert, sinon exporter via interface inline)

=== LIVRABLE ===
Dernier message :

- Chemin des 2 fichiers créés
- Sortie de `pnpm --filter web test -- TaskKanban` (dernières 20 lignes)
- Sortie `pnpm --filter web run lint` (dernières 10 lignes)
- % de couverture TaskKanban.tsx
- Rien d'autre

````

- [ ] **Step 1.2 — Orchestrator gate**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
test -s apps/web/src/components/tasks/TaskKanban.tsx && echo "component OK"
test -s apps/web/src/components/tasks/__tests__/TaskKanban.test.tsx && echo "test OK"
pnpm --filter web test -- TaskKanban 2>&1 | tail -20
pnpm --filter web run lint 2>&1 | tail -10
````

Expected : 2 × `OK` + `Tests: 8 passed` + lint clean.
Si échec → redispatch avec sortie du fail.

- [ ] **Step 1.3 — Commit Wave 0a + 0b + 1 (regroupés)**

Note : les artefacts W0a/W0b/W1 forment un ensemble fonctionnel cohérent (audit + i18n + composant + tests). Ils sont commités en UN SEUL commit pour garder l'histoire lisible. Waves 2 et 3 ont leurs commits dédiés.

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
git add apps/web/src/components/tasks/TaskKanban.tsx \
        apps/web/src/components/tasks/__tests__/TaskKanban.test.tsx \
        apps/web/messages/fr/tasks.json \
        apps/web/messages/en/tasks.json \
        backlog/kanban-refactor/AUDIT-kanban-dropzones.md
git commit -m "$(cat <<'EOF'
feat(kanban): extract shared <TaskKanban> + full-column drop-zone + i18n

- Introduce apps/web/src/components/tasks/TaskKanban.tsx with full-wrapper
  drop-zone (header included), alphabetical title sort, data-testids.
- Consolidate tasks.kanban.* keys in fr/tasks.json + en/tasks.json.
- Add in-situ audit for downstream waves.
- Unit tests: 8 cases, >=80% coverage.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Wave 2 — Refactor pages consommatrices (parallèle, 2 agents, ~25 min chacun)

**Dépend de :** W1 commitée. Les deux agents tournent en parallèle (1 message, 2 `Agent` tool calls) car les fichiers sont indépendants.

### Wave 2a — `/tasks/page.tsx`

**Agent :** `refactor-global-tasks` | **Modèle :** Sonnet

**Files:**

- Modify: `apps/web/app/[locale]/tasks/page.tsx`

- [ ] **Step 2a.1 — Dispatch agent**

````text
Agent (model: "sonnet", subagent_type: "general-purpose", description: "Refactor /tasks page to use <TaskKanban>"):

Tu remplaces le Kanban inliné de apps/web/app/[locale]/tasks/page.tsx par le composant <TaskKanban> déjà livré en Wave 1.

Contexte indispensable à LIRE d'abord :
1. backlog/kanban-refactor/AUDIT-kanban-dropzones.md (§2 et §5 et §7 : te donne les plages de lignes EXACTES et les imports à retirer pour CE fichier).
2. apps/web/src/components/tasks/TaskKanban.tsx (API props).

Fichier cible : apps/web/app/[locale]/tasks/page.tsx (808 l.).

Actions précises (par patterns, PAS par n° de ligne, car le fichier évolue) :

1. Retirer les états DnD du composant de page :
   - `const [draggedTask, setDraggedTask] = useState<Task | null>(null);`
   - `const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);`
   - `const [isDragging, setIsDragging] = useState(…)` si présent

2. Retirer les handlers DnD :
   - `handleDragStart`, `handleDragEnd`, `handleDragOver`, `handleDragLeave`, `handleDrop`
   - La logique de mutation inline (tasksService.update dans handleDrop)

3. Retirer la constante des colonnes :
   - const columns = […5 entrées…] si elle n'est utilisée QUE par le bloc Kanban. L'audit le confirme.

4. Retirer `getTasksByStatus` si non utilisé ailleurs (vérifier avec grep).

5. Retirer le JSX du Kanban : le `<div className="grid grid-cols-…">` avec le `.map` sur columns et les cartes. Repère par la présence de `onDragOver={(e) => handleDragOver(e, column.status)}` et le bloc parent.

6. Remplacer par :

```tsx
<TaskKanban
  tasks={filteredTasks}
  onTaskClick={(task) => router.push(`/${locale}/tasks/${task.id}`)}
  onAfterStatusChange={fetchData}
  showProjectBadge
  showOverdueBadge
  showStatusArrows
/>
````

Variables à confirmer dans le fichier : `filteredTasks`, `locale`, `router` (doivent déjà exister ; sinon signaler). `fetchData` doit exister comme fonction de refetch — vérifier son nom exact et l'utiliser.

7. Ajouter l'import :
   `import TaskKanban from "@/components/tasks/TaskKanban";`
   (placer dans la zone d'imports triée alphabétiquement par rapport aux autres imports @/components)

8. Nettoyer les imports devenus orphelins :
   - Si `tasksService` n'est plus utilisé dans le fichier (au-delà de fetch initial) → vérifier et retirer.
   - Si `toast` n'est plus utilisé → retirer.
   - Si `Task`, `TaskStatus` types ne sont plus référencés → retirer.
   - Exécuter `pnpm --filter web run lint` et retirer tout import signalé unused-imports.

Contraintes :

- Conserver INTÉGRALEMENT : searchBar, filtres (priority, assignee), logique fetching initial, `filteredTasks`, permissions, header de page.
- Le diff net doit être : ~ -220 lignes / +10 lignes.
- Zéro résultat pour `grep -nE "draggedTask|onDragStart|onDragOver|onDrop|handleDrag" apps/web/app/[locale]/tasks/page.tsx` après refactor.

Validation :

1. `pnpm --filter web run lint` → 0 erreur nouvelle.
2. `cd apps/web && pnpm exec tsc --noEmit` → 0 erreur TypeScript.
3. `pnpm --filter web test -- TaskKanban` toujours vert (régression).

Livrable (dernier message) :

- git diff --stat apps/web/app/[locale]/tasks/page.tsx
- Sortie de lint (10 dernières lignes)
- Sortie de `grep -nE "draggedTask|onDragStart|onDragOver|onDrop|handleDrag" apps/web/app/[locale]/tasks/page.tsx || echo "clean"`
- Rien d'autre

````

### Wave 2b — `/projects/[id]/page.tsx`

**Agent :** `refactor-project-tasks` | **Modèle :** Sonnet

**Files:**
- Modify: `apps/web/app/[locale]/projects/[id]/page.tsx`

- [ ] **Step 2b.1 — Dispatch agent**

```text
Agent (model: "sonnet", subagent_type: "general-purpose", description: "Refactor project detail page to use <TaskKanban>"):

Tu remplaces le Kanban inliné de apps/web/app/[locale]/projects/[id]/page.tsx par <TaskKanban>.

Contexte à LIRE :
1. backlog/kanban-refactor/AUDIT-kanban-dropzones.md (§3 et §5 et §7)
2. apps/web/src/components/tasks/TaskKanban.tsx

Fichier cible : apps/web/app/[locale]/projects/[id]/page.tsx (2528 l.). GROS fichier — travaille par patterns.

Actions précises :
1. Retirer : états DnD (draggedTask, dragOverColumn, isDragging)
2. Retirer : handlers DnD (handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop)
3. Retirer : définition inline des colonnes (chercher `const columns = [` avec status TODO IN_PROGRESS …)
4. Retirer : JSX du Kanban inliné (la grid 5 colonnes avec les .map + cartes draggables). Repère par `onDragOver={(e) => handleDragOver(e, column.status)}`.
5. Remplacer par :

```tsx
<TaskKanban
  tasks={filteredProjectTasks}
  onTaskClick={(task) => router.push(`/${locale}/tasks/${task.id}`)}
  onAfterStatusChange={async () => {
    const tasksData = await tasksService.getByProject(projectId);
    setTasks(Array.isArray(tasksData) ? tasksData : []);
  }}
  hiddenStatuses={hiddenStatuses}
/>
````

Variables à vérifier : `filteredProjectTasks` (ou équivalent — utiliser le nom exact existant ; sinon `projectTasks` filtrés), `projectId`, `setTasks`, `hiddenStatuses`. Si `hiddenStatuses` n'est pas défini côté page, OMETTRE la prop (default = aucun masqué). Ne PAS inventer la variable.

6. Ajouter l'import `import TaskKanban from "@/components/tasks/TaskKanban";` (ordre alphabétique).

7. Comme pour 2a : retirer les imports orphelins détectés par lint (toast, types, etc.).

Contraintes :

- Conserver les autres sections du projet (overview, milestones, members, events, budget, etc.) INTACTES.
- Parité fonctionnelle : pas de `showProjectBadge`/`showOverdueBadge`/`showStatusArrows` (defaults = false) pour matcher l'UI existante côté projet.
- Zéro résultat pour `grep -nE "draggedTask|onDragStart|onDragOver|onDrop|handleDrag" apps/web/app/[locale]/projects/[id]/page.tsx` après refactor.

Validation :

1. `pnpm --filter web run lint` → 0 nouveau warning.
2. `cd apps/web && pnpm exec tsc --noEmit` → 0 erreur.
3. `pnpm --filter web test -- TaskKanban` vert.

Livrable :

- git diff --stat du fichier
- Sortie de lint (10 dernières lignes)
- grep check : "clean" ou liste des restes
- Rien d'autre

````

- [ ] **Step 2.2 — Orchestrator gate (après W2a ET W2b)**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
# Zéro reste DnD dans les deux pages
grep -nE "draggedTask|onDragStart|onDragOver|onDrop|handleDrag" \
  apps/web/app/\[locale\]/tasks/page.tsx \
  apps/web/app/\[locale\]/projects/\[id\]/page.tsx \
  && echo "❌ RESTES DnD" || echo "✅ clean"

# Build complet + tests
pnpm --filter web run lint 2>&1 | tail -10
(cd apps/web && pnpm exec tsc --noEmit 2>&1 | tail -10)
pnpm --filter web test -- TaskKanban 2>&1 | tail -5
````

Expected : `✅ clean`, lint clean, tsc clean, tests verts.

- [ ] **Step 2.3 — Commit Wave 2**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
git add apps/web/app/\[locale\]/tasks/page.tsx apps/web/app/\[locale\]/projects/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
refactor(kanban): replace inline Kanban with <TaskKanban> on /tasks and /projects/[id]

Removes ~450 lines of duplicated DnD state+handlers+JSX and delegates to
the shared component introduced in the previous commit. Drop-zone now
covers the full column wrapper (header included).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Wave 3 — E2E smoke + validation finale (solo, ~30 min)

**Agent :** `e2e-verifier` | **Modèle :** Sonnet | **Dépend de :** W2 commitée

**Files:**

- Create: `e2e/kanban.spec.ts`
- Create: `backlog/kanban-refactor/VERIF-kanban-dropzones.md`

- [ ] **Step 3.1 — Dispatch agent**

````text
Agent (model: "sonnet", subagent_type: "general-purpose", description: "E2E Playwright kanban smoke + VERIF checklist"):

Tu crées un test E2E Playwright smoke et rédiges la checklist de vérification manuelle.

Contexte à LIRE :
- e2e/fixtures/test-fixtures.ts, e2e/fixtures/permission-matrix.ts, e2e/fixtures/roles.ts
- Un test E2E existant pour voir les conventions : e2e/tasks.spec.ts
- CLAUDE.md section "E2E Testing" (utilisation storage state API-based, pas de login UI)
- apps/web/src/components/tasks/TaskKanban.tsx (connaître les data-testid exposés)

=== FICHIER 1 : e2e/kanban.spec.ts ===

Tagué @smoke. Utilise la fixture asRole ou équivalente de test-fixtures.ts pour se connecter en ADMIN.

```ts
import { test, expect } from "./fixtures/test-fixtures";

// Fixture confirmée : e2e/fixtures/test-fixtures.ts exporte asRole(role: Role): Promise<Page>
// Role est en lowercase : 'admin', 'responsable', 'manager', 'referent_technique', 'contributeur', 'observateur'.
// asRole renvoie une Page authentifiée — ne pas utiliser la `page` de base sans l'authentifier.

test.describe("@smoke Kanban drop-zones", () => {
  test("drop is accepted on column header (full-column drop-zone)", async ({ asRole }) => {
    const page = await asRole("admin");
    await page.goto("/fr/tasks");
    await page.waitForSelector('[data-testid^="kanban-column-"]');

    const todoCard = page.locator('[data-testid="kanban-column-TODO"] [data-testid^="kanban-card-"]').first();
    const inProgressHeader = page.locator('[data-testid="kanban-column-IN_PROGRESS"] > div:first-child');
    await expect(todoCard).toBeVisible();
    const taskId = (await todoCard.getAttribute("data-testid"))!.replace("kanban-card-", "");

    // HTML5 DnD via dispatchEvent — drop sur le HEADER (et non sur la liste interne)
    await todoCard.dispatchEvent("dragstart");
    await inProgressHeader.dispatchEvent("dragover");
    await inProgressHeader.dispatchEvent("drop");
    await todoCard.dispatchEvent("dragend");

    await expect(
      page.locator(`[data-testid="kanban-column-IN_PROGRESS"] [data-testid="kanban-card-${taskId}"]`)
    ).toBeVisible({ timeout: 5000 });
  });

  test("drop is accepted on empty column footer area", async ({ asRole }) => {
    const page = await asRole("admin");
    await page.goto("/fr/tasks");
    // Viser la zone scrollable interne (dernier enfant du wrapper colonne)
    // pour vérifier que le drop y est accepté (bubbling vers le wrapper)
    // — à compléter avec le même pattern dispatchEvent que le test précédent
  });

  test("alphabetical order is preserved within a column", async ({ asRole }) => {
    const page = await asRole("admin");
    await page.goto("/fr/tasks");
    await page.waitForSelector('[data-testid="kanban-column-TODO"]');
    const titles = await page
      .locator('[data-testid="kanban-column-TODO"] [data-testid^="kanban-card-"] h3, [data-testid="kanban-column-TODO"] [data-testid^="kanban-card-"] [role="heading"]')
      .allTextContents();
    if (titles.length >= 2) {
      const sorted = [...titles].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
      expect(titles).toEqual(sorted);
    }
  });
});
````

Fixture confirmée présente : `e2e/fixtures/test-fixtures.ts:36` définit `asRole`, signature `async (role: Role) => Promise<Page>`, rôle en lowercase.

Exécution locale :

- `pnpm run docker:dev` (si non déjà up)
- `cd apps/api && pnpm run db:seed` si la base est vide
- `pnpm --filter web dev` en arrière-plan
- `pnpm run test:e2e -- --grep @smoke --project=admin` depuis la racine

=== FICHIER 2 : backlog/kanban-refactor/VERIF-kanban-dropzones.md ===

Checklist au format markdown avec cases à cocher pré-remplies pour le binôme humain :

```md
# VERIF — Kanban drop-zones + <TaskKanban>

Date : <REMPLIR>
Testeur : <REMPLIR>
Branche / commit : <REMPLIR>

## Tests automatisés

- [ ] `pnpm --filter web run lint` → 0 erreur
- [ ] `pnpm run build` → vert
- [ ] `pnpm --filter web test -- TaskKanban` → 8/8 verts, couverture ≥ 80%
- [ ] `pnpm run test:e2e -- --grep @smoke` → 100% vert incluant kanban.spec.ts

## Validation manuelle — /fr/tasks

- [ ] Drop sur l'en-tête coloré d'une colonne (zone titre) → statut mis à jour
- [ ] Drop sur la zone vide sous les cartes (footer interne) → statut mis à jour
- [ ] Drop sur une colonne totalement vide → statut mis à jour
- [ ] Highlight bleu s'étend sur TOUTE la colonne (en-tête inclus) pendant le drag
- [ ] Ordre alphabétique visible après drop
- [ ] Recherche + filtres (priority, assignee) fonctionnent toujours
- [ ] Click sur une carte ouvre la page détail
- [ ] Badges (projet, overdue) affichés comme avant

## Validation manuelle — /fr/projects/[id] (onglet tâches)

- [ ] Mêmes 3 cas de drop (header, footer, colonne vide)
- [ ] Highlight bleu complet
- [ ] Statuts masqués via hiddenStatuses (si applicable) → effectivement absents
- [ ] Rafraîchissement des tâches du projet après drop

## Non-régression

- [ ] Console DevTools propre (0 warning React, 0 erreur 4xx/5xx)
- [ ] Permissions : OBSERVATEUR ne peut pas drag (ou reçoit 403, selon implémentation)
- [ ] Aucune mention DnD restante : `grep -nE "draggedTask|onDragStart|onDragOver|onDrop|handleDrag" apps/web/app/[locale]/tasks/page.tsx apps/web/app/[locale]/projects/[id]/page.tsx` → vide

## Notes testeur

<texte libre>
```

=== LIVRABLE ===
Dernier message :

- Chemins des 2 fichiers
- Sortie (10 lignes) de `pnpm run test:e2e -- --grep @smoke --project=admin`
- Rien d'autre

````

- [ ] **Step 3.2 — Orchestrator gate**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
test -s e2e/kanban.spec.ts && echo "E2E OK"
test -s backlog/kanban-refactor/VERIF-kanban-dropzones.md && echo "VERIF OK"

# Build + tests complets (ceinture et bretelles avant ship)
pnpm run lint 2>&1 | tail -5
pnpm run build 2>&1 | tail -5
pnpm --filter web test 2>&1 | tail -10
pnpm run test:e2e -- --grep @smoke --project=admin 2>&1 | tail -20
````

Expected : tout vert.

- [ ] **Step 3.3 — Commit Wave 3**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
git add e2e/kanban.spec.ts backlog/kanban-refactor/VERIF-kanban-dropzones.md
git commit -m "$(cat <<'EOF'
test(kanban): E2E @smoke drop-zones + VERIF checklist

- e2e/kanban.spec.ts: 3 smoke tests (header drop, footer drop, alpha order)
- backlog/kanban-refactor/VERIF-kanban-dropzones.md for manual QA

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Wave 4 — Ship (orchestrateur Opus, ~10 min)

**Agent :** orchestrateur (pas de dispatch) | **Dépend de :** W3 commitée

- [ ] **Step 4.1 — Sanity global**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
git status
git log --oneline -5
pnpm run build 2>&1 | tail -5
```

Expected : 3 commits (W1, W2, W3), build vert, working tree clean.

- [ ] **Step 4.2 — Push origin master**

(conformément à la mémoire `feedback_orchestra_push_and_deploy` : pas de demande de confirmation)

```bash
git push origin master
```

- [ ] **Step 4.3 — Deploy VPS (vrai SSH+rebuild)**

(conformément à la mémoire `feedback_deploy_workflow_is_fake` : le workflow GitHub ne déploie PAS, il faut un vrai SSH)

```bash
ssh debian@92.222.35.25 'cd /opt/orchestra \
  && git pull origin master \
  && docker compose -f docker-compose.prod.yml build web \
  && docker compose -f docker-compose.prod.yml up -d web'
```

Note : seul le service `web` est touché (pas d'API ni DB modifiées). Si le user a customisé le process de deploy, s'aligner sur son workflow précédent plutôt que rebuild l'ensemble.

- [ ] **Step 4.4 — Verification prod**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://orchestr-a.com/fr/tasks
```

Expected : `200` (ou `302` redirect login). Si `5xx` → rollback par revert du merge push avant toute autre action.

- [ ] **Step 4.5 — Rapport final au user**

Format exact (mémoire `feedback_be_clear_about_progress`) :

```
Livré :
- Composant <TaskKanban> partagé, tests unit 8/8 + couverture NN%
- Pages /tasks et /projects/[id] nettoyées (-~450 l dupliquées)
- E2E @smoke 3/3
- Build vert, commits pushés, prod déployée sur <url>

Reste humain :
- VERIF-kanban-dropzones.md à cocher manuellement par le testeur
```

---

## 3. Critères d'acceptation globaux

(repris SPEC §6, complétés par les observations)

1. `pnpm run lint` vert sur tout le monorepo
2. `pnpm run build` vert
3. `pnpm --filter web test` : tous verts, couverture `TaskKanban.tsx` ≥ 80%
4. `pnpm run test:e2e -- --grep @smoke` : 100% vert incluant `kanban.spec.ts`
5. `grep -nE "draggedTask|onDragStart|onDragOver|onDrop" apps/web/app/[locale]/tasks/page.tsx apps/web/app/[locale]/projects/[id]/page.tsx` → 0 résultat
6. `AUDIT-kanban-dropzones.md` + `VERIF-kanban-dropzones.md` livrés
7. Prod effectivement rebuildée sur VPS (pas juste "workflow vert")

---

## 4. Hors scope (reporté par SPEC §7)

- Unification complète `tasks.card.*` ↔ `tasks.kanban.*` côté `TaskListView` (autre ticket)
- Migration vers TanStack Query mutation avec optimistic update (actuellement refetch complet)
- Persistance d'un ordre utilisateur personnalisable

---

## 5. Règles opératoires (mémoires projet appliquées)

- **Branche :** `master` direct, pas de feature branch (`feedback_no_feature_branches`)
- **Modèle subagents :** `Agent(model: "sonnet")` systématique (`feedback_use_opus_for_agents`)
- **Rejet d'Edit :** si un Edit est rejeté pendant l'exécution, `git diff` AVANT tout commit suivant (`feedback_never_continue_after_reject`)
- **Push + deploy :** auto après Wave 3 verte, sans redemander (`feedback_orchestra_push_and_deploy`)
- **Deploy ≠ workflow :** vrai SSH+rebuild, jamais se fier à `deploy.yml` (`feedback_deploy_workflow_is_fake`)
- **Analyse avant action :** si un gate échoue, STOP + analyse racine, ne pas enchaîner de retry aveugles (`feedback_analyze_before_acting`)
- **Si signalement d'incomplet :** comprendre l'intention, patcher ; pas de "option A ou B ?" théâtrale (`feedback_understand_feature_intent`)
- **Transparence progress :** à chaque fin de wave, dire explicitement ce qui est fait + ce qui reste (`feedback_be_clear_about_progress`)

---

## 6. Mode d'exécution recommandé (sous-skill)

Exécution via `superpowers:subagent-driven-development` :

- Dispatch 1 subagent fresh par wave (sauf W2 = 2 en parallèle, même message)
- Review orchestrateur entre chaque wave via les commandes "gate"
- Si un gate échoue : redispatch le même subagent avec feedback ciblé (pas un fresh), ou corriger à la main si trivial
- Aucun commit n'est fait par un subagent — seul l'orchestrateur commit à la fin de chaque wave, après gate vert

Total estimé : 2h30 calendar (W0a/b parallèle 15', W1 50', W2 parallèle 25', W3 30', W4 10', + gates 20').
