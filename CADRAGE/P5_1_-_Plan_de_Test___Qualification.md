# P5.1 - Plan de Test & Qualification

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ§ª **PLAN DE TEST OPSTRACKER** Version : 1.0 Date : 24 janvier 2026 Niveau de confiance : **95%**
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

---

## 1. Vue d'Ensemble

### 1.1 PÃ©rimÃ¨tre de Test

| Ã‰lÃ©ment                             | QuantitÃ© | Source   |
| -------------------------------------- | ---------- | -------- |
| **User Stories**                       | 85         | P4.1     |
| **EPICs**                              | 12         | P4.1     |
| **RÃ¨gles MÃ©tier**                   | ~55        | P4.1 Â§3 |
| **Personas**                           | 7          | P1.3     |
| **NFR (Exigences non-fonctionnelles)** | 15+        | P4.2     |

### 1.2 Objectifs de Qualification

| Objectif                 | Cible               | Mesure                    |
| ------------------------ | ------------------- | ------------------------- |
| Couverture fonctionnelle | 100% US MVP + V1    | ScÃ©narios BDD passants  |
| Couverture code          | â‰¥80%              | PHPUnit + Coverage        |
| AccessibilitÃ© RGAA 4.1 | 100% critÃ¨res A+AA | Audit Ara + tests manuels |
| Performance dashboard    | <500ms (100k ops)   | k6 load tests             |
| SÃ©curitÃ©             | 0 critique OWASP    | Audit sÃ©curitÃ©        |

### 1.3 StratÃ©gie de Test

```mermaid
flowchart TB
    subgraph NIVEAU1["ðŸ“‹ Niveau 1 : Tests Unitaires"]
        U1["Services mÃ©tier"]
        U2["EntitÃ©s & Validations"]
        U3["Voters & Security"]
    end

    subgraph NIVEAU2["ðŸ”— Niveau 2 : Tests d'IntÃ©gration"]
        I1["Repositories + PostgreSQL"]
        I2["Workflows Symfony"]
        I3["Import CSV + JSONB"]
    end

    subgraph NIVEAU3["ðŸŒ Niveau 3 : Tests E2E"]
        E1["Parcours Sophie"]
        E2["Parcours Karim"]
        E3["Parcours Agent/Manager"]
    end

    subgraph NIVEAU4["â™¿ Niveau 4 : Tests SpÃ©cialisÃ©s"]
        A1["AccessibilitÃ© RGAA"]
        P1["Performance & Charge"]
        S1["SÃ©curitÃ© OWASP"]
    end

    NIVEAU1 --> NIVEAU2 --> NIVEAU3 --> NIVEAU4

    style NIVEAU1 fill:#e3f2fd
    style NIVEAU2 fill:#fff3e0
    style NIVEAU3 fill:#e8f5e9
    style NIVEAU4 fill:#fce4ec
```

---

## 2. Environnements de Test

### 2.1 Stack Technique

| Composant      | Version | Usage Test            |
| -------------- | ------- | --------------------- |
| **PHP**        | 8.3     | PHPUnit 11            |
| **Symfony**    | 7.4 LTS | WebTestCase           |
| **PostgreSQL** | 17      | Fixtures Faker        |
| **Redis**      | 7.x     | Mock ou instance test |
| **Node.js**    | 22 LTS  | Playwright            |

### 2.2 Environnements

| Env         | Base de donnÃ©es     | DonnÃ©es                    | Usage                    |
| ----------- | --------------------- | ---------------------------- | ------------------------ |
| **test**    | SQLite in-memory      | Fixtures lÃ©gÃ¨res          | CI/CD, unitaires         |
| **dev**     | PostgreSQL local      | Faker (3 campagnes, 150 ops) | Dev, intÃ©gration       |
| **staging** | PostgreSQL production | DonnÃ©es anonymisÃ©es      | UAT, performance         |
| **prod**    | PostgreSQL production | RÃ©elles                    | Post-dÃ©ploiement smoke |

### 2.3 Jeux de DonnÃ©es de Test

```yaml
# fixtures/test_data.yaml
campagnes:
  - nom: "Migration Pilote â†’ Organisation principale"
    statut: en_cours
    operations: 150
    segments: ["Site Central", "Site Nord", "Site Ouest"]

  - nom: "DÃ©ploiement Windows 11"
    statut: planifiee
    operations: 500
    segments: ["Ã‰tage 1", "Ã‰tage 2", "Ã‰tage 3"]

  - nom: "Renouvellement Postes 2024"
    statut: terminee
    operations: 1200
    segments: ["Direction", "Production", "Support"]

utilisateurs:
  - email: sophie@demo.opstracker.local
    role: ROLE_GESTIONNAIRE

  - email: karim@demo.opstracker.local
    role: ROLE_TECHNICIEN

  - email: marc@demo.opstracker.local
    role: ROLE_ADMIN

  - email: agent1@demo.opstracker.local
    role: ROLE_AGENT

  - email: manager1@demo.opstracker.local
    role: ROLE_MANAGER
```

---

## 3. Tests Fonctionnels par EPIC

### 3.1 EPIC-01 : Authentification & Gestion Utilisateurs

**Personas concernÃ©s** : Marc (Admin), Sophie, Karim, tous

#### TC-101 : Connexion Utilisateur

| ID        | ScÃ©nario                     | PrÃ©conditions                   | Actions                                                                      | RÃ©sultat Attendu                         | RG     |
| --------- | ------------------------------ | --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ | ------ |
| TC-101-01 | Connexion nominale Sophie      | Compte Sophie actif               | 1. AccÃ©der /login<br>2. Saisir email/mdp valides<br>3. Cliquer "Connexion" | Redirection vers Dashboard                 | RG-001 |
| TC-101-02 | Connexion nominale Karim       | Compte Karim actif                | 1. AccÃ©der /login<br>2. Saisir email/mdp valides<br>3. Cliquer "Connexion" | Redirection vers "Mes interventions"       | RG-001 |
| TC-101-03 | Identifiants invalides         | -                                 | Saisir email/mdp incorrects                                                  | Message "Identifiants incorrects" en rouge | RG-001 |
| TC-101-04 | Verrouillage aprÃ¨s 5 Ã©checs | Compteur Ã  4                     | Ã‰chouer une 5Ã¨me tentative                                                 | Message "Compte verrouillÃ© 15 min"       | RG-006 |
| TC-101-05 | DÃ©verrouillage automatique   | Compte verrouillÃ© depuis 15 min | Tenter connexion valide                                                      | Connexion rÃ©ussie                        | RG-006 |
| TC-101-06 | Session Remember Me            | Connexion avec remember me        | Fermer/rouvrir navigateur                                                    | Session conservÃ©e                        | -      |
| TC-101-07 | Compte dÃ©sactivÃ©           | Compte Sophie dÃ©sactivÃ©       | Tenter connexion                                                             | Message "Compte dÃ©sactivÃ©"             | RG-005 |

#### TC-102 : DÃ©connexion

| ID        | ScÃ©nario             | PrÃ©conditions        | Actions                                  | RÃ©sultat Attendu                      |
| --------- | ---------------------- | ---------------------- | ---------------------------------------- | --------------------------------------- |
| TC-102-01 | DÃ©connexion nominale | Utilisateur connectÃ© | Cliquer [Sophie â–¼] â†’ "DÃ©connexion" | Redirection /login, session invalidÃ©e |

#### TC-103 : CrÃ©ation Utilisateur (Admin)

| ID        | ScÃ©nario          | PrÃ©conditions         | Actions                                                                  | RÃ©sultat Attendu               | RG             |
| --------- | ------------------- | ----------------------- | ------------------------------------------------------------------------ | -------------------------------- | -------------- |
| TC-103-01 | CrÃ©ation nominale | Admin connectÃ©        | 1. Cliquer "+ Nouvel utilisateur"<br>2. Remplir formulaire<br>3. Valider | Compte crÃ©Ã©, email envoyÃ©  | RG-002, RG-003 |
| TC-103-02 | Email existant      | Email dÃ©jÃ  utilisÃ© | Soumettre avec email existant                                            | Erreur "Email dÃ©jÃ  utilisÃ©" | RG-002         |
| TC-103-03 | RÃ´le Admin         | Admin crÃ©e compte     | SÃ©lectionner rÃ´le Admin                                               | Permissions Admin attribuÃ©es   | RG-003         |
| TC-103-04 | RÃ´le Gestionnaire  | Admin crÃ©e compte     | SÃ©lectionner rÃ´le Gestionnaire                                        | Permissions Gestionnaire         | RG-003         |
| TC-103-05 | RÃ´le Technicien    | Admin crÃ©e compte     | SÃ©lectionner rÃ´le Technicien                                          | Permissions Technicien           | RG-003         |

#### TC-104 : Modification Utilisateur

| ID        | ScÃ©nario                      | PrÃ©conditions          | Actions                           | RÃ©sultat Attendu                                | RG     |
| --------- | ------------------------------- | ------------------------ | --------------------------------- | ------------------------------------------------- | ------ |
| TC-104-01 | Modification nominale           | Admin connectÃ©         | Modifier nom/email utilisateur    | Toast "Utilisateur mis Ã  jour"                   | RG-004 |
| TC-104-02 | Auto-rÃ©trogradation bloquÃ©e | Admin Ã©dite son compte | Changer son rÃ´le vers Technicien | Erreur "Impossible de rÃ©trograder votre compte" | RG-004 |

#### TC-105 : DÃ©sactivation/RÃ©activation

| ID        | ScÃ©nario              | PrÃ©conditions     | Actions                           | RÃ©sultat Attendu              | RG     |
| --------- | ----------------------- | ------------------- | --------------------------------- | ------------------------------- | ------ |
| TC-105-01 | DÃ©sactivation         | Admin connectÃ©    | DÃ©cocher "Actif" pour Karim     | Karim ne peut plus se connecter | RG-005 |
| TC-105-02 | RÃ©activation          | Karim dÃ©sactivÃ© | Cocher "Actif"                    | Karim peut se reconnecter       | RG-005 |
| TC-105-03 | Historique prÃ©servÃ© | Karim dÃ©sactivÃ© | Consulter historique opÃ©rations | Nom Karim toujours visible      | RG-005 |

#### TC-106 : Statistiques Utilisateur

| ID        | ScÃ©nario          | PrÃ©conditions               | Actions                           | RÃ©sultat Attendu                                                |
| --------- | ------------------- | ----------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| TC-106-01 | Affichage stats     | Admin connectÃ©              | Ouvrir dÃ©tail utilisateur Karim | Voir interventions assignÃ©es/rÃ©alisÃ©es, derniÃ¨re connexion |
| TC-106-02 | Alerte inactivitÃ© | Utilisateur jamais connectÃ© | Voir liste utilisateurs           | IcÃ´ne âš ï¸ Ã  cÃ´tÃ© de "Jamais"                               |

#### TC-107 : Changement Mot de Passe

| ID        | ScÃ©nario                 | PrÃ©conditions    | Actions                          | RÃ©sultat Attendu                                | RG     |
| --------- | -------------------------- | ------------------ | -------------------------------- | ------------------------------------------------- | ------ |
| TC-107-01 | Changement nominal         | Sophie connectÃ©e | Saisir ancien + nouveau (x2) mdp | Toast "Mot de passe modifiÃ©", reste connectÃ©e | RG-001 |
| TC-107-02 | Ancien mdp incorrect       | Sophie connectÃ©e | Saisir mauvais ancien mdp        | Erreur "Ancien mot de passe incorrect"            | RG-001 |
| TC-107-03 | Confirmation non identique | Sophie connectÃ©e | Saisir nouveaux mdp diffÃ©rents | Erreur "Les mots de passe ne correspondent pas"   | RG-001 |

---

### 3.2 EPIC-02 : CrÃ©ation & Gestion des Campagnes

**Personas concernÃ©s** : Sophie (Gestionnaire)

#### TC-201 : Liste des Campagnes

| ID        | ScÃ©nario                    | PrÃ©conditions                  | Actions                  | RÃ©sultat Attendu                                       | RG     |
| --------- | ----------------------------- | -------------------------------- | ------------------------ | -------------------------------------------------------- | ------ |
| TC-201-01 | Affichage groupÃ© par statut | 3 campagnes diffÃ©rents statuts | AccÃ©der /campagnes     | Campagnes groupÃ©es : PlanifiÃ©e, En cours, TerminÃ©e | RG-010 |
| TC-201-02 | Informations affichÃ©es      | Campagne existante               | Voir liste               | Nom, dates, progression, propriÃ©taire visibles         | -      |
| TC-201-03 | Tri par date                  | Plusieurs campagnes              | Cliquer sur colonne Date | Tri croissant/dÃ©croissant                              | -      |

#### TC-202 : CrÃ©ation Campagne - Ã‰tape 1/4 (Infos gÃ©nÃ©rales)

| ID        | ScÃ©nario              | PrÃ©conditions    | Actions                               | RÃ©sultat Attendu                               | RG     |
| --------- | ----------------------- | ------------------ | ------------------------------------- | ------------------------------------------------ | ------ |
| TC-202-01 | CrÃ©ation nominale     | Sophie connectÃ©e | Remplir nom, type, dates, description | Passage Ã  l'Ã©tape 2                           | RG-011 |
| TC-202-02 | Nom obligatoire         | Formulaire vide    | Soumettre sans nom                    | Erreur "Nom obligatoire"                         | RG-011 |
| TC-202-03 | Date fin > date dÃ©but | Dates inversÃ©es  | Soumettre                             | Erreur "Date fin doit Ãªtre aprÃ¨s date dÃ©but" | RG-011 |

#### TC-203 : CrÃ©ation Campagne - Ã‰tape 2/4 (Upload CSV)

| ID        | ScÃ©nario                    | PrÃ©conditions       | Actions        | RÃ©sultat Attendu                             | RG     |
| --------- | ----------------------------- | --------------------- | -------------- | ---------------------------------------------- | ------ |
| TC-203-01 | Import CSV nominal            | CSV valide 100 lignes | Upload fichier | PrÃ©visualisation 10 premiÃ¨res lignes        | RG-012 |
| TC-203-02 | DÃ©tection sÃ©parateur auto | CSV point-virgule     | Upload         | SÃ©parateur dÃ©tectÃ© automatiquement       | RG-012 |
| TC-203-03 | DÃ©tection encodage          | CSV ISO-8859-1        | Upload         | Encodage converti en UTF-8                     | RG-012 |
| TC-203-04 | CSV > 100k lignes             | CSV 150k lignes       | Upload         | Erreur "Fichier trop volumineux (max 100 000)" | RG-012 |
| TC-203-05 | Format invalide               | Fichier .xlsx         | Upload         | Erreur "Format non supportÃ© (CSV requis)"    | RG-012 |

#### TC-204 : CrÃ©ation Campagne - Ã‰tape 3/4 (Mapping colonnes)

| ID        | ScÃ©nario            | PrÃ©conditions         | Actions                                   | RÃ©sultat Attendu                              | RG     |
| --------- | --------------------- | ----------------------- | ----------------------------------------- | ----------------------------------------------- | ------ |
| TC-204-01 | Mapping nominal       | CSV prÃ©visualisÃ©    | Mapper colonnes CSV â†’ champs OpsTracker | Validation rÃ©ussie                            | RG-014 |
| TC-204-02 | Matricule obligatoire | Mapping incomplet       | Ne pas mapper le matricule                | Erreur "Colonne matricule obligatoire"          | RG-014 |
| TC-204-03 | Champ custom JSONB    | Colonne non standard    | Mapper vers champ personnalisÃ©          | StockÃ© en JSONB                               | RG-015 |
| TC-204-04 | Ligne en erreur       | CSV avec ligne invalide | Valider import                            | Ligne skippÃ©e, log erreur, autres importÃ©es | RG-092 |

#### TC-205 : CrÃ©ation Campagne - Ã‰tape 4/4 (Workflow & Template)

| ID        | ScÃ©nario            | PrÃ©conditions            | Actions                           | RÃ©sultat Attendu                       | RG     |
| --------- | --------------------- | -------------------------- | --------------------------------- | ---------------------------------------- | ------ |
| TC-205-01 | Association template  | Templates existants        | SÃ©lectionner template checklist | Template associÃ© Ã  la campagne        | RG-014 |
| TC-205-02 | Workflow par dÃ©faut | Aucun workflow custom      | Valider                           | Workflow 6 statuts appliquÃ©            | RG-017 |
| TC-205-03 | CrÃ©ation complÃ¨te  | Toutes Ã©tapes validÃ©es | Cliquer "CrÃ©er"                 | Campagne crÃ©Ã©e, statut "PlanifiÃ©e" | RG-010 |

#### TC-206 : Ajout OpÃ©ration Manuelle

| ID        | ScÃ©nario       | PrÃ©conditions    | Actions                                     | RÃ©sultat Attendu                           | RG             |
| --------- | ---------------- | ------------------ | ------------------------------------------- | -------------------------------------------- | -------------- |
| TC-206-01 | Ajout nominal    | Campagne existante | Cliquer "+ OpÃ©ration", remplir formulaire | OpÃ©ration ajoutÃ©e, statut "Ã€ planifier" | RG-014, RG-015 |
| TC-206-02 | Matricule unique | Matricule existant | Soumettre mÃªme matricule                   | Erreur "Matricule dÃ©jÃ  existant"          | RG-014         |

#### TC-207 : Archiver/DÃ©sarchiver Campagne

| ID        | ScÃ©nario      | PrÃ©conditions     | Actions                                       | RÃ©sultat Attendu                          | RG     |
| --------- | --------------- | ------------------- | --------------------------------------------- | ------------------------------------------- | ------ |
| TC-207-01 | Archivage       | Campagne terminÃ©e | Cliquer "Archiver"                            | Campagne masquÃ©e de la liste par dÃ©faut | RG-016 |
| TC-207-02 | DÃ©sarchivage  | Campagne archivÃ©e | Afficher archivÃ©es, cliquer "DÃ©sarchiver" | Campagne rÃ©apparaÃ®t                     | RG-016 |
| TC-207-03 | Filtre archives | Campagnes mixtes    | Cocher "Afficher archivÃ©es"                 | Campagnes archivÃ©es visibles              | RG-016 |

#### TC-209 : Mode Inscription

| ID        | ScÃ©nario   | PrÃ©conditions     | Actions                       | RÃ©sultat Attendu                | RG     |
| --------- | ------------ | ------------------- | ----------------------------- | --------------------------------- | ------ |
| TC-209-01 | Mode Agent   | CrÃ©ation campagne | SÃ©lectionner "Mode Agent"   | Agents peuvent s'auto-positionner | RG-110 |
| TC-209-02 | Mode Manager | CrÃ©ation campagne | SÃ©lectionner "Mode Manager" | Seuls managers positionnent       | RG-110 |
| TC-209-03 | Mode Mixte   | CrÃ©ation campagne | SÃ©lectionner "Mode Mixte"   | Selon habilitations individuelles | RG-110 |

#### TC-210 : PropriÃ©taire Campagne

| ID        | ScÃ©nario                  | PrÃ©conditions        | Actions              | RÃ©sultat Attendu          | RG     |
| --------- | --------------------------- | ---------------------- | -------------------- | --------------------------- | ------ |
| TC-210-01 | PropriÃ©taire par dÃ©faut | Sophie crÃ©e campagne | CrÃ©er campagne     | Sophie = propriÃ©taire     | RG-111 |
| TC-210-02 | Transfert propriÃ©tÃ©     | Sophie propriÃ©taire  | TransfÃ©rer Ã  Marc | Marc devient propriÃ©taire | RG-111 |

#### TC-211 : VisibilitÃ© Campagne

| ID        | ScÃ©nario                       | PrÃ©conditions    | Actions                      | RÃ©sultat Attendu                              | RG     |
| --------- | -------------------------------- | ------------------ | ---------------------------- | ----------------------------------------------- | ------ |
| TC-211-01 | VisibilitÃ© restreinte dÃ©faut | Nouvelle campagne  | CrÃ©er campagne             | Visible uniquement propriÃ©taire + habilitÃ©s | RG-112 |
| TC-211-02 | Ajout habilitation               | Campagne crÃ©Ã©e | Ajouter Marc aux habilitÃ©s | Marc peut voir la campagne                      | RG-112 |

#### TC-212 : Population Cible

| ID        | ScÃ©nario          | PrÃ©conditions | Actions                   | RÃ©sultat Attendu                      | RG     |
| --------- | ------------------- | --------------- | ------------------------- | --------------------------------------- | ------ |
| TC-212-01 | Import liste agents | CSV avec emails | Importer population cible | Seuls ces agents peuvent se positionner | RG-113 |

---

### 3.3 EPIC-03 : Gestion des OpÃ©rations

**Personas concernÃ©s** : Sophie (Gestionnaire)

#### TC-301 : Liste des OpÃ©rations (Vue Tableau)

| ID        | ScÃ©nario           | PrÃ©conditions       | Actions                    | RÃ©sultat Attendu                                   | RG       |
| --------- | -------------------- | --------------------- | -------------------------- | ---------------------------------------------------- | -------- |
| TC-301-01 | Affichage tableau    | Campagne avec 150 ops | AccÃ©der aux opÃ©rations | Tableau paginÃ©, 50 lignes/page                     | RG-080   |
| TC-301-02 | Colonnes affichÃ©es | -                     | Voir tableau               | Matricule, Nom, Segment, Statut, Technicien, Actions | -        |
| TC-301-03 | Performance 100k     | 100k opÃ©rations     | Charger page               | Affichage <500ms                                     | NFR-PERF |

#### TC-302 : Vue Cards (V1)

| ID        | ScÃ©nario      | PrÃ©conditions    | Actions                | RÃ©sultat Attendu                      |
| --------- | --------------- | ------------------ | ---------------------- | --------------------------------------- |
| TC-302-01 | Basculement vue | Vue tableau active | Cliquer icÃ´ne "Cards" | Affichage en cartes                     |
| TC-302-02 | Infos sur card  | -                  | Voir une card          | Matricule, nom, statut, couleur segment |

#### TC-303 : Filtrer les OpÃ©rations

| ID        | ScÃ©nario            | PrÃ©conditions    | Actions                       | RÃ©sultat Attendu               |
| --------- | --------------------- | ------------------ | ----------------------------- | -------------------------------- |
| TC-303-01 | Filtre par statut     | Ops tous statuts   | SÃ©lectionner "En cours"     | Seules ops "En cours" visibles   |
| TC-303-02 | Filtre par segment    | Ops multi-segments | SÃ©lectionner "Site Central" | Seules ops Site Central visibles |
| TC-303-03 | Filtre par technicien | Ops assignÃ©es    | SÃ©lectionner "Karim"        | Seules ops de Karim visibles     |
| TC-303-04 | Filtres combinÃ©s    | -                  | Statut + Segment              | Intersection des filtres         |
| TC-303-05 | Reset filtres         | Filtres actifs     | Cliquer "RÃ©initialiser"     | Tous les filtres effacÃ©s       |

#### TC-304 : Modifier Statut Inline

| ID        | ScÃ©nario          | PrÃ©conditions            | Actions                            | RÃ©sultat Attendu                         | RG     |
| --------- | ------------------- | -------------------------- | ---------------------------------- | ------------------------------------------ | ------ |
| TC-304-01 | Changement nominal  | Op "Ã€ planifier"          | Cliquer dropdown â†’ "PlanifiÃ©e" | Statut mis Ã  jour, timestamp enregistrÃ© | RG-017 |
| TC-304-02 | Transition invalide | Op "TerminÃ©e"            | Tenter "Ã€ planifier"              | Erreur "Transition non autorisÃ©e"        | RG-017 |
| TC-304-03 | Temps rÃ©el        | Sophie + Karim connectÃ©s | Karim change statut                | Dashboard Sophie mis Ã  jour <30s          | RG-080 |

#### TC-305 : Trier les Colonnes (V1)

| ID        | ScÃ©nario    | PrÃ©conditions  | Actions                     | RÃ©sultat Attendu |
| --------- | ------------- | ---------------- | --------------------------- | ------------------ |
| TC-305-01 | Tri matricule | Liste affichÃ©e | Cliquer entÃªte "Matricule" | Tri A-Z puis Z-A   |
| TC-305-02 | Tri date      | Liste affichÃ©e | Cliquer entÃªte "Date MAJ"  | Tri chronologique  |

#### TC-306 : Assigner Technicien

| ID        | ScÃ©nario           | PrÃ©conditions        | Actions                            | RÃ©sultat Attendu                                  | RG     |
| --------- | -------------------- | ---------------------- | ---------------------------------- | --------------------------------------------------- | ------ |
| TC-306-01 | Assignation nominale | Op non assignÃ©e      | SÃ©lectionner Karim dans dropdown | Karim assignÃ©, voit l'op dans "Mes interventions" | RG-018 |
| TC-306-02 | RÃ©assignation      | Op assignÃ©e Ã  Karim | Changer pour Thomas                | Thomas assignÃ©, Karim ne voit plus l'op           | RG-018 |

#### TC-307 : Exporter CSV

| ID        | ScÃ©nario      | PrÃ©conditions         | Actions                | RÃ©sultat Attendu                 |
| --------- | --------------- | ----------------------- | ---------------------- | ---------------------------------- |
| TC-307-01 | Export complet  | 150 opÃ©rations        | Cliquer "Exporter CSV" | TÃ©lÃ©chargement CSV 150 lignes  |
| TC-307-02 | Export filtrÃ© | Filtre "En cours" actif | Exporter               | CSV avec uniquement ops filtrÃ©es |

#### TC-308 : Recherche Globale

| ID        | ScÃ©nario                | PrÃ©conditions             | Actions                | RÃ©sultat Attendu              |
| --------- | ------------------------- | --------------------------- | ---------------------- | ------------------------------- |
| TC-308-01 | Recherche matricule       | Op matricule "PC-2024-0042" | Saisir "PC-2024-0042"  | OpÃ©ration trouvÃ©e           |
| TC-308-02 | Recherche nom             | Op nom "DUPONT"             | Saisir "DUPONT"        | OpÃ©rations correspondantes    |
| TC-308-03 | Recherche multi-campagnes | -                           | Rechercher globalement | RÃ©sultats de toutes campagnes |

#### TC-309 : Supprimer OpÃ©ration (V1)

| ID        | ScÃ©nario                    | PrÃ©conditions | Actions                         | RÃ©sultat Attendu |
| --------- | ----------------------------- | --------------- | ------------------------------- | ------------------ |
| TC-309-01 | Suppression avec confirmation | Op existante    | Cliquer supprimer â†’ Confirmer | Op supprimÃ©e     |
| TC-309-02 | Annulation suppression        | -               | Cliquer supprimer â†’ Annuler   | Op conservÃ©e     |

---

### 3.4 EPIC-04 : Interface Terrain (Karim)

**Personas concernÃ©s** : Karim (Technicien)

> âš ï¸ **TESTS CRITIQUES UX** â€” Ces tests valident l'objectif "zÃ©ro formation, <5min d'apprentissage"

#### TC-401 : Mes Interventions

| ID        | ScÃ©nario                | PrÃ©conditions                     | Actions                       | RÃ©sultat Attendu                          | RG       |
| --------- | ------------------------- | ----------------------------------- | ----------------------------- | ------------------------------------------- | -------- |
| TC-401-01 | Affichage filtrÃ©e       | Karim connectÃ©, 5 ops assignÃ©es | AccÃ©der "Mes interventions" | Liste des 5 ops de Karim uniquement         | RG-020   |
| TC-401-02 | Tri par date intervention | Ops multi-dates                     | Voir liste                    | TriÃ©es par date d'intervention croissante | -        |
| TC-401-03 | Mobile responsive         | Ã‰cran 375px largeur                | AccÃ©der                     | Interface lisible, boutons 56px min         | RG-082   |
| TC-401-04 | Temps chargement          | 10 interventions                    | Charger page                  | Affichage <1s                               | NFR-PERF |

#### TC-402 : DÃ©tail Intervention

| ID        | ScÃ©nario         | PrÃ©conditions  | Actions                      | RÃ©sultat Attendu                               |
| --------- | ------------------ | ---------------- | ---------------------------- | ------------------------------------------------ |
| TC-402-01 | Ouverture dÃ©tail | Liste affichÃ©e | Cliquer sur une intervention | DÃ©tail avec infos complÃ¨tes                   |
| TC-402-02 | Infos affichÃ©es  | -                | Voir dÃ©tail                | Matricule, nom, segment, statut, checklist, docs |
| TC-402-03 | AccessibilitÃ©    | -                | Navigation clavier           | Tab navigable, focus visible                     |

#### TC-403 : Changement Statut 1 Clic

| ID        | ScÃ©nario             | PrÃ©conditions  | Actions                               | RÃ©sultat Attendu                          | RG             |
| --------- | ---------------------- | ---------------- | ------------------------------------- | ------------------------------------------- | -------------- |
| TC-403-01 | Bouton "DÃ©marrer"    | Op "PlanifiÃ©e" | Cliquer bouton vert "DÃ©marrer"      | Statut â†’ "En cours", timestamp            | RG-017, RG-021 |
| TC-403-02 | Bouton "Terminer"      | Op "En cours"    | Cliquer bouton bleu "Terminer"        | Statut â†’ "TerminÃ©e"                     | RG-017, RG-021 |
| TC-403-03 | Bouton "Ã€ remÃ©dier" | Op "En cours"    | Cliquer bouton orange "Ã€ remÃ©dier" | Statut â†’ "Ã€ remÃ©dier", motif optionnel | RG-017, RG-021 |
| TC-403-04 | Taille boutons         | Mobile           | Mesurer boutons                       | Minimum 56x56 pixels                        | RG-082         |
| TC-403-05 | Feedback visuel        | Clic sur bouton  | Observer                              | Toast confirmation, couleur changÃ©e       | -              |

#### TC-404 : Retour Automatique

| ID        | ScÃ©nario           | PrÃ©conditions       | Actions         | RÃ©sultat Attendu               |
| --------- | -------------------- | --------------------- | --------------- | -------------------------------- |
| TC-404-01 | Retour aprÃ¨s action | DÃ©tail intervention | Changer statut  | Retour liste "Mes interventions" |
| TC-404-02 | Position conservÃ©e | Liste scrollÃ©e      | Action + retour | Position de scroll conservÃ©e   |

---

### 3.5 EPIC-05 : Checklists

**Personas concernÃ©s** : Sophie (Template), Karim (ExÃ©cution)

#### TC-501 : Cocher Ã‰tape Checklist

| ID        | ScÃ©nario               | PrÃ©conditions      | Actions          | RÃ©sultat Attendu                           | RG     |
| --------- | ------------------------ | -------------------- | ---------------- | -------------------------------------------- | ------ |
| TC-501-01 | Coche nominale           | Checklist affichÃ©e | Cocher Ã©tape 1 | Ã‰tape marquÃ©e âœ“, timestamp enregistrÃ© | -      |
| TC-501-02 | DÃ©coche                | Ã‰tape cochÃ©e      | DÃ©cocher       | Ã‰tape non cochÃ©e, timestamp supprimÃ©    | -      |
| TC-501-03 | Zone tactile             | Mobile               | Toucher checkbox | Zone minimum 48x48px                         | RG-082 |
| TC-501-04 | Mise Ã  jour sans reload | Ã‰tape cochÃ©e      | Cocher           | Turbo Frame update, pas de rechargement      | -      |

#### TC-502 : Progression Checklist

| ID        | ScÃ©nario            | PrÃ©conditions         | Actions          | RÃ©sultat Attendu              |
| --------- | --------------------- | ----------------------- | ---------------- | ------------------------------- |
| TC-502-01 | Calcul progression    | 5/10 Ã©tapes cochÃ©es | Voir progression | Barre 50%, texte "5/10"         |
| TC-502-02 | Progression par phase | 3 phases                | Voir             | Progression globale + par phase |

#### TC-503 : CrÃ©er Template Checklist (Sophie)

| ID        | ScÃ©nario            | PrÃ©conditions       | Actions                                                                        | RÃ©sultat Attendu        | RG     |
| --------- | --------------------- | --------------------- | ------------------------------------------------------------------------------ | ------------------------- | ------ |
| TC-503-01 | CrÃ©ation nominale   | Sophie connectÃ©e    | 1. Cliquer "Nouveau template"<br>2. Nommer<br>3. Ajouter Ã©tapes<br>4. Sauver | Template v1.0 crÃ©Ã©    | RG-030 |
| TC-503-02 | Ã‰tape avec doc liÃ© | Template en Ã©dition | Lier doc Ã  une Ã©tape                                                        | Lien actif dans checklist | RG-030 |
| TC-503-03 | Ordre Ã©tapes        | 5 Ã©tapes            | Glisser-dÃ©poser Ã©tape 3 â†’ position 1                                     | Nouvel ordre sauvÃ©      | -      |

#### TC-504 : Versioning Template (V1)

| ID        | ScÃ©nario            | PrÃ©conditions            | Actions            | RÃ©sultat Attendu           | RG     |
| --------- | --------------------- | -------------------------- | ------------------ | ---------------------------- | ------ |
| TC-504-01 | Nouvelle version      | Template v1.0 existant     | Modifier et sauver | Template v1.1 crÃ©Ã©       | RG-031 |
| TC-504-02 | Snapshot prÃ©servÃ© | Instance en cours sur v1.0 | CrÃ©er v1.1       | Instance garde snapshot v1.0 | RG-031 |

#### TC-505 : Phases Template (V1)

| ID        | ScÃ©nario        | PrÃ©conditions       | Actions                                              | RÃ©sultat Attendu                 | RG     |
| --------- | ----------------- | --------------------- | ---------------------------------------------------- | ---------------------------------- | ------ |
| TC-505-01 | CrÃ©ation phases | Template en Ã©dition | CrÃ©er "PrÃ©paration", "ExÃ©cution", "Validation" | 3 phases avec Ã©tapes respectives | RG-032 |

#### TC-506 : Consulter Document depuis Checklist (V1)

| ID        | ScÃ©nario    | PrÃ©conditions          | Actions            | RÃ©sultat Attendu            |
| --------- | ------------- | ------------------------ | ------------------ | ----------------------------- |
| TC-506-01 | Ouverture PDF | Doc PDF liÃ© Ã  Ã©tape | Cliquer icÃ´ne doc | PDF ouvert dans nouvel onglet |

#### TC-507 : TÃ©lÃ©charger Script depuis Checklist (V1)

| ID        | ScÃ©nario         | PrÃ©conditions   | Actions                   | RÃ©sultat Attendu       |
| --------- | ------------------ | ----------------- | ------------------------- | ------------------------ |
| TC-507-01 | TÃ©lÃ©chargement | Script .ps1 liÃ© | Cliquer "TÃ©lÃ©charger" | Fichier tÃ©lÃ©chargÃ© |

---

### 3.6 EPIC-06 : Dashboard & Reporting

**Personas concernÃ©s** : Sophie (Gestionnaire), Direction

#### TC-601 : Dashboard Temps RÃ©el

| ID        | ScÃ©nario                | PrÃ©conditions      | Actions                | RÃ©sultat Attendu                      | RG             |
| --------- | ------------------------- | -------------------- | ---------------------- | --------------------------------------- | -------------- |
| TC-601-01 | Affichage KPIs            | Campagne 150 ops     | AccÃ©der dashboard    | Compteurs par statut, barre progression | RG-040         |
| TC-601-02 | Mise Ã  jour temps rÃ©el | Sophie sur dashboard | Karim change statut op | Dashboard mis Ã  jour <30s              | RG-040, RG-081 |
| TC-601-03 | Performance               | 100k opÃ©rations    | Charger dashboard      | Affichage <500ms                        | NFR-PERF       |

#### TC-602 : Progression par Segment

| ID        | ScÃ©nario       | PrÃ©conditions        | Actions                    | RÃ©sultat Attendu                 |
| --------- | ---------------- | ---------------------- | -------------------------- | ---------------------------------- |
| TC-602-01 | Vue par segment  | 3 segments             | Voir section "Par segment" | 3 barres de progression distinctes |
| TC-602-02 | DÃ©tail segment | Segment "Site Central" | Cliquer                    | Liste filtrÃ©e par segment        |

#### TC-603 : Graphique VÃ©locitÃ© (V2)

| ID        | ScÃ©nario          | PrÃ©conditions   | Actions        | RÃ©sultat Attendu          |
| --------- | ------------------- | ----------------- | -------------- | --------------------------- |
| TC-603-01 | Courbe vÃ©locitÃ© | Campagne 7+ jours | Voir graphique | Courbe ops terminÃ©es/jour |

#### TC-604 : Export Dashboard PDF (V1)

| ID        | ScÃ©nario     | PrÃ©conditions     | Actions                | RÃ©sultat Attendu                          |
| --------- | -------------- | ------------------- | ---------------------- | ------------------------------------------- |
| TC-604-01 | Export nominal | Dashboard affichÃ© | Cliquer "Exporter PDF" | PDF tÃ©lÃ©chargÃ© avec KPIs + graphiques |

#### TC-605 : Partage URL Lecture Seule (V1)

| ID        | ScÃ©nario          | PrÃ©conditions    | Actions                             | RÃ©sultat Attendu                 | RG     |
| --------- | ------------------- | ------------------ | ----------------------------------- | ---------------------------------- | ------ |
| TC-605-01 | GÃ©nÃ©ration lien | Dashboard campagne | Cliquer "Partager"                  | URL unique gÃ©nÃ©rÃ©e           | RG-041 |
| TC-605-02 | AccÃ¨s anonyme      | URL partagÃ©e     | AccÃ©der via lien (non connectÃ©) | Dashboard visible en lecture seule | RG-041 |

#### TC-607 : Dashboard Multi-Campagnes

| ID        | ScÃ©nario  | PrÃ©conditions     | Actions                    | RÃ©sultat Attendu              |
| --------- | ----------- | ------------------- | -------------------------- | ------------------------------- |
| TC-607-01 | Vue globale | 3 campagnes actives | AccÃ©der dashboard global | Vue agrÃ©gÃ©e des 3 campagnes |
| TC-607-02 | Drill-down  | Vue globale         | Cliquer sur campagne       | DÃ©tail de la campagne         |

#### TC-608 : Filtre Dashboard Global (V1)

| ID        | ScÃ©nario        | PrÃ©conditions | Actions            | RÃ©sultat Attendu          |
| --------- | ----------------- | --------------- | ------------------ | --------------------------- |
| TC-608-01 | Filtre par statut | Vue globale     | Filtrer "En cours" | Seules campagnes "En cours" |

---

### 3.7 EPIC-07 : Base Documentaire

**Personas concernÃ©s** : Sophie (Gestionnaire)

#### TC-701 : Liste Documents

| ID        | ScÃ©nario | PrÃ©conditions | Actions               | RÃ©sultat Attendu                           |
| --------- | ---------- | --------------- | --------------------- | -------------------------------------------- |
| TC-701-01 | Affichage  | 10 docs         | AccÃ©der "Documents" | Liste paginÃ©e avec nom, type, taille, date |

#### TC-702 : Upload Document

| ID        | ScÃ©nario          | PrÃ©conditions                | Actions             | RÃ©sultat Attendu                          | RG     |
| --------- | ------------------- | ------------------------------ | ------------------- | ------------------------------------------- | ------ |
| TC-702-01 | Upload PDF          | Fichier PDF 5Mo                | Drag & drop ou clic | Upload rÃ©ussi, aperÃ§u visible            | RG-050 |
| TC-702-02 | Upload > 50Mo       | Fichier 60Mo                   | Tenter upload       | Erreur "Fichier trop volumineux (max 50Mo)" | RG-050 |
| TC-702-03 | Upload .exe         | Fichier script.exe             | Upload              | Upload rÃ©ussi (autorisÃ© interne)        | RG-050 |
| TC-702-04 | Formats supportÃ©s | .pdf, .docx, .xlsx, .png, .ps1 | Uploader chaque     | Tous acceptÃ©s                             | RG-050 |

#### TC-703 : Lier Document Ã  Campagne (V1)

| ID        | ScÃ©nario       | PrÃ©conditions | Actions                                 | RÃ©sultat Attendu                 | RG     |
| --------- | ---------------- | --------------- | --------------------------------------- | ---------------------------------- | ------ |
| TC-703-01 | Liaison nominale | Doc existant    | Associer Ã  campagne "Migration Pilote" | Doc visible dans contexte campagne | RG-051 |

#### TC-704 : Supprimer Document (V1)

| ID        | ScÃ©nario            | PrÃ©conditions       | Actions   | RÃ©sultat Attendu                                 |
| --------- | --------------------- | --------------------- | --------- | -------------------------------------------------- |
| TC-704-01 | Suppression           | Doc non liÃ©         | Supprimer | Doc supprimÃ©                                     |
| TC-704-02 | Suppression doc liÃ© | Doc liÃ© Ã  campagne | Supprimer | Warning "Document utilisÃ©", confirmation requise |

---

### 3.8 EPIC-08 : Configuration & Administration

**Personas concernÃ©s** : Sophie (Admin config), Marc (Admin systÃ¨me)

#### TC-801 : Types d'OpÃ©ration

| ID        | ScÃ©nario      | PrÃ©conditions  | Actions                                           | RÃ©sultat Attendu                     | RG     |
| --------- | --------------- | ---------------- | ------------------------------------------------- | -------------------------------------- | ------ |
| TC-801-01 | CrÃ©ation type | Admin connectÃ© | CrÃ©er type "Migration PC" avec icÃ´ne + couleur | Type disponible dans dropdown campagne | RG-060 |

#### TC-802 : Champs PersonnalisÃ©s (V1)

| ID        | ScÃ©nario        | PrÃ©conditions | Actions                                           | RÃ©sultat Attendu                  | RG             |
| --------- | ----------------- | --------------- | ------------------------------------------------- | ----------------------------------- | -------------- |
| TC-802-01 | Ajout champ texte | Type existant   | Ajouter champ "RÃ©fÃ©rence SAP" (texte)         | Champ disponible lors import/saisie | RG-061, RG-015 |
| TC-802-02 | Champ date        | Type existant   | Ajouter champ "Date garantie" (date)              | Champ avec datepicker               | RG-061         |
| TC-802-03 | Champ liste       | Type existant   | Ajouter champ "ModÃ¨le" (choix: Dell, HP, Lenovo) | Dropdown dans formulaire            | RG-061         |

#### TC-804 : Historique Modifications (V1)

| ID        | ScÃ©nario             | PrÃ©conditions        | Actions              | RÃ©sultat Attendu                                         | RG     |
| --------- | ---------------------- | ---------------------- | -------------------- | ---------------------------------------------------------- | ------ |
| TC-804-01 | Audit trail            | OpÃ©ration modifiÃ©e | Voir historique      | Liste : date, utilisateur, champ, ancienne/nouvelle valeur | RG-070 |
| TC-804-02 | Filtre par utilisateur | Historique long        | Filtrer par "Sophie" | Seules modifs de Sophie                                    |        |

#### TC-806 : Export/Import Configuration (V1)

| ID        | ScÃ©nario    | PrÃ©conditions        | Actions                        | RÃ©sultat Attendu                    | RG     |
| --------- | ------------- | ---------------------- | ------------------------------ | ------------------------------------- | ------ |
| TC-806-01 | Export config | Config personnalisÃ©e | Exporter JSON                  | Fichier avec types, champs, templates | RG-100 |
| TC-806-02 | Import config | Fichier JSON export    | Importer sur nouvelle instance | Configuration restaurÃ©e             | RG-100 |

#### TC-807 : Profil Coordinateur (V1)

| ID        | ScÃ©nario              | PrÃ©conditions  | Actions                                     | RÃ©sultat Attendu                               | RG     |
| --------- | ----------------------- | ---------------- | ------------------------------------------- | ------------------------------------------------ | ------ |
| TC-807-01 | CrÃ©ation coordinateur | Admin connectÃ© | CrÃ©er utilisateur avec rÃ´le Coordinateur | Peut positionner agents sans lien hiÃ©rarchique | RG-114 |

#### TC-808 : Habilitations par Campagne (V1)

| ID        | ScÃ©nario             | PrÃ©conditions    | Actions                            | RÃ©sultat Attendu                 | RG     |
| --------- | ---------------------- | ------------------ | ---------------------------------- | ---------------------------------- | ------ |
| TC-808-01 | Habilitation lecture   | Campagne crÃ©Ã©e | Ajouter Direction en lecture seule | Direction voit mais ne modifie pas | RG-115 |
| TC-808-02 | Habilitation complÃ¨te | Campagne crÃ©Ã©e | Ajouter Sophie en Ã©dition        | Sophie peut modifier               | RG-115 |

---

### 3.9 EPIC-09 : PrÃ©requis & Segments

**Personas concernÃ©s** : Sophie (Gestionnaire)

#### TC-901 : PrÃ©requis Globaux (V1)

| ID        | ScÃ©nario              | PrÃ©conditions           | Actions                   | RÃ©sultat Attendu          | RG     |
| --------- | ----------------------- | ------------------------- | ------------------------- | --------------------------- | ------ |
| TC-901-01 | Affichage prÃ©requis   | Campagne avec prÃ©requis | Voir onglet "PrÃ©requis" | Liste avec statut (âœ“/âœ—) | RG-090 |
| TC-901-02 | Indicateur dÃ©claratif | PrÃ©requis non validÃ©  | Observer                  | Pas de blocage opÃ©rations | RG-090 |

#### TC-902 : Modifier PrÃ©requis Global (V1)

| ID        | ScÃ©nario             | PrÃ©conditions      | Actions                                | RÃ©sultat Attendu                           | RG     |
| --------- | ---------------------- | -------------------- | -------------------------------------- | -------------------------------------------- | ------ |
| TC-902-01 | Ajout prÃ©requis      | Campagne existante   | Ajouter "Commande matÃ©riel livrÃ©e" | PrÃ©requis visible avec statut initial "âŒ" | RG-090 |
| TC-902-02 | Validation prÃ©requis | PrÃ©requis existant | Cocher "ValidÃ©"                      | Statut â†’ "âœ“"                             | RG-090 |

#### TC-903/904 : PrÃ©requis par Segment (V1)

| ID        | ScÃ©nario          | PrÃ©conditions        | Actions                        | RÃ©sultat Attendu                  | RG     |
| --------- | ------------------- | ---------------------- | ------------------------------ | ----------------------------------- | ------ |
| TC-903-01 | PrÃ©requis segment | Segment "Site Central" | Ajouter "Salle serveur prÃªte" | PrÃ©requis spÃ©cifique au segment | RG-091 |

#### TC-905 : CrÃ©er/Modifier Segments

| ID        | ScÃ©nario           | PrÃ©conditions    | Actions                    | RÃ©sultat Attendu            |
| --------- | -------------------- | ------------------ | -------------------------- | ----------------------------- |
| TC-905-01 | CrÃ©ation segment   | Campagne existante | Ajouter segment "Ã‰tage 4" | Segment crÃ©Ã© avec couleur |
| TC-905-02 | Modification couleur | Segment existant   | Changer couleur            | Couleur mise Ã  jour partout  |

#### TC-906 : Progression par Segment

| ID        | ScÃ©nario       | PrÃ©conditions     | Actions             | RÃ©sultat Attendu                    |
| --------- | ---------------- | ------------------- | ------------------- | ------------------------------------- |
| TC-906-01 | DÃ©tail segment | Segment avec 50 ops | Cliquer sur segment | Progression dÃ©taillÃ©e + liste ops |

---

### 3.10 EPIC-10 : Interface RÃ©servation (End-Users)

**Personas concernÃ©s** : Agent ImpactÃ©, Manager MÃ©tier, Coordinateur

> âš ï¸ **TESTS CRITIQUES UX** â€” Parcours "type Doctolib", 3 clics max

#### TC-1001 : Voir CrÃ©neaux Disponibles (Agent)

| ID         | ScÃ©nario                  | PrÃ©conditions               | Actions                           | RÃ©sultat Attendu                       | RG     |
| ---------- | --------------------------- | ----------------------------- | --------------------------------- | ---------------------------------------- | ------ |
| TC-1001-01 | Affichage crÃ©neaux        | Agent dans population cible   | AccÃ©der interface rÃ©servation | Calendrier avec crÃ©neaux disponibles   | RG-120 |
| TC-1001-02 | Filtrage segment            | Agent segment "Site Central"  | Voir crÃ©neaux                   | Seuls crÃ©neaux de Site Central         | RG-120 |
| TC-1001-03 | CrÃ©neaux pleins masquÃ©s | CrÃ©neau capacitÃ© atteinte | Voir calendrier                   | CrÃ©neau non sÃ©lectionnable (grisÃ©) | -      |

#### TC-1002 : Se Positionner sur CrÃ©neau (Agent)

| ID         | ScÃ©nario              | PrÃ©conditions            | Actions                                     | RÃ©sultat Attendu                           | RG             |
| ---------- | ----------------------- | -------------------------- | ------------------------------------------- | -------------------------------------------- | -------------- |
| TC-1002-01 | RÃ©servation nominale  | Agent authentifiÃ©        | 1. SÃ©lectionner crÃ©neau<br>2. Confirmer | CrÃ©neau rÃ©servÃ©, email + ICS envoyÃ©s | RG-121, RG-122 |
| TC-1002-02 | UnicitÃ© rÃ©servation | Agent dÃ©jÃ  positionnÃ© | Tenter 2Ã¨me crÃ©neau                      | Erreur "Vous avez dÃ©jÃ  un crÃ©neau"      | RG-121         |
| TC-1002-03 | Parcours 3 clics        | Agent sur interface        | Compter clics jusqu'Ã  confirmation         | Maximum 3 clics                              | NFR-UX         |

#### TC-1003 : Annuler/Modifier CrÃ©neau (Agent)

| ID         | ScÃ©nario       | PrÃ©conditions           | Actions                      | RÃ©sultat Attendu                                  | RG     |
| ---------- | ---------------- | ------------------------- | ---------------------------- | --------------------------------------------------- | ------ |
| TC-1003-01 | Annulation       | CrÃ©neau rÃ©servÃ© J-5 | Annuler                      | CrÃ©neau libÃ©rÃ©, email confirmation            | RG-123 |
| TC-1003-02 | Modification     | CrÃ©neau rÃ©servÃ© J-5 | Modifier â†’ autre crÃ©neau | Nouveau crÃ©neau, nouvel ICS                       | RG-123 |
| TC-1003-03 | Verrouillage J-2 | CrÃ©neau rÃ©servÃ© J-1 | Tenter annuler               | Erreur "Modification impossible (verrouillage J-2)" | RG-123 |

#### TC-1004 : RÃ©capitulatif Agent (V1)

| ID         | ScÃ©nario        | PrÃ©conditions      | Actions                      | RÃ©sultat Attendu              |
| ---------- | ----------------- | -------------------- | ---------------------------- | ------------------------------- |
| TC-1004-01 | Affichage rÃ©cap | Agent avec crÃ©neau | AccÃ©der "Mon intervention" | Date, heure, lieu, instructions |

#### TC-1005 : Vue Ã‰quipe (Manager)

| ID         | ScÃ©nario            | PrÃ©conditions    | Actions                  | RÃ©sultat Attendu                            | RG     |
| ---------- | --------------------- | ------------------ | ------------------------ | --------------------------------------------- | ------ |
| TC-1005-01 | Liste agents          | Manager connectÃ© | AccÃ©der "Mon Ã©quipe" | Tableau agents avec statut (positionnÃ©/non) | RG-124 |
| TC-1005-02 | PÃ©rimÃ¨tre limitÃ© | Manager service A  | Voir Ã©quipe            | Seuls agents service A                        | RG-124 |

#### TC-1006 : Positionner Agent (Manager)

| ID         | ScÃ©nario     | PrÃ©conditions           | Actions                          | RÃ©sultat Attendu                         | RG             |
| ---------- | -------------- | ------------------------- | -------------------------------- | ------------------------------------------ | -------------- |
| TC-1006-01 | Positionnement | Manager sur vue Ã©quipe  | SÃ©lectionner agent + crÃ©neau | Agent positionnÃ©, notification envoyÃ©e | RG-125, RG-126 |
| TC-1006-02 | TraÃ§abilitÃ© | Positionnement effectuÃ© | Voir audit                       | "PositionnÃ© par [Manager]" enregistrÃ©  | RG-125         |

#### TC-1007 : Modifier/Annuler pour Agent (Manager)

| ID         | ScÃ©nario   | PrÃ©conditions    | Actions                   | RÃ©sultat Attendu             | RG     |
| ---------- | ------------ | ------------------ | ------------------------- | ------------------------------ | ------ |
| TC-1007-01 | Modification | Agent positionnÃ© | Manager modifie crÃ©neau | Nouvel ICS, notification agent | RG-126 |

#### TC-1008 : Alerte Concentration Ã‰quipe (V1)

| ID         | ScÃ©nario   | PrÃ©conditions        | Actions                | RÃ©sultat Attendu                           | RG     |
| ---------- | ------------ | ---------------------- | ---------------------- | -------------------------------------------- | ------ |
| TC-1008-01 | Warning >50% | 6/10 agents mÃªme jour | Voir dashboard manager | Alerte "Attention: concentration d'absences" | RG-127 |

#### TC-1010 : Positionner (Coordinateur) (V1)

| ID         | ScÃ©nario                | PrÃ©conditions         | Actions                         | RÃ©sultat Attendu                 | RG             |
| ---------- | ------------------------- | ----------------------- | ------------------------------- | ---------------------------------- | -------------- |
| TC-1010-01 | Positionnement transverse | Coordinateur habilitÃ© | Positionner agent autre service | Agent positionnÃ©, traÃ§abilitÃ© | RG-114, RG-125 |

#### TC-1011 : Auth Carte Agent (V1)

| ID         | ScÃ©nario      | PrÃ©conditions    | Actions             | RÃ©sultat Attendu           | RG     |
| ---------- | --------------- | ------------------ | ------------------- | ---------------------------- | ------ |
| TC-1011-01 | Connexion carte | Agent avec carte   | Badger              | Authentification automatique | RG-128 |
| TC-1011-02 | Fallback AD     | Carte non reconnue | Saisir login/mdp AD | Connexion via AD             | RG-128 |

---

### 3.11 EPIC-11 : Gestion des CrÃ©neaux & CapacitÃ©

**Personas concernÃ©s** : Sophie (Gestionnaire)

#### TC-1101 : CrÃ©er CrÃ©neaux

| ID         | ScÃ©nario          | PrÃ©conditions         | Actions                                              | RÃ©sultat Attendu      | RG     |
| ---------- | ------------------- | ----------------------- | ---------------------------------------------------- | ----------------------- | ------ |
| TC-1101-01 | CrÃ©ation manuelle | Campagne crÃ©Ã©e      | CrÃ©er crÃ©neau 14h-15h le 15/02                   | CrÃ©neau disponible    | RG-130 |
| TC-1101-02 | GÃ©nÃ©ration auto | Plage horaire dÃ©finie | GÃ©nÃ©rer crÃ©neaux 9h-17h (1h/slot) pour 5 jours | 40 crÃ©neaux crÃ©Ã©s | RG-130 |

#### TC-1102 : CapacitÃ© IT (V1)

| ID         | ScÃ©nario           | PrÃ©conditions        | Actions                             | RÃ©sultat Attendu                    | RG     |
| ---------- | -------------------- | ---------------------- | ----------------------------------- | ------------------------------------- | ------ |
| TC-1102-01 | DÃ©finir ressources | Configuration campagne | DÃ©finir 5 techniciens disponibles | CapacitÃ© calculÃ©e automatiquement | RG-131 |

#### TC-1103 : DurÃ©e Intervention (V1)

| ID         | ScÃ©nario      | PrÃ©conditions     | Actions                  | RÃ©sultat Attendu                          | RG     |
| ---------- | --------------- | ------------------- | ------------------------ | ------------------------------------------- | ------ |
| TC-1103-01 | Abaque par type | Type "Migration PC" | DÃ©finir durÃ©e 45 min | CrÃ©neaux gÃ©nÃ©rÃ©s avec cette durÃ©e | RG-132 |

#### TC-1104 : Modifier CrÃ©neau

| ID         | ScÃ©nario           | PrÃ©conditions    | Actions             | RÃ©sultat Attendu                       | RG     |
| ---------- | -------------------- | ------------------ | ------------------- | ---------------------------------------- | ------ |
| TC-1104-01 | Modification horaire | CrÃ©neau existant | Changer 14h â†’ 15h | CrÃ©neau mis Ã  jour, agents notifiÃ©s | RG-133 |

#### TC-1105 : Supprimer CrÃ©neau

| ID         | ScÃ©nario              | PrÃ©conditions              | Actions   | RÃ©sultat Attendu                      | RG     |
| ---------- | ----------------------- | ---------------------------- | --------- | --------------------------------------- | ------ |
| TC-1105-01 | Suppression vide        | CrÃ©neau sans rÃ©servation | Supprimer | CrÃ©neau supprimÃ©                    | RG-134 |
| TC-1105-02 | Suppression avec rÃ©sa | CrÃ©neau avec 3 agents      | Supprimer | Confirmation requise, agents notifiÃ©s | RG-134 |

#### TC-1106 : Taux de Remplissage

| ID         | ScÃ©nario     | PrÃ©conditions                | Actions                   | RÃ©sultat Attendu                              |
| ---------- | -------------- | ------------------------------ | ------------------------- | ----------------------------------------------- |
| TC-1106-01 | Affichage taux | CrÃ©neaux avec rÃ©servations | Voir dashboard crÃ©neaux | Taux global + par crÃ©neau (ex: "15/20 - 75%") |

#### TC-1107 : Verrouillage J-X (V1)

| ID         | ScÃ©nario          | PrÃ©conditions        | Actions                    | RÃ©sultat Attendu                       | RG     |
| ---------- | ------------------- | ---------------------- | -------------------------- | ---------------------------------------- | ------ |
| TC-1107-01 | Config verrouillage | Configuration campagne | DÃ©finir verrouillage J-3 | CrÃ©neaux non modifiables 3 jours avant | RG-123 |

#### TC-1108 : CrÃ©neaux par Segment (V1)

| ID         | ScÃ©nario          | PrÃ©conditions      | Actions                                               | RÃ©sultat Attendu                              | RG     |
| ---------- | ------------------- | -------------------- | ----------------------------------------------------- | ----------------------------------------------- | ------ |
| TC-1108-01 | Association segment | CrÃ©neaux existants | Associer crÃ©neaux 14h-16h au segment "Site Central" | Seuls agents Site Central voient ces crÃ©neaux | RG-135 |

---

### 3.12 EPIC-12 : Notifications & Agenda

**Personas concernÃ©s** : Agent ImpactÃ©, Manager MÃ©tier

#### TC-1201 : Email Confirmation avec ICS (V1)

| ID         | ScÃ©nario     | PrÃ©conditions     | Actions                 | RÃ©sultat Attendu                               | RG     |
| ---------- | -------------- | ------------------- | ----------------------- | ------------------------------------------------ | ------ |
| TC-1201-01 | Email envoyÃ© | Agent se positionne | Confirmer rÃ©servation | Email reÃ§u avec fichier .ics                    | RG-140 |
| TC-1201-02 | Contenu ICS    | Email reÃ§u         | Ouvrir .ics             | Ã‰vÃ©nement avec date, heure, lieu, description | RG-140 |
| TC-1201-03 | Import Outlook | Fichier .ics        | Double-clic             | Ã‰vÃ©nement ajoutÃ© au calendrier              | -      |

#### TC-1202 : Email Rappel J-2 (V1)

| ID         | ScÃ©nario        | PrÃ©conditions             | Actions            | RÃ©sultat Attendu    | RG     |
| ---------- | ----------------- | --------------------------- | ------------------ | --------------------- | ------ |
| TC-1202-01 | Envoi automatique | Agent positionnÃ© pour J+2 | Attendre J-2 Ã  9h | Email rappel envoyÃ© | RG-141 |

#### TC-1203 : Email Modification (V1)

| ID         | ScÃ©nario    | PrÃ©conditions                 | Actions        | RÃ©sultat Attendu                               | RG     |
| ---------- | ------------- | ------------------------------- | -------------- | ------------------------------------------------ | ------ |
| TC-1203-01 | Contenu email | Manager modifie crÃ©neau agent | Email envoyÃ© | Contient ancien crÃ©neau + nouveau + nouvel ICS | RG-142 |

#### TC-1204 : Email Annulation (V1)

| ID         | ScÃ©nario    | PrÃ©conditions    | Actions        | RÃ©sultat Attendu                            | RG     |
| ---------- | ------------- | ------------------ | -------------- | --------------------------------------------- | ------ |
| TC-1204-01 | Contenu email | CrÃ©neau annulÃ© | Email envoyÃ© | Contient lien vers interface repositionnement | RG-143 |

#### TC-1205 : Email Invitation Initiale

| ID         | ScÃ©nario   | PrÃ©conditions         | Actions             | RÃ©sultat Attendu                            | RG     |
| ---------- | ------------ | ----------------------- | ------------------- | --------------------------------------------- | ------ |
| TC-1205-01 | Mode Agent   | Campagne mode "Agent"   | Lancer inscriptions | Email envoyÃ© Ã  tous les agents de la liste | RG-144 |
| TC-1205-02 | Mode Manager | Campagne mode "Manager" | Lancer inscriptions | Email envoyÃ© aux managers                   | RG-144 |

---

## 4. Tests d'AccessibilitÃ© RGAA 4.1

### 4.1 CritÃ¨res Ã  Valider

| ThÃ©matique                 | CritÃ¨res                              | Outil de Test           |
| ---------------------------- | -------------------------------------- | ----------------------- |
| **Images**                   | Alternatives textuelles                | axe-core                |
| **Cadres**                   | Titres de frames                       | Manuel                  |
| **Couleurs**                 | Contraste 4.5:1 (texte), 3:1 (grand)   | Color Contrast Analyzer |
| **MultimÃ©dia**             | Sous-titres, audiodescription          | N/A (pas de vidÃ©o)    |
| **Tableaux**                 | EntÃªtes, structure                    | axe-core                |
| **Liens**                    | IntitulÃ©s explicites                 | axe-core                |
| **Scripts**                  | Alternatives, compatibilitÃ©          | Manuel + NVDA           |
| **Ã‰lÃ©ments obligatoires** | Langue, titre, validitÃ© HTML         | axe-core                |
| **Structuration**            | Titres, listes, landmarks              | axe-core                |
| **PrÃ©sentation**           | CSS dÃ©sactivable, espacement         | Manuel                  |
| **Formulaires**              | Labels, erreurs, regroupements         | axe-core                |
| **Navigation**               | Skip links, plan du site, fil d'Ariane | Manuel                  |
| **Consultation**             | DÃ©lais, contenus en mouvement        | Manuel                  |

### 4.2 ScÃ©narios de Test AccessibilitÃ©

| ID       | ScÃ©nario                   | Outil          | CritÃ¨re d'Acceptation                          | RG     |
| -------- | ---------------------------- | -------------- | ----------------------------------------------- | ------ |
| A11Y-001 | Navigation clavier complÃ¨te | Manuel + NVDA  | Tab/Shift+Tab sur tous Ã©lÃ©ments interactifs | RG-080 |
| A11Y-002 | Focus visible                | Manuel         | Indicateur focus min 2px                        | RG-081 |
| A11Y-003 | Boutons terrain 56px         | Manuel         | Taille min 56x56px mesurÃ©e                    | RG-082 |
| A11Y-004 | Checkboxes 48px              | Manuel         | Zone tactile 48x48px                            | RG-082 |
| A11Y-005 | Contraste texte              | CCA            | Ratio â‰¥4.5:1 (normal), â‰¥3:1 (grand)         | RG-083 |
| A11Y-006 | Contraste boutons            | CCA            | Ratio â‰¥3:1 (graphiques UI)                    | RG-083 |
| A11Y-007 | Lecteur d'Ã©cran            | NVDA + Firefox | Parcours Sophie complet vocalisÃ©              | RG-084 |
| A11Y-008 | Lecteur d'Ã©cran mobile     | VoiceOver iOS  | Parcours Karim vocalisÃ©                       | RG-084 |
| A11Y-009 | Zoom 200%                    | Firefox        | Interface utilisable sans scroll horizontal     | RG-085 |
| A11Y-010 | Mode sombre                  | Manuel         | Design tokens alternÃ©s, contraste maintenu    | -      |

### 4.3 Audit AutomatisÃ©

```bash
# Script d'audit axe-core
npx playwright test --grep @a11y

# Rapport Ara (si disponible)
ara audit --url http://localhost/dashboard --output report.html
```

---

## 5. Tests de Performance

### 5.1 Objectifs de Performance (NFR-PERF)

| MÃ©trique           | Cible       | Condition                                |
| -------------------- | ----------- | ---------------------------------------- |
| **Dashboard <500ms** | P95 < 500ms | 100k opÃ©rations, 50 users simultanÃ©s |
| **Import CSV**       | <30s        | 10k lignes sync, >10k async              |
| **Recherche**        | <200ms      | Index GIN sur JSONB                      |
| **Page liste**       | <300ms      | Pagination 50 lignes                     |

### 5.2 ScÃ©narios de Charge (k6)

```javascript
// k6/scenarios/dashboard_load.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // MontÃ©e Ã  10 users
    { duration: "1m", target: 50 }, // MontÃ©e Ã  50 users
    { duration: "2m", target: 50 }, // Plateau
    { duration: "30s", target: 0 }, // Descente
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% < 500ms
    http_req_failed: ["rate<0.01"], // <1% erreurs
  },
};

export default function () {
  // TC-PERF-001: Dashboard avec 100k ops
  const dashRes = http.get("http://localhost/campagne/1/dashboard");
  check(dashRes, {
    "dashboard status 200": (r) => r.status === 200,
    "dashboard < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);

  // TC-PERF-002: Liste opÃ©rations paginÃ©e
  const listRes = http.get("http://localhost/campagne/1/operations?page=1");
  check(listRes, {
    "list status 200": (r) => r.status === 200,
    "list < 300ms": (r) => r.timings.duration < 300,
  });

  sleep(2);
}
```

### 5.3 Cas de Test Performance

| ID       | ScÃ©nario             | Charge      | MÃ©triques          | Seuil         |
| -------- | ---------------------- | ----------- | -------------------- | ------------- |
| PERF-001 | Dashboard 100k ops     | 50 users    | Response time P95    | <500ms        |
| PERF-002 | Import CSV 100k lignes | 1 user      | Temps total          | <5min (async) |
| PERF-003 | Recherche JSONB        | 20 users    | Response time P95    | <200ms        |
| PERF-004 | Turbo Stream updates   | 100 ops/min | Latence              | <1s           |
| PERF-005 | Export CSV 10k         | 5 users     | Temps gÃ©nÃ©ration | <30s          |

---

## 6. Tests de SÃ©curitÃ©

### 6.1 Checklist OWASP Top 10

| #   | VulnÃ©rabilitÃ©         | Test                                      | CritÃ¨re                |
| --- | ------------------------- | ----------------------------------------- | ----------------------- |
| A01 | Broken Access Control     | Tenter accÃ¨s ressources non autorisÃ©es | 403 systÃ©matique      |
| A02 | Cryptographic Failures    | VÃ©rifier HTTPS, hachage mdp             | bcrypt, TLS 1.2+        |
| A03 | Injection                 | SQL injection sur recherche               | RequÃªtes prÃ©parÃ©es |
| A04 | Insecure Design           | Revue architecture                        | Voters Symfony          |
| A05 | Security Misconfiguration | Headers, expositions                      | CSP, X-Frame-Options    |
| A06 | Vulnerable Components     | Audit dÃ©pendances                       | 0 CVE critique          |
| A07 | Auth Failures             | Brute force, session fixation             | Rate limiting, rotation |
| A08 | Software & Data Integrity | CSRF tokens                               | Token sur tous POST     |
| A09 | Logging Failures          | Audit trail complet                       | auditor-bundle          |
| A10 | SSRF                      | Upload documents                          | Validation MIME         |

### 6.2 ScÃ©narios de Test SÃ©curitÃ©

| ID      | ScÃ©nario               | Actions                               | RÃ©sultat Attendu                |
| ------- | ------------------------ | ------------------------------------- | --------------------------------- |
| SEC-001 | AccÃ¨s non authentifiÃ© | GET /dashboard sans session           | Redirect /login                   |
| SEC-002 | AccÃ¨s Karim Ã  admin    | Karim tente GET /admin                | 403 Forbidden                     |
| SEC-003 | CSRF sur modification    | POST sans token CSRF                  | 403 Forbidden                     |
| SEC-004 | Injection SQL recherche  | Rechercher "'; DROP TABLE --"         | 0 rÃ©sultat, pas d'erreur        |
| SEC-005 | XSS dans commentaire     | InsÃ©rer `<script>alert(1)</script>` | Ã‰chappÃ© Ã  l'affichage         |
| SEC-006 | Brute force login        | 10 tentatives rapides                 | Rate limit aprÃ¨s 5               |
| SEC-007 | Session fixation         | Injecter session_id                   | Nouvelle session aprÃ¨s login     |
| SEC-008 | Upload malveillant       | Upload fichier.php.png                | RejetÃ© ou stockÃ© hors webroot |
| SEC-009 | IDOR opÃ©ration         | GET /operation/999 (autre campagne)   | 403 Forbidden                     |
| SEC-010 | Audit modification       | Modifier opÃ©ration                  | EntrÃ©e audit trail              |

---

## 7. Matrice de TraÃ§abilitÃ© Tests â†” Requirements

### 7.1 Couverture par EPIC

| EPIC    | US  | Tests Fonctionnels | Tests A11Y         | Tests Perf         | Tests SÃ©cu       |
| ------- | --- | ------------------ | ------------------ | ------------------ | ------------------ |
| EPIC-01 | 7   | TC-101 Ã  TC-107   | A11Y-001           | -                  | SEC-001 Ã  SEC-007 |
| EPIC-02 | 12  | TC-201 Ã  TC-212   | -                  | PERF-002           | SEC-003, SEC-004   |
| EPIC-03 | 9   | TC-301 Ã  TC-309   | -                  | PERF-001, PERF-003 | SEC-009            |
| EPIC-04 | 4   | TC-401 Ã  TC-404   | A11Y-003, A11Y-008 | -                  | -                  |
| EPIC-05 | 8   | TC-501 Ã  TC-507   | A11Y-004           | -                  | -                  |
| EPIC-06 | 8   | TC-601 Ã  TC-608   | A11Y-001, A11Y-009 | PERF-001, PERF-004 | -                  |
| EPIC-07 | 5   | TC-701 Ã  TC-704   | -                  | -                  | SEC-008, SEC-010   |
| EPIC-08 | 8   | TC-801 Ã  TC-808   | -                  | -                  | SEC-002            |
| EPIC-09 | 6   | TC-901 Ã  TC-906   | -                  | -                  | -                  |
| EPIC-10 | 12  | TC-1001 Ã  TC-1011 | A11Y-001           | -                  | SEC-001            |
| EPIC-11 | 8   | TC-1101 Ã  TC-1108 | -                  | -                  | -                  |
| EPIC-12 | 6   | TC-1201 Ã  TC-1205 | -                  | -                  | -                  |

### 7.2 Couverture RÃ¨gles MÃ©tier

| RG     | Description                 | Tests Couvrant       |
| ------ | --------------------------- | -------------------- |
| RG-001 | Authentification email/mdp  | TC-101-_, TC-107-_   |
| RG-005 | DÃ©sactivation utilisateur | TC-105-\*            |
| RG-006 | Verrouillage 5 Ã©checs     | TC-101-04, TC-101-05 |
| RG-010 | Workflow campagne           | TC-201-01            |
| RG-012 | Import CSV 100k             | TC-203-\*, PERF-002  |
| RG-017 | Workflow opÃ©ration        | TC-304-_, TC-403-_   |
| RG-040 | Dashboard temps rÃ©el      | TC-601-02, PERF-004  |
| RG-080 | AccessibilitÃ© clavier     | A11Y-001             |
| RG-082 | Cibles tactiles 48/56px     | A11Y-003, A11Y-004   |
| RG-121 | UnicitÃ© rÃ©servation     | TC-1002-02           |
| RG-122 | Email ICS                   | TC-1201-\*           |

---

## 8. CritÃ¨res d'Acceptation Globaux

### 8.1 CritÃ¨res GO/NO-GO par Phase

| Phase   | CritÃ¨res de Passage          | Seuil               |
| ------- | ----------------------------- | ------------------- |
| **MVP** | Tests fonctionnels EPIC 01-09 | 100% passants       |
|         | Couverture code               | â‰¥70%              |
|         | Tests A11Y auto               | 0 erreur axe-core   |
|         | Performance dashboard         | <500ms P95          |
| **V1**  | Tests fonctionnels complets   | 100% passants       |
|         | Couverture code               | â‰¥80%              |
|         | Audit RGAA                    | 100% critÃ¨res A+AA |
|         | Test charge 50 users          | <1% erreurs         |
|         | Audit sÃ©curitÃ©            | 0 critique OWASP    |

### 8.2 CritÃ¨res de Non-RÃ©gression

Tout nouveau dÃ©veloppement doit maintenir:

- 0 test existant cassÃ©
- Couverture â‰¥ couverture prÃ©cÃ©dente
- Performance â‰¤ +10% temps rÃ©ponse

---

## 9. Planning d'ExÃ©cution

### 9.1 Calendrier de Test

```mermaid
gantt
    title Planning Tests OpsTracker
    dateFormat YYYY-MM-DD

    section Tests Continus
    Tests unitaires (CI)           :active, 2026-01-20, 90d
    Tests intÃ©gration (CI)         :active, 2026-01-27, 83d

    section MVP
    Tests fonctionnels EPIC 01-04  :2026-02-10, 14d
    Tests fonctionnels EPIC 05-09  :2026-02-24, 14d
    Tests A11Y auto                :2026-03-10, 7d
    Tests perf baseline            :2026-03-17, 7d
    Recette MVP                    :milestone, 2026-03-24, 0d

    section V1
    Tests fonctionnels EPIC 10-12  :2026-03-24, 21d
    Audit RGAA complet             :2026-04-14, 14d
    Test charge V1                 :2026-04-21, 7d
    Audit sÃ©curitÃ©                 :2026-04-28, 7d
    Recette V1                     :milestone, 2026-05-05, 0d
```

### 9.2 RÃ´les et ResponsabilitÃ©s

| RÃ´le              | ResponsabilitÃ©                | Personne                        |
| ------------------ | ------------------------------- | ------------------------------- |
| **Test Lead**      | Coordination, reporting         | Alexandre (DSI)                 |
| **Dev Tests**      | Tests unitaires & intÃ©gration | Ã‰quipe dev                     |
| **QA Fonctionnel** | Tests E2E, scÃ©narios mÃ©tier | Sophie (rÃ©fÃ©rente mÃ©tier) |
| **Expert A11Y**    | Audit RGAA, NVDA                | Prestataire externe             |
| **Ops**            | Tests perf, sÃ©curitÃ©        | Marc (Admin)                    |

---

## 10. Annexes

### 10.1 Templates de Rapport de Test

```markdown
# Rapport de Test - [EPIC-XX] - [Date]

## RÃ©sumÃ© ExÃ©cution

- **Tests prÃ©vus**: XX
- **Tests exÃ©cutÃ©s**: XX
- **Passants**: XX (XX%)
- **Ã‰chouÃ©s**: XX (XX%)
- **BloquÃ©s**: XX

## Anomalies DÃ©tectÃ©es

| ID      | SÃ©vÃ©ritÃ© | Description | Statut |
| ------- | -------------- | ----------- | ------ |
| BUG-XXX | ðŸ”´ Bloquant  | ...         | Ouvert |

## Conclusion

[ ] GO pour phase suivante
[ ] NO-GO - corrections requises
```

### 10.2 Glossaire des Statuts de Test

| Statut              | IcÃ´ne | DÃ©finition                              |
| ------------------- | ------ | ----------------------------------------- |
| **Passant**         | âœ…    | RÃ©sultat conforme aux attentes          |
| **Ã‰chouÃ©**       | âŒ     | RÃ©sultat diffÃ©rent des attentes       |
| **BloquÃ©**        | â›”    | Impossible Ã  exÃ©cuter (prÃ©requis KO) |
| **Non exÃ©cutÃ©** | â¸ï¸   | PrÃ©vu mais pas encore testÃ©           |
| **Hors scope**      | âž–    | Exclu du pÃ©rimÃ¨tre de test             |

---

**Niveau de confiance : 95%**

_Les 5% d'incertitude portent sur : les scÃ©narios edge-case non documentÃ©s qui pourraient Ã©merger lors des tests exploratoires._

---

**Statut** : ðŸŸ¢ **PLAN DE TEST PRÃŠT POUR EXÃ‰CUTION**

| Ã‰lÃ©ment               | QuantitÃ© |
| ------------------------ | ---------- |
| Cas de test fonctionnels | ~150       |
| Cas de test A11Y         | 10         |
| Cas de test performance  | 5          |
| Cas de test sÃ©curitÃ© | 10         |

_Document produit par le framework BA-AI â€” Phase P5.1_
