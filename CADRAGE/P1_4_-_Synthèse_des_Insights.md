# P1.4 - Synthèse des Insights

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 **SYNTHÈSE STRATÉGIQUE DISCOVERY — VALIDÉE** Maturité du sujet : **Élevée** Confiance globale : **90%** ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## 1. Top Insights (La "Vérité" du projet)

| #   | Insight                                                                                                                                                                                                                                                                                    | Source(s)                                                                                              | Impact Stratégique                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | **L'ergonomie est LE critère de différenciation** — Les solutions open source FR (ProjeQtOr, Redmine) couvrent fonctionnellement le besoin mais sont rejetées pour leur UX déplorable. Le budget formation limité transforme l'intuitivité en critère éliminatoire, pas en "nice to have". | P1.2 (ProjeQtOr = contre-exemple) + P1.3 (Karim < 5min) + P0 (budget formation limité)                 | 🟢 Différenciation majeure — Gagner sur l'UX, pas sur les features |
| 2   | **Le "problème Excel" n'est pas Excel lui-même** — C'est l'absence de source unique de vérité qui force la création de fichiers ad hoc. Le POC Pilote a prouvé qu'une base centralisée résout le problème de consolidation sans remplacer Excel pour les analyses.                         | P1.1 (fusion manuelle) + P1.3 (Sophie passe plus de temps à consolider qu'à piloter) + P0 (POC validé) | 🟢 Positionnement clair — Ne pas concurrencer Excel, le compléter  |
| 3   | **Le marché n'existe pas... et c'est une opportunité** — Aucun outil ne combine self-hosted + RGAA + pilotage ops IT terrain + secteur public FR. Ce n'est pas un marché saturé avec des concurrents à déplacer, c'est un gap à combler.                                                   | P1.2 (gap SILL confirmé) + P0 (contraintes Symfony/RGAA/self-hosted)                                   | 🟢 Blue ocean — Créer la catégorie plutôt que la disputer          |
| 4   | **Le persona "terrain" (Karim) est le goulot d'étranglement critique** — Si les techniciens n'adoptent pas l'outil instantanément, ils retourneront à leur Excel local. Sophie peut configurer le meilleur système du monde, il sera inutile si Karim ne l'utilise pas.                    | P1.3 (Karim = UX non-négociable) + P1.1 (techniciens avec laptop terrain)                              | 🔴 Risque critique — L'adoption terrain conditionne tout           |
| 5   | **La protection des checklists "in progress" est un irritant résolu par personne** — Le POC Pilote a identifié ce problème (modification écrase le suivi), et aucune solution marché ne propose de checklists multi-phases avec protection native. C'est un micro-avantage défendable.     | P0 (leçon POC) + P1.2 (checklists rudimentaires partout) + P1.3 (Karim interrompu = perte du contexte) | 🟢 Feature différenciante — Innovation low-tech mais impactante    |
| 6   | **Le cumul de rôles simplifie l'adoption mais complexifie l'UX** — Dans les petites organisations, une même personne peut être Sophie ET Karim. L'interface doit permettre cette polyvalence sans multiplier les vues/menus.                                                               | P1.3 (cumul validé sponsor) + P0 (organisations hétérogènes)                                           | 🟡 Contrainte design — Interface adaptative, pas séparée           |

---

## 2. Patterns & Paradoxes

### 🔄 Pattern récurrent : "L'outil est apprécié tant qu'il ne demande aucun effort"

Le POC Pilote a été "très apprécié" mais les utilisateurs veulent pouvoir le configurer "sans aide technique" (Sophie) et l'utiliser "en 5 minutes sans formation" (Karim). Le paradoxe apparent (outil puissant ET simple) se résout si on accepte que la configuration est le job de Sophie, pas de Karim.

→ _Implication_ : Deux expériences utilisateur distinctes mais cohérentes — Sophie configure (admin simplifié), Karim exécute (interface épurée).

---

### ⚡ Paradoxe identifié : "Les organisations veulent mutualiser mais gardent leurs spécificités"

Quatre organisations demandent le même outil (37, 75, 77, 93), mais chacune a ses propres champs, statuts, segments. La généricité totale risque de produire un outil trop abstrait; la spécificité tue la mutualisation.

→ _Implication_ : Le modèle de données doit être "configurablement standardisé" — templates partagés + personnalisations encadrées. Prévoir un **import/export CSV de configuration de campagne** pour permettre le partage informel entre organisations.

---

### 🔄 Pattern récurrent : "La direction veut voir, pas toucher"

Le persona Direction n'a qu'un seul besoin : "savoir si on est dans les temps". Pas de manipulation, pas de saisie, juste de la consultation.

→ _Implication_ : Prévoir des **vues lecture seule partageables (URL)** ET un **export PDF** dès la V1. Faible effort, forte valeur perçue auprès des sponsors.

---

## 3. Hypothèses Préliminaires (À vérifier en P2)

### Hypothèse de Valeur

**Nous croyons que** les gestionnaires d'opérations IT (Sophie) adopteront OpsTracker parce qu'il leur permettra de **créer une nouvelle campagne en moins de 30 minutes** et d'**obtenir un dashboard temps réel sans consolidation manuelle**, là où leur processus actuel prend plusieurs heures et génère des données non fiables.

- _Niveau de confiance actuel :_ **Fort** (validé par le POC Pilote + pain points P1.1 + verbatims P1.3)

---

### Hypothèse d'Usage

**Nous croyons que** les techniciens terrain (Karim) utiliseront effectivement l'outil **si et seulement si** l'interface leur présente leurs interventions du jour avec toutes les infos nécessaires **en moins de 2 clics**, et si les checklists sont **cochables avec accès direct aux docs**.

- _Niveau de confiance actuel :_ **Moyen** (déduit des frustrations P1.3, mais pas de test terrain direct)
- _Note sponsor :_ Test utilisateur prévu avant mise en production, pas avant/pendant le développement (mode "benevolent dictator")

---

### Hypothèse de Risque

**Le principal obstacle sera** la résistance au changement des techniciens habitués à "leur" Excel et la perception que l'outil ajoute une couche de reporting/contrôle.

- _Niveau de confiance actuel :_ **Moyen** (risque classique d'adoption, non spécifique au projet mais réel)
- _Mitigation :_ UX irréprochable dès la V1 — pas de seconde chance pour la première impression

---

### Hypothèse de Différenciation

**Nous croyons que** le positionnement "simple, souverain, accessible" suffira à écarter les solutions cloud US (Monday, Smartsheet) et les usines à gaz enterprise (Juriba), car les organisations n'ont ni le budget ni la tolérance au risque souveraineté pour ces alternatives.

- _Niveau de confiance actuel :_ **Fort** (contraintes P0 + analyse concurrentielle P1.2)

---

## 4. Matrice de Confiance (Go / No-Go)

| Domaine                   | Statut | Commentaire                                                                                                                    |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Compréhension du problème | 🟢     | Pain points documentés (P1.1), validés par POC (P0), confirmés par personas (P1.3)                                             |
| Connaissance de la cible  | 🟢     | Personas détaillés avec JTBD, besoins explicites/implicites/latents, anti-personas définis                                     |
| Vue sur la concurrence    | 🟢     | Gap marché confirmé, positionnement clair, aucun concurrent direct sur le créneau                                              |
| Faisabilité technique     | 🟡     | Contrainte Symfony validée, mais dépendance au bundle AM non confirmée (5% d'incertitude P0)                                   |
| Risque d'adoption         | 🟠     | Karim = point critique. Risque **assumé** — validation terrain reportée post-déploiement. Mitigation = UX irréprochable dès V1 |
| Viabilité long terme      | 🟢     | Self-hosted = pas de coût récurrent, potentiel SILL = légitimité, demande multi-organisations = base installée                 |

---

## 5. Features à tracer pour P4.1 (Requirements)

Issues de la validation sponsor, à formaliser en phase Specify :

- [ ] **Export PDF dashboard** (direction)
- [ ] **Import/Export CSV de configuration de campagne** (partage inter-organisations informel)
- [ ] **URL partageable lecture seule** (direction)

---

## 6. Recommandation pour la phase "DEFINE"

☑️ **Décision** : **GO**

La Discovery révèle un alignement rare entre le problème (réel et documenté), le marché (gap confirmé), et les contraintes (qui deviennent des avantages compétitifs). Les risques identifiés sont gérables et assumés.

👉 **Prochaine étape clé** : Formaliser la vision TO-BE en répondant à cette question centrale :

> **"Comment OpsTracker peut-il être assez simple pour que Karim l'utilise sans formation, tout en étant assez configurable pour que Sophie adapte chaque campagne sans développeur ?"**

C'est la tension design fondamentale du projet. La phase Define doit la résoudre avant de passer aux options de solution.

---

## 7. Points Validés avec le Sponsor ✅

| #   | Point              | Question                                              | Décision validée                                              |
| --- | ------------------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Hypothèse Karim    | Test utilisateur envisageable avant/pendant dev ?     | ❌ Avant mise en prod uniquement (mode "benevolent dictator") |
| 2   | Templates partagés | Gouvernance prévue pour partage inter-organisations ? | ❌ Hors scope — mais import/export CSV de config retenu       |
| 3   | Vues Direction     | URL partageable suffit ?                              | ❌ URL partageable **+ Export PDF** requis                    |

---

**Niveau de confiance global : 90%**

_Les 10% d'incertitude portent sur (1) la validation terrain de l'hypothèse d'usage Karim reportée post-déploiement et (2) la disponibilité effective du bundle Symfony interne._

---

**Statut** : ✅ **DISCOVERY VALIDÉE — GO DEFINE (P2)**

_Prochaine étape : P2.1 - Vision TO-BE_
