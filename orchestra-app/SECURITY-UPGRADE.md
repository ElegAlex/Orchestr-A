# 🔒 MISE À NIVEAU SÉCURITÉ FIRESTORE - Orchestr'A

**Date**: 2 octobre 2025
**Criticité**: 🔴 **CRITIQUE**
**Statut**: ✅ Correctif appliqué, déploiement en attente

---

## 📋 RÉSUMÉ

Les règles Firestore en production étaient en **mode DÉMO** avec accès total ouvert (`allow read, write: if true`). Les nouvelles règles sécurisées avec **support RACI complet** ont été créées et sont prêtes à être déployées.

---

## 🔍 PROBLÈME IDENTIFIÉ

### Situation Avant Correctif

**Fichier**: `/orchestra-app/firestore.rules` (2101 octets - MODE DÉMO)

```javascript
// ⚠️ RÈGLES NON SÉCURISÉES
match /{document=**} {
  allow read, write: if true;  // Accès total ouvert !
}
```

**Impact**:
- ❌ N'importe qui peut lire/écrire toutes les données
- ❌ Aucune authentification requise
- ❌ Aucun contrôle des rôles
- ❌ Système RACI non fonctionnel
- 🔴 **VULNÉRABILITÉ CRITIQUE DE SÉCURITÉ**

---

## ✅ SOLUTION APPLIQUÉE

### Nouvelles Règles Sécurisées

**Fichier**: `/orchestra-app/firestore.rules` (460 lignes - PRODUCTION)

#### 1. Fonctions RACI Ajoutées (lignes 51-94)

```javascript
// Vérifie si l'utilisateur est dans responsible[]
function isResponsibleFor(task) {
  return request.auth != null &&
         task.responsible is list &&
         request.auth.uid in task.responsible;
}

// Vérifie si l'utilisateur est dans accountable[]
function isAccountableFor(task) {
  return request.auth != null &&
         task.accountable is list &&
         request.auth.uid in task.accountable;
}

// Vérifie si l'utilisateur peut modifier (R ou A)
function canModifyTask(task) {
  return isResponsibleFor(task) || isAccountableFor(task);
}
```

#### 2. Règles Tasks Sécurisées (lignes 140-161)

```javascript
match /tasks/{taskId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();

  allow update: if isAuthenticated() && (
    canModifyTask(resource.data) ||        // ✅ RACI: R ou A
    isOwner(resource.data.assigneeId) ||   // Rétrocompat
    isOwner(resource.data.createdBy) ||    // Créateur
    isManager()                             // Manager
  );

  allow delete: if isAuthenticated() && (
    isAccountableFor(resource.data) ||     // ✅ RACI: A
    isOwner(resource.data.createdBy) ||    // Créateur
    isManager()                             // Manager
  );
}
```

#### 3. Règles SimpleTasks Sécurisées (lignes 164-178)

```javascript
match /simpleTasks/{taskId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();

  allow update: if isAuthenticated() && (
    canModifyTask(resource.data) ||     // ✅ RACI complet
    isOwner(resource.data.createdBy) ||
    isManager()
  );

  allow delete: if isAuthenticated() && (
    isAccountableFor(resource.data) ||  // ✅ RACI: Accountable
    isOwner(resource.data.createdBy) ||
    isManager()
  );
}
```

---

## 🚀 DÉPLOIEMENT

### Méthode Recommandée

```bash
cd orchestra-app
./deploy-firestore-rules.sh
```

Le script effectue automatiquement:
1. ✅ Vérification environnement
2. ✅ Détection mode démo
3. ✅ Backup règles actuelles
4. ✅ Validation syntaxe
5. ✅ Confirmation utilisateur
6. ✅ Déploiement sécurisé

### Méthode Manuelle

```bash
cd orchestra-app

# Vérifier les règles
cat firestore.rules | head -20

# Déployer avec les vraies credentials (comme pour hosting)
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
firebase deploy --only firestore:rules --project orchestr-a-3b48e
```

---

## 🧪 PLAN DE TEST POST-DÉPLOIEMENT

### Test 1: Authentification Requise ✅
- [ ] Tentative lecture sans authentification → **Doit échouer**
- [ ] Tentative écriture sans authentification → **Doit échouer**

### Test 2: Système RACI - Responsible ✅
1. [ ] Admin crée tâche et assigne User1 dans `responsible[]`
2. [ ] User1 se connecte et modifie la tâche → **Doit réussir**
3. [ ] User2 (non assigné) tente de modifier → **Doit échouer**

### Test 3: Système RACI - Accountable ✅
1. [ ] Admin crée tâche et assigne User1 dans `accountable[]`
2. [ ] User1 se connecte et modifie la tâche → **Doit réussir**
3. [ ] User1 supprime la tâche → **Doit réussir**

### Test 4: Rôles Managers ✅
- [ ] Manager peut modifier toutes les tâches → **Doit réussir**
- [ ] Responsable peut modifier toutes les tâches → **Doit réussir**
- [ ] Admin peut tout faire → **Doit réussir**

### Test 5: Référent Technique ✅
1. [ ] Référent crée sa propre tâche → **Doit réussir** (créateur)
2. [ ] Référent modifie sa tâche → **Doit réussir** (créateur)
3. [ ] Admin lui assigne une tâche via `responsible[]` → **Doit réussir**
4. [ ] Référent modifie cette tâche → **Doit réussir** (RACI)

### Test 6: Rétrocompatibilité ✅
- [ ] Anciennes tâches avec `assigneeId` fonctionnent → **Doit réussir**
- [ ] Nouvelles tâches RACI fonctionnent → **Doit réussir**

---

## 📂 FICHIERS MODIFIÉS

| Fichier | Action | Statut |
|---------|--------|--------|
| `/orchestra-app/firestore.rules` | ✅ Remplacé par règles sécurisées | Prêt |
| `/orchestra-app/firestore.rules.demo-backup` | ✅ Backup ancien fichier | Conservé |
| `/orchestra-app/deploy-firestore-rules.sh` | ✅ Nouveau script déploiement | Créé |
| `/orchestra-app/SECURITY-UPGRADE.md` | ✅ Cette documentation | Créé |

---

## ⚠️ ROLLBACK (SI NÉCESSAIRE)

En cas de problème après déploiement:

```bash
cd orchestra-app

# Restaurer les anciennes règles (DÉMO - ATTENTION!)
cp firestore.rules.demo-backup firestore.rules

# Redéployer
firebase deploy --only firestore:rules --project orchestr-a-3b48e
```

**⚠️ ATTENTION**: Le rollback réactive le mode **NON SÉCURISÉ** !

---

## 📊 MATRICE PERMISSIONS RACI

| Rôle RACI | Lecture | Création | Modification | Suppression |
|-----------|---------|----------|--------------|-------------|
| **R** (Responsible) | ✅ | ✅ | ✅ | ❌ |
| **A** (Accountable) | ✅ | ✅ | ✅ | ✅ |
| **C** (Consulted) | ✅ | ✅ | ❌ | ❌ |
| **I** (Informed) | ✅ | ✅ | ❌ | ❌ |
| Créateur | ✅ | ✅ | ✅ | ✅ |
| Manager/Admin | ✅ | ✅ | ✅ | ✅ |
| Non-assigné | ✅ | ✅ | ❌ | ❌ |

---

## 🔗 RESSOURCES

- **Console Firebase Rules**: https://console.firebase.google.com/project/orchestr-a-3b48e/firestore/rules
- **Documentation RACI**: `/orchestra-app/src/types/index.ts` (lignes 92-157)
- **Service Tasks**: `/orchestra-app/src/services/task.service.ts`
- **Guide CLAUDE.md**: `/CLAUDE.md`

---

## 📝 NOTES IMPORTANTES

1. **Test en environnement de DEV** d'abord si possible
2. **Prévenir les utilisateurs** avant déploiement (maintenance courte)
3. **Monitorer les erreurs** Firebase après déploiement
4. **Les règles s'appliquent instantanément** (pas de cache)
5. **Backup automatique** créé par le script de déploiement

---

## ✅ CHECKLIST DÉPLOIEMENT

- [x] Règles sécurisées créées avec support RACI
- [x] Script de déploiement préparé
- [x] Backup ancien fichier créé
- [x] Documentation rédigée
- [ ] **Tests validés** (à faire AVANT déploiement production)
- [ ] **Déploiement effectué**
- [ ] **Vérification post-déploiement**
- [ ] **Tests utilisateurs réels**

---

**Dernière mise à jour**: 2 octobre 2025
**Auteur**: Claude Code
**Validé par**: À compléter
