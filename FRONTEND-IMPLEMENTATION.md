# 📱 Documentation Frontend ORCHESTR'A V2

## 🎯 État actuel du développement

**Date de dernière mise à jour** : 7 novembre 2025

### Progression globale
- **Backend** : ✅ 100% opérationnel (107 endpoints REST)
- **Frontend** : ✅ 50% complété (infrastructure + 2 pages fonctionnelles + 9 placeholders)

---

## 🏗️ Architecture Frontend

### Stack technique
```
Next.js 16 (App Router)
├── React 19
├── TypeScript (strict mode)
├── Tailwind CSS 4
├── Zustand (state management)
├── Axios (HTTP client)
└── React Hot Toast (notifications)
```

### Structure des dossiers
```
apps/web/
├── src/
│   ├── types/
│   │   └── index.ts                    # Types TypeScript complets (User, Project, Task, etc.)
│   │
│   ├── lib/
│   │   ├── api.ts                      # Configuration Axios avec intercepteurs JWT
│   │   └── utils.ts                    # Utilitaires (cn pour classNames)
│   │
│   ├── services/                       # Services API pour tous les modules
│   │   ├── auth.service.ts             # Login, register, logout, getProfile
│   │   ├── users.service.ts            # CRUD utilisateurs, filtres par rôle/département
│   │   ├── projects.service.ts         # CRUD projets, stats, membres
│   │   ├── tasks.service.ts            # CRUD tâches, dépendances, RACI
│   │   ├── leaves.service.ts           # Congés, validations, soldes
│   │   └── time-tracking.service.ts    # Saisie temps, stats, rapports
│   │
│   ├── stores/
│   │   └── auth.store.ts               # Store Zustand pour l'authentification
│   │
│   └── components/
│       ├── AuthProvider.tsx            # HOC pour protection des routes
│       └── MainLayout.tsx              # Layout avec sidebar et navigation
│
└── app/                                # Pages Next.js (App Router)
    ├── layout.tsx                      # Root layout avec AuthProvider et Toaster
    ├── page.tsx                        # Redirect vers login ou dashboard
    │
    ├── login/page.tsx                  # ✅ Page de connexion (FONCTIONNEL)
    ├── register/page.tsx               # ✅ Page d'inscription (FONCTIONNEL)
    │
    ├── dashboard/page.tsx              # ✅ Tableau de bord avec stats (FONCTIONNEL)
    ├── users/page.tsx                  # ✅ Gestion utilisateurs CRUD (FONCTIONNEL)
    │
    ├── projects/page.tsx               # ⏳ Placeholder (À DÉVELOPPER)
    ├── tasks/page.tsx                  # ⏳ Placeholder (À DÉVELOPPER)
    ├── planning/page.tsx               # ⏳ Placeholder (À DÉVELOPPER)
    ├── time-tracking/page.tsx          # ⏳ Placeholder (À DÉVELOPPER)
    ├── leaves/page.tsx                 # ⏳ Placeholder (À DÉVELOPPER)
    ├── telework/page.tsx               # ⏳ Placeholder (À DÉVELOPPER)
    ├── profile/page.tsx                # ⏳ Placeholder (À DÉVELOPPER)
    ├── departments/page.tsx            # ⏳ Placeholder (À DÉVELOPPER)
    └── skills/page.tsx                 # ⏳ Placeholder (À DÉVELOPPER)
```

---

## ✅ Pages fonctionnelles (implémentées)

### 1. `/login` - Page de connexion
**Fichier** : `apps/web/app/login/page.tsx`

**Fonctionnalités** :
- Formulaire login/password
- Validation et authentification via API
- Stockage du token JWT dans localStorage
- Redirection vers dashboard après connexion
- Lien vers page d'inscription
- Carte d'identifiants de test affichée

**Services utilisés** :
- `authService.login()`
- `useAuthStore` pour mettre à jour l'état

### 2. `/register` - Page d'inscription
**Fichier** : `apps/web/app/register/page.tsx`

**Fonctionnalités** :
- Formulaire complet (prénom, nom, email, login, password)
- Validation de correspondance des mots de passe
- Sélection du rôle
- Création via API et connexion automatique
- Lien vers page de connexion

**Services utilisés** :
- `authService.register()`
- `useAuthStore` pour mettre à jour l'état

### 3. `/dashboard` - Tableau de bord
**Fichier** : `apps/web/app/dashboard/page.tsx`

**Fonctionnalités** :
- Message de bienvenue personnalisé
- 4 cartes de statistiques :
  - Projets actifs / total
  - Tâches en cours / total
  - Tâches terminées avec pourcentage
  - Tâches bloquées
- Liste des 5 tâches récentes avec :
  - Badges de statut (TODO, IN_PROGRESS, DONE, BLOCKED)
  - Badges de priorité (LOW, NORMAL, HIGH, CRITICAL)
  - Description tronquée
- Grid des projets assignés avec badges de statut
- Gestion des erreurs 404 (pas de crash si pas de données)

**Services utilisés** :
- `projectsService.getByUser(userId)`
- `tasksService.getByAssignee(userId)`

**Pattern de code** :
```typescript
// Gestion des erreurs 404
try {
  const projects = await projectsService.getByUser(user.id);
  setMyProjects(projects);
} catch (error: any) {
  if (error.response?.status !== 404) {
    throw error; // Erreur réelle
  }
  // 404 = pas de données, on continue
}
```

### 4. `/users` - Gestion des utilisateurs
**Fichier** : `apps/web/app/users/page.tsx`

**Fonctionnalités** :
- Liste complète avec tableau responsive
- Avatar avec initiales
- Badges de rôle colorés
- Badges de statut (actif/inactif)
- Bouton de création (admin/responsable)
- Modal de création avec formulaire complet
- Bouton de désactivation
- Protection : impossible de désactiver soi-même

**Services utilisés** :
- `usersService.getAll()`
- `usersService.create(data)`
- `usersService.delete(id)`

**Pattern de code** :
```typescript
// Helper pour les couleurs de badges
const getRoleBadgeColor = (role: Role) => {
  switch (role) {
    case Role.ADMIN: return 'bg-red-100 text-red-800';
    case Role.RESPONSABLE: return 'bg-purple-100 text-purple-800';
    // ...
  }
};
```

---

## 🎨 Composants réutilisables

### `MainLayout.tsx`
**Fichier** : `apps/web/src/components/MainLayout.tsx`

**Fonctionnalités** :
- Sidebar avec navigation complète
- Menu dynamique selon le rôle (admin voit les menus d'administration)
- Avatar utilisateur avec initiales
- Bouton de déconnexion
- Sidebar repliable (toggle)
- Header avec titre de page et actions
- Design responsive

**Navigation définie** :
```typescript
const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: '📊' },
  { name: 'Projets', href: '/projects', icon: '📁' },
  { name: 'Tâches', href: '/tasks', icon: '✓' },
  { name: 'Planning', href: '/planning', icon: '📅' },
  { name: 'Temps passé', href: '/time-tracking', icon: '⏱️' },
  { name: 'Congés', href: '/leaves', icon: '🏖️' },
  { name: 'Télétravail', href: '/telework', icon: '🏠' },
];

const adminNavigation = [
  { name: 'Utilisateurs', href: '/users', icon: '👥' },
  { name: 'Départements', href: '/departments', icon: '🏢' },
  { name: 'Compétences', href: '/skills', icon: '🎯' },
];
```

### `AuthProvider.tsx`
**Fichier** : `apps/web/src/components/AuthProvider.tsx`

**Fonctionnalités** :
- Protection automatique des routes
- Redirection vers login si non authentifié
- Redirection vers dashboard si déjà connecté (login/register)
- Écran de chargement pendant vérification
- Liste des routes publiques

---

## 📦 Services API (tous prêts à l'emploi)

### `auth.service.ts`
```typescript
authService.login(credentials)           // POST /auth/login
authService.register(data)               // POST /auth/register
authService.getProfile()                 // GET /auth/profile
authService.logout()                     // Supprime token et redirige
authService.getCurrentUser()             // Récupère user depuis localStorage
authService.isAuthenticated()            // Vérifie présence du token
```

### `users.service.ts`
```typescript
usersService.getAll(page, limit, role)   // GET /users?page=1&limit=10&role=ADMIN
usersService.getById(id)                 // GET /users/:id
usersService.getByDepartment(id)         // GET /users/department/:id
usersService.getByService(id)            // GET /users/service/:id
usersService.getByRole(role)             // GET /users/role/:role
usersService.create(data)                // POST /users
usersService.update(id, data)            // PATCH /users/:id
usersService.delete(id)                  // DELETE /users/:id (soft delete)
usersService.changePassword(data)        // PATCH /users/me/change-password
usersService.resetPassword(id, pwd)      // POST /users/:id/reset-password
```

### `projects.service.ts`
```typescript
projectsService.getAll(page, limit, status)
projectsService.getById(id)
projectsService.getByUser(userId)
projectsService.getStats(id)
projectsService.create(data)
projectsService.update(id, data)
projectsService.delete(id)               // Soft delete (status = CANCELLED)
projectsService.hardDelete(id)           // Suppression physique
projectsService.addMember(projectId, data)
projectsService.removeMember(projectId, userId)
```

### `tasks.service.ts`
```typescript
tasksService.getAll(page, limit, status, priority)
tasksService.getById(id)
tasksService.getByProject(projectId)
tasksService.getByAssignee(userId)
tasksService.getByEpic(epicId)
tasksService.getByMilestone(milestoneId)
tasksService.create(data)
tasksService.update(id, data)
tasksService.updateProgress(id, progress)
tasksService.delete(id)
tasksService.addDependency(taskId, dependsOnTaskId)
tasksService.removeDependency(taskId, dependencyId)
tasksService.assignRaci(taskId, userId, role)
tasksService.removeRaci(taskId, raciId)
```

### `leaves.service.ts`
```typescript
leavesService.getAll()
leavesService.getById(id)
leavesService.getByUser(userId)
leavesService.getMyLeaves()
leavesService.getByType(type)
leavesService.getByStatus(status)
leavesService.create(data)
leavesService.update(id, data)
leavesService.updateStatus(id, status)
leavesService.delete(id)
leavesService.getBalance(userId)
```

### `time-tracking.service.ts`
```typescript
timeTrackingService.getAll()
timeTrackingService.getById(id)
timeTrackingService.getByUser(userId, startDate, endDate)
timeTrackingService.getMyEntries(startDate, endDate)
timeTrackingService.getByProject(projectId, startDate, endDate)
timeTrackingService.getByTask(taskId)
timeTrackingService.create(data)
timeTrackingService.update(id, data)
timeTrackingService.delete(id)
timeTrackingService.getStats(userId, startDate, endDate)
```

---

## 🔧 Configuration

### Variables d'environnement
**Fichier** : `apps/web/.env.local`
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### TypeScript paths
**Fichier** : `apps/web/tsconfig.json`
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Axios configuration
**Fichier** : `apps/web/src/lib/api.ts`
```typescript
// Intercepteur request : ajoute le token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur response : gère les erreurs 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 📝 Prochaines étapes (pour continuer le développement)

### 1. Page Projets (`/projects`)
**Priorité** : Haute

**À implémenter** :
- Liste des projets avec filtres (statut, priorité)
- Cartes de projet avec badges de statut
- Bouton de création (admin/responsable/manager)
- Modal de création avec formulaire complet
- Clic sur projet → redirection vers `/projects/[id]`

**Services déjà disponibles** :
- `projectsService.getAll()`
- `projectsService.create()`
- `projectsService.getStats()`

**Pattern à suivre** : Similaire à `/users` avec tableau ou grid de cartes

---

### 2. Page Détail Projet (`/projects/[id]`)
**Priorité** : Haute

**À implémenter** :
- Onglets : Vue d'ensemble, Tâches, Équipe, Documents, Paramètres
- Statistiques du projet (progression, heures, budget)
- Liste des tâches avec filtres
- Liste des membres avec rôles
- Upload de documents
- Formulaire d'édition

**Services déjà disponibles** :
- `projectsService.getById(id)`
- `projectsService.getStats(id)`
- `tasksService.getByProject(projectId)`
- `projectsService.addMember()`
- `projectsService.removeMember()`

---

### 3. Page Tâches (`/tasks`)
**Priorité** : Haute

**À implémenter** :
- Vue Kanban (colonnes TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED)
- Drag & drop entre colonnes
- Filtres : projet, assigné, priorité, statut
- Modal de création/édition de tâche
- Badges de priorité et statut

**Services déjà disponibles** :
- `tasksService.getAll()`
- `tasksService.create()`
- `tasksService.update()`
- `tasksService.updateProgress()`

**Librairie recommandée** :
```bash
pnpm --filter web add @dnd-kit/core @dnd-kit/sortable
```

---

### 4. Page Planning (`/planning`)
**Priorité** : Moyenne

**À implémenter** :
- Calendrier mensuel/hebdomadaire
- Affichage des milestones
- Timeline des projets
- Création d'objectifs
- Légende avec couleurs par projet

**Librairie recommandée** :
```bash
pnpm --filter web add react-big-calendar date-fns
```

---

### 5. Page Congés (`/leaves`)
**Priorité** : Moyenne

**À implémenter** :
- Formulaire de demande de congés
- Calendrier des absences de l'équipe
- Liste des demandes avec statuts
- Validation (responsable)
- Solde de congés affiché

**Services déjà disponibles** :
- `leavesService.getMyLeaves()`
- `leavesService.create()`
- `leavesService.updateStatus()`
- `leavesService.getBalance()`

---

### 6. Page Temps passé (`/time-tracking`)
**Priorité** : Moyenne

**À implémenter** :
- Feuille de temps hebdomadaire (grid 7 jours × projets)
- Saisie rapide du temps
- Total par jour et par projet
- Rapports et graphiques

**Services déjà disponibles** :
- `timeTrackingService.getMyEntries()`
- `timeTrackingService.create()`
- `timeTrackingService.getStats()`

---

### 7. Page Télétravail (`/telework`)
**Priorité** : Basse

**À implémenter** :
- Planning hebdomadaire/mensuel
- Déclaration simple (bureau/télétravail)
- Vue d'équipe (qui est en télétravail)

---

### 8. Pages Administration
**Priorité** : Basse

**Pages** : `/departments`, `/skills`, `/profile`

**À implémenter** :
- CRUD départements et services
- CRUD compétences
- Profil utilisateur avec modification

---

## 🎨 Design System

### Couleurs de badges (déjà utilisées)

**Statuts de projet** :
```typescript
DRAFT      → bg-gray-200 text-gray-800
ACTIVE     → bg-green-100 text-green-800
SUSPENDED  → bg-yellow-100 text-yellow-800
COMPLETED  → bg-blue-100 text-blue-800
CANCELLED  → bg-red-100 text-red-800
```

**Statuts de tâche** :
```typescript
TODO        → bg-gray-200 text-gray-800
IN_PROGRESS → bg-blue-100 text-blue-800
IN_REVIEW   → bg-yellow-100 text-yellow-800
DONE        → bg-green-100 text-green-800
BLOCKED     → bg-red-100 text-red-800
```

**Priorités** :
```typescript
LOW      → bg-gray-100 text-gray-800
NORMAL   → bg-blue-100 text-blue-800
HIGH     → bg-orange-100 text-orange-800
CRITICAL → bg-red-100 text-red-800
```

**Rôles** :
```typescript
ADMIN              → bg-red-100 text-red-800
RESPONSABLE        → bg-purple-100 text-purple-800
MANAGER            → bg-blue-100 text-blue-800
REFERENT_TECHNIQUE → bg-green-100 text-green-800
CONTRIBUTEUR       → bg-gray-100 text-gray-800
OBSERVATEUR        → bg-yellow-100 text-yellow-800
```

---

## 🚀 Commandes de déploiement

### Build et démarrage
```bash
# Build du frontend
bash -c 'set -a && source .env.production && set +a && docker-compose -f docker-compose.prod.yml build web'

# Démarrage
bash -c 'set -a && source .env.production && set +a && docker-compose -f docker-compose.prod.yml up -d web'

# Logs
docker logs orchestr-a-web-prod --tail 50

# Status
bash -c 'set -a && source .env.production && set +a && docker-compose -f docker-compose.prod.yml ps'
```

---

## 📊 Métriques actuelles

**Fichiers créés** : 20+
**Lignes de code** : ~3500
**Services API** : 6 (tous fonctionnels)
**Pages** : 11 (2 fonctionnelles, 9 placeholders)
**Composants** : 2 (MainLayout, AuthProvider)
**Types TypeScript** : 50+
**Endpoints utilisés** : 15+ sur 107 disponibles

---

## ✅ Checklist de continuité

Pour reprendre le développement :

- [x] Infrastructure complète (types, services, stores)
- [x] Authentification fonctionnelle
- [x] Layout et navigation
- [x] Dashboard avec stats
- [x] Gestion utilisateurs CRUD
- [x] Toutes les routes créées (pas de 404)
- [ ] Page Projets avec liste et création
- [ ] Page Détail Projet avec onglets
- [ ] Page Tâches avec Kanban
- [ ] Page Planning avec calendrier
- [ ] Page Congés avec demandes
- [ ] Page Temps passé avec saisie
- [ ] Page Télétravail
- [ ] Pages Administration (départements, compétences)
- [ ] Page Profil utilisateur

---

## 🔗 Ressources

**API Backend** : http://localhost:4000/api
**Frontend** : http://localhost:3000
**Documentation API** : Voir `apps/api/src/` pour les controllers
**Prisma Schema** : `packages/database/prisma/schema.prisma`

**Identifiants de test** :
- Login: `admin`
- Password: `Admin123!`
- Email: `admin@orchestr-a.local`

---

**Dernière mise à jour** : 7 novembre 2025
**Développé par** : Claude Code (Anthropic)
**Version** : 2.0.0
