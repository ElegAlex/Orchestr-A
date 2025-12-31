# 🧪 Guide de test - ORCHESTR'A V2 Frontend

## Prérequis

1. **Backend démarré** sur `http://localhost:3001`
2. **Base de données** PostgreSQL avec données de seed
3. **Node.js 22+** installé

## Démarrage rapide

### 1. Démarrer le backend (Terminal 1)

```bash
# À la racine du projet
cd apps/api
pnpm run dev
```

Vérifiez que l'API fonctionne : http://localhost:3001/api/health

### 2. Démarrer le frontend (Terminal 2)

```bash
# À la racine du projet
cd apps/web
pnpm run dev
```

L'application sera disponible sur : http://localhost:3000

## Scénarios de test

### ✅ Test 1 : Authentification

1. Ouvrir http://localhost:3000
2. Vous devriez être redirigé vers `/login`
3. **S'inscrire** :
   - Cliquer sur "S'inscrire"
   - Remplir le formulaire :
     - Prénom: Test
     - Nom: User
     - Email: test@example.com
     - Login: testuser
     - Mot de passe: password123
   - Cliquer sur "S'inscrire"
   - Vous devriez être redirigé vers `/dashboard`

4. **Se déconnecter** :
   - Cliquer sur "Déconnexion" en haut à droite
   - Vous devriez être redirigé vers `/login`

5. **Se connecter** :
   - Login: testuser
   - Mot de passe: password123
   - Cliquer sur "Se connecter"
   - Vous devriez être redirigé vers `/dashboard`

### ✅ Test 2 : Navigation

1. Dans la sidebar, tester tous les liens :
   - Dashboard ✅
   - Projets ✅
   - Tâches ✅
   - Équipe (placeholder)
   - Congés (placeholder)
   - Télétravail (placeholder)
   - Temps (placeholder)
   - Compétences (placeholder)
   - Organisation (placeholder)
   - Documents (placeholder)
   - Paramètres (placeholder)

2. Vérifier que :
   - La navigation fonctionne sans erreur
   - Le lien actif est surligné
   - Les pages placeholder affichent un message

### ✅ Test 3 : Projets

1. **Liste des projets** (`/projects`)
   - Vérifier que la liste se charge
   - Tester la barre de recherche
   - Tester les filtres par statut
   - Cliquer sur un projet → voir le détail

2. **Créer un projet** (`/projects/new`)
   - Cliquer sur "Nouveau projet"
   - Remplir le formulaire :
     - Nom: Mon projet test
     - Description: Ceci est un projet de test
     - Date de début: aujourd'hui
     - Date de fin: dans 1 mois
     - Budget: 50000
   - Cliquer sur "Créer le projet"
   - Vérifier la redirection vers `/projects`
   - Vérifier que le nouveau projet apparaît dans la liste

3. **Détail du projet** (`/projects/[id]`)
   - Cliquer sur un projet
   - Vérifier l'affichage :
     - Nom et statut
     - Dates, budget, manager
     - Barre de progression
     - Liste des tâches (si existantes)

### ✅ Test 4 : Tâches

1. **Liste des tâches** (`/tasks`)
   - Vérifier que la liste se charge
   - Tester la barre de recherche
   - Tester les filtres :
     - Par projet
     - Par statut

2. **Vue Liste**
   - Vérifier l'affichage du tableau
   - Colonnes : Tâche, Projet, Statut, Priorité, Assigné

3. **Vue Kanban**
   - Cliquer sur l'icône grille (à droite)
   - Vérifier les 5 colonnes :
     - À faire
     - En cours
     - En review
     - Bloqué
     - Terminé
   - Vérifier le compteur de tâches par colonne
   - Vérifier l'affichage des cartes de tâches

### ✅ Test 5 : Dashboard

1. Aller sur `/dashboard`
2. Vérifier l'affichage :
   - Message de bienvenue avec nom d'utilisateur
   - 4 widgets de statistiques (valeurs statiques pour l'instant)
   - Section "Projets récents" (valeurs statiques)
   - Section "Tâches prioritaires" (valeurs statiques)

### ✅ Test 6 : Réactivité

1. Tester sur différentes tailles d'écran :
   - Desktop (> 1024px)
   - Tablet (768px - 1024px)
   - Mobile (< 768px)

2. Vérifier que :
   - La sidebar reste accessible
   - Les cartes/grids s'adaptent
   - Les formulaires restent utilisables

## Problèmes connus

### Si le backend n'est pas démarré

- Erreur : "Network Error" ou "Failed to fetch"
- Solution : Démarrer le backend avec `cd apps/api && pnpm run dev`

### Si la base de données est vide

- Les listes seront vides
- Solution : Exécuter le seed avec `pnpm run db:seed`

### Si le token JWT expire

- Vous serez automatiquement déconnecté
- Solution : Se reconnecter

## API Endpoints utilisés

### Authentification

- POST `/auth/register`
- POST `/auth/login`
- GET `/auth/profile`
- GET `/auth/me`

### Projets

- GET `/projects`
- GET `/projects/:id`
- GET `/projects/:id/stats`
- POST `/projects`
- PATCH `/projects/:id`
- DELETE `/projects/:id`

### Tâches

- GET `/tasks`
- GET `/tasks/:id`
- GET `/tasks/project/:projectId`
- POST `/tasks`
- PATCH `/tasks/:id`
- DELETE `/tasks/:id`

### Utilisateurs

- GET `/users`
- GET `/users/:id`

## Prochaines fonctionnalités à développer

1. ✅ Modal de création de tâche (bouton "Nouvelle tâche" fonctionnel)
2. ✅ Modal d'édition de tâche (cliquer sur une tâche)
3. ✅ Drag & Drop sur le Kanban
4. ✅ Pages Congés complètes
5. ✅ Pages Télétravail complètes
6. ✅ Pages TimeTracking complètes
7. ✅ Matrice de compétences
8. ✅ Gestion des utilisateurs (Admin)
9. ✅ Graphiques et analytics

## Support

Pour tout problème :

1. Vérifier les logs du backend (Terminal 1)
2. Vérifier les logs du frontend (Terminal 2)
3. Ouvrir la console du navigateur (F12)
4. Vérifier que `.env.local` contient `NEXT_PUBLIC_API_URL=http://localhost:3001/api`
