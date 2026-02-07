# P0 - Charte de Cadrage (VERSION 2.0)

## OpsTracker — Application Générique de Pilotage d'Opérations IT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **CHARTE DE CADRAGE** Version : **2.0** (mise à jour post-réunion utilisateurs) Niveau de confiance : **95%**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## Historique des Modifications

| Version | Date         | Modification                                                                                                                                                          |
| ------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | Janvier 2025 | Version initiale                                                                                                                                                      |
| 2.0     | Janvier 2025 | Intégration des besoins P1.3bis (réunion utilisateurs) : nouveaux stakeholders, modules réservation/créneaux/notifications, risques, clarification modèle déploiement |

---

## 1. Contexte & Déclencheur

**Pitch** : Développer une application générique et modulaire de pilotage d'opérations IT (migrations, déploiements, renouvellements matériels) à destination des organisations. L'application doit permettre de planifier, suivre et piloter des opérations de masse sur des cibles variées (utilisateurs, postes, serveurs, devices) avec des champs, statuts, checklists et dashboards entièrement configurables. **Elle inclut également une interface de réservation de créneaux pour les agents et managers métier impactés par les opérations.**

**Déclencheur** : Une application spécifique a été développée pour la migration POC Pilote. Cette app, bien que fonctionnelle et appréciée, n'est pas réutilisable en l'état. Plusieurs organisations ont exprimé des besoins similaires de pilotage d'opérations IT. **Une réunion de recueil de besoins (janvier 2025) a permis d'identifier des besoins complémentaires majeurs : interface de réservation type "Doctolib", gestion de la capacité IT, notifications avec intégration agenda.**

**Existant valorisable** :

- L'application POC Pilote constitue un POC fonctionnel validant les concepts clés (segmentation, planification, checklists, dashboard, base documentaire).
- 🆕 **Application RDV Organisation B** : La Organisation B dispose d'une application de prise de rendez-vous fonctionnant avec la carte agent. Possibilité d'export/intégration à évaluer.

---

## 2. Gouvernance

- **Sponsor** : DSI Organisation principale (porteur du projet)
- **Décideur** : DSI Organisation principale
- **Contributeurs** : organisations clientes (37, 75, 77, 78, 93), techniciens informatiques (utilisateurs finaux), **managers métier et agents impactés (bénéficiaires)** 🆕

---

## 3. Stakeholders

| Partie prenante                      | Rôle                                                               | Intérêt | Influence |
| ------------------------------------ | ------------------------------------------------------------------ | ------- | --------- |
| DSI Organisation principale          | Sponsor / Développeur / Éditeur                                    | Haut    | Haut      |
| Organisations clientes               | Utilisateurs demandeurs                                            | Haut    | Moyen     |
| Techniciens IT (Ops)                 | Utilisateurs finaux (exécutent les interventions)                  | Haut    | Bas       |
| 🆕 **Agents impactés**               | Bénéficiaires des opérations (end-users métier)                    | Moyen   | Bas       |
| 🆕 **Managers métier**               | Positionnent leurs agents, préservent continuité service           | Moyen   | Moyen     |
| 🆕 **Coordinateurs/Délégués**        | Positionnent des agents par délégation (sans lien hiérarchique)    | Faible  | Bas       |
| Agents de direction                  | Consultation dashboard                                             | Moyen   | Bas       |
| DSI nationale / Plateforme nationale | Potentiel (mutualisation via Portail de déploiement)               | Moyen   | Moyen     |
| 🆕 **SIRH / Autres directions**      | Potentiels utilisateurs (campagnes non-IT : photos ID Prime, etc.) | Faible  | Bas       |

---

## 4. Périmètre d'investigation

### IN (Ce que nous allons faire)

**Module cœur — Planification d'opérations :**

- Segmentation paramétrable (organisation, site, service, etc.)
- Cibles configurables (users, postes, serveurs, devices)
- Champs custom paramétrables (nom, prénom, numéro agent, adresse IP, MAC, etc.)
- Gestion des rendez-vous (date initiale, date réelle, heure, lieu, opérateur assigné)
- Statuts personnalisables (À planifier, Planifié, Réalisé, Reporté, À remédier, etc.)
- Import CSV avec mapping sur les champs configurés
- Création/modification manuelle des entrées
- 🆕 **Mode d'inscription configurable par campagne** (Agent / Manager / Liste / Mixte)
- 🆕 **Propriété et visibilité des campagnes** (cloisonnement DSI/SIRH possible)

**Module Dashboard :**

- Vision macro par organisation et par segment
- Métriques configurables (taux de réalisation, compteurs par statut)
- Widgets modulables et personnalisables par utilisateur
- Graphiques de suivi temporel (histogrammes par jour/semaine/mois)
- 🆕 **Dashboard global multi-campagnes** (vue d'ensemble de toutes les campagnes en cours)

**Module Checklists :**

- Checklists modulables par opération, segmentées en phases
- Modification à chaud avec protection des checklists "in progress"
- Liens vers ressources documentaires intégrés aux items
- 🆕 **Ajouts séquentiels uniquement** (items ajoutés en fin de liste pour préserver l'existant)

**Module Prérequis :**

- Suivi des prérequis par entité (organisation, site, service)
- Statuts (À faire, En cours, Fait)
- Rang chronologique configurable

**Module Base documentaire :**

- Upload de ressources (scripts, procédures, modes opératoires)
- Téléchargement direct depuis l'app
- Liens depuis les checklists (ouverture en modal/popup)

**Module Gestion utilisateurs :**

- Rôles : Admin / Gestionnaire / Technicien
- Admins : création opérations, gestion users, gestion documentaire
- Gestionnaires : suivi opérations, modification statuts, checklists
- Techniciens : modification de leurs propres interventions
- 🆕 **Rôle Coordinateur** : positionner des agents sans lien hiérarchique (périmètre délégué)
- 🆕 **Habilitations par campagne** : droits granulaires par utilisateur/groupe

**🆕 Module Interface Réservation (End-Users) :**

- Interface "type Doctolib" pour agents et managers métier
- Agents : voir créneaux disponibles, se positionner, modifier/annuler
- Managers : voir liste équipe, positionner agents, gérer absences/remplacements
- Coordinateurs : positionner agents sur périmètre délégué
- Authentification AD (V1), carte agent (V2)
- Unicité : un agent = un seul créneau par campagne
- Verrouillage des créneaux à J-X (paramétrable, défaut J-2)

**🆕 Module Gestion des Créneaux & Capacité :**

- Création de créneaux (manuelle ou génération automatique sur plage)
- Définition capacité IT (nombre de ressources/techniciens disponibles)
- Abaques : durée intervention configurable par type d'opération
- Calcul automatique du nombre de créneaux (ressources × temps / durée)
- Association créneaux ↔ segments/sites (filtrage automatique)
- Taux de remplissage en temps réel

**🆕 Module Notifications & Agenda :**

- Email d'invitation aux agents ou managers (selon mode inscription)
- Email de confirmation avec fichier ICS (intégration agenda Outlook)
- Email de rappel automatique (J-2 paramétrable)
- Email de modification (ancien + nouveau créneau, nouvel ICS)
- Email d'annulation (lien vers repositionnement)

**Exigences transverses :**

- Interface attractive, professionnelle, ergonomique
- Développement en Symfony (contrainte technique imposée)
- Accessibilité RGAA 4.1
- 🆕 **UX "Doctolib"** pour les end-users métier : 3 clics max, zéro formation

---

### OUT (Ce que nous ne ferons pas)

- Gestion de parc informatique (inventaire) → délégué à GLPI existant
- Ticketing / Helpdesk
- Multi-instance / Multi-tenancy avancé (hors scope V1, instance centrale simple)
- 🆕 **Authentification carte agent native** (V1 : authentification AD uniquement, V2 : carte agent)
- Intégration SSO/SAML (V2)
- Application mobile native
- 🆕 **Personnalisation avancée des messages de notification** (V2)

---

### Zones grises (Points d'attention) — ✅ CLARIFIÉES

| Point                              | Décision validée                                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intégration GLPI                   | ❌ Hors scope V1 — Import CSV suffit                                                                                                                           |
| Authentification                   | V1 : Comptes locaux + AD / V2 : + Carte agent + SSO national                                                                                                   |
| Hébergement                        | Serveur local Organisation principale (self-hosted)                                                                                                            |
| Homologation sécurité              | Faible (self-hosted, pas d'exposition externe, stack à jour)                                                                                                   |
| Bundle Symfony interne             | Normalement disponible (à confirmer lors du setup)                                                                                                             |
| Priorisation V1                    | 100% des features décrites + modules réservation/créneaux/notifications                                                                                        |
| 🆕 **Modèle de déploiement**       | **Portail de déploiement** (pas Plateforme nationale labellisé). Organisation principale = éditeur, création d'instances pour autres organisations demandeuses |
| 🆕 **Mode inscription par défaut** | À valider avec sponsor (Agent / Manager)                                                                                                                       |
| 🆕 **Auth carte agent V1**         | AD simple en V1, carte agent évaluée pour V2 (faisabilité technique à confirmer avec Organisation B)                                                           |
| 🆕 **Extension non-IT**            | L'outil peut servir à d'autres directions (RH, SIRH) pour des campagnes non-IT (photos ID Prime, etc.) — cloisonnement par propriétaire                        |

---

## 5. Contraintes

| Type          | Contrainte                                                                   | Impact                                                                      |
| ------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Budget        | Non défini (hors sujet selon sponsor)                                        | Faible — Mode vibe coding avec Claude Code/Codex, pas de prestation externe |
| Délai         | Non défini (hors sujet selon sponsor)                                        | Faible — Pas de deadline imposée. MVP visé : 12-14 semaines                 |
| Techno        | **Symfony obligatoire** (framework organisation parente)                     | Fort — Architecture et choix de bundles contraints par l'écosystème Symfony |
| Techno        | Bundle interne à récupérer (normalement disponible)                          | Moyen — À confirmer lors du setup technique                                 |
| Infra         | **Hébergement self-hosted Organisation principale**                          | Faible — Contrôle total, pas de contraintes cloud/HDS                       |
| 🆕 Infra      | **Serveur SMTP** pour notifications email                                    | Moyen — Nécessite accès SMTP organisation ou relais mail                    |
| 🆕 Format     | **Fichiers ICS** compatibles Outlook                                         | Faible — Standard iCalendar, bibliothèques disponibles                      |
| Orga          | Développement solo (DSI + IA)                                                | Moyen — Vélocité dépendante d'une seule personne, pas de bus factor         |
| 🆕 Orga       | **Divergences pratiques entre organisations** (inscription agent vs manager) | Moyen — Configurabilité maximale requise (4 modes d'inscription)            |
| Réglementaire | RGAA 4.1 (accessibilité secteur public)                                      | Fort — Obligation légale, sanctions financières possibles                   |
| Sécurité      | Homologation légère (self-hosted, pas d'exposition externe)                  | Faible — Stack à jour suffit                                                |

---

## 6. Existant & Historique

### État actuel

- **Application POC Pilote (POC Pilote)** : Application spécifique fonctionnelle pour la migration POC Pilote. A validé les concepts clés mais n'est pas générique/réutilisable.
- 🆕 **Application RDV Organisation B** : La Organisation B dispose d'une application de prise de rendez-vous fonctionnant avec la carte agent. Brique technique potentiellement réutilisable ou source d'inspiration pour le module réservation.
- 🆕 **Pratiques actuelles de recensement** : Les organisations utilisent des fichiers Excel partagés pour recenser les disponibilités des agents. Processus fastidieux, source d'erreurs et de conflits de versions.

### Leçons du passé

- ✅ Les modules planification, checklists, dashboard et base documentaire ont été très appréciés
- ✅ La cohérence via une source unique de vérité (module planification = référentiel maître) a évité les problèmes de naming et d'homogénéité
- ⚠️ La modification des checklists écrasait tout le suivi back → **Problème corrigé** : ajouts séquentiels uniquement, protection des checklists "in progress"
- ⚠️ Application non générique → **Problème à corriger** : tout doit être paramétrable
- 🆕 ⚠️ Le recensement des disponibilités par Excel était fastidieux et source d'erreurs → **Solution identifiée** : interface self-service type "Doctolib"
- 🆕 ⚠️ Divergence organisationnelle entre organisations (agents autonomes vs managers qui positionnent) → **Solution identifiée** : mode d'inscription configurable par campagne

---

## 7. Risques initiaux identifiés

| #     | Risque                                                                                                                                                     | Probabilité | Impact | Mitigation                                                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Complexité de la configurabilité** : Rendre TOUT paramétrable (champs, statuts, segments, checklists) augmente significativement la complexité technique | Haute       | Fort   | Architecture modulaire dès le départ, patterns JSONB/EAV pour champs dynamiques, Symfony Workflow pour statuts                      |
| 2     | **Dérive du périmètre** : Liste de features très ambitieuse pour un développement solo                                                                     | Moyenne     | Fort   | Priorisation MoSCoW, livraison incrémentale, validation par les organisations pilotes                                               |
| 3     | **Dépendance au bundle AM** : Si le bundle n'est pas récupérable ou incompatible                                                                           | Moyenne     | Moyen  | Prévoir architecture standalone compatible avec intégration ultérieure                                                              |
| 4     | **Accessibilité RGAA** : Intégration tardive = refonte coûteuse                                                                                            | Haute       | Fort   | Intégrer les critères RGAA dès la conception, utiliser composants accessibles                                                       |
| 5     | **Adoption multi-organisations** : Hétérogénéité des pratiques entre organisations                                                                         | Moyenne     | Moyen  | Configuration de base partagée + personnalisations encadrées, gouvernance claire                                                    |
| 6     | **Bus factor = 1** : Développeur unique                                                                                                                    | Moyenne     | Fort   | Documentation exhaustive, code propre, tests automatisés                                                                            |
| 7     | **Performance sur volumes** : Opérations de masse (100 000 lignes), champs dynamiques JSONB                                                                | Moyenne     | Moyen  | Indexation GIN PostgreSQL, imports asynchrones (Symfony Messenger)                                                                  |
| 🆕 8  | **Divergence organisationnelle** : Chaque organisation veut son mode de fonctionnement (agents autonomes vs managers qui positionnent)                     | Haute       | Moyen  | Configurabilité maximale par campagne (4 modes d'inscription : Agent / Manager / Liste / Mixte)                                     |
| 🆕 9  | **Récupération nationale** : nationale pourrait bloquer ou reprendre l'initiative locale                                                                   | Moyenne     | Fort   | Avancer vite, créer de la valeur, positionner sur Portail de déploiement (pas Plateforme nationale labellisé), rester sous le radar |
| 🆕 10 | **Adoption end-users** : Interface trop complexe pour les agents métier (usage ponctuel, zéro formation)                                                   | Faible      | Fort   | UX "Doctolib" (3 clics max), interface ultra-simplifiée, authentification transparente (AD puis carte agent V2)                     |
| 🆕 11 | **Capacité serveur SMTP** : Notifications en masse (invitations, rappels)                                                                                  | Faible      | Moyen  | Envoi asynchrone (Symfony Messenger), rate limiting, file d'attente                                                                 |

---

## 8. Critères de succès du cadrage

- [x] Périmètre fonctionnel documenté (IN/OUT/Zones grises)
- [x] Contraintes techniques identifiées (Symfony obligatoire)
- [x] Liste des stakeholders établie
- [x] Risques initiaux listés avec mitigations
- [x] Zones grises clarifiées avec le sponsor
- [x] Hébergement et sécurité définis
- [x] 🆕 Nouveaux personas métier identifiés (Agent, Manager, Coordinateur)
- [x] 🆕 Modules complémentaires spécifiés (Réservation, Créneaux, Notifications)
- [x] 🆕 Modèle de déploiement clarifié (Portail de déploiement)
- [x] **GO validé pour la phase Discovery**

---

## Points validés avec le sponsor ✅

| #    | Question               | Réponse validée                                              |
| ---- | ---------------------- | ------------------------------------------------------------ |
| 1    | Intégration GLPI       | Import CSV suffit en V1                                      |
| 2    | Authentification       | V1 : Comptes locaux + AD / V2 : + Carte agent + SSO national |
| 3    | Hébergement cible      | Serveur local Organisation principale                        |
| 4    | Bundle Symfony interne | Normalement disponible                                       |
| 5    | Homologation           | Légère (self-hosted, pas d'exposition externe, stack à jour) |
| 6    | Priorisation V1        | 100% des features de l'input initial + modules P1.3bis       |
| 🆕 7 | Modèle déploiement     | Portail de déploiement (Organisation principale = éditeur)   |
| 🆕 8 | Extension non-IT       | Autorisée (campagnes RH, SIRH) avec cloisonnement            |

### Points en attente de validation sponsor

| #    | Question                     | Options                    | Impact                 |
| ---- | ---------------------------- | -------------------------- | ---------------------- |
| 🆕 A | Mode inscription par défaut  | Agent / Manager            | Configuration initiale |
| 🆕 B | Délai verrouillage créneaux  | J-2 (défaut) / Autre       | UX end-users           |
| 🆕 C | Délai rappel automatique     | J-2 (défaut) / Autre       | Notifications          |
| 🆕 D | ICS obligatoire ou optionnel | Obligatoire / Configurable | Complexité             |

---

## Synthèse des évolutions v1.0 → v2.0

| Élément                     | Version 1.0 | Version 2.0 | Delta |
| --------------------------- | ----------- | ----------- | ----- |
| **Stakeholders**            | 5           | 9           | +4    |
| **Modules IN**              | 6           | 9           | +3    |
| **Contraintes**             | 7           | 10          | +3    |
| **Risques**                 | 7           | 11          | +4    |
| **Zones grises clarifiées** | 6           | 10          | +4    |

### Nouveaux éléments majeurs

| Catégorie          | Ajout                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| **Stakeholders**   | Agents impactés, Managers métier, Coordinateurs, SIRH/Autres directions              |
| **Modules**        | Interface Réservation, Gestion Créneaux & Capacité, Notifications & Agenda           |
| **Contraintes**    | Serveur SMTP, Fichiers ICS, Divergences organisationnelles                           |
| **Risques**        | Divergence orga, Récupération nationale, Adoption end-users, Capacité SMTP           |
| **Clarifications** | Modèle déploiement (Portail de déploiement), Auth carte agent (V2), Extension non-IT |

---

**Niveau de confiance : 95%**

_Les 5% d'incertitude portent sur : disponibilité effective du bundle Symfony interne, faisabilité technique auth carte agent (à confirmer avec Organisation B), points sponsor en attente de validation._

---

**Statut** : 🟢 **GO DISCOVERY (P1) — CONFIRMÉ**

_Document mis à jour suite à la réunion de recueil de besoins utilisateurs (P1.3bis)._ _Prochaine étape : Mise à jour P4.2 (Architecture) et P4.3 (Validation) avec les nouveaux modules._
