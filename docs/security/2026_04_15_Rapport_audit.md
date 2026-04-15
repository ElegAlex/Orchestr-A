---

title: "Rapport d'audit de sécurité — Application analysée"
auteur: "HAMMACHE Lilian"
date: 2026-04-15
type: audit-securite
classification: confidentiel
statut: ouvert
failles_critiques: 2
failles_elevees: 3
failles_moyennes: 2
failles_faibles: 1
bugs_total: 8
bugs_haute: 4
tags:

- audit
- sécurité
- vulnérabilités
- confidentiel
- owasp aliases:
- "Audit LHA 15/04/2026"
- cssclasses:
- audit-report

---

# 🛡️ Rapport d'audit de sécurité

> [!info] Métadonnées du document
> 
> - **Auteur** : HAMMACHE Lilian
> - **Date** : 15 avril 2026
> - **Type** : Audit de sécurité applicative
> - **Classification** : ==CONFIDENTIEL==

> [!danger] Synthèse critique **2 failles CRITIQUES** · **3 failles ÉLEVÉES** · **8 bugs fonctionnels** Correction immédiate requise avant tout déploiement ou maintien en production.

---

## 📑 Sommaire

- [[#1. Résumé exécutif]]
- [[#2. Vulnérabilités de sécurité]]
- [[#3. Anomalies fonctionnelles (Bugs)]]
- [[#4. Plan d'action recommandé]]

---

## 1. Résumé exécutif

Cet audit a permis d'identifier **8 vulnérabilités de sécurité** et **8 anomalies fonctionnelles** sur l'application analysée. Deux vulnérabilités sont classées **CRITIQUE** et requièrent une correction immédiate avant tout déploiement ou maintien en production.

### Points d'attention prioritaires

> [!danger] Critiques — action immédiate
> 
> - 🔴 **Credentials administrateur par défaut** actifs en production (`admin / admin123`) → risque de compromission immédiate.
> - 🔴 **Rôle utilisateur stocké dans le `localStorage`** et modifiable côté client → élévation de privilèges triviale.

> [!warning] Élevées — court terme
> 
> - 🟠 **Swagger UI exposé publiquement**, cartographiant toute la surface d'attaque de l'API.
> - 🟠 **Absence de révocation JWT** et throttling insuffisant sur le login.

Les bugs fonctionnels incluent plusieurs cas de **contrôle d'accès insuffisant** permettant à des utilisateurs de modifier ou supprimer des ressources ne leur appartenant pas.

---

## 2. Vulnérabilités de sécurité

### 2.1 Tableau de synthèse

|ID|Titre|Sévérité|Catégorie|
|---|---|---|---|
|[[#SEC-01]]|Swagger UI exposé en production|🟠 ÉLEVÉE|Exposition d'informations|
|[[#SEC-02]]|Credentials administrateur par défaut actifs|🔴 CRITIQUE|Authentification|
|[[#SEC-03]]|Données sensibles dans le `localStorage`|🔴 CRITIQUE|Gestion de session / Contrôle d'accès|
|[[#SEC-04]]|Absence de refresh token et de révocation JWT|🟠 ÉLEVÉE|Gestion de session|
|[[#SEC-05]]|Throttling trop permissif sur `/auth/login`|🟡 MOYENNE|Protection contre les attaques par force brute|
|[[#SEC-06]]|IDOR potentiel sur les ressources RH|🟠 ÉLEVÉE|Contrôle d'accès / Autorisation|
|[[#SEC-07]]|Upload de fichiers sans validation magic bytes|🟡 MOYENNE|Validation des entrées|
|[[#SEC-08]]|`LOG_LEVEL=debug` — fuite de données sensibles|🟢 FAIBLE|Journalisation|

### 2.2 Détail des vulnérabilités

---

#### SEC-01

##### Swagger UI exposé en production

> [!warning] Sévérité : 🟠 ÉLEVÉE — _Exposition d'informations_

**Description** Le Swagger UI est accessible librement en environnement de production, exposant toutes les routes, méthodes HTTP et paramètres de l'API.

**Impact** Un attaquant peut cartographier l'intégralité de la surface d'attaque de l'API sans authentification.

**Recommandation** Désactiver le Swagger UI en production. Si nécessaire, le protéger derrière une authentification ou le restreindre aux IP internes.

---

#### SEC-02

##### Credentials administrateur par défaut actifs

> [!danger] Sévérité : 🔴 CRITIQUE — _Authentification_

**Description** Le compte administrateur avec les identifiants `admin / admin123` est actif en environnement de production.

**Impact** ==Compromission immédiate et totale du système.== Accès administrateur sans effort pour tout attaquant.

**Recommandation** Désactiver immédiatement ce compte. Imposer une politique de mots de passe forts. Auditer tous les comptes par défaut.

---

#### SEC-03

##### Données sensibles dans le `localStorage` (rôle modifiable)

> [!danger] Sévérité : 🔴 CRITIQUE — _Gestion de session / Contrôle d'accès_

**Description** De nombreuses informations sensibles sont stockées en clair dans le `localStorage`, notamment le rôle utilisateur. La modification de ce rôle côté client permet d'accéder à des fonctionnalités non autorisées.

**Impact** ==Élévation de privilèges triviale.== Un utilisateur malveillant peut accéder à des données ou actions réservées aux administrateurs.

**Recommandation** Ne jamais stocker le rôle ou les permissions dans le `localStorage`. Les vérifications d'autorisation doivent être **exclusivement** effectuées côté serveur.

---

#### SEC-04

##### Absence de refresh token et de révocation JWT

> [!warning] Sévérité : 🟠 ÉLEVÉE — _Gestion de session_

**Description** Les JWT expirent après 8 heures sans mécanisme de révocation. Un token volé reste valide jusqu'à son expiration, même après déconnexion.

**Impact** Un token compromis permet un accès prolongé au système sans possibilité d'invalidation immédiate.

**Recommandation** Implémenter un mécanisme de **refresh token** et une **blacklist Redis** pour l'invalidation immédiate des tokens au logout.

---

#### SEC-05

##### Throttling trop permissif sur `/auth/login`

> [!caution] Sévérité : 🟡 MOYENNE — _Protection contre les attaques par force brute_

**Description** Le rate limiting autorise **20 requêtes/minute** et **100 req/15min** sur l'endpoint de login (`auth.controller.ts:18` + `app.module.ts`). Ce seuil permet des attaques par dictionnaire sur les mots de passe courants.

**Impact** Attaque par dictionnaire ou brute-force réalisable avant déclenchement du blocage.

**Recommandation** Réduire à **5 tentatives/minute** avec backoff exponentiel. Implémenter un blocage temporaire de compte après N échecs consécutifs.

---

#### SEC-06

##### IDOR potentiel sur les ressources RH

> [!warning] Sévérité : 🟠 ÉLEVÉE — _Contrôle d'accès / Autorisation_

**Description** Les controllers `leaves/`, `telework/` et `time-tracking/` acceptent des IDs sans vérifier que la ressource appartient à l'utilisateur courant. Le `RolesGuard` vérifie uniquement le rôle, **pas la propriété de la ressource**.

**Impact** Un contributeur peut accéder ou modifier les congés, télétravail et pointages d'autres utilisateurs via `GET`/`PATCH` avec un ID arbitraire.

**Recommandation** Vérifier systématiquement que `resource.userId === currentUser.id` dans chaque service. Ajouter des **tests E2E d'ownership cross-user**.

> 🔗 Voir aussi : [[#BUG-01]], [[#BUG-04]], [[#BUG-05]], [[#BUG-08]] (manifestations fonctionnelles)

---

#### SEC-07

##### Upload de fichiers sans validation des magic bytes

> [!caution] Sévérité : 🟡 MOYENNE — _Validation des entrées_

**Description** La dépendance `file-type@19` est installée mais son usage n'est pas confirmé dans les routes d'upload (`documents.service.ts`). Seule la limite de taille (2 MB) est vérifiée côté `@fastify/multipart`.

**Impact** Upload de fichiers malveillants (ex : `.php` renommé en `.jpg`) pouvant mener à une **exécution de code arbitraire**.

**Recommandation**

- Vérifier les magic bytes via `file-type` dans `documents.service.ts`.
- Whitelist stricte : **PDF, PNG, JPG, DOCX uniquement**.
- Stocker hors webroot ou dans un bucket isolé.

---

#### SEC-08

##### `LOG_LEVEL=debug` — fuite de données sensibles

> [!note] Sévérité : 🟢 FAIBLE — _Journalisation_

**Description** Fastify logger est activé sans redaction (`logger: true` dans `main.ts`). En mode debug, les corps de requêtes HTTP sont loggués, **incluant les mots de passe en clair** lors des appels à `/auth/login`.

**Impact** Si les logs sont centralisés (ELK, Grafana Loki), les credentials apparaissent en clair dans les systèmes de log.

**Recommandation** Utiliser l'option `redact` dans la config Fastify :

```ts
redact: ['body.password', 'req.headers.authorization']
```

---

## 3. Anomalies fonctionnelles (Bugs)

### 3.1 Tableau de synthèse

|ID|Titre|Priorité|Module|Statut|
|---|---|---|---|---|
|[[#BUG-01]]|Modification des jours TTV d'autres utilisateurs|🔴 HAUTE|Planning / Télétravail|🟡 Ouvert|
|[[#BUG-02]]|Formulaire de création de tâche — blink sur les assignés|🟡 MOYENNE|Tâches|🟡 Ouvert|
|[[#BUG-03]]|Planning des ressources — aucun service affiché par défaut|🟡 MOYENNE|Planning|🟡 Ouvert|
|[[#BUG-04]]|Modification/suppression d'un projet non possédé (membre)|🔴 HAUTE|Projets|🟡 Ouvert|
|[[#BUG-05]]|Modification/suppression d'événements arbitraires|🔴 HAUTE|Événements|🟡 Ouvert|
|[[#BUG-06]]|Champ « Membre depuis » affiche une date invalide|🟢 FAIBLE|Profil|🟡 Ouvert|
|[[#BUG-07]]|Compte affiché comme inactif à tort|🟡 MOYENNE|Profil|🟡 Ouvert|
|[[#BUG-08]]|Modification/suppression de tout projet (sans restriction)|🔴 HAUTE|Projets|🟡 Ouvert|

### 3.2 Détail des anomalies

---

#### BUG-01

##### Modification des jours TTV d'autres utilisateurs

> [!warning] Priorité : 🔴 HAUTE — _Planning / Télétravail_ — Statut : 🟡 Ouvert

Il est possible de modifier les jours de télétravail de n'importe quel utilisateur depuis la page planning et la page télétravail.

> 🔗 Lié à : [[#SEC-06]]

---

#### BUG-02

##### Formulaire de création de tâche — blink sur les assignés

> [!caution] Priorité : 🟡 MOYENNE — _Tâches_ — Statut : 🟡 Ouvert

Le formulaire de création de tâche présente un clignotement (blink) causé par les assignés non résolus.

---

#### BUG-03

##### Planning des ressources — aucun service affiché par défaut

> [!caution] Priorité : 🟡 MOYENNE — _Planning_ — Statut : 🟡 Ouvert

La page planning des ressources n'affiche aucun service au chargement. La sélection manuelle de tous les services les affiche correctement.

---

#### BUG-04

##### Modification/suppression d'un projet non possédé (membre)

> [!warning] Priorité : 🔴 HAUTE — _Projets_ — Statut : 🟡 Ouvert

Un simple membre peut modifier et supprimer un projet qui ne lui appartient pas.

> 🔗 Lié à : [[#SEC-06]], [[#BUG-08]]

---

#### BUG-05

##### Modification/suppression d'événements arbitraires

> [!warning] Priorité : 🔴 HAUTE — _Événements_ — Statut : 🟡 Ouvert

Tout utilisateur peut modifier ou supprimer n'importe quel événement, quelle que soit la propriété.

> 🔗 Lié à : [[#SEC-06]]

---

#### BUG-06

##### Champ « Membre depuis » affiche une date invalide

> [!note] Priorité : 🟢 FAIBLE — _Profil_ — Statut : 🟡 Ouvert

La section _Membre depuis_ du profil utilisateur affiche `Invalid date` au lieu de la date d'inscription.

---

#### BUG-07

##### Compte affiché comme inactif à tort

> [!caution] Priorité : 🟡 MOYENNE — _Profil_ — Statut : 🟡 Ouvert

Le compte connecté est affiché comme inactif alors qu'il est opérationnel.

---

#### BUG-08

##### Modification/suppression de tout projet (sans restriction)

> [!warning] Priorité : 🔴 HAUTE — _Projets_ — Statut : 🟡 Ouvert

Il est possible de modifier ou supprimer n'importe quel projet, sans vérification de propriété ni de rôle.

> 🔗 Lié à : [[#SEC-06]], [[#BUG-04]]

---

## 4. Plan d'action recommandé

Les corrections doivent être priorisées selon la criticité suivante :

### 🚨 IMMÉDIAT — Avant mise en production

- [ ] **[[#SEC-02]]** — Désactiver le compte admin par défaut
- [ ] **[[#SEC-03]]** — Déplacer la gestion des rôles côté serveur uniquement

### ⚠️ COURT TERME — Sous 2 semaines

- [ ] **[[#SEC-01]]** — Désactiver Swagger UI en production
- [ ] **[[#SEC-04]]** — Implémenter révocation JWT (refresh token + blacklist Redis)
- [ ] **[[#SEC-06]]** — Corriger les vulnérabilités IDOR (vérification ownership)
- [ ] **[[#BUG-01]]** — Corriger l'ownership sur les jours de télétravail
- [ ] **[[#BUG-04]]** — Restreindre modification/suppression projet aux propriétaires
- [ ] **[[#BUG-05]]** — Restreindre modification/suppression événements
- [ ] **[[#BUG-08]]** — Ajouter contrôle de propriété/rôle sur tous les projets

### 📋 MOYEN TERME — Sous 1 mois

- [ ] **[[#SEC-05]]** — Renforcer le throttling sur `/auth/login`
- [ ] **[[#SEC-07]]** — Validation magic bytes sur les uploads
- [ ] **[[#SEC-08]]** — Activer la redaction des logs Fastify

### 🔧 BACKLOG — Bugs fonctionnels résiduels

- [ ] **[[#BUG-02]]** — Corriger le blink sur les assignés
- [ ] **[[#BUG-03]]** — Affichage par défaut des services dans le planning
- [ ] **[[#BUG-06]]** — Corriger le format de date « Membre depuis »
- [ ] **[[#BUG-07]]** — Corriger l'état de compte affiché

---

> [!quote] Document confidentiel _HAMMACHE Lilian — Rapport d'audit de sécurité — 15 avril 2026_