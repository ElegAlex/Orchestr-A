# Planning d'activités récurrentes — Guide utilisateur

> Orchestr'A V2 — CPAM 92 Hauts-de-Seine
> Version 1.0 · avril 2026

---

## À quoi ça sert

Le module **Planning d'activités récurrentes** permet de créer des tâches qui se répètent automatiquement — permanences d'accueil, saisies mensuelles de budget, reportings hebdomadaires, revues managériales — et de les répartir équitablement entre les agents du service. Chaque tâche porte un poids (charge estimée) qui aide à équilibrer les plannings. Une fois les assignations générées, chaque agent déclare l'avancement de ses tâches directement depuis son planning, et le responsable suit l'exécution en temps réel.

---

## Glossaire

| Terme | Définition |
|---|---|
| **Tâche prédéfinie** | Gabarit de tâche réutilisable (nom, icône, durée estimée, poids). Sert de modèle pour générer des occurrences dans le planning. |
| **Assignation** | Occurrence concrète d'une tâche prédéfinie, affectée à un agent à une date donnée. |
| **Règle récurrente** | Paramètres de répétition d'une tâche : fréquence (hebdomadaire, mensuelle), agents concernés, plage de dates. |
| **Poids** | Estimation de la charge d'une tâche, de 1 (Très légère) à 5 (Très lourde). Affiché par une pastille colorée dans le planning. |
| **Vue activité** | Tableau croisé tâches × jours, alternative à la vue par agent. Réservée aux responsables disposant de l'accès correspondant. |
| **Statut d'exécution** | État de réalisation d'une assignation : Non fait, En cours, Fait, Non applicable. Déclaré par l'agent ou le responsable de service. |

---

## Tutoriel 1 — Configurer une tâche récurrente

**Profil concerné : responsable de service**

### 1. Accéder au planning

Dans le menu latéral gauche, cliquez sur **Planning**.

![Menu latéral avec l'entrée Planning mise en évidence](./captures/01-menu-planning.png)

### 2. Créer le gabarit de tâche prédéfinie

Cliquez sur **Tâches prédéfinies** puis sur **Nouvelle tâche**.

Renseignez les champs suivants :

- **Nom** : libellé affiché dans le planning (ex : *Permanence accueil matin*).
- **Icône** : pictogramme pour identifier visuellement la tâche.
- **Durée estimée** : en minutes (ex : 120 min).
- **Créneau** : matin, après-midi ou journée entière.
- **Poids** : sélectionnez de 1 à 5 selon la charge réelle de la tâche (voir la [Grille de référence des poids](#grille-de-référence-des-poids)).

> **Exemple :** Permanence accueil matin — durée 90 min — créneau matin — **poids 2 (Légère)**.

![Formulaire de création d'une tâche prédéfinie avec le sélecteur de poids](./captures/02-formulaire-tache-predefinie-poids.png)

Cliquez sur **Enregistrer**.

### 3. Créer la règle récurrente

Depuis la liste des tâches prédéfinies, cliquez sur la tâche puis sur **Ajouter une règle récurrente**.

Choisissez :

- **Agents concernés** : sélectionnez les agents du service (ex : Marie D., Paul L., Sophie M.).
- **Type de récurrence** :
  - **Hebdomadaire** : cochez les jours de la semaine (ex : lundi + mardi).
  - **Mensuelle — date fixe** : indiquez le jour du mois (ex : le 15). Si ce jour n'existe pas dans un mois donné (ex : le 31 en avril), le système utilise automatiquement le dernier jour du mois.
  - **Mensuelle — occurrence ordinale** : choisissez le rang et le jour (ex : *3e mardi*, *dernier jeudi*). Sélectionnez *Dernière* pour la dernière occurrence du mois.
- **Plage de dates** : date de début et date de fin de la règle.

> **Exemple :** Permanence accueil matin — hebdomadaire — lundi + mardi — du 1er mai au 30 juin 2026 — agents : Marie D. et Paul L.

![Modale de règle récurrente avec les trois types de récurrence et l'option mensuelle ordinale](./captures/03-regle-recurrente-mensuelle-ordinale.png)

Cliquez sur **Enregistrer la règle**.

### 4. Générer les occurrences

Depuis la vue Planning, cliquez sur **Générer les occurrences** pour la période souhaitée. Le planning se peuple avec les assignations selon la règle définie.

---

## Tutoriel 2 — Générer un planning équilibré

**Profil concerné : responsable de service disposant du droit « génération de planning équilibré »**

### 1. Ouvrir la modale de génération

Dans la barre de contrôles du planning, cliquez sur **Générer un planning équilibré**.

### 2. Configurer la génération

La modale s'ouvre en deux parties : configuration à gauche, aperçu à droite.

Dans la partie configuration, renseignez :

- **Plage de dates** : ex. mai 2026 (du 1er au 31).
- **Agents à inclure** : cochez les agents disponibles sur la période. Les agents en absence validée sont automatiquement écartés.
- **Tâches à répartir** : sélectionnez les tâches prédéfinies à planifier (ex : Permanence accueil, Saisie budget, Reporting hebdo).
- **Compétences requises** (optionnel) : si certaines tâches nécessitent un profil particulier, activez le filtre compétences.

> **Exemple :** Mai 2026 — 4 agents (Marie D., Paul L., Karim B., Yasmine R.) — 3 tâches (Permanence accueil, Saisie mensuelle budget, Reporting hebdo).

![Modale de génération de planning équilibré — configuration à gauche, aperçu à droite](./captures/04-modale-balancer-apercu.png)

### 3. Prévisualiser le résultat

L'aperçu (partie droite) affiche :

- La répartition des assignations par agent.
- La charge totale estimée par agent (en points de poids cumulés).
- Le **ratio d'équité** (voir ci-dessous).

Parcourez l'aperçu avant d'appliquer.

### 4. Appliquer ou ajuster

- Cliquez sur **Appliquer** pour créer les assignations dans le planning.
- Si le résultat ne convient pas, ajustez les paramètres (plage, agents, tâches) et prévisualisez à nouveau.

### 5. Ratio d'équité — code couleur

| Couleur | Signification |
|---|---|
| **Vert** | Répartition très équilibrée entre les agents. |
| **Orange** | Léger déséquilibre, acceptable selon les contraintes. |
| **Rouge** | Déséquilibre notable — envisagez d'ajuster la sélection des agents ou des tâches. |

> Plus le ratio est proche de 1, plus la charge est répartie uniformément. Une valeur à 1 signifie que chaque agent porte exactement la même charge pondérée.

### 6. Relancer sans doubler

Si vous relancez la génération sur une période déjà planifiée, le système ne crée pas de doublons. Les assignations existantes sont conservées telles quelles.

---

## Tutoriel 3 — Suivre et déclarer mes tâches

**Profil concerné : agent (et responsable de service pour les tâches du service)**

### 1. Consulter son planning

Depuis le menu latéral, cliquez sur **Planning**. Trois vues sont disponibles via les boutons en haut à droite :

- **Semaine** : affichage 7 jours, une colonne par jour.
- **Mois** : vue calendrier mensuelle.
- **Vue activité** : tableau croisé tâches × jours (voir [Vue activité — mode lecture](#vue-activité--mode-lecture)).

Chaque assignation affiche une pastille colorée indiquant son poids et un badge indiquant son statut.

### 2. Déclarer « Fait »

Cliquez sur le **badge de statut** de l'assignation concernée. La cellule s'ouvre et affiche les transitions disponibles. Cliquez sur **Fait**.

![Badge de statut déplié montrant les boutons de transition disponibles](./captures/05-badge-statut-deplie.png)

Appuyez sur **Échap** pour refermer sans modifier.

### 3. Déclarer « En cours » puis « Fait »

Si la tâche est démarrée mais non terminée :

1. Cliquez sur le badge → sélectionnez **En cours**.
2. Plus tard, cliquez à nouveau sur le badge → sélectionnez **Fait**.

### 4. Déclarer « Non applicable »

Utilisez **Non applicable** quand la tâche ne peut pas être réalisée pour un motif justifié (ex : absence imprévue du demandeur, annulation externe).

1. Cliquez sur le badge → sélectionnez **Non applicable**.
2. Une zone de texte s'affiche : saisissez le motif (3 caractères minimum obligatoires).
3. Validez.

> **Note :** Un statut « Non applicable » peut être remis à « Non fait » si la situation évolue.

### 5. Comprendre l'alerte retard

Quand une assignation reste à l'état **Non fait** au-delà du délai de tolérance (1 jour ouvré par défaut, configurable par l'administrateur), le badge passe en **rouge** avec une icône d'alerte.

Traitez ou justifiez ces tâches en priorité pour maintenir la fiabilité du suivi.

---

## Grille de référence des poids

| Poids | Libellé | Durée indicative | Exemples CDG / CPAM |
|---|---|---|---|
| **1** | Très légère | < 5 min | Pointage rapide, saisie d'une absence, validation d'un document court |
| **2** | Légère | 10 – 30 min | Accueil téléphonique courte session, mise à jour d'un tableau de bord |
| **3** | Normale | 30 min – 1 h | Permanence accueil matin, reporting hebdomadaire, saisie mensuelle budget |
| **4** | Lourde | 1 – 2 h | Réunion de service avec rédaction du compte-rendu, entretien de suivi |
| **5** | Très lourde | > 2 h | Revue managériale mensuelle, préparation et animation d'un COPIL |

---

## Vue activité — mode lecture

La **Vue activité** propose un tableau croisé : les tâches en colonnes, les jours en lignes. Elle permet de voir d'un coup d'œil l'ensemble des tâches du service sur la période, indépendamment des agents.

**Accès :** Cliquez sur **Vue activité** dans les boutons de vue en haut à droite du planning. Ce bouton n'est visible que pour les responsables disposant du droit « vue activité ».

**Usage principal :** Lecture transversale pour identifier les journées chargées, les tâches non couvertes ou les chevauchements.

**Exporter en PDF :** Cliquez sur **Imprimer** (en haut à droite de la vue activité). Le navigateur ouvre la boîte d'impression avec une mise en page optimisée A4 paysage. Imprimez ou enregistrez en PDF.

![Vue activité — tableau croisé tâches × jours avec bouton Imprimer](./captures/06-vue-activite-impression.png)

---

## FAQ

### Et si un agent est absent pendant la plage de génération ?

Les absences validées dans le module RH sont automatiquement prises en compte : l'agent absent est écarté des assignations sur les jours concernés. Vérifiez que les absences sont bien saisies avant de lancer la génération.

### Puis-je modifier une assignation après la génération ?

Oui. Cliquez sur l'assignation dans le planning pour la modifier (réassigner à un autre agent, changer la date, supprimer). Ces modifications sont indépendantes de la règle récurrente et n'affectent pas les occurrences futures.

### Les jours fériés sont-ils gérés automatiquement ?

Pas en version actuelle. Le planning peut générer des assignations sur des jours fériés. Le responsable réassigne ou supprime manuellement les occurrences concernées.

### Puis-je exporter le planning en Excel ou en ICS ?

L'export **PDF** est disponible via le bouton **Imprimer** de la Vue activité. L'export ICS (agenda) n'est pas disponible en V1.

### Qui peut déclarer l'exécution d'une tâche ?

Chaque agent déclare le statut de **ses propres tâches**. Le responsable de service peut déclarer le statut de toutes les tâches de son service (utile en cas d'absence de l'agent).

### Comment est calculé le ratio d'équité ?

Le système compare la charge totale (somme des poids) portée par chaque agent sur la période. Plus le ratio est proche de 1, plus la répartition est équilibrée. Un ratio à 1 signifie que tous les agents portent exactement la même charge. En dessous de 0,7, la répartition est jugée déséquilibrée et le badge passe au rouge.

### Que se passe-t-il si je lance la génération deux fois sur la même période ?

Rien n'est dupliqué. Le système détecte les assignations déjà existantes et ne crée que les éventuelles occurrences manquantes. Relancez sans risque.

### Jean-Marc T. n'apparaît pas dans la liste des agents disponibles — pourquoi ?

Vérifiez qu'il est bien rattaché au service dans les paramètres RH et qu'il ne dispose pas d'une absence validée couvrant toute la période sélectionnée.

---

## Nous contacter

**DSI CPAM 92** — [ab@alexandre-berge.fr](mailto:ab@alexandre-berge.fr)

Pour toute question sur les droits d'accès (droit « génération de planning équilibré », droit « vue activité »), contactez votre administrateur Orchestr'A ou la DSI.

---

*Guide version 1.0 — Support : DSI CPAM 92*
