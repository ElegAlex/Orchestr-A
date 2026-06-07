# Design — Visuel demi-journée des congés/absences dans la grille planning

- **Date**: 2026-06-05
- **Auteur**: ab@ (validé en brainstorming)
- **Portée**: Frontend uniquement (`apps/web`). Aucun changement API ni schéma.
- **Statut**: validé, prêt pour plan d'implémentation.

## Problème

Dans la grille du planning (`DayCell`), un congé/absence s'affiche en overlay qui
**couvre toute la cellule** et masque toutes les tâches/événements du jour. Le
modèle `Leave` porte pourtant un champ `halfDay` (`MORNING` | `AFTERNOON` | `null`)
qui n'est **pas exploité** visuellement. Attendu : pour un congé demi-journée,
matérialiser la demi-journée (matin/après-midi) et libérer l'autre moitié.

## Donnée (déjà disponible — vérifié)

- Schéma : `Leave.halfDay HalfDay?`, `enum HalfDay { MORNING, AFTERNOON }`.
- L'endpoint `/planning/overview` charge les congés via `LeavesService.findAll`
  qui utilise `include:` (Prisma renvoie alors **tous** les champs scalaires) →
  `halfDay` est présent dans la charge utile.
- Type front `Leave.halfDay?: HalfDay` (`apps/web/src/types/index.ts`), préservé
  par `usePlanningData` (les congés sont filtrés, pas reconstruits).

→ Aucune correction back nécessaire (contrairement au bug `isExternalIntervention`
des tâches, où le `select` omettait le champ).

## Règles de rendu

### 1. Overlay du congé selon `halfDay`

| `halfDay`        | Overlay                                   | Mention sous le nom du type |
| ---------------- | ----------------------------------------- | --------------------------- |
| `null` (journée) | Toute la cellule — **inchangé**           | —                           |
| `MORNING`        | Moitié **haute** (`top:0; height:50%`)    | « Matin »                   |
| `AFTERNOON`      | Moitié **basse** (`bottom:0; height:50%`) | « Après-midi »              |

- Couleur, icône, et style de statut (en attente = bordure pointillée + opacité
  réduite ; validé = plein) restent gérés comme aujourd'hui. On ne modifie que la
  **hauteur** et la **position** de l'overlay + l'ajout de la ligne matin/après-midi.
- La mention matin/après-midi vient de nouvelles clés i18n
  (`planning.dayCell.halfDayMorning` / `halfDayAfternoon`), fr + en.

### 2. Moitié libre = travail visible (option A validée)

- **Congé demi-journée** : on **cesse de masquer** les tâches/événements du jour.
  Ils s'affichent dans la moitié restée libre :
  - congé le **matin** (haut) → tâches/événements poussés dans la **moitié basse** ;
  - congé l'**après-midi** (bas) → tâches/événements dans la **moitié haute**.
- **Congé journée entière** (`halfDay = null`) : masque tout, **inchangé**.
- Pas de filtrage des tâches par horaire (beaucoup n'ont pas de `startTime`). On
  affiche **le même ensemble de tâches qu'aujourd'hui**, contraint à la moitié
  libre ; si plusieurs, la moitié libre est défilable (`overflow-y-auto`).

### 3. Vues & cas limites

- **Vue mois** : la demi-position s'applique (icône en demi-case), **sans** le
  texte matin/après-midi (cohérent avec le nom du type déjà masqué en vue mois).
- **Deux demi-journées le même jour** (ex. CP matin + RTT après-midi) : rendre
  **chaque** congé dans sa moitié (haut + bas). La cellule est alors couverte, pas
  de demi libre. Généralise le rendu actuel qui ne montre que `cell.leaves[0]`.
- **Jour férié + congé** : priorité inchangée (congé prime sur férié).

## Fichiers concernés

- `apps/web/src/components/planning/DayCell.tsx` — overlay congé (demi-position +
  mention), et changement du gating qui masque tâches/événements :
  masquer seulement si congé **journée entière** (ou si les deux demi-journées
  sont occupées), sinon afficher dans la moitié libre.
- `apps/web/messages/fr/planning.json` + `apps/web/messages/en/planning.json` —
  clés `dayCell.halfDayMorning` / `dayCell.halfDayAfternoon`.

## Tests

- **E2E Playwright** (obligatoire, CLAUDE.md) — nouveau spec
  `e2e/tests/workflows/planning-half-day-leave.spec.ts` (admin, `@smoke`) :
  1. créer un congé `MORNING` validé pour un utilisateur visible + une tâche le
     même jour ;
  2. charger le planning, vérifier que l'overlay congé occupe la **moitié haute**
     (assertion sur la classe/hauteur) **et** que la tâche reste **visible** ;
  3. variante `AFTERNOON` (overlay moitié basse, tâche en haut).
- Pas de test API (aucun changement back).

## Hors périmètre

- Aucun changement du modèle de données, de l'API, ni du formulaire de saisie des
  congés.
- Pas de filtrage des tâches par tranche horaire.
- Pas de refonte du style/couleur des types de congé.
