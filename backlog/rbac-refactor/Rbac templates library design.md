# DESIGN — Bibliothèque RBAC Orchestr'A (26 templates)

> **Statut** : conception **finale validée**. Ce document fait foi pour Spec 1, 2 et 3. **Version** : v3 (les décisions sur catégorisation et fusion ADMIN_DELEGATED/QUASI_ADMIN sont tranchées).

---

## 1. Doctrine de naming

|Niveau|Nature|Visible où ?|Modifiable par ?|
|---|---|---|---|
|**Clé technique de template** (`ADMIN`, `PROJECT_LEAD`, `BASIC_USER`, etc.)|Code, stable, versionné|Console admin + fichiers code|Développeur (via PR merge)|
|**Libellé du rôle** (ex : "Directeur adjoint", "Alternant RH", "Enfant")|Donnée DB, modifiable à tout moment|Partout dans l'UI utilisateur|Admin (CRUD rôles)|

Les 26 templates listés ci-dessous sont des **patterns de permissions** indépendants du wording. Un même template peut servir 0, 1 ou N rôles nommés différemment par l'admin. Les libellés actuels (partiellement issus du référentiel emploi UCANSS) sont préservés intégralement dans la DB ; seul leur rattachement technique change.

---

## 2. Contexte UCANSS

Le référentiel emploi UCANSS (Union des Caisses Nationales de Sécurité Sociale) définit des dénominations standardisées pour les métiers de la Sécu. La CPAM peut avoir aujourd'hui 15 rôles ; demain, l'admin pourra en créer 30 ou 50 pour coller à la nomenclature UCANSS complète, sans toucher au code. Les 26 templates couvrent ce spectre étendu.

Certaines dénominations UCANSS (IML = Infrastructure/Machine/Logiciel, Parc, Support) sont des **titres d'emploi** qui ne correspondent pas aujourd'hui à des **domaines fonctionnels applicatifs** dans Orchestr'A. Leurs titulaires opèrent avec les permissions d'un `BASIC_USER`. Les templates `IT_SUPPORT` et `IT_INFRASTRUCTURE` existent en anticipation des modules IT futurs.

---

## 3. Catégorisation (9 groupes)

La galerie UI admin filtre par catégorie. Chaque catégorie a un code couleur (badge + filtre).

|#|Catégorie|Clé|Nb templates|Intensité visuelle|
|---|---|---|---|---|
|A|Administration système|`ADMINISTRATION`|2|Rouge|
|B|Management & pilotage|`MANAGEMENT`|4|Orange|
|C|Contribution & leadership projet|`PROJECT`|6|Bleu|
|D|Ressources humaines & relations tiers|`HR_AND_THIRD_PARTIES`|3|Rose|
|E|Analytics & contrôle de gestion|`ANALYTICS`|3|Violet|
|F|IT & exploitation|`IT_OPERATIONS`|2|Cyan|
|G|Consultation & audit|`OBSERVATION`|3|Gris|
|H|Utilisateur standard|`STANDARD_USER`|1|Vert|
|I|Profils externes & temporaires|`EXTERNAL`|2|Jaune|

**Total : 26 templates.**

---

## 4. Bibliothèque complète

### A — Administration système (2)

|#|Clé|Intent|Deltas principaux|Perms (≈)|
|---|---|---|---|---|
|1|`ADMIN`|Accès total, incluant configuration système et gestion des rôles.|Set complet (119).|119|
|2|`ADMIN_DELEGATED`|Direction opérationnelle de haut niveau sans droits de paramétrage système ni de gestion RBAC. Correspond à l'actuel `RESPONSABLE`.|`ADMIN` **moins** `users:manage_roles`, `settings:update`, `holidays:*write`. Correspond au cluster 2 actuel.|116|

### B — Management & pilotage (4)

|#|Clé|Intent|Deltas principaux|Perms (≈)|
|---|---|---|---|---|
|3|`PORTFOLIO_MANAGER`|Supervision transversale multi-projets avec bypass OwnershipGuard. PMO / architecte senior.|`MANAGER` **plus** `projects:manage_any`, `tasks:manage_any`, `events:manage_any`. **Pas** `leaves:*approve/manage`.|~85|
|4|`MANAGER`|Management d'équipe complet : projets + tâches + congés + télétravail + membres.|Cluster 3 actuel.|80|
|5|`MANAGER_PROJECT_FOCUS`|Management centré projets, sans autorité RH. Chef de programme sans équipe directe.|`MANAGER` **moins** `leaves:approve`, `manage_delegations`, `declare_for_others`, `manage`, `telework:manage_others`.|~65|
|6|`MANAGER_HR_FOCUS`|Management centré ressources humaines, sans delivery projet. Chef de service.|`MANAGER` **moins** tout le scope projets/tasks/epics/milestones CRUD. **Garde** tout le scope RH + lecture users/departments.|~40|

### C — Contribution & leadership projet (6)

|#|Clé|Intent|Deltas principaux|Perms (≈)|
|---|---|---|---|---|
|7|`PROJECT_LEAD`|Chef de projet confirmé : CRUD projet complet + gestion des membres.|Cluster 4 actuel.|60|
|8|`PROJECT_LEAD_JUNIOR`|Chef de projet en montée en compétence.|`PROJECT_LEAD` **moins** `projects:create/delete`, `projects:manage_members`.|~45|
|9|`TECHNICAL_LEAD`|Référent technique dans les projets : création/modification tâches sans gestion de projet.|Cluster 6 actuel.|41|
|10|`PROJECT_CONTRIBUTOR`|Contributeur projet actif : pattern couteau suisse.|Cluster 5 actuel (4 libellés UCANSS aujourd'hui).|52|
|11|`PROJECT_CONTRIBUTOR_LIGHT`|Contributeur au scope réduit. Équipes juniors encadrées.|`PROJECT_CONTRIBUTOR` **moins** `projects:edit/delete`, `epics:create/delete`, `milestones:create/delete`, `telework:manage_others`, `tasks:delete`.|~30|
|12|`FUNCTIONAL_REFERENT`|Référent fonctionnel applicatif : expertise métier sans écriture sur la structure projet.|`PROJECT_CONTRIBUTOR` **moins** `projects:create/delete/edit`, `epics:*write`, `milestones:*write`, `tasks:create/delete`. **Garde** `tasks:update`, documents, comments, time_tracking.|~35|

### D — Ressources humaines & relations tiers (3)

|#|Clé|Intent|Deltas principaux|Perms (≈)|
|---|---|---|---|---|
|13|`HR_OFFICER`|Gestionnaire RH avec pouvoir d'approbation.|Scope RH complet (`leaves:manage/approve/manage_delegations/declare_for_others/delete`, `telework:manage_others`, `holidays:*`, `school_vacations:*`) + lecture users/departments. **Pas** de scope projets.|~40|
|14|`HR_OFFICER_LIGHT`|RH junior / assistant RH, sans pouvoir d'approbation.|`HR_OFFICER` **moins** `leaves:approve/manage/manage_delegations/declare_for_others/delete`, `telework:manage_others`, `holidays:*write`, `school_vacations:*write`.|~20|
|15|`THIRD_PARTY_MANAGER`|Gestionnaire de prestataires/tiers.|`PROJECT_CONTRIBUTOR_LIGHT` **plus** `third_parties:*` complet + `time_tracking:declare_for_third_party`.|~35|

### E — Analytics & contrôle de gestion (3)

|#|Clé|Intent|Deltas principaux|Perms (≈)|
|---|---|---|---|---|
|16|`CONTROLLER`|Contrôle de gestion : vue large en lecture sur tous les pans opérationnels.|`analytics:*`, `reports:*`, `time_tracking:read/read_reports/view_any`, lecture étendue projets/tasks/users/departments/services. Aucune écriture.|~45|
|17|`BUDGET_ANALYST`|Analyste budgétaire centré temps/coûts.|`time_tracking:read/read_reports/view_any`, `reports:view/export`, projets en lecture.|~20|
|18|`DATA_ANALYST`|BI/analytics pur, sans lien opérationnel.|`analytics:read/export`, `reports:view/export`, lecture projets uniquement.|~15|

### F — IT & exploitation (2)

|#|Clé|Intent|Deltas principaux|Perms (≈)|
|---|---|---|---|---|
|19|`IT_SUPPORT`|Support technique utilisateurs.|`BASIC_USER` **plus** lecture étendue `users`, `departments`, `services`, `holidays`, `school_vacations`.|~30|
|20|`IT_INFRASTRUCTURE`|Équipe exploitation / infrastructure.|`IT_SUPPORT` **plus** `settings:read`, `holidays:create/update`, `school_vacations:create/update`.|~35|

### G — Consultation & audit (3)

|#|Clé|Intent|Deltas principaux|Perms (≈)|
|---|---|---|---|---|
|21|`OBSERVER_FULL`|Observateur global en lecture seule sur tout le périmètre métier.|Cluster 7 actuel.|31|
|22|`OBSERVER_PROJECTS_ONLY`|Observation limitée au scope projets. Sponsor, comité de pilotage.|`OBSERVER_FULL` **moins** `leaves:*`, `telework:*`, `holidays:*`.|~18|
|23|`OBSERVER_HR_ONLY`|Observation limitée au scope RH. Audit social, direction sociale.|`OBSERVER_FULL` **moins** `projects:*`, `tasks:*`, `epics:*`, `milestones:*`.|~15|

### H — Utilisateur standard (1)

|#|Clé|Intent|Deltas principaux|Perms (≈)|
|---|---|---|---|---|
|24|`BASIC_USER`|Utilisateur standard : self-service complet (congés, télétravail, time tracking, tâches orphelines).|Cluster 8 actuel (5 libellés aujourd'hui).|23|

### I — Profils externes & temporaires (2)

|#|Clé|Intent|Deltas principaux|Perms (≈)|
|---|---|---|---|---|
|25|`EXTERNAL_PRESTATAIRE`|Prestataire externe temporaire (consultant facturable).|`PROJECT_CONTRIBUTOR_LIGHT` **plus** `time_tracking:declare_for_third_party`. **Moins** `users:read/view`, `events:create/delete/update`.|~25|
|26|`STAGIAIRE_ALTERNANT`|Stagiaire ou alternant encadré, scope très réduit.|`BASIC_USER` **moins** `events:create/delete/update`, `telework:delete`. **Plus** `comments:create/read/update` et `documents:read` pour interaction projet basique.|~18|

---

## 5. Mapping de migration (15 libellés actuels → templates cibles)

**Règle de migration** : chaque libellé existant est rattaché au template dont le permission set correspond **exactement** à son set actuel. Aucun user ne gagne ni ne perd de permissions à la migration.

|Libellé DB actuel|Cluster|Template cible (migration)|Templates alternatifs (post-migration, décision admin)|
|---|---|---|---|
|ADMIN|1|`ADMIN`|—|
|RESPONSABLE|2|`ADMIN_DELEGATED`|—|
|MANAGER|3|`MANAGER`|`MANAGER_PROJECT_FOCUS`, `MANAGER_HR_FOCUS`, `PORTFOLIO_MANAGER`|
|CHEF_DE_PROJET|4|`PROJECT_LEAD`|`PROJECT_LEAD_JUNIOR`|
|CHARGE_DE_MISSION|5|`PROJECT_CONTRIBUTOR`|`PROJECT_CONTRIBUTOR_LIGHT`, `FUNCTIONAL_REFERENT`|
|CONSULTANT_TECHNOLOGIE_SI|5|`PROJECT_CONTRIBUTOR`|`TECHNICAL_LEAD`, `EXTERNAL_PRESTATAIRE`|
|CORRESPONDANT_FONCTIONNEL_APPLICATION|5|`PROJECT_CONTRIBUTOR`|`FUNCTIONAL_REFERENT`|
|DEVELOPPEUR_CONCEPTEUR|5|`PROJECT_CONTRIBUTOR`|`TECHNICAL_LEAD`, `PROJECT_CONTRIBUTOR_LIGHT`|
|REFERENT_TECHNIQUE|6|`TECHNICAL_LEAD`|—|
|OBSERVATEUR|7|`OBSERVER_FULL`|`OBSERVER_PROJECTS_ONLY`, `OBSERVER_HR_ONLY`|
|ADMINISTRATEUR_IML|8|`BASIC_USER`|`IT_INFRASTRUCTURE` (quand modules IT développés)|
|CONTRIBUTEUR|8|`BASIC_USER`|—|
|GESTIONNAIRE_IML|8|`BASIC_USER`|`IT_INFRASTRUCTURE`|
|GESTIONNAIRE_PARC|8|`BASIC_USER`|`IT_SUPPORT`|
|TECHNICIEN_SUPPORT|8|`BASIC_USER`|`IT_SUPPORT`|

**Aucune régression de permissions à la migration.**

---

## 6. Flexibilité offerte vs. état actuel

|Dimension|Avant (DB dynamique, 8 clusters)|Après (26 templates hardcodés)|
|---|---|---|
|Profils "effectifs" disponibles à l'admin|8|26|
|Profils management gradués|1 (MANAGER)|4|
|Profils contribution gradués|1 (cluster 5)|3|
|Profils observation gradués|1 (OBSERVATEUR)|3|
|Profils analytics dédiés|0|3|
|Profils RH dédiés|0|2|
|Profils tiers/prestataires|0|2|
|Profils stagiaire/alternant|0|1|
|Profils IT anticipés|0|2|
|Risque de désynchronisation DB/code|Élevé|Nul (templates compilés dans le bundle)|
|Review en PR des changements|Non (modifications en prod)|Oui (merge request obligatoire)|
|Admin toggle permission par erreur|Risque élevé|Impossible (pas d'accès aux permissions atomiques)|

---

## 7. Prochaines étapes

- **Spec 1** (audit code + conception technique) — à rédiger immédiatement.
- **Spec 2** (schema, migration, backend) — après livrables Spec 1 validés.
- **Spec 3** (frontend, UI galerie, tests E2E) — après Spec 2 déployée.

Ce document ne change plus sauf retour d'audit Phase 0 identifiant un blocker technique. Il sert de **contrat d'entrée** pour les trois specs à venir.