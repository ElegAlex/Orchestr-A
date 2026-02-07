> **DerniÃ¨re mise Ã  jour** : 2026-01-22 (Session #15 - Sprint 14 Complete - TAG v1.0.0)
> **Source** : P4.1 - Backlog & Requirements Fonctionnels
> **Total** : 85 User Stories | 12 EPICs

---

## ðŸ“Š Vue d'Ensemble

| Phase   | Sprints | Statut        | US  | Focus                                    |
| ------- | ------- | ------------- | --- | ---------------------------------------- |
| **MVP** | 0-8     | âœ… TerminÃ© | 47  | Pilote 50 cibles Organisation principale |
| **V1**  | 9-14    | âœ… TerminÃ© | 29  | DÃ©ploiement 4 organisations            |
| **V2**  | 15+     | â³ Backlog    | 9   | RÃ©fÃ©rencement SILL                   |

---

## ðŸ”´ PHASE MVP â€” Sprints 0 Ã  8

### Sprint 0 â€” Setup & Infrastructure âœ…

| ID    | TÃ¢che                                   | Statut | DÃ©pendance |
| ----- | ---------------------------------------- | ------ | ------------ |
| T-001 | CrÃ©er projet Symfony 7.4 (`--webapp`)  | âœ…    | -            |
| T-002 | Docker : PHP 8.3 + PostgreSQL 17 + Redis | âœ…    | T-001        |
| T-003 | Configurer AssetMapper + Tailwind CDN    | âœ…    | T-001        |
| T-004 | Installer EasyAdmin 4.x                  | âœ…    | T-001        |
| T-005 | Installer Symfony Workflow + UX Turbo    | âœ…    | T-001        |
| T-006 | Configurer PHPUnit + premier test        | âœ…    | T-001        |
| T-007 | CrÃ©er structure .claude/ (pilotage)    | âœ…    | -            |

---

### Sprint 1 â€” Authentification & Utilisateurs (EPIC-01) âœ…

| ID    | US     | Titre                                                   | Statut | RG             | PrioritÃ© |
| ----- | ------ | ------------------------------------------------------- | ------ | -------------- | ---------- |
| T-101 | -      | EntitÃ© `Utilisateur` (email, password, rÃ´les, actif) | âœ…    | RG-002, RG-003 | MVP        |
| T-102 | US-101 | Se connecter Ã  l'application                           | âœ…    | RG-001, RG-006 | ðŸ”´ MVP   |
| T-103 | US-102 | Se dÃ©connecter                                        | âœ…    | -              | ðŸ”´ MVP   |
| T-104 | US-103 | CrÃ©er un compte utilisateur (Admin)                   | âœ…    | RG-002, RG-003 | ðŸ”´ MVP   |
| T-105 | -      | Verrouillage compte aprÃ¨s 5 Ã©checs                   | âœ…    | RG-006         | MVP        |
| T-106 | -      | CRUD Utilisateurs EasyAdmin                             | âœ…    | -              | MVP        |
| T-107 | -      | Tests UtilisateurService                                | âœ…    | -              | MVP        |

---

### Sprint 2 â€” ModÃ¨le de DonnÃ©es Core âœ…

| ID    | TÃ¢che                                                         | Statut | EntitÃ©          | RG             |
| ----- | -------------------------------------------------------------- | ------ | ----------------- | -------------- |
| T-201 | EntitÃ© `Campagne` (nom, dates, description, statut)          | âœ…    | Campagne          | RG-010, RG-011 |
| T-202 | EntitÃ© `TypeOperation` (nom, icÃ´ne, couleur)                | âœ…    | TypeOperation     | RG-060         |
| T-203 | EntitÃ© `Segment` (nom, couleur, campagne)                    | âœ…    | Segment           | -              |
| T-204 | EntitÃ© `Operation` (matricule, nom, statut, donnÃ©es JSONB) | âœ…    | Operation         | RG-014, RG-015 |
| T-205 | EntitÃ© `ChecklistTemplate` (nom, version, Ã©tapes JSON)     | âœ…    | ChecklistTemplate | RG-030         |
| T-206 | EntitÃ© `ChecklistInstance` (snapshot, progression)           | âœ…    | ChecklistInstance | RG-031         |
| T-207 | Relations + Migrations                                         | âœ…    | -                 | -              |
| T-208 | Workflow Campagne (5 statuts)                                  | âœ…    | -                 | RG-010         |
| T-209 | Workflow OpÃ©ration (6 statuts)                               | âœ…    | -                 | RG-017         |

---

### Sprint 3 â€” Campagnes CRUD (EPIC-02 MVP) âœ…

| ID    | US     | Titre                                                 | Statut | RG             | PrioritÃ© |
| ----- | ------ | ----------------------------------------------------- | ------ | -------------- | ---------- |
| T-301 | US-201 | Voir la liste des campagnes (groupÃ©e par statut)    | âœ…    | RG-010         | ðŸ”´ MVP   |
| T-302 | US-202 | CrÃ©er campagne â€” Ã‰tape 1/4 (Infos gÃ©nÃ©rales) | âœ…    | RG-011         | ðŸ”´ MVP   |
| T-303 | US-205 | CrÃ©er campagne â€” Ã‰tape 4/4 (Workflow & Template) | âœ…    | RG-014         | ðŸ”´ MVP   |
| T-304 | US-206 | Ajouter une opÃ©ration manuellement                  | âœ…    | RG-014, RG-015 | ðŸ”´ MVP   |
| T-305 | US-801 | CrÃ©er un type d'opÃ©ration (config EasyAdmin)      | âœ…    | RG-060         | ðŸ”´ MVP   |
| T-306 | -      | CRUD Campagne EasyAdmin                               | âœ…    | -              | MVP        |
| T-307 | -      | Tests CampagneService                                 | âœ…    | -              | MVP        |

---

### Sprint 4 â€” OpÃ©rations & Segments (EPIC-03 + EPIC-09 MVP) âœ…

| ID    | US     | Titre                                         | Statut | RG             | PrioritÃ© |
| ----- | ------ | --------------------------------------------- | ------ | -------------- | ---------- |
| T-401 | US-301 | Voir la liste des opÃ©rations (vue tableau)  | âœ…    | RG-080         | ðŸ”´ MVP   |
| T-402 | US-303 | Filtrer les opÃ©rations                      | âœ…    | -              | ðŸ”´ MVP   |
| T-403 | US-304 | Modifier le statut d'une opÃ©ration (inline) | âœ…    | RG-017, RG-080 | ðŸ”´ MVP   |
| T-404 | US-306 | Assigner un technicien Ã  une opÃ©ration     | âœ…    | RG-018         | ðŸ”´ MVP   |
| T-405 | US-905 | CrÃ©er/modifier des segments                 | âœ…    | -              | ðŸ”´ MVP   |
| T-406 | US-906 | Voir la progression par segment (dÃ©tail)    | âœ…    | -              | ðŸ”´ MVP   |
| T-407 | -      | Tests OperationService                        | âœ…    | -              | MVP        |

---

### Sprint 5 â€” Interface Terrain Karim (EPIC-04) âœ…

| ID    | US     | Titre                                      | Statut | RG                     | PrioritÃ© |
| ----- | ------ | ------------------------------------------ | ------ | ---------------------- | ---------- |
| T-501 | -      | Layout mobile responsive (Twig base)       | âœ…    | RG-082                 | MVP        |
| T-502 | US-401 | Voir "Mes interventions" (vue filtrÃ©e)   | âœ…    | RG-020, RG-080, RG-082 | ðŸ”´ MVP   |
| T-503 | US-402 | Ouvrir le dÃ©tail d'une intervention      | âœ…    | -                      | ðŸ”´ MVP   |
| T-504 | US-403 | Changer le statut en 1 clic (56px buttons) | âœ…    | RG-017, RG-021, RG-082 | ðŸ”´ MVP   |
| T-505 | US-404 | Retour automatique aprÃ¨s action           | âœ…    | -                      | ðŸ”´ MVP   |
| T-506 | -      | Tests TerrainController (OperationVoter)   | âœ…    | -                      | MVP        |

---

### Sprint 6 â€” Checklists (EPIC-05 MVP) âœ…

| ID    | US     | Titre                                     | Statut | RG     | PrioritÃ© |
| ----- | ------ | ----------------------------------------- | ------ | ------ | ---------- |
| T-601 | US-503 | CrÃ©er un template de checklist (Sophie) | âœ…    | RG-030 | ðŸ”´ MVP   |
| T-602 | -      | CRUD Templates EasyAdmin                  | âœ…    | -      | MVP        |
| T-603 | US-501 | Cocher une Ã©tape de checklist (48x48px) | âœ…    | RG-082 | ðŸ”´ MVP   |
| T-604 | US-502 | Voir la progression de la checklist       | âœ…    | -      | ðŸ”´ MVP   |
| T-605 | -      | Turbo Frames pour update sans reload      | âœ…    | -      | MVP        |
| T-606 | -      | Tests ChecklistService                    | âœ…    | -      | MVP        |

---

### Sprint 7 â€” Dashboard Sophie (EPIC-06 MVP) âœ…

| ID    | US     | Titre                                    | Statut | RG                     | PrioritÃ© |
| ----- | ------ | ---------------------------------------- | ------ | ---------------------- | ---------- |
| T-701 | US-601 | Voir le dashboard temps rÃ©el           | âœ…    | RG-040, RG-080, RG-081 | ðŸ”´ MVP   |
| T-702 | US-602 | Voir la progression par segment          | âœ…    | -                      | ðŸ”´ MVP   |
| T-703 | US-607 | Voir le dashboard global multi-campagnes | âœ…    | -                      | ðŸ”´ MVP   |
| T-704 | -      | Turbo Streams pour temps rÃ©el          | âœ…    | RG-040                 | MVP        |
| T-705 | -      | Widgets KPI (compteurs statuts)          | âœ…    | -                      | MVP        |
| T-706 | -      | Tests DashboardService                   | âœ…    | -                      | MVP        |

---

### Sprint 8 â€” Tests & Polish MVP âœ…

| ID    | TÃ¢che                             | Statut | Cible                   |
| ----- | ---------------------------------- | ------ | ----------------------- |
| T-801 | Fixtures de dÃ©mo (Faker)         | âœ…    | 3 campagnes, 150 ops    |
| T-802 | Audit accessibilitÃ© RGAA         | âœ…    | RG-080 Ã  RG-085        |
| T-803 | Corrections accessibilitÃ©        | âœ…    | Score 100%              |
| T-804 | Tests E2E parcours critique        | âœ…    | 14 tests, 21 assertions |
| T-805 | Test de charge basique             | âœ…    | 10 users, documentation |
| T-806 | Documentation dÃ©ploiement Docker | âœ…    | README.md               |
| T-807 | **ðŸ TAG v0.1.0-mvp**              | âœ…    | -                       |

---

## ðŸŸ¡ PHASE V1 â€” Sprints 9 Ã  14

### Sprint 9 â€” Import CSV & Export (EPIC-02 + EPIC-03 V1) âœ…

| ID    | US     | Titre                                              | Statut | RG             | PrioritÃ© |
| ----- | ------ | -------------------------------------------------- | ------ | -------------- | ---------- |
| T-901 | US-203 | CrÃ©er campagne â€” Ã‰tape 2/4 (Upload CSV)       | âœ…    | RG-012, RG-013 | ðŸŸ¡ V1    |
| T-902 | US-204 | CrÃ©er campagne â€” Ã‰tape 3/4 (Mapping colonnes) | âœ…    | RG-012, RG-014 | ðŸŸ¡ V1    |
| T-903 | -      | Service ImportCsv (League\Csv)                     | âœ…    | RG-012         | V1         |
| T-904 | -      | DÃ©tection encodage + sÃ©parateur auto           | âœ…    | RG-012         | V1         |
| T-905 | -      | Gestion erreurs import (log)                       | âœ…    | RG-092         | V1         |
| T-906 | US-307 | Exporter les opÃ©rations (CSV)                    | âœ…    | -              | ðŸŸ¡ V1    |
| T-907 | US-308 | Rechercher une opÃ©ration (globale)               | âœ…    | -              | ðŸŸ¡ V1    |
| T-908 | -      | Tests ImportService                                | âœ…    | -              | V1         |

---

### Sprint 10 â€” Gestion Utilisateurs V1 + Documents (EPIC-01 + EPIC-07) âœ…

| ID     | US     | Titre                               | Statut | RG     | PrioritÃ© |
| ------ | ------ | ----------------------------------- | ------ | ------ | ---------- |
| T-1001 | US-104 | Modifier un utilisateur (Admin)     | âœ…    | RG-004 | ðŸŸ¡ V1    |
| T-1002 | US-105 | DÃ©sactiver un utilisateur (Admin) | âœ…    | RG-005 | ðŸŸ¡ V1    |
| T-1003 | US-106 | Voir les statistiques utilisateur   | âœ…    | -      | ðŸŸ¡ V1    |
| T-1004 | US-107 | Modifier son propre mot de passe    | âœ…    | RG-001 | ðŸŸ¡ V1    |
| T-1005 | US-701 | Voir la liste des documents         | âœ…    | -      | ðŸŸ¡ V1    |
| T-1006 | US-702 | Uploader un document (50Mo max)     | âœ…    | RG-050 | ðŸŸ¡ V1    |
| T-1007 | US-703 | Lier un document Ã  une campagne    | âœ…    | RG-051 | ðŸŸ¡ V1    |
| T-1008 | US-704 | Supprimer un document               | âœ…    | -      | ðŸŸ¡ V1    |

---

### Sprint 11 â€” Campagnes & Checklists V1 (EPIC-02 + EPIC-05) âœ…

| ID     | US     | Titre                                      | Statut | RG     | PrioritÃ© |
| ------ | ------ | ------------------------------------------ | ------ | ------ | ---------- |
| T-1101 | US-207 | Archiver/DÃ©sarchiver une campagne        | âœ…    | RG-016 | ðŸŸ¡ V1    |
| T-1102 | US-210 | DÃ©finir le propriÃ©taire d'une campagne | âœ…    | RG-111 | ðŸŸ¡ V1    |
| T-1103 | US-211 | Configurer la visibilitÃ© d'une campagne  | âœ…    | RG-112 | ðŸŸ¡ V1    |
| T-1104 | US-504 | Modifier un template avec versioning       | âœ…    | RG-031 | ðŸŸ¡ V1    |
| T-1105 | US-505 | CrÃ©er des phases dans un template        | âœ…    | RG-032 | ðŸŸ¡ V1    |
| T-1106 | US-506 | Consulter un document depuis checklist     | âœ…    | -      | ðŸŸ¡ V1    |
| T-1107 | US-507 | TÃ©lÃ©charger un script depuis checklist | âœ…    | -      | ðŸŸ¡ V1    |

---

### Sprint 12 â€” Configuration & Admin (EPIC-08 V1) âœ…

| ID     | US     | Titre                                       | Statut | RG             | PrioritÃ© |
| ------ | ------ | ------------------------------------------- | ------ | -------------- | ---------- |
| T-1201 | US-802 | DÃ©finir les champs personnalisÃ©s        | âœ…    | RG-061, RG-015 | ðŸŸ¡ V1    |
| T-1202 | US-804 | Voir l'historique des modifications (Audit) | âœ…    | RG-070         | ðŸŸ¡ V1    |
| T-1203 | US-806 | Exporter/Importer la configuration          | âœ…    | RG-100         | ðŸŸ¡ V1    |
| T-1204 | US-807 | CrÃ©er un profil "Coordinateur"            | âœ…    | RG-114         | ðŸŸ¡ V1    |
| T-1205 | US-808 | GÃ©rer les habilitations par campagne      | âœ…    | RG-115         | ðŸŸ¡ V1    |
| T-1206 | -      | Installer auditor-bundle                    | âœ…    | RG-070         | V1         |

---

### Sprint 13 â€” PrÃ©requis & Dashboard V1 (EPIC-09 + EPIC-06) âœ…

| ID     | US     | Titre                                       | Statut | RG     | PrioritÃ© |
| ------ | ------ | ------------------------------------------- | ------ | ------ | ---------- |
| T-1301 | US-901 | Voir les prÃ©requis globaux d'une campagne | âœ…    | RG-090 | ðŸŸ¡ V1    |
| T-1302 | US-902 | Ajouter/modifier un prÃ©requis global      | âœ…    | RG-090 | ðŸŸ¡ V1    |
| T-1303 | US-903 | Voir les prÃ©requis par segment            | âœ…    | RG-091 | ðŸŸ¡ V1    |
| T-1304 | US-904 | Ajouter un prÃ©requis par segment          | âœ…    | RG-091 | ðŸŸ¡ V1    |
| T-1305 | US-604 | Exporter le dashboard en PDF                | âœ…    | -      | ðŸŸ¡ V1    |
| T-1306 | US-605 | Partager une URL lecture seule              | âœ…    | RG-041 | ðŸŸ¡ V1    |
| T-1307 | US-608 | Filtrer le dashboard global par statut      | âœ…    | -      | ðŸŸ¡ V1    |

---

### Sprint 14 â€” Polish V1 & Tag âœ…

| ID     | TÃ¢che                             | Statut | Cible                |
| ------ | ---------------------------------- | ------ | -------------------- |
| T-1401 | ComplÃ©ter couverture tests (80%) | âœ…    | Services (240 tests) |
| T-1402 | Test de charge V1                  | âœ…    | 50 users, 10k ops    |
| T-1403 | Audit sÃ©curitÃ© (OWASP basics)  | âœ…    | OWASP Top 10         |
| T-1404 | Documentation utilisateur          | âœ…    | Guide Sophie + Karim |
| T-1405 | **ðŸ TAG v1.0.0**                  | âœ…    | -                    |

---

## ðŸŸ¢ PHASE V2 â€” Backlog (Post-V1)

### RÃ©servation End-Users (EPIC-10)

| US      | Titre                                           | PrioritÃ© |
| ------- | ----------------------------------------------- | ---------- |
| US-1001 | Voir les crÃ©neaux disponibles (Agent)         | ðŸ”´ MVP\* |
| US-1002 | Se positionner sur un crÃ©neau (Agent)         | ðŸ”´ MVP\* |
| US-1003 | Annuler/modifier son crÃ©neau (Agent)          | ðŸ”´ MVP\* |
| US-1004 | Voir mon rÃ©capitulatif (Agent)                | ðŸŸ¡ V1    |
| US-1005 | Voir la liste de mes agents (Manager)           | ðŸ”´ MVP\* |
| US-1006 | Positionner un agent (Manager)                  | ðŸ”´ MVP\* |
| US-1007 | Modifier/annuler le crÃ©neau d'un agent        | ðŸ”´ MVP\* |
| US-1008 | Voir les crÃ©neaux avec rÃ©partition Ã©quipe | ðŸŸ¡ V1    |
| US-1009 | Recevoir notification agents non positionnÃ©s  | ðŸŸ¢ V2    |
| US-1010 | Positionner des agents (Coordinateur)           | ðŸŸ¡ V1    |
| US-1011 | S'authentifier par carte agent                  | ðŸŸ¡ V1    |
| US-1012 | Voir les informations de l'intervention         | ðŸŸ¢ V2    |

_\* MVP = MVP du module RÃ©servation, pas du MVP OpsTracker core_

### Gestion CrÃ©neaux (EPIC-11)

| US      | Titre                                         | PrioritÃ© |
| ------- | --------------------------------------------- | ---------- |
| US-1101 | CrÃ©er des crÃ©neaux pour une campagne      | ðŸ”´ MVP\* |
| US-1102 | DÃ©finir la capacitÃ© IT (ressources)       | ðŸŸ¡ V1    |
| US-1103 | DÃ©finir la durÃ©e d'intervention (abaques) | ðŸŸ¡ V1    |
| US-1104 | Modifier un crÃ©neau                         | ðŸ”´ MVP\* |
| US-1105 | Supprimer un crÃ©neau                        | ðŸ”´ MVP\* |
| US-1106 | Voir le taux de remplissage                   | ðŸ”´ MVP\* |
| US-1107 | DÃ©finir une date de verrouillage            | ðŸŸ¡ V1    |
| US-1108 | Associer crÃ©neaux Ã  segments/sites         | ðŸŸ¡ V1    |

### Notifications (EPIC-12)

| US      | Titre                                  | PrioritÃ© |
| ------- | -------------------------------------- | ---------- |
| US-1201 | Envoyer email confirmation avec ICS    | ðŸŸ¡ V1    |
| US-1202 | Envoyer email rappel (J-2)             | ðŸŸ¡ V1    |
| US-1203 | Envoyer email modification             | ðŸŸ¡ V1    |
| US-1204 | Envoyer email annulation               | ðŸŸ¡ V1    |
| US-1205 | Envoyer invitation initiale aux agents | ðŸ”´ MVP\* |
| US-1206 | Configurer paramÃ¨tres notification    | ðŸŸ¢ V2    |

### Autres V2

| US     | Titre                                 | PrioritÃ© |
| ------ | ------------------------------------- | ---------- |
| US-208 | Dupliquer une campagne                | ðŸŸ¢ V2    |
| US-302 | Vue cards des opÃ©rations            | ðŸŸ¡ V1    |
| US-305 | Trier les colonnes du tableau         | ðŸŸ¡ V1    |
| US-309 | Supprimer une opÃ©ration             | ðŸŸ¡ V1    |
| US-508 | Donner feedback sur un document       | ðŸŸ¢ V2    |
| US-603 | Voir la vÃ©locitÃ©                  | ðŸŸ¢ V2    |
| US-606 | AccÃ©der Ã  l'aide contextuelle      | ðŸŸ¢ V2    |
| US-705 | Voir mÃ©triques utilisation document | ðŸŸ¢ V2    |
| US-803 | Configurer un workflow (V2)           | ðŸŸ¢ V2    |
| US-805 | Dupliquer un type d'opÃ©ration       | ðŸŸ¢ V2    |

---

## ðŸ“ˆ MÃ©triques

| MÃ©trique           | Actuel | Cible MVP | Cible V1 |
| -------------------- | ------ | --------- | -------- |
| TÃ¢ches terminÃ©es  | 103    | 65        | 110      |
| User Stories done    | 76/85  | 47/85     | 76/85    |
| EntitÃ©s crÃ©Ã©es | 11     | 6         | 8        |
| Tests passants       | 240    | 60+       | 100+     |
| Couverture code      | ~80%   | 70%       | 80%      |

---

## ðŸ·ï¸ LÃ©gende

| Symbole | Signification |
| ------- | ------------- |
| â³      | Ã€ faire      |
| ðŸ”„    | En cours      |
| âœ…     | TerminÃ©     |
| âŒ      | BloquÃ©      |
| ðŸ”´    | MUST (MVP)    |
| ðŸŸ¡    | SHOULD (V1)   |
| ðŸŸ¢    | COULD (V2)    |

---

## ðŸ“‹ RÃ©sumÃ© par Sprint

| Sprint  | TÃ¢ches | US     | Focus                   |
| ------- | ------- | ------ | ----------------------- |
| 0       | 7       | -      | Setup Symfony + Docker  |
| 1       | 7       | 3      | Auth & Users            |
| 2       | 9       | -      | EntitÃ©s + Workflows   |
| 3       | 7       | 5      | Campagnes CRUD          |
| 4       | 7       | 6      | OpÃ©rations + Segments |
| 5       | 6       | 4      | Interface Karim         |
| 6       | 6       | 3      | Checklists              |
| 7       | 6       | 3      | Dashboard               |
| 8       | 7       | -      | Tests & Tag MVP         |
| **MVP** | **62**  | **24** | **v0.1.0**              |
| 9       | 8       | 4      | Import CSV              |
| 10      | 8       | 8      | Users V1 + Docs         |
| 11      | 7       | 7      | Campagnes V1            |
| 12      | 6       | 5      | Config & Admin          |
| 13      | 7       | 7      | PrÃ©requis + Dashboard |
| 14      | 5       | -      | Polish & Tag V1         |
| **V1**  | **41**  | **31** | **v1.0.0**              |
