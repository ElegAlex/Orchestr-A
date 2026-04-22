# VERIF — Kanban drop-zones + <TaskKanban>

Date : <à remplir>
Testeur : <à remplir>
Branche / commit : <à remplir>

## Tests automatisés
- [ ] `pnpm --filter web run lint` → 0 nouvelle erreur (le total des 35 pré-existants peut subsister)
- [ ] `pnpm run build` → vert
- [ ] `pnpm --filter web test -- TaskKanban` → 14/14 verts, couverture ≥ 80%
- [ ] `pnpm run test:e2e -- --grep @smoke --project=admin` → kanban.spec.ts vert

## Validation manuelle — /fr/tasks
- [ ] Drop sur l'en-tête coloré d'une colonne → statut mis à jour
- [ ] Drop sur la zone vide sous les cartes → statut mis à jour
- [ ] Drop sur une colonne totalement vide → statut mis à jour
- [ ] Highlight bleu sur TOUTE la colonne (en-tête inclus) pendant le drag
- [ ] Ordre alphabétique visible après drop
- [ ] Recherche + filtres (priority, assignee) fonctionnent
- [ ] Click sur une carte ouvre la page détail
- [ ] Badges (projet orpheline, overdue, priority) affichés
- [ ] Boutons ←/→ (showStatusArrows=true) fonctionnent sur /fr/tasks

## Validation manuelle — /fr/projects/[id] (onglet tâches)
- [ ] Mêmes 3 cas de drop (header, footer, colonne vide)
- [ ] Highlight bleu complet
- [ ] Statuts masqués via hiddenStatuses effectivement absents
- [ ] Rafraîchissement des tâches du projet après drop
- [ ] Pas de bouton ←/→ (parité avec l'existant)

## Non-régression
- [ ] Console DevTools propre (0 warning React, 0 erreur 4xx/5xx)
- [ ] OBSERVATEUR : ne peut pas muter (403 ou action bloquée)
- [ ] `grep -nE "draggedTask|onDragStart|onDragOver|onDrop" apps/web/app/[locale]/tasks/page.tsx apps/web/app/[locale]/projects/[id]/page.tsx` → vide

## Notes testeur
<texte libre>
