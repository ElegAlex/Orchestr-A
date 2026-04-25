# Spec — Bouton « + » inversé sur la Vue activité

> Orchestr'A V2 — Module Planning d'activités récurrentes
> Date : 2026-04-25
> Auteur : DSI CPAM 92 (ab@alexandre-berge.fr)
> Statut : design validé, prêt pour implémentation

---

## 1. Contexte et besoin

La **Vue activité** (`ActivityGrid`) est le pivot tâches × jours du module Planning d'activités récurrentes. Elle affiche pour chaque cellule (tâche prédéfinie, jour) la liste des agents assignés.

Aujourd'hui, cette vue est en **lecture seule** : pour ajouter un agent à une tâche, le responsable doit basculer en vue Semaine ou Mois, identifier la cellule (agent, jour), cliquer le bouton `+ Tâche` du `DayCell`, ouvrir la modale `AssignmentModal` qui liste **toutes** les tâches prédéfinies, et sélectionner la bonne. Friction inutile quand l'intention est manifeste : « pour cette permanence le 12 mai, j'ajoute Marie + Paul + Karim ».

Le besoin est de **symétriser** le geste : le `+` du `DayCell` ajoute *une tâche* à *un agent* sur *un jour*. Le `+` de la Vue activité doit ajouter *N agents* à *une tâche* sur *un jour*. Les deux flux écrivent la même `PredefinedTaskAssignment`, donc les deux vues restent cohérentes automatiquement.

---

## 2. Objectifs

- Permettre l'ajout d'agents à une tâche prédéfinie directement depuis la Vue activité.
- **Multi-sélection** : ajouter plusieurs agents en un geste (cas typique en mode planification d'équipe).
- **Symétrie totale** avec le `+` du `DayCell` : même permission, même endpoint backend, même comportement transactionnel.
- **Aucun nouveau backend** : réutilisation pure de `POST /predefined-tasks/assignments/bulk` qui existe déjà.

### Non-objectifs

- **Pas** de nouvelle permission RBAC (réutilise `predefined_tasks:assign`).
- **Pas** de sélecteur de période dans le picker — héritée automatiquement de `defaultDuration` de la tâche prédéfinie (cohérent avec `AssignmentModal`).
- **Pas** de granularité par-agent (ex. Marie matin + Paul après-midi) — hors scope V1, granularité gérée ailleurs.
- **Pas** de scope service appliqué côté front : la liste des agents est globale comme partout dans le planning (cohérent avec `usersService.findAll(1, 1000)` qui n'applique aucun filtre).

---

## 3. UX

### 3.1 Position et apparence du bouton

- **Cellule pleine** : `+ Ajouter` discret en bas de la `<ul>` agents (sous la dernière ligne agent ou sous « +N autres »).
- **Cellule vide** : `+ Ajouter` **remplace** le `—` (visuellement plus actif et invitant).
- **Cellule weekend / férié** : pas de `+` (cohérent avec `isOffDay`).
- **Style** : texte `text-xs`, couleur `text-zinc-400` au repos → `text-blue-600` au survol, fond `hover:bg-blue-50`. Icône `+` Lucide ou caractère unicode au choix.
- **Print** : masqué via classe `no-print` (cohérent avec le bouton Imprimer).
- **Gating** : non rendu si `!canAssign` (`predefined_tasks:assign`).

### 3.2 Modale `AddUsersToTaskModal`

Au clic sur `+`, ouverture d'une modale centrée :

**Header** :
- Titre : « Ajouter des agents »
- Sous-titre : nom de la tâche + date (ex. « Permanence accueil matin · mardi 12 mai 2026 »)
- Pictogramme + couleur de la tâche
- Bouton de fermeture (croix)

**Corps** : liste verticale d'agents triée par `lastName` ascendant. Chaque ligne :
- Checkbox à gauche
- Avatar (composant `UserAvatar`, taille `sm`)
- `Prénom NOM` (NOM en CAPITALES, cohérent avec la cellule de la grille)
- État de la ligne :
  - **Éligible** : checkbox active, ligne cliquable.
  - **Déjà assigné** à T sur J : checkbox cochée + désactivée + libellé italique gris « déjà assigné ».
  - **En congé validé** sur J : checkbox vide + désactivée + libellé italique gris « en congé · {type} » (ex. « en congé · CA »).

Si après filtrage des `existingAssignments` et des `leaves`, **aucun agent n'est éligible** : message centré « Tous les agents sont déjà assignés ou en congé ce jour. ».

**Footer** :
- À gauche : compteur « N agent(s) sélectionné(s) ».
- À droite : bouton « Annuler » (gris) + bouton « Ajouter (N) » (bleu).
  - « Ajouter » désactivé si `selectedUserIds.size === 0`.
  - Pendant submit : libellé « Ajout en cours… », bouton désactivé.

### 3.3 Workflow

```
1. Responsable consulte la Vue activité.
2. Clic sur `+ Ajouter` dans la cellule (Permanence accueil, mardi 12 mai).
3. Modale s'ouvre, liste les agents :
   - Marie D. (cochable)
   - Paul L. (cochée + grisée — déjà assigné)
   - Karim B. (cochable)
   - Sophie M. (grisée — en congé · CA)
4. Sélection de Marie + Karim → compteur « 2 agent(s) sélectionné(s) ».
5. Clic « Ajouter (2) » → POST /predefined-tasks/assignments/bulk.
6. Toast succès « 2 assignations créées ».
7. Modale ferme, planning rafraîchi via TanStack Query.
8. Cellule (Permanence accueil, 12 mai) affiche désormais 3 agents : Paul + Marie + Karim.
9. Vue Semaine / Mois : Marie et Karim voient la nouvelle assignation sur leur ligne du 12 mai.
```

---

## 4. Architecture technique

### 4.1 Composants modifiés / créés

| Fichier | Action | Description |
|---|---|---|
| `apps/web/src/components/planning/AddUsersToTaskModal.tsx` | **NOUVEAU** | Modale de sélection multi-agents |
| `apps/web/src/components/planning/__tests__/AddUsersToTaskModal.test.tsx` | **NOUVEAU** | Tests Jest unitaires |
| `apps/web/src/components/planning/ActivityGrid.tsx` | Modifié | Ajout du bouton `+`, des props `canAssign`, `onAddUsers`, `leaves` |
| `apps/web/src/components/planning/__tests__/ActivityGrid.test.tsx` | Modifié | Cas tests pour le bouton `+` |
| `apps/web/src/components/planning/PlanningView.tsx` | Modifié | State `addUsersTarget`, handler, gating perm, render modale |
| `apps/web/messages/fr.json` | Modifié | Clés i18n nouvelles |
| `e2e/tests/activity-grid-add-users.spec.ts` | **NOUVEAU** | E2E Playwright multi-rôles |

### 4.2 Signature de `AddUsersToTaskModal`

```typescript
interface AddUsersToTaskModalProps {
  task: PredefinedTask;
  date: Date;
  allUsers: UserSummary[];
  existingAssignments: PredefinedTaskAssignment[]; // assignations de la cellule (T, J)
  leaves: Leave[]; // congés validés du jour J (tous agents)
  onClose: () => void;
  onSuccess: () => void;
}
```

### 4.3 Logique d'éligibilité

```typescript
type EligibilityStatus = "eligible" | "already_assigned" | "on_leave";

function getEligibility(
  user: UserSummary,
  existingAssignments: PredefinedTaskAssignment[],
  leaves: Leave[],
  date: Date,
): { status: EligibilityStatus; leaveType?: string } {
  if (existingAssignments.some((a) => a.userId === user.id)) {
    return { status: "already_assigned" };
  }
  const userLeave = leaves.find(
    (l) =>
      l.userId === user.id &&
      l.status === "APPROVED" &&
      isWithinInterval(date, { start: parseISO(l.startDate), end: parseISO(l.endDate) }),
  );
  if (userLeave) {
    return { status: "on_leave", leaveType: userLeave.leaveType?.code ?? userLeave.type };
  }
  return { status: "eligible" };
}
```

### 4.4 Conversion période

Réutilisation stricte de `toPeriod` d'`AssignmentModal` :

```typescript
const toPeriod = (
  duration: TaskDuration,
): "MORNING" | "AFTERNOON" | "FULL_DAY" => {
  if (duration === "HALF_DAY") return "MORNING";
  return "FULL_DAY"; // FULL_DAY et TIME_SLOT → FULL_DAY
};
```

### 4.5 Appel API

```typescript
await predefinedTasksService.bulkAssign({
  predefinedTaskId: task.id,
  userIds: Array.from(selectedUserIds),
  dates: [format(date, "yyyy-MM-dd")],
  period: toPeriod(task.defaultDuration),
});
```

L'endpoint backend `POST /predefined-tasks/assignments/bulk` est **idempotent côté contrainte unique** (Prisma unique sur `(userId, predefinedTaskId, date, period)`). Si un doublon parvient quand même (course condition), il est rejeté en 409. Le filtrage côté front + désactivation des déjà-assignés rendent ce scenario quasi impossible mais on doit gérer le toast d'erreur.

### 4.6 Permissions

| Permission | Rôle | Effet |
|---|---|---|
| `predefined_tasks:assign` | ADMIN, RESPONSABLE, MANAGER, MANAGER_HR_FOCUS, MANAGER_PROJECT_FOCUS, PORTFOLIO_MANAGER | Voit le `+ Ajouter`, peut soumettre |
| absente | CONTRIBUTEUR, OBSERVATEUR, REFERENT_TECHNIQUE | Pas de `+`, lecture seule |

Aucune nouvelle perm. Aucune migration RBAC. Aucun changement de templates.

---

## 5. Data flow

```
ActivityGrid cell (T, J) → onAddUsers(T.id, J)
  ↓
PlanningView setState({ addUsersTarget: { task, date } })
  ↓
<AddUsersToTaskModal
   task={task}
   date={date}
   allUsers={planning.users}
   existingAssignments={cellAssignments}
   leaves={leaves}
   onClose={...}
   onSuccess={refetch}
/>
  ↓ user coche [u1, u2, u3] et valide
predefinedTasksService.bulkAssign({ predefinedTaskId, userIds, dates: [iso], period })
  ↓ POST /predefined-tasks/assignments/bulk
  ↓ TanStack Query invalidates "planning"
  ↓ refetch
ActivityGrid re-render → cellule (T, J) montre les agents mis à jour
DayCell de chaque agent (u1, u2, u3) sur J → montre la nouvelle assignation
```

---

## 6. Tests

### 6.1 Unitaires (`AddUsersToTaskModal.test.tsx` — Jest)

- Liste les agents triés par `lastName` ascendant.
- Coche + désactive un agent déjà assigné, libellé « déjà assigné ».
- Décoche + désactive un agent en congé validé, libellé « en congé · {type} ».
- Ignore les congés `PENDING` (non bloquants).
- Bouton « Ajouter (N) » reflète la taille de la sélection.
- Bouton désactivé si N=0.
- Submit appelle `bulkAssign` avec `{ predefinedTaskId, userIds, dates: [iso], period }`.
- Période = `MORNING` si `defaultDuration === "HALF_DAY"`, sinon `FULL_DAY`.
- Erreur API → toast d'erreur, modale reste ouverte, bouton réactivé.
- État vide affiché si tous les agents sont déjà assignés ou en congé.

### 6.2 Unitaires (`ActivityGrid.test.tsx` — extension W6.2)

- `+ Ajouter` rendu si `canAssign && !isOffDay`.
- Pas rendu si `!canAssign`.
- Pas rendu sur weekend ou jour férié.
- Cellule vide : `+ Ajouter` à la place du `—`.
- Cellule pleine : `+ Ajouter` après la liste agents.
- Clic appelle `onAddUsers(taskId, dateIso)` avec les bons arguments.

### 6.3 E2E Playwright (`activity-grid-add-users.spec.ts`)

- **admin** + **manager** + **responsable** : voient le `+`, peuvent ajouter, vue Semaine reflète immédiatement.
- **contributeur** + **observateur** + **referent_technique** : pas de `+` visible.
- Multi-rôle scenario : manager ajoute 3 agents, switch sur compte agent → voit l'assignation sur sa ligne.
- Idempotence : tenter d'ajouter un agent déjà assigné est impossible (case décochable mais pré-cochée + désactivée).
- Tag `@smoke` sur le scenario admin happy path.

---

## 7. i18n

Nouvelles clés à ajouter dans `apps/web/messages/fr.json` sous `planning.activityGrid` :

```json
{
  "addUsers": "Ajouter",
  "addUsersModal": {
    "title": "Ajouter des agents",
    "subtitle": "{taskName} · {date}",
    "alreadyAssigned": "déjà assigné",
    "onLeave": "en congé · {type}",
    "noEligibleUsers": "Tous les agents sont déjà assignés ou en congé ce jour.",
    "selectedCount": "{count} agent(s) sélectionné(s)",
    "submit": "Ajouter ({count})",
    "submitting": "Ajout en cours…",
    "cancel": "Annuler",
    "successToast": "{count} assignation(s) créée(s)",
    "errorToast": "Erreur lors de l'ajout"
  }
}
```

---

## 8. Edge cases et risques

| Cas | Comportement |
|---|---|
| Tous les agents assignés ou en congé | État vide dans la modale, bouton désactivé |
| Cellule weekend / férié | Pas de bouton `+` |
| Course condition (un autre user ajoute le même agent en parallèle) | API renvoie 409, toast d'erreur, modale reste ouverte, refetch |
| Cellule avec >3 agents (overflow `+N autres`) | Le `+ Ajouter` est sous le `+N autres`, toujours accessible |
| Tâche prédéfinie inactive | Pas concerné : la Vue activité ne liste que les tâches actives |
| Print du planning | Bouton `+` masqué via `.no-print` |
| Mobile / responsive | Modale `max-w-md` centrée, scroll sur la liste agents si > 8 |

### Risques techniques

- **Performance** : si N agents > 200, le rendu de la liste reste OK (texte plain, pas d'images supplémentaires).
- **Re-render planning après mutation** : déjà géré par TanStack Query invalidation, pas de risque de double-refetch.
- **Conflits de cache TanStack** : query key planning unifiée pour les 3 vues, l'invalidation refresh tout en cohérence.

---

## 9. Estimation

~3-4 h dev :

| Étape | Durée |
|---|---|
| `AddUsersToTaskModal` + tests Jest | 1 h |
| Extension `ActivityGrid` (rendu `+`, tests) | 30 min |
| Câblage `PlanningView` (state, handler, props) | 30 min |
| E2E Playwright + clés i18n FR | 1 h |
| QA manuelle locale + déploiement VPS | 30 min |

---

## 10. Critères d'acceptation

1. Sur la Vue activité, chaque cellule (T, J) hors jour férié / weekend affiche un bouton `+ Ajouter` visible uniquement si `canAssign`.
2. Le clic ouvre une modale qui liste tous les agents avec checkboxes, état d'éligibilité affiché clairement.
3. Multi-sélection fonctionne, le bouton « Ajouter (N) » reflète la taille de sélection.
4. La validation crée N assignations en un appel `bulkAssign`, planning rafraîchi automatiquement.
5. La cellule activité ET les cellules agent (vue Semaine/Mois) reflètent la nouvelle assignation après refetch.
6. Aucun doublon possible : agents déjà assignés sont pré-cochés + désactivés.
7. Les agents en congé validé sont grisés + désactivés avec mention du type.
8. CONTRIBUTEUR / OBSERVATEUR / REFERENT_TECHNIQUE ne voient pas le `+`.
9. Tests unitaires Jest passent, E2E Playwright passe sur les 6 rôles.
10. Build complet `pnpm run build` OK.
