# 📅 ANALYSE COMPLÈTE - FEATURE CALENDAR

**Date d'analyse :** 1er octobre 2025
**Scope :** Feature Calendar et ses adhérences avec l'écosystème Orchestr'A

---

## 🎯 OBJECTIF DE L'ANALYSE

Comprendre en profondeur :
1. Architecture et fonctionnement de la feature Calendar
2. Gestion des tâches (projet vs simples)
3. Adhérences et dépendances avec les autres composants
4. Points de friction et opportunités d'amélioration

---

## 📊 ARCHITECTURE GLOBALE

### 1. Points d'Entrée Principaux

```
/pages/Calendar.tsx (792 lignes)
└─ Vue Calendrier Général
   ├─ Affiche TOUTES les tâches (projet + simples)
   ├─ Filtres : type, projet, catégorie
   └─ Modes : Mois, Semaine, Jour

/components/calendar/PlanningCalendar.tsx (2276+ lignes)
└─ Vue Planning Ressources
   ├─ Planning par utilisateur
   ├─ Gestion télétravail intégrée
   ├─ Drag & Drop des tâches
   └─ Calcul de charge et capacité

/components/dashboard/MyPlanning.tsx
└─ Mini Planning Personnel (Dashboard Hub)
   ├─ Vue semaine de l'utilisateur connecté
   ├─ Tâches projet + tâches simples
   └─ Intégré dans le Dashboard Hub V2
```

---

## 🔄 TYPES DE TÂCHES

### Type 1 : **PROJECT TASKS** (Tâches Projet)

**Source :** Collection Firebase `tasks`
**Service :** `task.service.ts`
**Caractéristiques :**
- Liées à un projet (`projectId`)
- Gérées dans l'onglet "Tâches" et "Vue Jalons" des projets
- RACI complet (Responsible, Accountable, Consulted, Informed)
- Peuvent avoir un jalon (`milestoneId`)
- Gestion avancée : dépendances, temps loggué, roadmap

**Champs clés :**
```typescript
{
  id: string;
  projectId: string; // ✅ PRÉSENT
  milestoneId?: string;
  taskCategory: 'PROJECT_TASK'; // Ajouté par transformation
  title: string;
  dueDate: Date;
  status: TaskStatus;
  responsible: string[]; // R du RACI
  accountable: string[];
  consulted: string[];
  informed: string[];
}
```

**Utilisé dans :**
- ProjectTasks (Kanban)
- ProjectRoadmap (par jalons)
- Calendar général
- PlanningCalendar (ressources)
- MyPlanning (Dashboard Hub)
- DashboardHub V2 (widget Mes Tâches)

---

### Type 2 : **SIMPLE TASKS** (Tâches Simples)

**Source :** Collection Firebase `simpleTasks`
**Service :** `simple-task.service.ts`
**Caractéristiques :**
- **NON liées à un projet** (`projectId: undefined`)
- Créées via modal `SimpleTaskModal`
- RACI simplifié : seulement `responsible[]` et `accountable[]`
- Création rapide depuis Calendar
- **Duplication multi-utilisateurs** possible

**Champs clés :**
```typescript
{
  id: string;
  projectId: undefined; // ❌ TOUJOURS ABSENT
  taskCategory: 'SIMPLE_TASK'; // Ajouté par transformation
  title: string;
  dueDate: Date;
  status: TaskStatus;
  responsible: string[]; // Utilisateurs assignés
  accountable: string[]; // Créateur
  // Pas de consulted/informed
}
```

**Utilisé dans :**
- Calendar général
- PlanningCalendar (ressources)
- MyPlanning (Dashboard Hub)
- SimpleTaskModal (création/édition)

---

## 🏗️ SERVICES ET COLLECTIONS FIRESTORE

### Collections Firestore

| Collection | Type | Gérée par | Commentaire |
|------------|------|-----------|-------------|
| `tasks` | Project Tasks | `task.service.ts` | Tâches de projets |
| `simpleTasks` | Simple Tasks | `simple-task.service.ts` | Tâches indépendantes |
| `projects` | Projets | `project.service.ts` | Échéances projets dans Calendar |
| `milestones` | Jalons | `milestone.service.ts` | Organisent les tâches projet |

### Transformation des Données

**Problème identifié :** Les Simple Tasks n'ont pas de `taskCategory` natif en BDD.

**Solution actuelle :** Transformation à la lecture via `transformFirestoreSimpleTask()`

```typescript
// Dans simple-task.service.ts ligne 46
taskCategory: 'SIMPLE_TASK' as TaskCategory,
projectId: undefined, // Toujours undefined pour tâches simples
```

**Impact :** Chaque service doit gérer cette transformation manuellement.

---

## 🔗 ADHÉRENCES ET DÉPENDANCES

### 1. **Calendar.tsx ↔ Autres Composants**

#### Entrées (ce que Calendar.tsx reçoit)

| Source | Type | Via | Usage |
|--------|------|-----|-------|
| `taskService.getTasks()` | Project Tasks | Firestore | Affichage tâches projet |
| `projectService.getActiveProjects()` | Projects | Firestore | Échéances projet + filtres |
| Pas de simple tasks | ❌ | N/A | **MANQUANT** |

**⚠️ PROBLÈME MAJEUR :** Calendar.tsx n'affiche PAS les Simple Tasks actuellement !

Ligne 152-158 :
```typescript
const [allTasks, projectsData] = await Promise.all([
  taskService.getTasks(), // ❌ Seulement PROJECT TASKS
  projectService.getActiveProjects(),
]);
```

#### Sorties (ce que Calendar.tsx peut déclencher)

| Action | Composant appelé | Impact |
|--------|------------------|--------|
| Créer tâche simple | `SimpleTaskModal` | Ajoute dans `simpleTasks` |
| Créer objectif | `CreateObjectiveModal` | Crée tâche projet |
| Afficher planning | `PlanningCalendar` | Lazy loading |

---

### 2. **PlanningCalendar.tsx ↔ Autres Composants**

#### Entrées

| Source | Méthode | Usage |
|--------|---------|-------|
| `taskService.getTasks()` | Via props `selectedProjects` | Tâches projet filtrées |
| `simpleTaskService.getSimpleTasksByDateRange()` | Ligne 68 | ✅ Tâches simples incluses |
| `userService.getUsers()` | Ligne 69 | Affichage par ressource |
| `useTeleworkV2` hook | Ligne 75 | Gestion télétravail |

**✅ BON POINT :** PlanningCalendar affiche bien les deux types de tâches.

#### Fonctionnalités clés

1. **Drag & Drop** (lignes 43-44)
   - Déplacer tâches entre jours
   - Met à jour `dueDate` automatiquement
   - Fonctionne pour projet + simple tasks

2. **Gestion Télétravail** (ligne 75-76)
   - Hook `useTeleworkV2`
   - Composant `TeleworkDayCell`
   - Modal `TeleworkProfileModal`

3. **Création Tâches** (ligne 78)
   - Modal `TaskModalSimplified`
   - Peut créer projet ou simple task

---

### 3. **MyPlanning.tsx (Dashboard Hub) ↔ Autres**

#### Entrées

| Source | Ligne | Type |
|--------|-------|------|
| `taskService.getTasks()` | Ligne 41 | Project Tasks |
| `simpleTaskService.getSimpleTasksByDateRange()` | Ligne 42 | Simple Tasks |
| `capacityService` | Ligne 44 | Capacité utilisateur |

**✅ BON POINT :** MyPlanning affiche les deux types correctement.

#### Logique de filtrage

Ligne 132-168 : Filtre les tâches pour l'utilisateur connecté uniquement
```typescript
// Tâches projet : où userId est dans responsible[]
projectTasks.filter(task => task.responsible?.includes(userId))

// Tâches simples : où userId est dans responsible[]
simpleTasks.filter(task => task.responsible?.includes(userId))
```

---

### 4. **SimpleTaskModal ↔ Écosystème**

**Fichier :** `/components/calendar/SimpleTaskModal.tsx`

#### Fonctionnalités

1. **Création Simple** (ligne 69-80)
   - Formulaire minimal : titre, description, date, priorité
   - Assignation responsables
   - Labels personnalisés

2. **Duplication Multi-Utilisateurs** (ligne 58)
   - `enableDuplication: boolean`
   - `selectedUsers: string[]`
   - Crée une copie par utilisateur sélectionné

3. **Service appelé**
   ```typescript
   // Ligne 40
   simpleTaskService.createSimpleTask(taskData, currentUser.id)
   // OU
   simpleTaskService.createMultipleSimpleTasks(taskData, userIds, currentUser.id)
   ```

#### Où est utilisée cette modal ?

| Composant | Ligne | Contexte |
|-----------|-------|----------|
| Calendar.tsx | Ligne 49 + 94-95 | Créer tâche simple depuis calendrier |
| PlanningCalendar.tsx | ❌ | N'utilise pas cette modal (utilise TaskModalSimplified) |

---

## 🎨 INTERFACES UTILISATEUR

### Vue 1 : **Calendar Général** (`/calendar`)

```
┌────────────────────────────────────────────┐
│ [◄] Octobre 2025 [►]      [Mois▼] [Today] │
├────────────────────────────────────────────┤
│ Filtres:                                   │
│ Type: [Toutes ▼] Projet: [Tous ▼]        │
├────────────────────────────────────────────┤
│ Lun  Mar  Mer  Jeu  Ven  Sam  Dim        │
│  30   1    2    3    4    5    6          │
│ ●──  ●──  ●──  ●──  ●──  ──   ──          │
│ Tâches projet (pas de simples ❌)         │
└────────────────────────────────────────────┘
```

**Actions possibles :**
- Click jour → Ouvre SimpleTaskModal (création tâche simple)
- Click événement → Affiche détails
- Filtrer par type/projet

**⚠️ PROBLÈME :** Les Simple Tasks ne s'affichent PAS !

---

### Vue 2 : **Planning Ressources** (dans Calendar)

```
┌────────────────────────────────────────────┐
│ PLANNING - Semaine du 30 sept au 6 oct    │
├────────────────────────────────────────────┤
│         Lun   Mar   Mer   Jeu   Ven       │
│ Jean    ●●─   ●──   🏠    ●●─   ●──        │
│ Marie   ●──   ●●─   ●──   🏠    ●──        │
│ Paul    🏠    ●──   ●●─   ●──   ●──        │
│                                            │
│ Légende: ● Tâche | 🏠 Télétravail         │
└────────────────────────────────────────────┘
```

**Fonctionnalités :**
- Vue par ressource (utilisateur)
- Drag & Drop des tâches
- Calcul charge/capacité
- Gestion télétravail visuelle
- **Affiche les deux types de tâches** ✅

---

### Vue 3 : **Mon Planning** (Dashboard Hub)

```
┌────────────────────────────────────────────┐
│ 📅 MON PLANNING DE LA SEMAINE             │
│ Lun 30 | Mar 1  | Mer 2  | Jeu 3 | Ven 4  │
│ ────── | ────── | ────── | ───── | ────── │
│ 🏢     | 🏠 TT  | 🏢     | 🏢    | 🏠 TT  │
│                                            │
│ ●Task1 | ●Task2 | ●Task3 | ●T4   | ●T5    │
│ P1-2h  | P0-3h  | P2-4h  | S-1h  | P1-2h  │
│                                            │
│ Total: 2h  3h     4h      1h      2h       │
└────────────────────────────────────────────┘
```

**Légende types :**
- P1, P2 = Tâches projet (priorité)
- S = Tâche simple

**✅ BON POINT :** Affiche les deux types et distingue projet vs simple.

---

## 🔍 FLUX DE DONNÉES

### Flux 1 : Création Tâche Simple depuis Calendar

```
Utilisateur click sur jour dans Calendar.tsx
    ↓
setSimpleTaskModalOpen(true)
    ↓
SimpleTaskModal s'ouvre
    ↓
Utilisateur remplit formulaire
    ↓
simpleTaskService.createSimpleTask(data, userId)
    ↓
Ajout dans collection "simpleTasks" Firestore
    ↓
⚠️ Calendar.tsx ne recharge PAS les simple tasks
    ↓
❌ Nouvelle tâche invisible dans calendrier général
```

**PROBLÈME :** Pas de rechargement, pas d'affichage !

---

### Flux 2 : Affichage Planning Ressources

```
PlanningCalendar.tsx charge
    ↓
Parallel fetch:
  ├─ taskService.getTasks() → Project Tasks
  └─ simpleTaskService.getSimpleTasksByDateRange() → Simple Tasks
    ↓
Fusion des deux listes en CalendarItem[]
    ↓
Affichage par utilisateur et par jour
    ↓
✅ Les deux types sont visibles
```

---

### Flux 3 : Dashboard Hub - Mon Planning

```
MyPlanning.tsx charge
    ↓
Parallel fetch:
  ├─ taskService.getTasks() → Toutes les project tasks
  └─ simpleTaskService.getSimpleTasksByDateRange() → Toutes les simple tasks
    ↓
Filtre côté client:
  tasks.filter(t => t.responsible?.includes(userId))
    ↓
Affichage semaine de l'utilisateur connecté
    ↓
✅ Les deux types sont visibles et filtrés
```

---

## 🚨 PROBLÈMES IDENTIFIÉS

### 1. **Calendar.tsx n'affiche PAS les Simple Tasks** ⚠️⚠️⚠️

**Fichier :** `pages/Calendar.tsx` ligne 152-158

**Code actuel :**
```typescript
const [allTasks, projectsData] = await Promise.all([
  taskService.getTasks(), // ❌ Seulement PROJECT TASKS
  projectService.getActiveProjects(),
]);
```

**Impact :**
- Utilisateur crée tâche simple via modal → Invisible dans calendrier
- Calendrier général incomplet
- Incohérence UX : "Où est ma tâche ?"

**Solution requise :**
```typescript
const [projectTasks, simpleTasks, projectsData] = await Promise.all([
  taskService.getTasks(),
  simpleTaskService.getSimpleTasksByDateRange(threeMonthsAgo, threeMonthsAhead),
  projectService.getActiveProjects(),
]);

const allTasks = [...projectTasks, ...simpleTasks];
```

---

### 2. **Pas de distinction visuelle claire Simple vs Projet**

**Dans Calendar.tsx :**
- Type `CalendarEvent` a un champ `type: 'task' | 'simple_task'`
- Mais affichage identique (pas de badge, pas de couleur différente)

**Amélioration UX :**
- Badge "Projet" vs "Perso" sur les cards
- Couleur différente
- Icône différente (📋 projet, ⚡ simple)

---

### 3. **Filtres Calendar incomplets**

**Filtres actuels (ligne 82-86) :**
```typescript
eventType: 'all' | 'task' | 'simple_task' | 'project' | 'meeting'
project: 'all' | projectId
taskCategory: 'all' | 'PROJECT_TASK' | 'SIMPLE_TASK'
```

**Manque :**
- ❌ Filtre par responsable (utile pour manager)
- ❌ Filtre par statut (TODO, IN_PROGRESS, DONE)
- ❌ Filtre par priorité (P0, P1, P2, P3)

---

### 4. **Duplication entre Calendar et PlanningCalendar**

**Redondances :**
- Même logique de fetch des tâches
- Même transformation des données
- Même gestion des dates

**Opportunité :**
- Créer un hook personnalisé `useCalendarTasks()`
- Centraliser la logique de fetch + transformation
- Réutiliser dans Calendar, PlanningCalendar, MyPlanning

---

### 5. **Performance : Chargement de toutes les tâches**

**Calendar.tsx ligne 153 :**
```typescript
taskService.getTasks() // ❌ TOUTES les tâches sans limite
```

**Problème :**
- Si 1000+ tâches dans la BDD → Temps de chargement
- Pas de pagination
- Pas de virtualisation

**Solution :**
- Charger seulement 3 mois glissants (comme commenté ligne 146)
- Ajouter `getTasksByDateRange()` dans task.service.ts

---

## 🎯 DÉPENDANCES EXTERNES

### Services Firestore Utilisés

| Service | Collection | Utilisé par |
|---------|------------|-------------|
| `task.service.ts` | `tasks` | Calendar, Planning, MyPlanning, Projects |
| `simple-task.service.ts` | `simpleTasks` | Planning, MyPlanning, SimpleTaskModal |
| `project.service.ts` | `projects` | Calendar, Planning (échéances) |
| `milestone.service.ts` | `milestones` | ProjectRoadmap (non dans Calendar) |
| `user.service.ts` | `users` | PlanningCalendar (ressources) |
| `capacity.service.ts` | `capacities` | PlanningCalendar, MyPlanning (calcul charge) |

### Hooks Externes

| Hook | Fichier | Utilisé par | Fonction |
|------|---------|-------------|----------|
| `useTeleworkV2` | `hooks/useTeleworkV2.ts` | PlanningCalendar | Gestion télétravail |
| `useSimulatedUser` | `hooks/useSimulatedPermissions.ts` | Tous les composants | Simulation utilisateur |

### Composants Réutilisés

| Composant | Utilisé dans | Rôle |
|-----------|-------------|------|
| `TaskModalSimplified` | PlanningCalendar, ProjectRoadmap | Créer/éditer tâches projet |
| `SimpleTaskModal` | Calendar | Créer tâches simples |
| `TeleworkDayCell` | PlanningCalendar | Afficher statut télétravail |
| `TeleworkProfileModal` | PlanningCalendar | Configurer télétravail |

---

## 📈 MÉTRIQUES DE COMPLEXITÉ

### Taille des Fichiers

| Fichier | Lignes | Complexité |
|---------|--------|-----------|
| `Calendar.tsx` | 792 | Moyenne |
| `PlanningCalendar.tsx` | 2276+ | **Très Élevée** 🔴 |
| `MyPlanning.tsx` | ~300 | Faible |
| `SimpleTaskModal.tsx` | ~400 | Moyenne |
| `simple-task.service.ts` | 480 | Moyenne |

**⚠️ ALERTE :** PlanningCalendar.tsx est un **monolithe** de 2276+ lignes !

**Refactoring nécessaire :**
- Extraire logique télétravail dans hook/service
- Extraire logique drag & drop dans hook
- Extraire composants UI (Day cell, User row, Task card)

---

## 🔗 GRAPHE DES ADHÉRENCES

```
                    ┌─────────────────┐
                    │  Calendar.tsx   │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼───────┐  ┌────▼─────┐  ┌──────▼──────┐
    │SimpleTaskModal│  │  Project │  │ Planning    │
    │               │  │  Service │  │ Calendar    │
    └───────┬───────┘  └──────────┘  └──────┬──────┘
            │                                 │
    ┌───────▼───────────┐            ┌───────▼────────┐
    │ simple-task       │            │ useTeleworkV2  │
    │ .service.ts       │            │ hook           │
    └───────────────────┘            └────────────────┘
            │
    ┌───────▼────────┐
    │ Firestore      │
    │ "simpleTasks"  │
    └────────────────┘
```

---

## 🎓 BONNES PRATIQUES IDENTIFIÉES

### ✅ Ce qui fonctionne bien

1. **Séparation des Services**
   - `task.service.ts` vs `simple-task.service.ts`
   - Responsabilités claires

2. **Transformation Centralisée**
   - `transformFirestoreSimpleTask()` dans le service
   - Garantit cohérence du type `Task`

3. **Lazy Loading**
   - PlanningCalendar chargé à la demande (Calendar.tsx ligne 54)
   - Réduit bundle initial

4. **Hook Télétravail**
   - `useTeleworkV2` encapsule toute la logique
   - Réutilisable, testable

5. **MyPlanning Performant**
   - Filtre côté client (pas de sur-requêtage)
   - Affichage rapide semaine utilisateur

---

## ❌ Points d'Amélioration

1. **Calendar.tsx incomplet**
   - Ne charge pas les simple tasks
   - Pas de refresh après création

2. **PlanningCalendar trop complexe**
   - 2276+ lignes dans un seul fichier
   - Responsabilités multiples

3. **Duplication de code**
   - Logique de fetch répétée
   - Transformation des événements dupliquée

4. **Pas de tests**
   - Aucun test unitaire visible
   - Risque de régression

5. **Performance**
   - Chargement toutes les tâches sans limite
   - Pas de virtualisation liste

---

## 🚀 RECOMMANDATIONS

### Priorité 1 : **Corriger Calendar.tsx**

**Action :** Ajouter le fetch des simple tasks

**Fichier :** `pages/Calendar.tsx` ligne 152

**Code à ajouter :**
```typescript
const [projectTasks, simpleTasks, projectsData] = await Promise.all([
  taskService.getTasks(),
  simpleTaskService.getSimpleTasksByDateRange(threeMonthsAgo, threeMonthsAhead),
  projectService.getActiveProjects(),
]);

const allTasks = [...projectTasks, ...simpleTasks];
```

**Impact :** ✅ Résout le problème majeur d'affichage

---

### Priorité 2 : **Créer Hook Personnalisé**

**Nouveau fichier :** `hooks/useCalendarTasks.ts`

**Fonction :**
```typescript
export const useCalendarTasks = (startDate: Date, endDate: Date) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      const [projectTasks, simpleTasks] = await Promise.all([
        taskService.getTasksByDateRange(startDate, endDate),
        simpleTaskService.getSimpleTasksByDateRange(startDate, endDate),
      ]);
      setTasks([...projectTasks, ...simpleTasks]);
      setLoading(false);
    };
    fetchTasks();
  }, [startDate, endDate]);

  return { tasks, loading };
};
```

**Utilisé dans :** Calendar, PlanningCalendar, MyPlanning

---

### Priorité 3 : **Refactoring PlanningCalendar**

**Stratégie :**
1. Extraire composants :
   - `PlanningHeader` (navigation, filtres)
   - `PlanningGrid` (grille jours)
   - `UserRow` (ligne utilisateur)
   - `TaskItem` (card tâche draggable)

2. Extraire hooks :
   - `usePlanningDragDrop` (logique drag & drop)
   - `useCapacityCalculation` (calcul charge)

3. Fichiers résultants :
   - `PlanningCalendar.tsx` (orchestrateur ~200 lignes)
   - `hooks/usePlanningDragDrop.ts`
   - `hooks/useCapacityCalculation.ts`
   - `components/planning/PlanningGrid.tsx`
   - `components/planning/UserRow.tsx`
   - `components/planning/TaskItem.tsx`

---

### Priorité 4 : **Améliorer UX**

**1. Distinction visuelle Simple vs Projet**
- Badge sur les cards
- Couleur différente
- Icône spécifique

**2. Filtres avancés**
- Par responsable
- Par statut
- Par priorité

**3. Actions rapides**
- Changer statut depuis calendrier
- Logger temps depuis calendrier
- Dupliquer tâche depuis calendrier

---

### Priorité 5 : **Performance**

**1. Pagination/Virtualisation**
- Charger seulement fenêtre visible
- Virtualisation liste tâches
- Lazy loading images/avatars

**2. Optimisation requêtes**
- Index Firestore sur `dueDate`
- Cache local (IndexedDB)
- Prefetch semaine suivante

**3. Mémoïsation**
- Mémoïser calculs coûteux
- React.memo sur composants purs

---

## 📋 CHECKLIST D'ADHÉRENCE

### Composants qui UTILISENT les tâches du Calendar

- [x] Calendar.tsx (vue principale)
- [x] PlanningCalendar.tsx (planning ressources)
- [x] MyPlanning.tsx (Dashboard Hub)
- [x] DashboardHub V2 - MyTasksWidget (nouveau)
- [ ] Reports (à vérifier)
- [ ] Analytics (à vérifier)

### Composants qui CRÉENT des tâches

- [x] SimpleTaskModal (tâches simples)
- [x] TaskModalSimplified (tâches projet depuis planning)
- [x] ProjectTasks (tâches projet kanban)
- [x] ProjectRoadmap (tâches projet jalons)

### Services DÉPENDANTS

- [x] task.service.ts
- [x] simple-task.service.ts
- [x] project.service.ts
- [x] capacity.service.ts
- [x] workload-calculator.service.ts

### Hooks UTILISÉS

- [x] useTeleworkV2
- [x] useSimulatedUser (simulation)
- [ ] useCalendarTasks (à créer)
- [ ] usePlanningDragDrop (à créer)

---

## 🎬 CONCLUSION

### Points Forts 💪

1. ✅ Séparation claire Project Tasks vs Simple Tasks
2. ✅ PlanningCalendar très complet (télétravail, drag & drop, capacité)
3. ✅ MyPlanning bien intégré dans Dashboard Hub V2
4. ✅ Service SimpleTask bien structuré avec duplication multi-users
5. ✅ Hooks télétravail réutilisable

### Points Faibles 🚨

1. ❌ **Calendar.tsx n'affiche PAS les simple tasks** (bug majeur)
2. ❌ PlanningCalendar monolithique (2276+ lignes)
3. ❌ Duplication logique fetch/transformation
4. ❌ Pas de tests
5. ❌ Performance : chargement sans limite

### Priorités d'Action 🎯

| Priorité | Action | Impact | Effort |
|----------|--------|--------|--------|
| **P0** | Corriger Calendar.tsx (ajouter simple tasks) | 🔴 Critique | 🟢 Faible |
| **P1** | Créer hook useCalendarTasks | 🟡 Moyen | 🟢 Faible |
| **P2** | Refactoring PlanningCalendar | 🟡 Moyen | 🔴 Élevé |
| **P3** | Améliorer UX (badges, filtres) | 🟢 Faible | 🟡 Moyen |
| **P4** | Optimiser performance | 🟢 Faible | 🟡 Moyen |

---

**Prochaines étapes suggérées :**
1. Valider cette analyse avec l'équipe
2. Prioriser les corrections
3. Planifier refactoring PlanningCalendar
4. Ajouter tests unitaires progressivement

---

*Analyse réalisée le 1er octobre 2025*
*Document vivant - À mettre à jour au fil des évolutions*
