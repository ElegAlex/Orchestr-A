# 🤖 GUIDE CLAUDE - À LIRE EN PREMIER À CHAQUE SESSION

## 🚨 INFORMATIONS CRITIQUES - NE JAMAIS OUBLIER

### 🚀 DÉPLOIEMENT EN PRODUCTION

**LA SEULE MÉTHODE QUI MARCHE :**
```bash
cd orchestra-app
npm run build
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
firebase deploy --only hosting --project orchestr-a-3b48e
```

**Fichiers clés :**
- **Credentials Firebase** : `/orchestra-app/service-account-real.json`
- **Documentation** : `/DEPLOY-WORKING-METHOD.md`
- **Service Account Email** : `orchestr-a-3b48e@appspot.gserviceaccount.com`

**⚠️ IMPORTANT :**
- ✅ `service-account-real.json` = LES VRAIES CREDENTIALS qui marchent
- ❌ Tous les autres fichiers service-account*.json sont FAUX
- ❌ deploy-api.sh ne marche PAS (erreurs 404)
- ✅ `firebase deploy` marche AVEC les bonnes credentials

### 📁 Structure Projet

```
/orchestr-a-master/
├── README.md                    # Documentation principale
├── DEPLOY-WORKING-METHOD.md     # MÉTHODE DE DÉPLOIEMENT QUI MARCHE
├── CLAUDE.md                    # CE FICHIER - GUIDE POUR CLAUDE
├── agents.md                    # Agents d'automatisation
├── firebase.json                # Config Firebase racine
├── orchestra-app/               # Application React
│   ├── src/                    # Code source
│   ├── build/                   # Build production
│   ├── deploy-api.sh           # SCRIPT DE DÉPLOIEMENT QUI MARCHE
│   ├── package.json            # Dependencies
│   └── .env                    # Variables d'environnement app
└── functions/                   # Cloud Functions

```

### 🔑 Credentials Production

**Projet Firebase :**
- Project ID : `orchestr-a-3b48e`
- Project Number : `727625651545`
- Admin : `elegalex1980@gmail.com`

**URLs Production :**
- https://orchestr-a-3b48e.web.app
- https://orchestr-a-3b48e.firebaseapp.com

**API Keys :**
- App (.env) : `AIzaSyDM4x12OPV7YgzWSCYW-JOo8P0FjcegMr0`
- Déploiement (deploy-api.sh) : `AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU`

### 📝 Commandes Essentielles

```bash
# Build production
cd orchestra-app
npm run build

# Déploiement
./deploy-api.sh

# Tests
npm test
npm run lint:check
npx tsc --noEmit

# Dev local
npm start
```

### 🔍 Recherche Rapide

Pour retrouver rapidement les infos importantes :
```bash
# Trouver ce guide
ls CLAUDE.md

# Trouver la méthode de déploiement
grep -r "deploy-api.sh" --include="*.md"

# Trouver les API keys
grep -r "AIzaSy" --include="*.sh" --include="*.md"
```

### ⚠️ Pièges à Éviter

1. **NE JAMAIS** essayer `firebase deploy` directement
2. **NE JAMAIS** créer de faux service-account.json
3. **TOUJOURS** utiliser `deploy-api.sh` pour déployer
4. **TOUJOURS** vérifier quelle API key utiliser selon le contexte
5. **NE JAMAIS** modifier `deploy-api.sh` sans test réussi

### 📊 Derniers Déploiements Réussis

| Date | Méthode | Statut | Notes |
|------|---------|--------|-------|
| 29/09/2025 | deploy-api.sh | ✅ | Cards roadmap optimisées |

### 🆘 Si Problème de Déploiement

1. Vérifier que `deploy-api.sh` existe et est exécutable
2. Vérifier l'API key dans le script : `AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU`
3. S'assurer que le build est fait : `npm run build`
4. Lire `/DEPLOY-WORKING-METHOD.md`

### 📚 Documentation Importante

1. **[/DEPLOY-WORKING-METHOD.md](DEPLOY-WORKING-METHOD.md)** - Méthode déploiement validée
2. **[/README.md](README.md)** - Documentation générale
3. **[/agents.md](agents.md#deploy-production)** - Agent de déploiement
4. **[/orchestra-app/deploy-api.sh](orchestra-app/deploy-api.sh)** - LE script qui marche

---

**CE DOCUMENT EST LA RÉFÉRENCE ABSOLUE**
*Dernière mise à jour : 29/09/2025*
*NE JAMAIS ignorer ces informations*