# Dette technique — Duplication du formulaire de création de tâche

**Statut** : ouvert (au moment de la rédaction)
**Identifié le** : 2026-04-11 (au moment d'ajouter la section "Intervenants tiers")
**Priorité** : élevée — bloque toute nouvelle feature sur les tâches par multiplication du coût

## Symptôme

Le formulaire de création de tâche est dupliqué **trois fois** dans le code frontend :

```
apps/web/
├── src/components/TaskModal.tsx                    (668+ lignes, create + edit)
├── src/components/planning/TaskCreateModal.tsx     (485+ lignes, create seul)
└── app/[locale]/tasks/page.tsx                     (1150+ lignes, form inline)
```

Chaque instance a :
- Son propre `formData` state avec les ~15 mêmes champs
- Son propre `handleCreate` / `handleSubmit` / `resetForm`
- Ses propres validations
- Ses propres intégrations `UserMultiSelect`, `ServiceMultiSelect`
- Son propre appel à `tasksService.create(taskData)`
- Et maintenant sa propre section "Intervenants tiers" (ThirdPartySelector + pendingThirdParties + handleAddPendingTp + handleRemovePendingTp + chaînage des POST assignToTask après création)

## Coût observé de la dette

Lors de l'ajout de la feature tiers (Wave 4 → 4.5 → sidebar fix → query DTO fix → couleurs → create-mode fix → all-entry-points fix) :

- **Premier passage Wave 4.5** : TaskModal.tsx patché uniquement, section limitée au mode édition
- **Deuxième passage "tiers-at-create-fix"** : TaskModal.tsx patché pour le mode création avec buffer
- **Troisième passage "all-entry-points-fix"** : découverte que `tasks/page.tsx` et `TaskCreateModal.tsx` ont leur propre formulaire → patch des deux autres

**Résultat** : 3 commits au lieu d'un, ~216 lignes ajoutées (essentiellement la même logique copiée 3 fois), et une session utilisateur très frustrée parce que la feature ne marchait pas partout pour des raisons purement structurelles.

## Champs partagés (à factoriser)

Tous présents à l'identique dans les 3 formulaires :

| Champ | Type | Obligatoire | Composant |
|---|---|---|---|
| `title` | string | ✅ | input text |
| `description` | string | ❌ | textarea |
| `status` | TaskStatus | ❌ (default TODO) | select |
| `priority` | Priority | ❌ (default NORMAL) | select |
| `projectId` | string \| null | ❌ (orphan possible) | select |
| `milestoneId` | string | ❌ | select (conditionné projectId) |
| `assigneeIds` | string[] | ❌ | UserMultiSelect |
| `serviceIds` | string[] | ❌ | ServiceMultiSelect |
| `estimatedHours` | number | ❌ | input number |
| `startDate` | string (ISO date) | ❌ | input date |
| `endDate` | string (ISO date) | ❌ | input date |
| `startTime` | string (HH:MM) | ❌ | input time |
| `endTime` | string (HH:MM) | ❌ | input time |
| `isExternalIntervention` | boolean | ❌ | checkbox |
| `thirdParties` (nouveau Wave 4.5) | `{id,organizationName}[]` | ❌ | ThirdPartySelector + liste |

TaskModal.tsx a un champ supplémentaire :
- `subtasks` — liste de sous-tâches (mode édition uniquement, via `subtaskService`)

## Divergences connues entre les 3 formulaires

| Aspect | TaskModal | TaskCreateModal | tasks/page.tsx |
|---|---|---|---|
| Mode | create + edit | create seul | create seul |
| assigneeId par défaut | vide | currentUser.id | vide |
| Sous-tâches | ✅ (édition) | ❌ | ❌ |
| Récupération projects | prop | fetch inline au mount | fetch global au mount |
| Récupération users | prop | fetch inline | fetch inline |
| Récupération services | prop | fetch inline | fetch inline |
| Reset form | oui | oui | oui |

## Solution proposée : extraction `TaskForm`

### API cible

```tsx
interface TaskFormProps {
  mode: "create" | "edit";
  initialData?: Partial<Task>;
  projectId?: string | null;
  projects: Project[];
  milestones?: Milestone[];
  users: User[];
  services: Service[];
  memberCounts?: Record<string, number>;
  hiddenStatuses?: TaskStatus[];
  /**
   * Appelé au submit. Le formulaire passe les données brutes + les tiers
   * en attente. Le parent fait l'appel API et retourne la tâche créée/mise
   * à jour, puis le formulaire chaîne les assignations tiers si nécessaire.
   */
  onSubmit: (
    data: CreateTaskDto | UpdateTaskDto,
    pendingThirdParties: { id: string; organizationName: string }[],
  ) => Promise<Task | void>;
  onCancel: () => void;
  submitLabel?: string;
  /**
   * Défaut initial pour assigneeIds — utilisé par TaskCreateModal planning
   * pour pré-sélectionner currentUser
   */
  defaultAssigneeIds?: string[];
  /**
   * Active la gestion des sous-tâches (mode édition uniquement)
   */
  enableSubtasks?: boolean;
}
```

### Wrappers

```tsx
// 1. TaskModal (remplace src/components/TaskModal.tsx)
export function TaskModal({ isOpen, onClose, task, projectId, ... }) {
  if (!isOpen) return null;
  return (
    <ModalShell onClose={onClose}>
      <TaskForm
        mode={task ? "edit" : "create"}
        initialData={task}
        projectId={projectId}
        projects={projects}
        ...
        onSubmit={async (data, pendingTps) => {
          const created = task
            ? await tasksService.update(task.id, data)
            : await tasksService.create(data);
          if (pendingTps.length > 0 && !task) {
            await Promise.all(pendingTps.map(p =>
              thirdPartiesService.assignToTask(created.id, p.id)
            ));
          }
          return created;
        }}
        enableSubtasks={!!task?.id}
      />
    </ModalShell>
  );
}

// 2. TaskCreateModal (remplace src/components/planning/TaskCreateModal.tsx)
export function TaskCreateModal({ isOpen, onClose, onSuccess }) {
  // fetch initial data une fois pour toutes
  ...
  return (
    <ModalShell onClose={onClose}>
      <TaskForm
        mode="create"
        projects={projects}
        users={users}
        services={services}
        defaultAssigneeIds={user?.id ? [user.id] : []}
        onSubmit={...}
      />
    </ModalShell>
  );
}

// 3. tasks/page.tsx — remplace le formulaire inline
{showCreateModal && (
  <ModalShell onClose={() => setShowCreateModal(false)}>
    <TaskForm
      mode="create"
      projects={projects}
      users={users}
      services={services}
      onSubmit={...}
    />
  </ModalShell>
)}
```

### Bénéfices

- **1 seul fichier source** pour les champs, validations, intégrations
- Ajouter un champ = 1 modif, pas 3
- Corriger un bug de validation = 1 modif
- Les tests de caractérisation du formulaire vivent au même endroit
- Réduction estimée : ~800 lignes dupliquées → ~400 lignes dans `TaskForm` + ~50 par wrapper
- **Net gain estimé** : ~600 lignes supprimées

### Risques de la migration

- **Régression fonctionnelle** sur les 3 flows — il y a des micro-différences aujourd'hui qu'il ne faut pas effacer par inadvertance (assigneeId par défaut, fetch de projects, etc.)
- **Tests existants** à réadapter — au moins `apps/web/app/[locale]/tasks/__tests__/page.test.tsx` utilise le formulaire inline
- **Comportement de la modale** vs page inline — la page tasks/page.tsx n'est PAS une modale à proprement parler (pas de `Dialog` Radix), c'est un formulaire dans un `<div>` positionné. L'extraction doit préserver cette flexibilité (wrapper = juste le shell visuel, pas la logique)
- **Subtasks dans TaskModal** — feature complexe qui ne vit que dans un des 3 formulaires. Doit rester optionnelle via `enableSubtasks`

## Stratégie de migration (quand on y reviendra)

1. **Caractérisation** : créer des tests Playwright qui exercent les 3 flows de création actuels avec la même série d'actions (titre, description, assigneeIds, tiers si applicable). Ces tests doivent passer AVANT et APRÈS le refactor à l'identique.
2. **Extraction de `TaskForm`** : créer le composant + adapter `TaskModal` comme premier consommateur (c'est celui qui a le plus de features, subtasks inclus). Vérifier que le flow `/projects/[id]/page.tsx` fonctionne toujours.
3. **Migration de `TaskCreateModal`** (planning) : second consommateur. Vérifier le flow `/planning`.
4. **Migration de `tasks/page.tsx`** : troisième consommateur. Vérifier le flow `/tasks`.
5. **Nettoyage** : retirer le code dupliqué des 3 fichiers, garder uniquement le wrapper + l'appel à `<TaskForm />`.
6. **Tests Playwright** : relancer la suite de caractérisation, confirmer zéro régression.

## État actuel (au moment de la rédaction)

La section "Intervenants tiers" est dupliquée dans les 3 formulaires et fonctionne dans les 3. La dette est **contenue** mais **active** : toute prochaine feature sur les tâches paiera à nouveau le coût de la duplication.

## Quand traiter cette dette

- **Dès que possible** : idéalement avant la prochaine feature qui touche aux tâches (Wave 5 E2E a déjà passé — pas d'impact immédiat, mais le prochain ajout de champ va frapper)
- **Au plus tard** : avant la prochaine grosse évolution du modèle `Task` en base (qui impliquerait typiquement des changements de formulaire)
