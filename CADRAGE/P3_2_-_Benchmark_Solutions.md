# P3.2 - Benchmark

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 **BENCHMARK SOLUTIONS — EN ATTENTE VALIDATION** Confiance globale : **88%**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## 1. Rappel du Besoin & Critères d'Évaluation

### 1.1 Ce qu'est OpsTracker (Use Case Réel)

**Pilotage d'opérations IT de masse PLANIFIÉES** :

- Migrations postes Windows (ex: 847 postes sur 6 mois)
- Renouvellements matériels par vagues
- Déploiements logiciels coordonnés

**Ce que ce n'est PAS** :

- ❌ FSM (Field Service Management) = interventions **réactives** chez des clients **externes**
- ❌ ITSM/Helpdesk = ticketing incident/demande
- ❌ Gestion de parc = inventaire (→ GLPI existe)

### 1.2 Critères d'Évaluation (Contraintes Non-Négociables)

| Critère             | Exigence                                        | Éliminatoire ? |
| ------------------- | ----------------------------------------------- | :------------: |
| **Stack technique** | Symfony (PHP) — contrainte organisation parente |     ✅ OUI     |
| **Hébergement**     | Self-hosted on-premise                          |     ✅ OUI     |
| **Accessibilité**   | RGAA 4.1 / WCAG 2.1 AA — obligation légale      |     ✅ OUI     |
| **Licence**         | Open source compatible EUPL 1.2                 |   ⚠️ Préféré   |
| **Langue**          | Interface française                             |   ⚠️ Préféré   |
| **Coût**            | Budget limité (pas de licence >10k€/an)         |   ⚠️ Préféré   |

### 1.3 Critères Fonctionnels Clés

| Fonctionnalité                              | Importance | Source                |
| ------------------------------------------- | :--------: | --------------------- |
| Campagnes multi-cibles (centaines/milliers) | Must Have  | P0, P1.1              |
| Champs configurables sans code              | Must Have  | P0                    |
| Workflows/statuts dynamiques                | Must Have  | P0                    |
| Checklists multi-phases protégées           | Must Have  | P0 (leçon POC Pilote) |
| Dashboard temps réel                        | Must Have  | P0                    |
| Import CSV avec mapping                     | Must Have  | P0                    |
| Base documentaire contextuelle              | Must Have  | P0                    |
| Audit trail complet                         | Must Have  | P2.1                  |

---

## 2. Panorama des Solutions Analysées

### 2.1 Catégorie "Digital Platform Conductor" (Spécialisé Migrations IT)

Gartner a formalisé cette catégorie en 2021 pour décrire exactement le besoin OpsTracker. Maturité attendue : 2026-2031.

| Solution            | Description                                                                                                  | Pricing Réel                                                          | Stack               |     Self-Hosted     |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------- | :-----------------: |
| **Juriba DPC** (UK) | Leader DPC. Agrégation multi-sources, planification par vagues, communications T-moins, portail self-service | 4$/device/an (analyse) → 15$/device/an (complet). **Min 12k-40k$/an** | Propriétaire (.NET) |      ✅ Option      |
| **ReadyWorks** (US) | Focus Windows lifecycle. Intégration SCCM/Intune. Fortune 500                                                | Non public (enterprise)                                               | Propriétaire        | ⚠️ SaaS prioritaire |

**Analyse honnête Juriba DPC** :

| Critère OpsTracker     | Juriba DPC               | Verdict          |
| ---------------------- | ------------------------ | ---------------- |
| Stack Symfony          | ❌ .NET propriétaire     | **ÉLIMINATOIRE** |
| RGAA 4.1 certifié      | ❌ Non                   | **ÉLIMINATOIRE** |
| Interface française    | ❌ Anglais uniquement    | Bloquant         |
| Budget <10k€/an        | ❌ Min 12-40k$/an        | Bloquant         |
| Fonctionnalités métier | ✅ Excellent (référence) | Inspiration      |

**Verdict catégorie DPC** : ⭐ **INSPIRATION MÉTIER, PAS SOLUTION VIABLE**

Les DPC sont la **référence fonctionnelle** du use case mais sont **totalement incompatibles** avec les contraintes organisationnelles (stack, langue, prix, RGAA).

---

### 2.2 Catégorie FSM (Field Service Management)

**⚠️ CLARIFICATION IMPORTANTE** : Le FSM est une catégorie **fondamentalement différente** du besoin OpsTracker.

| Dimension          | FSM (Odoo, ServiceMax, Salesforce FSM)             | Pilotage IT interne (OpsTracker)          |
| ------------------ | -------------------------------------------------- | ----------------------------------------- |
| **Mode**           | Réactif (client appelle → technicien dispatché)    | Proactif (campagne planifiée → exécution) |
| **Cible**          | Sites clients externes, inconnus                   | Parc interne connu, bureaux fixes         |
| **Unité**          | Bon d'intervention individuel                      | Campagne de N cibles groupées             |
| **Métrique clé**   | Temps résolution, facturation                      | % avancement, vélocité déploiement        |
| **Fonctions clés** | GPS, optimisation trajets, signatures, facturation | Checklists, dashboard, prérequis          |
| **Horizon**        | Heures/jours                                       | Semaines/mois                             |

**Analyse Odoo FSM** :

| Critère                 | Odoo FSM                                     | Verdict             |
| ----------------------- | -------------------------------------------- | ------------------- |
| Use case                | Interventions réactives externes facturables | **HORS SUJET**      |
| Stack                   | Python (pas Symfony)                         | **ÉLIMINATOIRE**    |
| Licence                 | Enterprise payant (FSM pas en Community)     | Bloquant            |
| Ce qui est transposable | Patterns UX (Kanban, Gantt, vue mobile)      | Inspiration limitée |

**Verdict Odoo FSM** : ⭐⭐ **INSPIRATION UX PARTIELLE, PAS COMPARABLE FONCTIONNEL**

J'avais **surévalué** Odoo FSM dans ma première analyse. C'est un outil pour plombiers/électriciens qui facturent des interventions chez des clients, **pas** pour piloter 847 migrations Windows internes.

---

### 2.3 Catégorie ITSM / Gestion de Parc

| Solution       | Stack        | Licence  | Description                                                  | Fit OpsTracker                                                      |
| -------------- | ------------ | -------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| **GLPI**       | PHP 8.2+     | GPL-3.0  | Gestion parc IT + ticketing. Très utilisé secteur public FR. | ❌ Parc/ticketing, pas orchestration campagnes. **Complémentaire.** |
| **iTop**       | PHP          | AGPL-3.0 | CMDB + ITSM. Français (Combodo).                             | ❌ ITSM orienté tickets, pas opérations terrain.                    |
| **ServiceNow** | Propriétaire | SaaS     | ITSM enterprise. Peut tout faire avec du dev.                | ❌ SaaS US, prix prohibitif, dev lourd requis.                      |

**GLPI — Analyse approfondie** :

GLPI est **complémentaire**, pas concurrent :

- ✅ Source de données (inventaire parc, users AD)
- ✅ Import CSV possible depuis export GLPI
- ❌ Aucun concept natif de "campagne de migration"
- ❌ Pas de vues d'avancement consolidées multi-cibles
- ❌ Pas de checklists terrain protégées

**Verdict ITSM/ITAM** : ⭐⭐ **SOURCES DE DONNÉES, PAS SOLUTIONS AU PROBLÈME**

---

### 2.4 Catégorie Open Source Gestion de Projets

| Solution        | Stack         | Licence  |        UX        | Fit OpsTracker                                       |
| --------------- | ------------- | -------- | :--------------: | ---------------------------------------------------- |
| **ProjeQtOr**   | PHP           | AGPL-3.0 |  ⭐ Déplorable   | ⚠️ Fonctionnel mais inutilisable (UX catastrophique) |
| **Redmine**     | Ruby          | GPL-2.0  |    ⭐⭐ Datée    | ❌ Stack Ruby, pas de checklists terrain             |
| **OpenProject** | Ruby          | GPL-3.0  | ⭐⭐⭐ Correcte  | ❌ Stack Ruby, licence incompatible EUPL             |
| **Taiga**       | Python/Django | MPL-2.0  | ⭐⭐⭐⭐ Moderne | ❌ Stack Python                                      |
| **Kanboard**    | PHP           | MIT      |  ⭐⭐⭐ Simple   | ❌ Trop basique, pas de concept campagne             |

**ProjeQtOr — Le contre-exemple** :

ProjeQtOr est fonctionnellement riche mais son **UX est rédhibitoire** :

- Interface surchargée, non intuitive
- Courbe d'apprentissage très longue
- Aucune adoption spontanée possible
- **Exactement ce qu'OpsTracker ne doit PAS être** (P1.4 : ergonomie = critère N°1)

**Verdict Open Source GP** : ⭐⭐ **AUCUN NE COMBINE** Stack PHP/Symfony + Licence EUPL-compatible + UX moderne + Concept campagne IT

---

### 2.5 Catégorie SaaS Work Management

| Solution       | Pricing          |  Self-Hosted  |    RGAA 4.1     |         Fit         |
| -------------- | ---------------- | :-----------: | :-------------: | :-----------------: |
| **Monday.com** | 9-19€/user/mois  | ❌ Cloud only | ❌ Non certifié | ❌ **ÉLIMINATOIRE** |
| **Smartsheet** | 9-45€/user/mois  | ❌ Cloud only | ❌ Non certifié | ❌ **ÉLIMINATOIRE** |
| **Airtable**   | 20-45€/user/mois | ❌ Cloud only | ❌ Non certifié | ❌ **ÉLIMINATOIRE** |
| **ClickUp**    | 7-12€/user/mois  | ❌ Cloud only | ❌ Non certifié | ❌ **ÉLIMINATOIRE** |
| **Notion**     | 8-15€/user/mois  | ❌ Cloud only | ❌ Non certifié | ❌ **ÉLIMINATOIRE** |

**Verdict SaaS** : ⭐ **TOUS ÉLIMINÉS** — Cloud-only = incompatible self-hosted organisation

---

## 3. Matrice Comparative Synthétique

### 3.1 Respect des Contraintes Non-Négociables

| Solution       | Symfony | Self-Hosted | RGAA 4.1 |  EUPL   | Français | Budget OK |
| -------------- | :-----: | :---------: | :------: | :-----: | :------: | :-------: |
| Juriba DPC     |   ❌    |     ✅      |    ❌    |   ❌    |    ❌    |    ❌     |
| ReadyWorks     |   ❌    |     ⚠️      |    ❌    |   ❌    |    ❌    |    ❌     |
| Odoo FSM       |   ❌    |     ✅      |    ❌    |   ❌    |    ✅    |    ⚠️     |
| GLPI           | ✅ PHP  |     ✅      |    ❌    | ❌ GPL  |    ✅    |    ✅     |
| ProjeQtOr      | ✅ PHP  |     ✅      |    ❌    | ❌ AGPL |    ✅    |    ✅     |
| Monday.com     |   ❌    |     ❌      |    ❌    |   ❌    |    ✅    |    ⚠️     |
| **OpsTracker** |   ✅    |     ✅      |    ✅    |   ✅    |    ✅    |    ✅     |

**Constat** : **Aucune solution existante ne coche toutes les cases.**

### 3.2 Couverture Fonctionnelle

| Solution   | Campagnes multi-cibles | Champs config | Workflows dynamiques | Checklists protégées | Dashboard | Import CSV | Docs contextuels |
| ---------- | :--------------------: | :-----------: | :------------------: | :------------------: | :-------: | :--------: | :--------------: |
| Juriba DPC |           ✅           |      ✅       |          ✅          |          ⚠️          |    ✅     |     ✅     |        ⚠️        |
| Odoo FSM   |      ❌ (tickets)      |      ✅       |          ✅          |          ❌          |    ✅     |     ⚠️     |        ❌        |
| GLPI       |           ❌           |      ⚠️       |          ⚠️          |          ❌          |    ⚠️     |     ✅     |        ❌        |
| ProjeQtOr  |           ⚠️           |      ✅       |          ✅          |          ❌          |    ✅     |     ⚠️     |        ⚠️        |
| Monday.com |           ⚠️           |      ✅       |          ✅          |          ❌          |    ✅     |     ✅     |        ❌        |

**Constat** : Seul Juriba DPC couvre le besoin fonctionnel, mais avec des contraintes techniques/prix éliminatoires.

---

## 4. Analyse des Patterns à Copier vs Éviter

### 4.1 Patterns à COPIER ✅

| Source         | Pattern                                             | Transposition OpsTracker                        |
| -------------- | --------------------------------------------------- | ----------------------------------------------- |
| **Juriba DPC** | Concept de "campagne" comme conteneur parent        | Entité `Campaign` regroupant N `Operation`      |
| **Juriba DPC** | Planification par vagues/rings (Pilote 10% → Large) | Champ `wave` sur Operation + filtres            |
| **Juriba DPC** | Scoring de readiness multicritère                   | Champs JSONB `prerequisites` avec statuts       |
| **Juriba DPC** | Communications T-moins (J-7, J-1, J+1)              | V2 : Notifications automatiques                 |
| **Odoo**       | Vue Kanban avec drag-and-drop                       | EasyAdmin + Stimulus pour drag-drop statuts     |
| **Odoo**       | Vue Gantt pour planification                        | V2 : Bibliothèque JS type Frappe Gantt          |
| **Odoo**       | Chatter/journal d'activité                          | Gedmo Loggable + affichage timeline             |
| **Monday.com** | Widgets dashboard configurables                     | Composants Twig réutilisables                   |
| **Monday.com** | Import CSV avec mapping visuel                      | Interface 3 étapes : Upload → Preview → Mapping |
| **GLPI**       | Export CSV depuis inventaire                        | Import CSV standard, mapping flexible           |

### 4.2 Patterns à ÉVITER ❌

| Source         | Anti-Pattern              | Pourquoi                           | Alternative OpsTracker                           |
| -------------- | ------------------------- | ---------------------------------- | ------------------------------------------------ |
| **ProjeQtOr**  | Interface surchargée      | Adoption impossible sans formation | Progressive disclosure, 3-5 actions visibles max |
| **ProjeQtOr**  | Menus imbriqués profonds  | Navigation confuse                 | Menu plat, 2 niveaux max                         |
| **Monday.com** | Dépendance cloud          | Souveraineté impossible            | Self-hosted obligatoire                          |
| **Odoo FSM**   | Focus facturation/GPS     | Hors sujet opérations internes     | Supprimer tout ce qui concerne clients externes  |
| **Juriba**     | Pricing opaque enterprise | Barrière à l'entrée                | Open source, zéro coût licence                   |
| **GLPI**       | UX datée                  | Pas engageant pour adoption        | Design moderne, RGAA natif                       |

---

## 5. Le Gap Marché Confirmé

### 5.1 Ce que le marché propose

```
                    SPÉCIALISÉ OPÉRATIONS IT
                           ↑
                           |
          Juriba DPC       |      ░░░░░░░░░░░░░
          ReadyWorks       |      ░░ GAP ░░░░░░
          (Enterprise,     |      ░░ MARCHÉ ░░░
           US/UK, >40k$/an)|      ░░░░░░░░░░░░░
                           |
    ENTERPRISE ←───────────┼───────────→ PME/SECTEUR PUBLIC
                           |
          ServiceNow       |      Monday.com
          (ITSM, SaaS)     |      Smartsheet
                           |      (Cloud-only)
                           |
                           ↓
                    GÉNÉRALISTE WORK MANAGEMENT
```

### 5.2 Le créneau vide

**Aucune solution n'existe** pour :

- Secteur public français
- Self-hosted + Symfony
- RGAA 4.1 natif
- Open source / budget limité
- Pilotage d'opérations IT de masse (pas FSM, pas ticketing)

### 5.3 Référencement SILL

Le SILL (Socle Interministériel de Logiciels Libres) recense 530+ logiciels recommandés pour l'administration française.

**Constat** : **Aucun outil de pilotage d'opérations IT de masse n'est référencé.**

Outils présents dans des catégories adjacentes :

- ITSM : GLPI, iTop (ticketing, pas campagnes)
- Inventaire : FusionInventory, OCS (technique, pas pilotage)
- Gestion de projets : Tuleap, Redmine (dev logiciel, pas ops IT)

**Opportunité** : OpsTracker pourrait être le **premier outil de cette catégorie** référencé SILL.

---

## 6. Décision BUILD vs BUY

### 6.1 Options Évaluées

| Option                       | Description                                 | Verdict                                                                       |
| ---------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| **Acheter Juriba**           | Solution la plus complète fonctionnellement | ❌ **IMPOSSIBLE** — Stack incompatible, prix prohibitif, pas de RGAA          |
| **Adapter GLPI**             | Développer un module campagnes sur GLPI     | ❌ **TROP LOURD** — Architecture non prévue pour ça, UX à refaire entièrement |
| **Adapter ProjeQtOr**        | Fork et refonte UX                          | ❌ **EFFORT > BUILD** — Refonte UX totale = quasi réécriture                  |
| **Utiliser Monday/Airtable** | Configurer pour le use case                 | ❌ **IMPOSSIBLE** — Cloud-only éliminatoire                                   |
| **BUILD OpsTracker**         | Développement sur mesure Symfony            | ✅ **SEULE OPTION VIABLE**                                                    |

### 6.2 Justification BUILD

| Argument                      | Détail                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| **Gap marché confirmé**       | Aucun outil n'existe pour ce créneau précis                  |
| **Contraintes éliminatoires** | Stack Symfony + self-hosted + RGAA = combinaison introuvable |
| **POC validé**                | Le POC POC Pilote prouve que le concept fonctionne           |
| **Patterns identifiés**       | On sait quoi copier de Juriba/Odoo/Monday                    |
| **Faisabilité vibe coding**   | Développement accéléré avec IA (P2.3)                        |
| **Coût d'opportunité**        | Adapter un existant ≈ effort équivalent au BUILD             |

### 6.3 Verdict

> **🟢 BUILD CONFIRMÉ** — La décision de construire OpsTracker n'est pas un choix par défaut mais la **seule réponse viable** à un gap marché réel pour un contexte métier spécifique.

---

## 7. Recommandations pour P3.4 (Concept)

### 7.1 Architecture à retenir (confirmée P3.1)

| Composant         | Choix                       | Inspiré de                                     |
| ----------------- | --------------------------- | ---------------------------------------------- |
| Modèle de données | JSONB Flex                  | Airtable (flexibilité), Juriba (champs custom) |
| Workflows         | Symfony Workflow + BDD      | Odoo (configurabilité)                         |
| Frontend admin    | EasyAdmin 4                 | Standard Symfony                               |
| Frontend terrain  | Twig + Turbo + Stimulus     | Patterns UX génériques, RGAA natif             |
| Checklists        | Snapshot Pattern            | Innovation (résout problème POC Pilote)        |
| Import CSV        | League\Csv + mapping visuel | Monday.com (UX import)                         |
| Audit             | Gedmo Loggable              | Standard secteur public                        |

### 7.2 Fonctionnalités prioritaires MVP

| Module         | Fonctionnalité clé                       | Inspirée de              |
| -------------- | ---------------------------------------- | ------------------------ |
| **Planning**   | Campagnes + opérations + champs JSONB    | Juriba DPC               |
| **Planning**   | Import CSV 3 étapes                      | Monday.com               |
| **Dashboard**  | Widgets configurables par statut/segment | Juriba DPC, Monday       |
| **Checklists** | Multi-phases + snapshot protection       | Innovation OpsTracker    |
| **Docs**       | Liaison contextuelle opération           | Juriba (docs in context) |
| **Users**      | Rôles Admin/Gestionnaire + audit         | Standard                 |

### 7.3 Ce qu'on NE copie PAS

| Fonctionnalité                   | Source         | Pourquoi on l'exclut                  |
| -------------------------------- | -------------- | ------------------------------------- |
| GPS / Optimisation trajets       | Odoo FSM       | Hors sujet (bureaux internes connus)  |
| Facturation / Devis              | Odoo FSM       | Opérations internes, pas commerciales |
| Signatures électroniques         | FSM génériques | Pas de bon d'intervention client      |
| Portail self-service utilisateur | Juriba DPC     | V2 éventuellement, pas MVP            |
| Intégration SCCM/Intune native   | ReadyWorks     | Import CSV suffit V1                  |

---

## 8. Sources & Références

### Recherche Primaire

- Juriba : juriba.com, blog.juriba.com/pricing, blog.juriba.com/what-is-a-digital-platform-conductor
- ReadyWorks : readyworks.com, readyworks.com/faqs
- Odoo FSM : odoo.com/app/field-service-features, odoo.com/documentation
- GLPI : glpi-project.org
- SILL : code.gouv.fr/sill, data.gouv.fr

### Définitions Marché

- Gartner : Digital Platform Conductor (DPC) category, 2021
- Salesforce : What is Field Service Management (FSM)
- Wikipedia : Field Service Management

### Benchmarks Accessibilité

- WebAIM : Million 2025 (94.8% sites non conformes WCAG)
- RGAA 4.1 : accessibilite.numerique.gouv.fr

---

## 9. Points à Valider avec le Sponsor

| #   | Point                                    | Question                                                                                  |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | **Clarification Odoo FSM**               | Confirmez-vous que la comparaison Odoo FSM était surévaluée ? (FSM ≠ pilotage IT interne) |
| 2   | **Juriba comme référence fonctionnelle** | OK pour s'inspirer de Juriba (patterns) sans chercher à l'égaler en complexité ?          |
| 3   | **Intégration GLPI**                     | Import CSV depuis GLPI suffit V1 ? Pas d'API bidirectionnelle ?                           |
| 4   | **Verdict BUILD**                        | Confirmez-vous le BUILD comme seule option viable ?                                       |
| 5   | **Priorisation patterns**                | Quels patterns Juriba sont prioritaires MVP vs V2 ? (ex: communications T-moins)          |

---

**Niveau de confiance : 88%**

_Les 12% d'incertitude portent sur (1) l'existence potentielle de solutions de niche non identifiées dans cette recherche et (2) l'évolution possible des offres Juriba/ReadyWorks vers des tarifs PME._

---

**Statut** : 🟡 **EN ATTENTE VALIDATION SPONSOR**

_Prochaine étape : Validation des 5 points ci-dessus, puis P3.4 - Concept_
