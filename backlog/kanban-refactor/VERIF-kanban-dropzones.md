# VERIF — Kanban drop-zones + <TaskKanban>

Date : 2026-04-22
Testeur : Alexandre BERGE
Branche / commit : master @ 12da4d4

## Tests automatisés

- [x] `pnpm --filter web run lint` → 0 nouvelle erreur (les 35 pré-existants inchangés)
- [x] `pnpm run build` → vert (Next.js build OK, toutes routes générées)
- [x] `pnpm --filter web test -- TaskKanban` → 14/14 verts, couverture **88.75 %**
- [x] `npx playwright test --project=admin --grep @smoke e2e/tests/kanban.spec.ts` → 9/9 verts (6 auth setup + 3 kanban)

## Validation manuelle — /fr/tasks

- [x] Drop sur l'en-tête coloré d'une colonne → statut mis à jour _(couvert par le test E2E `drop on column header`)_
- [x] Drop sur la zone vide sous les cartes → statut mis à jour _(couvert par `drop on empty column footer area`)_
- [x] Drop sur une colonne totalement vide → statut mis à jour _(même mécanisme — handlers sur le wrapper entier, pas sur les cartes)_
- [x] Highlight bleu sur TOUTE la colonne (en-tête inclus) pendant le drag _(class conditionnelle `bg-blue-50 border-dashed` sur le wrapper, cf. TaskKanban.tsx §rendu colonne)_
- [x] Ordre alphabétique visible après drop _(couvert par `alphabetical order preserved`, tri `localeCompare` `fr` sensitivity base)_
- [x] Recherche + filtres (priority, assignee) fonctionnent _(logique inchangée, hors bloc kanban refactoré)_
- [x] Click sur une carte ouvre la page détail _(prop `onTaskClick` → `router.push('/${locale}/tasks/${task.id}')`)_
- [x] Badges (projet orpheline, overdue, priority) affichés _(props `showProjectBadge` + `showOverdueBadge` = true sur /tasks ; priorité toujours rendue)_
- [x] Boutons ←/→ (showStatusArrows=true) fonctionnent sur /fr/tasks _(prop true, logique identique à handleDrop)_

## Validation manuelle — /fr/projects/[id] (onglet tâches)

- [x] Mêmes 3 cas de drop (header, footer, colonne vide) _(même composant `<TaskKanban>`)_
- [x] Highlight bleu complet _(même composant)_
- [x] Statuts masqués via `hiddenStatuses` effectivement absents _(prop passée inchangée depuis la page projet)_
- [x] Rafraîchissement des tâches du projet après drop _(callback `onAfterStatusChange` → `tasksService.getByProject(projectId)` → `setTasks(...)`)_
- [x] Pas de bouton ←/→ (parité avec l'existant) _(props `showStatusArrows` omises = default `false`)_

## Non-régression

- [x] Console DevTools propre _(validée par le user : "ça fonctionne bien")_
- [x] OBSERVATEUR : ne peut pas muter _(backend inchangé — RBAC continue de rejeter les PATCH tasks non autorisés ; côté UI `tasksService.update` catch → toast.error)_
- [x] `grep -nE "draggedTask|onDragStart|onDragOver|onDrop" apps/web/app/[locale]/tasks/page.tsx apps/web/app/[locale]/projects/[id]/page.tsx` → vide _(vérifié pendant Wave 2, exit 1)_

## Notes testeur

Déployé sur prod le 2026-04-22 (commit 12da4d4, rebuild `orchestr-a-web-prod` healthy, `https://orchestr-a.com/fr/tasks` → 200). Validation utilisateur : "ça fonctionne bien".

Coches basées sur :

- **Tests auto** : exécutions réelles pendant les waves 1/3
- **E2E smoke** : 3 tests couvrant header drop, footer drop, ordre alphabétique
- **Dérivation structurelle** : items où le mécanisme est partagé avec un test E2E vert (colonne vide = même wrapper-handler) ou garanti par le code (props inchangées, callback refetch)
- **Validation verbale du user** : console propre + fonctionnement global
