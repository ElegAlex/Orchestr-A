# 🎭 Fonctionnalité de Simulation Utilisateur - Orchestr'A

## 📋 Vue d'ensemble

La fonctionnalité "View as User" permet aux administrateurs de simuler la vue réelle d'un autre utilisateur dans Orchestr'A, particulièrement sur le dashboard-hub. C'est un outil essentiel pour le debug et le support utilisateur.

## ✨ Fonctionnalités

- **🔍 Simulation Complète** : Voir exactement ce que voit un utilisateur
- **📊 Dashboard Contextualisé** : KPIs, tâches, et données personnalisées
- **🛡️ Sécurité** : Accessible uniquement aux administrateurs
- **👁️ Indicateurs Visuels** : Mode simulation clairement identifiable
- **🔄 Contrôle Simple** : Démarrage et arrêt intuitifs

## 🚀 Utilisation

### 1. Accès à la Fonction
1. Connectez-vous avec un compte **administrateur**
2. Allez sur `/admin` (Page Administration)
3. Trouvez la section "Simulation Utilisateur" en haut de la page

### 2. Démarrer une Simulation
1. Sélectionnez un utilisateur dans la liste déroulante
2. Cliquez sur **"Simuler"**
3. Le système bascule automatiquement en mode simulation

### 3. Navigation en Mode Simulation
- Allez sur `/dashboard-hub` pour voir la vue de l'utilisateur
- **Bannière bleue** indique le mode simulation actif
- Toutes les données (KPIs, tâches, événements) sont celles de l'utilisateur simulé

### 4. Sortir de la Simulation
- Cliquez sur **"Quitter simulation"** dans la bannière
- Ou rechargez simplement la page

## 🔧 Architecture Technique

### Services Créés
- `UserSimulationService` : Gestion de la simulation
- `SimulatedDashboardHubService` : Proxy pour les données
- Hook `useSimulatedUser` : Intégration React

### Composants Ajoutés
- `UserSimulationControl` : Interface de contrôle admin
- Indicateur visuel dans `DashboardHub`
- Intégration dans la page `Admin`

### Fichiers Modifiés
```
src/
├── services/
│   ├── user-simulation.service.ts          [NOUVEAU]
│   └── simulated-dashboard-hub.service.ts  [NOUVEAU]
├── components/admin/
│   └── UserSimulationControl.tsx           [NOUVEAU]
├── hooks/
│   └── useSimulatedPermissions.ts          [NOUVEAU]
├── pages/
│   ├── Admin.tsx                          [MODIFIÉ]
│   └── DashboardHub.tsx                   [MODIFIÉ]
└── FEATURE_USER_SIMULATION.md             [NOUVEAU]
```

## ⚠️ Sécurité et Limitations

### Sécurité
- ✅ **Accès Restreint** : Seuls les admins peuvent utiliser cette fonction
- ✅ **Audit** : Les simulations sont tracées dans les logs
- ✅ **Session Isolée** : La simulation n'affecte que le navigateur actuel
- ✅ **Pas de Modification** : Lecture seule des données utilisateur

### Limitations Actuelles
- 🟡 **Dashboard Uniquement** : Fonctionne sur `/dashboard-hub` principalement
- 🟡 **Session Temporaire** : Se remet à zéro au refresh de page
- 🟡 **Une Simulation** : Un seul utilisateur simulé à la fois

## 🛠️ Cas d'Usage Typiques

### Support Utilisateur
```
User: "Je ne vois pas mes tâches dans le dashboard"
Admin: Active simulation → Voit exactement le problème → Diagnostique rapidement
```

### Debug Permissions
```
Développeur: Veut tester les permissions d'un rôle spécifique
Solution: Simule un utilisateur avec ce rôle
```

### Formation
```
Formateur: Montre l'interface depuis la perspective d'un utilisateur débutant
Solution: Simule un compte contributeur
```

## 📈 Extensions Futures Possibles

1. **🔄 Simulation Étendue** : Autres pages que le dashboard
2. **💾 Sessions Persistantes** : Survit au rechargement
3. **👥 Multi-Simulation** : Simuler plusieurs utilisateurs
4. **📝 Notes Admin** : Ajouter des annotations pendant la simulation
5. **🔍 Mode Comparaison** : Vue côte-à-côte admin/utilisateur

## 🧪 Tests Recommandés

### Tests Fonctionnels
- [x] Simulation d'un contributeur
- [x] Simulation d'un chef de projet
- [x] Simulation d'un responsable
- [x] Vérification des permissions
- [x] Arrêt de simulation

### Tests de Sécurité
- [x] Accès refusé pour non-admin
- [x] Impossible de modifier les données simulées
- [x] Logs d'audit générés

### Tests d'Intégration
- [x] Dashboard charge correctement en simulation
- [x] KPIs correspondent à l'utilisateur simulé
- [x] Tâches filtrées correctement
- [x] Événements contextualisés

## 💡 Tips d'Utilisation

1. **🎯 Debug Rapide** : Commencer par simuler l'utilisateur problématique
2. **🔍 Vérification Permissions** : Tester les différents rôles systématiquement
3. **📊 Validation Données** : S'assurer que les KPIs sont cohérents
4. **🔄 Reset Propre** : Toujours quitter proprement la simulation

---

**Version** : 1.0
**Statut** : ✅ Opérationnel
**Dernière mise à jour** : Septembre 2025