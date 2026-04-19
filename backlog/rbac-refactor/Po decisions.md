# PO Decisions — Arbitrages post-audit Phase 0

> **Objet** : Décisions officielles du Product Owner suite à l'audit Phase 0 de Spec 1. Ces arbitrages figent les choix techniques et fonctionnels pour Phase 1 (conception technique), Spec 2 (backend) et Spec 3 (frontend). **Source des constats** : dossier `backlog/rbac-refactor/audit/` (6 fichiers). **Portée** : 14 décisions classées par criticité. **Statut** : à valider. Une fois validé, ce document est **read-only** et sert de contrat d'entrée pour Phase 1.

---

## Rappel cadrant

Dans le modèle cible :

- **Template** = pattern de permissions hardcodé dans le code (26 templates).
- **Rôle** = entité DB avec un libellé + un rattachement à un template. Plusieurs rôles peuvent pointer sur le même template.
- Aucun rôle ne porte de permissions sur-mesure. Les permissions sont **intégralement** déterminées par le template.

Toutes les décisions ci-dessous s'inscrivent dans ce cadre.

---

## 🔴 Décisions structurantes (bloquantes pour Phase 1)

### D1 — Enum `User.role` figé vs table `roles` unifiée

**Contexte** : `User.role` est aujourd'hui typé via enum Prisma figé (15 valeurs). `RoleConfig` permet de créer des rôles custom (`isSystem: false`) mais ces rôles ne peuvent pas être assignés à un user (l'enum rejette). Incohérence structurelle.

**Options** :

- (a) Garder l'enum Prisma figé — rend impossible la création de rôles par l'admin.
- (b) Migrer `User.role` vers une string libre (FK textuelle).
- (c) Migrer vers FK `roleId → roles.id` (table unifiée, cf. design doc §5).

**Arbitrage** : **(c)** — Table `roles` unifiée avec `User.roleId` en FK.

**Justification** : seule option qui rend les rôles (et donc la liberté de libellé par l'admin) utilisables. L'enum figé est un vestige incompatible avec le modèle cible.

**Impact** : Spec 2 Vague 0 refactor complet du schema Prisma. Enum `Role` supprimé. Migration backfill obligatoire.

---

### D2 — Fail-open vs zero-trust du `PermissionsGuard`

**Contexte** : aujourd'hui, toute route sans `@Permissions()` ni `@Public()` est **authentifiée mais sans contrôle fin**. 63 routes dans ce cas, dont ~33 oublis probables.

**Options** :

- (a) Conserver fail-open (statu quo, risque sécurité persistant).
- (b) Zero-trust immédiat (fail-closed) : toute route privée doit `@Public()` ou `@Permissions()`.
- (c) Transition douce : phase de logging "serait bloqué" avant d'activer le blocage.

**Arbitrage** : **(b) Zero-trust immédiat** avec allowlist explicite.

**Justification** : posture sécurité correcte, clé en main pour un système en prod CPAM. Le logging préventif est utile si on avait un volume de routes inconnues massif ; ici l'audit les a toutes recensées.

**Allowlist explicite** : les routes qui restent ouvertes à tout utilisateur authentifié sans `@Permissions` sont :

- `/auth/logout`, `/auth/profile`, `/auth/me`, `/auth/me/permissions`
- `/personal-todos/*` (self-service strict)
- Routes `/me/*` et équivalents self-service explicites (à lister exhaustivement en Phase 1 à partir de l'audit §1.2)

Toutes les autres routes actuellement sans `@Permissions` doivent être câblées en Phase 1/Spec 2.

**Impact** : Phase 1 produit la liste allowlist définitive dans `contract-05`. Spec 2 Vague 2 câble toutes les routes non-allowlistées.

---

### D3 — Câblage des 8 endpoints mutants sans `@Permissions`

**Contexte** : `POST /tasks`, `DELETE /tasks/:id`, `POST /leaves`, `PATCH /leaves/:id`, `DELETE /leaves/:id`, `DELETE /leaves/delegations/:id`, `POST /planning-export/ics/import/preview`, `POST /planning-export/ics/import` — aujourd'hui protégés uniquement par logique service (runtime).

**Arbitrage** : **câbler systématiquement** via `@Permissions`.

**Mapping** :

|Endpoint|`@Permissions` à ajouter|
|---|---|
|`POST /tasks`|`tasks:create` (+ logique service conserve la distinction `create_in_project`/`create_orphan`)|
|`DELETE /tasks/:id`|`tasks:delete`|
|`POST /leaves`|`leaves:create`|
|`PATCH /leaves/:id`|`leaves:update`|
|`DELETE /leaves/:id`|`leaves:delete`|
|`DELETE /leaves/delegations/:id`|`leaves:manage_delegations`|
|`POST /planning-export/ics/import/preview`|`leaves:create` (cohérent : l'import crée des congés)|
|`POST /planning-export/ics/import`|`leaves:create`|

**Justification** : la protection service-side a démontré son insuffisance (trous identifiés par l'audit). Le câblage déclaratif rend le contrôle vérifiable d'un seul coup d'œil par le reviewer.

**Impact** : Spec 2 Vague 2. Tests de non-régression requis en Spec 2 Vague 3 : chaque endpoint testé avec un user non-autorisé (attendu 403).

---

## 🟡 Décisions qui impactent le contrat atomique (Phase 1)

### D4 — Permissions mortes : suppression / câblage

**Contexte** : 21 permissions mortes identifiées en audit §1.6.

**Arbitrages par catégorie** :

**Catégorie A — Doublons `:view` / `:edit` (10 permissions)** → **SUPPRIMER**. Liste : `departments:edit`, `departments:view`, `projects:edit`, `projects:view`, `skills:edit`, `skills:view`, `users:edit`, `users:view`, `leaves:view`, `telework:view`. Justification : zéro consommateur, pure duplication sémantique. Suppression sans risque.

**Catégorie B — Lectures orphelines (9 permissions)** → **CÂBLER (pas supprimer)**. Liste : `comments:read`, `epics:read`, `holidays:read`, `milestones:read`, `school_vacations:read`, `services:read`, `settings:read`, `analytics:read` (voir D5), `analytics:export` (voir D5). Justification : cohérence RBAC. Laisser `/settings`, `/services`, `/holidays` en lecture ouverte est un risque d'information leakage. Le câblage aligne le comportement sur le reste du catalogue.

**Catégorie C — Permissions à arbitrer (2 permissions)** :

- `tasks:delete` → **CÂBLER** sur `DELETE /tasks/:id` (cf. D3).
- `telework:manage_recurring` → **SUPPRIMER** (jamais vérifiée, les endpoints `/telework/recurring-rules*` utilisent `telework:create/update/delete/read` qui suffisent).

**Catégorie D — Permissions scope-filter (5 permissions)** → **CONSERVER** telles quelles. Liste : `tasks:readAll`, `leaves:readAll`, `telework:readAll`, `events:readAll`, `leaves:manage_any`. Justification : opérationnelles dans les services. Cf. D8 pour l'harmonisation du comportement `readAll`.

**Impact** : Phase 1 — `contract-01-atomic-permissions.ts` ne contient que les permissions conservées. Spec 2 Vague 2 câble les Catégorie B + `tasks:delete`. Spec 2 Vague 4 drop les permissions supprimées en DB.

---

### D5 — `analytics:*` vs `reports:*`

**Contexte** : doublon — `analytics:read`/`analytics:export` sont orphelines, `reports:view`/`reports:export` gouvernent les endpoints `/analytics/*`.

**Arbitrage** : **supprimer `analytics:*`, conserver `reports:*`**.

**Justification** : `reports:*` est déjà câblé partout. Renommer serait une régression inutile.

**Impact** : ajustement mineur du design doc `rbac-templates-library-design.md` §4 — templates `CONTROLLER`, `BUDGET_ANALYST`, `DATA_ANALYST` utilisent `reports:*` (et non `analytics:*`). À appliquer en Phase 1 dans `contract-02-templates.ts`.

---

### D6 — 5 bugs de naming (codes permissions inexistants référencés)

**Contexte** : 5 codes référencés dans le code mais absents du catalogue — endpoints morts ou UI cassée.

**Arbitrages** :

|#|Code cassé|Emplacement|Décision|
|---|---|---|---|
|1|`admin:access`|`projects.controller.ts:88` — `POST /projects/snapshots/capture`|**Remplacer par `reports:export`** (l'endpoint capture un snapshot pour analytics, cohérent avec le périmètre reports)|
|2|`leaves:validate`|`leaves.controller.ts:292` — check runtime sur `/leaves/balance/:userId`|**Remplacer par `leaves:approve`** (typo confirmée)|
|3|`predefined_tasks:manage`|`AssignmentModal.tsx:250` — lien "Configurer"|**Remplacer par `predefined_tasks:edit`**|
|4|`documents:manage_any`|`documents.controller.ts:73, 85` — `bypassPermission`|**Créer la permission** (cohérence avec les 4 autres `*:manage_any`) et l'attribuer aux templates `ADMIN` et `ADMIN_DELEGATED`|
|5|`users:manage`|`MainLayout.tsx:54` — sidebar|**Remplacer par `users:read`** côté front|

**Impact** : Spec 2 (backend : #1, #2, #4) et Spec 3 (frontend : #3, #5). `documents:manage_any` doit être intégré dans le catalogue atomique Phase 1.

---

### D7 — Harmonisation `telework:manage_others` → `telework:manage_any`

**Contexte** : convention incohérente. Toutes les permissions de bypass OwnershipGuard sont nommées `*:manage_any` (tasks, projects, events, time_tracking, leaves) **sauf** `telework:manage_others`.

**Arbitrage** : **renommer `telework:manage_others` en `telework:manage_any`**.

**Justification** : cohérence nominale du catalogue. Rend le code auditable (grep sur `manage_any` = liste exhaustive des bypass).

**Impact** : Spec 2 Vague 0 — migration DB rename + update des 3 `@OwnershipCheck` concernés + update des templates qui référencent cette permission.

---

### D8 — Comportement `readAll` : coercion silencieuse uniforme

**Contexte** : incohérence — tasks/leaves/telework/events coercent silencieusement (un user sans `readAll` voit ses propres ressources), time-tracking rejette en 403.

**Arbitrage** : **coercion partout**.

**Justification** : meilleure UX (pas de 403 surprise). Si l'endpoint est accessible, le user voit ce qu'il a le droit de voir, sans erreur technique.

**Impact** : Spec 2 Vague 2 — aligner le comportement de time-tracking sur les 4 autres modules. Tests de non-régression associés.

---

## 🟢 Décisions mineures (UX / convention / scope)

### D9 — Protection UI/back des rôles système (`isSystem=true`)

**Contexte** : l'UI actuelle permet de réécrire les permissions d'un rôle système (ADMIN, etc.). Faille critique.

**Arbitrage** : **blocage total** UI ET back.

**Détails** :

- Back : tout endpoint de mutation (`PATCH /roles/:id`, `DELETE /roles/:id`, mutation des permissions) retourne 403 si `isSystem=true`.
- Front : boutons Éditer/Supprimer masqués sur les cards de templates système. Pour les rôles utilisateurs pointant sur un template système, seul le libellé peut être édité, pas le `templateKey`.

**Justification** : dans le nouveau modèle, un "template système" n'est même plus une ligne DB modifiable — c'est une constante code. L'admin ne peut fondamentalement pas changer les permissions d'un template.

**Impact** : Spec 2 module `roles` + Spec 3 composants galerie.

---

### D10 — Route guards Next.js

**Contexte** : aujourd'hui 0 guard côté Next.js. Toutes les pages privilégiées sont accessibles par URL directe. La sécurité repose 100% sur les guards back.

**Arbitrage** : **ajouter un HOC `withAccessControl(permission)`** pour redirection proactive.

**Justification** : amélioration UX (évite l'écran qui charge puis affiche une 403). Pas une mesure de sécurité — les guards back restent authoritative.

**Impact** : Spec 3 Vague 1 D (nouvelle page admin/roles) + migration progressive des pages existantes en Spec 3 Vague 1 C.

---

### D11 — Template `OBSERVER_FULL` : périmètre "large" documenté

**Contexte** : l'audit note que le seed actuel inclut `users:read`, `analytics:read` (→ `reports:view` après D5), `settings:read` pour OBSERVATEUR. Potentiellement trop large selon métier.

**Arbitrage** : **conserver tel quel** à la migration (aucune régression). Documenter explicitement dans le design doc que `OBSERVER_FULL` est volontairement large, et que `OBSERVER_PROJECTS_ONLY`/`OBSERVER_HR_ONLY` sont les options ciblées si l'admin veut un périmètre plus restreint.

**Justification** : pas de régression de droits au moment de la migration. Les options granulaires existent pour l'admin post-migration.

**Impact** : ajout d'une note dans `rbac-templates-library-design.md` §4 G — `OBSERVER_FULL` décrit comme "volontairement large, inclut settings et users en lecture".

---

### D12 — Dépréciation définitive de `@Roles()` et `RolesGuard`

**Contexte** : 1 seule occurrence restante de `@Roles()` (`role-management.controller.ts`).

**Arbitrage** : **migrer cette dernière occurrence vers `@Permissions('users:manage_roles')`** et **supprimer définitivement** `@Roles()` et `RolesGuard` en Spec 2 Vague 4.

**Justification** : un seul mécanisme de contrôle d'accès dans le code = surface de risque réduite et lisibilité.

**Impact** : Spec 2 Vague 2 (migration de la dernière route) + Spec 2 Vague 4 (suppression).

---

### D13 — Extraction `ScopeService` — hors scope refonte RBAC

**Contexte** : `getManagedUserIds` est dupliqué 4× dans `leaves.service.ts`. Opportunité de factorisation en `ScopeService` générique.

**Arbitrage** : **hors scope de Spec 2**. Ticket séparé à créer post-refonte RBAC.

**Justification** : le refactor RBAC touche déjà beaucoup de surface. Ajouter un refactor de logique de scope élargit le périmètre de régression. La duplication actuelle fonctionne — elle n'est pas un bug.

**Impact** : création d'un ticket backlog séparé après Spec 3 déployée.

---

### D14 — Lecture préalable des tests unitaires guards

**Contexte** : `roles.guard.spec.ts` et `permissions.guard.spec.ts` existent mais n'ont pas été consultés lors de Phase 0.

**Arbitrage** : **Claude Code lit ces deux fichiers au tout début de Phase 1** (avant de rédiger `contract-04-helpers-api.md`).

**Justification** : ces tests peuvent révéler des contrats implicites (edge cases couverts, comportements attendus) que l'audit statique n'a pas capturés.

**Impact** : Phase 1 — 5 minutes d'extension du scope, intégration éventuelle dans `contract-04-helpers-api.md` si contrats implicites identifiés.

---

## Synthèse : impact sur les specs en aval

### Modifications à apporter au design doc `rbac-templates-library-design.md`

1. §4 E (Analytics) : confirmer que les templates utilisent `reports:*` et non `analytics:*` (D5).
2. §4 G (Observation) : ajouter une note sur la largeur volontaire d'`OBSERVER_FULL` (D11).
3. §4 concerné : `telework:manage_any` remplace `telework:manage_others` partout (D7).
4. §4 concerné : `documents:manage_any` ajouté au template `ADMIN` et `ADMIN_DELEGATED` (D6 #4).

### Modifications à apporter à la Spec 1 `spec-1-rbac-audit-and-contract.md`

Phase 1 enrichie :

- `contract-01-atomic-permissions.ts` intègre les décisions D4, D5, D6, D7.
- `contract-05-spec2-spec3-inputs.md` inclut la liste allowlist (D2) et la liste des endpoints à câbler (D3 + D4 Cat B).
- Lecture préalable des tests guards (D14).

### Modifications à apporter à la Spec 2 `spec-2-rbac-backend.md`

Vagues impactées :

- Vague 0 : schema unifié (D1), rename `telework:manage_any` (D7), ajout `documents:manage_any` (D6 #4).
- Vague 2 : câblage allowlist + endpoints mutants (D2, D3, D4 Cat B, D6 #1, #2), harmonisation `readAll` (D8), migration dernière occurrence `@Roles()` (D12).
- Vague 3 : tests couvrant les nouvelles protections (D2, D3, D8, D9).
- Vague 4 : suppression `@Roles()` + `RolesGuard` (D12), drop permissions mortes (D4).

### Modifications à apporter à la Spec 3 `spec-3-rbac-frontend.md`

- Vague 1 B (sidebar) : correction `users:manage` → `users:read` (D6 #5).
- Vague 1 C (checks granulaires) : correction `predefined_tasks:manage` → `predefined_tasks:edit` (D6 #3), ajout HOC `withAccessControl` (D10).
- Vague 1 D (galerie) : blocage édition rôles système (D9).

---

## Validation

Ce document ne change plus sauf retour structurant en Phase 1 (ex : un contrat atomique révèle qu'une décision d'arbitrage est techniquement impossible). Il sert de **source unique de vérité** pour les arbitrages PO et est référencé explicitement par le prompt d'invocation de Phase 1.