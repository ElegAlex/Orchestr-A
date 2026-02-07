# P4.1 - Backlog & Requirements Fonctionnels (VERSION COMPLÃˆTE)

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ“ **BACKLOG PRODUIT (MVP & V1)** Ã‰tat du Backlog : **âœ… ValidÃ© â€” Complet et Exhaustif**
Niveau de confiance : **98%**
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

---

## 1. Vue d'ensemble (Epics)

Les Epics sont organisÃ©s selon les modules fonctionnels identifiÃ©s dans P3.4 et alignÃ©s sur le pÃ©rimÃ¨tre P2.3, **complÃ©tÃ©s par les besoins P1.3bis**.

| Epic             | Nom                                     | Persona Principal                 | Module P3.4   | Stories                 |
| ---------------- | --------------------------------------- | --------------------------------- | ------------- | ----------------------- |
| **EPIC-01**      | Authentification & Gestion Utilisateurs | Marc (Admin)                      | Users         | 7 US                    |
| **EPIC-02**      | CrÃ©ation & Gestion des Campagnes      | Sophie (Gestionnaire)             | Planning      | 8 US â†’ **12 US** ðŸ†• |
| **EPIC-03**      | Gestion des OpÃ©rations / Cibles       | Sophie (Gestionnaire)             | Planning      | 9 US                    |
| **EPIC-04**      | Interface Terrain                       | Karim (Technicien)                | Terrain       | 4 US                    |
| **EPIC-05**      | Checklists                              | Sophie + Karim                    | Checklists    | 8 US                    |
| **EPIC-06**      | Dashboard & Reporting                   | Sophie + Direction                | Dashboard     | 6 US â†’ **8 US** ðŸ†•  |
| **EPIC-07**      | Base Documentaire                       | Sophie                            | Docs          | 5 US                    |
| **EPIC-08**      | Configuration & Administration          | Sophie (Admin)                    | Config        | 6 US â†’ **8 US** ðŸ†•  |
| **EPIC-09**      | PrÃ©requis & Segments                  | Sophie                            | Planning      | 6 US                    |
| **EPIC-10** ðŸ†• | **Interface RÃ©servation (End-Users)** | Agent ImpactÃ©, Manager MÃ©tier | RÃ©servation | **12 US**               |
| **EPIC-11** ðŸ†• | **Gestion des CrÃ©neaux & CapacitÃ©** | Sophie (Gestionnaire)             | Planning      | **8 US**                |
| **EPIC-12** ðŸ†• | **Notifications & Agenda**              | Agent ImpactÃ©, Manager MÃ©tier | Notifications | **6 US**                |

**Total : 59 US â†’ 85 User Stories (+26 US)**

---

## 2. DÃ©tail des User Stories (Par Epic)

---

### ðŸ“¦ EPIC-01 : Authentification & Gestion Utilisateurs

_Source : P3.4 Wireframe 3.11, P1.3 Persona Marc_

#### US-101 : Se connecter Ã  l'application

**En tant que** utilisateur (Sophie, Karim, Marc) **Je veux** me connecter avec mon email et mot de passe **Afin de** accÃ©der Ã  l'espace correspondant Ã  mon rÃ´le

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** l'utilisateur est sur la page de connexion
  - **WHEN** il saisit un email et mot de passe valides
  - **THEN** il est redirigÃ© vers sa vue par dÃ©faut (Dashboard pour Admin/Gestionnaire, "Mes interventions" pour Technicien)
- [ ] **ScÃ©nario d'Erreur â€” Identifiants invalides** :
  - **GIVEN** l'utilisateur est sur la page de connexion
  - **WHEN** il saisit un email ou mot de passe incorrect
  - **THEN** le message "Identifiants incorrects" s'affiche en rouge, les champs restent remplis
- [ ] **ScÃ©nario Compte verrouillÃ©** ðŸ†• :
  - **GIVEN** l'utilisateur a Ã©chouÃ© 5 tentatives de connexion consÃ©cutives
  - **WHEN** il tente une 6Ã¨me connexion (mÃªme avec identifiants corrects)
  - **THEN** le message "Compte temporairement verrouillÃ©. RÃ©essayez dans 15 minutes." s'affiche
  - **AND** aprÃ¨s 15 minutes, le compteur est rÃ©initialisÃ©
- [ ] **ScÃ©nario Session** :
  - **GIVEN** l'utilisateur est connectÃ©
  - **WHEN** il ferme son navigateur et le rouvre
  - **THEN** il reste connectÃ© (cookie "remember me" actif par dÃ©faut)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-001, RG-006 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Header avec menu utilisateur

---

#### US-102 : Se dÃ©connecter de l'application

**En tant que** utilisateur connectÃ© **Je veux** me dÃ©connecter **Afin de** sÃ©curiser ma session sur un poste partagÃ©

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** l'utilisateur est connectÃ©
  - **WHEN** il clique sur son nom puis "DÃ©connexion"
  - **THEN** il est redirigÃ© vers la page de connexion, sa session est invalidÃ©e

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Menu utilisateur [Sophie â–¼]

---

#### US-103 : CrÃ©er un compte utilisateur (Admin)

**En tant que** Admin (Sophie/Marc) **Je veux** crÃ©er un compte utilisateur **Afin de** permettre Ã  un nouveau collaborateur d'accÃ©der Ã  OpsTracker

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** l'admin est sur la page "Gestion des utilisateurs"
  - **WHEN** il clique sur "+ Nouvel utilisateur", remplit le formulaire (prÃ©nom, nom, email, rÃ´le) et valide
  - **THEN** le compte est crÃ©Ã©, un email avec mot de passe temporaire est envoyÃ© Ã  l'utilisateur
- [ ] **ScÃ©nario d'Erreur â€” Email existant** :
  - **GIVEN** l'admin saisit un email dÃ©jÃ  utilisÃ©
  - **WHEN** il valide le formulaire
  - **THEN** le message "Cet email est dÃ©jÃ  utilisÃ©" s'affiche, le compte n'est pas crÃ©Ã©
- [ ] **ScÃ©nario RÃ´les** :
  - **GIVEN** l'admin crÃ©e un utilisateur
  - **WHEN** il sÃ©lectionne un rÃ´le (Admin, Gestionnaire, Technicien)
  - **THEN** l'utilisateur crÃ©Ã© aura les permissions correspondantes Ã  ce rÃ´le

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-002, RG-003 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.11

---

#### US-104 : Modifier un utilisateur (Admin)

**En tant que** Admin **Je veux** modifier les informations ou le rÃ´le d'un utilisateur **Afin de** adapter ses accÃ¨s Ã  son Ã©volution de poste

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** l'admin est sur la liste des utilisateurs
  - **WHEN** il clique sur [âœï¸] d'un utilisateur, modifie les champs et valide
  - **THEN** les modifications sont enregistrÃ©es, un toast "Utilisateur mis Ã  jour" confirme
- [ ] **ScÃ©nario Auto-protection** :
  - **GIVEN** l'admin Ã©dite son propre compte
  - **WHEN** il essaie de changer son rÃ´le vers Technicien
  - **THEN** le systÃ¨me refuse avec "Vous ne pouvez pas rÃ©trograder votre propre compte"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-004 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.11

---

#### US-105 : DÃ©sactiver un utilisateur (Admin)

**En tant que** Admin **Je veux** dÃ©sactiver un compte **Afin de** rÃ©voquer l'accÃ¨s d'un collaborateur parti sans perdre l'historique

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario DÃ©sactivation** :
  - **GIVEN** l'admin est sur la liste des utilisateurs
  - **WHEN** il dÃ©coche "Actif" pour un utilisateur et confirme
  - **THEN** l'utilisateur ne peut plus se connecter, son nom reste visible dans les historiques
- [ ] **ScÃ©nario RÃ©activation** :
  - **GIVEN** un utilisateur est dÃ©sactivÃ©
  - **WHEN** l'admin coche Ã  nouveau "Actif"
  - **THEN** l'utilisateur peut se reconnecter

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-005 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.11 checkbox "â˜‘ Actif"

---

#### US-106 : Voir les statistiques utilisateur (Admin)

**En tant que** Admin **Je veux** voir les statistiques d'un utilisateur (interventions assignÃ©es/rÃ©alisÃ©es, derniÃ¨re connexion) **Afin d'** Ã©valuer l'activitÃ© et identifier les comptes inactifs

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** l'admin ouvre le dÃ©tail d'un utilisateur
  - **WHEN** la page s'affiche
  - **THEN** il voit : Interventions assignÃ©es (X), Interventions rÃ©alisÃ©es (Y%), DerniÃ¨re connexion (date/heure ou "âš ï¸ Jamais")
- [ ] **ScÃ©nario Alerte inactivitÃ©** :
  - **GIVEN** un utilisateur ne s'est jamais connectÃ©
  - **WHEN** la liste s'affiche
  - **THEN** une icÃ´ne âš ï¸ apparaÃ®t Ã  cÃ´tÃ© de "Jamais"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.11 section "ðŸ“Š Statistiques"

---

#### US-107 : Modifier son propre mot de passe

**En tant que** utilisateur connectÃ© **Je veux** modifier mon mot de passe **Afin de** sÃ©curiser mon compte

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** l'utilisateur est sur "Mon profil"
  - **WHEN** il saisit l'ancien mot de passe, le nouveau (x2) et valide
  - **THEN** le mot de passe est changÃ©, un toast confirme, il reste connectÃ©
- [ ] **ScÃ©nario Erreur** :
  - **GIVEN** l'utilisateur saisit un ancien mot de passe incorrect
  - **WHEN** il valide
  - **THEN** le message "Ancien mot de passe incorrect" s'affiche

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-001 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

### ðŸ“¦ EPIC-02 : CrÃ©ation & Gestion des Campagnes

_Source : P3.4 Flow #1, Wireframes 3.1, 3.5, 3.6_

#### US-201 : Voir la liste des campagnes

**En tant que** Sophie (Gestionnaire/Admin) **Je veux** voir toutes les campagnes groupÃ©es par Ã©tat **Afin de** naviguer vers celle que je souhaite piloter

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie est connectÃ©e
  - **WHEN** elle accÃ¨de au menu "Campagnes"
  - **THEN** elle voit la liste groupÃ©e en "â–¼ Actives (X)", "â–¶ TerminÃ©es (Y)", "â–¶ ArchivÃ©es (Z)"
- [ ] **ScÃ©nario Indicateur** :
  - **GIVEN** une campagne a des opÃ©rations non terminÃ©es
  - **WHEN** la liste s'affiche
  - **THEN** elle apparaÃ®t dans "Actives" avec un indicateur â— bleu

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-010 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.5 sidebar gauche

---

#### US-202 : CrÃ©er une campagne â€” Ã‰tape 1/4 (Informations gÃ©nÃ©rales)

**En tant que** Sophie **Je veux** crÃ©er une nouvelle campagne avec ses informations de base **Afin de** structurer une nouvelle opÃ©ration

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie clique sur "+ Nouvelle campagne"
  - **WHEN** elle remplit : Nom*, Description, Type d'opÃ©ration*, Dates dÃ©but/fin\*
  - **THEN** elle peut passer Ã  l'Ã©tape 2 (Cibles)
- [ ] **ScÃ©nario Validation** :
  - **GIVEN** Sophie ne remplit pas un champ obligatoire (\*)
  - **WHEN** elle clique "Suivant"
  - **THEN** le message "Ce champ est obligatoire" s'affiche sous le champ concernÃ©

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-011 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.12 Ã©tape 1

---

#### US-203 : CrÃ©er une campagne â€” Ã‰tape 2/4 (Upload CSV)

**En tant que** Sophie **Je veux** uploader un fichier CSV contenant mes cibles **Afin de** ne pas saisir 847 lignes Ã  la main

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Upload drag & drop** :
  - **GIVEN** Sophie est sur l'Ã©tape 2
  - **WHEN** elle glisse-dÃ©pose un fichier CSV dans la zone
  - **THEN** le fichier est uploadÃ©, le systÃ¨me affiche un aperÃ§u des 10 premiÃ¨res lignes
- [ ] **ScÃ©nario Validation format** :
  - **GIVEN** Sophie uploade un fichier non-CSV
  - **WHEN** l'upload est tentÃ©
  - **THEN** le message "Format non supportÃ©. Utilisez un fichier .csv" s'affiche
- [ ] **ScÃ©nario Auto-dÃ©tection encodage** :
  - **GIVEN** le CSV est encodÃ© en UTF-8 ou ISO-8859-1
  - **WHEN** l'upload est terminÃ©
  - **THEN** le systÃ¨me dÃ©tecte automatiquement l'encodage et affiche correctement les accents

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-012, RG-013 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) â€” MVP = saisie manuelle ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.12 Ã©tape 2

---

#### US-204 : CrÃ©er une campagne â€” Ã‰tape 3/4 (Mapping colonnes)

**En tant que** Sophie **Je veux** mapper les colonnes de mon CSV vers les champs OpsTracker **Afin que** les donnÃ©es soient correctement importÃ©es

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Auto-mapping** :
  - **GIVEN** les colonnes CSV s'appellent "NOM_AGENT", "MATRICULE", "NUM_PC"
  - **WHEN** l'Ã©tape 3 s'affiche
  - **THEN** le systÃ¨me propose automatiquement le mapping avec indicateur "âœ“ Auto" (confiance haute)
- [ ] **ScÃ©nario Mapping manuel** :
  - **GIVEN** une colonne n'est pas reconnue (ex: "ETAGE")
  - **WHEN** Sophie la voit avec "âš ï¸ Manuel"
  - **THEN** elle peut choisir dans le dropdown le champ cible ou "â€” Ignorer â€”"
- [ ] **ScÃ©nario Validation prÃ©-import** :
  - **GIVEN** le mapping est terminÃ©
  - **WHEN** Sophie clique "Valider"
  - **THEN** le systÃ¨me affiche : "âœ… 844 lignes valides / âš ï¸ 3 avertissements / âŒ 0 erreurs"
- [ ] **ScÃ©nario Import avec erreurs (skip + log)** ðŸ†• :
  - **GIVEN** le CSV contient 847 lignes dont 3 avec erreurs (matricule invalide, champ obligatoire manquant)
  - **WHEN** Sophie clique "Valider et importer"
  - **THEN** les 844 lignes valides sont importÃ©es
  - **AND** les 3 lignes en erreur sont ignorÃ©es (skip)
  - **AND** un fichier de log est gÃ©nÃ©rÃ© avec dÃ©tail des erreurs : NÂ° ligne, champ concernÃ©, erreur
  - **AND** Sophie peut tÃ©lÃ©charger ce log pour corriger et rÃ©importer les lignes Ã©chouÃ©es
- [ ] **ScÃ©nario DÃ©tail erreurs** ðŸ†• :
  - **GIVEN** Sophie clique "[Voir dÃ©tail]" sur les 3 avertissements
  - **WHEN** la modal s'ouvre
  - **THEN** elle voit : Ligne 42 â€” Matricule "XYZ" invalide (format attendu: A + 5 chiffres)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-012, RG-014 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.12 section "MAPPING DES COLONNES"

---

#### US-205 : CrÃ©er une campagne â€” Ã‰tape 4/4 (Workflow & Template)

**En tant que** Sophie **Je veux** associer un workflow et un template de checklist Ã  ma campagne **Afin que** mes opÃ©rations soient structurÃ©es dÃ¨s le dÃ©part

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie est sur l'Ã©tape 4
  - **WHEN** elle sÃ©lectionne un workflow (dÃ©faut ou personnalisÃ©) et un template de checklist
  - **THEN** elle peut finaliser la crÃ©ation de campagne
- [ ] **ScÃ©nario Sans checklist** :
  - **GIVEN** Sophie ne sÃ©lectionne pas de template
  - **WHEN** elle finalise
  - **THEN** la campagne est crÃ©Ã©e, les opÃ©rations n'auront pas de checklist associÃ©e

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-014 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) â€” MVP = workflow fixe + template statique ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.12 Ã©tape 4

---

#### US-206 : Ajouter une opÃ©ration manuellement

**En tant que** Sophie **Je veux** ajouter une opÃ©ration manuellement (sans CSV) **Afin d'** ajouter des cibles au fil de l'eau ou pour le pilote MVP

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie est sur la liste des opÃ©rations d'une campagne
  - **WHEN** elle clique "+ Ajouter intervention" et remplit le formulaire
  - **THEN** l'opÃ©ration est crÃ©Ã©e avec statut "Ã€ planifier"
- [ ] **ScÃ©nario Champs JSONB** :
  - **GIVEN** le type d'opÃ©ration a des champs personnalisÃ©s (Matricule, Poste, Bureau)
  - **WHEN** Sophie crÃ©e l'opÃ©ration
  - **THEN** elle doit renseigner ces champs (obligatoires ou optionnels selon config)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-014, RG-015 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) â€” MÃ©thode principale MVP ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.5 bouton "+ Ajouter intervention"

---

#### US-207 : Archiver/DÃ©sarchiver une campagne

**En tant que** Sophie **Je veux** archiver une campagne terminÃ©e **Afin de** la masquer de ma vue quotidienne tout en conservant l'historique

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Archivage** :
  - **GIVEN** Sophie est sur une campagne terminÃ©e
  - **WHEN** elle clique "Archiver"
  - **THEN** la campagne passe dans "ArchivÃ©es", devient lecture seule
- [ ] **ScÃ©nario DÃ©sarchivage** :
  - **GIVEN** Sophie ouvre une campagne archivÃ©e
  - **WHEN** elle clique "DÃ©sarchiver"
  - **THEN** la campagne redevient modifiable et passe dans "Actives" ou "TerminÃ©es"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-016 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.5 sidebar "â–¶ ArchivÃ©es"

---

#### US-208 : Dupliquer une campagne ðŸ†•

**En tant que** Sophie **Je veux** dupliquer une campagne existante **Afin de** rÃ©utiliser la configuration (type, segments, template checklist) pour une nouvelle opÃ©ration similaire

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie est sur une campagne existante
  - **WHEN** elle clique "â§‰ Dupliquer"
  - **THEN** une nouvelle campagne est crÃ©Ã©e avec : mÃªme type, mÃªmes segments, mÃªme template checklist, MAIS sans les opÃ©rations
- [ ] **ScÃ©nario Nom unique** :
  - **GIVEN** la campagne source s'appelle "Migration W11"
  - **WHEN** elle est dupliquÃ©e
  - **THEN** le nom proposÃ© est "Migration W11 (copie)" et est modifiable

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¢ COULD (V2) ðŸ”— **Lien Maquette** : â€”

---

#### US-209 ðŸ†• : Configurer le mode d'inscription d'une campagne

**En tant que** Sophie (Gestionnaire) **Je veux** dÃ©finir qui peut positionner les agents sur les crÃ©neaux **Afin de** adapter le fonctionnement aux pratiques de chaque organisation/service

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Configuration** :
  - **GIVEN** Sophie crÃ©e ou Ã©dite une campagne
  - **WHEN** elle accÃ¨de Ã  l'onglet "Mode d'inscription"
  - **THEN** elle peut choisir parmi :
    - â—‹ Mode Agent : les agents s'inscrivent eux-mÃªmes
    - â—‹ Mode Manager : seuls les managers positionnent leurs agents
    - â—‹ Mode Liste : une liste spÃ©cifique d'utilisateurs habilitÃ©s
    - â—‹ Mode Mixte : agents ET managers selon habilitations
- [ ] **ScÃ©nario Mode Agent** :
  - **GIVEN** Sophie sÃ©lectionne "Mode Agent"
  - **WHEN** la campagne est lancÃ©e
  - **THEN** tous les agents concernÃ©s reÃ§oivent une invitation Ã  se positionner
- [ ] **ScÃ©nario Mode Manager** :
  - **GIVEN** Sophie sÃ©lectionne "Mode Manager"
  - **WHEN** la campagne est lancÃ©e
  - **THEN** seuls les managers voient l'interface de positionnement, les agents ne peuvent pas s'inscrire eux-mÃªmes
- [ ] **ScÃ©nario Mode Liste** :
  - **GIVEN** Sophie sÃ©lectionne "Mode Liste"
  - **WHEN** elle configure le mode
  - **THEN** elle peut sÃ©lectionner une liste d'utilisateurs habilitÃ©s (coordinateurs, assistants, etc.)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-110 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) â€” Requis pour interface rÃ©servation ðŸ”— **Lien Maquette** : â€”

---

#### US-210 ðŸ†• : DÃ©finir le propriÃ©taire d'une campagne

**En tant que** Sophie (Gestionnaire) **Je veux** dÃ©finir qui est propriÃ©taire de la campagne **Afin de** contrÃ´ler la visibilitÃ© et les droits de modification

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario PropriÃ©taire par dÃ©faut** :
  - **GIVEN** Sophie crÃ©e une campagne
  - **WHEN** la campagne est crÃ©Ã©e
  - **THEN** Sophie est automatiquement propriÃ©taire
- [ ] **ScÃ©nario Transfert propriÃ©tÃ©** :
  - **GIVEN** Sophie est propriÃ©taire d'une campagne
  - **WHEN** elle clique "TransfÃ©rer la propriÃ©tÃ©" et sÃ©lectionne un autre gestionnaire
  - **THEN** ce gestionnaire devient propriÃ©taire, Sophie perd les droits de propriÃ©tÃ©

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-111 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-211 ðŸ†• : Configurer la visibilitÃ© d'une campagne

**En tant que** Sophie (Gestionnaire propriÃ©taire) **Je veux** dÃ©finir qui peut voir ma campagne **Afin de** cloisonner les campagnes DSI et SIRH par exemple

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario VisibilitÃ© par dÃ©faut** :
  - **GIVEN** Sophie crÃ©e une campagne
  - **WHEN** la campagne est crÃ©Ã©e
  - **THEN** seuls le propriÃ©taire et les utilisateurs habilitÃ©s peuvent la voir
- [ ] **ScÃ©nario Ajout visibilitÃ©** :
  - **GIVEN** Sophie est propriÃ©taire d'une campagne
  - **WHEN** elle accÃ¨de Ã  "Partage & VisibilitÃ©"
  - **THEN** elle peut ajouter des utilisateurs ou groupes qui verront la campagne
- [ ] **ScÃ©nario Cloisonnement** :
  - **GIVEN** une campagne SIRH est visible uniquement pour le groupe SIRH
  - **WHEN** un utilisateur DSI se connecte
  - **THEN** il ne voit pas cette campagne dans sa liste

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-112 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-212 ðŸ†• : DÃ©finir la population cible d'une campagne

**En tant que** Sophie (Gestionnaire) **Je veux** dÃ©finir la liste des agents concernÃ©s par la campagne **Afin que** seuls ces agents puissent se positionner (ou Ãªtre positionnÃ©s)

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Import population** :
  - **GIVEN** Sophie configure une campagne
  - **WHEN** elle importe un CSV avec la liste des agents (matricule, nom, service, manager)
  - **THEN** ces agents constituent la population cible de la campagne
- [ ] **ScÃ©nario VÃ©rification positionnement** :
  - **GIVEN** un agent tente de se positionner
  - **WHEN** il n'est pas dans la population cible
  - **THEN** le message "Vous n'Ãªtes pas concernÃ© par cette campagne" s'affiche

## âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-113 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : â€”

### ðŸ“¦ EPIC-03 : Gestion des OpÃ©rations / Cibles

_Source : P3.4 Wireframes 3.5, 3.6_

#### US-301 : Voir la liste des opÃ©rations (vue tableau)

**En tant que** Sophie **Je veux** voir toutes les opÃ©rations d'une campagne en vue tableau **Afin de** avoir une vision d'ensemble et Ã©diter en masse

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie ouvre une campagne
  - **WHEN** elle clique sur "â‰¡ Liste"
  - **THEN** elle voit un tableau avec colonnes : Statut, Nom, Matricule, Poste, Bureau, Technicien, Checklist (x/y)
- [ ] **ScÃ©nario Groupement par segment** :
  - **GIVEN** la campagne a des segments (BÃ¢t. A, B, C)
  - **WHEN** la liste s'affiche
  - **THEN** les opÃ©rations sont groupÃ©es par segment avec en-tÃªte "â€” BÃ‚TIMENT A (312 interventions) â€” 89%"
- [ ] **ScÃ©nario Pagination par segment** :
  - **GIVEN** un segment a 312 opÃ©rations
  - **WHEN** Sophie consulte ce segment
  - **THEN** une pagination affiche "1-50 sur 312" avec navigation

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-080 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.5

---

#### US-302 : Voir la liste des opÃ©rations (vue cards)

**En tant que** Sophie **Je veux** voir les opÃ©rations en vue cartes **Afin de** avoir un aperÃ§u visuel plus compact, adaptÃ© mobile

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie est sur la liste des opÃ©rations
  - **WHEN** elle clique sur "â–¦ Cards"
  - **THEN** chaque opÃ©ration est affichÃ©e en carte avec : statut (bande couleur), nom, infos clÃ©s, technicien assignÃ©, progression checklist
- [ ] **ScÃ©nario Ã‰dition inline** :
  - **GIVEN** Sophie voit une carte
  - **WHEN** elle clique sur le dropdown statut ou technicien
  - **THEN** elle peut modifier directement sans ouvrir de modal

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-080 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.6

---

#### US-303 : Filtrer les opÃ©rations

**En tant que** Sophie **Je veux** filtrer les opÃ©rations par statut, segment, technicien **Afin de** trouver rapidement ce que je cherche

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Filtre unique** :
  - **GIVEN** Sophie est sur la liste des opÃ©rations
  - **WHEN** elle sÃ©lectionne "Statut = ReportÃ©"
  - **THEN** seules les opÃ©rations avec statut "ReportÃ©" s'affichent
- [ ] **ScÃ©nario Filtres combinÃ©s** :
  - **GIVEN** Sophie filtre "Statut = PlanifiÃ©" ET "Tech = Karim"
  - **WHEN** les filtres sont appliquÃ©s
  - **THEN** seules les opÃ©rations planifiÃ©es assignÃ©es Ã  Karim s'affichent
- [ ] **ScÃ©nario Compteur filtrÃ©** :
  - **GIVEN** 52 opÃ©rations sont filtrÃ©es sur 847 totales
  - **WHEN** le filtre est actif
  - **THEN** le compteur affiche "52 rÃ©sultats (sur 847)"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.5 section "FILTRES & ACTIONS"

---

#### US-304 : Modifier le statut d'une opÃ©ration (Ã©dition inline)

**En tant que** Sophie **Je veux** changer le statut d'une opÃ©ration directement dans le tableau **Afin de** corriger ou ajuster sans navigation supplÃ©mentaire

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie voit une opÃ©ration avec statut "PlanifiÃ©"
  - **WHEN** elle clique sur le dropdown [â— Planâ–¼] et sÃ©lectionne "En cours"
  - **THEN** le statut change instantanÃ©ment, la cellule affiche [âŸ³ En câ–¼], un feedback visuel confirme
- [ ] **ScÃ©nario Transitions autorisÃ©es** :
  - **GIVEN** une opÃ©ration est "Ã€ planifier"
  - **WHEN** Sophie ouvre le dropdown
  - **THEN** seules les transitions autorisÃ©es sont proposÃ©es (PlanifiÃ©)
- [ ] **ScÃ©nario Sauvegarde auto** :
  - **GIVEN** Sophie change un statut
  - **WHEN** le changement est effectuÃ©
  - **THEN** la modification est sauvegardÃ©e immÃ©diatement (Turbo Streams), pas de bouton "Enregistrer"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-017, RG-080 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.5 cellule "[âœ“ RÃ©alâ–¼]"

---

#### US-305 : Trier les colonnes du tableau

**En tant que** Sophie **Je veux** trier les opÃ©rations par colonne **Afin d'** organiser ma vue selon mes besoins

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Tri ASC** :
  - **GIVEN** Sophie est sur le tableau des opÃ©rations
  - **WHEN** elle clique sur l'en-tÃªte "NOM"
  - **THEN** les opÃ©rations sont triÃ©es par nom Aâ†’Z, une flÃ¨che â–² indique le tri
- [ ] **ScÃ©nario Tri DESC** :
  - **GIVEN** le tri est ASC sur "NOM"
  - **WHEN** Sophie clique Ã  nouveau sur "NOM"
  - **THEN** le tri passe DESC (Zâ†’A), la flÃ¨che devient â–¼

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.5 en-tÃªtes de colonnes

---

#### US-306 : Assigner un technicien Ã  une opÃ©ration

**En tant que** Sophie **Je veux** assigner un technicien Ã  une opÃ©ration **Afin de** dispatcher le travail

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Assignation** :
  - **GIVEN** Sophie voit une opÃ©ration non assignÃ©e
  - **WHEN** elle clique sur le dropdown technicien et sÃ©lectionne "Karim"
  - **THEN** l'assignation est enregistrÃ©e, Karim verra cette opÃ©ration dans "Mes interventions"
- [ ] **ScÃ©nario RÃ©assignation** :
  - **GIVEN** une opÃ©ration est assignÃ©e Ã  Luc
  - **WHEN** Sophie change pour Karim
  - **THEN** Luc ne voit plus l'opÃ©ration, Karim la voit
- [ ] **ScÃ©nario DÃ©sassignation** :
  - **GIVEN** une opÃ©ration est assignÃ©e
  - **WHEN** Sophie sÃ©lectionne "â€” Non assignÃ© â€”"
  - **THEN** l'opÃ©ration apparaÃ®t dans aucune vue technicien

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-018 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.5 colonne "TECH" [Karâ–¼]

---

#### US-307 : Exporter les opÃ©rations ðŸ†•

**En tant que** Sophie **Je veux** exporter la liste des opÃ©rations en CSV ou Excel **Afin de** partager ou analyser les donnÃ©es hors OpsTracker

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Export complet** :
  - **GIVEN** Sophie est sur la liste des opÃ©rations
  - **WHEN** elle clique sur [ðŸ“¤ Exporter] et choisit "CSV"
  - **THEN** un fichier CSV est tÃ©lÃ©chargÃ© avec toutes les colonnes visibles
- [ ] **ScÃ©nario Export filtrÃ©** :
  - **GIVEN** Sophie a un filtre actif (Statut = ReportÃ©)
  - **WHEN** elle exporte
  - **THEN** seules les opÃ©rations filtrÃ©es sont exportÃ©es
- [ ] **ScÃ©nario Format Excel** :
  - **GIVEN** Sophie choisit "Excel (.xlsx)"
  - **WHEN** l'export est lancÃ©
  - **THEN** le fichier Excel est gÃ©nÃ©rÃ© avec mise en forme (en-tÃªtes gras, couleurs statuts)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.5 bouton [ðŸ“¤ Exporter]

---

#### US-308 : Rechercher une opÃ©ration (globale) ðŸ†•

**En tant que** Sophie **Je veux** rechercher une opÃ©ration par nom, matricule ou poste **Afin de** trouver rapidement une cible spÃ©cifique

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Recherche par nom** :
  - **GIVEN** Sophie tape "MARTIN" dans la barre de recherche
  - **WHEN** elle appuie EntrÃ©e
  - **THEN** les opÃ©rations contenant "MARTIN" dans le nom sont affichÃ©es
- [ ] **ScÃ©nario Recherche multi-champs** :
  - **GIVEN** Sophie cherche "PC-0156"
  - **WHEN** les rÃ©sultats s'affichent
  - **THEN** les opÃ©rations avec ce numÃ©ro de poste apparaissent
- [ ] **ScÃ©nario Cross-campagne** :
  - **GIVEN** Sophie est sur le dashboard global
  - **WHEN** elle recherche "PETIT Marc"
  - **THEN** les rÃ©sultats incluent toutes les campagnes oÃ¹ ce nom apparaÃ®t

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Header [ðŸ” Rechercher...]

---

#### US-309 : Supprimer une opÃ©ration

**En tant que** Sophie **Je veux** supprimer une opÃ©ration crÃ©Ã©e par erreur **Afin de** corriger mes donnÃ©es

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Suppression** :
  - **GIVEN** Sophie sÃ©lectionne une opÃ©ration
  - **WHEN** elle clique "ðŸ—‘ï¸ Supprimer" et confirme
  - **THEN** l'opÃ©ration est supprimÃ©e, les compteurs se mettent Ã  jour
- [ ] **ScÃ©nario Protection** :
  - **GIVEN** une opÃ©ration a un statut "RÃ©alisÃ©" avec checklist complÃ©tÃ©e
  - **WHEN** Sophie tente de la supprimer
  - **THEN** un avertissement demande double confirmation "Cette opÃ©ration a Ã©tÃ© rÃ©alisÃ©e. Supprimer dÃ©finitivement ?"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

### ðŸ“¦ EPIC-04 : Interface Terrain (Karim)

_Source : P3.4 Flow #2, Wireframes 3.2, 3.3, P1.3 critÃ¨res UX Karim_

#### US-401 : Voir "Mes interventions" (vue filtrÃ©e par dÃ©faut)

**En tant que** Karim (Technicien) **Je veux** voir directement mes interventions assignÃ©es Ã  ma connexion **Afin de** savoir quoi faire aujourd'hui sans chercher

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Connexion** :
  - **GIVEN** Karim se connecte
  - **WHEN** la page d'accueil s'affiche
  - **THEN** il arrive sur "Mes interventions" filtrÃ© automatiquement sur ses assignations
- [ ] **ScÃ©nario Liste priorisÃ©e** :
  - **GIVEN** Karim a 5 interventions aujourd'hui
  - **WHEN** la liste s'affiche
  - **THEN** elles sont triÃ©es par heure planifiÃ©e (prochaine en premier), avec la plus proche mise en avant (bordure Ã©paisse)
- [ ] **ScÃ©nario Informations carte** :
  - **GIVEN** une carte intervention s'affiche
  - **WHEN** Karim la consulte
  - **THEN** il voit : Heure, Nom utilisateur, Ã‰quipement, Localisation, TÃ©lÃ©phone, Statut (bande couleur + icÃ´ne + texte), Progression checklist (x/y Ã©tapes)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-020, RG-080, RG-082 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.2

---

#### US-402 : Ouvrir le dÃ©tail d'une intervention

**En tant que** Karim **Je veux** ouvrir le dÃ©tail d'une intervention **Afin de** voir toutes les informations et la checklist associÃ©e

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Ouverture** :
  - **GIVEN** Karim est sur "Mes interventions"
  - **WHEN** il clique sur une carte
  - **THEN** le dÃ©tail s'ouvre avec : Informations complÃ¨tes (utilisateur, Ã©quipement, localisation, contact), Checklist avec progression

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.3

---

#### US-403 : Changer le statut en 1 clic

**En tant que** Karim **Je veux** changer le statut de mon intervention en un seul clic **Afin de** reporter mon avancement sans friction

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario "Commencer"** :
  - **GIVEN** Karim est sur le dÃ©tail d'une intervention "PlanifiÃ©"
  - **WHEN** il clique [â–¶ï¸ COMMENCER] (bouton 56px)
  - **THEN** le statut passe Ã  "En cours", le bouton devient [âœ“ TERMINER]
- [ ] **ScÃ©nario "Terminer"** :
  - **GIVEN** l'intervention est "En cours"
  - **WHEN** Karim clique [âœ“ TERMINER]
  - **THEN** le statut passe Ã  "RÃ©alisÃ©", animation check vert, retour automatique Ã  la liste
- [ ] **ScÃ©nario "Reporter"** :
  - **GIVEN** Karim clique [âŸ³ Reporter]
  - **WHEN** une modale s'ouvre proposant un motif (optionnel)
  - **THEN** aprÃ¨s validation (avec ou sans motif), le statut passe Ã  "ReportÃ©"
- [ ] **ScÃ©nario Synchro temps rÃ©el** :
  - **GIVEN** Karim change un statut
  - **WHEN** Sophie consulte le dashboard
  - **THEN** le compteur est mis Ã  jour instantanÃ©ment (Turbo Streams)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-017, RG-021, RG-082 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.3 boutons 56px

---

#### US-404 : Retour automatique aprÃ¨s action

**En tant que** Karim **Je veux** revenir automatiquement Ã  ma liste aprÃ¨s avoir terminÃ© une intervention **Afin de** enchaÃ®ner sans navigation manuelle

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Retour auto** :
  - **GIVEN** Karim termine une intervention (statut â†’ RÃ©alisÃ©)
  - **WHEN** l'action est confirmÃ©e
  - **THEN** aprÃ¨s 1.5 secondes (temps de voir le feedback), il revient Ã  "Mes interventions"
- [ ] **ScÃ©nario Prochaine intervention** :
  - **GIVEN** Karim a d'autres interventions
  - **WHEN** il revient Ã  la liste
  - **THEN** la prochaine intervention est mise en avant (bordure Ã©paisse)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.2 "Prochaine intervention mise en avant"

---

### ðŸ“¦ EPIC-05 : Checklists

_Source : P3.4 Flow #4, Wireframes 3.3, 3.4, 3.8_

#### US-501 : Cocher une Ã©tape de checklist

**En tant que** Karim **Je veux** cocher les Ã©tapes de ma checklist au fur et Ã  mesure **Afin de** suivre ma progression et ne rien oublier

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Cocher** :
  - **GIVEN** Karim est sur le dÃ©tail d'une intervention avec checklist
  - **WHEN** il clique sur la case [ ] d'une Ã©tape (48x48px minimum)
  - **THEN** la case devient [âœ“], la barre de progression se met Ã  jour (ex: 4/8 Ã©tapes)
- [ ] **ScÃ©nario DÃ©cocher** :
  - **GIVEN** une Ã©tape est cochÃ©e
  - **WHEN** Karim clique Ã  nouveau dessus
  - **THEN** elle se dÃ©coche (retour Ã  [ ])
- [ ] **ScÃ©nario Synchro** :
  - **GIVEN** Karim coche une Ã©tape
  - **WHEN** Sophie consulte le dashboard
  - **THEN** la progression est mise Ã  jour instantanÃ©ment

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-082 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.3 section "CHECKLIST"

---

#### US-502 : Voir la progression de la checklist

**En tant que** Karim / Sophie **Je veux** voir la progression globale de la checklist **Afin de** savoir oÃ¹ j'en suis / oÃ¹ en est l'intervention

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Barre de progression** :
  - **GIVEN** une checklist a 3 Ã©tapes cochÃ©es sur 8
  - **WHEN** le dÃ©tail s'affiche
  - **THEN** une barre de progression affiche "â–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘ 3/8 Ã©tapes"
- [ ] **ScÃ©nario Indicateur liste** :
  - **GIVEN** Sophie voit la liste des opÃ©rations
  - **WHEN** une opÃ©ration a une checklist
  - **THEN** la colonne affiche "ðŸ“‹ 3/8" (cliquable pour voir le dÃ©tail)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.3 barre de progression

---

#### US-503 : CrÃ©er un template de checklist (Sophie)

**En tant que** Sophie **Je veux** crÃ©er un template de checklist rÃ©utilisable **Afin de** standardiser les procÃ©dures pour mes techniciens

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario CrÃ©ation** :
  - **GIVEN** Sophie accÃ¨de Ã  "Templates de checklists"
  - **WHEN** elle clique "+ Nouveau template", saisit un nom et ajoute des Ã©tapes
  - **THEN** le template est crÃ©Ã© en version 1, statut "Brouillon"
- [ ] **ScÃ©nario Ajout Ã©tape** :
  - **GIVEN** Sophie Ã©dite un template
  - **WHEN** elle clique "+ Ajouter une Ã©tape"
  - **THEN** elle peut saisir : LibellÃ©, Description (optionnelle), Document liÃ© (optionnel)
- [ ] **ScÃ©nario RÃ©organisation** :
  - **GIVEN** un template a plusieurs Ã©tapes
  - **WHEN** Sophie glisse-dÃ©pose une Ã©tape (â‹®â‹®)
  - **THEN** l'ordre des Ã©tapes change

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-030 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) â€” template statique ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.8

---

#### US-504 : Modifier un template avec versioning (Snapshot Pattern)

**En tant que** Sophie **Je veux** modifier un template sans impacter les checklists en cours **Afin de** amÃ©liorer mes procÃ©dures sans casser le travail en cours

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Avertissement** :
  - **GIVEN** Sophie ouvre un template actif (ex: "Migration Windows 11 v3")
  - **WHEN** la page s'affiche
  - **THEN** un bandeau avertit "âš ï¸ Ce template est utilisÃ© par 234 checklists. La modification crÃ©era la v4."
- [ ] **ScÃ©nario Nouvelle version** :
  - **GIVEN** Sophie modifie le template et clique "ðŸ’¾ Enregistrer"
  - **WHEN** la sauvegarde est effectuÃ©e
  - **THEN** une v4 est crÃ©Ã©e, les 234 checklists existantes conservent leur structure v3
- [ ] **ScÃ©nario Nouvelles instances** :
  - **GIVEN** la v4 est la version active
  - **WHEN** une nouvelle opÃ©ration est crÃ©Ã©e
  - **THEN** elle utilise automatiquement la v4

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-031 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) â€” MVP = templates non modifiables ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.8 bandeau "âš ï¸ Modification = v4"

---

#### US-505 : CrÃ©er des phases dans un template (V1)

**En tant que** Sophie **Je veux** organiser mes Ã©tapes en phases **Afin de** structurer les checklists complexes

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Ajout phase** :
  - **GIVEN** Sophie Ã©dite un template
  - **WHEN** elle clique "+ Ajouter une nouvelle phase"
  - **THEN** une section vide "PHASE N" est crÃ©Ã©e, elle peut la renommer
- [ ] **ScÃ©nario Verrouillage sÃ©quentiel** :
  - **GIVEN** Sophie configure une phase avec "â˜‘ Verrouiller tant que la prÃ©cÃ©dente n'est pas complÃ¨te"
  - **WHEN** Karim utilise la checklist
  - **THEN** les Ã©tapes de cette phase sont grisÃ©es/non-cliquables tant que la phase prÃ©cÃ©dente n'est pas Ã  100%

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-032 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) â€” MVP = phase unique ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.3 "â–¼ PHASE 1 : PrÃ©paration (3/3 âœ“)"

---

#### US-506 : Consulter un document depuis la checklist ðŸ†•

**En tant que** Karim **Je veux** ouvrir le document liÃ© Ã  une Ã©tape sans quitter ma checklist **Afin d'** avoir l'information au bon moment sans navigation

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Ouverture modal** :
  - **GIVEN** une Ã©tape a un document liÃ© (icÃ´ne [ðŸ“„ Doc])
  - **WHEN** Karim clique sur [ðŸ“„ Doc]
  - **THEN** une modal s'ouvre avec : Titre du document, Contenu (PDF preview ou Markdown rendu), Bouton [ðŸ“¥ TÃ©lÃ©charger]
- [ ] **ScÃ©nario Focus trap** :
  - **GIVEN** la modal document est ouverte
  - **WHEN** Karim navigue au clavier (Tab)
  - **THEN** le focus reste dans la modal, Escape ferme la modal
- [ ] **ScÃ©nario Fermer + Cocher** :
  - **GIVEN** la modal document est ouverte
  - **WHEN** Karim clique "Fermer et cocher l'Ã©tape"
  - **THEN** la modal se ferme ET l'Ã©tape associÃ©e est cochÃ©e automatiquement

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.4 modal documentation

---

#### US-507 : TÃ©lÃ©charger un script depuis la checklist ðŸ†•

**En tant que** Karim **Je veux** tÃ©lÃ©charger un script ou fichier directement depuis ma checklist **Afin de** l'exÃ©cuter sur le poste sans navigation

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario TÃ©lÃ©chargement direct** :
  - **GIVEN** la modal document affiche un script (.ps1, .bat)
  - **WHEN** Karim clique [ðŸ“¥ TÃ©lÃ©charger]
  - **THEN** le fichier est tÃ©lÃ©chargÃ© directement sur son poste

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.4 bouton "ðŸ“¥ TÃ©lÃ©charger"

---

#### US-508 : Donner un feedback sur un document ðŸ†•

**En tant que** Karim **Je veux** indiquer si un document m'a Ã©tÃ© utile **Afin d'** aider Sophie Ã  amÃ©liorer la documentation

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Feedback** :
  - **GIVEN** Karim consulte un document dans la modal
  - **WHEN** il clique [ðŸ‘ Utile] ou [ðŸ‘Ž Pas utile]
  - **THEN** son feedback est enregistrÃ©, un toast confirme "Merci pour votre retour !"
- [ ] **ScÃ©nario MÃ©trique** :
  - **GIVEN** un document a reÃ§u des feedbacks
  - **WHEN** Sophie consulte la base documentaire
  - **THEN** elle voit la mÃ©trique "ðŸ‘ 87% utile (sur 234 consultations)"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-052 ðŸ”¥ **PrioritÃ©** : ðŸŸ¢ COULD (V2) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.4 "Ce document vous a-t-il aidÃ© ?"

---

### ðŸ“¦ EPIC-06 : Dashboard & Reporting

_Source : P3.4 Flow #3, Wireframes 3.1, 3.4_

#### US-601 : Voir le dashboard temps rÃ©el

**En tant que** Sophie **Je veux** voir un dashboard avec l'avancement en temps rÃ©el **Afin de** piloter ma campagne sans consolidation manuelle

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario 4 widgets MVP** :
  - **GIVEN** Sophie accÃ¨de au dashboard d'une campagne
  - **WHEN** la page s'affiche
  - **THEN** elle voit 4 widgets : RÃ©alisÃ© (vert), PlanifiÃ© (bleu), ReportÃ© (orange), Ã€ remÃ©dier (rouge)
- [ ] **ScÃ©nario Compteurs temps rÃ©el** :
  - **GIVEN** Karim termine une intervention
  - **WHEN** Sophie a le dashboard ouvert
  - **THEN** le compteur "RÃ©alisÃ©" s'incrÃ©mente automatiquement sans rechargement
- [ ] **ScÃ©nario 3 signaux RGAA** :
  - **GIVEN** un widget s'affiche
  - **WHEN** l'utilisateur le consulte
  - **THEN** le statut est communiquÃ© par : icÃ´ne + couleur (4.5:1 contraste) + texte

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-040, RG-080, RG-081 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.1

---

#### US-602 : Voir la progression par segment

**En tant que** Sophie **Je veux** voir la progression dÃ©taillÃ©e par segment (BÃ¢timent A, B, C) **Afin d'** identifier les segments en retard

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Barres par segment** :
  - **GIVEN** Sophie consulte le dashboard
  - **WHEN** la section "Progression par segment" s'affiche
  - **THEN** chaque segment a sa barre : "BÃ¢timent A â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘ 89%" avec code couleur
- [ ] **ScÃ©nario Alerte retard** :
  - **GIVEN** un segment est Ã  <50% Ã  une date avancÃ©e
  - **WHEN** Sophie consulte le dashboard
  - **THEN** le segment est signalÃ© avec âš ï¸

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.1 section "PAR SEGMENT"

---

#### US-603 : Voir la vÃ©locitÃ©

**En tant que** Sophie **Je veux** voir la vÃ©locitÃ© (interventions/jour ou /semaine) **Afin de** prÃ©voir la date de fin

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Courbe** :
  - **GIVEN** Sophie consulte le dashboard
  - **WHEN** la section "VÃ©locitÃ©" s'affiche
  - **THEN** un graphique linÃ©aire montre les interventions rÃ©alisÃ©es par jour sur les 30 derniers jours
- [ ] **ScÃ©nario Projection** :
  - **GIVEN** la vÃ©locitÃ© moyenne est de 15 interventions/jour
  - **WHEN** 200 interventions restent
  - **THEN** une estimation affiche "Fin estimÃ©e : ~13 jours ouvrÃ©s"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¢ COULD (V2) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.1 section "TENDANCE"

---

#### US-604 : Exporter le dashboard en PDF

**En tant que** Sophie **Je veux** exporter le dashboard en PDF 1 page **Afin de** le partager en rÃ©union Direction

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Export** :
  - **GIVEN** Sophie est sur le dashboard
  - **WHEN** elle clique [ðŸ“¥ Export PDF]
  - **THEN** un PDF 1 page est gÃ©nÃ©rÃ© avec : date, titre campagne, 4 widgets, progression par segment
- [ ] **ScÃ©nario Format** :
  - **GIVEN** le PDF est gÃ©nÃ©rÃ©
  - **WHEN** Sophie l'ouvre
  - **THEN** il est en format paysage A4, lisible sans zoom

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) â€” MVP = screenshot ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.1 bouton export

---

#### US-605 : Partager une URL lecture seule

**En tant que** Sophie **Je veux** gÃ©nÃ©rer une URL partageable du dashboard **Afin de** permettre Ã  la Direction de consulter l'avancement sans compte

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario GÃ©nÃ©ration** :
  - **GIVEN** Sophie est sur le dashboard
  - **WHEN** elle clique [ðŸ”— Partager]
  - **THEN** une URL unique est gÃ©nÃ©rÃ©e (ex: /share/abc123xyz) et copiÃ©e dans le presse-papier
- [ ] **ScÃ©nario Consultation** :
  - **GIVEN** un utilisateur sans compte accÃ¨de Ã  l'URL
  - **WHEN** la page s'affiche
  - **THEN** le dashboard s'affiche en lecture seule, sans aucune action de modification
- [ ] **ScÃ©nario RÃ©vocation** :
  - **GIVEN** Sophie veut invalider un lien partagÃ©
  - **WHEN** elle clique "RÃ©voquer le lien"
  - **THEN** l'URL ne fonctionne plus (404)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-041 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.1 bouton partage

---

#### US-606 : AccÃ©der Ã  l'aide contextuelle ðŸ†•

**En tant que** utilisateur **Je veux** accÃ©der Ã  l'aide depuis n'importe quelle page **Afin de** comprendre comment utiliser une fonctionnalitÃ©

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Aide globale** :
  - **GIVEN** l'utilisateur est connectÃ©
  - **WHEN** il clique sur [?] dans le header
  - **THEN** un panneau latÃ©ral ou modal s'ouvre avec l'aide contextuelle de la page courante
- [ ] **ScÃ©nario Liens externes** :
  - **GIVEN** l'aide s'affiche
  - **WHEN** l'utilisateur consulte
  - **THEN** des liens vers la documentation complÃ¨te sont disponibles

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¢ COULD (V2) ðŸ”— **Lien Maquette** : P3.4 Header [?]

---

#### US-607 ðŸ†• : Voir le dashboard global multi-campagnes

**En tant que** Sophie (Gestionnaire) **Je veux** voir un dashboard avec toutes mes campagnes en cours **Afin d'** avoir une vue d'ensemble de mes opÃ©rations

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Vue globale** :
  - **GIVEN** Sophie a 3 campagnes en cours
  - **WHEN** elle accÃ¨de au dashboard global
  - **THEN** elle voit une liste/grille avec pour chaque campagne :
    - Nom de la campagne
    - Barre de progression (% rÃ©alisÃ©)
    - Date d'Ã©chÃ©ance
    - Nombre de cibles (rÃ©alisÃ©/total)
- [ ] **ScÃ©nario Tri** :
  - **GIVEN** Sophie consulte le dashboard global
  - **WHEN** elle clique sur un en-tÃªte de colonne
  - **THEN** la liste est triÃ©e par ce critÃ¨re (date, progression, nom)
- [ ] **ScÃ©nario Navigation** :
  - **GIVEN** Sophie clique sur une campagne dans la vue globale
  - **WHEN** l'action est effectuÃ©e
  - **THEN** elle est redirigÃ©e vers le dashboard dÃ©taillÃ© de cette campagne

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P1.3bis Â§5.6

---

#### US-608 ðŸ†• : Filtrer le dashboard global par statut

**En tant que** Sophie (Gestionnaire) **Je veux** filtrer mes campagnes par statut (en cours, terminÃ©e, archivÃ©e) **Afin de** me concentrer sur les campagnes actives

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Filtres** :
  - **GIVEN** Sophie est sur le dashboard global
  - **WHEN** elle clique sur le filtre "Statut"
  - **THEN** elle peut cocher : â˜‘ En cours / â˜‘ TerminÃ©e / â˜ ArchivÃ©e
  - **AND** la liste se met Ã  jour en temps rÃ©el

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

### ðŸ“¦ EPIC-07 : Base Documentaire

_Source : P3.4 Wireframe 3.10_

#### US-701 : Voir la liste des documents

**En tant que** Sophie **Je veux** voir tous les documents uploadÃ©s avec leurs statistiques **Afin de** gÃ©rer ma base documentaire

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie accÃ¨de Ã  "Base documentaire"
  - **WHEN** la page s'affiche
  - **THEN** elle voit : Type (icÃ´ne PDF/Script/ZIP), Nom, Campagne liÃ©e, Consultations, TÃ©lÃ©chargements, % utile
- [ ] **ScÃ©nario Filtre campagne** :
  - **GIVEN** Sophie filtre par campagne
  - **WHEN** le filtre est appliquÃ©
  - **THEN** seuls les documents de cette campagne s'affichent

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.10

---

#### US-702 : Uploader un document

**En tant que** Sophie **Je veux** uploader un document (PDF, script, ZIP) **Afin de** le lier aux checklists

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Drag & drop** :
  - **GIVEN** Sophie est sur "Base documentaire"
  - **WHEN** elle glisse-dÃ©pose un fichier dans la zone
  - **THEN** le fichier est uploadÃ©, un formulaire demande : nom affichÃ©, description, campagne liÃ©e
- [ ] **ScÃ©nario Formats acceptÃ©s** :
  - **GIVEN** Sophie uploade un fichier PDF, DOCX, PS1, BAT, ZIP, EXE
  - **WHEN** l'upload est tentÃ©
  - **THEN** l'upload est acceptÃ©
- [ ] **ScÃ©nario Format refusÃ©** :
  - **GIVEN** Sophie uploade un .mp4
  - **WHEN** l'upload est tentÃ©
  - **THEN** le message "Format non autorisÃ©" s'affiche
- [ ] **ScÃ©nario Taille max** :
  - **GIVEN** Sophie uploade un fichier >50 Mo
  - **WHEN** l'upload est tentÃ©
  - **THEN** le message "Taille maximale dÃ©passÃ©e (50 Mo)" s'affiche

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-050 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.10 zone upload

---

#### US-703 : Lier un document Ã  une campagne

**En tant que** Sophie **Je veux** associer chaque document Ã  une campagne **Afin d'** Ã©viter les documents orphelins

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Liaison obligatoire** :
  - **GIVEN** Sophie uploade un document
  - **WHEN** elle ne sÃ©lectionne pas de campagne
  - **THEN** le message "Veuillez sÃ©lectionner une campagne" s'affiche

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-051 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.10

---

#### US-704 : Supprimer un document

**En tant que** Sophie **Je veux** supprimer un document obsolÃ¨te **Afin de** maintenir ma base documentaire propre

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Protection** :
  - **GIVEN** un document est liÃ© Ã  des Ã©tapes de checklist actives
  - **WHEN** Sophie tente de le supprimer
  - **THEN** un avertissement indique "Ce document est utilisÃ© par X checklists. Supprimer quand mÃªme ?"
- [ ] **ScÃ©nario Suppression** :
  - **GIVEN** Sophie confirme la suppression
  - **WHEN** l'action est effectuÃ©e
  - **THEN** le document est supprimÃ©, les liens dans les checklists affichent "Document supprimÃ©"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-705 : Voir les mÃ©triques d'utilisation d'un document ðŸ†•

**En tant que** Sophie **Je veux** voir les statistiques d'utilisation de chaque document **Afin de** savoir quels documents sont utiles

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario MÃ©triques** :
  - **GIVEN** Sophie consulte un document
  - **WHEN** le dÃ©tail s'affiche
  - **THEN** elle voit : Consultations (X fois), TÃ©lÃ©chargements (Y fois), Feedback (Z% utile sur N avis)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-052 ðŸ”¥ **PrioritÃ©** : ðŸŸ¢ COULD (V2) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.10 colonnes Stats

---

### ðŸ“¦ EPIC-08 : Configuration & Administration

_Source : P3.4 Wireframe 3.7_

#### US-801 : CrÃ©er un type d'opÃ©ration

**En tant que** Sophie (Admin) **Je veux** crÃ©er un nouveau type d'opÃ©ration avec ses champs personnalisÃ©s **Afin de** configurer OpsTracker pour un nouveau cas d'usage

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie est sur "Types d'opÃ©rations"
  - **WHEN** elle clique "+ Nouveau type" et configure nom, description, icÃ´ne, couleur
  - **THEN** le type est crÃ©Ã© et disponible lors de la crÃ©ation de campagne
- [ ] **ScÃ©nario Champs par dÃ©faut** :
  - **GIVEN** Sophie crÃ©e un type
  - **WHEN** elle ne configure pas de champs
  - **THEN** 5 champs par dÃ©faut sont proposÃ©s (Nom utilisateur, Matricule, Ã‰quipement, Localisation, Contact)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-060 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) â€” 5 champs fixes ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.7

---

#### US-802 : DÃ©finir les champs personnalisÃ©s (V1)

**En tant que** Sophie (Admin) **Je veux** dÃ©finir les champs personnalisÃ©s d'un type d'opÃ©ration **Afin de** capturer les donnÃ©es spÃ©cifiques Ã  chaque opÃ©ration

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Ajout champ** :
  - **GIVEN** Sophie Ã©dite un type d'opÃ©ration
  - **WHEN** elle clique "+ Ajouter un champ" et configure : nom technique, label, type, obligatoire
  - **THEN** le champ est ajoutÃ© et rÃ©organisable par drag & drop
- [ ] **ScÃ©nario Types disponibles** :
  - **GIVEN** Sophie crÃ©e un champ
  - **WHEN** elle choisit le type
  - **THEN** les options sont : Texte court, Texte long, Nombre, Date, Liste dÃ©roulante

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-061, RG-015 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.7 section "CHAMPS PERSONNALISÃ‰S"

---

#### US-803 : Configurer un workflow (V2)

**En tant que** Sophie (Admin) **Je veux** dÃ©finir les statuts et transitions de mes opÃ©rations **Afin d'** adapter le workflow Ã  mon processus

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Ajout statut** :
  - **GIVEN** Sophie Ã©dite un workflow
  - **WHEN** elle ajoute un statut (nom, couleur, icÃ´ne)
  - **THEN** le statut est disponible dans le workflow
- [ ] **ScÃ©nario Transitions** :
  - **GIVEN** Sophie configure les transitions
  - **WHEN** elle dÃ©finit "PlanifiÃ© â†’ En cours" autorisÃ© pour Technicien
  - **THEN** seul un Technicien peut effectuer cette transition

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-062 ðŸ”¥ **PrioritÃ©** : ðŸŸ¢ COULD (V2) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.7 section "WORKFLOW"

---

#### US-804 : Voir l'historique des modifications (Audit trail)

**En tant que** Sophie (Admin) **Je veux** voir l'historique de toutes les modifications sur une opÃ©ration **Afin de** tracer qui a fait quoi et quand

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie ouvre le dÃ©tail d'une opÃ©ration
  - **WHEN** elle clique sur "ðŸ“œ Historique"
  - **THEN** elle voit : date, utilisateur, champ modifiÃ©, ancienne â†’ nouvelle valeur

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-070 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-805 : Dupliquer un type d'opÃ©ration ðŸ†•

**En tant que** Sophie (Admin) **Je veux** dupliquer un type d'opÃ©ration existant **Afin de** crÃ©er des variantes sans repartir de zÃ©ro

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie est sur un type d'opÃ©ration
  - **WHEN** elle clique "â§‰ Dupliquer"
  - **THEN** un nouveau type est crÃ©Ã© avec les mÃªmes champs, nom = "Type original (copie)"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¢ COULD (V2) ðŸ”— **Lien Maquette** : â€”

---

#### US-806 : Exporter/Importer la configuration (CSV) ðŸ†•

**En tant que** Marc (Admin/DSI) **Je veux** exporter et importer la configuration d'OpsTracker (types d'opÃ©rations, templates de checklists, segments) **Afin de** rÃ©pliquer la configuration entre instances organisationnelles ou sauvegarder ma configuration

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Export configuration** :
  - **GIVEN** Marc est sur "Administration > Configuration"
  - **WHEN** il clique "[ðŸ“¤ Exporter configuration]"
  - **THEN** un fichier ZIP est tÃ©lÃ©chargÃ© contenant :
    - `types_operations.csv` : tous les types d'opÃ©rations avec leurs champs JSONB
    - `templates_checklists.csv` : tous les templates avec phases et Ã©tapes
    - `segments.csv` : liste des segments dÃ©finis
    - `config_metadata.json` : version OpsTracker, date export, auteur
- [ ] **ScÃ©nario Import configuration** :
  - **GIVEN** Marc est sur "Administration > Configuration"
  - **WHEN** il clique "[ðŸ“¥ Importer configuration]" et sÃ©lectionne un ZIP valide
  - **THEN** une prÃ©visualisation affiche les Ã©lÃ©ments Ã  importer avec options :
    - â˜‘ Remplacer les existants (mÃªme nom)
    - â˜‘ Ignorer les doublons
    - â˜‘ CrÃ©er les nouveaux uniquement
- [ ] **ScÃ©nario Validation prÃ©-import** :
  - **GIVEN** Marc importe une configuration
  - **WHEN** le systÃ¨me analyse le ZIP
  - **THEN** il affiche : "âœ… 3 types d'opÃ©rations / âœ… 5 templates / âš ï¸ 1 conflit (type 'Migration W11' existe dÃ©jÃ )"
- [ ] **ScÃ©nario Conflit** :
  - **GIVEN** un type d'opÃ©ration avec le mÃªme nom existe dÃ©jÃ 
  - **WHEN** Marc choisit "Remplacer les existants"
  - **THEN** le type existant est Ã©crasÃ© par la version importÃ©e
- [ ] **ScÃ©nario CompatibilitÃ© version** :
  - **GIVEN** le ZIP provient d'une version OpsTracker antÃ©rieure
  - **WHEN** le systÃ¨me dÃ©tecte une incompatibilitÃ©
  - **THEN** un message indique "Configuration exportÃ©e depuis v1.2, version actuelle v1.5. Migration automatique appliquÃ©e."

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-100 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) â€” Requis pour dÃ©ploiement multi-organisations ðŸ”— **Lien Maquette** : â€”

---

#### US-807 ðŸ†• : CrÃ©er un profil "Coordinateur"

**En tant que** Marc (Admin) **Je veux** crÃ©er un profil utilisateur "Coordinateur" **Afin de** permettre Ã  des non-managers de positionner des agents

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario CrÃ©ation profil** :
  - **GIVEN** Marc est sur la gestion des utilisateurs
  - **WHEN** il crÃ©e ou modifie un utilisateur
  - **THEN** il peut lui attribuer le rÃ´le "Coordinateur" en plus de son rÃ´le de base
- [ ] **ScÃ©nario PÃ©rimÃ¨tre** :
  - **GIVEN** un utilisateur a le rÃ´le "Coordinateur"
  - **WHEN** Marc configure son pÃ©rimÃ¨tre
  - **THEN** il peut dÃ©finir les services/segments sur lesquels ce coordinateur peut positionner des agents

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-114 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-808 ðŸ†• : GÃ©rer les habilitations par campagne

**En tant que** Sophie (Gestionnaire) **Je veux** dÃ©finir qui peut faire quoi sur ma campagne **Afin de** dÃ©lÃ©guer certaines actions Ã  des coordinateurs ou assistants

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Habilitations** :
  - **GIVEN** Sophie est propriÃ©taire d'une campagne
  - **WHEN** elle accÃ¨de Ã  "Habilitations"
  - **THEN** elle peut pour chaque utilisateur/groupe dÃ©finir :
    - â˜ Peut voir la campagne
    - â˜ Peut positionner des agents
    - â˜ Peut modifier la configuration
    - â˜ Peut exporter les donnÃ©es

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-115 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

### ðŸ“¦ EPIC-09 : PrÃ©requis & Segments ðŸ†•

_Source : P3.4 Wireframe 3.9 â€” EPIC MANQUANT dans version prÃ©cÃ©dente_

#### US-901 : Voir les prÃ©requis globaux d'une campagne

**En tant que** Sophie **Je veux** voir les prÃ©requis nÃ©cessaires avant de lancer ma campagne **Afin de** m'assurer que tout est prÃªt

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie accÃ¨de Ã  l'onglet "âœ… PrÃ©requis" d'une campagne
  - **WHEN** la page s'affiche
  - **THEN** elle voit la section "PRÃ‰REQUIS GLOBAUX" avec : #, PrÃ©requis, Responsable, Statut
- [ ] **ScÃ©nario Progression** :
  - **GIVEN** 2 prÃ©requis sur 5 sont "Fait"
  - **WHEN** la section s'affiche
  - **THEN** une barre de progression affiche "â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘ 2/5 (40%)"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-090 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.9 section "PRÃ‰REQUIS GLOBAUX"

---

#### US-902 : Ajouter/modifier un prÃ©requis global

**En tant que** Sophie **Je veux** ajouter ou modifier un prÃ©requis de campagne **Afin de** tracker les dÃ©pendances

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Ajout** :
  - **GIVEN** Sophie est sur les prÃ©requis globaux
  - **WHEN** elle clique "+ Ajouter un prÃ©requis global"
  - **THEN** elle peut saisir : LibellÃ©, Responsable, Date cible (optionnelle)
- [ ] **ScÃ©nario Changement statut** :
  - **GIVEN** un prÃ©requis existe
  - **WHEN** Sophie clique sur le dropdown statut
  - **THEN** elle peut choisir : â—‹ Ã€ faire, â— En cours, âœ“ Fait

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-090 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.9

---

#### US-903 : Voir les prÃ©requis par segment

**En tant que** Sophie **Je veux** voir les prÃ©requis spÃ©cifiques Ã  chaque segment **Afin de** savoir si un segment est prÃªt Ã  dÃ©marrer

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Nominal** :
  - **GIVEN** Sophie consulte l'onglet "PrÃ©requis"
  - **WHEN** elle scrolle vers "PRÃ‰REQUIS PAR SEGMENT"
  - **THEN** elle voit un accordÃ©on par segment avec progression : "â–¼ BÃ‚TIMENT A â€” 100%" / "â–¼ BÃ‚TIMENT B â€” 50%"
- [ ] **ScÃ©nario Alerte** :
  - **GIVEN** un segment a des prÃ©requis Ã  0%
  - **WHEN** la liste s'affiche
  - **THEN** un badge âš ï¸ apparaÃ®t Ã  cÃ´tÃ© du segment

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-091 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.9 section "PRÃ‰REQUIS PAR SEGMENT"

---

#### US-904 : Ajouter un prÃ©requis par segment

**En tant que** Sophie **Je veux** ajouter un prÃ©requis spÃ©cifique Ã  un segment **Afin de** tracker les dÃ©pendances locales

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Ajout** :
  - **GIVEN** Sophie est sur le segment "BÃ¢timent A"
  - **WHEN** elle clique "+ Ajouter un prÃ©requis pour BÃ¢timent A"
  - **THEN** un prÃ©requis est ajoutÃ© Ã  ce segment uniquement

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-091 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.9

---

#### US-905 : CrÃ©er/modifier des segments

**En tant que** Sophie **Je veux** dÃ©finir les segments d'une campagne **Afin de** grouper mes opÃ©rations (par bÃ¢timent, service, etc.)

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario CrÃ©ation** :
  - **GIVEN** Sophie crÃ©e une campagne
  - **WHEN** elle atteint la configuration des segments
  - **THEN** elle peut dÃ©finir des segments : Nom (ex: "BÃ¢timent A"), Couleur (optionnelle)
- [ ] **ScÃ©nario Assignation auto** :
  - **GIVEN** Sophie importe un CSV avec colonne "BATIMENT"
  - **WHEN** le mapping associe cette colonne au champ "Segment"
  - **THEN** les opÃ©rations sont automatiquement groupÃ©es par valeur unique

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) â€” Segments = groupement visuel des opÃ©rations ðŸ”— **Lien Maquette** : P3.4 Wireframes 3.5, 3.6

---

#### US-906 : Voir la progression par segment (dÃ©tail)

**En tant que** Sophie **Je veux** voir le dÃ©tail de progression par segment **Afin d'** identifier les segments en retard

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario DÃ©tail** :
  - **GIVEN** Sophie clique sur un segment dans le dashboard
  - **WHEN** le dÃ©tail s'affiche
  - **THEN** elle voit : RÃ©alisÃ© (X), PlanifiÃ© (Y), ReportÃ© (Z), Ã€ remÃ©dier (W) pour ce segment uniquement

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P3.4 Wireframe 3.5 en-tÃªtes segments

---

### ðŸ“¦ EPIC-10 ðŸ†• : Interface RÃ©servation (End-Users)

_Source : P1.3bis Â§4.1 (Doctolib), Â§3.3 (Agent ImpactÃ©), Â§3.4 (Manager MÃ©tier)_

---

#### US-1001 ðŸ†• : Voir les crÃ©neaux disponibles (Agent)

**En tant que** Agent ImpactÃ© **Je veux** voir les crÃ©neaux disponibles pour ma migration/intervention **Afin de** choisir celui qui me convient le mieux

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario AccÃ¨s** :
  - **GIVEN** l'agent clique sur le lien reÃ§u par email
  - **WHEN** il s'authentifie avec sa carte agent
  - **THEN** il voit la liste des crÃ©neaux disponibles pour cette campagne
- [ ] **ScÃ©nario Affichage crÃ©neaux** :
  - **GIVEN** l'agent consulte les crÃ©neaux
  - **WHEN** la page s'affiche
  - **THEN** chaque crÃ©neau indique :
    - Date et plage horaire
    - Lieu
    - Places restantes (si applicable)
    - Statut (Disponible / Complet)
- [ ] **ScÃ©nario CrÃ©neau complet** :
  - **GIVEN** un crÃ©neau n'a plus de places
  - **WHEN** l'agent consulte ce crÃ©neau
  - **THEN** il est affichÃ© grisÃ© avec "Complet" et non cliquable

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-120 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P1.3bis Â§5.3

---

#### US-1002 ðŸ†• : Se positionner sur un crÃ©neau (Agent)

**En tant que** Agent ImpactÃ© **Je veux** me positionner sur un crÃ©neau disponible **Afin de** rÃ©server ma place pour l'intervention

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Positionnement** :
  - **GIVEN** l'agent consulte un crÃ©neau disponible
  - **WHEN** il clique sur "Choisir ce crÃ©neau"
  - **THEN** une confirmation s'affiche : "Confirmez-vous le crÃ©neau du [date] Ã  [heure] ?"
- [ ] **ScÃ©nario Confirmation** :
  - **GIVEN** l'agent confirme son choix
  - **WHEN** la confirmation est validÃ©e
  - **THEN** :
    - Le crÃ©neau est rÃ©servÃ© Ã  son nom
    - Le compteur de places restantes dÃ©crÃ©mente
    - Un email de confirmation est envoyÃ© (avec ICS)
    - Le message "Votre crÃ©neau est rÃ©servÃ© âœ“" s'affiche
- [ ] **ScÃ©nario UnicitÃ©** :
  - **GIVEN** l'agent a dÃ©jÃ  un crÃ©neau rÃ©servÃ© pour cette campagne
  - **WHEN** il tente de rÃ©server un autre crÃ©neau
  - **THEN** le message "Vous avez dÃ©jÃ  un crÃ©neau rÃ©servÃ©. Annulez-le d'abord pour en choisir un autre." s'affiche

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-121, RG-122 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P1.3bis Â§5.3

---

#### US-1003 ðŸ†• : Annuler/modifier son crÃ©neau (Agent)

**En tant que** Agent ImpactÃ© **Je veux** pouvoir annuler ou modifier mon crÃ©neau rÃ©servÃ© **Afin de** me repositionner si j'ai un empÃªchement

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Annulation** :
  - **GIVEN** l'agent a un crÃ©neau rÃ©servÃ©
  - **WHEN** il clique sur "Annuler mon crÃ©neau"
  - **THEN** :
    - Une confirmation est demandÃ©e
    - AprÃ¨s confirmation, le crÃ©neau est libÃ©rÃ©
    - La place redevient disponible pour les autres
    - Un email d'annulation est envoyÃ©
- [ ] **ScÃ©nario Modification** :
  - **GIVEN** l'agent a un crÃ©neau rÃ©servÃ©
  - **WHEN** il clique sur "Modifier mon crÃ©neau"
  - **THEN** il peut choisir un autre crÃ©neau disponible (Ã©quivalent Ã  annuler + rÃ©server)
- [ ] **ScÃ©nario Verrouillage** :
  - **GIVEN** le crÃ©neau est Ã  moins de J-2 (paramÃ©trable)
  - **WHEN** l'agent tente de modifier/annuler
  - **THEN** le message "Votre crÃ©neau est verrouillÃ©. Contactez votre manager ou l'IT." s'affiche

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-123 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P1.3bis Â§5.3

---

#### US-1004 ðŸ†• : Voir mon rÃ©capitulatif (Agent)

**En tant que** Agent ImpactÃ© **Je veux** voir un rÃ©capitulatif de mon crÃ©neau rÃ©servÃ© **Afin de** retrouver facilement les informations

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario RÃ©capitulatif** :
  - **GIVEN** l'agent a un crÃ©neau rÃ©servÃ©
  - **WHEN** il accÃ¨de Ã  l'interface
  - **THEN** il voit :
    - Date et heure du crÃ©neau
    - Lieu de l'intervention
    - Ce qui va se passer (description de l'opÃ©ration)
    - Boutons [Modifier] [Annuler] [Ajouter Ã  mon agenda]

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-1005 ðŸ†• : Voir la liste de mes agents (Manager)

**En tant que** Manager MÃ©tier **Je veux** voir la liste des agents de mon Ã©quipe concernÃ©s par la campagne **Afin de** savoir qui doit Ãªtre positionnÃ©

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Liste Ã©quipe** :
  - **GIVEN** le manager se connecte Ã  l'interface
  - **WHEN** il accÃ¨de Ã  une campagne
  - **THEN** il voit la liste de ses agents avec pour chacun :
    - Nom, prÃ©nom, matricule
    - Statut : âœ… PositionnÃ© (avec date/heure) / âŒ Non positionnÃ©
    - Actions : [Positionner] / [Modifier] / [Annuler]
- [ ] **ScÃ©nario SynthÃ¨se** :
  - **GIVEN** le manager a 10 agents
  - **WHEN** 6 sont positionnÃ©s
  - **THEN** un compteur affiche "6/10 agents positionnÃ©s (60%)"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-124 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P1.3bis Â§5.4

---

#### US-1006 ðŸ†• : Positionner un agent (Manager)

**En tant que** Manager MÃ©tier **Je veux** positionner un de mes agents sur un crÃ©neau **Afin de** organiser les interventions de mon Ã©quipe

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Positionnement** :
  - **GIVEN** le manager consulte la liste de ses agents
  - **WHEN** il clique sur [Positionner] pour un agent
  - **THEN** il voit les crÃ©neaux disponibles et peut en sÃ©lectionner un
- [ ] **ScÃ©nario Confirmation** :
  - **GIVEN** le manager sÃ©lectionne un crÃ©neau pour un agent
  - **WHEN** il confirme
  - **THEN** :
    - L'agent est positionnÃ© sur ce crÃ©neau
    - L'agent reÃ§oit un email de notification (avec ICS)
    - Le statut passe Ã  "âœ… PositionnÃ©"
- [ ] **ScÃ©nario Agent dÃ©jÃ  positionnÃ©** :
  - **GIVEN** un agent est dÃ©jÃ  positionnÃ©
  - **WHEN** le manager clique sur [Positionner]
  - **THEN** le message "Cet agent a dÃ©jÃ  un crÃ©neau. Modifiez-le d'abord." s'affiche

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-121, RG-125 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P1.3bis Â§5.4

---

#### US-1007 ðŸ†• : Modifier/annuler le crÃ©neau d'un agent (Manager)

**En tant que** Manager MÃ©tier **Je veux** modifier ou annuler le crÃ©neau d'un de mes agents **Afin de** gÃ©rer les absences et imprÃ©vus

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Modification** :
  - **GIVEN** un agent de mon Ã©quipe est positionnÃ©
  - **WHEN** je clique sur [Modifier]
  - **THEN** je peux le repositionner sur un autre crÃ©neau disponible
- [ ] **ScÃ©nario Annulation** :
  - **GIVEN** un agent de mon Ã©quipe est positionnÃ©
  - **WHEN** je clique sur [Annuler]
  - **THEN** :
    - Une confirmation est demandÃ©e
    - Le crÃ©neau est libÃ©rÃ©
    - L'agent reÃ§oit un email d'annulation
    - Le statut repasse Ã  "âŒ Non positionnÃ©"
- [ ] **ScÃ©nario Remplacement rapide** :
  - **GIVEN** un agent est absent
  - **WHEN** le manager annule son crÃ©neau
  - **THEN** il peut immÃ©diatement positionner un autre agent sur le mÃªme crÃ©neau

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-123, RG-126 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : P1.3bis Â§5.4

---

#### US-1008 ðŸ†• : Voir les crÃ©neaux avec rÃ©partition Ã©quipe (Manager)

**En tant que** Manager MÃ©tier **Je veux** voir une vue planning des crÃ©neaux avec la rÃ©partition de mon Ã©quipe **Afin d'** Ã©viter d'avoir tous mes agents le mÃªme jour

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Vue planning** :
  - **GIVEN** le manager accÃ¨de Ã  la vue planning
  - **WHEN** la page s'affiche
  - **THEN** il voit un calendrier/planning avec :
    - Les crÃ©neaux disponibles
    - Pour chaque crÃ©neau, le nombre de ses agents positionnÃ©s
    - Alerte visuelle si >50% de l'Ã©quipe le mÃªme jour
- [ ] **ScÃ©nario Alerte concentration** :
  - **GIVEN** 4 agents sur 5 sont positionnÃ©s le mÃªme jour
  - **WHEN** le planning s'affiche
  - **THEN** une alerte "âš ï¸ 80% de votre Ã©quipe sur la mÃªme journÃ©e" s'affiche

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-127 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-1009 ðŸ†• : Recevoir une notification d'agents non positionnÃ©s (Manager)

**En tant que** Manager MÃ©tier **Je veux** recevoir une notification si des agents ne sont pas positionnÃ©s Ã  J-X **Afin de** ne pas oublier de les positionner

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Rappel** :
  - **GIVEN** la campagne se termine dans 7 jours
  - **WHEN** 2 agents de mon Ã©quipe ne sont pas encore positionnÃ©s
  - **THEN** je reÃ§ois un email : "Rappel : 2 agents de votre Ã©quipe ne sont pas encore positionnÃ©s pour [campagne]"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¢ COULD (V2) ðŸ”— **Lien Maquette** : â€”

---

#### US-1010 ðŸ†• : Positionner des agents (Coordinateur)

**En tant que** Coordinateur **Je veux** positionner des agents sur mon pÃ©rimÃ¨tre dÃ©lÃ©guÃ© **Afin de** aider les managers dans l'organisation

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario PÃ©rimÃ¨tre dÃ©lÃ©guÃ©** :
  - **GIVEN** je suis coordinateur avec un pÃ©rimÃ¨tre de 3 services
  - **WHEN** j'accÃ¨de Ã  l'interface de positionnement
  - **THEN** je vois les agents de ces 3 services (pas les autres)
- [ ] **ScÃ©nario Actions** :
  - **GIVEN** je consulte un agent de mon pÃ©rimÃ¨tre
  - **WHEN** je le positionne sur un crÃ©neau
  - **THEN** le comportement est identique Ã  celui du Manager (notification agent, etc.)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-114, RG-125 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-1011 ðŸ†• : S'authentifier par carte agent (End-User)

**En tant que** Agent ImpactÃ© ou Manager MÃ©tier **Je veux** m'authentifier avec ma carte agent **Afin de** ne pas avoir de mot de passe supplÃ©mentaire Ã  retenir

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Auth carte** :
  - **GIVEN** l'utilisateur accÃ¨de Ã  l'interface de rÃ©servation
  - **WHEN** il prÃ©sente sa carte agent
  - **THEN** il est automatiquement identifiÃ© et connectÃ©
- [ ] **ScÃ©nario Fallback** :
  - **GIVEN** l'authentification carte Ã©choue
  - **WHEN** l'utilisateur ne peut pas utiliser sa carte
  - **THEN** il peut s'authentifier avec son compte AD (email/mot de passe)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-128 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) â€” MVP avec auth AD simple ðŸ”— **Lien Maquette** : â€”

---

#### US-1012 ðŸ†• : Voir les informations de l'intervention (End-User)

**En tant que** Agent ImpactÃ© **Je veux** voir ce qui va se passer lors de l'intervention **Afin de** savoir Ã  quoi m'attendre et me prÃ©parer

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Informations** :
  - **GIVEN** l'agent consulte les crÃ©neaux
  - **WHEN** il clique sur "En savoir plus"
  - **THEN** il voit :
    - Description de l'opÃ©ration
    - DurÃ©e estimÃ©e
    - Ce qu'il doit prÃ©parer (sauvegarder ses fichiers, etc.)
    - Ce qui sera fait (migration Office, changement PC, etc.)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¢ COULD (V2) ðŸ”— **Lien Maquette** : â€”

---

### ðŸ“¦ EPIC-11 ðŸ†• : Gestion des CrÃ©neaux & CapacitÃ©

_Source : P1.3bis Â§4.2 (Gestion ressources IT)_

---

#### US-1101 ðŸ†• : CrÃ©er des crÃ©neaux pour une campagne

**En tant que** Sophie (Gestionnaire) **Je veux** crÃ©er des crÃ©neaux de rendez-vous pour ma campagne **Afin que** les agents ou managers puissent s'y positionner

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario CrÃ©ation manuelle** :
  - **GIVEN** Sophie configure une campagne
  - **WHEN** elle accÃ¨de Ã  "Gestion des crÃ©neaux"
  - **THEN** elle peut crÃ©er des crÃ©neaux avec :
    - Date
    - Heure de dÃ©but / Heure de fin
    - Lieu
    - CapacitÃ© (nombre de places)
- [ ] **ScÃ©nario CrÃ©ation par plage** :
  - **GIVEN** Sophie veut crÃ©er des crÃ©neaux sur une semaine
  - **WHEN** elle clique sur "GÃ©nÃ©rer des crÃ©neaux"
  - **THEN** elle peut dÃ©finir :
    - Plage de dates (du... au...)
    - Plage horaire quotidienne (9h-17h)
    - DurÃ©e d'un crÃ©neau (1h, 2h, demi-journÃ©e...)
    - CapacitÃ© par crÃ©neau
    - Jours exclus (week-end, fÃ©riÃ©s)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-130 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : â€”

---

#### US-1102 ðŸ†• : DÃ©finir la capacitÃ© IT (ressources)

**En tant que** Sophie (Gestionnaire) **Je veux** dÃ©finir le nombre de techniciens disponibles par jour/demi-journÃ©e **Afin que** le nombre de crÃ©neaux soit calculÃ© automatiquement

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Configuration capacitÃ©** :
  - **GIVEN** Sophie configure les crÃ©neaux
  - **WHEN** elle dÃ©finit :
    - Nombre de techniciens : 2
    - DurÃ©e intervention : 1h
    - Plage horaire : 9h-17h (8h)
  - **THEN** le systÃ¨me calcule : 2 Ã— 8 = 16 crÃ©neaux/jour
- [ ] **ScÃ©nario CapacitÃ© variable** :
  - **GIVEN** Sophie configure la capacitÃ©
  - **WHEN** elle indique que le mardi il n'y a qu'1 technicien
  - **THEN** le nombre de crÃ©neaux du mardi est divisÃ© par 2

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-131 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-1103 ðŸ†• : DÃ©finir la durÃ©e d'intervention (abaques)

**En tant que** Sophie (Gestionnaire) **Je veux** dÃ©finir la durÃ©e moyenne d'une intervention selon le type d'opÃ©ration **Afin que** le calcul des crÃ©neaux soit automatique

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario DurÃ©e par dÃ©faut** :
  - **GIVEN** Sophie crÃ©e un type d'opÃ©ration "Migration Office"
  - **WHEN** elle configure la durÃ©e
  - **THEN** elle peut indiquer : 1h (par dÃ©faut)
- [ ] **ScÃ©nario Impact crÃ©neaux** :
  - **GIVEN** la durÃ©e est passÃ©e de 1h Ã  2h
  - **WHEN** Sophie rÃ©gÃ©nÃ¨re les crÃ©neaux
  - **THEN** le nombre de crÃ©neaux disponibles est divisÃ© par 2

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-132 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-1104 ðŸ†• : Modifier un crÃ©neau

**En tant que** Sophie (Gestionnaire) **Je veux** modifier un crÃ©neau existant (date, heure, capacitÃ©) **Afin de** ajuster le planning si nÃ©cessaire

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Modification** :
  - **GIVEN** Sophie consulte la liste des crÃ©neaux
  - **WHEN** elle clique sur [Modifier] pour un crÃ©neau
  - **THEN** elle peut modifier date, heure, lieu, capacitÃ©
- [ ] **ScÃ©nario CrÃ©neau avec rÃ©servations** :
  - **GIVEN** un crÃ©neau a dÃ©jÃ  3 rÃ©servations
  - **WHEN** Sophie tente de rÃ©duire la capacitÃ© Ã  2
  - **THEN** le message "CapacitÃ© insuffisante : 3 agents dÃ©jÃ  positionnÃ©s" s'affiche
- [ ] **ScÃ©nario Notification** :
  - **GIVEN** Sophie modifie la date/heure d'un crÃ©neau avec rÃ©servations
  - **WHEN** la modification est confirmÃ©e
  - **THEN** tous les agents positionnÃ©s reÃ§oivent un email de mise Ã  jour (avec nouvel ICS)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-133 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : â€”

---

#### US-1105 ðŸ†• : Supprimer un crÃ©neau

**En tant que** Sophie (Gestionnaire) **Je veux** supprimer un crÃ©neau **Afin de** retirer une date qui n'est plus disponible

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario CrÃ©neau vide** :
  - **GIVEN** un crÃ©neau n'a aucune rÃ©servation
  - **WHEN** Sophie clique sur [Supprimer]
  - **THEN** le crÃ©neau est supprimÃ© sans confirmation
- [ ] **ScÃ©nario CrÃ©neau avec rÃ©servations** :
  - **GIVEN** un crÃ©neau a 2 rÃ©servations
  - **WHEN** Sophie clique sur [Supprimer]
  - **THEN** un avertissement s'affiche : "Ce crÃ©neau a 2 agents positionnÃ©s. Ils seront notifiÃ©s et devront se repositionner. Confirmer ?"
- [ ] **ScÃ©nario Notification suppression** :
  - **GIVEN** Sophie confirme la suppression d'un crÃ©neau avec rÃ©servations
  - **WHEN** la suppression est effectuÃ©e
  - **THEN** les agents concernÃ©s reÃ§oivent un email : "Votre crÃ©neau du [date] a Ã©tÃ© annulÃ©. Veuillez vous repositionner."

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-134 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : â€”

---

#### US-1106 ðŸ†• : Voir le taux de remplissage des crÃ©neaux

**En tant que** Sophie (Gestionnaire) **Je veux** voir le taux de remplissage de chaque crÃ©neau **Afin d'** identifier les crÃ©neaux sous-utilisÃ©s ou surchargÃ©s

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Affichage** :
  - **GIVEN** Sophie consulte la liste des crÃ©neaux
  - **WHEN** la page s'affiche
  - **THEN** chaque crÃ©neau indique : "X/Y places (Z%)" avec code couleur :
    - Vert : <50%
    - Orange : 50-90%
    - Rouge : >90%

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : â€”

---

#### US-1107 ðŸ†• : DÃ©finir une date de verrouillage

**En tant que** Sophie (Gestionnaire) **Je veux** dÃ©finir Ã  partir de quand les crÃ©neaux sont verrouillÃ©s **Afin d'** Ã©viter les annulations de derniÃ¨re minute

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Configuration** :
  - **GIVEN** Sophie configure une campagne
  - **WHEN** elle accÃ¨de aux paramÃ¨tres de verrouillage
  - **THEN** elle peut dÃ©finir : "Verrouiller les crÃ©neaux X jours avant" (dÃ©faut : 2)
- [ ] **ScÃ©nario Impact** :
  - **GIVEN** le verrouillage est Ã  J-2
  - **WHEN** un agent tente de modifier son crÃ©neau Ã  J-1
  - **THEN** le bouton [Modifier] est grisÃ© avec "CrÃ©neau verrouillÃ©"

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-123 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-1108 ðŸ†• : Associer des crÃ©neaux Ã  des segments/sites

**En tant que** Sophie (Gestionnaire) **Je veux** associer des crÃ©neaux Ã  des sites spÃ©cifiques **Afin que** les agents ne voient que les crÃ©neaux de leur site

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Association** :
  - **GIVEN** Sophie crÃ©e un crÃ©neau
  - **WHEN** elle configure le crÃ©neau
  - **THEN** elle peut l'associer Ã  un segment/site (ex: "Site Central")
- [ ] **ScÃ©nario Filtrage agent** :
  - **GIVEN** un agent est rattachÃ© au site "Site Central"
  - **WHEN** il consulte les crÃ©neaux disponibles
  - **THEN** il ne voit que les crÃ©neaux du site "Site Central" (ou crÃ©neaux "Tous sites")

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-135 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

### ðŸ“¦ EPIC-12 ðŸ†• : Notifications & Agenda

_Source : P1.3bis Â§4.6 (Notifications ICS)_

---

#### US-1201 ðŸ†• : Envoyer un email de confirmation avec ICS

**En tant que** Agent ImpactÃ© **Je veux** recevoir un email de confirmation avec un fichier ICS **Afin d'** ajouter automatiquement le rendez-vous Ã  mon agenda Outlook

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Email confirmation** :
  - **GIVEN** un agent se positionne sur un crÃ©neau (ou est positionnÃ© par son manager)
  - **WHEN** la rÃ©servation est confirmÃ©e
  - **THEN** il reÃ§oit un email contenant :
    - Objet : "[OpsTracker] Votre rendez-vous du [date] est confirmÃ©"
    - Corps : Date, heure, lieu, ce qui va se passer
    - PiÃ¨ce jointe : fichier RDV.ics
- [ ] **ScÃ©nario Fichier ICS** :
  - **GIVEN** l'agent ouvre le fichier ICS
  - **WHEN** il clique dessus
  - **THEN** Outlook propose d'ajouter l'Ã©vÃ©nement Ã  son calendrier avec :
    - Titre : "[Migration Office] Intervention IT"
    - Date/heure du crÃ©neau
    - Lieu
    - Rappel Ã  J-1

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-140 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-1202 ðŸ†• : Envoyer un email de rappel (J-2)

**En tant que** Agent ImpactÃ© **Je veux** recevoir un email de rappel 2 jours avant mon rendez-vous **Afin de** ne pas oublier mon crÃ©neau

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Rappel** :
  - **GIVEN** un agent a un rendez-vous dans 2 jours
  - **WHEN** le systÃ¨me envoie les rappels automatiques
  - **THEN** l'agent reÃ§oit un email :
    - Objet : "[OpsTracker] Rappel : votre rendez-vous dans 2 jours"
    - Corps : Date, heure, lieu, ce qu'il doit prÃ©parer
    - PiÃ¨ce jointe : fichier ICS (mis Ã  jour)
- [ ] **ScÃ©nario DÃ©lai paramÃ©trable** :
  - **GIVEN** Sophie configure le rappel Ã  J-3 au lieu de J-2
  - **WHEN** le systÃ¨me envoie les rappels
  - **THEN** ils sont envoyÃ©s 3 jours avant

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-141 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-1203 ðŸ†• : Envoyer un email de modification

**En tant que** Agent ImpactÃ© **Je veux** recevoir un email si mon crÃ©neau est modifiÃ© **Afin d'** Ãªtre informÃ© des changements

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Modification par manager** :
  - **GIVEN** le manager modifie le crÃ©neau d'un agent
  - **WHEN** la modification est confirmÃ©e
  - **THEN** l'agent reÃ§oit un email :
    - Objet : "[OpsTracker] Votre rendez-vous a Ã©tÃ© modifiÃ©"
    - Corps : Ancien crÃ©neau (barrÃ©), nouveau crÃ©neau
    - PiÃ¨ce jointe : nouvel ICS
- [ ] **ScÃ©nario Modification par IT** :
  - **GIVEN** Sophie modifie un crÃ©neau ayant des rÃ©servations
  - **WHEN** la modification est confirmÃ©e
  - **THEN** tous les agents concernÃ©s reÃ§oivent un email de mise Ã  jour

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-142 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-1204 ðŸ†• : Envoyer un email d'annulation

**En tant que** Agent ImpactÃ© **Je veux** recevoir un email si mon crÃ©neau est annulÃ© **Afin de** savoir que je dois me repositionner

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Annulation** :
  - **GIVEN** le crÃ©neau d'un agent est annulÃ© (par lui-mÃªme, son manager, ou l'IT)
  - **WHEN** l'annulation est confirmÃ©e
  - **THEN** l'agent reÃ§oit un email :
    - Objet : "[OpsTracker] Votre rendez-vous a Ã©tÃ© annulÃ©"
    - Corps : DÃ©tails du crÃ©neau annulÃ©, invitation Ã  se repositionner
    - Lien vers l'interface de rÃ©servation

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-143 ðŸ”¥ **PrioritÃ©** : ðŸŸ¡ SHOULD (V1) ðŸ”— **Lien Maquette** : â€”

---

#### US-1205 ðŸ†• : Envoyer une invitation initiale aux agents

**En tant que** Agent ImpactÃ© (concernÃ© par une campagne) **Je veux** recevoir une invitation Ã  me positionner **Afin de** savoir qu'une opÃ©ration me concerne et que je dois choisir un crÃ©neau

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Invitation mode Agent** :
  - **GIVEN** Sophie lance une campagne en "Mode Agent"
  - **WHEN** la campagne est activÃ©e
  - **THEN** tous les agents de la population cible reÃ§oivent un email :
    - Objet : "[OpsTracker] Choisissez votre crÃ©neau pour [nom campagne]"
    - Corps : Explication de l'opÃ©ration, lien vers l'interface de rÃ©servation
    - Date limite pour se positionner (si dÃ©finie)
- [ ] **ScÃ©nario Invitation mode Manager** :
  - **GIVEN** Sophie lance une campagne en "Mode Manager"
  - **WHEN** la campagne est activÃ©e
  - **THEN** seuls les managers reÃ§oivent l'invitation (pas les agents)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : RG-144 ðŸ”¥ **PrioritÃ©** : ðŸ”´ MUST (MVP) ðŸ”— **Lien Maquette** : â€”

---

#### US-1206 ðŸ†• : Configurer les paramÃ¨tres de notification

**En tant que** Sophie (Gestionnaire) **Je veux** configurer les paramÃ¨tres de notification d'une campagne **Afin d'** adapter les messages et dÃ©lais Ã  mes besoins

âœ… **CritÃ¨res d'Acceptance (BDD)** :

- [ ] **ScÃ©nario Configuration** :
  - **GIVEN** Sophie configure une campagne
  - **WHEN** elle accÃ¨de Ã  "Notifications"
  - **THEN** elle peut dÃ©finir :
    - â˜‘ Envoyer invitation au lancement
    - â˜‘ Envoyer confirmation avec ICS
    - â˜‘ Envoyer rappel : [ 2 ] jours avant
    - â˜‘ Envoyer notification de modification
    - â˜‘ Envoyer notification d'annulation
- [ ] **ScÃ©nario Personnalisation message** :
  - **GIVEN** Sophie configure les notifications
  - **WHEN** elle clique sur "Personnaliser le message"
  - **THEN** elle peut modifier le texte de l'email (avec variables : {nom_agent}, {date_rdv}, etc.)

âš™ï¸ **RÃ¨gles MÃ©tier LiÃ©es** : â€” ðŸ”¥ **PrioritÃ©** : ðŸŸ¢ COULD (V2) ðŸ”— **Lien Maquette** : â€”

---

## 3. Nouvelles RÃ¨gles MÃ©tier (Business Rules)

| ID         | RÃ¨gle                        | Description Logique                                                       | Stories ImpactÃ©es |
| ---------- | ----------------------------- | ------------------------------------------------------------------------- | ------------------- |
| **RG-110** | Mode inscription              | 4 modes possibles : Agent / Manager / Liste / Mixte                       | US-209              |
| **RG-111** | PropriÃ©taire campagne       | Le crÃ©ateur est propriÃ©taire par dÃ©faut, transfert possible         | US-210              |
| **RG-112** | VisibilitÃ© campagne         | Par dÃ©faut restreinte au propriÃ©taire + habilitÃ©s                   | US-211              |
| **RG-113** | Population cible              | Seuls les agents de la liste peuvent se positionner                       | US-212              |
| **RG-114** | Coordinateur                  | RÃ´le permettant de positionner des agents sans lien hiÃ©rarchique       | US-807, US-1010     |
| **RG-115** | Habilitations campagne        | Droits granulaires par utilisateur/groupe                                 | US-808              |
| **RG-120** | CrÃ©neaux visibles           | Un agent ne voit que les crÃ©neaux de son segment/site                   | US-1001             |
| **RG-121** | UnicitÃ© rÃ©servation       | Un agent ne peut avoir qu'un seul crÃ©neau par campagne                  | US-1002, US-1006    |
| **RG-122** | Confirmation automatique      | Toute rÃ©servation dÃ©clenche un email + ICS                            | US-1002             |
| **RG-123** | Verrouillage J-X              | CrÃ©neaux non modifiables X jours avant (dÃ©faut : 2)                   | US-1003, US-1107    |
| **RG-124** | PÃ©rimÃ¨tre manager          | Un manager ne voit que les agents de son service                          | US-1005             |
| **RG-125** | TraÃ§abilitÃ© positionnement | Enregistrer qui a positionnÃ© (agent lui-mÃªme / manager / coordinateur) | US-1006, US-1010    |
| **RG-126** | Notification agent            | Tout positionnement/modification par un tiers notifie l'agent             | US-1007             |
| **RG-127** | Alerte concentration          | Warning si >50% Ã©quipe mÃªme jour                                       | US-1008             |
| **RG-128** | Auth carte agent              | Authentification par carte agent prÃ©fÃ©rÃ©e, fallback AD              | US-1011             |
| **RG-130** | CrÃ©ation crÃ©neaux         | Manuelle ou par gÃ©nÃ©ration automatique sur plage                      | US-1101             |
| **RG-131** | CapacitÃ© IT                 | Nombre de crÃ©neaux = f(ressources, durÃ©e)                             | US-1102             |
| **RG-132** | Abaques durÃ©e               | DurÃ©e intervention configurable par type d'opÃ©ration                  | US-1103             |
| **RG-133** | Modification crÃ©neau        | Notification des agents si changement date/heure                          | US-1104             |
| **RG-134** | Suppression crÃ©neau         | Confirmation si rÃ©servations, notification agents                       | US-1105             |
| **RG-135** | CrÃ©neaux par segment        | Association crÃ©neau â†” segment optionnelle                             | US-1108             |
| **RG-140** | Email confirmation            | Contient obligatoirement fichier ICS                                      | US-1201             |
| **RG-141** | Email rappel                  | EnvoyÃ© automatiquement Ã  J-X (paramÃ©trable)                          | US-1202             |
| **RG-142** | Email modification            | Contient ancien + nouveau crÃ©neau + nouvel ICS                          | US-1203             |
| **RG-143** | Email annulation              | Contient lien vers interface repositionnement                             | US-1204             |
| **RG-144** | Email invitation              | EnvoyÃ© selon mode inscription (agents ou managers)                      | US-1205             |

---

## 4. Matrice de Priorisation (MoSCoW) â€” MISE Ã€ JOUR

### ðŸ”´ MUST HAVE (MVP) â€” Pilote 50 cibles Organisation principale

| Epic             | Stories MVP                                              | Effort   |
| ---------------- | -------------------------------------------------------- | -------- |
| EPIC-01          | US-101, US-102, US-103                                   | 3 US     |
| EPIC-02          | US-201, US-202, US-205, US-206, **US-209**, **US-212**   | 6 US     |
| EPIC-03          | US-301, US-303, US-304, US-306                           | 4 US     |
| EPIC-04          | US-401, US-402, US-403, US-404                           | 4 US     |
| EPIC-05          | US-501, US-502, US-503                                   | 3 US     |
| EPIC-06          | US-601, US-602, **US-607**                               | 3 US     |
| EPIC-08          | US-801                                                   | 1 US     |
| EPIC-09          | US-905, US-906                                           | 2 US     |
| **EPIC-10** ðŸ†• | **US-1001, US-1002, US-1003, US-1005, US-1006, US-1007** | **6 US** |
| **EPIC-11** ðŸ†• | **US-1101, US-1104, US-1105, US-1106**                   | **4 US** |
| **EPIC-12** ðŸ†• | **US-1205**                                              | **1 US** |

**Total MVP : 23 US â†’ 37 User Stories (+14 US)**

---

### ðŸŸ¡ SHOULD HAVE (V1) â€” DÃ©ploiement 4 organisations

| Epic             | Stories V1                                     |
| ---------------- | ---------------------------------------------- |
| EPIC-01          | US-104, US-105, US-106, US-107                 |
| EPIC-02          | US-203, US-204, US-207, **US-210**, **US-211** |
| EPIC-03          | US-302, US-305, US-307, US-308, US-309         |
| EPIC-05          | US-504, US-505, US-506, US-507                 |
| EPIC-06          | US-604, US-605, **US-608**                     |
| EPIC-07          | US-701, US-702, US-703, US-704                 |
| EPIC-08          | US-802, US-804, US-806, **US-807**, **US-808** |
| EPIC-09          | US-901, US-902, US-903, US-904                 |
| **EPIC-10** ðŸ†• | **US-1004, US-1008, US-1010, US-1011**         |
| **EPIC-11** ðŸ†• | **US-1102, US-1103, US-1107, US-1108**         |
| **EPIC-12** ðŸ†• | **US-1201, US-1202, US-1203, US-1204**         |

**Total V1 : +28 US â†’ +40 User Stories (+12 US)**

---

### ðŸŸ¢ COULD HAVE (V2) â€” RÃ©fÃ©rencement SILL

| Epic             | Stories V2                                                                            |
| ---------------- | ------------------------------------------------------------------------------------- |
| EPIC-02          | US-208 (Dupliquer campagne)                                                           |
| EPIC-05          | US-508 (Feedback docs)                                                                |
| EPIC-06          | US-603 (VÃ©locitÃ©), US-606 (Aide contextuelle)                                     |
| EPIC-07          | US-705 (MÃ©triques docs)                                                             |
| EPIC-08          | US-803 (Workflows config), US-805 (Dupliquer type)                                    |
| **EPIC-10** ðŸ†• | **US-1009** (Notification agents non positionnÃ©s), **US-1012** (Infos intervention) |
| **EPIC-12** ðŸ†• | **US-1206** (Config notifications avancÃ©e)                                          |

**Total V2 : +8 US â†’ +11 User Stories (+3 US)**

---

## 5. Matrice de TraÃ§abilitÃ© â€” MISE Ã€ JOUR

| Epic             | User Flows P3.4       | Wireframes P3.4 | Personas P1.3                    | Contraintes P2.3             |
| ---------------- | --------------------- | --------------- | -------------------------------- | ---------------------------- |
| EPIC-01          | â€”                   | 3.11            | Marc                             | Comptes locaux V1            |
| EPIC-02          | Flow #1               | 3.5, 3.12       | Sophie                           | Source unique vÃ©ritÃ©     |
| EPIC-03          | Flow #1               | 3.5, 3.6        | Sophie                           | Champs JSONB config          |
| EPIC-04          | Flow #2               | 3.2, 3.3        | **Karim**                        | UX <5min, <2 clics           |
| EPIC-05          | Flow #4               | 3.3, 3.4, 3.8   | Sophie+Karim                     | Snapshot Pattern             |
| EPIC-06          | Flow #3               | 3.1, 3.4        | Sophie+Direction                 | Dashboard temps rÃ©el       |
| EPIC-07          | â€”                   | 3.10            | Sophie                           | Docs liÃ©s, pas orphelins   |
| EPIC-08          | â€”                   | 3.7             | Sophie (Admin)                   | Types opÃ©rations config    |
| EPIC-09          | â€”                   | 3.9             | Sophie                           | PrÃ©requis campagne         |
| **EPIC-10** ðŸ†• | **P1.3bis Â§5.3-5.4** | â€”             | **Agent, Manager, Coordinateur** | **UX Doctolib, 3 clics max** |
| **EPIC-11** ðŸ†• | **P1.3bis Â§4.2**     | â€”             | **Sophie**                       | **Abaques, capacitÃ© IT**   |
| **EPIC-12** ðŸ†• | **P1.3bis Â§4.6**     | â€”             | **Agent, Manager**               | **ICS, rappels auto**        |

---

## 6. Points de Validation Sponsor âœ… â€” COMPLÃ‰MENTS

### Nouvelles validations requises

| #       | Point                         | Question                                             | RÃ©ponse Sponsor |
| ------- | ----------------------------- | ---------------------------------------------------- | ----------------- |
| 7 ðŸ†•  | Auth carte agent              | MVP avec auth AD simple ou carte agent obligatoire ? | **Ã€ valider**    |
| 8 ðŸ†•  | Mode inscription par dÃ©faut | Quel mode par dÃ©faut ? (Agent / Manager)           | **Ã€ valider**    |
| 9 ðŸ†•  | Verrouillage J-X              | Valeur par dÃ©faut : J-2 acceptable ?               | **Ã€ valider**    |
| 10 ðŸ†• | Email rappel                  | DÃ©lai par dÃ©faut : J-2 acceptable ?              | **Ã€ valider**    |
| 11 ðŸ†• | Notifications obligatoires    | ICS obligatoire ou optionnel ?                       | **Ã€ valider**    |

---

## 7. SynthÃ¨se des Modifications

### RÃ©capitulatif des ajouts

| Ã‰lÃ©ment           | Version 1.0 | Version 2.0 | Delta |
| -------------------- | ----------- | ----------- | ----- |
| **Epics**            | 9           | 12          | +3    |
| **User Stories**     | 59          | 85          | +26   |
| **RÃ¨gles MÃ©tier** | ~30         | ~55         | +25   |
| **Stories MVP**      | 23          | 37          | +14   |
| **Stories V1**       | 28          | 40          | +12   |
| **Stories V2**       | 8           | 11          | +3    |

### Nouveaux Epics ajoutÃ©s

| Epic        | Nom                                 | Stories | PrioritÃ© dominante      |
| ----------- | ----------------------------------- | ------- | ------------------------- |
| **EPIC-10** | Interface RÃ©servation (End-Users) | 12 US   | MVP (6) + V1 (4) + V2 (2) |
| **EPIC-11** | Gestion des CrÃ©neaux & CapacitÃ© | 8 US    | MVP (4) + V1 (4)          |
| **EPIC-12** | Notifications & Agenda              | 6 US    | MVP (1) + V1 (4) + V2 (1) |

### Impact sur le planning estimÃ©

| Phase   | Estimation v1.0 | Estimation v2.0 | Delta       |
| ------- | --------------- | --------------- | ----------- |
| **MVP** | 8-10 semaines   | 12-14 semaines  | +4 semaines |
| **V1**  | +6-8 semaines   | +8-10 semaines  | +2 semaines |
| **V2**  | Ã€ dÃ©finir    | Ã€ dÃ©finir    | â€”         |

---

**Niveau de confiance : 98%**

_Les 2% d'incertitude portent sur : points sponsor Ã  valider (auth carte agent, modes par dÃ©faut), edge cases non documentÃ©s qui pourraient Ã©merger en dÃ©veloppement._

---

**Statut** : ðŸŸ¢ **P4.1 v2.0 COMPLET â€” PRÃŠT POUR VALIDATION SPONSOR**

_Prochaines Ã©tapes :_

1. Valider les 5 nouveaux points sponsor (Â§6)
2. Mettre Ã  jour P4.2 (Architecture) avec les nouveaux modules
3. Mettre Ã  jour P4.3 (Validation) avec la couverture des nouveaux besoins
