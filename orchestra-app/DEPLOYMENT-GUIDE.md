# Guide de Déploiement Firebase - Orchestra App

## 🚀 Déploiement Production

### Prérequis
- Node.js et npm installés
- Firebase CLI installé (`npm install -g firebase-tools`)
- Clé de service Firebase avec permissions hosting

### 1. Build de Production
```bash
npm run build
```

### 2. Déploiement avec Service Account (MÉTHODE VALIDÉE 29/09/2025)
```bash
# MÉTHODE VALIDÉE - Service Account Firebase
cd orchestra-app
npm run build
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
firebase deploy --only hosting --project orchestr-a-3b48e
```
🔑 **Credentials réelles** : `service-account-real.json`
📋 **Documentation complète** : [/DEPLOY-WORKING-METHOD.md](/DEPLOY-WORKING-METHOD.md)

### 3. Vérification Post-Déploiement
```bash
curl -f https://orchestr-a-3b48e.web.app
```

## 🔑 Configuration Firebase

### Projet Firebase
- **Project ID:** `orchestr-a-3b48e`
- **URLs Production:**
  - https://orchestr-a-3b48e.web.app
  - https://orchestr-a-3b48e.firebaseapp.com

### Service Account Email
```
orchestr-a-3b48e@appspot.gserviceaccount.com
```

### Configuration Firebase (`firebase.json`)
```json
{
  "hosting": {
    "public": "build",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Configuration Projet (`.firebaserc`)
```json
{
  "projects": {
    "default": "orchestr-a-3b48e"
  }
}
```

## 🛠️ Développement Local

### Démarrage Émulateurs Firebase
```bash
firebase emulators:start --only firestore,auth --project orchestr-a-3b48e
```

### Démarrage App React
```bash
npm start
```

### URLs Locales
- **App React:** http://localhost:3000
- **Firestore Emulator:** http://localhost:8080
- **Auth Emulator:** http://localhost:9099

## 📊 Données de Test

### Script Création Jalons
```bash
node scripts/create-milestones.js
```

### Script Création Tâches
```bash
node create-test-tasks.js
```

### Comptes de Test
- **Admin:** test@admin.com / password123
- **Manager:** manager@test.com / password123
- **Dev:** dev@test.com / password123

## 🎯 Fonctionnalités Déployées

### Roadmap par Jalons
- ✅ Vue par jalons avec tâches déployables
- ✅ Changement de statut des tâches (dropdown)
- ✅ Déclaration de temps intégrée avec permissions
- ✅ Calcul automatique du statut des jalons
- ✅ Métriques en temps réel
- ✅ Interface Material-UI responsive

### Composants Clés
- `src/components/project/ProjectRoadmap.tsx` - Vue principale roadmap
- `src/components/project/TaskCardWithTimeEntry.tsx` - Cartes tâches avec temps
- `src/services/milestone.service.ts` - Service jalons
- `src/services/task.service.ts` - Service tâches

## 🔧 Commandes Utiles

### Build & Deploy Complet
```bash
# Méthode validée avec service account (29/09/2025)
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
npm run build && firebase deploy --only hosting --project orchestr-a-3b48e
```

### Vérification Déploiement
```bash
curl -I https://orchestr-a-3b48e.web.app
```

### Logs Firebase
```bash
firebase hosting:sites:list --project orchestr-a-3b48e
```

## 🚨 Sécurité

### Clé de Service Firebase
- **JAMAIS** commiter le fichier `service-account-real.json`
- Utiliser les variables d'environnement pour la production
- Renouveler périodiquement les clés via console Firebase
- **Service Account validé** : `orchestr-a-3b48e@appspot.gserviceaccount.com`

### Règles Firestore
- Fichier: `firestore.rules`
- Authentication requise pour toutes les opérations
- Permissions basées sur les rôles utilisateur

## 📝 Notes de Session

### Dernière Mise à Jour: 2025-09-29
- ✅ Optimisation cards tâches roadmap (35% plus compactes)
- ✅ Mode compact automatique TaskCardWithTimeEntry
- ✅ Résolution problème déploiement avec service account réel
- ✅ Documentation complète méthode de déploiement
- ✅ Déploiement Firebase réussi avec nouvelles optimisations

### Problèmes Résolus
1. **Cards tâches trop hautes** - Optimisé avec mode compact (-35% hauteur)
2. **Déploiement automatique échouant** - Résolu avec service-account-real.json
3. **API REST Firebase 404** - Abandon au profit de Firebase CLI
4. **Documentation déploiement incomplète** - Mise à jour complète 4 fichiers
5. **Credentials factices** - Remplacement par vraies credentials Firebase
6. **Authentification service account** - Configuration GOOGLE_APPLICATION_CREDENTIALS

### Prochaines Améliorations
- [ ] Tests automatisés du déploiement
- [ ] CI/CD pipeline
- [ ] Monitoring performance
- [ ] Backup automatique données

---
*Généré le 2025-09-28 - Session de développement roadmap jalons*