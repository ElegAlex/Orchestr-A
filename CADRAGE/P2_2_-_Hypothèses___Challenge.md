# P2.2 - Hypothèses & Challenge

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ **MATRICE DES RISQUES & HYPOTHÈSES (RAT)** Confiance actuelle du projet : **Faible (35%)** ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. Le "Pre-Mortem" (Pourquoi ça pourrait rater)

> **"Si ce projet échoue dans 12 mois, ce sera probablement parce que..."**
>
> Les techniciens terrain (Karim) n'ont jamais adopté l'outil. Malgré une interface soignée, ils ont continué à utiliser "leur" Excel parce que (1) l'habitude était plus forte que la promesse de simplification — les projets avec une gestion du changement excellente ont 7 fois plus de chances de réussir, et nous n'avions aucun accompagnement ; (2) ils ont perçu l'outil comme un instrument de surveillance de leur productivité — 56% des employés ressentent de l'anxiété face au monitoring ; (3) le développeur solo a fait un burnout après 6 mois — 60% des mainteneurs open source ont quitté ou envisagé de quitter leurs projets, et 73% ont vécu un burnout. L'outil est devenu un projet zombie, non maintenu, que personne n'ose supprimer mais que personne n'utilise — reproduisant exactement le schéma des 346 millions d'euros du projet ONP "en pure perte".

---

## 2. Inventaire des Hypothèses (Trié par risque)

### 💎 Hypothèses de VALEUR (Désirabilité)

_"Les utilisateurs veulent-ils vraiment ça ?"_

| Hypothèse détectée                                                              | Pourquoi c'est risqué ? (Le doute)                                                                                                                                                                                        | Impact si Faux                                             |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **"Karim adoptera l'outil en 5 minutes sans formation"**                        | Même les logiciels "intuitifs" génèrent des données mal saisies et des fonctionnalités partiellement utilisées. La courbe d'oubli d'Ebbinghaus montre que 90% de la formation est perdue après un mois sans renforcement. | 🔴 **Mortel** — Sans adoption terrain, l'outil est inutile |
| **"L'ergonomie seule suffit à remplacer Excel"**                                | Les implémentations ERP échouent dans 55 à 75% des cas malgré des budgets conséquents. Excel fonctionne comme un "boundary object" aligné sur le travail réel.                                                            | 🔴 **Mortel** — Retour massif à Excel                      |
| **"Les techniciens ne percevront pas l'outil comme un instrument de contrôle"** | 78% des employeurs utilisent des logiciels de surveillance. Un outil de suivi des interventions sera immédiatement perçu comme outil de contrôle.                                                                         | 🟠 **Sévère** — Résistance passive, données faussées       |
| **"Le POC Pilote valide la demande pour OpsTracker"**                           | Le POC était dans un contexte de migration exceptionnelle avec engagement fort. Aucune donnée sur l'usage spontané en routine.                                                                                            | 🟠 **Sévère** — Généralisation abusive                     |

### 💰 Hypothèses de VIABILITÉ (Business)

_"Le modèle est-il soutenable ?"_

| Hypothèse détectée                                                | Pourquoi c'est risqué ?                                                                                                                           | Impact si Faux                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **"Un développeur solo peut maintenir un outil métier critique"** | 57% des projets open source ont un bus factor de 1. Les mainteneurs non payés consacrent moins de 10 heures par semaine à la maintenance.         | 🔴 **Mortel** — Abandon du projet             |
| **"Le modèle open source gratuit est viable sans revenus"**       | 60% des mainteneurs ne sont pas payés et 48% se sentent sous-appréciés. Sans structure d'appui, la pérennité est compromise.                      | 🟠 **Sévère** — Projet zombie à terme         |
| **"4 organisations adopteront l'outil dans les 3 mois"**          | Les grands projets numériques de l'État dépassent systématiquement leurs délais de plus de 30%. Aucun engagement formel des organisations cibles. | 🟡 **Pivot nécessaire** — Timeline irréaliste |

### 🛠 Hypothèses de FAISABILITÉ (Tech/Orga)

_"Peut-on le construire ?"_

| Hypothèse détectée                                                         | Pourquoi c'est risqué ?                                                                                                                                                     | Impact si Faux                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **"MVP fonctionnel en 3 jours"**                                           | La durée minimale réaliste pour un MVP est de 3 à 4 mois. Les projets IT dépassent en moyenne leurs délais de 45%.                                                          | 🔴 **Mortel** — Faux départ, dette technique    |
| **"RGAA 4.1 intégré dès le MVP"**                                          | Un grand portail de service public affiche seulement 46,51% de conformité RGAA malgré des années de travail. Les outils automatiques ne détectent que 30-40% des problèmes. | 🔴 **Mortel** — Sanctions 50k€, non-déploiement |
| **"Le bundle Symfony interne sera disponible et compatible"**              | Aucune confirmation formelle. Dépendance externe non maîtrisée.                                                                                                             | 🟡 **Retard** — Architecture à repenser         |
| **"L'architecture JSONB + Symfony Workflow fonctionnera du premier coup"** | Complexité technique élevée sans prototype préalable. Les estimations initiales peuvent varier d'un facteur 4 par rapport à la réalité.                                     | 🟡 **Retard** — Refactoring nécessaire          |

---

## 3. 🚨 TOP 3 : Hypothèses Critiques ("Leap of Faith")

_(Ces 3 points doivent être vérifiés AVANT d'écrire une ligne de code)_

### **1. 🎯 "Karim adoptera un nouvel outil sans formation ni accompagnement"**

C'est l'hypothèse la plus dangereuse car elle conditionne toute la valeur du projet. 40-50% des manquements SLA des techniciens sont attribuables à une mauvaise utilisation des applications. Sans adoption terrain, OpsTracker devient une coquille vide.

- **Le Test** : **Concierge MVP** — Pendant 2 semaines, accompagner physiquement 3 techniciens de la Organisation principale sur une mini-opération réelle (10 cibles). Utiliser un prototype papier ou Notion/Airtable, pas de code. Observer : combien de fois retournent-ils à Excel ? Combien d'étapes nécessitent une explication ?
- **Critère de Succès** : **> 80% des mises à jour de statut** faites dans l'outil (pas dans Excel à côté) ET **< 3 questions** par technicien sur 10 interventions.
- **Critère d'Échec** : Si < 50% des mises à jour dans l'outil → Repenser fondamentalement l'approche (formation obligatoire, champions terrain, incentives).

---

### **2. 🎯 "Un MVP fonctionnel et conforme RGAA est réalisable en 3 jours"**

Cette hypothèse est en contradiction directe avec toutes les données disponibles. Le projet SIRHEN a coûté 400-500 millions d'euros et a été abandonné après 11 ans en partie à cause d'estimations initiales irréalistes.

- **Le Test** : **Spike technique de 3 jours** — Développer UNIQUEMENT le module Planning avec import CSV et 1 dashboard basique. Mesurer le temps réel passé. Faire auditer l'accessibilité par un outil automatique (axe-core).
- **Critère de Succès** : Module fonctionnel ET > 70% de conformité automatique RGAA en 3 jours.
- **Critère d'Échec** : Si module incomplet OU < 50% RGAA → Recalibrer le planning sur **8-12 semaines minimum** pour le MVP complet.

---

### **3. 🎯 "Le développeur solo peut porter ce projet sur la durée"**

73% des mainteneurs open source ont vécu un burnout. Un outil métier critique pour 4+ organisations ne peut pas reposer sur une seule personne.

- **Le Test** : **Pre-commitment structurel** — Avant tout développement, formaliser par écrit : (1) Un plan B documenté si le développeur n'est plus disponible, (2) Un rattachement institutionnel même informel (DSI Organisation principale comme sponsor actif), (3) Un engagement de temps hebdomadaire réaliste (< 10h/semaine post-MVP).
- **Critère de Succès** : Plan B documenté ET sponsor actif identifié ET engagement formalisé.
- **Critère d'Échec** : Si aucun plan B → Envisager un rattachement à une structure existante (ADULLACT, DINUM) ou abandonner le projet avant investissement.

---

## 4. Recommandation Stratégique

| Feu Tricolore | Décision                                     | Action requise                                                                                                                         |
| ------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡            | **PAUSE — Valider les hypothèses critiques** | Lancer les 3 tests avant toute ligne de code. Recalibrer le planning de "3 jours" à "3 mois minimum". Formaliser le plan de pérennité. |

### Justification détaillée :

**Pourquoi pas 🔴 STOP ?**

- Le besoin est réel et documenté (POC Pilote, demande multi-organisations)
- Le gap marché existe (aucun concurrent direct sur le créneau)
- Le sponsor est engagé et disponible

**Pourquoi pas 🟢 GO ?**

- L'hypothèse "3 jours" est fantaisiste au regard des données
- L'hypothèse "zéro formation" contredit 40 ans de recherche
- Le bus factor = 1 est un risque structurel non adressé
- La conformité RGAA est sous-estimée d'un facteur 10

### Actions immédiates (avant P2.3) :

1. **Semaine 1** : Test Concierge avec 3 techniciens Organisation principale
2. **Semaine 2** : Spike technique 3 jours → mesure réaliste
3. **Semaine 2** : Formalisation plan de pérennité avec sponsor
4. **Semaine 3** : GO/NO-GO basé sur résultats des tests

---

## Annexe : Faits vs Hypothèses (Traçabilité)

| Ce qu'on SAIT (Fait documenté)                   | Ce qu'on CROIT (Hypothèse)                 |
| ------------------------------------------------ | ------------------------------------------ |
| Le POC Pilote a été "apprécié" (P0)              | Les organisations l'utiliseront en routine |
| 4 organisations ont "exprimé des besoins" (P0)   | Elles adopteront OpsTracker                |
| Excel pose des problèmes de consolidation (P1.1) | OpsTracker résoudra ces problèmes          |
| L'ergonomie de ProjeQtOr est mauvaise (P1.2)     | Une bonne UX suffit à l'adoption           |
| Karim veut "ne pas chercher ses infos" (P1.3)    | Il utilisera l'outil spontanément          |
| Le sponsor valide le projet (P0)                 | Les ressources suivront                    |

---

**Niveau de confiance : 85%** sur l'analyse des risques

_Les 15% d'incertitude portent sur la réaction réelle du sponsor aux recalibrages proposés et sur les résultats des tests à venir._

---

**Statut** : 🟡 **PAUSE — TESTS CRITIQUES REQUIS**

_Prochaine étape : Exécuter les 3 tests avant de passer à P2.3 (Problem Statement)_
