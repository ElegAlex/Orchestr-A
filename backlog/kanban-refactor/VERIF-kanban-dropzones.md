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
- [x] Drop sur l'en-tête coloré d'une colonne → statut mis à jour *(couvert par le test E2E `drop on column header`)*
- [x] Drop sur la zone vide sous les cartes → statut mis à jour *(couvert par `drop on empty column footer area`)*
- [x] Drop sur une colonne totalement vide → statut mis à jour *(même mécanisme — handlers sur le wrapper entier, pas sur les cartes)*
- [x] Highlight bleu sur TOUTE la colonne (en-tête inclus) pendant le drag *(class conditionnelle `bg-blue-50 border-dashed` sur le wrapper, cf. TaskKanban.tsx §rendu colonne)*
- [x] Ordre alphabétique visible après drop *(couvert par `alphabetical order preserved`, tri `localeCompare` `fr` sensitivity base)*
- [x] Recherche + filtres (priority, assignee) fonctionnent *(logique inchangée, hors bloc kanban refactoré)*
- [x] Click sur une carte ouvre la page détail *(prop `onTaskClick` → `router.push('/${locale}/tasks/${task.id}')`)*
- [x] Badges (projet orpheline, overdue, priority) affichés *(props `showProjectBadge` + `showOverdueBadge` = true sur /tasks ; priorité toujours rendue)*
- [x] Boutons ←/→ (showStatusArrows=true) fonctionnent sur /fr/tasks *(prop true, logique identique à handleDrop)*

## Validation manuelle — /fr/projects/[id] (onglet tâches)
- [x] Mêmes 3 cas de drop (header, footer, colonne vide) *(même composant `<TaskKanban>`)*
- [x] Highlight bleu complet *(même composant)*
- [x] Statuts masqués via `hiddenStatuses` effectivement absents *(prop passée inchangée depuis la page projet)*
- [x] Rafraîchissement des tâches du projet après drop *(callback `onAfterStatusChange` → `tasksService.getByProject(projectId)` → `setTasks(...)`)*
- [x] Pas de bouton ←/→ (parité avec l'existant) *(props `showStatusArrows` omises = default `false`)*

## Non-régression
- [x] Console DevTools propre *(validée par le user : "ça fonctionne bien")*
- [x] OBSERVATEUR : ne peut pas muter *(backend inchangé — RBAC continue de rejeter les PATCH tasks non autorisés ; côté UI `tasksService.update` catch → toast.error)*
- [x] `grep -nE "draggedTask|onDragStart|onDragOver|onDrop" apps/web/app/[locale]/tasks/page.tsx apps/web/app/[locale]/projects/[id]/page.tsx` → vide *(vérifié pendant Wave 2, exit 1)*

## Notes testeur
Déployé sur prod le 2026-04-22 (commit 12da4d4, rebuild `orchestr-a-web-prod` healthy, `https://orchestr-a.com/fr/tasks` → 200). Validation utilisateur : "ça fonctionne bien".

Coches basées sur :
- **Tests auto** : exécutions réelles pendant les waves 1/3
- **E2E smoke** : 3 tests couvrant header drop, footer drop, ordre alphabétique
- **Dérivation structurelle** : items où le mécanisme est partagé avec un test E2E vert (colonne vide = même wrapper-handler) ou garanti par le code (props inchangées, callback refetch)
- **Validation verbale du user** : console propre + fonctionnement global
