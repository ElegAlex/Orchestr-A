# SPEC — Kanban tâches : drop-zone pleine colonne + extraction `<TaskKanban>` partagé

**Version** : 1.0 | **Date** : 2026-04-22 | **Phase 0 (audit)** : `AUDIT-kanban-dropzones.md` — **validée**

---

## 1. Contexte

Le Kanban des tâches existe en double implémentation inlinée (`/[locale]/tasks`, `/[locale]/projects/[id]`). Deux problèmes à corriger simultanément :

1. **Bug UX** : la drop-zone est le conteneur interne de la liste, borné par `min-h-[200px]` et scrollable. Un drop hors de cette zone interne n'est pas reconnu → cible peu ergonomique.
2. **Dette** : ~150 lignes de JSX + handlers DnD dupliquées, avec divergences mineures (i18n, cursor, boutons statut, badges).

## 2. Décisions architecturales (verrouillées)

| #   | Décision                                        | Valeur                                                                                                                                                                                                                   |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Stratégie                                       | Extraction d'un composant partagé `<TaskKanban>` dans `apps/web/src/components/tasks/`                                                                                                                                   |
| D2  | Surface droppable                               | **Le wrapper entier de colonne** (`min-w-0 bg-white rounded-lg shadow-sm border …`) porte `onDragOver`/`onDragLeave`/`onDrop`. Le header et la liste deviennent des enfants passifs — les events bubblent naturellement. |
| D3  | Highlight drag-over                             | Appliqué sur le **wrapper entier** (en-tête inclus, toute la colonne vire bleu)                                                                                                                                          |
| D4  | Scroll interne                                  | Conservé sur la liste des cartes (`max-h-[calc(100vh-400px)] overflow-y-auto`). Les events DnD bubblent depuis la zone scrollable vers le wrapper droppable sans problème.                                               |
| D5  | Tri dans colonne                                | **Alphabétique par `title`**, appliqué **front-only dans le composant**, via `localeCompare(locale, { sensitivity: 'base' })`. Aucun changement back. `TaskListView` conserve son ordre actuel.                          |
| D6  | Mutation                                        | Identique à l'existant : `PATCH /api/tasks/:id` avec `{ status }` uniquement. Aucune migration Prisma.                                                                                                                   |
| D7  | i18n                                            | Namespace unique consolidé `tasks.kanban.*` pour toutes les clés utilisées par `<TaskKanban>`. Clés manquantes à ajouter. Clés legacy conservées tant que d'autres fichiers les utilisent.                               |
| D8  | Divergences pré-existantes préservées via props | `showProjectBadge`, `showOverdueBadge`, `showStatusArrows`, `hiddenStatuses`                                                                                                                                             |
| D9  | Tests                                           | Unit tests sur `<TaskKanban>` (DnD simulé, tri, filtrage). 1 smoke E2E sur l'élargissement de la drop-zone.                                                                                                              |

## 3. Contrat du composant `<TaskKanban>`

```tsx
// apps/web/src/components/tasks/TaskKanban.tsx

export interface TaskKanbanProps {
  /** Tâches déjà filtrées par la recherche/filtres du parent. Le composant s'occupe du filtrage par statut et du tri alphabétique. */
  tasks: Task[];

  /** Navigation vers détail tâche */
  onTaskClick: (task: Task) => void;

  /** Callback appelé après mise à jour statut réussie. Le parent peut refetch / invalider les queries. */
  onAfterStatusChange?: () => void | Promise<void>;

  /** Statuts à masquer (ex: CANCELLED côté projet). Par défaut aucun. */
  hiddenStatuses?: TaskStatus[];

  /** Afficher la ligne "Projet X" ou "Tâche orpheline" dans la carte. Défaut: false. */
  showProjectBadge?: boolean;

  /** Afficher badge "en retard" dans la carte. Défaut: false. */
  showOverdueBadge?: boolean;

  /** Afficher boutons ←/→ dans la carte pour changer le statut manuellement. Défaut: false. */
  showStatusArrows?: boolean;
}
```

**Responsabilités internes** : état DnD (`draggedTask`, `dragOverColumn`, `isDragging`), handlers DnD, mutation (`tasksService.update`), toast success/error, tri alphabétique, filtrage par statut, rendu des colonnes et cartes.

**Hors responsabilité** : fetching des tâches, search query, filtres (priority, assignee, etc.).

## 4. Matrice fichiers × conflits

| Fichier                                                       | Wave | Nature                       | Conflit avec           |
| ------------------------------------------------------------- | ---- | ---------------------------- | ---------------------- |
| `apps/web/messages/fr.json` (+ autres locales)                | W0   | Additif `tasks.kanban.*`     | —                      |
| `apps/web/src/components/tasks/TaskKanban.tsx`                | W1   | Création                     | —                      |
| `apps/web/src/components/tasks/__tests__/TaskKanban.test.tsx` | W1   | Création                     | —                      |
| `apps/web/app/[locale]/tasks/page.tsx`                        | W2-a | Retrait ~200 lignes + import | Aucun (fichier propre) |
| `apps/web/app/[locale]/projects/[id]/page.tsx`                | W2-b | Retrait ~200 lignes + import | Aucun (fichier propre) |
| `e2e/kanban.spec.ts`                                          | W3   | Création smoke               | —                      |

**Parallélisme** : W2-a et W2-b peuvent être exécutés par deux teammates simultanément (fichiers indépendants, même API).

## 5. Séquencement en waves

### Wave 0 — Consolidation i18n (solo, ~10 min)

**Teammate** : `i18n-agent`

1. Lire `apps/web/messages/fr.json` (et toutes autres locales présentes dans `apps/web/messages/*.json`).
2. Inventorier les clés existantes dans `tasks.*` relatives au Kanban. Clés attendues utilisées actuellement :
   - `tasks.noTasks` (global) / `tasks.kanban.noTasks` (projet)
   - `tasks.card.assignees` / `tasks.kanban.assignees`
   - `tasks.card.estimatedHours` / `tasks.kanban.estimatedHours`
   - `tasks.card.progress` / `tasks.kanban.progress`
   - `tasks.messages.statusUpdateSuccess` / `tasks.messages.statusUpdateError`
   - Titres des colonnes : `tasks.columns.todo`, `tasks.columns.inProgress`, `tasks.columns.inReview`, `tasks.columns.done`, `tasks.columns.blocked` (vérifier la convention actuelle)
3. **Consolider dans `tasks.kanban.*`** :

   ```json
   "kanban": {  "noTasks": "...",  "assignees": "...",  "estimatedHours": "...",  "progress": "...",  "orphanTask": "...",  "overdue": "...",  "columns": { "todo": "...", "inProgress": "...", "inReview": "...", "done": "...", "blocked": "..." },  "messages": { "statusUpdateSuccess": "...", "statusUpdateError": "..." }}
   ```

4. Ne pas supprimer les clés legacy utilisées ailleurs (ex: `tasks.card.*` si `TaskListView` les utilise). Vérifier par recherche `grep -r "tasks\.card\." apps/web/`.
5. Répliquer à l'identique dans toutes les locales présentes.
6. Livrer une note de 5 lignes listant les clés ajoutées.

### Wave 1 — Composant `<TaskKanban>` + tests (solo, ~45 min)

**Teammate** : `kanban-builder` **Dépend de** : Wave 0 terminé (clés i18n disponibles).

1. Créer `apps/web/src/components/tasks/TaskKanban.tsx` conforme au contrat §3.
2. **Structure du rendu** — chaque colonne :

   ```tsx
   <div
     key={column.status}
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
     {" "}
     <div
       className={`${column.color} px-4 py-3 rounded-t-lg border-b border-gray-200`}
     >
       {" "}
       {/* header inchangé */}{" "}
     </div>{" "}
     <div className="p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto">
       {" "}
       {/* cartes triées alphabétiquement — PAS de handlers DnD ici */}{" "}
     </div>
   </div>
   ```

   **Critique** : les handlers DnD sont **uniquement** sur le wrapper extérieur. La liste interne n'en a plus.

3. **Tri alphabétique** :

   ```tsx
   const sortedTasks = useMemo(
     () =>
       [...tasks].sort((a, b) =>
         a.title.localeCompare(b.title, locale, { sensitivity: "base" }),
       ),
     [tasks, locale],
   );
   const getTasksByStatus = (status: TaskStatus) =>
     sortedTasks.filter((t) => t.status === status);
   ```

   `locale` récupéré via `useLocale()` de `next-intl`.

4. **Définition des colonnes** : constante locale `COLUMNS` (array de `{ status, title: t('kanban.columns.X'), color }`) filtrée par `hiddenStatuses`.
5. **Carte** : rendu conditionnel selon `showProjectBadge`, `showOverdueBadge`, `showStatusArrows`. Conserver `cursor-move active:cursor-grabbing select-none` + `style={{ transition: "all 0.2s ease" }}` sur la carte draggable.
6. **Handlers DnD** : reprendre la logique identifiée dans l'audit §6 (`setDraggedTask`, `setDragOverColumn`, `tasksService.update({ status })`). Après succès : `toast.success(t('kanban.messages.statusUpdateSuccess'))` puis `await onAfterStatusChange?.()`.
7. **`e.dataTransfer.setData('text/html', …)`** : ne PAS le reproduire (utile nulle part, bruit identifié dans l'audit §8).
8. **Tests** : créer `apps/web/src/components/tasks/__tests__/TaskKanban.test.tsx` — Jest + Testing Library — couvrant :
   - Rendu : N colonnes affichées, masquage via `hiddenStatuses`.
   - Tri alphabétique : props `[{title:'C'},{title:'A'},{title:'B'}]` → ordre A,B,C dans la colonne.
   - Filtrage par statut : cartes ventilées dans la bonne colonne.
   - Drop : `fireEvent.dragStart` sur carte → `fireEvent.dragOver` sur wrapper colonne cible → `fireEvent.drop` → `tasksService.update` appelé avec `{ status: newStatus }` → `onAfterStatusChange` appelé.
   - Drop sur même statut : pas de mutation.
   - Mocker `tasksService` via `vi.mock` / `jest.mock`.
9. **Qualité** :
   - Pas de `any`.
   - Export `default` du composant + export nommé du type `TaskKanbanProps`.
   - `pnpm --filter @orchestr-a/web run lint` doit passer.
   - `pnpm --filter @orchestr-a/web run test TaskKanban` doit passer (100% des tests ajoutés verts).

### Wave 2 — Refactor pages consommatrices (parallèle, 2 teammates, ~20 min chacun)

**Dépend de** : Wave 1 mergé (composant disponible).

#### Wave 2-a — `apps/web/app/[locale]/tasks/page.tsx`

**Teammate** : `refactor-global-tasks`

1. Supprimer tout le bloc JSX du Kanban (grid 5 colonnes + map + cartes), repéré entre les lignes ~505 et ~735 (inclusif) d'après l'audit.
2. Supprimer les handlers `handleDragStart`, `handleDragEnd`, `handleDragOver`, `handleDragLeave`, `handleDrop` (~lignes 299-342).
3. Supprimer les états DnD : `draggedTask`, `dragOverColumn`, `isDragging` (et leurs setters).
4. Supprimer la constante `columns` (~lignes 351-369) si utilisée nulle part ailleurs.
5. Supprimer `getTasksByStatus` (~lignes 268-270) si utilisé nulle part ailleurs.
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
   ```

7. Conserver intégralement : search bar, filtres (priority, assignee), `filteredTasks`, fetching, etc.
8. Vérifier qu'aucun import n'est devenu orphelin (`toast` peut rester si utilisé ailleurs dans la page).
9. `pnpm --filter @orchestr-a/web run lint` + build TypeScript doivent passer.

#### Wave 2-b — `apps/web/app/[locale]/projects/[id]/page.tsx`

**Teammate** : `refactor-project-tasks`

Identique à 2-a, adapté :

1. Supprimer le bloc Kanban inline (~lignes 1402-1580 d'après l'audit, à confirmer in situ).
2. Supprimer handlers DnD (~lignes 241-283), états DnD, définition inline des colonnes (~lignes 1403-1429).
3. Remplacer par :

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
   ```

   (sans `showProjectBadge`/`showOverdueBadge`/`showStatusArrows` = defaults `false` — parité avec l'existant).

4. Même discipline d'imports et de lint que 2-a.

### Wave 3 — Tests E2E smoke + validation (solo, ~20 min)

**Teammate** : `e2e-verifier` **Dépend de** : Wave 2-a ET Wave 2-b mergées.

1. Créer `e2e/kanban.spec.ts`, tagué `@smoke` :

   ```ts
   test.describe("@smoke Kanban drop-zones", () => {  test("should accept drop on column header area", async ({ page }) => {    // login, aller sur /tasks    // drag d'une carte TODO → drop sur l'en-tête de IN_PROGRESS    // vérifier que la carte est dans la colonne IN_PROGRESS  });  test("should accept drop on empty column footer area", async ({ page }) => {    // drag vers une colonne faiblement remplie, drop en bas du wrapper    // vérifier le nouveau statut  });  test("should preserve alphabetical order within column", async ({ page }) => {    // vérifier ordre des titres dans une colonne ≥ 3 cartes  });});
   ```

2. Sélecteurs : ajouter `data-testid="kanban-column-{status}"` sur le wrapper droppable dans `<TaskKanban>` (petite modif rétroactive à Wave 1 si non fait) et `data-testid="kanban-card-{id}"` sur chaque carte.
3. Exécuter `pnpm test:e2e --grep @smoke` et joindre le rapport.
4. Checklist manuelle documentée dans `VERIF-kanban-dropzones.md` :
   - [ ] `/tasks` : drop sur en-tête coloré → ok
   - [ ] `/tasks` : drop sur zone vide sous les cartes → ok
   - [ ] `/tasks` : drop sur une colonne totalement vide → ok
   - [ ] `/projects/[id]` onglet tâches : mêmes 3 cas → ok
   - [ ] Highlight bleu s'étend sur toute la colonne (en-tête inclus)
   - [ ] Tri alphabétique visible après drop
   - [ ] Aucune régression : ouverture carte au clic, filtres, recherche, badges
   - [ ] Console DevTools propre (ni warning React, ni erreur 4xx/5xx)

## 6. Critères d'acceptation globaux

1. `pnpm run lint` passe sur l'ensemble du monorepo.
2. `pnpm run build` passe sans erreur TypeScript.
3. `pnpm --filter @orchestr-a/web run test` : tous les tests unit verts, couverture `TaskKanban.tsx` ≥ 80%.
4. `pnpm test:e2e --grep @smoke` : 100% vert, y compris les nouveaux tests Kanban.
5. Aucun reste de handler DnD ni d'état `draggedTask` dans les deux pages consommatrices (`grep -n "draggedTask\|onDragStart\|onDragOver\|onDrop" apps/web/app/\[locale\]/tasks/page.tsx apps/web/app/\[locale\]/projects/\[id\]/page.tsx` doit retourner 0 résultat).
6. `VERIF-kanban-dropzones.md` livré avec tous les points cochés.

## 7. Hors scope (dette documentée, pas ici)

- Unification i18n complète `tasks.card.*` ↔ `tasks.kanban.*` côté `TaskListView` (autre ticket).
- Déplacement de `tasksService.update` côté Kanban vers une mutation TanStack Query dédiée avec optimistic update (actuellement refetch complet).
- Persistance d'un ordre utilisateur personnalisable (nécessiterait un champ `kanbanOrder` ou similaire — exclu par décision D5).

---

**Mode d'exécution recommandé** : `TaskCreate` séquentiel pour W0 → W1 → W3. `TeamCreate` pour W2 (deux teammates en parallèle sur `refactor-global-tasks` et `refactor-project-tasks`).

Valide ce spec (ou redirige) et je le formatte dans le prompt de lancement Claude Code final.
