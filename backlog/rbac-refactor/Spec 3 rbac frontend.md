# SPEC 3 — Frontend : UI galerie, hooks RBAC, refactor checks, tests E2E

> **Statut** : spec ready-to-paste pour Claude Code. **Portée** : refonte complète du frontend RBAC : consommation du nouveau modèle de rôles, hooks `useHasPermission`, refactor de la sidebar et des checks granulaires, nouvelle UI galerie d'administration des rôles (26 templates), tests E2E Playwright des scénarios RBAC critiques. **Pré-requis obligatoire** : Spec 2 entièrement déployée en prod (Vagues 0–3 au minimum, Vague 4 optionnelle). Le backend expose déjà `/api/roles` et `/api/roles/templates`, et le JWT contient les informations nécessaires aux hooks front.

---

## 0. Inputs de la spec

Avant toute action, Claude Code lit et intègre :

1. **`backlog/rbac-templates-library-design.md`** — biblio finale (26 templates, 9 catégories, palette couleur, intents).
2. **`backlog/rbac-refactor/contract/contract-02-templates.ts`** — déjà intégré au package partagé en Spec 2, importable directement côté frontend.
3. **`backlog/rbac-refactor/contract/contract-04-helpers-api.md`** — signature du hook `useHasPermission` et consorts.
4. **`backlog/rbac-refactor/audit/audit-04-frontend-checks.md`** — inventaire exhaustif des points de contrôle RBAC front à refactorer.
5. **`backlog/rbac-refactor/audit/audit-05-admin-role-management-ui.md`** — composants existants à démanteler/remplacer.

Claude Code consomme ces documents comme **source unique de vérité** sur la surface à modifier. Aucune re-exploration du code front tant que Phase 0 n'est pas close.

---

## 1. Phase 0 — Audit de cohérence (court, <30 min)

**Livrable** : `backlog/rbac-refactor/spec3-readiness.md` contenant :

- Vérification que Spec 2 est bien déployée (appel à `/api/roles/templates` depuis local avec user admin doit retourner les 26 templates).
- Confirmation que le JWT émis par `/api/auth/login` contient bien le `roleId` + `templateKey` (ou la shape définie en contrat-04).
- Liste des fichiers front effectivement présents à modifier, cross-checkée avec la liste de `contract-05-spec2-spec3-inputs.md` (détecter les drifts depuis la production des audits).
- Exécution de `pnpm --filter web type-check` et `pnpm --filter web lint` en baseline : snapshot du nombre d'erreurs/warnings actuels pour comparer à la fin de Spec 3.
- Confirmation que le package partagé contenant `ROLE_TEMPLATES` et les types est bien consommable depuis `apps/web` (import test).
- Liste des tests E2E Playwright existants touchant au RBAC (baseline pour détection régression).

**Validation PO requise** avant Vague 0.

---

## 2. Matrice de conflits fichiers

Les chemins exacts viennent de `contract-05-spec2-spec3-inputs.md`. Structure logique :

|Domaine|Teammate|Fichiers (types)|
|---|---|---|
|AuthProvider + hook `useHasPermission` + helpers RBAC client|**A**|`apps/web/src/components/AuthProvider.tsx`, `apps/web/src/hooks/usePermissions.ts` (nouveau), `apps/web/src/lib/rbac.ts` (nouveau)|
|Sidebar conditionnelle refactorée|**B**|Fichier sidebar identifié en audit §1.4|
|Checks granulaires dans les pages/composants existants|**C**|Pages et components identifiés en audit (haute volumétrie, ~80 points d'intervention)|
|Nouvelle page "Gestion des rôles" (galerie 26 cards + CRUD rôle custom)|**D**|`apps/web/app/admin/roles/` (nouveau dossier) + composants enfants|
|Suppression ancienne page admin + composants obsolètes|**E**|Fichiers identifiés en audit §1.5|
|Tests E2E Playwright RBAC|**F**|`e2e/rbac/*.spec.ts` (nouveaux)|

**Règle de parallélisation** : A est prérequis pour B, C et D (ils consomment le hook). B, C, D peuvent s'exécuter en parallèle une fois A livré. E et F démarrent quand B, C, D sont validés.

---

## 3. Séquencement

### Vague 0 — Fondations client (teammate A, séquentiel)

**Teammate A** — AuthProvider + hooks RBAC

1. Refactor de `AuthProvider` pour exposer, dans le context, le user avec sa shape cible (issue du contrat-04) : `{ id, email, role: { id, label, templateKey, category, permissions: readonly PermissionCode[] } }`.
    - Source : JWT décodé si les permissions y sont, sinon appel `/api/auth/me` au mount qui retourne le payload enrichi. **Choix final** fixé par le contrat-04 ; Claude Code ne dévie pas.
2. Création du hook `useHasPermission(permission: PermissionCode): boolean` :
    - Signature exacte du contrat-04.
    - Implementation : consomme le context d'auth, retourne `user?.role.permissions.includes(permission) ?? false`.
    - Edge cases : user null → false, permission inconnue (devrait être impossible grâce aux types) → false.
3. Hook complémentaire `useHasAnyPermission(permissions: PermissionCode[]): boolean` et `useHasAllPermissions(permissions: PermissionCode[]): boolean`.
4. Hook `useCurrentRole(): { templateKey, category, label } | null` pour afficher le rôle courant dans l'UI (ex : badge en header).
5. Fichier `apps/web/src/lib/rbac.ts` avec helpers purs (non-hook) utilisables hors composant (ex : `hasPermission(user, perm)` pour logique business).
6. Tests unitaires Jest pour chaque hook, chaque helper (mock du context).
7. **Les composants existants ne sont pas encore migrés** — l'ancien mécanisme (probablement `useAuth().user.role === 'ADMIN'`) reste fonctionnel pendant cette vague.

**Critère fin de vague** : type-check + lint + tests unitaires passent. Aucun composant applicatif modifié.

**Ne pas démarrer Vague 1 avant validation PO.**

### Vague 1 — Migration des consommateurs (parallèle B + C + D)

**Teammate B** — Sidebar

1. Refactor du fichier sidebar identifié en audit §1.4.
2. Remplacement de chaque check `user.role === 'X'` (ou équivalent) par `useHasPermission('module:action')`.
3. Pour chaque item de la sidebar, la **permission contrôlant sa visibilité** est documentée dans un commentaire TSDoc au-dessus de la déclaration de l'item (traçabilité).
4. Gestion gracieuse : si user null (chargement initial), ne rien afficher plutôt qu'un flash de contenu.
5. Test unitaire qui vérifie pour 4 templates différents (ADMIN, MANAGER, BASIC_USER, OBSERVER_FULL) le nombre exact d'items visibles.

**Teammate C** — Checks granulaires pages/components

1. Pour chacun des ~80 points d'intervention listés en audit §1.4, remplacer l'ancien check par `useHasPermission(...)`.
2. **Pattern obligatoire** : un seul hook par composant visible, destructuré en const en haut (`const canCreateTask = useHasPermission('tasks:create')`), réutilisé ensuite. Pas de call inline dans le JSX.
3. Si un composant avait plusieurs checks redondants (ex : même permission vérifiée 3 fois), consolider en un seul.
4. **Priorité** : couvrir d'abord les 10 patterns les plus fréquents identifiés en audit, puis les cas isolés.
5. **Ne pas toucher** aux composants liés à l'admin des rôles (ils disparaissent en Vague 2 via teammate E).

**Teammate D** — Nouvelle page "Gestion des rôles" (galerie)

1. Nouvelle page `apps/web/app/admin/roles/page.tsx`.
2. Composants enfants :
    - `<RoleGallery>` — affiche les 26 cards des templates avec :
        - Filtres par catégorie (9 badges cliquables en toggle multi-select).
        - Recherche texte (match sur `label`, `description`, `templateKey`).
        - Card : badge de catégorie (couleur), libellé par défaut du template, description (1-2 lignes), nombre de permissions, nombre de rôles custom actuellement rattachés (via `GET /api/roles`).
        - Hover → preview panel latéral listant toutes les permissions du template (groupées par module, lecture seule, pas d'interaction).
    - `<CustomRolesList>` — liste des rôles custom créés par l'admin (issus de `GET /api/roles` filtrés sur `isSystem=false`) avec actions Éditer/Supprimer.
    - `<CreateRoleDialog>` — modale de création : input label + select de template (dropdown ou bouton "Choisir depuis la galerie").
    - `<EditRoleDialog>` — même UI, préchargée avec le rôle en cours. Blocage si `isSystem=true`.
    - `<DeleteRoleDialog>` — confirmation. Si users rattachés, affichage de la liste et blocage explicite avec message "Réaffectez ces utilisateurs avant de supprimer ce rôle".
3. Styling aligné sur les conventions existantes (shadcn/ui, Tailwind, icônes Lucide).
4. La page elle-même est protégée par `useHasPermission('users:manage_roles')` — si `false`, redirection `/dashboard`.
5. Toast de confirmation sur chaque action réussie, toast d'erreur sur échec.
6. Tests unitaires Testing Library pour chaque composant majeur.

**Ne pas démarrer Vague 2 avant validation B + C + D.**

### Vague 2 — Nettoyage (teammate E, séquentiel)

**Teammate E** — Suppression ancienne UI admin + composants morts

1. Suppression de l'ancienne page "Gestion des rôles" (chemin identifié en audit §1.5) et de tous ses composants enfants.
2. Suppression des services API clients liés à l'ancien système (`role-configs.service.ts` ou équivalent).
3. Suppression des stores Zustand spécifiques à l'ancienne gestion des permissions s'ils existent.
4. Suppression des types TypeScript obsolètes dans `apps/web/src/types/`.
5. **Grep final** : zéro référence à `role_configs`, `RoleConfig`, `@/services/roleConfigs` (ou équivalents) dans `apps/web/`.
6. Build frontend complet (`pnpm --filter web build`) passe sans warning nouveau.
7. Type-check et lint n'ont pas régressé par rapport au baseline de §1 Phase 0.

### Vague 3 — Tests E2E (teammate F, séquentiel)

**Teammate F** — Tests E2E Playwright RBAC

1. Nouveau dossier `e2e/rbac/` avec les specs :
    - `admin-creates-custom-role.spec.ts` — admin crée un rôle "Stagiaire développement" pointant sur `STAGIAIRE_ALTERNANT`, assigne un user, vérifie que la sidebar dudit user est bien restreinte.
    - `admin-cannot-delete-role-with-users.spec.ts` — tentative de suppression d'un rôle custom avec users rattachés, vérifie le blocage 409 et le message UX.
    - `admin-cannot-modify-system-role.spec.ts` — tentative d'édition d'un rôle `isSystem=true`, vérifie le blocage UI (pas de bouton éditer).
    - `sidebar-differs-by-template.spec.ts` — login avec 4 users de templates différents (ADMIN, MANAGER, BASIC_USER, OBSERVER_FULL), capture la sidebar, assert items visibles.
    - `permission-denied-redirects.spec.ts` — user `BASIC_USER` tente d'accéder à `/admin/roles`, vérifie redirection `/dashboard`.
    - `gallery-filter-search.spec.ts` — vérifie UX de la galerie : filtrage par catégorie, recherche texte.
2. Les specs taggées `@smoke` pour exécution prioritaire (cf. KNOWLEDGE-BASE §11 — PostToolUse hook).
3. **Couverture cible** : au moins 1 scénario E2E par catégorie de template (9 catégories) + les cas d'erreur critiques.
4. Tous les tests passent en local (`pnpm test:e2e`).

### Validation finale

- PO valide chaque livrable de vague avant de passer à la suivante.
- Après Vague 3, session de smoke test en browser manuelle sur environnement staging (pas tâche Claude Code — tâche PO).

---

## 4. Risques identifiés

### Risque 1 — Flash de contenu non autorisé au chargement

Pendant le temps où `AuthProvider` résout le user (JWT decode ou fetch `/api/auth/me`), les hooks retournent `false` par défaut. Mais si un composant est rendu avant résolution avec le user sur `null`, il peut flasher le "contenu pour non-autorisé" (ou pire, le contenu autorisé). **Mitigation** : `AuthProvider` expose un state `isLoading` que les consommateurs peuvent check pour afficher un skeleton / splash écran plutôt que du contenu erroné. Les `useHasPermission` retournent `false` explicitement pendant le loading, ce qui est sécuritaire par défaut (masque plutôt que d'afficher trop).

### Risque 2 — Incohérence front/back après modification de rôle

Un admin change le template d'un rôle custom. Les users rattachés conservent leurs anciennes permissions dans le JWT jusqu'à leur prochain login. **Mitigation** : option A (plus propre) — refresh du JWT invalidé à chaque modification de rôle, les users concernés doivent se relogger (message clair via toast push). Option B (plus UX) — JWT court-lived (15min) + refresh token qui recharge les permissions. Le choix est imposé par le contrat-04. **Claude Code respecte ce choix** et ne réouvre pas le débat.

### Risque 3 — Galerie de 26 cards ergonomiquement lourde

26 cards c'est beaucoup pour une première vision. Sans filtres/recherche bien posés, l'admin se perd. **Mitigation** : filtres par catégorie affichés comme chips horizontales en haut, recherche textuelle prioritaire, et defaults à "Tous les templates". Si le PO trouve la galerie chargée au smoke test, ajustement possible en ticket séparé (hors scope Spec 3) mais **a minima** : filtres doivent être visibles sans scroll à l'ouverture.

### Risque 4 — Régression RBAC silencieuse sur un point isolé

Migrer ~80 checks granulaires est propice aux oublis. Un check manqué signifie un bouton/menu visible à un user qui n'aurait pas dû le voir (ou inversement, caché à un user qui devrait y accéder). **Mitigation** : l'audit §1.4 doit être **exhaustif** — s'il manque un cas, il ne sera pas migré. Les tests E2E couvrent les parcours critiques mais ne peuvent pas tout couvrir. **Recommandation PO** : session de QA manuelle dédiée sur staging avant prod, avec 4-5 users de templates différents, test exploratoire.

### Risque 5 — Performance de la preview de permissions (galerie)

Si la preview latérale fait un appel API à chaque hover, dégradation UX. **Mitigation** : la liste des permissions par template est dérivée de `ROLE_TEMPLATES` côté client (import direct du package partagé). Zéro appel API pour la preview. L'endpoint `/api/roles/templates` n'est appelé qu'une fois au mount de la page.

### Risque 6 — Sidebar recharge à chaque changement de route

Re-render excessif de la sidebar à chaque changement de path peut causer des flashes visuels sur les items conditionnels. **Mitigation** : `useHasPermission` est memoïsé par référence du user (userRef stable tant que l'auth ne change pas). Les items sidebar sont memoïsés à leur tour. Test de performance subjectif en smoke test.

### Risque 7 — Endpoint `/api/roles` inaccessible si user connecté n'a pas `users:manage_roles`

La galerie tente de charger les templates, mais si le user n'a pas la permission, 403. La page est déjà protégée en amont par redirection (§D.4), donc ce cas ne doit pas se produire. Mais si un bug front contourne la redirection, l'UI affichera une erreur confuse. **Mitigation** : redirection en tête de page (guard de route) + fallback error boundary si l'API retourne 403 (message utilisateur clair "Vous n'avez pas les droits pour accéder à cette page").

---

## 5. Critères d'acceptation (Spec 3)

- [ ] Le hook `useHasPermission` fonctionne et est consommé partout où l'ancien système était utilisé.
- [ ] La sidebar affiche uniquement les items autorisés par le template de l'utilisateur connecté (validé sur 4 templates différents).
- [ ] La nouvelle page `/admin/roles` est accessible uniquement aux users avec `users:manage_roles`, redirection sinon.
- [ ] La galerie affiche 26 cards avec filtres par catégorie et recherche fonctionnels.
- [ ] Création, édition, suppression de rôles custom fonctionnent end-to-end (appels API corrects, feedback UX, rafraîchissement de la liste).
- [ ] Tentative de suppression d'un rôle système est bloquée UI (pas de bouton) + back (409 si bypass UI).
- [ ] Tentative de suppression d'un rôle custom avec users rattachés affiche la liste des users et bloque.
- [ ] Aucune référence à l'ancien système RBAC dans `apps/web/` (grep final).
- [ ] Tous les tests unitaires et E2E passent localement.
- [ ] Au moins 6 tests E2E RBAC dans `e2e/rbac/`, taggés `@smoke`.
- [ ] `pnpm --filter web build` passe sans warning nouveau.
- [ ] Type-check et lint n'ont pas régressé par rapport au baseline.
- [ ] Smoke test manuel sur staging validé par PO avec 4 users de templates différents.

---

## 6. Out of scope (Spec 3)

- Modification du backend (géré en Spec 2).
- Migration JWT httpOnly (point de sécurité identifié au niveau global, ticket séparé).
- Documentation utilisateur (guide admin "Comment créer un rôle custom") — ticket séparé.
- Personnalisation avancée de la galerie (drag-and-drop pour réordonner les catégories, etc.) — non demandé.
- Export/import de configurations de rôles custom — non demandé.
- Audit log des modifications de rôles — hors scope, potentiellement critique à discuter en ticket séparé.
- Fallback mobile spécifique de la galerie (responsive basique suffit — pas de bottom-sheet dédié).
- Tests de charge frontend (pas de préoccupation perf à ce stade).