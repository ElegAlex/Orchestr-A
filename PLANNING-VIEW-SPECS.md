# 📅 SPÉCIFICATIONS VUE PLANNING D'ÉQUIPE

## ✅ STATUT : IMPLÉMENTÉ (07/11/2025)

**Fichier** : `/apps/web/app/planning/page.tsx`

**Implémentation** : Version unifiée avec toggle Semaine/Mois, intégration Télétravail + Tâches + Congés, drag-and-drop des tâches.

---

## 🎯 OBJECTIF

Créer une vue planning flexible permettant de visualiser la **disponibilité** et les **activités** des membres de l'équipe selon le rôle et le contexte.

---

## 📊 MODES D'AFFICHAGE

### Mode Temporel (Toggle)

**2 vues au choix :**

1. **Vue Hebdomadaire** 📆
   - Affichage 7 jours (Lun-Dim)
   - Grille : Users (lignes) × Jours (colonnes)
   - Navigation : semaine précédente/suivante
   - Indicateur semaine en cours

2. **Vue Mensuelle** 📅
   - Affichage 1 mois complet
   - Grille : Users (lignes) × Jours du mois (colonnes)
   - Navigation : mois précédent/suivant
   - Indicateur jour actuel

---

## 🔍 TYPES DE VUE (selon le rôle)

### Vue 1 : **Disponibilité** (Focus RH)

**Objectif :** Savoir qui est disponible, où et quand

**Données affichées :**
- ✅ **Absences** (congés)
  - Type : CP, Maladie, Sans solde, Autre
  - Durée : Journée complète ou demi-journée (AM/PM)
  - Statut : En attente, Approuvé, Refusé

- ✅ **Télétravail**
  - Type : Journée complète ou demi-journée (AM/PM)
  - Lieu : Domicile, Autre

- ❌ **PAS de tâches** (focus disponibilité physique)

**Utilisateurs cibles :**
- RH (gestion des effectifs)
- Managers (organisation réunions)
- Administratifs (planning de présence)

**Cas d'usage :**
- "Qui est au bureau cette semaine ?"
- "Combien de personnes absentes le 15 janvier ?"
- "Puis-je organiser une réunion physique le jeudi ?"

---

### Vue 2 : **Complète** (Focus Opérationnel)

**Objectif :** Comprendre charge de travail ET disponibilité

**Données affichées :**
- ✅ **Absences** (idem Vue 1)
- ✅ **Télétravail** (idem Vue 1)
- ✅ **Tâches assignées**
  - Titre de la tâche
  - Projet associé
  - Statut : TODO, En cours, Review, Bloqué, Terminé
  - Priorité : Basse, Moyenne, Haute, Urgente
  - Charge estimée (heures)
  - Date d'échéance

**Utilisateurs cibles :**
- Managers de projet
- Chef d'équipe
- Responsables techniques

**Cas d'usage :**
- "Qui peut prendre une nouvelle tâche cette semaine ?"
- "Est-ce que Jean a de la marge pour aider sur le projet X ?"
- "Quelle est la charge de travail de l'équipe cette semaine ?"
- "Y a-t-il des surcharges ?"

---

## 🎨 DESIGN DE L'INTERFACE

### Structure générale

```
┌─────────────────────────────────────────────────────────────┐
│  Planning d'Équipe                        [Vue: Hebdo/Mois] │
├─────────────────────────────────────────────────────────────┤
│  Filtres:                                                   │
│  [Département ▼] [Service ▼] [Équipe ▼]                   │
│  Mode: (•) Disponibilité  ( ) Complète                     │
│  ◄ Sem. 42 | 14-20 Oct 2025 ►                             │
├─────────────────────────────────────────────────────────────┤
│           │ Lun 14 │ Mar 15 │ Mer 16 │ Jeu 17 │ Ven 18 │...│
├───────────┼────────┼────────┼────────┼────────┼────────┼───┤
│ Jean D.   │   🏢   │   🏠   │   🏠   │   🏢   │   🏢   │...│
│ (Dev)     │        │        │        │        │        │   │
├───────────┼────────┼────────┼────────┼────────┼────────┼───┤
│ Marie L.  │   🏢   │   🏢   │   ❌   │   ❌   │   🏠   │...│
│ (Manager) │        │        │  CP    │  CP    │        │   │
├───────────┼────────┼────────┼────────┼────────┼────────┼───┤
│ Paul M.   │   🏢   │   🏠   │   🏢   │   🏢   │   🏢   │...│
│ (Tech)    │ [T1]   │ [T2]   │ [T1]   │ [T3]   │        │   │
└───────────┴────────┴────────┴────────┴────────┴────────┴───┘

Légende:
🏢 Au bureau    🏠 Télétravail    ❌ Absent (congé)
🏥 Maladie      🎉 Férié          ⚠️ Surchargé
[T1] Tâche (en mode Complète uniquement)
```

---

## 💾 STRUCTURE DES DONNÉES

### Endpoint Backend

```typescript
GET /planning/team
Query params:
  - startDate: string (ISO date)
  - endDate: string (ISO date)
  - departmentId?: string
  - serviceId?: string
  - viewMode: 'availability' | 'complete'

Response:
{
  "startDate": "2025-01-14",
  "endDate": "2025-01-20",
  "users": [
    {
      "id": "user-1",
      "firstName": "Jean",
      "lastName": "Dupont",
      "role": "CONTRIBUTEUR",
      "department": "IT",
      "service": "Dev Web",
      "days": [
        {
          "date": "2025-01-14",
          "status": "OFFICE",           // OFFICE, TELEWORK, LEAVE, HOLIDAY, SICK
          "leaveType": null,             // PAID, SICK, UNPAID, OTHER
          "teleworkType": null,          // FULL_DAY, MORNING, AFTERNOON
          "tasks": [                     // Seulement si viewMode = 'complete'
            {
              "id": "task-1",
              "title": "Développer API Users",
              "project": "ORCHESTR'A V2",
              "status": "IN_PROGRESS",
              "priority": "HIGH",
              "estimatedHours": 8,
              "dueDate": "2025-01-15"
            }
          ],
          "workload": {                  // Seulement si viewMode = 'complete'
            "plannedHours": 8,
            "availableHours": 7,         // Selon contrat - congés - réunions
            "utilizationRate": 114       // % (>100% = surchargé)
          }
        },
        {
          "date": "2025-01-15",
          "status": "TELEWORK",
          "leaveType": null,
          "teleworkType": "FULL_DAY",
          "tasks": [...],
          "workload": {...}
        },
        {
          "date": "2025-01-16",
          "status": "LEAVE",
          "leaveType": "PAID",
          "teleworkType": null,
          "tasks": [],                   // Vide si absent
          "workload": null               // Null si absent
        }
      ]
    }
  ],
  "summary": {
    "totalUsers": 15,
    "presentToday": 10,
    "teleworkToday": 3,
    "leaveToday": 2,
    "overloadedUsers": 1                // Users avec utilization > 100%
  }
}
```

---

## 🎨 CODE COULEUR VISUEL

### Vue Disponibilité

| Statut | Couleur | Icône | Description |
|--------|---------|-------|-------------|
| **OFFICE** | 🟢 Vert clair | 🏢 | Présent au bureau |
| **TELEWORK** (full) | 🔵 Bleu clair | 🏠 | Télétravail journée complète |
| **TELEWORK** (AM) | 🔵 Bleu clair | 🌅 | Télétravail matin |
| **TELEWORK** (PM) | 🔵 Bleu clair | 🌆 | Télétravail après-midi |
| **LEAVE** (CP) | 🟠 Orange | ✈️ | Congé payé |
| **LEAVE** (Sick) | 🔴 Rouge clair | 🏥 | Maladie |
| **LEAVE** (Other) | ⚪ Gris | ❌ | Autre absence |
| **HOLIDAY** | 🟣 Violet | 🎉 | Jour férié |

### Vue Complète (ajouts)

| Statut | Couleur | Indicateur | Description |
|--------|---------|------------|-------------|
| **Disponible** | 🟢 Vert | - | Pas de tâche, charge < 100% |
| **Chargé** | 🟡 Jaune | ⚠️ | Charge 80-100% |
| **Surchargé** | 🔴 Rouge | 🚨 | Charge > 100% |
| **Tâche urgente** | 🔴 Rouge bordure | ⚡ | Tâche priorité URGENT |

---

## 🔧 FONCTIONNALITÉS INTERACTIVES

### Filtres

**1. Filtres de périmètre :**
- Département (dropdown)
- Service (dropdown, filtré par département)
- Recherche utilisateur (autocomplete)

**2. Filtre de vue :**
- Radio buttons : Disponibilité / Complète

**3. Navigation temporelle :**
- Toggle : Semaine / Mois
- Boutons : ◄ Précédent | Aujourd'hui | Suivant ►
- Date picker : Sélection date spécifique

### Actions sur les cellules

**En mode Vue Disponibilité :**
- Clic sur cellule → Popup détails :
  - Nom de l'utilisateur
  - Statut (Bureau / Télétravail / Absence)
  - Si absence : Type, dates, motif
  - Boutons rapides : Envoyer message, Voir profil

**En mode Vue Complète :**
- Clic sur cellule → Popup détails :
  - Tout ce qui précède +
  - Liste des tâches du jour
  - Charge de travail (heures planifiées / disponibles)
  - Bouton : Assigner une tâche (si manager)

**Hover sur cellule :**
- Tooltip rapide avec infos essentielles

### Export

- Export PDF (planning imprimable)
- Export Excel (données tabulaires)
- Partage par email (lien temporaire)

---

## 🧩 COMPOSANTS REACT À CRÉER

### 1. `TeamPlanningCalendar.tsx`

Composant principal orchestrant tout.

```typescript
interface TeamPlanningCalendarProps {
  defaultViewMode?: 'availability' | 'complete';
  defaultTimeMode?: 'week' | 'month';
  departmentId?: string;
}
```

### 2. `PlanningHeader.tsx`

Filtres + Navigation + Toggles

```typescript
interface PlanningHeaderProps {
  viewMode: 'availability' | 'complete';
  timeMode: 'week' | 'month';
  currentDate: Date;
  onViewModeChange: (mode) => void;
  onTimeModeChange: (mode) => void;
  onDateChange: (date) => void;
  onFiltersChange: (filters) => void;
}
```

### 3. `PlanningGrid.tsx`

Grille du calendrier

```typescript
interface PlanningGridProps {
  users: User[];
  days: Date[];
  data: PlanningData;
  viewMode: 'availability' | 'complete';
  onCellClick: (userId, date) => void;
}
```

### 4. `PlanningCell.tsx`

Cellule individuelle (1 user × 1 jour)

```typescript
interface PlanningCellProps {
  user: User;
  date: Date;
  status: DayStatus;
  tasks?: Task[];
  workload?: Workload;
  viewMode: 'availability' | 'complete';
  onClick: () => void;
}
```

### 5. `PlanningLegend.tsx`

Légende des couleurs et icônes

### 6. `PlanningCellDetails.tsx`

Modal de détails au clic

### 7. `PlanningExport.tsx`

Boutons export PDF/Excel

---

## 📋 TÂCHES DE DÉVELOPPEMENT

### Backend (4-5h)

**1. Créer endpoint `/planning/team`** (2h)
- Logique de récupération données
- Agrégation : users + leaves + telework + tasks
- Calcul charge de travail
- Filtrage par département/service
- Gestion mode availability/complete

**2. Service de calcul de charge** (1h)
- Fonction `calculateDailyWorkload(userId, date)`
- Prend en compte : contrat, congés, tâches
- Retourne : plannedHours, availableHours, rate

**3. Service de détection surchages** (1h)
- Fonction `detectOverload(userId, startDate, endDate)`
- Alertes si charge > 100%
- Suggestions de redistribution

### Frontend (8-10h)

**1. Composant TeamPlanningCalendar** (3h)
- Structure de base
- Gestion state (viewMode, timeMode, filters)
- Intégration React Query
- Navigation dates

**2. Composant PlanningGrid** (3h)
- Rendu grille hebdomadaire
- Rendu grille mensuelle
- Code couleur selon statut
- Responsive design

**3. Composants détails et interactions** (2h)
- Modal détails cellule
- Hover tooltips
- Légende dynamique

**4. Fonctionnalités avancées** (2h)
- Export PDF/Excel
- Filtres avancés
- Recherche utilisateur
- Indicateurs visuels surchage

---

## 🎯 CRITÈRES DE SUCCÈS

### Fonctionnels

- ✅ Toggle semaine/mois fonctionne
- ✅ Toggle disponibilité/complète change l'affichage
- ✅ Filtres département/service filtrent correctement
- ✅ Code couleur clair et intuitif
- ✅ Détection visuelle des surcharges
- ✅ Export PDF/Excel génère fichier correct

### Techniques

- ✅ Performance : Affichage < 500ms pour 50 users
- ✅ Cache : React Query cache 5 min
- ✅ Responsive : Fonctionne sur tablette (scroll horizontal ok)
- ✅ Accessibilité : Navigation clavier, contraste AA

### UX

- ✅ Légende toujours visible
- ✅ Jour actuel surligné
- ✅ Utilisateur actuel surligné (si dans la liste)
- ✅ Chargement : Skeleton loader pendant fetch
- ✅ Erreurs : Messages clairs si pas de données

---

## 📊 WIREFRAME DÉTAILLÉ

### Vue Hebdomadaire - Mode Disponibilité

```
╔════════════════════════════════════════════════════════════════╗
║  📅 Planning d'Équipe                     [⚙️ Paramètres]     ║
╠════════════════════════════════════════════════════════════════╣
║  🔍 Filtres                                                    ║
║  Département: [IT ▼]  Service: [Dev Web ▼]  🔎 [Recherche...] ║
║                                                                ║
║  Mode d'affichage: (•) Disponibilité  ( ) Complète            ║
║  Période: (•) Semaine  ( ) Mois                                ║
║                                                                ║
║  ◄  Sem. 42 | 14-20 Octobre 2025  ►    [📅 Aujourd'hui]      ║
╠════════════════════════════════════════════════════════════════╣
║         │ Lun 14 │ Mar 15 │ Mer 16 │ Jeu 17 │ Ven 18 │ Sam 19║
╠─────────┼────────┼────────┼────────┼────────┼────────┼────────╣
║ Jean D. │   🏢   │   🏠   │   🏠   │   🏢   │   🏢   │   -   ║
║ Dev     │        │        │        │        │        │        ║
╠─────────┼────────┼────────┼────────┼────────┼────────┼────────╣
║ Marie L.│   🏢   │   🏢   │   ❌   │   ❌   │   🏠   │   -   ║
║ Manager │        │        │  CP    │  CP    │        │        ║
╠─────────┼────────┼────────┼────────┼────────┼────────┼────────╣
║ Paul M. │   🏠   │   🏢   │   🏢   │   🏥   │   -    │   -   ║
║ Tech    │        │        │        │ Maladie│        │        ║
╠─────────┼────────┼────────┼────────┼────────┼────────┼────────╣
║ Sophie  │   🏢   │   🏠   │   🏠   │   🏢   │   🏢   │   -   ║
║ RH      │        │        │        │        │        │        ║
╠════════════════════════════════════════════════════════════════╣
║  Légende:                                                      ║
║  🏢 Bureau  🏠 Télétravail  ❌ Congé  🏥 Maladie  🎉 Férié    ║
║                                                                ║
║  Résumé: 15 personnes | 10 au bureau | 3 en TW | 2 absents   ║
║                                                                ║
║  [📥 Export PDF]  [📊 Export Excel]                           ║
╚════════════════════════════════════════════════════════════════╝
```

### Vue Hebdomadaire - Mode Complète

```
╔════════════════════════════════════════════════════════════════╗
║         │ Lun 14        │ Mar 15        │ Mer 16        │...  ║
╠─────────┼───────────────┼───────────────┼───────────────┼─────╣
║ Jean D. │ 🏢            │ 🏠            │ 🏠            │     ║
║ Dev     │ ⚠️ 8h/7h (114%)│ 6h/7h (86%)   │ 4h/7h (57%)   │     ║
║         │ • Task #123   │ • Task #124   │ • Task #123   │     ║
║         │ • Task #125 ⚡│               │               │     ║
╠─────────┼───────────────┼───────────────┼───────────────┼─────╣
║ Marie L.│ 🏢            │ 🏢            │ ❌ CP         │     ║
║ Manager │ 3h/7h (43%)   │ 5h/7h (71%)   │ -             │     ║
║         │ • Review      │ • Planning    │               │     ║
╚════════════════════════════════════════════════════════════════╝

Indicateurs:
🟢 Charge < 80%  🟡 Charge 80-100%  🔴 Charge > 100%  ⚡ Urgent
```

---

## ⏱️ ESTIMATION TEMPS DE DÉVELOPPEMENT

**Total: 12-15h**

| Tâche | Temps |
|-------|-------|
| Backend endpoint `/planning/team` | 2h |
| Service calcul charge | 1h |
| Service détection surcharge | 1h |
| Composant TeamPlanningCalendar | 3h |
| Composant PlanningGrid (2 modes) | 3h |
| Modal détails + interactions | 2h |
| Export PDF/Excel | 2h |
| Tests & ajustements | 1-2h |

---

## 📌 PRIORITÉS

**Phase 1 (MVP - 8h) : ✅ COMPLÉTÉ**
1. ✅ Endpoint backend mode availability
2. ✅ Grille hebdomadaire simple
3. ✅ Code couleur bureau/TW/absence
4. ✅ Filtres basiques (utilisateur)

**Phase 2 (Complet - 4h) : ✅ COMPLÉTÉ**
1. ✅ Mode complete avec tâches
2. ✅ Vue tâches intégrée dans cellules
3. ✅ Drag-and-drop des tâches
4. ✅ Vue mensuelle (toggle Semaine/Mois)

**Phase 3 (Avancé - 3h) : 🟡 EN COURS**
1. 📝 Export PDF/Excel (à faire)
2. ✅ Interactions avancées (drag-drop, click, modal)
3. ✅ Optimisations perf (React Query cache)

---

---

## ✅ ÉTAT D'IMPLÉMENTATION

**Date** : 07/11/2025
**Version** : 1.0
**Statut** : ✅ Fonctionnel en production

### Fonctionnalités Implémentées

✅ **Toggle Semaine/Mois**
- Sélecteur visuel dans le header
- Vue semaine : 5 jours ouvrés (Lun-Ven)
- Vue mois : ~20 jours ouvrés du mois
- Navigation adaptée (← Aujourd'hui →)

✅ **Grille Utilisateurs × Jours**
- Table sticky column (utilisateur fixe à gauche)
- Cellules responsive (180px semaine, 120px mois)
- Highlight jour actuel (fond bleu)

✅ **Intégration Triple**
- 🏠 Télétravail : Toggle cliquable dans cellule
- 🌴 Congés : Badges automatiques
- 📋 Tâches : Cards draggables avec statut/priorité

✅ **Drag & Drop Tâches**
- HTML5 native API
- Change assigné + date au drop
- Feedback visuel (opacité, curseur)

✅ **Modal Détails**
- Click sur tâche → Modal détails
- Affichage complet (titre, description, statut, priorité, progression)

✅ **Filtres**
- Dropdown utilisateur (Tous ou spécifique)
- Filtre automatique utilisateurs actifs

### À Compléter

📝 **Calcul Charge de Travail**
- Indicateur heures plannifiées vs disponibles
- Alerte surcharge (>100%)

📝 **Export**
- Export PDF
- Export Excel

📝 **Statistiques**
- Résumé équipe en temps réel
- Taux de présence

**Implémentation réussie ! 🎉**
