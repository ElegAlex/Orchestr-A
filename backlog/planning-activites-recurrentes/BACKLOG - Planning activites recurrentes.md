# Backlog - Planning d'activités récurrentes

Issu du besoin IA nº01 remonté par le Contrôle de Gestion (Cabinet de la Direction, CPAM 92).
Source : formulaire du 25 mars 2026 (Laurence Preschez, cc Abdelaziz Beouch) et analyse de couverture Orchestr'A du 23 avril 2026.

---

## 1. Contexte et objectif produit

Le Contrôle de Gestion (6 utilisateurs) a remonté un besoin de planification automatique de ses activités récurrentes. L'analyse de couverture a conclu qu'Orchestr'A couvre 70 % du besoin en natif et que les 30 % restants sont des évolutions incrémentales sur les modules `predefined-tasks` et `planning`.

Ce backlog traite l'ensemble de ces évolutions sous forme d'un lot produit unique nommé « Planning d'activités récurrentes », pilotable par vagues d'implémentation successives.

Le lot bénéficie à tout service ayant un besoin de rotation ou de permanence (SCI, Support, accueil), et pas seulement au CDG.

## 2. Utilisateurs cibles

| Persona | Rôle | Permissions |
|---|---|---|
| Responsable de service | Crée les tâches prédéfinies, définit leur poids, pilote le service | `predefined_tasks:create`, `:edit`, `:assign` |
| Agent du service | Consulte son planning, met à jour le statut d'exécution de ses tâches | `predefined_tasks:view`, `predefined_tasks:update-own-status` |
| Administrateur DSI | Configure les permissions de la vue activité | `rbac:admin` |

## 3. Glossaire

| Terme | Définition |
|---|---|
| Tâche prédéfinie | Activité récurrente identifiée (permanence, saisie mensuelle, reporting...). Entité `PredefinedTask`. |
| Assignation | Affectation d'une tâche prédéfinie à un utilisateur pour une date et une période. Entité `PredefinedTaskAssignment`. |
| Règle récurrente | Gabarit qui génère des assignations sur une plage. Entité `PredefinedTaskRecurringRule`. |
| Poids | Entier de 1 à 5 reflétant la difficulté ou la charge d'une tâche. |
| Charge pondérée | Somme des poids des tâches assignées à un agent sur une période. |
| Équilibrage | Affectation qui minimise l'écart de charge pondérée entre agents sur une période donnée. |
| Vue Activité | Mode d'affichage du planning avec jours en lignes et tâches en colonnes. |

## 4. Périmètre

Cinq épopées couvrent l'intégralité des écarts fonctionnels identifiés.

| Epic | Libellé | Écart source |
|---|---|---|
| E1 | Pondération des tâches prédéfinies | G1 |
| E2 | Récurrence mensuelle calendaire | G3 |
| E3 | Statut d'exécution et alerte | G4 |
| E4 | Algorithme d'équilibrage | G2 |
| E5 | Vue Activité | G5 |

## 5. Hors périmètre

Les éléments suivants ne font pas partie du lot et doivent faire l'objet d'une nouvelle instruction si souhaités.

- Solver d'optimisation globale (programmation par contraintes, ILP). La V1 livre une heuristique gloutonne.
- Notifications externes (mail, Teams) sur tâche non réalisée. La V1 se limite à un marqueur visuel dans l'interface.
- Export ICS des assignations récurrentes. À traiter séparément si besoin.
- Intégration OSCARR ou tout autre SI externe.

## 6. Architecture cible

### 6.1 Extensions du schéma Prisma

```prisma
// Ajout sur PredefinedTask
weight Int @default(1) // 1 à 5, pondération pour l'équilibrage

// Ajout sur PredefinedTaskAssignment
completionStatus   String   @default("NOT_DONE") // "NOT_DONE" | "IN_PROGRESS" | "DONE" | "NOT_APPLICABLE"
completedAt        DateTime?
completedById      String?

// Ajout sur PredefinedTaskRecurringRule
recurrenceType     String   @default("WEEKLY") // "WEEKLY" | "MONTHLY_ORDINAL" | "MONTHLY_DAY"
monthlyOrdinal     Int?     // 1 à 5 (1er, 2e, 3e, 4e, dernier)
monthlyDayOfMonth  Int?     // 1 à 31 pour MONTHLY_DAY
// dayOfWeek devient nullable pour le cas MONTHLY_DAY
```

### 6.2 Nouveaux endpoints API

| Verbe | Route | Objet |
|---|---|---|
| `PATCH` | `/predefined-tasks/assignments/:id/completion` | Mettre à jour le statut d'exécution d'une assignation. |
| `POST` | `/predefined-tasks/recurring-rules/generate-balanced` | Générer des assignations équilibrées sur une plage pour un ensemble d'agents et de tâches. |
| `GET` | `/predefined-tasks/workload-report` | Consulter la charge pondérée par agent sur une plage. |

### 6.3 Nouveaux composants front

| Composant | Objet |
|---|---|
| `BalancedPlanningModal` | Modale de configuration et de prévisualisation de l'équilibrage. |
| `ActivityGrid` | Rendu « jours en lignes, tâches en colonnes ». |
| `AssignmentStatusBadge` | Badge de statut d'exécution sur `DayCell`. |
| `WeightInput` | Sélecteur de poids (1 à 5) dans le formulaire `PredefinedTask`. |

### 6.4 Surface UI : principe directeur

Aucune nouvelle page d'administration n'est introduite. La convention existante d'Orchestr'A est conservée : toute la configuration et l'exploitation se font depuis la vue planning, via des modales ouvertes depuis `PlanningGrid`. Les composants existants `AssignmentModal` et `RecurringRulesModal` sont enrichis ; un unique nouveau composant modal `BalancedPlanningModal` est ajouté, ainsi qu'un composant de rendu `ActivityGrid` pour la Vue Activité.

**Principe fondamental d'unicité des données** : une assignation (`PredefinedTaskAssignment`) est une entité unique en base. Les trois modes d'affichage (`week`, `month`, `activity`) et toutes les modales lisent la même source via `GET /planning/overview`. Toute création, modification ou suppression, quel que soit le point d'entrée UI, se répercute instantanément dans toutes les vues. Il n'existe aucune synchronisation à gérer, aucune duplication de données.

Cartographie complète des surfaces UI :

| Surface | État | Rôle | Évolutions apportées |
|---|---|---|---|
| `PlanningView` mode `week` | Existe | Vue planning utilisateurs en lignes x jours en colonnes, semaine | Badge de statut d'exécution (E3) et indicateur de poids (E1) dans `DayCell`. La structure reste identique. |
| `PlanningView` mode `month` | Existe | Vue planning utilisateurs en lignes x jours en colonnes, mois | Idem (E3, E1). |
| `PlanningView` mode `activity` | **Nouveau** | Vue planning jours en lignes x tâches en colonnes, lecture par activité | Troisième bouton « Vue activité » ajouté à côté de `Semaine` / `Mois`. Accès gaté par la permission `planning:activity-view`. Composant `ActivityGrid` dédié (E5). |
| Formulaire de gabarit `PredefinedTask` | Existe | Créer et éditer un gabarit de tâche prédéfinie (nom, icône, durée, créneau) | Ajout d'un sélecteur de poids 1 à 5 (`WeightInput`) (E1). |
| `RecurringRulesModal` | Existe | Gérer les règles récurrentes par tâche et utilisateur | Ajout des modes de récurrence `MONTHLY_ORDINAL` et `MONTHLY_DAY` avec contrôles adaptés (E2). |
| `AssignmentModal` | Existe | Affecter ou retirer ponctuellement une tâche à un agent | Ajout de la transition de statut d'exécution (E3). |
| `BalancedPlanningModal` | **Nouveau** | Configurer et prévisualiser un planning équilibré, puis l'appliquer | Entièrement nouveau (E4). Entrée via un bouton « Générer un planning équilibré » ajouté dans la barre de contrôle de `PlanningView`, visible uniquement avec la permission `predefined_tasks:balance`. |
| `AssignmentStatusBadge` | **Nouveau** | Badge visuel de statut d'exécution rendu dans `DayCell` et `ActivityGrid` | Entièrement nouveau (E3). |

### 6.5 Parcours utilisateur cibles

Trois parcours couvrent les cas d'usage et doivent rester sans ambiguïté pour l'implémentation.

#### Parcours A - Configurer une tâche récurrente (responsable de service)

1. Ouvrir la section Planning.
2. Ouvrir la modale de gestion des tâches prédéfinies depuis `PlanningView`.
3. Créer ou éditer un gabarit : nom, icône, durée, créneau, **poids 1 à 5**.
4. Enregistrer. Retour à la vue planning.
5. Depuis la vue planning, ouvrir `RecurringRulesModal`, créer une règle en choisissant :
   - agents concernés,
   - récurrence : hebdomadaire, bi-hebdomadaire, **mensuelle à date fixe** ou **mensuelle ordinale**,
   - plage de validité.
6. Enregistrer. Les occurrences peuvent être matérialisées via le bouton « Générer » existant.

#### Parcours B - Générer un planning équilibré (responsable de service)

1. Depuis `PlanningView`, cliquer sur **Générer un planning équilibré** (bouton nouveau, visible si permission `predefined_tasks:balance`).
2. `BalancedPlanningModal` s'ouvre : choisir la plage, le service ou la liste d'agents, la liste des tâches à équilibrer.
3. Cliquer **Prévisualiser** : l'heuristique s'exécute, la modale affiche la charge pondérée prévue par agent et le ratio d'équité. Aucune écriture en base à cette étape.
4. Si satisfaisant, cliquer **Appliquer** : les assignations sont créées en transaction. En cas d'échec partiel, rollback complet.
5. Retour à la vue planning. Les assignations générées apparaissent immédiatement dans les modes `week`, `month` et `activity` (source de données commune).
6. À tout moment, une assignation peut être ajustée manuellement via `AssignmentModal` (en cas d'absence imprévue par exemple).

#### Parcours C - Suivre et réaliser son planning (agent)

1. Ouvrir la section Planning, basculer si souhaité en **Vue activité** pour une lecture compacte par tâche.
2. Cliquer sur une assignation du jour : `AssignmentStatusBadge` ou `AssignmentModal` permet la transition `NOT_DONE` vers `IN_PROGRESS` vers `DONE` ou `NOT_APPLICABLE` (avec commentaire de justification).
3. Les assignations passées toujours en `NOT_DONE` apparaissent en badge d'alerte après le seuil paramétrable (par défaut J+1 ouvré).
4. Aucune notification externe n'est émise en V1 ; le signalement est purement visuel dans l'interface.

### 6.6 Nouvelles permissions RBAC

| Permission | Description |
|---|---|
| `predefined_tasks:balance` | Déclencher la génération équilibrée. |
| `predefined_tasks:update-own-status` | Mettre à jour le statut d'exécution de ses propres assignations. |
| `predefined_tasks:update-any-status` | Mettre à jour le statut d'exécution de toute assignation (responsable). |
| `planning:activity-view` | Accéder au mode Vue Activité. |

## 7. Exigences non fonctionnelles

| Critère | Cible |
|---|---|
| Performance `GET /planning/overview` | < 500 ms sur plage mensuelle pour 200 utilisateurs. |
| Performance génération équilibrée | < 3 s sur une plage mensuelle pour 20 agents et 30 tâches. |
| Tests unitaires API | Couverture ≥ 85 % sur les modules touchés. |
| Tests e2e Playwright | 1 scénario nominal par epic, exécuté en CI. |
| Sécurité | Pas d'exposition de données hors permissions. Vérification RBAC sur chaque endpoint. |
| Conformité RGPD | Aucune donnée nominative de santé manipulée. Traçabilité des mises à jour de statut via `audit`. |
| i18n | Nouvelles chaînes fr/en ajoutées dans `messages/`. |
| Accessibilité | Niveau AA sur les nouveaux composants (contraste, labels, navigation clavier). |

## 8. Conventions d'exécution Claude Code

### 8.1 Vagues d'implémentation (waves)

Le lot est découpé en six vagues numérotées de 0 à 5. Chaque vague a une condition d'entrée (Wave Entry Criteria) et une condition de sortie (Wave Exit Criteria). Les vagues sont séquentielles mais à l'intérieur d'une vague, les tâches peuvent être parallélisées via sous-agents.

### 8.2 Sous-agents (subagent-driven development)

La skill `superpowers:subagent-driven-development` est mobilisée dès qu'une vague comporte des tâches indépendantes. Chaque tâche marquée `[PARALLÈLE]` peut être dispatchée à un sous-agent dédié, avec :

- un prompt auto-portant (contexte, contrainte, DoR, DoD)
- un périmètre strictement délimité (liste de fichiers autorisés à l'édition)
- un test de vérification indépendant
- une sortie structurée (diff, résultats de tests, notes de revue)

Les tâches marquées `[SÉQUENTIEL]` s'exécutent dans l'agent principal, typiquement parce qu'elles modifient un fichier partagé par plusieurs tâches suivantes (ex. migration Prisma).

### 8.3 Discipline TDD

Chaque story applique la skill `superpowers:test-driven-development` : rédaction du test en échec, implémentation minimale, refactorisation. Les tests sont livrés avant le code.

### 8.4 Vérification avant complétion

La skill `superpowers:verification-before-completion` est appliquée en fin de chaque tâche : exécution effective des commandes de vérification, capture de la sortie, puis seulement déclaration de complétion.

### 8.5 Conventions Git

- Une branche par vague : `feat/planning-activites-wave-<n>-<slug>`.
- Commits conventionnels : `feat(predefined-tasks): ...`, `feat(planning): ...`, `test(predefined-tasks): ...`.
- Pas de `--no-verify`. Pas de `--amend` sur commits poussés.
- Une PR par vague avec check-list de la DoD.

## 9. Définition de prêt (DoR)

Une story entre en vague si :

- Les critères d'acceptation sont formulés et non ambigus.
- Les dépendances amont sont livrées.
- Les contrats d'API ou de données sont stabilisés (DTO et schéma Prisma).
- Un test d'acceptation est rédigeable sans ambiguïté.

## 10. Définition de fait (DoD)

Une story est terminée si :

- Tous les critères d'acceptation sont passants.
- Couverture unitaire ≥ 85 % sur le code produit.
- Lint, type-check, Prisma format, tests unitaires et e2e passent localement et en CI.
- Documentation mise à jour (README du module, `CHANGELOG.md`).
- Revue par un deuxième œil (auto-revue via `superpowers:requesting-code-review` ou revue humaine).
- Pas de régression visible sur les parcours existants.
- Migration Prisma testée en montée et en descente si applicable.

## 11. Stratégie de tests

| Niveau | Outil | Portée |
|---|---|---|
| Unitaire API | Jest | Services, règles métier, algorithmes. |
| Unitaire front | Vitest / Jest | Hooks, utilitaires, stores. |
| Intégration API | Supertest | Endpoints avec base de test. |
| e2e | Playwright | Parcours utilisateur critiques. |

## 12. Plan par vagues

### Wave 0 - Cadrage et spike

Durée cible : 1 jour.
Entrée : ce backlog validé.
Sortie : atelier métier tenu, règles documentées, schéma Prisma cible validé.

- W0.1 Atelier de recueil des règles métier avec Preschez et Beouch : liste des tâches, fréquences réelles, échelle de poids, règles d'équité souhaitées, contraintes de compétence. `[SÉQUENTIEL]`
- W0.2 Consolidation du schéma cible en ADR (Architecture Decision Record) dans `docs/adr/`. `[SÉQUENTIEL]`

### Wave 1 - Schéma de données et pondération (E1)

Durée cible : 1 à 2 jours.
Entrée : W0 close.
Sortie : migration Prisma livrée, pondération utilisable de bout en bout, planning stable.

### Wave 2 - Récurrence mensuelle et statut d'exécution (E2, E3)

Durée cible : 4 à 5 jours.
Entrée : W1 close.
Sortie : règles mensuelles générant correctement, statut d'exécution mis à jour et affiché.

### Wave 3 - Algorithme d'équilibrage (E4)

Durée cible : 4 à 6 jours.
Entrée : W2 close.
Sortie : génération équilibrée utilisable, prévisualisation validée en atelier CDG.

### Wave 4 - Vue Activité (E5)

Durée cible : 2 jours.
Entrée : W3 close.
Sortie : bouton « Vue activité » livré à côté de « Semaine » et « Mois », gating permission actif.

### Wave 5 - Recette et rollout

Durée cible : 2 à 3 jours.
Entrée : W4 close.
Sortie : recette CDG tenue, documentation utilisateur publiée, ouverture des accès aux 6 agents CDG.

- W5.1 Recette fonctionnelle avec Preschez et Beouch. `[SÉQUENTIEL]`
- W5.2 Documentation utilisateur (guide pas à pas dans `docs/user/planning-activites.md`). `[PARALLÈLE]`
- W5.3 Création du service CDG dans Orchestr'A si absent, rattachement des 6 agents. `[PARALLÈLE]`
- W5.4 Monitoring des 2 premières générations mensuelles (charge, temps de réponse, erreurs). `[SÉQUENTIEL]`

## 13. Backlog détaillé

Chaque story contient : user story, critères d'acceptation, tâches techniques, parallélisation, DoD spécifique. Les tâches portent le préfixe `T<epic>.<story>.<n>`.

---

### Epic E1 - Pondération des tâches prédéfinies

Objectif : permettre de pondérer chaque tâche prédéfinie par un entier de 1 à 5 pour alimenter l'équilibrage futur.

#### US E1.1 - Champ weight sur PredefinedTask

**En tant que** responsable de service,
**je souhaite** affecter un poids à chaque tâche prédéfinie,
**afin que** la charge réelle soit prise en compte dans les statistiques et l'équilibrage.

**Critères d'acceptation**

- Le modèle `PredefinedTask` expose un champ `weight` de type entier, valeurs autorisées 1 à 5, défaut 1.
- La migration Prisma ne casse aucune donnée existante.
- Le DTO `CreatePredefinedTaskDto` accepte un `weight` optionnel, défaut 1, avec validation `@Min(1) @Max(5)`.
- Le DTO `UpdatePredefinedTaskDto` accepte un `weight` optionnel avec la même validation.
- Les endpoints `GET /predefined-tasks` et `GET /predefined-tasks/:id` renvoient le `weight`.
- Le formulaire de création et d'édition d'une tâche prédéfinie expose un sélecteur de poids (1 à 5) avec libellés (« Très légère », « Légère », « Normale », « Lourde », « Très lourde »).
- Couverture unitaire du service ≥ 85 %.

**Tâches techniques**

- T1.1.1 Migration Prisma : ajout `weight`. `[SÉQUENTIEL]` - bloque toutes les autres tâches E1.
- T1.1.2 Extension DTO et service côté API. `[PARALLÈLE avec T1.1.3]`
- T1.1.3 Tests unitaires API (`predefined-tasks.service.spec.ts`). `[PARALLÈLE avec T1.1.2]`
- T1.1.4 Composant `WeightInput` et intégration au formulaire. `[PARALLÈLE]`
- T1.1.5 Tests front du composant. `[PARALLÈLE avec T1.1.4 si TDD strict]`
- T1.1.6 i18n fr/en des nouveaux libellés. `[PARALLÈLE]`

#### US E1.2 - Exposition du poids dans la vue planning

**En tant qu'** utilisateur consultant le planning,
**je souhaite** voir le poids de la tâche assignée,
**afin de** juger visuellement la charge d'un agent.

**Critères d'acceptation**

- `DayCell` affiche un indicateur visuel discret du poids (par exemple : taille de pastille, intensité de couleur ou valeur numérique optionnelle).
- Le rendu reste lisible et n'introduit pas de régression.
- Aucun nouveau call API : le `weight` est déjà fourni par `GET /planning/overview` via la relation `predefinedTask`.

**Tâches techniques**

- T1.2.1 Extension du type côté front (`usePlanningData`). `[SÉQUENTIEL]`
- T1.2.2 Rendu dans `DayCell`. `[PARALLÈLE avec T1.2.3]`
- T1.2.3 Tests visuels / snapshot. `[PARALLÈLE avec T1.2.2]`

---

### Epic E2 - Récurrence mensuelle calendaire

Objectif : permettre des règles récurrentes de type « le 3e mardi du mois » ou « le 15 du mois ».

#### US E2.1 - Extension du modèle de règle récurrente

**En tant que** responsable,
**je souhaite** définir une récurrence mensuelle calendaire,
**afin de** couvrir les tâches mensuelles non exprimables en fréquence hebdomadaire.

**Critères d'acceptation**

- Le modèle `PredefinedTaskRecurringRule` expose `recurrenceType` (`WEEKLY`, `MONTHLY_ORDINAL`, `MONTHLY_DAY`), `monthlyOrdinal` (1 à 5 dont 5 = dernier), `monthlyDayOfMonth` (1 à 31).
- `dayOfWeek` devient nullable pour le cas `MONTHLY_DAY`.
- La migration conserve toutes les règles existantes avec `recurrenceType = WEEKLY`.
- Les DTO `CreateRecurringRuleDto`, `CreateBulkRecurringRulesDto` et `UpdateRecurringRuleDto` acceptent et valident ces nouveaux champs (cohérence croisée : si `MONTHLY_DAY` alors `monthlyDayOfMonth` requis et `dayOfWeek` interdit).
- Les règles stockées sont sémantiquement conservées (round-trip garanti).

**Tâches techniques**

- T2.1.1 Migration Prisma. `[SÉQUENTIEL]`
- T2.1.2 Extension DTO + validations croisées. `[PARALLÈLE avec T2.1.3]`
- T2.1.3 Tests unitaires de validation. `[PARALLÈLE avec T2.1.2]`

#### US E2.2 - Génération matérialisée pour récurrences mensuelles

**En tant que** responsable,
**je souhaite** que `POST /recurring-rules/generate` produise correctement les assignations mensuelles,
**afin d'** éviter les créations manuelles.

**Critères d'acceptation**

- Pour `MONTHLY_DAY`, l'assignation est créée au jour du mois indiqué, sans doublon si la plage couvre plusieurs mois. Gestion des mois à 30 ou 28 jours : si le jour n'existe pas, clampé au dernier jour du mois.
- Pour `MONTHLY_ORDINAL`, l'assignation est créée au N-ième `dayOfWeek` du mois. Valeur 5 interprétée comme « dernière occurrence du `dayOfWeek` dans le mois ».
- Les jours fériés ne décalent pas l'assignation (hors périmètre V1). Documenter ce choix dans l'ADR.
- Couverture de tests unitaires ≥ 90 % sur le générateur (cas d'erreur inclus).

**Tâches techniques**

- T2.2.1 Refactorisation du générateur interne. `[SÉQUENTIEL]`
- T2.2.2 Tests unitaires cas nominaux et limites (fév. 29, fin de mois, dernier jeudi). `[PARALLÈLE avec T2.2.3]`
- T2.2.3 Adaptation de l'UI de création de règle. `[PARALLÈLE avec T2.2.2]`
- T2.2.4 Tests e2e Playwright : création d'une règle mensuelle, génération, vérification dans le planning. `[SÉQUENTIEL]`

---

### Epic E3 - Statut d'exécution et alerte

Objectif : permettre à un agent de déclarer l'exécution d'une activité, et signaler visuellement les tâches non faites.

#### US E3.1 - Mise à jour du statut d'une assignation

**En tant qu'** agent,
**je souhaite** marquer une assignation comme « faite » ou « non applicable »,
**afin de** tracer la réalisation.

**Critères d'acceptation**

- Le modèle `PredefinedTaskAssignment` expose `completionStatus`, `completedAt`, `completedById`.
- `PATCH /predefined-tasks/assignments/:id/completion { status }` est disponible.
- RBAC : l'agent ne peut modifier que ses propres assignations (`predefined_tasks:update-own-status`). Un responsable peut modifier toute assignation de son service (`predefined_tasks:update-any-status`).
- Le changement est audité (table `audit`).
- Transitions valides documentées : `NOT_DONE → IN_PROGRESS`, `NOT_DONE → DONE`, `IN_PROGRESS → DONE`, tout statut `→ NOT_APPLICABLE` (avec justification en commentaire).

**Tâches techniques**

- T3.1.1 Migration Prisma. `[SÉQUENTIEL]`
- T3.1.2 Endpoint + service + guard RBAC. `[SÉQUENTIEL après T3.1.1]`
- T3.1.3 Tests API unitaires + intégration. `[PARALLÈLE avec T3.1.4]`
- T3.1.4 Enregistrement audit. `[PARALLÈLE avec T3.1.3]`

#### US E3.2 - Badge de statut dans la cellule jour

**En tant qu'** utilisateur,
**je souhaite** voir le statut d'exécution d'une assignation dans la vue planning,
**afin de** repérer visuellement les tâches non réalisées.

**Critères d'acceptation**

- Badge dans `DayCell` : coche pour `DONE`, sablier pour `IN_PROGRESS`, point gris pour `NOT_DONE`, tiret pour `NOT_APPLICABLE`.
- Au clic, une popover permet la transition selon le RBAC de l'utilisateur.
- Accessibilité : libellé lisible au lecteur d'écran (attribut `aria-label`).

**Tâches techniques**

- T3.2.1 Composant `AssignmentStatusBadge`. `[PARALLÈLE avec T3.2.2]`
- T3.2.2 Hook de mutation `useUpdateAssignmentStatus`. `[PARALLÈLE avec T3.2.1]`
- T3.2.3 Intégration dans `DayCell`. `[SÉQUENTIEL après T3.2.1 et T3.2.2]`
- T3.2.4 Tests e2e : un agent marque une tâche faite, le responsable voit le changement. `[SÉQUENTIEL]`

#### US E3.3 - Alerte sur tâche en retard

**En tant qu'** utilisateur,
**je souhaite** que les assignations `NOT_DONE` dont la date est passée soient signalées,
**afin de** traiter les retards.

**Critères d'acceptation**

- Une assignation est en retard si `date < aujourd'hui - seuil` avec `completionStatus = NOT_DONE`. Le seuil est paramétrable via `AppSettings` (défaut : 1 jour ouvré).
- Le badge de statut passe à un état « retard » (couleur d'alerte).
- Aucun envoi de mail ni de notification externe (hors V1).

**Tâches techniques**

- T3.3.1 Paramètre `planning.lateThresholdDays` dans `AppSettings`. `[PARALLÈLE avec T3.3.2]`
- T3.3.2 Règle de calcul côté front (dans `DayCell`) basée sur le statut et la date. `[PARALLÈLE avec T3.3.1]`
- T3.3.3 Tests unitaires. `[PARALLÈLE]`

---

### Epic E4 - Algorithme d'équilibrage

Objectif : offrir une génération automatique qui équilibre la charge pondérée entre agents sur une plage donnée.

#### US E4.1 - Service d'équilibrage

**En tant que** responsable,
**je souhaite** générer un planning mensuel équilibré,
**afin de** répartir équitablement la charge.

**Critères d'acceptation**

- Nouveau service `PlanningBalancerService.balance(input)` avec :
  - input : liste d'agents, liste de tâches à affecter avec occurrences datées, absences (congés, télétravail, jours fériés, vacances scolaires), contraintes optionnelles de compétence.
  - output : liste d'assignations candidates, écart-type de charge pondérée par agent, ratio d'équité (1 - σ/µ).
- Heuristique gloutonne : à chaque occurrence, affecter l'agent disponible avec la charge cumulée pondérée la plus faible. Départage stable par identifiant.
- Absents écartés d'une occurrence donnée.
- Contraintes de compétence respectées si fournies.
- Temps d'exécution < 3 s pour 20 agents et 30 tâches sur un mois.
- Couverture unitaire ≥ 95 % avec jeux de données déterministes.

**Tâches techniques**

- T4.1.1 Spécification algorithmique et pseudo-code dans `docs/adr/`. `[SÉQUENTIEL]`
- T4.1.2 Service `PlanningBalancerService` + types d'entrée / sortie. `[SÉQUENTIEL après T4.1.1]`
- T4.1.3 Tests unitaires déterministes (5 jeux de données minimum). `[PARALLÈLE avec T4.1.4]`
- T4.1.4 Benchmark de performance (bench Jest ou script dédié). `[PARALLÈLE avec T4.1.3]`

#### US E4.2 - Endpoint de génération équilibrée

**En tant que** responsable,
**je souhaite** appeler un endpoint qui génère et persiste les assignations équilibrées,
**afin d'** intégrer l'équilibrage au flux existant.

**Critères d'acceptation**

- `POST /predefined-tasks/recurring-rules/generate-balanced` accepte : plage (startDate, endDate), serviceId ou userIds, mode (`preview` ou `apply`).
- En mode `preview`, renvoie le plan proposé sans persistance.
- En mode `apply`, crée les assignations dans une transaction. En cas d'échec, rollback complet.
- RBAC : permission `predefined_tasks:balance` requise.
- Journal d'audit renseigné.
- Idempotence : si le mode `apply` est rejoué sur la même plage avec les mêmes paramètres, aucune duplication n'est produite.

**Tâches techniques**

- T4.2.1 Endpoint + DTO + guard. `[SÉQUENTIEL]`
- T4.2.2 Gestion transactionnelle. `[SÉQUENTIEL]`
- T4.2.3 Tests d'intégration API. `[PARALLÈLE avec T4.2.4]`
- T4.2.4 Audit et traces. `[PARALLÈLE avec T4.2.3]`

#### US E4.3 - UI de prévisualisation et d'application

**En tant que** responsable,
**je souhaite** prévisualiser un planning équilibré avant de l'appliquer,
**afin de** valider la répartition.

**Critères d'acceptation**

- Modale `BalancedPlanningModal` : choix de la plage, du service ou de la liste d'agents, bouton « Prévisualiser ».
- Affichage d'un tableau récapitulatif : charge pondérée par agent, ratio d'équité, liste des assignations proposées.
- Bouton « Appliquer » appelant le mode `apply` de l'endpoint.
- Confirmation utilisateur avant application.
- En cas d'erreur, message d'erreur explicite et préservation de la saisie.

**Tâches techniques**

- T4.3.1 Composant `BalancedPlanningModal`. `[PARALLÈLE avec T4.3.2]`
- T4.3.2 Service front `usePlanningBalancer`. `[PARALLÈLE avec T4.3.1]`
- T4.3.3 Intégration au `PlanningView` (bouton d'entrée). `[SÉQUENTIEL après T4.3.1 et T4.3.2]`
- T4.3.4 Tests e2e : prévisualiser puis appliquer sur un jeu de 3 tâches et 4 agents. `[SÉQUENTIEL]`

---

### Epic E5 - Vue Activité

Objectif : offrir un troisième mode d'affichage du planning, orienté tâches, sans régression sur les modes existants.

#### US E5.1 - Mode viewMode activity

**En tant qu'** utilisateur autorisé,
**je souhaite** basculer sur une vue orientée tâches,
**afin de** visualiser la couverture par activité.

**Critères d'acceptation**

- `PlanningView` expose un troisième mode `"activity"` à côté de `"week"` et `"month"`, activé par un bouton « Vue activité ».
- Le bouton n'est visible que pour les utilisateurs disposant de la permission `planning:activity-view`.
- Les modes existants ne sont pas modifiés.
- L'état du mode est persisté via `usePlanningViewStore`.

**Tâches techniques**

- T5.1.1 Extension du type `viewMode` et du store. `[SÉQUENTIEL]`
- T5.1.2 Bouton dans la barre de contrôles avec gating permission. `[PARALLÈLE avec T5.1.3]`
- T5.1.3 Tests de non-régression sur `week` et `month`. `[PARALLÈLE avec T5.1.2]`

#### US E5.2 - Grille ActivityGrid

**En tant qu'** utilisateur,
**je souhaite** voir les jours en lignes et les tâches en colonnes,
**afin d'** identifier qui fait quoi par activité sur la plage.

**Critères d'acceptation**

- Nouveau composant `ActivityGrid.tsx` : lignes = jours de la plage sélectionnée, colonnes = tâches prédéfinies actives, cellules = utilisateur(s) assigné(s) + badge de statut.
- Filtrage par service et par plage (réutilise `usePlanningData`).
- Export PDF ou impression : bouton basique « Imprimer » utilisant la feuille de style print. L'export ICS reste hors périmètre.
- Accessibilité AA.

**Tâches techniques**

- T5.2.1 Composant `ActivityGrid`. `[PARALLÈLE avec T5.2.2]`
- T5.2.2 Feuille de style print dédiée. `[PARALLÈLE avec T5.2.1]`
- T5.2.3 Tests composant + snapshot. `[PARALLÈLE avec T5.2.1]`
- T5.2.4 Tests e2e : bascule sur la vue activité, filtrage, impression. `[SÉQUENTIEL]`

---

## 14. Matrice de parallélisation par vague

Synthèse des tâches parallélisables via sous-agents.

| Vague | Paralléliser en simultané | Contrainte séquentielle |
|---|---|---|
| W1 | T1.1.2 / T1.1.3 / T1.1.4 / T1.1.5 / T1.1.6 après T1.1.1 | T1.1.1 puis T1.2.1 bloquants |
| W2 | T2.1.2 / T2.1.3 après T2.1.1 ; T2.2.2 / T2.2.3 après T2.2.1 ; T3.1.3 / T3.1.4 après T3.1.2 ; T3.2.1 / T3.2.2 ; T3.3.1 / T3.3.2 / T3.3.3 | Migrations Prisma en tête de chaque bloc |
| W3 | T4.1.3 / T4.1.4 ; T4.2.3 / T4.2.4 ; T4.3.1 / T4.3.2 | Services et endpoints en tête de chaque bloc |
| W4 | T5.1.2 / T5.1.3 ; T5.2.1 / T5.2.2 / T5.2.3 | T5.1.1 bloquant |
| W5 | W5.2 / W5.3 | W5.1 puis W5.4 bloquants |

## 15. Déploiement et rollback

- Chaque vague livre un incrément déployable en prod Orchestr'A (`orchestr-a.com`).
- Stratégie : merge sur `master`, `git pull` sur le VPS, `docker compose up -d --build`.
- Le Dockerfile applique les migrations Prisma au démarrage.
- Chaque migration est testée en montée et en descente (`down`) en local avant merge.
- En cas d'anomalie post-déploiement, `git revert` du commit fautif puis redéploiement.
- Les permissions RBAC nouvelles sont seedées par une migration de données dédiée (idempotente).

## 16. Indicateurs de succès

| Indicateur | Cible à M+1 après ouverture CDG |
|---|---|
| Taux d'adoption par les 6 agents CDG | 100 % des agents connectés au moins 1 fois par semaine |
| Taux de complétion des statuts d'assignation | ≥ 80 % des assignations passées mises à jour |
| Écart-type de charge pondérée par agent | < 15 % de la charge moyenne |
| Gain de temps administratif estimé | À objectiver en atelier post-recette |
| Incidents bloquants | 0 |

## 17. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Règles métier CDG mal capturées | Moyenne | Fort | Atelier W0 obligatoire, validation par Preschez avant W2. |
| Hétérogénéité des poids entre responsables | Moyenne | Moyen | Grille de référence dans la doc utilisateur (W5.2). |
| Performance dégradée sur `GET /planning/overview` | Faible | Fort | Benchmarks en CI, index sur `predefined_task_assignments(date, userId)`. |
| Utilisateurs rejettent l'équilibrage automatique | Moyenne | Moyen | V1 en mode preview obligatoire avant apply, ajustement manuel conservé. |
| Récurrence mensuelle mal spécifiée | Faible | Moyen | Jeux de tests exhaustifs sur cas limites (fév., fin de mois, dernier jeudi). |

## 18. Artefacts et références

- Fiche d'évaluation : `CPAM 92/IA/COPIL_IA/FICHES_BESOINS/2026-03-25_Fiche_Besoin_IA_01_CDG_Planification.md`
- Analyse de couverture : `CPAM 92/IA/COPIL_IA/FICHES_BESOINS/2026-03-25_Analyse_Orchestra_Besoin_01_CDG.md`
- Formulaire d'origine : `CPAM 92/IA/COPIL_IA/FICHES_BESOINS/2026-03-25_Formulaire_Besoin_IA_01_CDG.docx`
- Grille de qualification IA : `CPAM 92/IA/COPIL_IA/Grille de qualification des besoins IA.md`
- Schéma de données Orchestr'A : `packages/database/prisma/schema.prisma`
- Modules API concernés : `apps/api/src/{planning,predefined-tasks,leaves,skills,rbac,audit}`
- Composants front concernés : `apps/web/src/components/planning`, `apps/web/src/hooks/usePlanningData.ts`, `apps/web/src/stores/planningView.store.ts`
