# P3.1 - Catalogue d'Options

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ’¡ **CATALOGUE D'OPTIONS (DIVERGENCE)** Nombre d'options gÃ©nÃ©rÃ©es : **21** Confiance globale : **92%**
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

---

## Contexte & Cadrage

### Ce que ce P3.1 traite

**OpsTracker n'est PAS un projet "Build vs Buy"**. Le POC POC Pilote existe et a validÃ© les concepts terrain. L'enjeu est de le **gÃ©nÃ©riciser** pour le rendre rÃ©utilisable entre organisations.

| Contrainte        | Valeur                                         | Source |
| ----------------- | ---------------------------------------------- | ------ |
| Framework         | **Symfony** (obligatoire organisation parente) | P0     |
| HÃ©bergement     | **Self-hosted** Organisation principale        | P0     |
| AccessibilitÃ©   | **RGAA 4.1** (obligation lÃ©gale)             | P0     |
| Licence           | **EUPL 1.2** (open source)                     | P2.1   |
| DonnÃ©es santÃ© | **JAMAIS** de NIR/donnÃ©es patients           | P2.1   |
| Mode dev          | **Vibe coding solo** (DSI = dÃ©veloppeur)     | P0     |

### Job-to-be-Done central

> _"Comment architecturer OpsTracker pour que Sophie puisse configurer n'importe quel type d'opÃ©ration (champs, statuts, segments, checklists) SANS dÃ©veloppeur, tout en garantissant Ã  Karim une UX terrain ultra-simple ?"_

### Les 7 domaines de dÃ©cision architecturale

| Domaine                      | Question clÃ©                                            |
| ---------------------------- | --------------------------------------------------------- |
| **A - ModÃ¨le de donnÃ©es** | Comment gÃ©rer les champs configurables par Sophie ?     |
| **B - Workflows/Statuts**    | Comment permettre des statuts et transitions dynamiques ? |
| **C - Frontend**             | Comment servir Sophie (admin) ET Karim (terrain) ?        |
| **D - Backoffice**           | Comment Sophie configure-t-elle sans toucher au code ?    |
| **E - Checklists**           | Comment protÃ©ger les checklists "in progress" ?         |
| **F - Import/Export**        | Comment gÃ©rer les volumes CSV ?                         |
| **G - Audit**                | Comment garantir la traÃ§abilitÃ© secteur public ?       |

---

## 1. Les "Low-Hanging Fruits" (Architecture simple & Ã©prouvÃ©e)

_(Approches classiques Symfony, bien documentÃ©es, faible risque)_

| #   | Nom de l'option          | Description (Le "Quoi")                                                                                                             | Pourquoi Ã§a marche ?                                                                                              |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | **"Doctrine Classique"** | EntitÃ©s fixes avec tous les champs possibles. Les champs non utilisÃ©s restent NULL. Pas de JSONB, pas de magie.                 | Ultra-simple, 0 risque, Doctrine standard. Mais rigide : chaque nouveau champ = migration + dÃ©ploiement.         |
| 2   | **"EasyAdmin Express"**  | EasyAdmin 4 comme backoffice de configuration pour Sophie. CRUD auto-gÃ©nÃ©rÃ©, dashboards intÃ©grÃ©s, formulaires dynamiques. | Bundle mature (4M+ installs), bien maintenu, UX admin correcte out-of-box. Courbe d'apprentissage faible.          |
| 3   | **"Twig Turbo"**         | Frontend 100% Twig + Symfony UX Turbo + Stimulus. Pas de SPA, pas de build JS, HTML progressif.                                     | AccessibilitÃ© native (HTML sÃ©mantique), pas de complexitÃ© React/Vue, rendu serveur = cache facile.           |
| 4   | **"CSV Artisan"**        | Import/Export CSV via League\Csv avec mapping manuel dans le code. Simple, synchrone, fichiers < 10k lignes.                        | BibliothÃ¨que lÃ©gÃ¨re, bien testÃ©e, pas d'infra supplÃ©mentaire. Suffisant pour 90% des cas organisationnels. |

---

## 2. Les Solutions "Product" (Architecture robuste & scalable)

_(Patterns Ã©prouvÃ©s pour configurabilitÃ© et Ã©volutivitÃ©)_

| #   | Nom de l'option          | Description                                                                                                                                                                             | Trade-off clÃ©                                                                                    |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 5   | **"JSONB Flex"**         | Champs dynamiques stockÃ©s en PostgreSQL JSONB avec index GIN. Structure hybride : colonnes fixes pour les champs systÃ¨me + JSONB pour les champs custom configurÃ©s par Sophie.     | **FlexibilitÃ© maximale** vs ComplexitÃ© requÃªtes. Perf excellente avec bons index.             |
| 6   | **"EAV StructurÃ©"**    | Pattern Entity-Attribute-Value classique avec tables sÃ©parÃ©es (attribute_definitions, attribute_values). Typage fort, validation native.                                            | **IntÃ©gritÃ© donnÃ©es** vs RequÃªtes N+1, JOINs complexes, perf dÃ©gradÃ©e sur gros volumes. |
| 7   | **"Workflow Engine"**    | Symfony Workflow Component pour tous les statuts. DÃ©finitions YAML chargÃ©es dynamiquement depuis la BDD. Guards, transitions, events.                                               | **Workflows mÃ©tier robustes** vs Configuration initiale plus lourde.                             |
| 8   | **"Workflower BPMN"**    | Moteur BPMN 2.0 complet (phpmentors/workflower) avec bundle Symfony. Compatible Ã©diteur Camunda.                                                                                      | **Standard industrie** vs Overkill pour workflows simples.                                         |
| 9   | **"API Platform Core"**  | API Platform 3 comme fondation. API REST/GraphQL auto-gÃ©nÃ©rÃ©e, admin React intÃ©grÃ©, OpenAPI natif.                                                                            | **DÃ©couplage fort** vs Deux stacks Ã  maintenir (PHP + JS).                                      |
| 10  | **"Messenger Async"**    | Symfony Messenger pour imports CSV volumineux, notifications, et traitements lourds. Workers asynchrones, retry automatique.                                                            | **ScalabilitÃ©** vs Infra supplÃ©mentaire (Redis/RabbitMQ).                                      |
| 11  | **"Snapshot Checklist"** | Pattern Snapshot pour checklists : Ã  l'assignation, la structure du template est copiÃ©e dans un champ JSONB de l'instance. Modifications template n'affectent pas les "in progress". | **Protection garantie** vs Duplication donnÃ©es. RÃ©sout LE problÃ¨me du POC Pilote.             |
| 12  | **"Gedmo Audit"**        | Extension Gedmo Loggable pour audit trail automatique. Versioning de toutes les entitÃ©s critiques. Qui a fait quoi, quand.                                                            | **TraÃ§abilitÃ© complÃ¨te** vs Overhead stockage. Essentiel secteur public.                       |

---

## 3. Les "Moonshots" & Approches Radicales

_(Innovation architecturale â€” Ã©valuÃ©es puis Ã©cartÃ©es V1)_

| #   | Nom de l'option              | Le concept                                                                              | Statut                                                         |
| --- | ---------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 13  | **"Config-as-Code"**         | Configuration (champs, workflows) en YAML versionnÃ© Git. Ã‰dition UI â†’ commit auto. | âŒ **Ã‰cartÃ©** â€” Tout passe par console admin, pas de Git  |
| 14  | **"Event Sourcing Ops"**     | Chaque changement = Ã©vÃ©nement immutable. Ã‰tat = projection. CQRS complet.          | âŒ **Ã‰cartÃ©** â€” Over-engineering pour le besoin           |
| 15  | **"Multi-Bundle Modulaire"** | Un bundle Symfony par module (PlanningBundle, ChecklistBundle...).                      | âŒ **Ã‰cartÃ©** â€” ComplexitÃ© inutile, monolithe suffit V1 |
| 16  | **"Schema-Driven UI"**       | JSON Schema gÃ©nÃ¨re auto les formulaires + UI.                                        | âŒ **Ã‰cartÃ©** â€” EasyAdmin + JSONB suffisent               |

---

## 4. Les Solutions "Out-of-the-Box" (Patterns d'autres contextes)

_(InspirÃ© d'autres domaines â€” Ã©valuÃ©s selon pertinence V1)_

| #   | Nom de l'option            | InspirÃ© de     | Concept transposÃ©                                                                      | Statut                                                        |
| --- | -------------------------- | ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 17  | **"Headless CMS Pattern"** | Strapi, Directus | Sophie dÃ©finit les "content types" via admin.                                          | âš ï¸ InspirÃ© â€” JSONB Flex + EasyAdmin couvrent le besoin |
| 18  | **"Feature Flags Ops"**    | LaunchDarkly     | FonctionnalitÃ©s activables/dÃ©sactivables par organisation.                           | ðŸ’¡ **V2** â€” IntÃ©ressant pour multi-organisations        |
| 19  | **"Template Marketplace"** | WordPress themes | BibliothÃ¨que de templates de campagnes prÃ©-configurÃ©s. Partage inter-organisations. | ðŸ’¡ **V2** â€” En V1 : import/export CSV de config           |
| 20  | **"Offline-First PWA"**    | Fieldwire        | Service Workers + IndexedDB pour Karim hors-ligne.                                       | âŒ **Ã‰cartÃ©** â€” Karim a toujours du rÃ©seau             |

---

## 5. L'Option NuclÃ©aire (Baseline)

| #   | Option                    | Description                                                                                      | CoÃ»t de l'inaction                                                                                                                                                                            |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **"POC Pilote Tel Quel"** | Garder le POC POC Pilote sans le gÃ©nÃ©riciser. Chaque organisation fork et adapte elle-mÃªme. | **Duplication** : 4 organisations = 4 forks divergents. **RigiditÃ©** : Chaque adaptation = dev custom. **Estimation** : 3-6 mois/organisation vs 4-6 semaines pour gÃ©nÃ©riciser une fois. |

---

## 6. SynthÃ¨se : Les Familles de Solutions

### ðŸ—„ï¸ **Famille A â€” ModÃ¨le de DonnÃ©es**

_Question : Comment gÃ©rer les champs configurables par Sophie ?_

| Option                | FlexibilitÃ© | Performance | ComplexitÃ© | Verdict              |
| --------------------- | ------------- | ----------- | ------------ | -------------------- |
| #1 Doctrine Classique | â­            | â­â­â­â­â­  | â­           | âŒ Trop rigide       |
| #5 JSONB Flex         | â­â­â­â­â­    | â­â­â­â­    | â­â­â­       | âœ… **RETENU**       |
| #6 EAV StructurÃ©    | â­â­â­â­      | â­â­        | â­â­â­â­     | âŒ Perf insuffisante |

---

### âš™ï¸ **Famille B â€” Gestion des Workflows/Statuts**

_Question : Comment permettre des statuts et transitions dynamiques ?_

| Option             | Standard      | FlexibilitÃ© | Courbe apprentissage | Verdict        |
| ------------------ | ------------- | ------------- | -------------------- | -------------- |
| #7 Workflow Engine | Symfony natif | â­â­â­â­      | â­â­                 | âœ… **RETENU** |
| #8 Workflower BPMN | BPMN 2.0      | â­â­â­â­â­    | â­â­â­â­             | âŒ Overkill V1 |

---

### ðŸ–¥ï¸ **Famille C â€” Stack Frontend**

_Question : Comment servir Sophie (admin) ET Karim (terrain) ?_

| Option               | AccessibilitÃ© RGAA       | ComplexitÃ© | Maintenance | Verdict               |
| -------------------- | -------------------------- | ------------ | ----------- | --------------------- |
| #3 Twig Turbo        | â­â­â­â­â­ (HTML natif)    | â­â­         | â­â­        | âœ… **RETENU**        |
| #9 API Platform Core | â­â­â­ (dÃ©pend du front) | â­â­â­â­     | â­â­â­â­    | âŒ Trop complexe solo |

---

### ðŸ› ï¸ **Famille D â€” Backoffice Configuration**

_Question : Comment Sophie configure-t-elle sans toucher au code ?_

| Option               | MaturitÃ© | Personnalisation | UX Admin | Verdict        |
| -------------------- | ---------- | ---------------- | -------- | -------------- |
| #2 EasyAdmin Express | â­â­â­â­â­ | â­â­â­           | â­â­â­â­ | âœ… **RETENU** |

---

### âœ… **Famille E â€” Protection Checklists**

_Question : Comment Ã©viter l'Ã©crasement du suivi quand Sophie modifie un template ?_

| Option                 | Garantie protection | ComplexitÃ© | Audit      | Verdict             |
| ---------------------- | ------------------- | ------------ | ---------- | ------------------- |
| #11 Snapshot Checklist | â­â­â­â­â­          | â­â­         | â­â­â­     | âœ… **RETENU**      |
| #14 Event Sourcing     | â­â­â­â­â­          | â­â­â­â­â­   | â­â­â­â­â­ | âŒ Over-engineering |

---

### ðŸ“¦ **Famille F â€” Import/Export**

_Question : Comment gÃ©rer les volumes CSV ?_

| Option                   | Volumes supportÃ©s | Infra requise  | ComplexitÃ© | Verdict             |
| ------------------------ | ------------------- | -------------- | ------------ | ------------------- |
| #4 CSV Artisan           | < 10k lignes        | Aucune         | â­           | âœ… **RETENU V1**   |
| #10 Messenger Async      | IllimitÃ©          | Redis/RabbitMQ | â­â­â­       | ðŸ’¡ V1.1 si besoin |
| #19 Template Marketplace | N/A (config)        | Aucune         | â­â­         | ðŸ’¡ **V2**         |

---

### ðŸ“ **Famille G â€” TraÃ§abilitÃ© & Audit**

_Question : Comment garantir la traÃ§abilitÃ© secteur public ?_

| Option          | Couverture | Effort intÃ©gration | Verdict        |
| --------------- | ---------- | -------------------- | -------------- |
| #12 Gedmo Audit | â­â­â­â­â­ | â­â­                 | âœ… **RETENU** |

---

## 7. Combinaison Retenue â€” Architecture OpsTracker V1

### Vue d'ensemble

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        FRONTEND                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                     â”‚
â”‚  â”‚   Sophie (Admin) â”‚    â”‚  Karim (Terrain) â”‚                    â”‚
â”‚  â”‚   EasyAdmin 4    â”‚    â”‚  Twig + Turbo    â”‚                    â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
            â”‚                      â”‚
            â–¼                      â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     SYMFONY 7.x                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”          â”‚
â”‚  â”‚   Workflow    â”‚  â”‚   League\Csv â”‚  â”‚    Gedmo     â”‚          â”‚
â”‚  â”‚  Component    â”‚  â”‚   (import)   â”‚  â”‚  Loggable    â”‚          â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
            â”‚
            â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    POSTGRESQL 15+                                â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”          â”‚
â”‚  â”‚  Colonnes fixes    â”‚    JSONB (champs custom)     â”‚          â”‚
â”‚  â”‚  id, status, ...   â”‚    {"matricule": "A123", ...}â”‚          â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜          â”‚
â”‚                    + Index GIN                                   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Stack technique

| Couche              | Choix                | Bundle/Lib                      | Justification                  |
| ------------------- | -------------------- | ------------------------------- | ------------------------------ |
| **DonnÃ©es**       | #5 JSONB Flex        | Doctrine + PostgreSQL           | FlexibilitÃ© + Performance    |
| **Workflows**       | #7 Symfony Workflow  | `symfony/workflow`              | Natif, configurable en BDD     |
| **Frontend Sophie** | #2 EasyAdmin 4       | `easycorp/easyadmin-bundle`     | Rapide, mature, 4M+ installs   |
| **Frontend Karim**  | #3 Twig + Turbo      | `symfony/ux-turbo` + `stimulus` | RGAA natif, pas de build JS    |
| **Checklists**      | #11 Snapshot Pattern | Custom (JSONB)                  | RÃ©sout problÃ¨me POC Pilote  |
| **Import CSV**      | #4 CSV Artisan       | `league/csv`                    | LÃ©gÃ¨re, performante         |
| **Export Config**   | CSV de templates     | `league/csv`                    | Partage inter-organisations V1 |
| **Audit**           | #12 Gedmo Loggable   | `gedmo/doctrine-extensions`     | Standard secteur public        |

---

## 8. DÃ©tail Technique de la Combinaison Retenue

### 8.1 JSONB Flex â€” ModÃ¨le de DonnÃ©es Hybride

**Principe** : Structure hybride avec colonnes fixes (systÃ¨me) + JSONB (champs custom de Sophie).

#### Structure de donnÃ©es

```
â”Œâ”€ Table: operation_type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                                                                 â”‚
â”‚  id (UUID)                                                      â”‚
â”‚  name: "Migration Windows 11"                                   â”‚
â”‚  slug: "migration-w11"                                          â”‚
â”‚  field_schema: {                    â—„â”€â”€ DÃ©finition des champs  â”‚
â”‚    "fields": [                          configurÃ©s par Sophie   â”‚
â”‚      {                                                          â”‚
â”‚        "name": "matricule",                                     â”‚
â”‚        "label": "Matricule Agent",                              â”‚
â”‚        "type": "string",                                        â”‚
â”‚        "required": true,                                        â”‚
â”‚        "searchable": true                                       â”‚
â”‚      },                                                         â”‚
â”‚      {                                                          â”‚
â”‚        "name": "num_poste",                                     â”‚
â”‚        "label": "NÂ° Poste",                                     â”‚
â”‚        "type": "string",                                        â”‚
â”‚        "required": true                                         â”‚
â”‚      },                                                         â”‚
â”‚      {                                                          â”‚
â”‚        "name": "bureau",                                        â”‚
â”‚        "label": "Bureau",                                       â”‚
â”‚        "type": "string",                                        â”‚
â”‚        "required": false                                        â”‚
â”‚      }                                                          â”‚
â”‚    ]                                                            â”‚
â”‚  }                                                              â”‚
â”‚  workflow_name: "operation_standard"  â—„â”€â”€ Lien vers workflow   â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€ Table: operation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                                                                 â”‚
â”‚  COLONNES FIXES (systÃ¨me)         JSONB (configurable)         â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€        â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€         â”‚
â”‚  id (UUID)                        custom_fields: {             â”‚
â”‚  operation_type_id (FK)             "matricule": "A12345",     â”‚
â”‚  status (VARCHAR)                   "num_poste": "PC-0042",    â”‚
â”‚  assigned_to (FK User)              "bureau": "B204"           â”‚
â”‚  scheduled_at (TIMESTAMP)         }                            â”‚
â”‚  created_at (TIMESTAMP)                                        â”‚
â”‚  updated_at (TIMESTAMP)                                        â”‚
â”‚  created_by (FK User)                                          â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### EntitÃ© Doctrine

```php
#[ORM\Entity(repositoryClass: OperationRepository::class)]
#[Gedmo\Loggable]
class Operation
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: OperationType::class)]
    #[ORM\JoinColumn(nullable: false)]
    private OperationType $operationType;

    #[ORM\Column(length: 50)]
    #[Gedmo\Versioned]
    private string $status = 'a_planifier';

    #[ORM\Column(type: Types::JSON, options: ['jsonb' => true])]
    #[Gedmo\Versioned]
    private array $customFields = [];

    #[ORM\ManyToOne(targetEntity: User::class)]
    private ?User $assignedTo = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $scheduledAt = null;

    // Accesseurs dynamiques
    public function getCustomField(string $name): mixed
    {
        return $this->customFields[$name] ?? null;
    }

    public function setCustomField(string $name, mixed $value): self
    {
        $this->customFields[$name] = $value;
        return $this;
    }
}
```

#### Index PostgreSQL

```sql
-- Index GIN pour recherches JSONB
CREATE INDEX idx_operation_custom_fields
ON operation USING GIN (custom_fields jsonb_path_ops);

-- Index partiel pour champs frÃ©quemment recherchÃ©s
CREATE INDEX idx_operation_matricule
ON operation ((custom_fields->>'matricule'))
WHERE custom_fields->>'matricule' IS NOT NULL;
```

#### Ce que Ã§a permet Ã  Sophie

| Action                                        | Comment                                          |
| --------------------------------------------- | ------------------------------------------------ |
| CrÃ©er un type d'opÃ©ration avec ses champs | Via EasyAdmin, Ã©diteur JSON du `field_schema`  |
| Importer un CSV                               | Mapping visuel colonnes â†’ champs custom        |
| Filtrer/rechercher sur n'importe quel champ   | Index GIN, requÃªtes JSONB                       |
| Ajouter un champ en cours d'opÃ©ration       | Modification du `field_schema`, zÃ©ro migration |

---

### 8.2 Symfony Workflow â€” Statuts Dynamiques

**Principe** : Workflows stockÃ©s en BDD, chargÃ©s dynamiquement. Sophie dÃ©finit ses statuts et transitions via EasyAdmin.

#### Structure de donnÃ©es

```
â”Œâ”€ Table: workflow_definition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                                                                 â”‚
â”‚  id: "workflow_migration_w11"                                   â”‚
â”‚  name: "Workflow Migration Windows 11"                          â”‚
â”‚  definition: {                                                  â”‚
â”‚    "places": [                                                  â”‚
â”‚      {"name": "a_planifier", "label": "Ã€ planifier", "color": "#9ca3af"},
â”‚      {"name": "planifie", "label": "PlanifiÃ©", "color": "#3b82f6"},
â”‚      {"name": "en_cours", "label": "En cours", "color": "#f97316"},
â”‚      {"name": "realise", "label": "RÃ©alisÃ©", "color": "#22c55e"},
â”‚      {"name": "reporte", "label": "ReportÃ©", "color": "#ef4444"},
â”‚      {"name": "a_remedier", "label": "Ã€ remÃ©dier", "color": "#a855f7"}
â”‚    ],                                                           â”‚
â”‚    "transitions": [                                             â”‚
â”‚      {                                                          â”‚
â”‚        "name": "planifier",                                     â”‚
â”‚        "from": ["a_planifier"],                                 â”‚
â”‚        "to": "planifie",                                        â”‚
â”‚        "allowed_roles": ["ROLE_GESTIONNAIRE", "ROLE_ADMIN"]     â”‚
â”‚      },                                                         â”‚
â”‚      {                                                          â”‚
â”‚        "name": "demarrer",                                      â”‚
â”‚        "from": ["planifie"],                                    â”‚
â”‚        "to": "en_cours",                                        â”‚
â”‚        "allowed_roles": ["ROLE_TECHNICIEN"]                     â”‚
â”‚      },                                                         â”‚
â”‚      {                                                          â”‚
â”‚        "name": "terminer",                                      â”‚
â”‚        "from": ["en_cours"],                                    â”‚
â”‚        "to": "realise",                                         â”‚
â”‚        "allowed_roles": ["ROLE_TECHNICIEN"]                     â”‚
â”‚      },                                                         â”‚
â”‚      {                                                          â”‚
â”‚        "name": "reporter",                                      â”‚
â”‚        "from": ["planifie", "en_cours"],                        â”‚
â”‚        "to": "reporte",                                         â”‚
â”‚        "requires_comment": true                                 â”‚
â”‚      }                                                          â”‚
â”‚    ],                                                           â”‚
â”‚    "initial_place": "a_planifier"                               â”‚
â”‚  }                                                              â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### Ce que Ã§a permet Ã  Sophie

| Action                    | Comment                                      |
| ------------------------- | -------------------------------------------- |
| DÃ©finir les statuts     | Ajout dans `places` avec nom, label, couleur |
| DÃ©finir les transitions | Ajout dans `transitions` avec from/to        |
| Restreindre par rÃ´le     | `allowed_roles` sur chaque transition        |
| Exiger un commentaire     | `requires_comment: true` (ex: report)        |
| Visualiser le workflow    | Export GraphViz automatique                  |

---

### 8.3 Twig + Turbo â€” Frontend Accessible

**Principe** : HTML serveur classique, rÃ©activitÃ© via Turbo Frames. RGAA 4.1 by design.

#### Structure des vues

```
templates/
â”œâ”€â”€ terrain/                          # Interface Karim
â”‚   â”œâ”€â”€ base.html.twig               # Layout Ã©purÃ©
â”‚   â”œâ”€â”€ mes_interventions.html.twig  # Vue par dÃ©faut
â”‚   â”œâ”€â”€ intervention/
â”‚   â”‚   â”œâ”€â”€ show.html.twig           # DÃ©tail intervention
â”‚   â”‚   â”œâ”€â”€ _checklist.html.twig     # Turbo Frame checklist
â”‚   â”‚   â””â”€â”€ _status_buttons.html.twig
â”‚   â””â”€â”€ components/
â”‚       â”œâ”€â”€ _card.html.twig          # Carte intervention
â”‚       â””â”€â”€ _doc_modal.html.twig     # Modal documentation
â”‚
â”œâ”€â”€ admin/                            # Via EasyAdmin (auto-gÃ©nÃ©rÃ©)
â”‚   â””â”€â”€ dashboard.html.twig          # Dashboard Sophie custom
```

#### Principes RGAA intÃ©grÃ©s

| CritÃ¨re RGAA           | ImplÃ©mentation                               |
| ----------------------- | ---------------------------------------------- |
| Contraste 4.5:1         | Variables CSS avec couleurs validÃ©es         |
| Focus visible           | `outline: 3px solid` sur `:focus-visible`      |
| Pas de couleur seule    | IcÃ´nes + texte en plus des couleurs de statut |
| Cibles tactiles 44x44px | `min-height: 44px` sur tous les boutons        |
| Navigation clavier      | HTML sÃ©mantique, `tabindex` appropriÃ©s     |
| RÃ©duction animations  | `@media (prefers-reduced-motion)`              |

---

### 8.4 EasyAdmin â€” Backoffice Sophie

**Principe** : CRUD complet pour toute la configuration, sans code.

#### Menu Sophie

```
ðŸ“Š Tableau de bord
â”‚
â”œâ”€â”€ ðŸ“‹ OpÃ©rations
â”‚   â”œâ”€â”€ OpÃ©rations en cours
â”‚   â””â”€â”€ Types d'opÃ©rations      â—„â”€â”€ DÃ©finition champs custom
â”‚
â”œâ”€â”€ âš™ï¸ Configuration
â”‚   â”œâ”€â”€ Workflows               â—„â”€â”€ DÃ©finition statuts/transitions
â”‚   â”œâ”€â”€ Checklists              â—„â”€â”€ Templates de checklists
â”‚   â””â”€â”€ Documents               â—„â”€â”€ Base documentaire
â”‚
â”œâ”€â”€ ðŸ“¥ Import/Export
â”‚   â”œâ”€â”€ Importer CSV            â—„â”€â”€ Upload + mapping
â”‚   â””â”€â”€ Exporter configuration  â—„â”€â”€ CSV des templates (partage inter-organisations)
â”‚
â””â”€â”€ ðŸ‘¥ Utilisateurs
    â””â”€â”€ Gestion des comptes
```

---

### 8.5 Snapshot Checklist â€” Protection In Progress

**Principe** : Ã€ l'assignation, la structure du template est **copiÃ©e** dans l'instance. Sophie peut modifier le template sans affecter les checklists en cours.

#### Structure de donnÃ©es

```
â”Œâ”€ Table: checklist_template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                                                                 â”‚
â”‚  id: "tpl_migration_w11"                                        â”‚
â”‚  name: "Checklist Migration Windows 11"                         â”‚
â”‚  version: 3                                                     â”‚
â”‚  structure: {                                                   â”‚
â”‚    "phases": [                                                  â”‚
â”‚      {                                                          â”‚
â”‚        "name": "PrÃ©paration",                                   â”‚
â”‚        "items": [                                               â”‚
â”‚          {"id": "prep_1", "label": "Sauvegarder profil", "doc_id": "doc_123"},
â”‚          {"id": "prep_2", "label": "VÃ©rifier espace disque"}    â”‚
â”‚        ]                                                        â”‚
â”‚      },                                                         â”‚
â”‚      {                                                          â”‚
â”‚        "name": "Migration",                                     â”‚
â”‚        "items": [                                               â”‚
â”‚          {"id": "mig_1", "label": "Lancer script", "doc_id": "doc_456"},
â”‚          {"id": "mig_2", "label": "VÃ©rifier dÃ©marrage W11"}     â”‚
â”‚        ]                                                        â”‚
â”‚      }                                                          â”‚
â”‚    ]                                                            â”‚
â”‚  }                                                              â”‚
â”‚  is_active: true                                                â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€ Table: checklist_instance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                                                                 â”‚
â”‚  id: "inst_abc123"                                              â”‚
â”‚  operation_id: "op_xyz789"                                      â”‚
â”‚  template_id: "tpl_migration_w11"                               â”‚
â”‚  template_version: 3                â—„â”€â”€ Version figÃ©e           â”‚
â”‚  snapshot_structure: { ... }        â—„â”€â”€ COPIE au moment assign  â”‚
â”‚  progress: {                        â—„â”€â”€ Avancement Karim        â”‚
â”‚    "prep_1": {"checked": true, "checked_at": "...", "checked_by": "karim"},
â”‚    "prep_2": {"checked": true, "checked_at": "...", "checked_by": "karim"},
â”‚    "mig_1": {"checked": false}                                  â”‚
â”‚  }                                                              â”‚
â”‚  started_at: "2025-01-18T10:20:00"                              â”‚
â”‚  completed_at: null                                             â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### Ce que Ã§a garantit

| ScÃ©nario                 | Comportement                                                     |
| -------------------------- | ---------------------------------------------------------------- |
| Sophie modifie un template | Seules les NOUVELLES interventions utilisent la nouvelle version |
| Karim continue son travail | Sa checklist reste stable, progression prÃ©servÃ©e             |
| Audit                      | On sait quelle version du template Ã©tait utilisÃ©e            |

---

### 8.6 CSV Artisan â€” Import Simple

**Principe** : Import en 3 Ã©tapes avec mapping visuel.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Upload CSV  â”‚ â”€â”€â–º â”‚   Preview   â”‚ â”€â”€â–º â”‚   Mapping   â”‚ â”€â”€â–º â”‚   Import    â”‚
â”‚             â”‚     â”‚ (10 lignes) â”‚     â”‚  colonnes   â”‚     â”‚  (batch)    â”‚
â”‚             â”‚     â”‚             â”‚     â”‚  â†’ champs   â”‚     â”‚             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Export configuration** (V1) : Export CSV des types d'opÃ©rations et templates pour partage inter-organisations.

---

### 8.7 Gedmo Audit â€” TraÃ§abilitÃ©

**Principe** : Chaque modification tracÃ©e automatiquement.

```
â”Œâ”€ Table: ext_log_entries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                                                                 â”‚
â”‚  id: 1                                                          â”‚
â”‚  action: "update"                                               â”‚
â”‚  logged_at: "2025-01-18 14:32:00"                               â”‚
â”‚  object_id: "op_xyz789"                                         â”‚
â”‚  object_class: "App\Entity\Operation"                           â”‚
â”‚  version: 3                                                     â”‚
â”‚  data: {"status": "realise"}        â—„â”€â”€ Nouvelle valeur         â”‚
â”‚  username: "karim@demo.opstracker.local"          â—„â”€â”€ Qui a modifiÃ©           â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 9. Roadmap des Options

| Option                   | V1  | V1.1 | V2  |
| ------------------------ | :-: | :--: | :-: |
| #5 JSONB Flex            | âœ… |      |     |
| #7 Symfony Workflow      | âœ… |      |     |
| #3 Twig + Turbo          | âœ… |      |     |
| #2 EasyAdmin             | âœ… |      |     |
| #11 Snapshot Checklist   | âœ… |      |     |
| #4 CSV Artisan           | âœ… |      |     |
| #12 Gedmo Audit          | âœ… |      |     |
| #10 Messenger Async      |     | âœ…  |     |
| #19 Template Marketplace |     |      | âœ… |
| #18 Feature Flags        |     |      | âœ… |

---

## 10. Points ValidÃ©s avec le Sponsor âœ…

| #   | Question                                                             | DÃ©cision                                           |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Options cloud US (Notion, etc.) acceptables ?                        | âŒ V1 ou rien â€” self-hosted obligatoire            |
| 2   | Moonshots (#13-16) pour V2 ?                                         | âŒ Ã‰cartÃ© â€” tout via console admin intÃ©grÃ©e |
| 3   | Analogies UX (#15-18) culturellement OK ?                            | âŒ Ã‰cartÃ© â€” non envisageable en organisation    |
| 4   | PrioritÃ© vitesse vs fit parfait ?                                  | **Fit parfait** â€” vitesse via vibe coding          |
| 5   | Offline-First (#20) nÃ©cessaire V1 ?                                | âŒ Karim a toujours du rÃ©seau                      |
| 6   | Template Marketplace (#19) V1 ou V2 ?                                | ðŸ’¡ **V2** â€” En V1 : import/export CSV de config  |
| 7   | Combinaison JSONB + Workflow + Twig + EasyAdmin + Snapshot + Gedmo ? | âœ… **ValidÃ©e**                                    |

---

**Niveau de confiance : 92%**

_Les 8% d'incertitude portent sur la complexitÃ© rÃ©elle du workflow dynamique chargÃ© depuis la BDD (Ã  prototyper) et sur les cas limites du JSONB avec des volumes > 10k opÃ©rations._

---

**Statut** : ðŸŸ¢ **P3.1 VALIDÃ‰ â€” COMBINAISON ARCHITECTURE RETENUE**

_Prochaine Ã©tape : P3.2 (Benchmark) si comparaison souhaitÃ©e OU P3.4 (Concept) directement_
