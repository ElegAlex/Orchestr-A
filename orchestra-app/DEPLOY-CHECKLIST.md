# ✅ CHECKLIST DÉPLOIEMENT RÈGLES FIRESTORE SÉCURISÉES

## 🎯 OBJECTIF
Remplacer les règles Firestore **non sécurisées** (mode démo) par les règles **sécurisées avec support RACI**.

---

## 📋 AVANT LE DÉPLOIEMENT

### 1. Vérification des Fichiers
- [x] ✅ `/orchestra-app/firestore.rules` - Règles sécurisées (460 lignes)
- [x] ✅ `/orchestra-app/firestore.rules.demo-backup` - Backup ancien fichier
- [x] ✅ `/orchestra-app/deploy-firestore-rules.sh` - Script déploiement
- [x] ✅ `/orchestra-app/SECURITY-UPGRADE.md` - Documentation complète

### 2. Lecture Obligatoire
- [ ] 📖 Lire `SECURITY-UPGRADE.md` entièrement
- [ ] 📖 Comprendre les changements RACI

### 3. Préparation
- [ ] 💾 Backup base de données (optionnel mais recommandé)
- [ ] 📢 Prévenir les utilisateurs (maintenance 5-10 min)
- [ ] 🧪 Environnement de test validé (si disponible)

---

## 🚀 DÉPLOIEMENT

### Option A: Script Automatique (RECOMMANDÉ)

```bash
cd orchestra-app
./deploy-firestore-rules.sh
```

Le script fait:
1. Vérification environnement ✅
2. Détection règles non sécurisées ✅
3. Backup automatique ✅
4. Validation syntaxe ✅
5. Confirmation utilisateur ✅
6. Déploiement ✅

### Option B: Déploiement Manuel

```bash
cd orchestra-app

# 1. Vérifier le contenu
head -20 firestore.rules

# 2. Vérifier qu'on n'est PAS en mode démo
grep "allow read, write: if true" firestore.rules && echo "⚠️ MODE DÉMO!" || echo "✅ Sécurisé"

# 3. Déployer avec les vraies credentials (méthode validée)
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
firebase deploy --only firestore:rules --project orchestr-a-3b48e
```

---

## 🧪 TESTS POST-DÉPLOIEMENT

### Test 1: Vérification Console Firebase
- [ ] Ouvrir: https://console.firebase.google.com/project/orchestr-a-3b48e/firestore/rules
- [ ] Vérifier que les règles déployées correspondent
- [ ] Chercher "canModifyTask" → Doit être présent

### Test 2: Tests Fonctionnels Application

#### A. Test Authentification
- [ ] Se déconnecter complètement
- [ ] Essayer d'accéder aux tâches → Doit rediriger vers login

#### B. Test Utilisateur Référent Technique
1. [ ] Se connecter avec compte référent (non-manager)
2. [ ] Créer une nouvelle tâche → **Doit réussir**
3. [ ] Modifier cette tâche → **Doit réussir** (créateur)
4. [ ] Supprimer cette tâche → **Doit réussir** (créateur)

#### C. Test RACI - Responsible
1. [ ] Se connecter avec compte Admin
2. [ ] Créer tâche et assigner utilisateur X dans `responsible[]`
3. [ ] Se déconnecter et connecter avec compte utilisateur X
4. [ ] Modifier la tâche → **Doit réussir** (RACI)
5. [ ] Tenter de supprimer → **Doit échouer** (pas Accountable)

#### D. Test RACI - Accountable
1. [ ] Se connecter avec compte Admin
2. [ ] Créer tâche et assigner utilisateur Y dans `accountable[]`
3. [ ] Se déconnecter et connecter avec compte utilisateur Y
4. [ ] Modifier la tâche → **Doit réussir** (RACI)
5. [ ] Supprimer la tâche → **Doit réussir** (Accountable)

#### E. Test Permissions Refusées
1. [ ] Se connecter avec utilisateur Z (non assigné)
2. [ ] Essayer de modifier tâche d'un autre → **Doit échouer**
3. [ ] Essayer de supprimer tâche d'un autre → **Doit échouer**

### Test 3: Vérification Logs
- [ ] Console Firebase → Onglet "Usage" → Pas d'erreurs massives
- [ ] Console navigateur → Pas d'erreurs PERMISSION_DENIED inattendues

---

## 🔴 EN CAS DE PROBLÈME

### Symptômes Possibles

#### 1. "PERMISSION_DENIED" partout
**Cause**: Règles trop restrictives ou problème auth
**Solution**:
```bash
# Vérifier les logs Firebase
# Vérifier que request.auth.token.role existe
# Si besoin, rollback temporaire
```

#### 2. Utilisateurs ne peuvent plus modifier leurs tâches
**Cause**: Champ RACI vide ou mal rempli
**Solution**:
```bash
# Vérifier en base que responsible[] ou accountable[] sont remplis
# Vérifier que createdBy est bien défini
```

#### 3. Rollback Urgent

```bash
cd orchestra-app

# ATTENTION: Réactive le mode NON SÉCURISÉ
cp firestore.rules.demo-backup firestore.rules
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
firebase deploy --only firestore:rules --project orchestr-a-3b48e
```

Puis investiguer le problème et corriger avant redéploiement.

---

## 📊 MONITORING POST-DÉPLOIEMENT

### Jour 1 (J+0)
- [ ] Vérifier erreurs console Firebase (1h après)
- [ ] Interroger 2-3 utilisateurs test
- [ ] Surveiller support/tickets

### Jour 2-7 (J+1 à J+7)
- [ ] Review logs quotidiens
- [ ] Collecter feedback utilisateurs
- [ ] Ajuster si nécessaire

---

## ✅ VALIDATION FINALE

- [ ] Tous les tests passent ✅
- [ ] Aucune erreur PERMISSION_DENIED anormale
- [ ] Utilisateurs peuvent travailler normalement
- [ ] Système RACI fonctionnel
- [ ] Documentation mise à jour

---

## 📝 SIGN-OFF

| Étape | Date | Validé par | Commentaire |
|-------|------|------------|-------------|
| Préparation fichiers | 2025-10-02 | Claude Code | ✅ Terminé |
| Review code | | | |
| Tests pré-déploiement | | | |
| Déploiement production | | | |
| Tests post-déploiement | | | |
| Validation finale | | | |

---

**IMPORTANT**: Ne pas déployer en production sans avoir validé tous les tests ! 🚨
