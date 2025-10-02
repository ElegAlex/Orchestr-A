# 🤖 Agents Orchestr'A - Automatisation Intelligente

> Agents Claude Code spécialisés pour le développement, déploiement et maintenance d'Orchestr'A
> Version: 2.2 | Dernière mise à jour: Janvier 2025
> 
> **🎉 STATUT**: Application déployée et opérationnelle - Phase 1 Core 100% complétée ✅
> **🔗 URL**: https://orchestr-a-3b48e.web.app
> **📋 Projet Firebase**: orchestr-a-3b48e (région us-central1)

## 🎯 Table des Agents

### Développement
- [`dev-start`](#dev-start) - Démarre l'environnement de développement complet
- [`dev-reset`](#dev-reset) - Reset complet avec données de test
- [`fix-types`](#fix-types) - Corrige tous les problèmes TypeScript
- [`implement-feature`](#implement-feature) - Implémente une fonctionnalité du cahier des charges

### Qualité & Tests
- [`test-complete`](#test-complete) - Suite de tests complète avant commit
- [`security-audit`](#security-audit) - Audit de sécurité complet
- [`performance-check`](#performance-check) - Analyse de performance

### Déploiement
- [`deploy-staging`](#deploy-staging) - Déploiement en staging avec validation
- [`deploy-production`](#deploy-production) - Déploiement production avec rollback
- [`emergency-rollback`](#emergency-rollback) - Rollback d'urgence

### Maintenance & Debug
- [`fix-firebase-rules`](#fix-firebase-rules) - Corrige et optimise les règles Firebase
- [`diagnose-issue`](#diagnose-issue) - Diagnostic intelligent des problèmes
- [`cleanup-data`](#cleanup-data) - Nettoyage et optimisation des données

### Migration & Import
- [`migrate-from-jira`](#migrate-from-jira) - Migration complète depuis Jira
- [`import-users`](#import-users) - Import en masse des utilisateurs
- [`sync-public-sector`](#sync-public-sector) - Synchronisation données secteur public

### Administration
- [`setup-admin`](#setup-admin) - Configure un nouvel administrateur
- [`generate-reports`](#generate-reports) - Génère tous les rapports mensuels
- [`backup-complete`](#backup-complete) - Backup complet avec vérification

---

## 🎯 Statut de Déploiement Actuel

### ✅ Infrastructure Opérationnelle
**Dernière mise à jour**: 5 janvier 2025

| Service | Statut | URL/Config | Notes |
|---------|--------|------------|-------|
| **Frontend React** | ✅ Déployé | https://orchestr-a-3b48e.web.app | Build optimisé (536.19 kB) |
| **Cloud Firestore** | ✅ Actif | orchestr-a-3b48e | 11 indexes composites |
| **Cloud Functions** | ✅ Déployées | us-central1 | 7 fonctions Node.js 18 |
| **Firebase Storage** | ✅ Configuré | orchestr-a-3b48e.firebasestorage.app | Règles de sécurité actives |
| **Authentication** | ✅ Actif | Email/Password | Intégré Redux Toolkit |

### 🔧 Services Déployés

#### Cloud Functions (7)
1. `onProjectCreated` - Trigger création projet
2. `onTaskAssigned` - Trigger assignation tâche  
3. `checkDeadlines` - Vérification échéances (cron)
4. `cleanupOldData` - Nettoyage automatique (cron)
5. `webhook` - Endpoint HTTP webhooks
6. `generateReport` - Génération rapports
7. `exportData` - Export données

#### Firestore Indexes (11)
- Tasks: projectId+status+priority, assigneeId+status+dueDate
- Projects: status+priority+startDate
- Activities: userId+timestamp
- Documents: projectId+uploadedAt
- Notifications: userId+isRead+createdAt
- TimeEntries: userId+date, taskId+date
- Risks: projectId+severity+createdAt
- ResourceAllocations: userId+startDate  
- Leaves: status+startDate

### 🚨 Corrections Appliquées
- ✅ Migration Firebase v8 → v9 modular SDK
- ✅ Correction conflits noms (limit parameter)
- ✅ Mise à jour types TypeScript (permissions, roles)
- ✅ Configuration projet orchestr-a-3b48e (US region)

### 🎯 Phase 1 Core - 100% Complétée (Janvier 2025)
- ✅ Page détail projet avec système d'onglets
- ✅ Gestion avancée des dépendances entre tâches
- ✅ Page Calendrier complète avec événements
- ✅ Page Rapports avec graphiques et métriques

---

## 🚀 Agents de Développement

### dev-start
Lance l'environnement de développement complet avec toutes les dépendances
```bash
cd orchestra-app
npm install
firebase emulators:start --only firestore,auth,storage,functions --project orchestr-a-3b48e &
npm start
```
- Vérifie les variables d'environnement
- Lance les émulateurs Firebase
- Initialise les données de test si base vide
- Ouvre le navigateur sur localhost:3000

### dev-reset
Reset complet de l'environnement avec nouvelles données de test
```bash
cd orchestra-app
rm -rf node_modules package-lock.json
npm install
firebase firestore:delete --all-collections --project orchestr-a
node src/services/data-init.service.ts
```
- Nettoie les dépendances
- Supprime toutes les données Firestore
- Réinitialise avec données de démonstration secteur public
- Crée utilisateurs de test avec tous les rôles

### fix-types
Résout automatiquement tous les problèmes TypeScript
```bash
cd orchestra-app
npx tsc --noEmit --listFiles | grep error
npm run lint:fix
```
- Identifie tous les problèmes de typage
- Applique les fixes automatiques possibles
- Génère un rapport des corrections manuelles nécessaires
- Met à jour les types dans index.ts si nécessaire

### implement-feature
Assistant IA pour implémenter une fonctionnalité du cahier des charges
- Analyse le cahier des charges pour la fonctionnalité demandée
- Vérifie les dépendances et prérequis
- Génère le code nécessaire (composants, services, types)
- Crée les tests unitaires
- Met à jour la documentation
- Exemple: "implement-feature calendar-module"

---

## 🧪 Agents Qualité & Tests

### test-complete
Suite de tests complète avant tout commit/déploiement
```bash
cd orchestra-app
npm run test -- --coverage --watchAll=false
npm run lint
npx tsc --noEmit
firebase emulators:exec --only firestore 'npm run test:integration'
```
- Tests unitaires avec couverture
- Vérification ESLint
- Validation TypeScript
- Tests d'intégration Firebase
- Génère rapport de couverture HTML

### security-audit
Audit de sécurité complet du projet
```bash
npm audit --audit-level=moderate
firebase firestore:rules:test firestore.rules
grep -r "process.env" src/ | grep -v ".env.example"
```
- Vérifie les vulnérabilités des dépendances
- Teste les règles de sécurité Firestore
- Cherche les fuites de variables d'environnement
- Vérifie les permissions Storage
- Analyse les Cloud Functions pour failles XSS/injection

### performance-check
Analyse complète des performances
```bash
cd orchestra-app
npm run build
npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json
npm run analyze
```
- Build de production avec analyse du bundle
- Lighthouse audit (Performance, SEO, Accessibilité)
- Détection des re-renders inutiles
- Analyse des requêtes Firestore N+1
- Suggestions d'optimisation

---

## 🚢 Agents de Déploiement

### deploy-staging
Déploiement sécurisé en environnement de staging
```bash
cd orchestra-app
npm run test:complete
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes --project orchestr-a-3b48e
```
- Execute tous les tests avant déploiement
- Build optimisé pour staging
- Déploie sur Firebase staging
- Teste les URLs critiques après déploiement
- Envoie notification Slack/Teams

### deploy-production
Déploiement production avec méthode validée et fonctionnelle
```bash
# ⚠️ IMPORTANT: Utiliser UNIQUEMENT cette méthode - Validée le 29/09/2025
# Documentation complète: /DEPLOY-WORKING-METHOD.md

# Backup avant déploiement
firebase firestore:export gs://orchestr-a-3b48e-backups/$(date +%Y%m%d-%H%M%S) --project orchestr-a-3b48e 2>/dev/null || true

# Build et déploiement AVEC LES VRAIES CREDENTIALS
cd orchestra-app
npm run build
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
firebase deploy --only hosting --project orchestr-a-3b48e

# Vérification post-déploiement
curl -f https://orchestr-a-3b48e.web.app
```
- **CREDENTIALS RÉELLES** : `service-account-real.json` (VALIDÉES 29/09/2025)
- **Service Account** : `orchestr-a-3b48e@appspot.gserviceaccount.com`
- Build optimisé production avec Firebase CLI
- Upload sécurisé avec authentification service account
- Validation post-déploiement automatique
- **ÉVITER deploy-api.sh** (erreurs 404 API REST)

### emergency-rollback
Rollback d'urgence en cas de problème production
```bash
firebase hosting:releases:list
firebase hosting:rollback
firebase functions:delete --force
gcloud firestore import gs://orchestr-a-backups/latest
```
- Rollback immédiat du hosting
- Restauration de la dernière version stable
- Restauration des données depuis backup
- Notification équipe avec détails incident
- Création ticket post-mortem

---

## 🔧 Agents Maintenance & Debug

### fix-firebase-rules
Optimise et corrige les règles de sécurité Firebase
```bash
cd orchestra
firebase firestore:rules:test firestore.rules --project orchestr-a-3b48e
```
- Analyse les règles actuelles pour failles
- Applique les bonnes pratiques secteur public
- Ajoute validation RGPD
- Optimise les performances des règles
- Génère rapport de conformité

### diagnose-issue
Diagnostic intelligent des problèmes signalés
```bash
# Collecte des logs
firebase functions:log --limit 100
npm run build 2>&1 | tee build-errors.log

# Analyse
grep -r "console.error" src/
firebase firestore:indexes:list
```
- Collecte logs Firebase Functions
- Analyse erreurs de build
- Vérifie les index Firestore manquants
- Détecte les problèmes de performance
- Propose solutions avec code

### cleanup-data
Nettoyage et optimisation des données Firestore
```bash
# Suppression données obsolètes
firebase firestore:delete tasks --where status=archived --where updatedAt<$(date -d '6 months ago')

# Optimisation
firebase firestore:indexes:create
```
- Supprime les données archivées > 6 mois
- Nettoie les documents orphelins
- Optimise les index
- Compacte les collections volumineuses
- Génère rapport d'optimisation

---

## 📥 Agents Migration & Import

### migrate-from-jira
Migration complète depuis une instance Jira
```python
# Export Jira -> Import Orchestr'A
python3 scripts/jira-export.py --url $JIRA_URL --token $JIRA_TOKEN
node scripts/transform-jira-data.js
firebase firestore:import ./jira-export-transformed
```
- Exporte tous les projets Jira via API
- Transforme les données au format Orchestr'A
- Préserve l'historique et les relations
- Migre les pièces jointes
- Génère rapport de migration avec mapping ID

### import-users
Import en masse des utilisateurs depuis CSV/LDAP
```bash
# Import depuis CSV secteur public
node scripts/import-users.js --source users.csv --role-mapping public-sector
firebase auth:import users.json --hash-algo=SHA256
```
- Parse CSV avec format secteur public
- Crée comptes Firebase Auth
- Assigne rôles selon organigramme
- Configure permissions initiales
- Envoie emails de bienvenue personnalisés

### sync-public-sector
Synchronisation avec systèmes secteur public
```bash
# Sync avec SIRH pour congés
node scripts/sync-sirh.js --endpoint $SIRH_API --mode bidirectional

# Import référentiel marchés publics  
node scripts/import-marches-publics.js --source chorus-pro
```
- Synchronise congés/absences avec SIRH
- Importe données marchés publics
- Met à jour organigramme
- Synchronise calendrier jours fériés
- Applique règles comptabilité publique

---

## 👤 Agents Administration

### setup-admin
Configure un nouvel administrateur avec tous les privilèges
```bash
# Création compte admin
firebase auth:create admin@orchestr-a.fr --password=TempPass123!
node scripts/set-admin-role.js admin@orchestr-a.fr

# Configuration personnalisée
firebase firestore:set users/$(uid) --data='{"role":"admin","permissions":["*"]}'
```
- Crée compte avec mot de passe fort
- Assigne custom claims admin
- Configure permissions Firestore
- Active 2FA obligatoire
- Envoie guide d'administration

### generate-reports
Génère tous les rapports mensuels automatiquement
```bash
cd orchestra-app
node scripts/generate-reports.js --month=$(date +%Y-%m)
```
- Rapport d'activité mensuel (PDF)
- Tableau de bord des KPIs
- Analyse charge de travail équipe
- Rapport conformité secteur public
- Export comptabilité analytique
- Envoi automatique aux managers

### backup-complete
Backup complet avec vérification d'intégrité
```bash
# Backup Firestore
firebase firestore:export gs://orchestr-a-backups/$(date +%Y%m%d-%H%M%S)

# Backup Storage
gsutil -m cp -r gs://orchestr-a.firebasestorage.app gs://orchestr-a-backups/storage-$(date +%Y%m%d)

# Vérification
firebase firestore:export:status $OPERATION_ID
```
- Export complet Firestore avec timestamp
- Backup Storage (documents, avatars)
- Export configuration et règles
- Vérification intégrité des backups
- Rotation automatique (garde 30 jours)
- Notification si échec

---

## 📋 Agents Spéciaux Cahier des Charges

### implement-phase1-core
Implémente automatiquement toutes les fonctionnalités Phase 1 manquantes
- Page détail projet avec onglets
- Gestion des dépendances entre tâches
- Page Calendrier complète
- Page Rapports avec graphiques
- Tests unitaires pour le tout

### implement-hr-module
Développe le module RH complet selon le cahier des charges
- Interface de gestion des congés avec workflow
- Matrice des compétences interactive
- Gestion des contrats de travail
- Planning de formation
- Dashboard RH avec métriques

### implement-gantt-timeline
Crée les vues de planification avancées
- Diagramme de Gantt interactif
- Timeline des projets
- Chemin critique
- Vue Portfolio multi-projets
- Export MS Project

### optimize-public-sector
Optimisations spécifiques secteur public
- Templates projets marchés publics
- Workflows de validation hiérarchique
- Intégration Chorus Pro
- Rapports conformité RGPD
- Dashboard pour élus

---

## 🛠️ Utilisation

### Commande de base
```bash
# Exécuter un agent
claude-code run <agent-name>

# Avec paramètres
claude-code run implement-feature --name="calendar-module"

# Mode interactif
claude-code run diagnose-issue --interactive
```

### Variables d'environnement requises
```bash
export FIREBASE_PROJECT_ID=orchestr-a-3b48e
export FIREBASE_TOKEN=$(firebase login:ci)
export SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Variables React (dans orchestra-app/.env)
REACT_APP_FIREBASE_API_KEY=AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU
REACT_APP_FIREBASE_AUTH_DOMAIN=orchestr-a.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=orchestr-a-3b48e
REACT_APP_FIREBASE_STORAGE_BUCKET=orchestr-a-3b48e.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=991388913696
REACT_APP_FIREBASE_APP_ID=1:991388913696:web:2cc37a45fbae9871c6ac45
REACT_APP_FIREBASE_MEASUREMENT_ID=G-B58VR5VGT4
```

### Personnalisation
Chaque agent peut être personnalisé en modifiant ce fichier. Les agents utilisent les conventions du projet et s'adaptent automatiquement à l'architecture existante.

---

## 📝 Notes

- **Sécurité**: Tous les agents de production demandent confirmation
- **Logs**: Chaque exécution est loggée dans `.claude/agent-logs/`
- **Rollback**: Chaque agent critique crée un point de restauration
- **Notifications**: Intégration Slack/Teams/Email configurable
- **RGPD**: Tous les agents respectent la conformité secteur public

---

*Dernière mise à jour: Septembre 2025 | Version: 2.0 | Orchestr'A - Gestion de Projet Secteur Public*