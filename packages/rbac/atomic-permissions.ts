/**
 * contract-01-atomic-permissions.ts
 *
 * Catalogue atomique des permissions RBAC d'Orchestr'A — Phase 1 de la refonte.
 *
 * Portée : ce fichier définit :
 *   (1) le type `PermissionCode` = union stricte des 108 permissions canoniques
 *       du système post-refactor (à rapprocher des 119 actuelles — 10 doublons
 *       :view/:edit supprimés (D4 A), 2 permissions analytics:* supprimées
 *       (D5), 1 permission telework:manage_recurring supprimée (D4 C), 1
 *       permission documents:manage_any ajoutée (D6 #4), 1 permission
 *       telework:manage_others renommée en telework:manage_any (D7), 1
 *       permission comments:manage_any ajoutée (T3 hygiene 2026-04-20 —
 *       remplace le check fantôme `comments:delete_any` absent du catalogue)).
 *   (2) des constantes atomiques `readonly` groupant les permissions par
 *       capacité métier cohérente. Ces atomiques sont les briques utilisées
 *       en `contract-02-templates.ts` pour composer les 26 templates.
 *   (3) le `CATALOG_PERMISSIONS` = liste triée et exhaustive de tous les codes.
 *
 * Ce fichier ne dépend d'aucun module du projet. Il est compilable en isolation
 * via le tsconfig local `backlog/rbac-refactor/contract/tsconfig.json`.
 *
 * Convention :
 *   - Les atomiques sont nommées `CATEGORIE_ACTION` en SCREAMING_SNAKE_CASE.
 *   - Toute atomique est `as const satisfies readonly PermissionCode[]` → le
 *     compilateur garantit que tout typo ou permission retirée du catalogue
 *     casse la Phase 1 au build. Aucun cast.
 *   - Les atomiques "SELF_SERVICE_*" contiennent les droits qu'un utilisateur
 *     exerce sur ses propres ressources.
 *   - Les atomiques "SCOPE_*" sont des droits de lecture étendue (readAll) ou
 *     de bypass ownership (manage_any / manage_others) nécessitant un
 *     périmètre organisationnel (services managés, rôle hiérarchique).
 */

// ============================================================================
// 1. PermissionCode — type union strict (108 entrées)
// ============================================================================

export type PermissionCode =
  // comments (5 — :manage_any ajouté T3 hygiene 2026-04-20)
  | 'comments:create'
  | 'comments:delete'
  | 'comments:manage_any'
  | 'comments:read'
  | 'comments:update'
  // departments (4 — :edit et :view supprimés D4 A)
  | 'departments:create'
  | 'departments:delete'
  | 'departments:read'
  | 'departments:update'
  // documents (5 — :manage_any ajouté D6 #4)
  | 'documents:create'
  | 'documents:delete'
  | 'documents:manage_any'
  | 'documents:read'
  | 'documents:update'
  // epics (4)
  | 'epics:create'
  | 'epics:delete'
  | 'epics:read'
  | 'epics:update'
  // events (6)
  | 'events:create'
  | 'events:delete'
  | 'events:manage_any'
  | 'events:read'
  | 'events:readAll'
  | 'events:update'
  // holidays (4)
  | 'holidays:create'
  | 'holidays:delete'
  | 'holidays:read'
  | 'holidays:update'
  // leaves (10 — :view supprimé D4 A)
  | 'leaves:approve'
  | 'leaves:create'
  | 'leaves:declare_for_others'
  | 'leaves:delete'
  | 'leaves:manage'
  | 'leaves:manage_any'
  | 'leaves:manage_delegations'
  | 'leaves:read'
  | 'leaves:readAll'
  | 'leaves:update'
  // milestones (4)
  | 'milestones:create'
  | 'milestones:delete'
  | 'milestones:read'
  | 'milestones:update'
  // predefined_tasks (5)
  | 'predefined_tasks:assign'
  | 'predefined_tasks:create'
  | 'predefined_tasks:delete'
  | 'predefined_tasks:edit'
  | 'predefined_tasks:view'
  // projects (6 — :edit et :view supprimés D4 A)
  | 'projects:create'
  | 'projects:delete'
  | 'projects:manage_any'
  | 'projects:manage_members'
  | 'projects:read'
  | 'projects:update'
  // reports (2 — remplace analytics:* supprimés D5)
  | 'reports:export'
  | 'reports:view'
  // school_vacations (4)
  | 'school_vacations:create'
  | 'school_vacations:delete'
  | 'school_vacations:read'
  | 'school_vacations:update'
  // services (4)
  | 'services:create'
  | 'services:delete'
  | 'services:read'
  | 'services:update'
  // settings (2)
  | 'settings:read'
  | 'settings:update'
  // skills (5 — :edit et :view supprimés D4 A)
  | 'skills:create'
  | 'skills:delete'
  | 'skills:manage_matrix'
  | 'skills:read'
  | 'skills:update'
  // tasks (9)
  | 'tasks:assign_any_user'
  | 'tasks:create'
  | 'tasks:create_in_project'
  | 'tasks:create_orphan'
  | 'tasks:delete'
  | 'tasks:manage_any'
  | 'tasks:read'
  | 'tasks:readAll'
  | 'tasks:update'
  // telework (7 — :view et :manage_recurring supprimés D4 / :manage_others renommé en :manage_any D7)
  | 'telework:create'
  | 'telework:delete'
  | 'telework:manage_any'
  | 'telework:read'
  | 'telework:readAll'
  | 'telework:read_team'
  | 'telework:update'
  // third_parties (6)
  | 'third_parties:assign_to_project'
  | 'third_parties:assign_to_task'
  | 'third_parties:create'
  | 'third_parties:delete'
  | 'third_parties:read'
  | 'third_parties:update'
  // time_tracking (8)
  | 'time_tracking:create'
  | 'time_tracking:declare_for_third_party'
  | 'time_tracking:delete'
  | 'time_tracking:manage_any'
  | 'time_tracking:read'
  | 'time_tracking:read_reports'
  | 'time_tracking:update'
  | 'time_tracking:view_any'
  // users (8 — :edit et :view supprimés D4 A)
  | 'users:create'
  | 'users:delete'
  | 'users:import'
  | 'users:manage'
  | 'users:manage_roles'
  | 'users:read'
  | 'users:reset_password'
  | 'users:update';

// ============================================================================
// 2. Atomiques — blocs de composition
// ============================================================================

// --- 2.a Annuaire & contexte calendaire (lecture partagée) ---------------

/**
 * Lecture de l'annuaire organisationnel (users, departments, services).
 * Présent dans tous les templates non-EXTERNAL : tout agent a besoin de voir
 * qui est qui et à quel service pour interagir avec le système.
 *
 * Templates consommateurs : BASIC_USER, PROJECT_CONTRIBUTOR_LIGHT,
 * PROJECT_CONTRIBUTOR, FUNCTIONAL_REFERENT, TECHNICAL_LEAD, PROJECT_LEAD_JUNIOR,
 * PROJECT_LEAD, MANAGER_*, PORTFOLIO_MANAGER, HR_OFFICER_LIGHT, HR_OFFICER,
 * THIRD_PARTY_MANAGER, CONTROLLER, BUDGET_ANALYST, DATA_ANALYST, IT_SUPPORT,
 * IT_INFRASTRUCTURE, OBSERVER_*, STAGIAIRE_ALTERNANT, ADMIN_DELEGATED, ADMIN.
 */
export const ANNUAIRE_READ = [
  'users:read',
  'departments:read',
  'services:read',
] as const satisfies readonly PermissionCode[];

/**
 * Lecture du contexte calendaire (jours fériés, vacances scolaires).
 * Nécessaire partout où l'UI affiche un planning ou une date (planning, congés,
 * time-tracking, telework). Pas inclus dans EXTERNAL_PRESTATAIRE qui opère en
 * contexte restreint.
 */
export const CALENDAR_CONTEXT_READ = [
  'holidays:read',
  'school_vacations:read',
] as const satisfies readonly PermissionCode[];

// --- 2.b Lectures projet (épics, milestones, docs, comments) -------------

/**
 * Lecture des éléments de structure projet (epics, milestones, projets,
 * documents, commentaires). Utilisé par tous les rôles qui ont un œil sur
 * l'avancement : contributeurs, managers, observateurs, analytics.
 *
 * Contient à la fois le **socle projet** (projects:read, skills:read,
 * third_parties:read) ET le socle collaboration (comments, documents, epics,
 * milestones). Les templates qui ne veulent pas le scope projet (BASIC_USER,
 * HR_OFFICER, etc.) utilisent à la place `COLLABORATION_READ` seul.
 */
export const PROJECT_STRUCTURE_READ = [
  'projects:read',
  'epics:read',
  'milestones:read',
  'documents:read',
  'comments:read',
  'skills:read',
  'third_parties:read',
] as const satisfies readonly PermissionCode[];

/**
 * Socle "collaboration" : les 4 permissions D4 Cat B considérées
 * **quasi-universelles** par arbitrage PO du 2026-04-19 — à savoir présentes
 * dans tous les templates sauf `OBSERVER_HR_ONLY` (scope audit social, hors
 * lecture projet).
 *
 * Inclut `epics:read` et `milestones:read` car ces artefacts sont
 * commentables/documentables et n'ont pas de sens sans la vue des epics/
 * milestones qui les portent.
 *
 * Templates consommateurs : BASIC_USER, STAGIAIRE_ALTERNANT, HR_OFFICER,
 * HR_OFFICER_LIGHT, IT_SUPPORT, IT_INFRASTRUCTURE, BUDGET_ANALYST,
 * DATA_ANALYST. Les templates à scope projet utilisent `PROJECT_STRUCTURE_READ`
 * qui inclut déjà ces 4 permissions.
 */
export const COLLABORATION_READ = [
  'comments:read',
  'documents:read',
  'epics:read',
  'milestones:read',
] as const satisfies readonly PermissionCode[];

// --- 2.c Self-service standard --------------------------------------------

/**
 * Droits d'action sur ses propres congés (création). La lecture des siens se
 * fait via `leaves:read` (accès personnel). `leaves:readAll` est séparée car
 * elle étend le scope organisationnel.
 */
export const LEAVES_SELF_SERVICE = [
  'leaves:create',
  'leaves:read',
  'leaves:readAll',
] as const satisfies readonly PermissionCode[];

/**
 * Droits d'action sur son propre télétravail (create/update/delete).
 * `telework:readAll` inclus pour afficher le planning de l'équipe (norme métier).
 */
export const TELEWORK_SELF_SERVICE = [
  'telework:create',
  'telework:update',
  'telework:delete',
  'telework:read',
  'telework:readAll',
] as const satisfies readonly PermissionCode[];

/**
 * Droits d'action sur son propre temps (saisie, consultation).
 */
export const TIME_TRACKING_SELF_SERVICE = [
  'time_tracking:create',
  'time_tracking:read',
] as const satisfies readonly PermissionCode[];

/**
 * Droits d'action sur ses propres événements (création, modification,
 * suppression). `events:readAll` inclus pour vue partagée du planning.
 */
export const EVENTS_SELF_SERVICE = [
  'events:create',
  'events:update',
  'events:read',
  'events:readAll',
] as const satisfies readonly PermissionCode[];

// --- 2.d Tâches ------------------------------------------------------------

/**
 * Lecture des tâches (ses propres + toutes via readAll).
 */
export const TASKS_READ = [
  'tasks:read',
  'tasks:readAll',
] as const satisfies readonly PermissionCode[];

/**
 * Création et modification de tâches orphelines (sans projet).
 * Utilisé par BASIC_USER et tous templates standards.
 */
export const TASKS_SELF_AUTHORING = [
  'tasks:create_orphan',
  'tasks:update',
] as const satisfies readonly PermissionCode[];

/**
 * CRUD complet des tâches dans un contexte projet (création projet, édition,
 * suppression, gestion des assignments).
 */
export const TASKS_PROJECT_CRUD = [
  'tasks:create',
  'tasks:create_in_project',
  'tasks:delete',
] as const satisfies readonly PermissionCode[];

// --- 2.e Projet (épics, milestones, membres) ------------------------------

/**
 * CRUD complet projets (création, édition, suppression, membres).
 */
export const PROJECTS_CRUD = [
  'projects:create',
  'projects:update',
  'projects:delete',
  'projects:manage_members',
] as const satisfies readonly PermissionCode[];

/**
 * CRUD complet epics + milestones.
 */
export const EPICS_MILESTONES_CRUD = [
  'epics:create',
  'epics:update',
  'epics:delete',
  'milestones:create',
  'milestones:update',
  'milestones:delete',
] as const satisfies readonly PermissionCode[];

/**
 * CRUD complet documents (upload, modification, suppression).
 */
export const DOCUMENTS_CRUD = [
  'documents:create',
  'documents:update',
  'documents:delete',
] as const satisfies readonly PermissionCode[];

/**
 * CRUD complet commentaires (écriture, édition, suppression).
 */
export const COMMENTS_CRUD = [
  'comments:create',
  'comments:update',
  'comments:delete',
] as const satisfies readonly PermissionCode[];

/**
 * Time-tracking avancé (modification et suppression des saisies).
 */
export const TIME_TRACKING_EDIT = [
  'time_tracking:update',
  'time_tracking:delete',
] as const satisfies readonly PermissionCode[];

/**
 * Suppression des événements.
 */
export const EVENTS_DELETE = [
  'events:delete',
] as const satisfies readonly PermissionCode[];

// --- 2.f Périmètre management (bypass ownership + scope étendu) ----------

/**
 * Bypass OwnershipGuard pour les 6 resources. Utilisé pour qualifier un rôle
 * "supérieur" qui peut agir sur les ressources d'autrui sans restriction de
 * propriétaire.
 *
 * Note : `documents:manage_any` est introduit par la décision D6 #4 (absent du
 * catalogue actuel mais référencé dans `documents.controller.ts`). Les 5 autres
 * existent déjà. Renommage `telework:manage_others` → `telework:manage_any`
 * selon D7.
 */
export const OWNERSHIP_BYPASS_ALL = [
  'tasks:manage_any',
  'projects:manage_any',
  'events:manage_any',
  'time_tracking:manage_any',
  'telework:manage_any',
  'documents:manage_any',
  'comments:manage_any',
] as const satisfies readonly PermissionCode[];

/**
 * Scope étendu lecture time-tracking (cross-user) et reports associés.
 */
export const TIME_TRACKING_SCOPE_READ = [
  'time_tracking:view_any',
  'time_tracking:read_reports',
] as const satisfies readonly PermissionCode[];

/**
 * Management d'équipe sur télétravail (voir équipe).
 */
export const TELEWORK_TEAM_READ = [
  'telework:read_team',
] as const satisfies readonly PermissionCode[];

/**
 * Management RH de base : approuver/refuser congés, délégations, saisie pour
 * autrui. Le périmètre (services managés) est porté par la logique service, pas
 * par le RBAC — cf. audit-03.
 */
export const LEAVES_MANAGEMENT = [
  'leaves:approve',
  'leaves:manage',
  'leaves:declare_for_others',
  'leaves:update',
  'leaves:delete',
  'leaves:manage_delegations',
] as const satisfies readonly PermissionCode[];

/**
 * Gestion globale des congés (bypass périmètre). Réservée à ADMIN et templates
 * équivalents. Cf. memory `project_responsable_scope_perimeter` : RESPONSABLE
 * reste scoped services.
 */
export const LEAVES_GLOBAL = [
  'leaves:manage_any',
] as const satisfies readonly PermissionCode[];

/**
 * Assignation cross-user sans restriction (tasks).
 */
export const TASKS_CROSS_ASSIGN = [
  'tasks:assign_any_user',
] as const satisfies readonly PermissionCode[];

// --- 2.g Reporting & analytics --------------------------------------------

/**
 * Reporting complet (consultation + export). Seule atomique analytics — les
 * codes `analytics:read`/`analytics:export` sont supprimés D5 (redondants).
 */
export const REPORTS_FULL = [
  'reports:view',
  'reports:export',
] as const satisfies readonly PermissionCode[];

// --- 2.h Tâches prédéfinies (administration) -----------------------------

/**
 * Lecture des templates de tâches prédéfinies (standard pour tout user).
 */
export const PREDEFINED_TASKS_VIEW = [
  'predefined_tasks:view',
] as const satisfies readonly PermissionCode[];

/**
 * Administration des tâches prédéfinies + assignment aux agents.
 */
export const PREDEFINED_TASKS_ADMIN = [
  'predefined_tasks:create',
  'predefined_tasks:edit',
  'predefined_tasks:delete',
  'predefined_tasks:assign',
] as const satisfies readonly PermissionCode[];

// --- 2.i Tiers / prestataires ---------------------------------------------

/**
 * CRUD complet tiers + assignments.
 */
export const THIRD_PARTIES_CRUD = [
  'third_parties:create',
  'third_parties:update',
  'third_parties:delete',
  'third_parties:assign_to_project',
  'third_parties:assign_to_task',
] as const satisfies readonly PermissionCode[];

/**
 * Déclaration de temps pour le compte d'un tiers (prestataire facturable).
 */
export const TIME_TRACKING_FOR_THIRD_PARTY = [
  'time_tracking:declare_for_third_party',
] as const satisfies readonly PermissionCode[];

// --- 2.j Skills / référentiel de compétences ------------------------------

/**
 * Administration de la matrice de compétences (hors référentiel).
 */
export const SKILLS_ADMIN = [
  'skills:create',
  'skills:update',
  'skills:delete',
  'skills:manage_matrix',
] as const satisfies readonly PermissionCode[];

// --- 2.k Administration système -------------------------------------------

/**
 * Accès à la page d'administration des utilisateurs (lister, consulter les
 * détails admin). Ne confère AUCUN droit de mutation — c'est `USERS_CRUD` qui
 * porte création/modification/suppression/import/reset de mot de passe.
 *
 * Atomique séparée de `USERS_CRUD` pour permettre à `MANAGER` de voir la page
 * sans avoir le pouvoir de muter les utilisateurs (correctif PO 2026-04-19 :
 * préservation de `users:manage` sur MANAGER sans lui ouvrir le CRUD).
 */
export const USERS_PAGE_ACCESS = [
  'users:manage',
] as const satisfies readonly PermissionCode[];

/**
 * CRUD complet utilisateurs : création, modification, suppression, import CSV,
 * reset mot de passe. Ne confère PAS l'accès à la page admin (cf.
 * `USERS_PAGE_ACCESS`).
 *
 * `users:manage_roles` (gestion des rattachements rôle → user) n'est pas incluse
 * ici : elle est réservée à ADMIN via `SYSTEM_ADMIN_WRITE`.
 */
export const USERS_CRUD = [
  'users:create',
  'users:update',
  'users:delete',
  'users:import',
  'users:reset_password',
] as const satisfies readonly PermissionCode[];

/**
 * Administration stricte : gestion des rôles (uniquement ADMIN), settings,
 * départements/services, jours fériés, vacances scolaires.
 */
export const SYSTEM_ADMIN_WRITE = [
  'users:manage_roles',
  'settings:update',
  'departments:create',
  'departments:update',
  'departments:delete',
  'services:create',
  'services:update',
  'services:delete',
  'holidays:create',
  'holidays:update',
  'holidays:delete',
  'school_vacations:create',
  'school_vacations:update',
  'school_vacations:delete',
] as const satisfies readonly PermissionCode[];

/**
 * Lecture settings (lecture seule — consultable par ADMIN_DELEGATED et
 * OBSERVER_FULL).
 */
export const SETTINGS_READ = [
  'settings:read',
] as const satisfies readonly PermissionCode[];

// ============================================================================
// 3. CATALOG_PERMISSIONS — source de vérité ordonnée
// ============================================================================

/**
 * Liste exhaustive des 108 permissions canoniques, triée alphabétiquement par
 * `module:action`. Sert de source unique pour :
 *   - le seed DB (Spec 2 Vague 0) ;
 *   - la génération de migrations (drop permissions mortes, rename
 *     telework:manage_others → telework:manage_any, add documents:manage_any) ;
 *   - la validation anti-régression en CI.
 *
 * Toute modification de `PermissionCode` doit être répercutée ici (et vice-versa).
 * Le compilateur garantit la cohérence via `satisfies`.
 */
export const CATALOG_PERMISSIONS = [
  // comments
  'comments:create',
  'comments:delete',
  'comments:manage_any',
  'comments:read',
  'comments:update',
  // departments
  'departments:create',
  'departments:delete',
  'departments:read',
  'departments:update',
  // documents
  'documents:create',
  'documents:delete',
  'documents:manage_any',
  'documents:read',
  'documents:update',
  // epics
  'epics:create',
  'epics:delete',
  'epics:read',
  'epics:update',
  // events
  'events:create',
  'events:delete',
  'events:manage_any',
  'events:read',
  'events:readAll',
  'events:update',
  // holidays
  'holidays:create',
  'holidays:delete',
  'holidays:read',
  'holidays:update',
  // leaves
  'leaves:approve',
  'leaves:create',
  'leaves:declare_for_others',
  'leaves:delete',
  'leaves:manage',
  'leaves:manage_any',
  'leaves:manage_delegations',
  'leaves:read',
  'leaves:readAll',
  'leaves:update',
  // milestones
  'milestones:create',
  'milestones:delete',
  'milestones:read',
  'milestones:update',
  // predefined_tasks
  'predefined_tasks:assign',
  'predefined_tasks:create',
  'predefined_tasks:delete',
  'predefined_tasks:edit',
  'predefined_tasks:view',
  // projects
  'projects:create',
  'projects:delete',
  'projects:manage_any',
  'projects:manage_members',
  'projects:read',
  'projects:update',
  // reports
  'reports:export',
  'reports:view',
  // school_vacations
  'school_vacations:create',
  'school_vacations:delete',
  'school_vacations:read',
  'school_vacations:update',
  // services
  'services:create',
  'services:delete',
  'services:read',
  'services:update',
  // settings
  'settings:read',
  'settings:update',
  // skills
  'skills:create',
  'skills:delete',
  'skills:manage_matrix',
  'skills:read',
  'skills:update',
  // tasks
  'tasks:assign_any_user',
  'tasks:create',
  'tasks:create_in_project',
  'tasks:create_orphan',
  'tasks:delete',
  'tasks:manage_any',
  'tasks:read',
  'tasks:readAll',
  'tasks:update',
  // telework
  'telework:create',
  'telework:delete',
  'telework:manage_any',
  'telework:read',
  'telework:readAll',
  'telework:read_team',
  'telework:update',
  // third_parties
  'third_parties:assign_to_project',
  'third_parties:assign_to_task',
  'third_parties:create',
  'third_parties:delete',
  'third_parties:read',
  'third_parties:update',
  // time_tracking
  'time_tracking:create',
  'time_tracking:declare_for_third_party',
  'time_tracking:delete',
  'time_tracking:manage_any',
  'time_tracking:read',
  'time_tracking:read_reports',
  'time_tracking:update',
  'time_tracking:view_any',
  // users
  'users:create',
  'users:delete',
  'users:import',
  'users:manage',
  'users:manage_roles',
  'users:read',
  'users:reset_password',
  'users:update',
] as const satisfies readonly PermissionCode[];

/**
 * Vérification de complétude du catalogue : toute valeur de l'union
 * `PermissionCode` doit être présente dans `CATALOG_PERMISSIONS`. Si on retire
 * une permission du catalogue sans la retirer de l'union (ou l'inverse), cette
 * assertion casse le build en Phase 1.
 *
 * Le type `CatalogCheck` est une assertion TypeScript pure (aucun coût
 * runtime). Si la contrainte est violée, le compilateur produit une erreur
 * "Type '...' is not assignable to type 'never'".
 */
type CatalogCheck = Exclude<
  PermissionCode,
  (typeof CATALOG_PERMISSIONS)[number]
> extends never
  ? true
  : ['Missing from CATALOG_PERMISSIONS'];

// Assertion : doit être `true`, sinon compilation échoue
const _catalogCheck: CatalogCheck = true;
void _catalogCheck;

/**
 * Vérification miroir : toute entrée de `CATALOG_PERMISSIONS` doit appartenir à
 * l'union. Assurée intrinsèquement par `satisfies readonly PermissionCode[]`
 * appliqué ci-dessus.
 */
