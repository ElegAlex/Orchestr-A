# Détails des Propositions d'Amélioration UX - Dashboard

**Date** : 20 novembre 2025
**Contexte** : Amélioration de la vue planning individuelle sur le dashboard

---

## 📋 Table des Matières

1. [Priorité 1 - Quick Wins](#priorité-1---quick-wins)
2. [Priorité 2 - Améliorations Ergonomiques](#priorité-2---améliorations-ergonomiques)
3. [Priorité 3 - Fonctionnalités Avancées](#priorité-3---fonctionnalités-avancées)
4. [Priorité 4 - Polish Visuel](#priorité-4---polish-visuel)
5. [Impacts et Effort](#impacts-et-effort)

---

## Priorité 1 - Quick Wins

### 1. Planning Collapsible/Expandable

#### Problème Identifié
- Le planning prend **beaucoup d'espace vertical** (min-height: 100px par ligne en vue semaine)
- Sur un écran standard, le planning peut faire **600-800px de hauteur**
- Les sections importantes (tâches à venir, projets) sont **poussées en bas**, nécessitant du scroll
- L'utilisateur veut parfois juste **voir un aperçu rapide** sans tout le détail

#### Solution Détaillée

**Composant : Accordion Planning**

```typescript
// État par défaut : Collapsed
const [isExpanded, setIsExpanded] = useState(false);

// Modes d'affichage
enum PlanningDisplayMode {
  COLLAPSED = 'collapsed',  // Preview 3 jours seulement
  EXPANDED = 'expanded',    // Vue complète
}
```

**Vue Collapsed (par défaut)** :
- Affiche **seulement 3 jours** : hier, aujourd'hui, demain
- Hauteur fixe : **120px maximum**
- Affichage simplifié :
  - Indicateur télétravail (🏠/🏢)
  - Nombre de tâches (badge "3 tâches")
  - Aucun détail des tâches (juste des pastilles colorées)
- Bouton en bas : **"Voir tout mon planning"** avec icône ⬇️

**Vue Expanded** :
- Planning complet actuel (vue semaine)
- Bouton : **"Réduire"** avec icône ⬆️

**Interactions** :
- Click sur le bouton toggle l'état
- Animation smooth (transition height 300ms)
- Préférence sauvegardée en localStorage

**Design** :
```
┌─────────────────────────────────────────────────────┐
│ Mon planning                           [⬇️ Voir tout]│
├─────────────────────────────────────────────────────┤
│  Hier        │  Aujourd'hui  │  Demain              │
│  🏢          │  🏠           │  🏢                   │
│  ●●          │  ●●●          │  ●                    │
│  2 tâches    │  3 tâches     │  1 tâche              │
└─────────────────────────────────────────────────────┘
```

**Implémentation** :
- Nouveau composant : `CollapsiblePlanningView.tsx`
- Props : `defaultExpanded?: boolean`
- Hook personnalisé : `usePlanningCollapse()`

**Effort** : ~2-3 heures
**Impact UX** : ⭐⭐⭐⭐⭐ (contrôle de l'espace, moins de scroll)

---

### 2. Indicateur de Charge de Travail dans les KPI

#### Problème Identifié
- Les 4 KPI actuelles montrent des **compteurs bruts** : nombre de projets, tâches
- **Aucune indication sur la charge réelle de travail** en heures
- Impossible de savoir si l'utilisateur est **en surcharge** ou **sous-utilisé**
- Les managers ne peuvent pas identifier rapidement les **risques de burnout**

#### Solution Détaillée

**Nouvelle 5ème Carte KPI : "Charge de travail"**

**Calculs** :
```typescript
// Charge totale = somme des heures estimées des tâches en cours + à faire
const workload = tasks
  .filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS')
  .filter(t => !t.endDate || new Date(t.endDate) <= nextWeekDate)
  .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

// Charge recommandée : 35-40h par semaine
const weeklyCapacity = 40;
const workloadPercentage = (workload / weeklyCapacity) * 100;
```

**Affichage dynamique** :
- **Valeur principale** : "32h" (heures totales)
- **Indicateur visuel** selon le niveau :
  - ✅ < 35h : Icône verte "👌" + texte "Charge normale"
  - ⚠️ 35-40h : Icône orange "⚡" + texte "Proche de la capacité"
  - 🔥 > 40h : Icône rouge "🔥" + texte "Surcharge détectée"
- **Sous-texte** : "sur 40h/semaine" ou "8 tâches à faire"

**Barre de progression** :
```
┌───────────────────────────────────┐
│ Charge de travail            🔥   │
│                                   │
│         42h                       │
│                                   │
│ ████████████░░░░ 105%             │
│ Surcharge détectée                │
└───────────────────────────────────┘
```

**Couleurs** :
- Vert (< 35h) : `bg-green-100 text-green-800`
- Orange (35-40h) : `bg-orange-100 text-orange-800`
- Rouge (> 40h) : `bg-red-100 text-red-800`

**Tooltip au hover** :
```
Détail de votre charge :
• 5 tâches TODO : 18h
• 3 tâches EN COURS : 24h
─────────────────────
Total : 42h sur 40h disponibles
```

**Click sur la carte** :
- Ouvre un modal avec répartition détaillée par projet
- Suggestions : "Déléguer 2h" ou "Reporter 1 tâche"

**Implémentation** :
- Ajouter la carte dans `dashboard/page.tsx` après les 4 KPI existantes
- Nouvelle fonction : `calculateWorkload(tasks: Task[]): WorkloadStats`
- Composant : `WorkloadKPICard.tsx`

**Effort** : ~3-4 heures
**Impact UX** : ⭐⭐⭐⭐⭐ (info critique pour l'utilisateur et son manager)

---

### 3. Quick Actions sur le Planning

#### Problème Identifié
- Le planning est **passif**, seulement en lecture
- Pour faire une action simple (déclarer télétravail), il faut :
  1. Cliquer sur l'icône télétravail dans le planning
  2. Attendre le refresh
- Pas de **raccourci** vers le planning complet
- Aucun **résumé actionnable**

#### Solution Détaillée

**Barre d'actions au-dessus du planning**

**Design** :
```
┌─────────────────────────────────────────────────────────────┐
│ Mon planning                                                │
│ ┌─────────────┐ ┌──────────────────┐ ┌─────────────────┐  │
│ │ 🏠 Télétravail│ │ 📅 Planning complet│ │ 5 tâches       │  │
│ │   demain     │ │                  │ │ cette semaine  │  │
│ └─────────────┘ └──────────────────┘ └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Action 1 : Toggle Télétravail Rapide**
- Bouton : "🏠 Télétravail demain"
- Affichage dynamique :
  - Si demain = télétravail déjà déclaré → "🏢 Retour au bureau demain"
  - Si demain = bureau → "🏠 Télétravail demain"
- Click = toggle immédiat + toast de confirmation
- API call async en background

**Action 2 : Lien Planning Complet**
- Bouton : "📅 Planning complet"
- Click → redirect vers `/planning?userId={user.id}` (planning avec filtre pré-appliqué)
- Alternative : ouvre le planning en modal overlay

**Action 3 : Badge Tâches Cliquable**
- Badge : "5 tâches cette semaine"
- Couleurs dynamiques :
  - Vert si < 5 tâches
  - Orange si 5-10 tâches
  - Rouge si > 10 tâches
- Click → scroll smooth vers la section "Mes tâches à venir"
- Tooltip : "3 TODO, 2 EN COURS"

**Action 4 (bonus) : Quick Add Task**
- Bouton : "+ Nouvelle tâche"
- Click → modal rapide pour créer une tâche
- Champs pré-remplis : assigneeId = user.id, endDate = aujourd'hui

**Implémentation** :
- Composant : `PlanningQuickActions.tsx`
- Intégration dans `PlanningView` via prop `showQuickActions?: boolean`
- Services : utiliser les services existants (telework, tasks)

**Code exemple** :
```typescript
const handleQuickTelework = async () => {
  const tomorrow = addDays(new Date(), 1);
  const existing = teleworkSchedules.find(ts =>
    isSameDay(new Date(ts.date), tomorrow) && ts.userId === user.id
  );

  if (existing) {
    await teleworkService.update(existing.id, { isTelework: !existing.isTelework });
  } else {
    await teleworkService.create({
      date: format(tomorrow, 'yyyy-MM-dd'),
      isTelework: true,
      userId: user.id
    });
  }

  toast.success(existing?.isTelework ? 'Bureau confirmé' : 'Télétravail confirmé');
  refetch();
};
```

**Effort** : ~4-5 heures
**Impact UX** : ⭐⭐⭐⭐ (actions rapides, gain de temps)

---

## Priorité 2 - Améliorations Ergonomiques

### 4. Tri/Filtrage des "Tâches à venir"

#### Problème Identifié
- Section "Mes tâches à venir" affiche actuellement :
  - **Tâches non terminées** avec échéance dans les **7 prochains jours**
  - Affichage : **5 premières tâches** seulement (`.slice(0, 5)`)
  - Ordre : **non défini** (ordre de retour API)
- Problèmes :
  - Impossible de voir **les plus urgentes** en priorité
  - Pas de distinction entre "aujourd'hui" et "dans 6 jours"
  - Tâches en **retard** (endDate < today) non visibles
  - Pas de filtre par **projet** ou **priorité**

#### Solution Détaillée

**Système de Tabs + Filtres**

**Tabs** :
```
┌────────────────────────────────────────────────────┐
│ Mes tâches à venir                                 │
│ ┌─────────┐ ┌────────────┐ ┌─────────┐ ┌────────┐│
│ │⚠️ Urgentes│ │Cette semaine│ │Toutes   │ │Filtres▼││
│ └─────────┘ └────────────┘ └─────────┘ └────────┘│
└────────────────────────────────────────────────────┘
```

**Tab 1 : Urgentes (par défaut)**
- Critères :
  - Tâches avec `endDate <= aujourd'hui + 2 jours`
  - OU tâches avec `priority = CRITICAL ou HIGH`
  - OU tâches avec `status = BLOCKED`
- Badge rouge si tâche en retard : `endDate < today`
- Tri : par date croissante puis priorité

**Tab 2 : Cette semaine**
- Critères actuels : tâches dans les 7 prochains jours
- Tri : par date puis priorité

**Tab 3 : Toutes**
- Toutes les tâches non terminées (pas de limite de date)
- Affiche jusqu'à 10 tâches
- Bouton "Voir toutes mes tâches" → redirect `/tasks?assigneeId={user.id}`

**Dropdown "Filtres"** :
```
Trier par :
• Date d'échéance ↓
• Date d'échéance ↑
• Priorité (Haute → Basse)
• Priorité (Basse → Haute)
• Projet (A-Z)
• Statut

Filtrer par projet :
☐ Projet Alpha
☐ Projet Beta
☑ Refonte Site Web

Filtrer par priorité :
☑ Critique
☑ Haute
☐ Normale
☐ Basse
```

**Indicateurs visuels** :
```typescript
// Badge "En retard"
{task.endDate && new Date(task.endDate) < new Date() && (
  <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
    ⚠️ En retard
  </span>
)}

// Bordure rouge pour tâches urgentes
className={`p-4 rounded-lg ${
  isUrgent(task) ? 'border-2 border-red-500 bg-red-50' : 'bg-gray-50'
}`}
```

**Compteurs dans les tabs** :
```
[⚠️ Urgentes (3)] [Cette semaine (12)] [Toutes (28)]
```

**Implémentation** :
```typescript
const [activeTab, setActiveTab] = useState<'urgent' | 'week' | 'all'>('urgent');
const [sortBy, setSortBy] = useState<'date' | 'priority' | 'project'>('date');
const [filterProjects, setFilterProjects] = useState<string[]>([]);
const [filterPriorities, setFilterPriorities] = useState<Priority[]>(['CRITICAL', 'HIGH']);

const filteredTasks = useMemo(() => {
  let tasks = myTasks;

  // Tab filtering
  if (activeTab === 'urgent') {
    const urgentDate = addDays(new Date(), 2);
    tasks = tasks.filter(t =>
      (t.endDate && new Date(t.endDate) <= urgentDate) ||
      t.priority === 'CRITICAL' ||
      t.priority === 'HIGH' ||
      t.status === 'BLOCKED'
    );
  }

  // Project filtering
  if (filterProjects.length > 0) {
    tasks = tasks.filter(t => filterProjects.includes(t.projectId));
  }

  // Priority filtering
  if (filterPriorities.length > 0) {
    tasks = tasks.filter(t => filterPriorities.includes(t.priority));
  }

  // Sorting
  return tasks.sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    }
    // ... autres tris
  });
}, [myTasks, activeTab, sortBy, filterProjects, filterPriorities]);
```

**Effort** : ~5-6 heures
**Impact UX** : ⭐⭐⭐⭐ (focus sur l'urgent, meilleure priorisation)

---

### 5. Vue Compacte du Planning

#### Problème Identifié
- Mode **semaine** affiche **5 jours** (lundi-vendredi)
- Sur écrans < 1400px : scroll horizontal nécessaire
- Sur mobile : planning **illisible**
- Dashboard = vue d'ensemble, pas besoin de voir **toute la semaine**
- L'utilisateur veut souvent savoir : "**Qu'est-ce que j'ai aujourd'hui et demain ?**"

#### Solution Détaillée

**Nouveau mode : Vue Compacte (3 jours)**

**Toggle dans PlanningView** :
```
┌─────────────────────────────────────────────────┐
│ Mon planning                [Compact] [Semaine] │
└─────────────────────────────────────────────────┘
```

**Affichage Compact** :
- **3 colonnes** : Hier | Aujourd'hui | Demain
- Largeur fixe : ~100px par colonne = **300px total**
- Pas de scroll horizontal même sur mobile
- Focus sur **l'immédiat**

**Calcul des jours** :
```typescript
const getCompactDays = () => {
  const today = new Date();
  return [
    subDays(today, 1), // Hier
    today,             // Aujourd'hui
    addDays(today, 1)  // Demain
  ];
};
```

**Design Compact** :
```
┌──────────┬───────────────┬──────────┐
│  Hier    │  Aujourd'hui  │  Demain  │
│  Lun 18  │  Mar 19 🔵    │  Mer 20  │
├──────────┼───────────────┼──────────┤
│          │               │          │
│   🏢     │     🏠        │   🏢     │
│          │               │          │
│   ●●     │    ●●●        │    ●     │
│ 2 tâches │  3 tâches     │ 1 tâche  │
│          │               │          │
│ ◐ Refonte│ ● Dashboard   │ ○ Tests  │
│ ◕ API    │ ◐ Backend     │          │
│          │ ○ Docs        │          │
└──────────┴───────────────┴──────────┘
```

**Indicateur visuel "Aujourd'hui"** :
- Colonne centrale avec fond bleu clair
- Badge 🔵 ou icône horloge
- Texte en gras

**Responsive** :
- **Desktop** : choix manuel (toggle compact/semaine)
- **Tablet (< 1024px)** : compact par défaut
- **Mobile (< 768px)** : compact forcé
- Mémorisation de la préférence : localStorage

**Props PlanningView** :
```typescript
interface PlanningViewProps {
  // ... existing props
  compactMode?: boolean;           // Active le mode compact
  allowCompactToggle?: boolean;    // Affiche le toggle
  autoCompactOnMobile?: boolean;   // Auto-compact sur mobile
}
```

**Implémentation** :
```typescript
const [isCompact, setIsCompact] = useState(
  autoCompactOnMobile && window.innerWidth < 1024
);

const displayDays = useMemo(() => {
  if (isCompact) {
    return getCompactDays(currentDate);
  }
  // ... logique semaine/mois existante
}, [currentDate, viewMode, isCompact]);
```

**Effort** : ~3-4 heures
**Impact UX** : ⭐⭐⭐⭐ (lisibilité mobile, focus immédiat)

---

### 6. Statistiques de Congés dans KPI

#### Problème Identifié
- Dashboard affiche des métriques **projets/tâches** uniquement
- Aucune visibilité sur **les congés** :
  - Jours disponibles (CP, RTT)
  - Jours posés à venir
  - Jours utilisés cette année
- Utilisateur doit aller dans `/leaves` pour cette info
- **Info RH critique** manquante sur le dashboard

#### Solution Détaillée

**Nouvelle Carte KPI (ou section dédiée)**

**Option A : 6ème Carte KPI**
```
┌─────────────────────────────────┐
│ Congés disponibles         🌴   │
│                                 │
│         18 jours                │
│                                 │
│ 5 jours posés à venir           │
│ 7 jours utilisés (2025)         │
└─────────────────────────────────┘
```

**Option B : Section Congés dédiée**
```
┌────────────────────────────────────────────────────┐
│ 📅 Mes congés (2025)                               │
├────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐ ┌───────────┐│
│ │ CP disponibles│ │ RTT restants  │ │ À venir   ││
│ │     18j       │ │      5j       │ │    3j     ││
│ └───────────────┘ └───────────────┘ └───────────┘│
│                                                    │
│ Prochains congés : 23-27 Déc (5j)                 │
│ [Poser une demande]                               │
└────────────────────────────────────────────────────┘
```

**Données à récupérer** :
```typescript
interface LeaveBalance {
  cpAvailable: number;      // CP disponibles
  cpUsed: number;           // CP utilisés cette année
  cpTotal: number;          // CP total annuel
  rttAvailable: number;     // RTT restants
  rttUsed: number;          // RTT utilisés
  rttTotal: number;         // RTT total annuel
  pendingLeaves: Leave[];   // Demandes en attente
  approvedLeaves: Leave[];  // Congés approuvés à venir
}
```

**API nécessaire** :
```typescript
// Nouvelle route backend
GET /api/leaves/balance/:userId
Response: {
  cpBalance: {
    available: 18,
    used: 7,
    total: 25
  },
  rttBalance: {
    available: 5,
    used: 7,
    total: 12
  },
  upcomingLeaves: [
    { startDate: '2025-12-23', endDate: '2025-12-27', days: 5, type: 'CP' }
  ],
  pendingRequests: 2
}
```

**Calculs** :
```typescript
const calculateLeaveBalance = (leaves: Leave[], user: User) => {
  const currentYear = new Date().getFullYear();
  const yearLeaves = leaves.filter(l =>
    new Date(l.startDate).getFullYear() === currentYear &&
    l.status === 'APPROVED'
  );

  const cpUsed = yearLeaves
    .filter(l => l.type === 'CP')
    .reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);

  const rttUsed = yearLeaves
    .filter(l => l.type === 'RTT')
    .reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);

  return {
    cpAvailable: user.annualLeaveEntitlement - cpUsed,
    cpUsed,
    rttAvailable: user.rttEntitlement - rttUsed,
    rttUsed
  };
};
```

**Affichage conditionnel** :
- Si `cpAvailable < 5` → Couleur orange "⚠️ Pensez à poser vos congés"
- Si `cpAvailable < 2` → Couleur rouge "🚨 Congés non posés à risque"
- Badge notification si `pendingRequests > 0`

**Actions rapides** :
- Bouton "Poser une demande" → modal rapide
- Lien "Voir mon historique" → redirect `/leaves`
- Timeline des congés à venir avec dates

**Effort** : ~6-7 heures (backend + frontend)
**Impact UX** : ⭐⭐⭐⭐ (info RH essentielle, reminder proactif)

---

## Priorité 3 - Fonctionnalités Avancées

### 7. Timeline Visuelle des Jalons

#### Problème Identifié
- Dashboard montre les **tâches** mais pas les **jalons** (milestones)
- Jalons = **deadlines critiques** des projets
- Utilisateur ne voit pas **les échéances importantes à venir**
- Pas de vue d'ensemble des **livrables attendus**
- Risque de **manquer une deadline** majeure

#### Solution Détaillée

**Section "Prochains jalons" sous le planning**

**Design Timeline Horizontale** :
```
┌──────────────────────────────────────────────────────────────────┐
│ 🎯 Prochains jalons (30 prochains jours)                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Aujourd'hui                                                     │
│      │                                                           │
│      ●─────────────●─────────────────────●────────────────●     │
│    23 Nov        27 Nov               5 Déc            15 Déc   │
│   Release v1    Sprint Review       Beta Testing      Go Live   │
│   Projet Alpha  Projet Beta        Projet Alpha    Projet Alpha │
│                                                                  │
│  [◀ Mois précédent]                        [Mois suivant ▶]     │
└──────────────────────────────────────────────────────────────────┘
```

**Affichage des jalons** :
- Timeline horizontale avec **axe des dates**
- Jalons = **points** sur la timeline
- Couleurs par statut :
  - 🟢 Vert : jalon atteint (completedAt !== null)
  - 🟡 Jaune : jalon à venir (< 7 jours)
  - 🔴 Rouge : jalon en retard (dueDate < today && !completed)
  - ⚪ Gris : jalon futur (> 7 jours)

**Tooltip au hover** :
```
🎯 Release v1.0
─────────────────────
📅 Date : 23 Nov 2025
📁 Projet : Refonte Alpha
📊 Progression : 78%
👤 Responsable : Jean Dupont

[Voir le détail]
```

**Click sur un jalon** :
- Ouvre modal avec :
  - Description du jalon
  - Liste des tâches associées
  - Progression globale (% tâches terminées)
  - Responsables
  - Bouton "Marquer comme atteint"

**Filtrage** :
- Affiche seulement les jalons des **projets actifs** de l'utilisateur
- Période : **30 prochains jours** par défaut
- Boutons navigation : Mois précédent/suivant

**Calcul de la progression** :
```typescript
interface MilestoneWithProgress extends Milestone {
  progress: number;        // 0-100
  tasksTotal: number;
  tasksCompleted: number;
  daysUntil: number;       // Jours restants
  status: 'completed' | 'upcoming' | 'overdue' | 'future';
}

const calculateMilestoneProgress = (milestone: Milestone, tasks: Task[]) => {
  const milestoneTasks = tasks.filter(t => t.milestoneId === milestone.id);
  const completed = milestoneTasks.filter(t => t.status === 'DONE').length;

  return {
    ...milestone,
    progress: (completed / milestoneTasks.length) * 100,
    tasksTotal: milestoneTasks.length,
    tasksCompleted: completed,
    daysUntil: differenceInDays(new Date(milestone.dueDate), new Date()),
    status: milestone.completedAt ? 'completed'
      : new Date(milestone.dueDate) < new Date() ? 'overdue'
      : differenceInDays(new Date(milestone.dueDate), new Date()) < 7 ? 'upcoming'
      : 'future'
  };
};
```

**Indicateurs visuels** :
- Barre de progression sous chaque jalon
- Badge rouge si en retard
- Animation pulse si < 3 jours

**Responsive** :
- Desktop : Timeline complète
- Mobile : Liste verticale avec cartes

**API nécessaire** :
```typescript
GET /api/milestones/upcoming?userId={id}&days=30
Response: [
  {
    id: "...",
    title: "Release v1.0",
    dueDate: "2025-11-23",
    project: { id: "...", name: "Projet Alpha" },
    tasks: [...],
    progress: 78
  }
]
```

**Effort** : ~8-10 heures (composant timeline custom)
**Impact UX** : ⭐⭐⭐⭐⭐ (anticipation deadlines, vue d'ensemble)

---

### 8. Widget "Ma Journée"

#### Problème Identifié
- Dashboard affiche des **stats globales** et **vues à venir**
- **Aucun focus sur la journée en cours**
- Utilisateur doit **chercher** dans le planning pour voir "aujourd'hui"
- Pas de vue **synthétique** de ce qu'il doit faire **maintenant**
- Manque de **gamification** (checklist satisfaction)

#### Solution Détaillée

**Card épinglée en haut du dashboard (après le welcome)**

**Design** :
```
┌────────────────────────────────────────────────────────┐
│ 📅 Ma journée - Mardi 19 novembre 2025          🏠     │
├────────────────────────────────────────────────────────┤
│ ✅ Mes tâches du jour (3/5 terminées)                  │
│                                                        │
│ ☑ ◐ Finaliser le dashboard         [2h] [Haute]      │
│ ☐ ○ Réunion daily                  [30m] [Normal]     │
│ ☐ ○ Code review PR #234            [1h] [Haute]       │
│ ☐ ○ Tests unitaires                [3h] [Normal]      │
│ ☑ ● Documentation API               [1h] [Basse]      │
│                                                        │
│ ⏱️ Temps enregistré : 5h30 / 7h30 prévues            │
│ │████████████░░░░░░│ 73%                              │
│                                                        │
│ 📊 Prochaine tâche suggérée : Code review PR #234     │
│ [Démarrer] [Reporter à demain]                        │
└────────────────────────────────────────────────────────┘
```

**Éléments affichés** :

**1. En-tête** :
- Date du jour formatée
- Icône télétravail/bureau (🏠 ou 🏢)
- Badge météo (si intégration API météo) : ☀️ 18°C

**2. Liste des tâches du jour** :
- Critères : `task.endDate === today` OU `task.startDate === today`
- Checkbox interactives pour cocher/décocher
- Icône de statut (○ ◐ ◕ ●)
- Durée estimée et priorité
- Drag & drop pour réorganiser l'ordre

**3. Compteur de progression** :
```typescript
const todayProgress = {
  completed: tasks.filter(t => t.status === 'DONE').length,
  total: tasks.length,
  percentage: (completed / total) * 100
};
```

**4. Temps enregistré** :
- Si module time-tracking actif :
  - Somme des `timeEntries` du jour
  - Comparaison avec le temps estimé
  - Barre de progression
- Alerte si dépassement : "⚠️ Dépassement de 2h"

**5. Suggestion intelligente** :
- Algorithme de priorisation :
  1. Tâches CRITICAL en premier
  2. Tâches avec deadline aujourd'hui
  3. Tâches BLOCKED (à débloquer)
  4. Tâches IN_PROGRESS (à finir)
  5. Tâches TODO par priorité

**6. Actions rapides** :
- Bouton "Démarrer" → change status à IN_PROGRESS + start timer
- Bouton "Reporter" → modal pour choisir nouvelle date
- Bouton "+ Ajouter une tâche"

**Interactions** :

**Click sur checkbox** :
```typescript
const handleTaskToggle = async (taskId: string, currentStatus: TaskStatus) => {
  const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
  await tasksService.update(taskId, { status: newStatus });

  if (newStatus === 'DONE') {
    // Confetti animation
    confetti({ particleCount: 100, spread: 70 });
    toast.success('🎉 Tâche terminée !');
  }

  refetch();
};
```

**Gamification** :
- Animation confetti quand toutes les tâches sont terminées
- Message motivant : "🎉 Super boulot ! Journée complète à 100%"
- Streak counter : "🔥 5 jours consécutifs avec toutes les tâches terminées"

**Mode collapsed** :
- Par défaut : expanded
- Bouton minimize → affiche seulement :
  ```
  📅 Ma journée (3/5) ████████░░ 60%  [Voir détail ⬇️]
  ```

**Responsive** :
- Desktop : card full width
- Mobile : liste verticale compacte

**Effort** : ~10-12 heures (logique + interactions + gamification)
**Impact UX** : ⭐⭐⭐⭐⭐ (focus immédiat, satisfaction utilisateur, motivation)

---

### 9. Notifications Intelligentes

#### Problème Identifié
- Dashboard est **passif**, aucune alerte
- Utilisateur doit **chercher** les problèmes :
  - Tâche bloquée depuis longtemps
  - Deadline approchant
  - Conflit de planning (trop de tâches le même jour)
- Pas de **notifications proactives**
- Risque de **manquer des alertes importantes**

#### Solution Détaillée

**Système de notifications multi-canal**

**1. Badge de notification sur le planning**
```
┌────────────────────────────────────────┐
│ Mon planning                    [🔔 3] │
└────────────────────────────────────────┘
```

**Types de notifications** :

**A. Tâche bloquée longtemps**
```typescript
{
  type: 'BLOCKED_TASK',
  severity: 'warning',
  title: 'Tâche bloquée depuis 5 jours',
  message: 'La tâche "Intégration API" est bloquée depuis le 14 Nov',
  task: { id: '...', title: '...' },
  action: 'Débloquer',
  link: '/tasks/abc123'
}
```

**B. Deadline < 24h**
```typescript
{
  type: 'DEADLINE_SOON',
  severity: 'urgent',
  title: 'Deadline demain !',
  message: 'La tâche "Release v1.0" est due demain à 17h00',
  task: { id: '...', title: '...' },
  action: 'Voir la tâche',
  link: '/tasks/def456'
}
```

**C. Conflit de planning**
```typescript
{
  type: 'PLANNING_CONFLICT',
  severity: 'info',
  title: 'Surcharge détectée',
  message: 'Vous avez 5 tâches prévues pour vendredi (15h estimées)',
  action: 'Réorganiser',
  link: '/planning'
}
```

**D. Tâche en retard**
```typescript
{
  type: 'OVERDUE_TASK',
  severity: 'urgent',
  title: 'Tâche en retard',
  message: '2 tâches sont passées en retard',
  action: 'Voir les tâches',
  link: '/tasks?filter=overdue'
}
```

**E. Demande de congé en attente**
```typescript
{
  type: 'LEAVE_PENDING',
  severity: 'info',
  title: 'Demande de congé en attente',
  message: 'Votre demande du 23-27 Déc attend validation',
  action: 'Voir la demande',
  link: '/leaves'
}
```

**2. Toast au chargement du dashboard**
```typescript
useEffect(() => {
  const notifications = getActiveNotifications(user, tasks, leaves);

  notifications
    .filter(n => n.severity === 'urgent')
    .forEach(n => {
      toast.error(n.message, {
        duration: 5000,
        action: {
          label: n.action,
          onClick: () => router.push(n.link)
        }
      });
    });

  notifications
    .filter(n => n.severity === 'warning')
    .forEach(n => {
      toast.warning(n.message, { duration: 4000 });
    });
}, [user, tasks, leaves]);
```

**3. Panel de notifications**
```
┌────────────────────────────────────────────────────┐
│ 🔔 Notifications (3)                      [Tout lu]│
├────────────────────────────────────────────────────┤
│ ⚠️ Tâche bloquée depuis 5 jours           [11:24]  │
│    Intégration API - Projet Alpha                  │
│    [Débloquer] [Ignorer]                           │
├────────────────────────────────────────────────────┤
│ 🚨 Deadline demain !                      [Hier]   │
│    Release v1.0 - Due le 20 Nov à 17h00           │
│    [Voir la tâche]                                 │
├────────────────────────────────────────────────────┤
│ ℹ️ Surcharge vendredi                     [15 Nov] │
│    5 tâches prévues (15h estimées)                │
│    [Réorganiser]                                   │
└────────────────────────────────────────────────────┘
```

**4. Logique de détection**
```typescript
const detectNotifications = (
  tasks: Task[],
  leaves: Leave[],
  telework: TeleworkSchedule[]
): Notification[] => {
  const notifications: Notification[] = [];
  const now = new Date();

  // Tâches bloquées > 3 jours
  tasks
    .filter(t => t.status === 'BLOCKED')
    .forEach(t => {
      const blockedDays = differenceInDays(now, new Date(t.updatedAt));
      if (blockedDays >= 3) {
        notifications.push({
          type: 'BLOCKED_TASK',
          severity: blockedDays >= 7 ? 'urgent' : 'warning',
          task: t,
          message: `Bloquée depuis ${blockedDays} jours`
        });
      }
    });

  // Deadlines < 24h
  tasks
    .filter(t => t.endDate && t.status !== 'DONE')
    .forEach(t => {
      const hoursUntil = differenceInHours(new Date(t.endDate), now);
      if (hoursUntil > 0 && hoursUntil <= 24) {
        notifications.push({
          type: 'DEADLINE_SOON',
          severity: 'urgent',
          task: t,
          message: `Deadline dans ${hoursUntil}h`
        });
      }
    });

  // Tâches en retard
  tasks
    .filter(t => t.endDate && new Date(t.endDate) < now && t.status !== 'DONE')
    .forEach(t => {
      notifications.push({
        type: 'OVERDUE_TASK',
        severity: 'urgent',
        task: t,
        message: `En retard depuis ${differenceInDays(now, new Date(t.endDate))} jours`
      });
    });

  // Conflits de planning (> 8h de tâches le même jour)
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(now, i));
  next7Days.forEach(day => {
    const dayTasks = tasks.filter(t =>
      t.endDate && isSameDay(new Date(t.endDate), day)
    );
    const totalHours = dayTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

    if (totalHours > 8) {
      notifications.push({
        type: 'PLANNING_CONFLICT',
        severity: 'warning',
        message: `${format(day, 'EEEE', { locale: fr })} : ${totalHours}h prévues`,
        date: day
      });
    }
  });

  return notifications.sort((a, b) => {
    // Tri par sévérité puis date
    const severityOrder = { urgent: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
};
```

**5. Préférences utilisateur**
```typescript
interface NotificationPreferences {
  enabled: boolean;
  channels: {
    toast: boolean;      // Toast au chargement
    badge: boolean;      // Badge sur le planning
    email: boolean;      // Email digest quotidien
  };
  filters: {
    blockedTasks: boolean;
    deadlines: boolean;
    conflicts: boolean;
    overdue: boolean;
  };
}
```

**6. Actions rapides sur notifications**
- Click → navigation vers la ressource
- Bouton "Ignorer" → masque la notification (localStorage)
- Bouton "Reporter" → snooze 24h
- Bouton "Résoudre" → action contextuelle (débloquer, terminer, etc.)

**Effort** : ~12-15 heures (logique détection + UI + persistance)
**Impact UX** : ⭐⭐⭐⭐⭐ (proactivité, prévention problèmes, alerte temps réel)

---

### 10. Mode Drag & Drop Simplifié

#### Problème Identifié
- Drag & drop **existe** dans le planning
- Mais pas **évident** pour les nouveaux utilisateurs
- Aucun **hint visuel** qu'on peut drag
- Pas de **feedback** pendant le drag
- Pas d'**undo** si drag accidentel
- Fonction **cachée**, découverte par hasard

#### Solution Détaillée

**Amélioration de la discoverability et du feedback**

**1. Hint au hover**
```typescript
// Sur les tâches du planning
<div
  className="task-card cursor-move"
  title="Glissez pour déplacer la tâche"
  onMouseEnter={() => setShowDragHint(true)}
>
  {showDragHint && (
    <div className="absolute -top-8 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded">
      👆 Glissez-moi pour me déplacer
    </div>
  )}
  ...
</div>
```

**2. Icône de drag visible**
```
┌────────────────────────────┐
│ ⠿⠿ ◐ Finaliser dashboard  │ ← icône grip
│    ⏱️ 2h                   │
└────────────────────────────┘
```

**3. Animation au drag**
```typescript
const handleDragStart = (task: Task) => {
  setDraggedTask(task);

  // Réduire l'opacité de la tâche d'origine
  document.querySelector(`[data-task-id="${task.id}"]`)
    ?.classList.add('opacity-50', 'scale-95');

  // Highlight des zones de drop valides
  document.querySelectorAll('.day-cell')
    .forEach(cell => cell.classList.add('ring-2', 'ring-blue-300', 'bg-blue-50'));
};
```

**4. Feedback visuel pendant le drag**
```
┌────────────────────────────┐
│         Lundi 18           │
│ ┌────────────────────────┐ │
│ │  Déposez ici  ↓        │ │ ← Zone de drop visible
│ └────────────────────────┘ │
└────────────────────────────┘
```

**5. Curseur personnalisé**
```css
.dragging {
  cursor: grabbing !important;
}

.task-card {
  cursor: grab;
}

.task-card:active {
  cursor: grabbing;
}
```

**6. Animation de drop réussi**
```typescript
const handleDrop = async (userId: string, date: Date) => {
  if (!draggedTask) return;

  try {
    // Animation de "slide" de l'ancienne position vers la nouvelle
    const taskElement = document.querySelector(`[data-task-id="${draggedTask.id}"]`);
    taskElement?.animate([
      { transform: 'scale(1.1)', opacity: 0.8 },
      { transform: 'scale(1)', opacity: 1 }
    ], { duration: 300, easing: 'ease-out' });

    await tasksService.update(draggedTask.id, {
      assigneeId: userId,
      endDate: date.toISOString()
    });

    toast.success('Tâche déplacée', {
      duration: 3000,
      action: {
        label: 'Annuler',
        onClick: () => handleUndo()
      }
    });

    // Stocker l'action pour undo
    setLastDragAction({
      taskId: draggedTask.id,
      previousUserId: draggedTask.assigneeId,
      previousEndDate: draggedTask.endDate,
      timestamp: Date.now()
    });

    refetch();
  } catch (error) {
    toast.error('Impossible de déplacer la tâche');
  }

  setDraggedTask(null);

  // Reset highlight
  document.querySelectorAll('.day-cell')
    .forEach(cell => cell.classList.remove('ring-2', 'ring-blue-300', 'bg-blue-50'));
};
```

**7. Système Undo**
```typescript
interface DragAction {
  taskId: string;
  previousUserId: string;
  previousEndDate: string;
  timestamp: number;
}

const [lastDragAction, setLastDragAction] = useState<DragAction | null>(null);

const handleUndo = async () => {
  if (!lastDragAction) return;

  // Vérifier que l'action a < 10 secondes
  if (Date.now() - lastDragAction.timestamp > 10000) {
    toast.error('Action trop ancienne pour être annulée');
    return;
  }

  await tasksService.update(lastDragAction.taskId, {
    assigneeId: lastDragAction.previousUserId,
    endDate: lastDragAction.previousEndDate
  });

  toast.success('Action annulée');
  setLastDragAction(null);
  refetch();
};
```

**8. Zones de drop intelligentes**
```typescript
// Empêcher le drop sur certaines conditions
const canDrop = (userId: string, date: Date): boolean => {
  // Pas de drop dans le passé (sauf aujourd'hui)
  if (date < startOfDay(new Date()) && !isToday(date)) {
    return false;
  }

  // Pas de drop sur un jour de congé
  const hasLeave = leaves.some(l =>
    l.userId === userId &&
    isSameDay(new Date(l.startDate), date)
  );
  if (hasLeave) {
    return false;
  }

  // Warning si > 8h de tâches ce jour-là
  const dayTasks = tasks.filter(t =>
    t.assigneeId === userId &&
    isSameDay(new Date(t.endDate), date)
  );
  const totalHours = dayTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

  if (totalHours > 8) {
    toast.warning('⚠️ Attention : ce jour atteint déjà 8h de charge');
    // Autoriser quand même, mais avec warning
  }

  return true;
};

// Affichage visuel si drop impossible
<div
  className={`day-cell ${canDrop(userId, date) ? 'drop-allowed' : 'drop-forbidden'}`}
  onDragOver={(e) => {
    if (canDrop(userId, date)) {
      e.preventDefault(); // Autorise le drop
    }
  }}
>
```

**9. Tutorial au premier usage**
```typescript
// Détection premier usage
const [hasSeenDragTutorial, setHasSeenDragTutorial] = useState(
  localStorage.getItem('hasSeenDragTutorial') === 'true'
);

useEffect(() => {
  if (!hasSeenDragTutorial && tasks.length > 0) {
    // Afficher un overlay tutorial
    setShowTutorial(true);
  }
}, [hasSeenDragTutorial, tasks]);

// Tutorial overlay
{showTutorial && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div className="bg-white rounded-lg p-6 max-w-md">
      <h3 className="text-xl font-bold mb-4">💡 Astuce : Organisez vos tâches</h3>
      <p className="mb-4">
        Vous pouvez glisser-déposer vos tâches pour les déplacer
        vers un autre jour ou les assigner à quelqu'un d'autre.
      </p>
      <div className="flex items-center space-x-4">
        <button
          onClick={() => {
            setShowTutorial(false);
            setHasSeenDragTutorial(true);
            localStorage.setItem('hasSeenDragTutorial', 'true');
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          J'ai compris
        </button>
        <button
          onClick={() => setShowTutorial(false)}
          className="px-4 py-2 text-gray-600"
        >
          Me le rappeler plus tard
        </button>
      </div>
    </div>
  </div>
)}
```

**10. Raccourcis clavier**
```typescript
// Annuler le dernier drag avec Ctrl+Z
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'z' && lastDragAction) {
      handleUndo();
    }
  };

  document.addEventListener('keydown', handleKeyPress);
  return () => document.removeEventListener('keydown', handleKeyPress);
}, [lastDragAction]);
```

**Effort** : ~8-10 heures (UX improvements + undo system + tutorial)
**Impact UX** : ⭐⭐⭐⭐ (meilleure discoverability, confiance utilisateur, moins d'erreurs)

---

## Priorité 4 - Polish Visuel

### 11. Animations de Transition

#### Détails
- **Fade-in progressif** des sections au chargement :
  ```typescript
  <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
    {/* KPI Cards */}
  </div>
  <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
    {/* Planning */}
  </div>
  ```

- **Skeleton loaders** pendant le fetch :
  ```tsx
  {loading && (
    <div className="space-y-4">
      <div className="h-32 bg-gray-200 animate-pulse rounded-lg" />
      <div className="h-64 bg-gray-200 animate-pulse rounded-lg" />
    </div>
  )}
  ```

- **Transition smooth** entre vues semaine/mois :
  ```typescript
  <div className="transition-all duration-300 ease-in-out">
    {viewMode === 'week' ? <WeekView /> : <MonthView />}
  </div>
  ```

**Effort** : ~2-3 heures
**Impact UX** : ⭐⭐⭐ (perception de performance, fluidité)

---

### 12. Thème Sombre (Dark Mode)

#### Détails
- **Toggle** dans les user settings :
  ```typescript
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  ```

- **Classes Tailwind `dark:`** sur tous les composants :
  ```tsx
  <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
    ...
  </div>
  ```

- **Persistence** : localStorage + user preferences en DB

**Effort** : ~10-12 heures (refonte de tous les composants)
**Impact UX** : ⭐⭐⭐⭐ (confort visuel, modernité)

---

### 13. Empty States Améliorés

#### Détails

**Avant** :
```
Aucune tâche assignée
```

**Après** :
```
┌────────────────────────────────────────┐
│          🎯                            │
│                                        │
│   Aucune tâche pour le moment          │
│                                        │
│   Créez votre première tâche pour      │
│   commencer à organiser votre travail  │
│                                        │
│   [+ Créer ma première tâche]          │
└────────────────────────────────────────┘
```

**Empty states personnalisés** :
- Pas de tâches → CTA "Créer"
- Pas de projets → CTA "Créer un projet"
- Planning vide → "Aucune tâche cette semaine 🎉"
- Congés non posés → "Pensez à poser vos congés"

**Effort** : ~3-4 heures
**Impact UX** : ⭐⭐⭐ (moins de frustration, guidance)

---

## Impacts et Effort - Tableau Récapitulatif

| Proposition | Priorité | Effort (h) | Impact UX | ROI | Dépendances |
|-------------|----------|------------|-----------|-----|-------------|
| 1. Planning Collapsible | 1 | 2-3 | ⭐⭐⭐⭐⭐ | 🔥 Très élevé | Aucune |
| 2. Indicateur Charge | 1 | 3-4 | ⭐⭐⭐⭐⭐ | 🔥 Très élevé | Aucune |
| 3. Quick Actions | 1 | 4-5 | ⭐⭐⭐⭐ | 🔥 Élevé | Aucune |
| 4. Tri Tâches | 2 | 5-6 | ⭐⭐⭐⭐ | ✅ Élevé | Aucune |
| 5. Vue Compacte | 2 | 3-4 | ⭐⭐⭐⭐ | ✅ Élevé | Aucune |
| 6. Stats Congés | 2 | 6-7 | ⭐⭐⭐⭐ | ✅ Élevé | Backend API |
| 7. Timeline Jalons | 3 | 8-10 | ⭐⭐⭐⭐⭐ | ✅ Moyen | Backend API |
| 8. Widget Journée | 3 | 10-12 | ⭐⭐⭐⭐⭐ | 🔥 Très élevé | Time-tracking |
| 9. Notifications | 3 | 12-15 | ⭐⭐⭐⭐⭐ | 🔥 Très élevé | Backend logic |
| 10. Drag & Drop++ | 3 | 8-10 | ⭐⭐⭐⭐ | ✅ Moyen | Aucune |
| 11. Animations | 4 | 2-3 | ⭐⭐⭐ | ⚠️ Faible | Aucune |
| 12. Dark Mode | 4 | 10-12 | ⭐⭐⭐⭐ | ⚠️ Faible | Refonte UI |
| 13. Empty States | 4 | 3-4 | ⭐⭐⭐ | ⚠️ Faible | Aucune |

---

## Recommandation Finale - Top 5 Prioritaire

### Phase 1 - Quick Wins (1-2 jours)
1. **Planning Collapsible** (#1) - 2-3h
2. **Indicateur de Charge** (#2) - 3-4h
3. **Quick Actions** (#3) - 4-5h

**Total Phase 1** : ~10-12 heures
**Impact** : Gain immédiat en UX, pas de dépendances backend

---

### Phase 2 - Améliorations Ergonomiques (2-3 jours)
4. **Tri/Filtrage Tâches** (#4) - 5-6h
5. **Vue Compacte** (#5) - 3-4h

**Total Phase 2** : ~8-10 heures
**Impact** : Meilleure ergonomie, responsive amélioré

---

### Phase 3 - Fonctionnalités Avancées (1 semaine)
6. **Widget "Ma Journée"** (#8) - 10-12h
7. **Notifications Intelligentes** (#9) - 12-15h

**Total Phase 3** : ~22-27 heures
**Impact** : Transformation de l'expérience utilisateur

---

**Total général recommandé (Top 7)** : ~40-50 heures de développement
**Impact global** : Dashboard passant de **vue passive** à **assistant personnel proactif**

Dis-moi quelle(s) amélioration(s) tu veux que je développe !
