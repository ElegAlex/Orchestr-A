# P1.1 - Analyse AS-IS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 📊 **ANALYSE AS-IS VALIDÉE** Confiance globale : **90%** ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. Cartographie des Processus Actuels

_(Flux typique pour une opération IT de masse - hors POC Pilote)_

- **Étape 1 - Identification des cibles** : Export depuis source variable selon le projet (GLPI pour le parc, AD pour les users, ANR pour les agents) → Fichier Excel ad hoc créé pour l'occasion
- **Étape 2 - Structuration manuelle** : Ajout de colonnes spécifiques au projet (dates, statuts, opérateur assigné...) sans modèle réutilisable
- **Étape 3 - Dispatch** : Communication par mail aux techniciens de leurs cibles/créneaux
- **Étape 4 - Exécution terrain** : Technicien avec laptop, mise à jour du fichier Excel partagé (ou de sa copie locale)
- **Étape 5 - Consolidation** : Fusion manuelle des retours, gestion des conflits de version
- **Étape 6 - Reporting** : Création manuelle de métriques/graphiques selon demande direction
- **Étape 7 - Clôture** : Archivage sans capitalisation structurée, le fichier Excel est abandonné

**Exception notable** : La migration POC Pilote a bénéficié du POC "POC RDV" (hébergé Direction régionale), validant les concepts de planification centralisée, checklists et dashboard intégré.

## 2. Stack Outils & Données

| Outil                | Usage                                      | Limite                                                  |
| -------------------- | ------------------------------------------ | ------------------------------------------------------- |
| **GLPI**             | Source parc informatique (postes, devices) | Pas de module pilotage opérations                       |
| **Active Directory** | Source utilisateurs/comptes                | Export manuel uniquement                                |
| **ANR**              | Source agents (données RH)                 | Pas d'intégration directe                               |
| **Excel**            | Suivi ad hoc par projet                    | Aucune pérennité, pas de traçabilité, conflits versions |
| **Mail/Teams**       | Coordination équipes                       | Information dispersée, non exploitable                  |

- **Flux de données** : **Manuel / Ad hoc / Non capitalisé**
- **Intégration** : Aucune — Copier-coller systématique entre sources

## 3. Pain Points Confirmés

- 🔴 **Absence d'outil mature** : Chaque opération repart de zéro avec un Excel créé pour l'occasion, aucune capitalisation
- 🔴 **Pas de source unique de vérité** : Multiples versions de fichiers, données dispersées
- 🔴 **Zéro traçabilité** : Impossible de savoir qui a fait quoi, quand, avec quel résultat
- 🔴 **Checklists non gérées** : Procédures en Word/PDF, pas de suivi d'avancement par étape
- 🔴 **Pas de vue consolidée** : Dashboard inexistant, reporting manuel chronophage
- 🔴 **Non réutilisable** : Aucun template, chaque projet réinvente la roue

## 4. Workarounds Actuels

- 📁 **Excel ad hoc** : Fichier créé spécifiquement pour chaque opération, structure variable
- 📧 **Mail** : Coordination par échanges informels, CR non structurés
- 💻 **Laptop terrain** : Les techniciens accèdent au fichier partagé depuis leur poste portable
- 🏢 **Silos organisationnels** : Chaque organisation gère ses opérations indépendamment (les opérations multi-organismes sont exceptionnelles)

## 5. Existant Valorisable : POC Pilote RDV

L'application développée pour la migration POC Pilote constitue la **preuve de concept validée** :

| Module POC                    | Retour terrain               | Statut                |
| ----------------------------- | ---------------------------- | --------------------- |
| Planification centralisée     | ✅ Très apprécié             | À génériciser         |
| Segmentation (sites/services) | ✅ Source unique de vérité   | À paramétrer          |
| Checklists par phase          | ⚠️ Problème écrasement suivi | À protéger            |
| Dashboard avancement          | ✅ Visibilité direction      | À rendre configurable |
| Base documentaire             | ✅ Accès contextualisé       | À conserver           |

**Leçon clé** : Pas d'irritants majeurs remontés, mais **fort intérêt** exprimé pour disposer d'une version générique et adaptable à d'autres contextes.

---

## Synthèse AS-IS

| Dimension      | État actuel       | Cible OpsTracker        |
| -------------- | ----------------- | ----------------------- |
| Outil          | Excel ad hoc      | Application dédiée      |
| Capitalisation | Aucune            | Templates réutilisables |
| Traçabilité    | Inexistante       | Audit trail complet     |
| Collaboration  | Mail/fichiers     | Temps réel centralisé   |
| Reporting      | Manuel            | Dashboard configurable  |
| Checklists     | Word/PDF statique | Dynamiques, protégées   |
| Multi-sources  | Export manuel     | Import CSV mappé        |

---

**Statut** : ✅ **AS-IS VALIDÉ**

_Prochaine étape : P1.2 - Deep Research (Marché)_
