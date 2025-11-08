# 📋 ÉTAT DES MODULES RH - ORCHESTR'A V2

## ✅ MODULES DÉVELOPPÉS (100%)

### 1. Leaves (Congés) ✅

**Backend : 11 endpoints**
- POST `/leaves` - Créer demande
- GET `/leaves` - Liste avec filtres
- GET `/leaves/:id` - Détails
- GET `/leaves/me/balance` - Mon solde
- GET `/leaves/balance/:userId` - Solde utilisateur
- PATCH `/leaves/:id` - Modifier (pending only)
- DELETE `/leaves/:id` - Supprimer
- POST `/leaves/:id/approve` - Approuver
- POST `/leaves/:id/reject` - Refuser
- POST `/leaves/:id/cancel` - Annuler

**Fonctionnalités :**
- ✅ Types : PAID, SICK, UNPAID, OTHER
- ✅ Statuts : PENDING, APPROVED, REJECTED, CANCELED
- ✅ Calcul automatique jours ouvrés (exclut weekends)
- ✅ Gestion demi-journées (matin/après-midi)
- ✅ Solde 25 jours/an (France)
- ✅ Détection chevauchements
- ✅ Workflow d'approbation

**Frontend :**
- 🔴 Page placeholder créée
- 🔴 À développer : formulaire demande, liste, validation

---

### 2. Telework (Télétravail) ✅

**Backend : 11 endpoints**
- POST `/telework` - Déclarer télétravail
- GET `/telework` - Liste avec filtres
- GET `/telework/:id` - Détails
- GET `/telework/me/week` - Mon planning hebdo
- GET `/telework/me/stats` - Mes stats annuelles
- GET `/telework/user/:userId/week` - Planning user
- GET `/telework/user/:userId/stats` - Stats user
- GET `/telework/team/:date` - Vue équipe par date
- PATCH `/telework/:id` - Modifier
- DELETE `/telework/:id` - Supprimer

**Fonctionnalités :**
- ✅ Journées complètes et demi-journées
- ✅ Planning hebdomadaire (vue 7 jours)
- ✅ Statistiques annuelles (par mois)
- ✅ Vue équipe par date (managers)
- ✅ Validation date unique par user
- ✅ Protection dates passées

**Frontend :**
- 🔴 Page placeholder créée
- 🔴 À développer : calendrier, déclaration, vue équipe

---

### 3. TimeTracking (Suivi temps) ✅

**Backend : 8 endpoints**
- POST `/time-tracking` - Créer entrée
- GET `/time-tracking` - Liste
- GET `/time-tracking/:id` - Détails
- GET `/time-tracking/me/report` - Mon rapport
- GET `/time-tracking/user/:userId/report` - Rapport user
- GET `/time-tracking/project/:projectId/report` - Rapport projet
- PATCH `/time-tracking/:id` - Modifier
- DELETE `/time-tracking/:id` - Supprimer

**Fonctionnalités :**
- ✅ Types activités : DEVELOPMENT, MEETING, REVIEW, etc.
- ✅ Attachement tâche et/ou projet
- ✅ Mise à jour auto task.actualHours
- ✅ Rapports avec agrégations
- ✅ Filtres dates
- ✅ Validation heures (0.25-24h)

**Frontend :**
- 🔴 Page placeholder créée
- 🔴 À développer : saisie temps, rapports

---

## ❌ MODULES MANQUANTS (selon REFONTE.md)

### 4. Contrat de Travail / Profil RH ❌

**Prévu dans cahier des charges (section 3.1) :**
- Type de contrat (temps plein, temps partiel)
- Taux de travail (100%, 80%, 50%...)
- Horaires standards (35h/semaine)
- Jours travaillés dans la semaine
- Heures de début/fin de journée
- Manager direct

**Statut actuel :**
- 🔴 Champs manquants dans User model
- 🔴 Pas d'endpoints backend
- 🔴 Pas d'interface frontend

**Impact :**
- ⚠️ Impossible de calculer la capacité réelle de travail
- ⚠️ Pas de gestion temps partiel
- ⚠️ Pas de planning personnalisé par utilisateur

---

### 5. Capacité de Travail (Availability) ❌

**Prévu dans cahier des charges (section 3.1) :**
- Ajustement pour jours fériés
- Prise en compte congés et absences
- Vue par utilisateur, équipe, département
- Calcul charge disponible vs planifiée

**Statut actuel :**
- 🔴 Pas de module backend
- 🔴 Pas d'endpoints
- 🔴 Pas d'interface frontend

**Ce qui serait nécessaire :**
```typescript
// Endpoint à créer
GET /capacity/user/:userId?startDate=2025-01-01&endDate=2025-01-31
{
  "totalWorkDays": 22,
  "availableDays": 18,
  "leaveDays": 2,
  "teleworkDays": 5,
  "holidays": 2,
  "workload": {
    "planned": 140, // heures planifiées
    "capacity": 154, // heures disponibles (22j × 7h)
    "available": 14  // marge
  }
}
```

---

### 6. Jours Fériés (Holidays) ❌

**Prévu pour calcul de capacité :**
- Base de données jours fériés français
- Configuration par pays si nécessaire
- Gestion jours fériés récurrents

**Statut actuel :**
- 🔴 Pas de modèle Prisma
- 🔴 Pas de module backend
- 🔴 Pas d'interface frontend

**Schema Prisma à ajouter :**
```prisma
model Holiday {
  id          String   @id @default(uuid())
  name        String   // "Noël", "1er Mai"
  date        DateTime // Date du jour férié
  isRecurring Boolean  @default(true)
  country     String   @default("FR")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("holidays")
}
```

---

### 7. Planning d'Équipe (Team Calendar) ❌

**Prévu dans cahier des charges :**
- Vue calendrier mensuel/hebdomadaire
- Affichage présence/absence/télétravail par personne
- Filtres département/service
- Légende visuelle

**Statut actuel :**
- 🟡 Données disponibles via modules Leaves + Telework
- 🔴 Pas d'endpoint agrégé
- 🔴 Pas d'interface frontend

**Endpoint à créer :**
```typescript
GET /planning/team?date=2025-01-15&departmentId=xxx
{
  "date": "2025-01-15",
  "users": [
    {
      "id": "user1",
      "name": "John Doe",
      "status": "PRESENT",        // PRESENT, LEAVE, TELEWORK, HOLIDAY
      "leaveType": null,
      "teleworkType": null
    },
    {
      "id": "user2",
      "name": "Jane Smith",
      "status": "TELEWORK",
      "teleworkType": "FULL_DAY"
    },
    {
      "id": "user3",
      "name": "Bob Martin",
      "status": "LEAVE",
      "leaveType": "PAID"
    }
  ]
}
```

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

### Phase 1 : Compléter le backend RH (6-8h)

**Priorité 1 : Profil RH / Contrat (2-3h)**
1. Migration Prisma - Ajouter champs au User model
2. Backend - Update Users module avec champs RH
3. Backend - Validation règles métier
4. Frontend - Formulaire profil RH (settings)

**Priorité 2 : Jours fériés (2h)**
1. Migration Prisma - Modèle Holiday
2. Backend - CRUD Holidays
3. Backend - Seed jours fériés FR 2025
4. Frontend - Gestion jours fériés (admin)

**Priorité 3 : Capacité de travail (2-3h)**
1. Backend - Nouveau module Capacity
2. Endpoint calcul capacité user
3. Endpoint calcul capacité équipe
4. Logique : contrat + congés + TW + fériés

### Phase 2 : Frontend RH (6-8h)

**Priorité 1 : Pages Leaves complètes (3h)**
1. Formulaire demande congé
2. Liste mes demandes
3. Validation demandes (managers)
4. Calendrier congés équipe

**Priorité 2 : Pages Telework complètes (2h)**
1. Déclaration jours TW
2. Planning hebdomadaire
3. Vue équipe

**Priorité 3 : Vue Planning d'équipe (3h)**
1. Calendrier mensuel
2. Affichage présence/absence/TW
3. Filtres et légende

### Phase 3 : Optimisations (2-3h)

1. Dashboard RH avec KPIs
2. Notifications (demandes en attente)
3. Export planning (PDF/Excel)
4. Mobile responsive

---

## 📊 COUVERTURE ACTUELLE

| Fonctionnalité | Backend | Frontend | Couverture |
|----------------|---------|----------|------------|
| **Congés** | ✅ 100% | 🔴 0% | 50% |
| **Télétravail** | ✅ 100% | 🔴 0% | 50% |
| **Suivi temps** | ✅ 100% | 🔴 0% | 50% |
| **Profil RH** | 🔴 0% | 🔴 0% | 0% |
| **Capacité** | 🔴 0% | 🔴 0% | 0% |
| **Jours fériés** | 🔴 0% | 🔴 0% | 0% |
| **Planning équipe** | 🟡 50% | 🔴 0% | 25% |

**Moyenne : ~25% de couverture complète (backend + frontend)**

---

## 💡 RECOMMANDATION FINALE

Pour avoir un **module RH 100% complet et opérationnel**, il faut :

**Option A : MVP RH (8-10h)**
- Frontend Leaves + Telework + TimeTracking
- Module Holidays basique
- Vue Planning équipe simple

**Option B : RH Complet (14-18h)**
- Tout ce qui précède +
- Profil RH avec contrat de travail
- Module Capacité de travail
- Dashboard RH avec analytics

**Option C : Prioriser selon besoin métier**
- Quelles fonctionnalités sont critiques ?
- Quel est le calendrier de déploiement ?
- Y a-t-il un module à développer en priorité ?

---

**Question pour toi : Quelle option préfères-tu ?**
