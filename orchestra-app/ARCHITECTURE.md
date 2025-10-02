# Architecture Orchestra

## 🏗️ Vue d'ensemble

Orchestra est une application React moderne avec une architecture modulaire basée sur Firebase comme backend.

## 📁 Structure des Dossiers

```
src/
├── components/           # Composants React réutilisables
│   ├── analytics/       # Composants d'analyse et métriques
│   ├── auth/           # Composants d'authentification
│   ├── dashboard/      # Tableaux de bord (Executive, HR, Operational)
│   ├── hr/            # Composants RH (congés, utilisateurs)
│   ├── kanban/        # Vue Kanban des tâches
│   ├── layout/        # Layout principal et navigation
│   ├── notifications/ # Système de notifications
│   ├── project/       # Gestion des projets
│   ├── reports/       # Génération de rapports
│   ├── skills/        # Gestion des compétences
│   └── tasks/         # Gestion des tâches
├── config/            # Configuration Firebase
├── pages/             # Pages principales de l'application
│   ├── ProjectDetail.tsx  # Page détail projet avec onglets
│   ├── Calendar.tsx      # Page calendrier des événements
│   ├── Reports.tsx       # Page rapports et analytics
├── services/          # Services de données et API
├── store/             # État global (Redux)
│   └── slices/        # Redux slices par domaine
└── types/             # Types TypeScript
```

## 🔄 Flux de Données

```
UI Components → Redux Actions → Services → Firebase → Redux State → UI Components
```

## 🏪 Store Redux

### Slices Actives
- **authSlice** : Gestion de l'authentification et des utilisateurs
- **projectSlice** : État des projets
- **taskSlice** : État des tâches
- **resourceSlice** : État des ressources et équipes

### Middleware
- **Redux Toolkit Query** : Gestion des requêtes asynchrones
- **Serializable Check** : Ignoré pour les objets utilisateur Firebase

## 🔥 Services Firebase

### Collections Firestore
- `users` : Profils utilisateurs et informations RH
- `projects` : Projets avec métadonnées
- `tasks` : Tâches avec assignations et statuts
- `leaveRequests` : Demandes de congés
- `notifications` : Notifications système
- `timeEntries` : Suivi du temps de travail
- `documents` : Documents et pièces jointes

### Services Principaux
- **authService** : Authentification et gestion des profils
- **projectService** : CRUD projets
- **taskService** : CRUD tâches avec relations
- **userService** : Gestion des utilisateurs
- **leaveService** : Système de congés
- **analyticsService** : Métriques et statistiques
- **hr-analyticsService** : Analytics RH spécialisées
- **notificationService** : Notifications push

## 🎨 Interface Utilisateur

### Thème Material-UI
- **Couleur primaire** : `#667eea` (bleu-violet)
- **Couleur secondaire** : `#764ba2` (violet)
- **Police** : Inter, Roboto, Helvetica
- **Border Radius** : 8px

### Composants Clés
- **MainLayout** : Layout principal avec navigation
- **Dashboard** : Page d'accueil avec métriques
- **TaskModal** : Création/édition de tâches
- **ProjectDetail** : Vue détaillée des projets avec onglets
- **HRDashboard** : Tableau de bord RH
- **Calendar** : Vue calendrier avec événements et échéances
- **Reports** : Rapports et analytics avec graphiques
- **ProjectGantt** : Diagramme de Gantt avec dépendances

## 🔐 Authentification

### Méthodes Supportées
- Email/mot de passe
- Google OAuth
- Authentification Firebase

### Rôles Utilisateurs
- **admin** : Accès complet à toutes les fonctionnalités
- **manager** : Gestion de projets et d'équipes
- **contributor** : Création et suivi de tâches
- **viewer** : Consultation uniquement

## 📊 Analytics et Métriques

### Métriques Suivies
- Progression des projets
- Charge de travail des équipes
- Temps passé sur les tâches
- Métriques RH (congés, capacités)
- KPIs personnalisables

### Visualisation
- **Recharts** : Graphiques et diagrammes
- **Material-UI DataGrid** : Tableaux de données
- **Graphiques personnalisés** : Métriques temps réel

## 🔄 Gestion d'État

### État Local (useState/useReducer)
- États de formulaires
- États de chargement temporaires
- Interactions UI ponctuelles

### État Global (Redux)
- Données utilisateur authentifié
- Cache des projets et tâches
- Préférences utilisateur
- État des notifications

## 📱 Responsive Design

### Breakpoints
- **Mobile** : < 768px
- **Tablet** : 768px - 1024px
- **Desktop** : > 1024px

### Adaptations
- Navigation drawer sur mobile
- Grilles adaptatives
- Typographie responsive
- Composants Material-UI responsives

## 🚀 Déploiement

### Environnements
- **Development** : `npm start` (localhost:3000)
- **Staging** : Firebase Hosting avec preview channels
- **Production** : Firebase Hosting (orchestr-a-3b48e.web.app)

### CI/CD
- Build automatique avec `npm run build`
- Déploiement Firebase avec `firebase deploy`
- Variables d'environnement via `.env`

## 🔧 Outils de Développement

### Technologies Principales
- **React 18** : Interface utilisateur
- **TypeScript** : Typage statique
- **Material-UI v5** : Composants UI
- **Redux Toolkit** : Gestion d'état
- **Firebase v9** : Backend as a Service
- **date-fns** : Manipulation des dates
- **Recharts** : Visualisation de données

### Outils de Build
- **Create React App** : Configuration et build
- **ESLint** : Analyse de code
- **Prettier** : Formatage de code

## 📋 Patterns et Conventions

### Structure des Composants
```typescript
// Imports
// Types et interfaces
// Composant principal avec hooks
// Styles (si nécessaire)
// Export
```

### Conventions de Nommage
- **Composants** : PascalCase (`TaskModal`)
- **Hooks** : camelCase avec préfixe `use` (`useTaskData`)
- **Services** : camelCase avec suffixe `Service` (`taskService`)
- **Types** : PascalCase (`Task`, `Project`)

### Gestion d'Erreur
- Try-catch dans les services
- États d'erreur dans les composants
- Messages d'erreur utilisateur-friendly
- Logs console pour le debug

## 🏆 Bonnes Pratiques

### Performance
- Memoization des composants coûteux
- Lazy loading des routes
- Optimisation des requêtes Firestore
- Cache des données fréquemment utilisées

### Sécurité
- Validation côté client et serveur
- Règles Firestore strictes
- Authentification requise pour les routes protégées
- Pas d'exposition de données sensibles

### Maintenabilité
- Code modulaire et réutilisable
- Types TypeScript complets
- Documentation inline
- Tests unitaires (à implémenter)

## 🔮 Évolutions Techniques

### Court Terme
- Tests unitaires avec Jest
- Tests E2E avec Cypress
- Optimisation des performances
- PWA capabilities
- Finalisation Phase 2 (Collaboration)

### Long Terme
- Migration vers React Server Components
- Intégration d'IA pour l'analytics
- Application mobile React Native
- Microservices architecture