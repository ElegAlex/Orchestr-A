# P3.3 - Analyse Comparative & Sélection (FINAL)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚖️ **MATRICE DE DÉCISION & RECOMMANDATION** Options analysées : **27** | Retenues : **4** Confiance globale : **94%** Date de référence : **18 janvier 2026**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## 1. Filtrage Initial (Kill List)

_(Options éliminées d'office car incompatibles avec les contraintes P0)_

### Solutions Marché (P3.2)

| Option             | Raison d'élimination                                                                                                             | Contrainte violée                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| ❌ **Juriba DPC**  | Stack .NET propriétaire, pricing 4-15$/device/an (min 12-40k$/an), anglais uniquement, aucune référence administration française | Symfony obligatoire                          |
| ❌ **ReadyWorks**  | SaaS prioritaire, stack propriétaire, pricing enterprise non communiqué                                                          | Symfony + Self-hosted                        |
| ❌ **Monday.com**  | Cloud-only, pas de self-hosted, RGAA non certifié                                                                                | Self-hosted obligatoire                      |
| ❌ **Smartsheet**  | Cloud-only, pas de self-hosted, RGAA non certifié                                                                                | Self-hosted obligatoire                      |
| ❌ **Airtable**    | Cloud-only, pricing qui explose (+66% en 2 ans), RGAA non certifié                                                               | Self-hosted obligatoire                      |
| ❌ **ClickUp**     | Cloud-only, pas de self-hosted                                                                                                   | Self-hosted obligatoire                      |
| ❌ **Notion**      | Cloud-only, pas d'automatisations natives puissantes                                                                             | Self-hosted obligatoire                      |
| ❌ **Odoo FSM**    | Stack Python, use case FSM (interventions réactives externes) ≠ pilotage IT interne planifié                                     | Symfony obligatoire + Hors sujet fonctionnel |
| ❌ **ServiceNow**  | SaaS US (CLOUD Act), pricing prohibitif                                                                                          | Self-hosted + Symfony                        |
| ❌ **Redmine**     | Stack Ruby, interface vieillissante                                                                                              | Symfony obligatoire                          |
| ❌ **OpenProject** | Stack Ruby, licence GPL-3.0 incompatible EUPL 1.2                                                                                | Symfony + Licence                            |
| ❌ **Taiga**       | Stack Python/Django, MPL-2.0                                                                                                     | Symfony obligatoire                          |
| ❌ **Kanboard**    | Trop basique, pas de concept campagne multi-cibles                                                                               | Gap fonctionnel critique                     |

### Options Architecture (P3.1)

| Option                       | Raison d'élimination                   | Justification Deep Research                                                                                       |
| ---------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ❌ **#1 Doctrine Classique** | Trop rigide — chaque champ = migration | Ne résout pas la configurabilité exigée par Sophie                                                                |
| ❌ **#6 EAV Structuré**      | Performance insuffisante               | **JSONB = stockage 3x plus compact (2-4 GB vs 7 GB pour 10M lignes), requêtes containment `@>` 15x plus rapides** |
| ❌ **#8 Workflower BPMN**    | Overkill pour workflows simples        | Standard BPMN 2.0 = complexité injustifiée                                                                        |
| ❌ **#9 API Platform Core**  | Deux stacks à maintenir (PHP + React)  | Bus factor = 1, maintenance solo impossible                                                                       |
| ❌ **#13 Config-as-Code**    | Git requis pour config                 | Sophie doit configurer via UI, pas via commits                                                                    |
| ❌ **#14 Event Sourcing**    | Over-engineering massif                | CQRS complet = complexité >> valeur ajoutée                                                                       |
| ❌ **#15 Multi-Bundle**      | Complexité architecturale inutile      | Monolithe modulaire suffit V1                                                                                     |
| ❌ **#16 Schema-Driven UI**  | Réinvention de la roue                 | JSONB + formulaires Symfony couvrent le besoin                                                                    |
| ❌ **#20 Offline-First PWA** | Karim a toujours du réseau             | Effort injustifié (validé sponsor P3.1)                                                                           |

**Bilan filtrage** : 22 options éliminées → **4 options survivantes** à scorer

---

## 2. Matrice de Décision Pondérée (Top 4 Survivants)

### Pondération des critères (ajustée selon P0/P2.1)

| Critère                           | Poids | Justification (traçabilité dossier)                                         |
| --------------------------------- | ----- | --------------------------------------------------------------------------- |
| **Impact sur le Problème (P2.3)** | 30%   | North Star = >90% mises à jour terrain par technicien assigné               |
| **Facilité d'usage / UX**         | 25%   | Ergonomie = critère N°1 (P1.4), Karim < 5 min prise en main, zéro formation |
| **Simplicité Technique**          | 20%   | Bus factor = 1 (P0), maintenance solo                                       |
| **Conformité RGAA**               | 15%   | Obligation légale RGAA 4.1 (106 critères), sanctions jusqu'à 20 000€/an     |
| **Time-to-Value**                 | 10%   | Qualité > Vitesse (validé sponsor)                                          |

### Options évaluées

| Option                                | Description courte                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **A - BUILD OpsTracker (Stack P3.1)** | JSONB + Workflow dynamique + Twig/Turbo/Stimulus + EasyAdmin limité + Snapshot + auditor-bundle |
| **B - ADAPT GLPI**                    | Développer module campagnes sur GLPI existant                                                   |
| **C - ADAPT ProjeQtOr**               | Fork + refonte UX complète                                                                      |
| **D - BUILD Minimaliste**             | Symfony basique, colonnes fixes, workflows YAML, EasyAdmin only                                 |

### Matrice de scoring détaillée

| Critère                    | Poids    | **A - BUILD Stack P3.1** | **B - ADAPT GLPI** | **C - ADAPT ProjeQtOr** | **D - BUILD Minimaliste** |
| -------------------------- | -------- | ------------------------ | ------------------ | ----------------------- | ------------------------- |
| **Impact Problème (P2.3)** | 30%      | **9**                    | 5                  | 6                       | 7                         |
| **Facilité d'usage (UX)**  | 25%      | **8**                    | 4                  | 3                       | 6                         |
| **Simplicité Technique**   | 20%      | 6                        | 4                  | 3                       | **9**                     |
| **Conformité RGAA**        | 15%      | **7**                    | 4                  | 3                       | 6                         |
| **Time-to-Value**          | 10%      | 5                        | 6                  | 3                       | **8**                     |
| **SCORE PONDÉRÉ**          | **100%** | **7.40**                 | **4.45**           | **3.90**                | **7.05**                  |

---

### Justification détaillée des notes (avec données Deep Research)

#### **A - BUILD OpsTracker Stack P3.1 (Score 7.40)** 🥇

| Critère           | Note     | Justification                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Impact P2.3**   | **9/10** | Conçu spécifiquement pour le Problem Statement. JSONB = champs configurables par Sophie sans migration. Workflow Component = statuts dynamiques éditables. Snapshot Pattern = résout l'irritant POC Pilote (écrasement checklists). Architecture 100% alignée sur les besoins documentés P1.1-P1.4                                                     |
| **UX**            | **8/10** | Twig + Turbo + Stimulus = UX réactive et moderne, optimisable pour Karim (vue "Mes interventions" en 2 clics). **Limite** : EasyAdmin atteint ses limites pour applications métier complexes (bulk actions difficiles, formulaires imbriqués mal gérés). Interface Karim = développement custom obligatoire                                            |
| **Technique**     | **6/10** | Workflow Component avec définitions BDD = **absence d'intégration Twig native** (helpers `workflow_can` uniquement pour YAML). Factory custom `DynamicWorkflowLoader` validée en prod (BillaBear, joppe.dev). Package `martin-georgiev/postgresql-for-doctrine` mature (100+ fonctions JSONB). SonarQube intégré CI/CD pour contrer dette technique IA |
| **RGAA**          | **7/10** | Twig + Turbo + Stimulus = **75-85% conformité atteignable** en 50-70 j/h. **Risque accepté** : Turbo Drive présente des problèmes d'accessibilité documentés (issue #774 : pas d'annonce NVDA/Chrome). Tests manuels NVDA + Firefox obligatoires. Outils DINUM intégrables : Ara, Assistant RGAA. axe-core CI/CD = 30-40% détection seulement          |
| **Time-to-Value** | **5/10** | **6-9 mois estimés** (Deep Research) : Core 8-12 sem, Interface 10-14 sem, Imports 2-3 sem, Audit 2-3 sem, Tests accessibilité 4-6 sem                                                                                                                                                                                                                 |

---

#### **B - ADAPT GLPI (Score 4.45)**

| Critère           | Note     | Justification                                                                                                                                                                                                 |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Impact P2.3**   | **5/10** | Architecture GLPI = ITAM/ticketing, **pas orchestration campagnes**. Module "projet" trop basique : pas de readiness tracking, pas de checklists multi-phases. Développement quasi-complet sur base inadaptée |
| **UX**            | **4/10** | Interface GLPI datée, refonte UX = quasi-réécriture du frontend                                                                                                                                               |
| **Technique**     | **4/10** | Codebase massive (300k+ lignes), architecture plugin complexe, risque conflits mises à jour                                                                                                                   |
| **RGAA**          | **4/10** | GLPI non conforme RGAA actuellement. Retrofit = effort massif                                                                                                                                                 |
| **Time-to-Value** | **6/10** | Base existante mais adaptation ≥ BUILD from scratch                                                                                                                                                           |

---

#### **C - ADAPT ProjeQtOr (Score 3.90)**

| Critère           | Note     | Justification                                                                     |
| ----------------- | -------- | --------------------------------------------------------------------------------- |
| **Impact P2.3**   | **6/10** | Gestion projets généraliste, pas spécialisé ops IT                                |
| **UX**            | **3/10** | **"UX déplorable"** (P1.2) = contre-exemple absolu. Refonte = réécriture complète |
| **Technique**     | **3/10** | Code legacy PHP, pas Symfony. Fork = maintenance parallèle                        |
| **RGAA**          | **3/10** | Aucune conformité actuelle                                                        |
| **Time-to-Value** | **3/10** | Refonte UX = **12+ mois**. Plus long que BUILD                                    |

---

#### **D - BUILD Minimaliste (Score 7.05)** 🥈

| Critère           | Note     | Justification                                                                                       |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------- |
| **Impact P2.3**   | **7/10** | Fonctionnel pour 80% du besoin. **Limites** : colonnes fixes, workflows YAML figés, pas de Snapshot |
| **UX**            | **6/10** | EasyAdmin standard, pas optimisé Karim                                                              |
| **Technique**     | **9/10** | Symfony vanilla = **zéro risque technique**, maintenable par tout dev Symfony                       |
| **RGAA**          | **6/10** | EasyAdmin = **60-75% conformité max**                                                               |
| **Time-to-Value** | **8/10** | **2-3 mois** avec vibe coding                                                                       |

---

## 3. Analyse DVF des Finalistes

### 🥇 Le Gagnant : **BUILD OpsTracker Stack P3.1 (Option A)** — Score : 7.40

**Pourquoi lui ?**

| Dimension DVF    | Évaluation                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Désirabilité** | ✅ Conçu pour Sophie (config <30 min sans migration) ET Karim (UX <5 min, vue "Mes interventions"). Checklists protégées via Snapshot = résout l'irritant POC Pilote |
| **Viabilité**    | ✅ Open source EUPL 1.2, zéro coût licence, potentiel SILL, mutualisable inter-organisations                                                                         |
| **Faisabilité**  | ⚠️ 6-9 mois estimés. Complexité JSONB + Workflow dynamique maîtrisée. SonarQube dès le départ                                                                        |

**Le "Trade-off"** : On gagne sur **l'adéquation fonctionnelle parfaite** et la **réactivité UX** (Turbo) mais on accepte un **risque accessibilité** (Turbo Drive issue #774) et un **time-to-value plus long** (6-9 mois).

**Risques principaux identifiés** :

| Risque                                            | Probabilité | Impact | Mitigation                                      |
| ------------------------------------------------- | ----------- | ------ | ----------------------------------------------- |
| Turbo Drive = problèmes accessibilité NVDA        | Moyenne     | Moyen  | Tests manuels NVDA + Firefox, budget 50-70 j/h  |
| Workflow Component dynamique = validation runtime | Moyenne     | Moyen  | Tests unitaires exhaustifs, pattern validé prod |
| Dette technique code IA (+30% warnings)           | Haute       | Moyen  | SonarQube CI/CD dès le départ                   |

---

### 🥈 Le Fallback (Plan B) : **BUILD Minimaliste (Option D)** — Score : 7.05

**Activation uniquement si blocage technique total** sur l'Option A (validé sponsor).

**Ce qu'on perd** :

- Sophie ne peut plus configurer (champs, statuts figés)
- Problème POC Pilote non résolu (pas de Snapshot)
- RGAA plafonné à 60-75%

**Ce qu'on garde** :

- 80% du besoin fonctionnel
- Maintenabilité excellente
- Livrable en 2-3 mois

---

## 4. Recommandation BUILD vs BUY vs ADAPT

- [x] **BUILD** (Développer en interne)
- [ ] ~~BUY~~ — Aucune solution compatible
- [ ] ~~ADAPT~~ — GLPI/ProjeQtOr = effort ≥ BUILD

### Justification BUILD

| Argument                      | Données Deep Research                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| **Gap marché confirmé**       | SILL : **0 outil** de pilotage d'opérations IT de masse référencé                                |
| **Contraintes éliminatoires** | Symfony + self-hosted + EUPL 1.2 + RGAA = combinaison introuvable                                |
| **POC validé**                | POC RDV a prouvé le concept, demande multi-organisations documentée                              |
| **Performance JSONB**         | **3x plus compact, 15x plus rapide** que EAV                                                     |
| **Audit mature**              | `damienharper/auditor-bundle` : 776k installations, 7 ans, 39 contributeurs, ManyToMany supporté |

---

## 5. Synthèse pour le Sponsor

> **"Nous recommandons de partir sur BUILD OpsTracker avec la stack P3.1 (JSONB + Symfony Workflow + Twig/Turbo/Stimulus + Snapshot Pattern + auditor-bundle).**
>
> **C'est la seule option qui permet d'atteindre le North Star (>90% mises à jour terrain) tout en respectant les contraintes Symfony/self-hosted/EUPL et en résolvant 100% des pain points identifiés.**
>
> **Timeline : 6-9 mois à partir du 18 janvier 2026 → MVP prévu entre juillet et octobre 2026.**
>
> **Le plan B (BUILD Minimaliste) n'est activé qu'en cas de blocage technique total."**

---

## 6. Stack Technique Retenue (Validée Sponsor)

| Couche              | Choix                   | Bundle/Lib                                | Justification                                  |
| ------------------- | ----------------------- | ----------------------------------------- | ---------------------------------------------- |
| **Données**         | JSONB Flex              | `martin-georgiev/postgresql-for-doctrine` | 100+ fonctions JSONB, stockage 3x plus compact |
| **Index**           | GIN + Expression B-tree | PostgreSQL natif                          | Containment `@>` 15x plus rapide               |
| **Workflows**       | Symfony Workflow + BDD  | Factory `DynamicWorkflowLoader`           | Pattern validé prod (BillaBear)                |
| **Frontend Sophie** | EasyAdmin 4             | `easycorp/easyadmin-bundle`               | Écrans admin simples uniquement                |
| **Frontend Karim**  | Twig + Turbo + Stimulus | Symfony UX                                | UX réactive, risque accessibilité accepté      |
| **Checklists**      | Snapshot Pattern        | `myclabs/deep-copy`                       | `DoctrineProxyFilter` pour lazy-loaded         |
| **Import CSV**      | League\Csv + Messenger  | `league/csv`, `symfony/messenger`         | Sync <2000 lignes, async au-delà               |
| **Audit**           | auditor-bundle          | `damienharper/auditor-bundle`             | **776k installs, 7 ans, ManyToMany supporté**  |
| **Tests RGAA**      | Ara + axe-core + NVDA   | Outils DINUM                              | 50-70 j/h budget accessibilité                 |
| **Qualité code**    | SonarQube               | CI/CD intégré                             | Dès le départ (validé sponsor)                 |

---

## 7. Estimation & Planning

| Phase                                     | Durée          | Échéance estimée           |
| ----------------------------------------- | -------------- | -------------------------- |
| **Core** (entités, JSONB, workflows)      | 8-12 semaines  | Mars-Avril 2026            |
| **Interface Karim** (Twig/Turbo custom)   | 10-14 semaines | Mai-Juin 2026              |
| **Interface Sophie** (EasyAdmin + custom) | 4-6 semaines   | Juillet 2026               |
| **Imports/Exports + Messenger**           | 2-3 semaines   | Juillet 2026               |
| **Audit trail + sécurité**                | 2-3 semaines   | Août 2026                  |
| **Tests + corrections RGAA**              | 4-6 semaines   | Septembre 2026             |
| **TOTAL**                                 | **6-9 mois**   | **Juillet - Octobre 2026** |

---

## 8. Points Validés avec le Sponsor ✅

| #   | Point            | Décision validée                                |
| --- | ---------------- | ----------------------------------------------- |
| 1   | **Timeline**     | 6-9 mois acceptables (MVP juillet-octobre 2026) |
| 2   | **Plan B**       | Seulement si blocage technique total            |
| 3   | **Audit bundle** | `damienharper/auditor-bundle`                   |
| 4   | **Turbo**        | ✅ Validé (risque accessibilité accepté)        |
| 5   | **Budget RGAA**  | 50-70 j/h OK                                    |
| 6   | **SonarQube**    | Intégré CI/CD dès le départ                     |

---

**Niveau de confiance : 94%**

_Les 6% d'incertitude portent sur : (1) Impact réel de Turbo sur conformité RGAA, (2) Performance JSONB sur volumes >50k opérations_

---

**Statut** : 🟢 **P3.3 VALIDÉ — BUILD OpsTracker Stack P3.1**

_Prochaine étape : P3.4 - Concept détaillé de la solution retenue_
