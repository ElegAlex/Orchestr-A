# Scripts Orchestr'A

Ce dossier contient les scripts d'administration et de maintenance pour l'application Orchestr'A.

## 📋 Scripts disponibles

### 🔥 `create-firestore-index.js`
**Objectif** : Créer automatiquement l'index Firestore manquant pour les requêtes sur les tâches par projet.

**Usage** :
```bash
node scripts/create-firestore-index.js
```

**Ce que fait le script** :
- Vérifie la configuration gcloud
- Crée l'index `projectId + createdAt` via l'API Firestore
- Fallback vers Firebase CLI si nécessaire
- Fournit des instructions manuelles en cas d'échec

**Prérequis** :
- `gcloud` CLI installé et configuré
- `firebase` CLI installé (optionnel, pour le fallback)
- Permissions admin sur le projet Firebase

---

### 🧪 `test-firestore-queries.js`
**Objectif** : Valider que tous les index Firestore sont correctement créés et fonctionnels.

**Usage** :
```bash
node scripts/test-firestore-queries.js
```

**Ce que fait le script** :
- Vérifie que l'index `projectId + createdAt` est READY
- Test une requête simulée avec l'index
- Vérifie l'accessibilité de l'application web
- Valide la présence de données de test

---

## 🚀 Workflow complet

Pour réparer les problèmes d'index et déployer l'application :

1. **Créer l'index Firestore** :
   ```bash
   node scripts/create-firestore-index.js
   ```

2. **Attendre 2-5 minutes** que l'index soit prêt

3. **Valider le fonctionnement** :
   ```bash
   node scripts/test-firestore-queries.js
   ```

4. **Tester l'application** :
   - Ouvrir https://orchestr-a.web.app
   - Aller dans un projet
   - Cliquer sur l'onglet "Tâches"
   - Vérifier que les tâches se chargent

## ❌ Résolution de problèmes

### Erreur "The query requires an index"
- Exécuter `node scripts/create-firestore-index.js`
- Si échec, suivre les instructions manuelles affichées

### Erreur "gcloud not found"
- Installer gcloud CLI : https://cloud.google.com/sdk/docs/install
- Configurer le projet : `gcloud config set project orchestr-a`

### Index en état "CREATING"
- Attendre 2-5 minutes
- Relancer les tests : `node scripts/test-firestore-queries.js`

### Tâches ne se chargent pas
- Créer d'abord un projet avec des tâches
- Vérifier que les tâches ont des dates de début/fin
- Vérifier la console développeur pour les erreurs

## 📊 Index Firestore requis

L'application Orchestr'A nécessite ces index composés :

```json
{
  "indexes": [
    {
      "collectionGroup": "tasks", 
      "fields": [
        {"fieldPath": "projectId", "order": "ASCENDING"},
        {"fieldPath": "createdAt", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "tasks",
      "fields": [
        {"fieldPath": "assignedTo", "order": "ASCENDING"}, 
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "dueDate", "order": "ASCENDING"}
      ]
    }
  ]
}
```

Ces index sont créés automatiquement par les scripts ou peuvent être créés manuellement via Firebase Console.