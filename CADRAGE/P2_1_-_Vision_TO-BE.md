# P2.1 - Vision TO-BE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 **VISION PRODUIT & OBJECTIFS STRATÉGIQUES** Confiance : **92%** (Insights P1.4 clairs + Deep Research validant le positionnement) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## 1. La Vision (Le "Pourquoi")

> **MANIFESTE** : _"Chaque opération IT pilotée, pas subie. Chaque technicien équipé, pas perdu. Chaque organisation autonome, pas dépendante."_

**Le Pitch d'Ascenseur (Format Geoff Moore)** :

> _"Pour les **gestionnaires d'opérations IT des organisations** qui ont besoin de **piloter des opérations de masse (migrations, déploiements, renouvellements) sans passer plus de temps à consolider qu'à piloter**, OpsTracker est une **application de pilotage d'opérations terrain** qui apporte **une source unique de vérité avec dashboards temps réel, checklists protégées et documentation contextuelle**. Contrairement aux **fichiers Excel ad hoc** qui dispersent les données et forcent la consolidation manuelle, ou aux **solutions enterprise** (Juriba, ReadyWorks) qui coûtent plus de 50k€/an, nous offrons **une solution simple, souveraine, conforme RGAA et immédiatement adoptable — sans formation, sans cloud US, sans budget prohibitif, et 100% compatible SILL**."_

---

## 2. État Cible (TO-BE Experience)

### 🎬 L'expérience idéale : "Le Vendredi de Sophie"

_Vendredi 16h30. La direction demande un point d'avancement sur le renouvellement de parc._

**Avant (AS-IS)** : Sophie soupire. Elle doit fusionner 5 fichiers Excel reçus par mail, gérer 3 conflits de versions, recréer des graphiques PowerPoint. Elle finira à 19h, stressée, avec des données dont elle n'est même pas sûre de la fiabilité.

**Après (TO-BE)** : Sophie ouvre OpsTracker. En 2 clics, elle affiche le dashboard de la campagne "Renouvellement 2025". Taux de réalisation : 73%. Reste : 42 postes à traiter. Elle génère un PDF, l'envoie par mail. 16h35, c'est fait. Elle rentre chez elle.

---

### 🎬 L'expérience idéale : "La Matinée de Karim"

_Lundi 8h30. Karim commence sa semaine de déploiements._

**Avant (AS-IS)** : Karim ouvre ses mails pour retrouver ses affectations. Il cherche le fichier Excel partagé (qui a été renommé). Il trouve une procédure en PDF qu'il doit ouvrir à côté. Entre deux interventions, il oublie de reporter son avancement. En fin de journée, il doit tout ressaisir.

**Après (TO-BE)** : Karim ouvre OpsTracker. Sa vue "Mes interventions" lui montre ses 6 RDV du jour avec toutes les infos (utilisateur, poste, lieu, créneau). Il clique sur la première. La checklist s'affiche : 8 étapes, liens vers les docs intégrés qui s'ouvrent en contexte. Il coche au fur et à mesure, change le statut en 2 clics. Tout est synchronisé automatiquement. 0 ressaisie, 0 recherche.

---

### Matrice de Transformation

| Dimension             | État Actuel (AS-IS)                             | État Cible (TO-BE)                                            | Le Gap (Delta)                                               |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| **Source de données** | Excel ad hoc, multiples versions                | Source unique de vérité centralisée                           | Module Planning avec import CSV + champs JSONB configurables |
| **Consolidation**     | Fusion manuelle chronophage (heures)            | Dashboard temps réel automatique (<5 min)                     | Module Dashboard avec widgets F-shape, export PDF            |
| **Checklists**        | PDF statiques, pas de suivi, écrasement au edit | Interactives, versionnées, protégées "in progress"            | Module Checklists avec Snapshot Pattern                      |
| **Documentation**     | Fichiers dispersés, ouverture manuelle          | Contextuelle, liée aux opérations, métriques d'usage          | Module Base documentaire avec Just-in-Time linking           |
| **Coordination**      | Mail/Teams dispersé                             | Tout-en-un, assignations visibles, dernière connexion trackée | Vue "Mes interventions" + tracking engagement                |
| **Reporting**         | Graphiques PowerPoint manuels                   | Export PDF/URL partageable en 2 clics                         | Vues lecture seule partageables                              |
| **Capitalisation**    | Aucune (fichier abandonné)                      | Templates réutilisables entre campagnes                       | Import/Export config de campagne (YAML/JSON)                 |
| **Formation**         | Variable (selon complexité outil)               | Zéro — Time to First Value < 24h                              | UX zero-training, sensible defaults, patterns mobile-first   |
| **Accessibilité**     | Non garantie                                    | RGAA 4.1 natif (obligation légale)                            | Contraste 4.5:1, navigation clavier, alternatives textuelles |
| **Émotion Sophie**    | Stressée, submergée                             | Sereine, en contrôle                                          | Confiance dans les données fiables                           |
| **Émotion Karim**     | Perdu, double saisie                            | Organisé, fluide                                              | Tout au même endroit, UX laptop optimisée                    |

---

## 3. Objectifs & KPIs (Le "Comment on mesure")

### ⭐ North Star Metric

| Élément                  | Détail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Métrique**             | **Taux d'interventions avec statut mis à jour par le technicien assigné**                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Pourquoi celle-là ?**  | Cette métrique capture simultanément : (1) la productivité réelle (opérations terminées), (2) l'adoption terrain (Karim utilise l'outil pour reporter, pas un Excel à côté), (3) la qualité des données (source unique de vérité). Les benchmarks Field Service Management confirment que le **First-Time Fix Rate** (70-80% cible, 85%+ excellence) et le **Technician Utilization** (80-90%) sont les standards de l'industrie. Notre métrique les combine en une seule mesure actionnable. |
| **Cible MVP**            | **> 90%** des interventions d'une campagne pilote avec statut mis à jour par le technicien                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Mesure**               | Ratio (interventions avec statut ∈ {Réalisé, Reporté, À remédier} ET `updated_by` = technicien assigné) / (total interventions dont date RDV est passée)                                                                                                                                                                                                                                                                                                                                      |
| **Comportement attendu** | Karim met à jour **en temps réel** sur son laptop dès qu'il finit son intervention. Pas de délai toléré — si le statut reste "Planifié" après le RDV, c'est un signal d'alerte.                                                                                                                                                                                                                                                                                                               |

---

### 📉 Objectifs Business (Viabilité)

| Objectif              | KPI (Métrique)                                                                | Cible (Target)               | Horizon       |
| --------------------- | ----------------------------------------------------------------------------- | ---------------------------- | ------------- |
| **MVP fonctionnel**   | Modules core opérationnels (Planning + Dashboard + Checklists + Docs + Users) | 100% features P0             | **T+3 jours** |
| **Adoption initiale** | Nombre de organisations utilisatrices actives                                 | 4 organisations (A, B, C, E) | **T+3 mois**  |
| **Réutilisation**     | Nombre de campagnes créées                                                    | ≥ 2 campagnes / organisation | T+6 mois      |
| **Référencement**     | Soumission SILL                                                               | Dossier déposé               | T+6 mois      |
| **TCO**               | Coût total (dev + maintenance)                                                | < 5 000€ équivalent temps    | T+12 mois     |

> **Note** : Modèle économique "zéro coût licence" (open source EUPL 1.2, self-hosted). La viabilité se mesure en **adoption** et **réutilisation**, pas en revenus.

---

### ❤️ Objectifs Utilisateurs (Désirabilité / Outcome)

| Persona                   | Outcome espéré (Ce qu'il gagne vraiment)          | Proxy Metric (Preuve de succès)                                    |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| **Sophie (Gestionnaire)** | Ne plus passer de temps à consolider des fichiers | Temps de génération reporting < **5 min** (vs heures actuellement) |
| **Sophie**                | Créer une campagne sans aide technique            | Configuration complète < **30 min** sans intervention dev          |
| **Sophie**                | Capitaliser sur les campagnes précédentes         | Temps de création campagne N+1 < **10 min** (via duplication)      |
| **Karim (Technicien)**    | Savoir exactement quoi faire sans chercher        | Temps d'accès aux infos intervention < **30 sec** (2 clics max)    |
| **Karim**                 | Ne plus ressaisir ses avancements                 | **0 double saisie** (synchronisation automatique)                  |
| **Karim**                 | Accéder aux procédures sans quitter l'app         | Docs affichés en contexte, **0 navigation externe**                |
| **Direction**             | Avoir une réponse fiable à "on en est où ?"       | Accès dashboard en < **1 min**, données < **24h** de fraîcheur     |

---

### 🏥 Health Metrics (Contre-mesures)

_Ce qu'on ne doit pas casser en cherchant l'adoption :_

| Health Metric                         | Seuil d'alerte           | Pourquoi c'est critique                                                              |
| ------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| **DAU/MAU ratio** (jours ouvrés)      | < 40%                    | Benchmark B2B interne = 40%+. En dessous, l'outil n'est pas ancré dans les habitudes |
| **Taux de feedback positif docs**     | < 80%                    | Benchmark industrie 80%+. Docs non utiles = techniciens frustrés                     |
| **Taux de recherches échouées**       | > 10%                    | Signale des gaps documentaires à combler                                             |
| **Performance (temps de chargement)** | > 3 sec vues principales | UX dégradée = retour à Excel                                                         |
| **Conformité RGAA**                   | < 75% critères AA        | Obligation légale, sanctions jusqu'à **50 000€** renouvelables                       |
| **Bugs critiques non résolus**        | > 2                      | L'outil doit être fiable pour devenir la source de vérité                            |

---

### 📊 Métriques de Tracking Spécifiques (Validées avec sponsor)

| Module                            | Métrique                  | Implémentation                                                                                |
| --------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| **Planning**                      | Changements de statut RDV | Log `intervention_id`, `old_status`, `new_status`, `changed_by`, `changed_at`                 |
| **Users**                         | Dernière connexion        | Champ `last_login_at` sur entité User, mis à jour à chaque auth                               |
| **Docs (procédures intégrées)**   | Nombre de vues            | Event `document_view` avec `document_id`, `user_id`, `context_operation_id`, `timestamp`      |
| **Docs (fichiers .exe, scripts)** | Nombre de téléchargements | Event `document_download` avec même structure                                                 |
| **Docs**                          | Liaison opération         | Chaque document est lié à une opération spécifique (pas de docs "globaux") via `operation_id` |

---

## 4. Gap Analysis & Pré-requis

Pour passer de l'AS-IS au TO-BE, les plus gros défis seront :

### 🔧 Défi Tech #1 : Configurabilité sans complexité

**Le problème** : Tout doit être paramétrable (champs, statuts, segments, checklists) pour être générique. Mais cette configurabilité ne doit pas se traduire en complexité pour Sophie ou Karim.

**La tension** : Plus c'est configurable → Plus c'est complexe à concevoir et à utiliser.

**Résolution (Deep Research validée)** :

- **Architecture JSONB** plutôt qu'EAV : Performances 2x supérieures en chargement, stockage 3x plus compact, requêtes simplifiées. Index **GIN avec jsonb_path_ops** pour les requêtes de containment.
- **Sensible Defaults** : Valeurs pré-configurées optimales (workflows standards, statuts type, notifications) pour réduire le time-to-value. Éviter la "constantphobia" (tout rendre configurable = explosion de complexité).
- **Symfony Workflow** avec définitions stockées en base : Pattern `DynamicWorkflowLoader` permettant des workflows éditables sans modification de code.

---

### 🔧 Défi Tech #2 : Protection des checklists "in progress"

**Le problème** : Dans le POC Pilote, modifier une checklist écrasait tout le suivi existant. C'est un irritant identifié.

**Résolution (Deep Research validée)** :

- **Snapshot Pattern** : Lors de la création d'une instance de checklist, la structure complète du template est copiée dans un champ `snapshot_structure` (JSONB).
- Les instances "in progress" ne sont **jamais affectées** par les modifications du template.
- Audit trail préservé via `template_id` + `template_version`.
- Chaque nouvelle version du template crée un nouveau record avec `is_active = true`.

---

### 🔧 Défi Tech #3 : Documentation contextuelle

**Le problème** : Les docs doivent être liés aux opérations (pas globaux) et s'afficher au bon moment dans les checklists.

**Résolution (Deep Research validée)** :

- Pattern **Just-in-Time Documentation** : Chaque document est associé à des contextes (type d'opération, étape de checklist, équipement).
- Schéma de liaison : `document_id`, `context_type` (operation, checklist_item), `context_id`, `display_priority`, `trigger_condition` (auto_show, on_demand).
- Benchmarks : Réduction tickets support de **15-30%** avec aide contextuelle (Jungle Scout -21%, Shopify -22%).

---

### 👥 Défi Orga/Humain : Adoption terrain (Karim)

**Le problème** : Le risque N°1 du projet. Si les techniciens n'adoptent pas instantanément, ils retourneront à leur Excel local.

**Résolution (Deep Research validée)** :

- **UX laptop optimisée** : Interface responsive desktop-first, navigation claire, actions en 2 clics max, touch targets confortables pour usage laptop.
- **Time to First Value < 24h** : Templates pré-configurés, checklists d'onboarding progressives (max 6 étapes), Just-in-Time Hints contextuels.
- **Zéro formation** : Si ça nécessite un manuel, c'est mal conçu.

---

### ⚖️ Défi Réglementaire : RGAA + HDS

**Le problème** : Conformité RGAA obligatoire (sanctions 50k€), et question HDS si données de santé.

**Résolution (Deep Research validée)** :

- **RGAA 4.1 intégré dès la conception** : 106 critères basés sur WCAG 2.1 AA. Priorités : ratio contraste 4.5:1, navigation clavier complète, alternatives textuelles graphiques, jamais la couleur seule pour transmettre l'info.
- **Exclusion HDS** : OpsTracker ne doit héberger **aucune donnée de santé** (NIR, données médicales, infos patients). Politique formellement documentée. Si cette règle est respectée, pas de certification HDS requise.
- **Stack 100% SILL** : Symfony + PostgreSQL référencés SILL = acceptation facilitée par les DSI.

---

## 5. Principes Directeurs (Les "Non-Négociables")

| Principe                                      | Traduction concrète                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **"Toutes les features, pas de négociation"** | 100% des modules P0 implémentés en V1. Pas de priorisation MoSCoW, tout est Must Have.                             |
| **"Karim d'abord"**                           | UX terrain optimisée en priorité. Si une feature complique l'expérience terrain, elle est repensée, pas supprimée. |
| **"Données fiables > Données riches"**        | Mieux vaut 5 champs fiables que 20 champs approximatifs.                                                           |
| **"Zéro formation, sensible defaults"**       | Templates pré-configurés, valeurs par défaut intelligentes, onboarding progressif.                                 |
| **"Souverain et conforme"**                   | Self-hosted, open source EUPL 1.2, RGAA 4.1 natif, pas de dépendance cloud US, SILL-ready.                         |
| **"Docs liés, pas globaux"**                  | Chaque document appartient à une opération, s'affiche en contexte.                                                 |

---

## 6. Features à Tracer (Issues P4.1)

Issues confirmées à formaliser en phase Specify :

- [ ] **Export PDF dashboard** (direction) — P1.4
- [ ] **Import/Export CSV de configuration de campagne** (partage inter-organisations) — P1.4
- [ ] **URL partageable lecture seule** (direction) — P1.4
- [ ] **Versioning des checklists** avec Snapshot Pattern — P0 + Deep Research
- [ ] **Vue "Mes interventions" par défaut** pour Karim — P1.3
- [ ] **Tracking dernière connexion** sur module Users — Sponsor
- [ ] **Métriques docs** : vues (procédures) + téléchargements (fichiers) — Sponsor
- [ ] **Liaison docs → opérations** (pas de docs globaux) — Sponsor
- [ ] **Index GIN jsonb_path_ops** sur champs JSONB — Deep Research
- [ ] **Conformité RGAA 4.1** dès le MVP — Deep Research (obligation légale)

---

## 7. Timeline Révisée

| Jalon                              | Horizon       | Critère de succès                                                                |
| ---------------------------------- | ------------- | -------------------------------------------------------------------------------- |
| **MVP fonctionnel**                | **T+3 jours** | 100% modules P0 opérationnels (Planning + Dashboard + Checklists + Docs + Users) |
| **Pilote Organisation principale** | T+2 semaines  | 1 campagne réelle suivie via OpsTracker                                          |
| **4 organisations actives**        | **T+3 mois**  | Organisation A, 75, 77, 93 avec au moins 1 campagne chacune                      |
| **Référencement SILL**             | T+6 mois      | Dossier de soumission déposé                                                     |

---

## 8. Architecture Technique Recommandée (Preview P4.2)

| Composant               | Choix                                  | Justification Deep Research                                  |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------ |
| **Champs dynamiques**   | JSONB + index GIN jsonb_path_ops       | 2x plus rapide que EAV, 3x plus compact                      |
| **Workflows statuts**   | Symfony Workflow + définitions en base | DynamicWorkflowLoader, éditable sans code                    |
| **Checklists**          | Snapshot Pattern                       | Protection "in progress", audit trail natif                  |
| **Docs contextuels**    | Just-in-Time Documentation             | Liaison context_type/context_id, -20% tickets support        |
| **Tracking engagement** | Event-based + Matomo self-hosted       | RGPD compliant, approuvé CNIL                                |
| **Licence**             | EUPL 1.2                               | Validité juridique EU, compatible GPL, idéale secteur public |

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ POINTS VALIDÉS AVEC LE SPONSOR

| #   | Point                 | Décision validée                                                                                                            |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | **North Star Metric** | Taux d'interventions avec statut mis à jour par le technicien assigné — mise à jour **temps réel** sur laptop, pas de délai |
| 2   | **Exclusion HDS**     | ✅ Confirmé — OpsTracker n'hébergera **jamais** de données de santé (NIR, patients). Pas de certification HDS requise.      |
| 3   | **Licence**           | ✅ **EUPL 1.2** validée                                                                                                     |
| 4   | **UX terrain**        | ❌ Pas de swipe gestures mobile — techniciens sur **laptop**, UX desktop-first                                              |
| 5   | **Timeline**          | ✅ T+3 jours MVP, pas de contrainte calendaire                                                                              |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

**Statut** : 🟢 **VALIDÉ — GO P2.2**

_Prochaine étape : P2.2 - Hypothèses_
