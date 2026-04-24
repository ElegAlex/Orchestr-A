# Mockups Planning d'activités récurrentes — 2026-04-24

Trois surfaces UI à densité élevée dont l'implémentation est gatée par une validation PO explicite du mockup, en application de la règle interne « mockup visuel obligatoire avant refonte UI complexe ».

## Surfaces concernées

| Surface | Epic | Fichier | Story bloquée si non validé |
|---|---|---|---|
| Popover de transition de statut d'exécution | E3.2 | [E3.2-status-popover.html](./E3.2-status-popover.html) | W2 — T3.2.1 `AssignmentStatusBadge` |
| Modale Planning équilibré (configuration + aperçu) | E4.3 | [E4.3-balanced-planning-modal.html](./E4.3-balanced-planning-modal.html) | W3 — T4.3.1 `BalancedPlanningModal` |
| Grille Vue Activité (pivot jours × tâches) | E5.2 | [E5.2-activity-grid.html](./E5.2-activity-grid.html) | W4 — T5.2.1 `ActivityGrid` |

## Processus de validation PO

1. Ouvrir chaque fichier dans un navigateur (file:// ou double-clic).
2. Parcourir les 2 à 3 variantes proposées par surface, lire les pros/cons annotés sous chaque variante.
3. **Choisir une variante par surface** (A, B, C, ou D selon ce qui est proposé).
4. Communiquer le choix au DSI :
   - soit par mail à ab@alexandre-berge.fr ;
   - soit par commentaire dans la PR (si ouverte) ;
   - soit par message direct.
5. Dès validation reçue, le sous-agent UI correspondant reçoit la variante comme **contrainte d'implémentation** (pas de liberté créative supplémentaire).

## Validations PO (2026-04-24)

| Surface | Variante choisie | Rationale |
|---|---|---|
| E3.2 popover transition de statut | **C — Expansion inline dans la cellule** | Pas de z-index ni overlay, cohérent avec pattern "edit-in-place" ; la cellule DayCell s'élargit au clic, motif NOT_APPLICABLE saisi in-place |
| E4.3 Modale Planning équilibré | **C — Split layout config à gauche, aperçu à droite** | Config + résultats visibles en même temps (≥ 1280px), itérations rapides sans scroll |
| E5.2 Grille Vue Activité | **B — Grille aérée, avatars 32px** | Lisibilité prioritaire sur densité maximale ; badge statut textuel à droite du groupe d'avatars |

Ces choix sont contraignants pour les tâches W2.5 (E3.2), W3.3 (E4.3), W4.3 (E5.2).

## Principes techniques communs aux 3 mockups

- **Tailwind CDN** uniquement (reproductible sans build).
- **SVG Lucide inline**, pas de dépendance externe — rendu identique en prod (lib `lucide-react` déjà utilisée dans Orchestr'A).
- **Palette** : zinc-50/100/200/800, blue-600 primary, emerald-500 success, amber-500 warning, red-500 alert.
- **Accessibilité AA** : focus visible, aria-label explicites, contrastes conformes.
- **Zéro JavaScript** : les mockups sont purement statiques — les interactions réelles seront implémentées en React/Radix UI.

## Prochaines étapes après validation

Une fois les 3 variantes validées, le plan d'implémentation (`docs/superpowers/plans/2026-04-24-planning-activites-recurrentes.md`) peut continuer :

- **W1** peut démarrer sans attendre les mockups (pondération `weight` — surface UI simple, pas de mockup requis).
- **W2** : le sous-agent E3.2 attend la variante choisie.
- **W3** : le sous-agent E4.3 attend la variante choisie.
- **W4** : le sous-agent E5.2 attend la variante choisie.

## Contexte métier résumé

Le lot « Planning d'activités récurrentes » répond au besoin IA nº01 remonté par le Contrôle de Gestion (CPAM 92, Cabinet de la Direction, 6 utilisateurs). 5 épopées (E1 à E5) couvrent les 30 % d'écart fonctionnel identifiés par l'analyse de couverture du 23 avril 2026. Le lot bénéficie à tout service ayant un besoin de rotation ou de permanence (SCI, Support, accueil).
