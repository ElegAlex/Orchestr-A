# SPEC 1 — Audit code RBAC & conception technique

> **Statut** : spec ready-to-paste pour Claude Code. **Portée** : Phase 0 (audit code exhaustif) + Phase 1 (conception technique). **Aucun code applicatif produit.** Les livrables servent de contrat pour Spec 2 (backend) et Spec 3 (frontend). **Pré-requis** : le document `backlog/rbac-templates-library-design.md` (biblio des 26 templates, v3) doit être présent dans le repo et validé par le product owner.

---

## 0. Inputs de la spec

Avant toute action, Claude Code lit et intègre :

1. **`backlog/rbac-templates-library-design.md`** (ou le path exact choisi par le PO) — biblio finale des 26 templates, catégorisation, mapping de migration.
2. Les 3 fichiers de référence DB déjà produits (non à ré-auditer) :
    
    - `ROLES-PERMISSIONS.md` — snapshot exhaustif
    - `roles-permissions.json` — structure DB exportée
    - `rbac-dump.sql` — dump SQL des tables `role_configs`, `permissions`, `role_permissions`
    
    Ces fichiers sont attachés au brief ou stockés dans `backlog/rbac-refactor/` selon la convention choisie par le PO.

Claude Code **n'ausculte pas à nouveau** la DB ; l'extraction est faite. Le scope de cette spec est **strictement l'audit code applicatif** et la **conception technique dérivée**.

---

## 1. Phase 0 — Audit code exhaustif (Claude Code)

**Livrable attendu** : un dossier `backlog/rbac-refactor/audit/` contenant les 6 fichiers markdown ci-dessous. **Aucune modification de code applicatif ne démarre avant validation de ces livrables par le PO.**

### 1.1 `audit-01-guards-decorators.md`

Inventaire exhaustif des mécanismes de contrôle d'accès backend.

- Liste de **tous les guards** existants (`JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `OwnershipGuard`, ou autres noms) avec chemin absolu et extrait de code intégral.
- Liste de **tous les decorators** liés au RBAC (`@Roles()`, `@RequirePermissions()`, `@Public()`, `@CurrentUser()`, `@Ownership()`, etc.) avec leur signature TypeScript et cas d'usage.
- **Pattern d'injection global vs local** : le guard RBAC est-il appliqué globalement via `APP_GUARD` dans `app.module.ts`, ou localement par controller/endpoint ? Extrait du fichier concerné.
- **Mécanisme de vérification** : comment le RolesGuard/PermissionsGuard accède aux permissions d'un user ? Query DB à chaque requête ? Cache Redis ? Lecture depuis JWT claims ? Schéma séquentiel du flow d'une requête authentifiée.

### 1.2 `audit-02-endpoints-permissions-map.md`

Mapping permission ↔ endpoint.

- Pour **chacune des 119 permissions** listées dans `ROLES-PERMISSIONS.md`, identifier :
    - Tous les endpoints backend qui la vérifient explicitement (chemin controller + ligne).
    - Type de vérification : decorator statique (`@Roles('ADMIN')`), decorator dynamique (`@RequirePermissions('tasks:create')`), check inline dans le service, ou absence de check.
- **Permissions orphelines** : permissions définies en DB mais **aucun code ne les consulte jamais** (ni back, ni front). Candidates à la suppression. Livrer la liste complète.
- **Endpoints non protégés** : endpoints authentifiés (JWT requis) mais sans aucun check de permission fine. Liste avec contexte (est-ce voulu ou un oubli ?).
- **Incohérences** : permissions vérifiées en front mais pas en back (trou de sécurité), ou l'inverse (vérification serveur inaccessible depuis l'UI).

### 1.3 `audit-03-ownership-scope-logic.md`

Logique de propriété et de scope.

- Le pattern `OwnershipGuard` (s'il existe) : extrait complet, logique de détermination du propriétaire d'une ressource, comportement en présence de permissions `manage_any` (bypass).
- Les permissions explicitement liées au bypass OwnershipGuard : `tasks:manage_any`, `projects:manage_any`, `events:manage_any`, `time_tracking:manage_any`, `leaves:manage_any`. Confirmer qu'elles sont bien interprétées comme bypass et documenter précisément la logique (DB lookup ? check dans le guard lui-même ? via PermissionsService ?).
- Les patterns `readAll` vs `read` : comment le code distingue-t-il "voir ses propres" vs "voir ceux des autres" ? Implémentation actuelle par module (tasks, leaves, telework, events). Quelle prop du user courant est consultée ?
- Conclusion : la logique de scope/ownership est-elle **indépendante du RBAC** (donc conservable telle quelle dans le refactor) ou **couplée** à la table `role_permissions` (donc à refactorer) ?

### 1.4 `audit-04-frontend-checks.md`

Contrôles d'accès côté frontend.

- **Provider d'auth** : `AuthProvider` / `AuthContext` actuel — chemin, shape du user exposé (contient-il les permissions ? le rôle brut ? une liste ?), stockage (JWT décodé ? appel API au mount ?).
- **Hook(s) de permission** : existe-t-il un `useHasPermission(permission: string)`, `useHasRole(role: string)`, ou équivalent ? Chemin, signature, implémentation.
- **Sidebar** : fichier de la sidebar, logique de rendu conditionnel des items selon le rôle/permission. Lister chaque item avec la(les) permission(s) qui contrôle(nt) sa visibilité.
- **Checks granulaires dans les components** : boutons d'action (créer, supprimer, approuver, etc.) conditionnels. Lister les 10 patterns les plus fréquents avec chemin + extrait.
- **Route guards** : protection des pages Next.js selon rôle/permission (middleware ? layout.tsx ? hooks dans les pages ?).
- **Incohérences avec le backend** : permissions vérifiées en front avec un code différent de celui côté back (ex : front check `tasks:edit` mais back vérifie `tasks:update`).

### 1.5 `audit-05-admin-role-management-ui.md`

Inventaire de ce qui existe et doit être démantelé/refactoré en Spec 3.

- Chemin de la page actuelle "Gestion des rôles".
- Composants enfants : matrice permissions, form création de rôle, form édition, modal de confirmation de suppression, etc. Liste complète avec rôle fonctionnel de chaque composant.
- Endpoints backend alimentant cette UI (`GET /api/role-configs`, `POST /api/role-configs/:id/permissions`, etc.) — liste exhaustive avec logique actuelle.
- **Patterns réutilisables** dans la future UI galerie (ex : select de rôle utilisateur, modal de confirmation) — ce qui peut être conservé vs ce qui doit être jeté.

### 1.6 `audit-06-summary-and-risks.md`

Synthèse et risques pour Spec 2 et Spec 3.

- **Permissions mortes identifiées** : liste définitive à supprimer en Spec 2.
- **Endpoints à corriger** en priorité (trous de sécurité identifiés en §1.2).
- **Contraintes techniques** sur le refactor backend (ex : `RolesGuard` a une dépendance circulaire, seed idempotent requis, etc.).
- **Contraintes techniques** sur le refactor frontend (ex : hook useHasPermission consommé à 80 endroits, refactor à faire en une passe coordonnée).
- **Risques de régression** identifiés avec scénarios de test à ajouter en Spec 2/3.
- **Incertitudes restantes** à arbitrer avec le PO avant de lancer Spec 2.

### Validation utilisateur

**STOP après Phase 0.** Claude Code présente le dossier `backlog/rbac-refactor/audit/` et attend validation explicite du PO avant de démarrer la Phase 1. Si l'audit révèle un écart significatif avec les hypothèses du design doc (ex : une permission clé n'est vérifiée nulle part, ou le OwnershipGuard est couplé à une table inattendue), attendre re-scoping.

---

## 2. Phase 1 — Conception technique (Claude Code, après validation Phase 0)

**Livrable attendu** : un dossier `backlog/rbac-refactor/contract/` contenant les 5 fichiers ci-dessous. **Aucune modification de code applicatif ne démarre avant validation de ces livrables.** Ces livrables serviront d'input intégral à Spec 2 et Spec 3.

### 2.1 `contract-01-atomic-permissions.ts` (fichier TypeScript annoté)

Définition des **constantes atomiques** de permissions, dérivées par factorisation des sets de permissions des 26 templates.

- Chaque constante est un `readonly` array de permissions liées (ex : `BASE_READ_AGENT`, `PROJECT_READ`, `PROJECT_CRUD`, `LEAVE_SELF_SERVICE`, `LEAVE_APPROVAL`, etc.).
- Chaque constante est annotée : intent, templates qui l'utilisent, justification de sa granularité.
- Le fichier est **compilable** (valide TypeScript, exports nommés propres), mais pas encore intégré au repo (livré dans `contract/` pour review, l'intégration se fait en Spec 2).
- Règle : aucun template final ne doit pouvoir être exprimé que par composition d'atomiques (pas de permissions inline). Toute permission individuelle non factorisable reste sous forme de constante à 1 élément.

### 2.2 `contract-02-templates.ts` (fichier TypeScript annoté)

Définition des **26 templates** par composition des constantes atomiques.

- Type `RoleTemplateKey` = union des 26 clés.
- Type `RoleCategoryKey` = union des 9 catégories.
- Type `RoleTemplate` = `{ key, defaultLabel, category, description, permissions: readonly PermissionCode[] }`.
- Constante `ROLE_TEMPLATES: Record<RoleTemplateKey, RoleTemplate>` avec les 26 entrées.
- Chaque template exprime ses permissions par **spread de constantes atomiques** + ajouts/retraits ponctuels si nécessaire.
- Livré dans `contract/`, intégration en Spec 2.

### 2.3 `contract-03-type-model.md`

Modèle de données cible (schema Prisma + types TypeScript de domaine).

- Schema Prisma proposé pour les tables `roles` (unifiée, `isSystem`, FK de `User`), à rédiger en format Prisma DSL complet mais **non encore intégré** au `schema.prisma` actuel (c'est Spec 2 qui le fait).
- Stratégie de migration : étapes SQL idempotentes pour passer de l'état actuel (3 tables : `role_configs`, `permissions`, `role_permissions`) à l'état cible (1 table : `roles`), avec backfill des `roleId` sur les users existants selon la table de mapping §5 du design doc.
- Stratégie de rollback.
- Impact sur l'enum Prisma `Role` : conservé pendant la transition (compat) ou dropé immédiatement ? Recommandation justifiée.

### 2.4 `contract-04-helpers-api.md`

API de helpers RBAC à exposer (contrat d'interface, pas d'implémentation).

- Backend : signature de `PermissionsService` refactorisé (méthodes publiques, types des paramètres et retours). Décorateur `@RequireTemplate(...)` et/ou `@RequirePermission(...)` — signatures proposées.
- Frontend : signature du hook `useHasPermission(permission: PermissionCode): boolean` et `useHasAnyOfTemplates(templates: RoleTemplateKey[]): boolean`. Consommation depuis le JWT décodé (ou appel API dédié si nécessaire).
- Stratégie de partage des types : via quel package (`packages/types`, nouveau `packages/rbac`, ou extension d'un existant) ? Justification.

### 2.5 `contract-05-spec2-spec3-inputs.md`

Document d'orchestration pour les specs suivantes.

- Liste exhaustive des fichiers backend à créer/modifier en Spec 2 (avec path), dérivée de l'audit §1.1-1.3.
- Liste exhaustive des fichiers frontend à créer/modifier en Spec 3 (avec path), dérivée de l'audit §1.4-1.5.
- Ordre d'exécution recommandé à l'intérieur de Spec 2 et Spec 3 (avec dépendances internes), pour permettre au PO de pré-découper les vagues de travail.
- Critères d'acceptation globaux du refactor (scenarios de non-régression à valider en fin de Spec 3).

### Validation utilisateur

**STOP après Phase 1.** Claude Code présente `backlog/rbac-refactor/contract/` et attend validation explicite du PO avant toute production de Spec 2. Le PO peut demander des ajustements sur les constantes atomiques, la structure du template, ou la stratégie de migration.

---

## 3. Matrice de conflits fichiers

Spec 1 **n'écrit aucun fichier de code applicatif**. Les livrables sont exclusivement :

- `backlog/rbac-refactor/audit/*.md` (6 fichiers)
- `backlog/rbac-refactor/contract/*.{md,ts}` (5 fichiers)

Aucun conflit possible avec le code existant. La spec est 100% séquentielle, 1 teammate.

---

## 4. Risques identifiés

### Risque 1 — Permissions mortes mal identifiées

Une permission apparemment non consultée peut l'être via un mécanisme dynamique (string interpolation, reflection) que le grep statique ne capture pas. **Mitigation** : recherche à la fois `'module:action'` (string littéral) et patterns dynamiques (`` `${module}:${action}` ``). Doute → ne pas supprimer et flagger pour review PO.

### Risque 2 — OwnershipGuard couplé à `role_permissions`

Si le OwnershipGuard consulte la table `role_permissions` pour déterminer le bypass (via `manage_any`), la migration doit préserver ce comportement sans passer par l'ancienne table. **Mitigation** : cartographier précisément la dépendance en §1.3, proposer une adaptation du guard en §2.4.

### Risque 3 — Permissions front-only

Des permissions peuvent être vérifiées uniquement côté front (masquage UI) sans vérification back. C'est un **trou de sécurité critique**, à flagger et corriger en Spec 2 avec un test de non-régression back pour chaque endpoint concerné.

### Risque 4 — Incohérence de naming permissions

Certaines permissions exhibent des doublons sémantiques (`projects:read` vs `projects:view`, `users:edit` vs `users:update`). L'audit doit les identifier et la conception propose **soit une consolidation** (fusionner view/read en un seul dans les templates), **soit préserver le doublon** avec justification technique. À arbitrer avec le PO.

### Risque 5 — Dépassement de scope par Claude Code

Tentation de "préparer" des types dans le code réel pendant la Phase 0, ou de "commencer" la migration Prisma pendant la Phase 1. **Mitigation** : l'instruction `STOP après chaque phase` est explicite. Si Claude Code crée un fichier `.ts` en dehors de `backlog/rbac-refactor/`, interrompre immédiatement.

### Risque 6 — Régression sur endpoints non testés

Certains endpoints peuvent ne pas avoir de test d'intégration couvrant leur check de permission. Spec 2 devra ajouter les tests manquants **avant** de refactorer le guard, sinon la détection de régression sera impossible.

---

## 5. Critères d'acceptation (Spec 1)

- [ ] Le dossier `backlog/rbac-refactor/audit/` contient les 6 fichiers markdown spécifiés.
- [ ] Chaque fichier d'audit contient des chemins absolus vérifiés et des extraits de code réels (pas de paraphrase).
- [ ] La liste des permissions mortes est produite, discutée, et validable en une lecture.
- [ ] Le dossier `backlog/rbac-refactor/contract/` contient les 5 fichiers spécifiés.
- [ ] Les fichiers TypeScript du contrat (`contract-01`, `contract-02`) sont compilables et type-checkent (exécuter `tsc --noEmit` dessus en isolation).
- [ ] Aucun fichier de code applicatif dans `apps/` ou `packages/` n'a été modifié.
- [ ] Le PO peut valider la transition vers Spec 2 sur la seule base du dossier `contract/`.

---

## 6. Out of scope (Spec 1)

- Écriture du schema Prisma final dans `schema.prisma` (Spec 2).
- Écriture des migrations SQL (Spec 2).
- Intégration des constantes atomiques dans le code applicatif (Spec 2).
- Refactor des guards, decorators, endpoints (Spec 2).
- Refactor de l'UI admin, sidebar, hooks front (Spec 3).
- Tests E2E RBAC (Spec 3).
- Suppression des permissions mortes en DB (Spec 2).
- Drop des tables `role_configs`, `permissions`, `role_permissions` (Spec 2, après migration vérifiée).