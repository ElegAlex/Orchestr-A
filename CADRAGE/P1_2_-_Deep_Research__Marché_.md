# P1.2 - Deep Research (Marché)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **DEEP RESEARCH MARCHÉ — VALIDÉ** Confiance globale : **90%** (après validation sponsor)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. Rappel du Besoin OpsTracker

**OpsTracker n'est PAS un outil ITSM/ITOM classique.** C'est un outil de :

- **Pilotage d'opérations IT de terrain de masse** (migrations postes, renouvellements matériels, déploiements)
- **Planification de RDV** avec des cibles variées (users, postes, devices)
- **Checklists terrain** pour guider les techniciens étape par étape
- **Dashboards d'avancement** configurables pour la direction
- **Base documentaire** contextualisée aux opérations

**Contexte cible** : organisations du secteur public, self-hosted, Symfony obligatoire, RGAA 4.1.

---

## 2. Panorama des Solutions Existantes

### 2.1 Solutions Spécialisées Migration/Déploiement IT Enterprise

| Solution               | Description                                                                                                                                          | Pricing                                 | Forces                                                                       | Faiblesses                                                                                         | Fit OpsTracker                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Juriba DPC**         | Plateforme de pilotage migrations IT enterprise (Windows, O365, devices). Self-service scheduling, orchestration automatisée, dashboards temps réel. | Enterprise (sur devis, >50k€/an estimé) | ✅ Self-service utilisateur, ✅ Orchestration avancée, ✅ 10M+ assets migrés | ❌ Pricing enterprise prohibitif, ❌ Complexité déploiement, ❌ Pas adapté PME/secteur public      | ⭐⭐ (trop enterprise)        |
| **ReadyWorks**         | Gestion lifecycle Windows et orchestration migrations. Intégration Intune/SCCM, communications automatisées.                                         | Enterprise (sur devis)                  | ✅ Workflow automation, ✅ Self-scheduling, ✅ Reporting natif               | ❌ Focus Windows uniquement, ❌ Dépendance écosystème Microsoft, ❌ Pas d'option on-premise simple | ⭐⭐ (trop Microsoft-centric) |
| **Refresh Insight PC** | Automatisation déploiements Windows end-to-end. Portail self-service, batch & schedule.                                                              | Sur devis                               | ✅ Self-service scheduling, ✅ Communication automatisée                     | ❌ Focus Windows uniquement, ❌ Marché limité                                                      | ⭐⭐ (trop niché)             |

**Constat** : Les solutions spécialisées sont **très coûteuses**, **complexes à déployer**, et **orientées grandes entreprises privées**. Aucune n'est adaptée au contexte organisationnel (budget contraint, self-hosted, accessibilité RGAA).

---

### 2.2 Solutions Work Management Configurables (Généralistes)

| Solution       | Pricing                                                   | Forces                                                                                                      | Faiblesses pour OpsTracker                                                                                                                   | Fit    |
| -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Monday.com** | Free (2 users), Basic 9€, Standard 12€, Pro 19€/user/mois | ✅ Interface intuitive et colorée, ✅ 200+ templates, ✅ Automations no-code, ✅ Mobile offline             | ❌ Cloud only (pas self-hosted), ❌ Pas de checklists multi-étapes natives, ❌ Accessibilité RGAA non certifiée, ❌ Données hors UE possible | ⭐⭐⭐ |
| **Smartsheet** | Pro 9€, Business 19€/user/mois, Enterprise sur devis      | ✅ Interface tableur familière, ✅ Gantt/Timeline puissants, ✅ Conformité HIPAA/GDPR, ✅ Formules avancées | ❌ Cloud only, ❌ Interface datée, ❌ Checklists limitées, ❌ Complexité pour cas simples, ❌ Add-ons payants nombreux                       | ⭐⭐⭐ |
| **Airtable**   | Free (1k records), Team 20€, Business 45€/user/mois       | ✅ Base de données relationnelle flexible, ✅ Interface designer pour apps custom, ✅ API robuste           | ❌ Cloud only, ❌ Pricing élevé qui explose avec utilisateurs, ❌ Pas orienté opérations terrain, ❌ Limites records par base                | ⭐⭐   |
| **Notion**     | Free, Plus 8€, Business 15€/user/mois                     | ✅ Flexibilité maximale, ✅ Documentation intégrée, ✅ Pricing attractif                                    | ❌ Cloud only, ❌ Pas d'automatisations natives puissantes, ❌ Performance sur gros volumes, ❌ Pas de workflow de statuts                   | ⭐⭐   |
| **ClickUp**    | Free, Unlimited 7€, Business 12€/user/mois                | ✅ Features très complètes, ✅ Checklists dans tâches, ✅ Pricing compétitif                                | ❌ Cloud only, ❌ Complexité (feature overload), ❌ Courbe d'apprentissage                                                                   | ⭐⭐⭐ |

**Constat** : Les outils généralistes sont **flexibles mais cloud-only**, ce qui exclut le self-hosted organisation. Aucun ne propose de **checklists terrain structurées par phases** avec protection des checklists "in progress". L'**accessibilité RGAA** n'est garantie sur aucun.

---

### 2.3 Solutions Open Source / Secteur Public Français

| Solution      | Stack           | Licence  | Description                                                                                | Fit OpsTracker                                                                                                                     |
| ------------- | --------------- | -------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **GLPI**      | PHP 8.2+, MySQL | GPL-3.0  | Gestion de parc IT, ticketing, inventaire. 5.4k ⭐ GitHub, très utilisé secteur public FR. | ❌ Gestion de parc, pas pilotage opérations. Complémentaire mais pas concurrent.                                                   |
| **iTop**      | PHP, MySQL      | AGPL-3.0 | CMDB + ITSM open source. Français (Combodo). Customisation low-code.                       | ❌ ITSM orienté tickets, pas pilotage opérations terrain.                                                                          |
| **Redmine**   | Ruby            | GPL-2.0  | Gestion de projets, ticketing. Mature mais daté.                                           | ❌ Pas de checklists terrain, interface vieillissante.                                                                             |
| **Tuleap**    | PHP             | GPL-2.0  | ALM français (Enalean), gestion projets agile. SILL référencé.                             | ❌ Orienté développement logiciel, pas opérations IT.                                                                              |
| **ProjeQtOr** | PHP             | AGPL-3.0 | Gestion projets/programmes complète. SILL référencé.                                       | ⭐⭐ Fonctionnellement riche, mais **ergonomie/UX déplorable** (interface datée, peu intuitive). Pas de module opérations terrain. |

**Constat SILL** : Le SILL référence **530 logiciels libres** recommandés par l'État français (2025). **Aucun outil de pilotage d'opérations IT de masse n'est référencé.** C'est un gap évident sur lequel OpsTracker pourrait se positionner.

---

## 3. Pain Points Marché Identifiés

### 3.1 Frustrations Récurrentes (Sources : G2, Capterra, Reddit, PeerSpot)

| Pain Point                   | Fréquence  | Solutions concernées                                   | Verbatims                                                               |
| ---------------------------- | ---------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Cloud-only imposé**        | Très haute | Monday, Smartsheet, Airtable, ClickUp                  | "No on-premise option is a dealbreaker for our compliance requirements" |
| **Pricing qui explose**      | Haute      | Airtable (+66% en 2 ans), Smartsheet (add-ons), Monday | "What starts at $9/user quickly becomes $50+ with needed features"      |
| **Checklists rudimentaires** | Haute      | Tous                                                   | "Subtasks exist but no multi-phase checklists with protection"          |
| **Accessibilité négligée**   | Très haute | 94.8% sites WCAG non-conformes (WebAIM 2025)           | "VPAT exists but actual accessibility is poor"                          |
| **Complexité migrations**    | Haute      | Solutions enterprise                                   | "6-10 emails per user, manual scheduling nightmare"                     |
| **Excel reste la solution**  | Très haute | Contexte secteur public                                | "Each operation starts from scratch with a new Excel file"              |

### 3.2 Gap Spécifique Secteur Public Santé France

- **Aucun outil ne combine** : self-hosted + Symfony + RGAA 4.1 + pilotage opérations IT
- **Contrainte HDS** : Si données de santé, hébergement HDS obligatoire (OpsTracker n'héberge pas de données de santé directement, mais l'infra doit être conforme)
- **SILL** : Opportunité de référencement pour légitimité secteur public
- **Doctrine Cloud au Centre** : Préférence sovereign cloud, mais OpsTracker self-hosted échappe à cette contrainte

---

## 4. Tendances Technologiques Pertinentes

| Tendance                     | Impact OpsTracker                                           | Recommandation                                                               |
| ---------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Low-code/No-code**         | Fort - Les utilisateurs veulent configurer sans développeur | ✅ Interface admin permettant de créer opérations, champs, statuts sans code |
| **Self-service utilisateur** | Fort - Juriba/ReadyWorks montrent la voie                   | ✅ Portail technicien avec self-scheduling des RDV                           |
| **Accessibilité by design**  | Critique - Obligation légale RGAA, sanctions 50k€           | ✅ RGAA 4.1 dès la conception, pas en retrofit                               |
| **Dashboards temps réel**    | Moyen - Direction veut visibilité instantanée               | ✅ Widgets configurables, actualisation automatique                          |
| **Mobile-first**             | Moyen - Techniciens terrain sur laptop/tablette             | ✅ Responsive design, mode offline envisageable V2                           |

---

## 5. Analyse Concurrentielle : Positionnement OpsTracker

### 5.1 Matrice de Positionnement

```
                    SPÉCIALISÉ OPÉRATIONS IT
                           ↑
                           |
          Juriba DPC       |      OpsTracker
          ReadyWorks       |      (cible)
          (Enterprise)     |      (Secteur public FR)
                           |
    ENTERPRISE ←───────────┼───────────→ PME/SECTEUR PUBLIC
                           |
          ServiceNow       |      Monday.com
          BMC Helix        |      Smartsheet
          (ITSM complet)   |      Airtable
                           |      (Généralistes)
                           ↓
                    GÉNÉRALISTE WORK MANAGEMENT
```

### 5.2 Avantages Concurrentiels Potentiels OpsTracker

| Avantage               | Comparé à Enterprise (Juriba)         | Comparé à Généralistes (Monday)       |
| ---------------------- | ------------------------------------- | ------------------------------------- |
| **Pricing**            | ✅ Gratuit/open source vs >50k€/an    | ✅ Gratuit vs 12-19€/user/mois        |
| **Self-hosted**        | ≈ Équivalent (les deux le permettent) | ✅ Possible vs Cloud-only             |
| **Accessibilité RGAA** | ✅ Native vs non certifié             | ✅ Native vs non certifié             |
| **Simplicité**         | ✅ Focalisé vs usine à gaz            | ≈ Comparable                          |
| **Checklists terrain** | ≈ Équivalent                          | ✅ Multi-phases protégées vs basiques |
| **Souveraineté**       | ✅ FR/Symfony vs US/propriétaire      | ✅ FR vs US                           |
| **SILL/Filigram**      | ✅ Référençable vs non éligible       | ✅ Référençable vs non éligible       |

---

## 6. Opportunités de Différenciation Stratégique

### 6.1 Positionnement Recommandé

> **OpsTracker : L'outil simple, intuitif et souverain de pilotage d'opérations IT pour le secteur public français.**

_L'ergonomie que ProjeQtOr n'a jamais eue. La puissance de Juriba sans la complexité. Le self-hosted que Monday ne propose pas._

### 6.2 Axes de Différenciation Prioritaires

1. **🎯 Ergonomie et intuitivité (CRITIQUE)**
   - Interface attractive, moderne, professionnelle
   - Prise en main immédiate sans formation
   - Différenciateur vs open source existant (ProjeQtOr = contre-exemple)
   - Message : "Adoption instantanée, zéro formation"

2. **Simplicité vs "usines à gaz" enterprise**
   - Interface intuitive, déploiement rapide (jours, pas mois)
   - Pas de consultants certifiés nécessaires
   - Message : "La puissance de Juriba, sans la complexité"

3. **Self-hosted souverain**
   - Données restent sur l'infra de l'organisation
   - Pas de dépendance cloud US (CLOUD Act)
   - Compatible doctrine "Cloud au Centre" par exception self-hosted

4. **Checklists terrain protégées**
   - Innovation vs Excel : multi-phases, liens doc, protection "in progress"
   - Répond au pain point POC Pilote identifié en P1.1

5. **Accessibilité RGAA (bonus)**
   - Conformité RGAA 4.1/WCAG 2.1 AA dès la conception
   - Pas un argument commercial, mais un plus appréciable
   - Obligation légale = risque évité

6. **Open source (bonus SILL)**
   - Zéro coût licence vs Monday/Smartsheet
   - Potentiel référencement SILL = légitimité bonus

---

## 7. Recommandation Go/No-Go Partielle

### 7.1 Signaux GO ✅

| Signal                            | Justification                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| **Gap marché confirmé**           | Aucun outil ne combine : self-hosted + RGAA + opérations IT terrain + secteur public FR |
| **Pain points validés**           | Excel ad hoc, cloud-only, pricing, accessibilité = frustrations récurrentes             |
| **POC existant validé**           | POC RDV a prouvé le concept, demande multi-organisations confirmée                      |
| **Barrière à l'entrée naturelle** | Combo Symfony + RGAA + self-hosted crée un créneau défendable                           |
| **Timing favorable**              | SILL en croissance (500→530 logiciels), sensibilité souveraineté accrue                 |

### 7.2 Points de Vigilance ⚠️

| Risque                             | Mitigation                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| **Adoption limitée si trop niché** | Conception modulaire permettant usages au-delà migrations                                 |
| **Concurrence future**             | Juriba/ReadyWorks pourraient proposer offres PME — différenciation RGAA + FR reste solide |
| **Effort développement solo**      | Priorisation stricte MoSCoW, livraisons incrémentielles                                   |

### 7.3 Verdict

> **🟢 GO VALIDÉ** - Le marché présente un gap clair pour OpsTracker. La différenciation est solide sur l'axe **ergonomie + souveraineté + simplicité**. L'ergonomie est identifiée comme **critère de succès N°1** (budget formation limité = l'outil doit être intuitif). Poursuivre vers P1.3 (Personas).

---

## 8. Points Validés avec le Sponsor ✅

| #   | Point                                                 | Réponse Validée                                                                  |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Accessibilité RGAA comme argument commercial          | ❌ Pas un argument commercial en soi, mais **un plus** si présent                |
| 2   | Intérêt référencement SILL                            | ✅ Intérêt pour **open-source** — SILL = bonus, pas consubstantiel               |
| 3   | Positionnement "simple et souverain"                  | ✅ **Validé**                                                                    |
| 4   | Budget formation/accompagnement organisations pilotes | ⚠️ **Limité** — l'outil DOIT être intuitif pour minimiser le besoin de formation |

### Implication Clé : L'Ergonomie comme Critère N°1

> Le budget formation limité signifie que **l'intuitivité et l'ergonomie sont des critères de succès critiques**, pas des "nice to have". C'est ce qui différenciera OpsTracker des solutions open source existantes (ProjeQtOr, Redmine) qui sont fonctionnelles mais peu ergonomiques.

---

## Sources Principales

- Juriba : juriba.com, blog.juriba.com (migration management, self-scheduling)
- ReadyWorks : readyworks.com (Windows lifecycle management)
- Monday.com : monday.com/pricing, thedigitalprojectmanager.com, tech.co
- Smartsheet : smartsheet.com/pricing, capterra.com, g2.com
- Airtable : airtable.com, eesel.ai/blog/airtable-pricing, adalo.com
- SILL : code.gouv.fr/sill, blogdumoderateur.com, data.gouv.fr
- WebAIM : webaim.org/projects/million (étude accessibilité 2025)
- InvGate : blog.invgate.com (PC refresh best practices)

---

**Statut** : ✅ **DEEP RESEARCH VALIDÉ**

_Prochaine étape : P1.3 - Personas & Besoins_
