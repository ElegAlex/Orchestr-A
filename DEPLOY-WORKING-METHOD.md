# 🚀 MÉTHODE DE DÉPLOIEMENT PRODUCTION - VALIDÉE ET FONCTIONNELLE

## ⚠️ IMPORTANT - LIRE EN PREMIER
**Cette méthode a été testée et validée le 29/09/2025. Elle FONCTIONNE.**
**Utiliser UNIQUEMENT cette méthode pour déployer en production.**

## 📋 Méthode de Déploiement Validée

### 1️⃣ Prérequis
- Build de production créé : `npm run build` dans le dossier `orchestra-app/`
- Fichiers prêts dans le dossier `build/`

### 2️⃣ Déploiement Automatique (MÉTHODE QUI MARCHE)

```bash
cd /home/alex/Documents/Repository/orchestr-a-master/orchestra-app
npm run build
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
firebase deploy --only hosting --project orchestr-a-3b48e
```

**⚠️ IMPORTANT :** Le fichier `service-account-real.json` contient les vraies credentials Firebase.

### 3️⃣ Configuration Critique

**🔑 CREDENTIALS RÉELLES pour le déploiement :**

**Fichier :** `/orchestra-app/service-account-real.json`
**Service Account :** `orchestr-a-3b48e@appspot.gserviceaccount.com`
**Project ID :** `orchestr-a-3b48e`

**Variable d'environnement :**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
```

### 4️⃣ Méthode de Déploiement Principale

**Commande Firebase CLI avec Service Account :**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
firebase deploy --only hosting --project orchestr-a-3b48e
```

Cette méthode :
1. Utilise les credentials du service account réel
2. Authentifie automatiquement avec Google Cloud
3. Upload tous les fichiers du build/ vers Firebase Hosting
4. Finalise et active le déploiement
5. Rend l'app disponible immédiatement

### 5️⃣ URLs de Production

✅ **Application déployée sur :**
- https://orchestr-a-3b48e.web.app (principal)
- https://orchestr-a-3b48e.firebaseapp.com (alternatif)

## 🔧 Alternative si le Script Échoue

Si `deploy-api.sh` ne fonctionne pas :

1. **Créer une archive :**
```bash
cd orchestra-app/build
zip -r ../build-prod.zip .
cd ..
```

2. **Déploiement manuel via Console Firebase :**
- Aller sur : https://console.firebase.google.com/project/orchestr-a-3b48e/hosting
- Cliquer "Nouveau déploiement"
- Glisser-déposer `build-prod.zip`
- Publier

## ❌ Méthodes qui NE MARCHENT PAS

**NE PAS UTILISER :**
- ❌ `deploy-api.sh` (erreurs 404 sur API REST Firebase)
- ❌ API REST Firebase Hosting (nécessite OAuth complexe)
- ❌ `gsutil` vers appspot.com (bucket inexistant)
- ❌ Fichiers service-account.json FACTICES
- ❌ API Keys seules sans service account
- ❌ `firebase deploy` SANS les bonnes credentials

## 📝 Informations Projet

- **Project ID :** orchestr-a-3b48e
- **Project Number :** 727625651545
- **Admin Email :** elegalex1980@gmail.com
- **Environment :** Production

## 🎯 Derniers Déploiements Réussis

| Date | Version | Méthode | Statut |
|------|---------|---------|--------|
| 29/09/2025 | main.5d2e9f2a.js | deploy-api.sh | ✅ Succès |

## 🔍 Comment Retrouver Cette Documentation

**Cette documentation est référencée dans :**
- `/README.md` - Section Déploiement
- `/agents.md` - Agent deploy-production
- `/orchestra-app/DEPLOYMENT-GUIDE.md` - Référence principale

**Mots-clés pour recherche :**
- DEPLOY-WORKING-METHOD
- deploy-api.sh
- AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU

---

*Document maintenu à jour. Dernière validation : 29/09/2025*
*NE PAS MODIFIER sans test préalable réussi.*