/**
 * contract-02-templates.ts
 *
 * Définition des 26 templates de rôles par composition des atomiques du
 * `contract-01-atomic-permissions.ts`. Source : `rbac-templates-library-design.md`
 * (v3, validée par PO) + ajustements `Po decisions.md` (D4, D5, D6, D7, D11)
 * + précisions PO du 2026-04-19 sur la conséquence du câblage D4 Cat B.
 *
 * Fichier compilable en isolation via le tsconfig local
 * `backlog/rbac-refactor/contract/tsconfig.json`. Pas d'import externe au repo.
 *
 * ════════════════════════════════════════════════════════════════════════
 * §NOTE 1 — Principe post-D4 Cat B : « aucune régression de droit métier »
 * ════════════════════════════════════════════════════════════════════════
 *
 * La décision PO D4 Cat B câble 7 lectures jusqu'ici ouvertes : `comments:read`,
 * `documents:read` (implicite via `:read` déjà présent), `epics:read`,
 * `holidays:read`, `milestones:read`, `school_vacations:read`, `services:read`,
 * `settings:read`. Avant refactor, ces endpoints GET étaient accessibles à
 * tout utilisateur authentifié.
 *
 * Pour préserver l'UX actuelle tout en posant une barrière RBAC explicite :
 *   - Les 6 premières perms (hors `settings:read`) deviennent
 *     **quasi-universelles** → attribuées à tous les templates sauf
 *     `OBSERVER_HR_ONLY` pour les perms liées aux projets (epics, milestones,
 *     comments, documents).
 *   - `settings:read` reste **restreinte** (exclusion des templates "du bas"
 *     par arbitrage PO explicite — cf. §NOTE 3).
 *
 * Règle d'attribution : « si la route était accessible avant le câblage et
 * qu'elle était utilisée par l'UI du template, le template gagne la perm ».
 * Les templates qui n'accèdent pas à l'UI concernée ne gagnent rien.
 *
 * ════════════════════════════════════════════════════════════════════════
 * §NOTE 2 — Impact détaillé par permission D4 Cat B (template × permission)
 * ════════════════════════════════════════════════════════════════════════
 *
 * Légende : ✓ = déjà présent avant refactor | + = gagné par câblage D4 Cat B
 *         | — = exclu (scope ou arbitrage)
 *
 * ┌─────────────────────────┬─────┬─────┬────┬─────┬─────┬──────┬─────┬──────┐
 * │ Template                │ c:r │ d:r │ e:r│ m:r │ h:r │ sv:r │ s:r │ st:r │
 * ├─────────────────────────┼─────┼─────┼────┼─────┼─────┼──────┼─────┼──────┤
 * │ ADMIN                   │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  ✓   │
 * │ ADMIN_DELEGATED         │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  ✓   │
 * │ PORTFOLIO_MANAGER       │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  +   │
 * │ MANAGER                 │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  +   │
 * │ MANAGER_PROJECT_FOCUS   │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  +   │
 * │ MANAGER_HR_FOCUS        │  +  │  +  │  + │  +  │  ✓  │  ✓   │  ✓  │  +   │
 * │ PROJECT_LEAD            │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  —   │
 * │ PROJECT_LEAD_JUNIOR     │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  —   │
 * │ TECHNICAL_LEAD          │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  —   │
 * │ PROJECT_CONTRIBUTOR     │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  —   │
 * │ PROJECT_CONTRIB_LIGHT   │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  —   │
 * │ FUNCTIONAL_REFERENT     │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  —   │
 * │ HR_OFFICER              │  +  │  +  │  + │  +  │  ✓  │  ✓   │  ✓  │  —   │
 * │ HR_OFFICER_LIGHT        │  +  │  +  │  + │  +  │  +  │  +   │  +  │  —   │
 * │ THIRD_PARTY_MANAGER     │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  —   │
 * │ CONTROLLER              │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  ✓   │
 * │ BUDGET_ANALYST          │  +  │  +  │  + │  +  │  +  │  +   │  +  │  +   │
 * │ DATA_ANALYST            │  +  │  +  │  + │  +  │  +  │  +   │  +  │  +   │
 * │ IT_SUPPORT              │  +  │  +  │  + │  +  │  +  │  +   │  +  │  —   │
 * │ IT_INFRASTRUCTURE       │  +  │  +  │  + │  +  │  +  │  +   │  +  │  ✓   │
 * │ OBSERVER_FULL           │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  ✓   │
 * │ OBSERVER_PROJECTS_ONLY  │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  +   │
 * │ OBSERVER_HR_ONLY        │  —  │  —  │  — │  —  │  ✓  │  ✓   │  ✓  │  +   │
 * │ BASIC_USER              │  +  │  +  │  + │  +  │  +  │  +   │  +  │  —   │
 * │ EXTERNAL_PRESTATAIRE    │  ✓  │  ✓  │  ✓ │  ✓  │  ✓  │  ✓   │  ✓  │  —   │
 * │ STAGIAIRE_ALTERNANT     │  +  │  +  │  + │  +  │  +  │  +   │  +  │  —   │
 * └─────────────────────────┴─────┴─────┴────┴─────┴─────┴──────┴─────┴──────┘
 *
 *   c:r = comments:read         d:r = documents:read
 *   e:r = epics:read            m:r = milestones:read
 *   h:r = holidays:read         sv:r = school_vacations:read
 *   s:r = services:read         st:r = settings:read
 *
 * ════════════════════════════════════════════════════════════════════════
 * §NOTE 3 — Arbitrage PO explicite : exclusion de `settings:read`
 * ════════════════════════════════════════════════════════════════════════
 *
 * Arbitrage validé par PO le 2026-04-19 (extension mécanique de D2 zero-trust
 * + bon sens sécurité) :
 *
 * > « `settings:read` n'est PAS une perm quasi-universelle. Aujourd'hui la
 * > route est ouverte à tout user loggué par fail-open, mais ce n'était pas
 * > un droit métier, c'était un accident. Les settings applicatifs peuvent
 * > exposer des infos de configuration interne. »
 *
 * Templates **qui ont** `settings:read` (usage métier légitime) :
 *   ADMIN, ADMIN_DELEGATED, PORTFOLIO_MANAGER, MANAGER, MANAGER_PROJECT_FOCUS,
 *   MANAGER_HR_FOCUS, CONTROLLER, BUDGET_ANALYST, DATA_ANALYST,
 *   IT_INFRASTRUCTURE, OBSERVER_FULL, OBSERVER_PROJECTS_ONLY, OBSERVER_HR_ONLY.
 *
 * Templates **exclus** :
 *   PROJECT_LEAD*, TECHNICAL_LEAD, PROJECT_CONTRIBUTOR*, FUNCTIONAL_REFERENT,
 *   HR_OFFICER, HR_OFFICER_LIGHT, THIRD_PARTY_MANAGER, IT_SUPPORT, BASIC_USER,
 *   EXTERNAL_PRESTATAIRE, STAGIAIRE_ALTERNANT.
 *
 * ════════════════════════════════════════════════════════════════════════
 */

import {
  type PermissionCode,
  CATALOG_PERMISSIONS,
  ANNUAIRE_READ,
  CALENDAR_CONTEXT_READ,
  PROJECT_STRUCTURE_READ,
  COLLABORATION_READ,
  LEAVES_SELF_SERVICE,
  TELEWORK_SELF_SERVICE,
  TIME_TRACKING_SELF_SERVICE,
  EVENTS_SELF_SERVICE,
  EVENTS_DELETE,
  TASKS_READ,
  TASKS_SELF_AUTHORING,
  TASKS_PROJECT_CRUD,
  PROJECTS_CRUD,
  EPICS_MILESTONES_CRUD,
  DOCUMENTS_CRUD,
  COMMENTS_CRUD,
  TIME_TRACKING_EDIT,
  TIME_TRACKING_SCOPE_READ,
  TELEWORK_TEAM_READ,
  LEAVES_MANAGEMENT,
  TASKS_CROSS_ASSIGN,
  REPORTS_FULL,
  PREDEFINED_TASKS_VIEW,
  PREDEFINED_TASKS_ADMIN,
  THIRD_PARTIES_CRUD,
  TIME_TRACKING_FOR_THIRD_PARTY,
  SKILLS_ADMIN,
  SETTINGS_READ,
  USERS_PAGE_ACCESS,
} from './atomic-permissions.ts';

// ============================================================================
// 1. Types : catégories, clés, structure d'un template
// ============================================================================

export type RoleCategoryKey =
  | 'ADMINISTRATION' // A — Rouge (2)
  | 'MANAGEMENT' // B — Orange (4)
  | 'PROJECT' // C — Bleu (6)
  | 'HR_AND_THIRD_PARTIES' // D — Rose (3)
  | 'ANALYTICS' // E — Violet (3)
  | 'IT_OPERATIONS' // F — Cyan (2)
  | 'OBSERVATION' // G — Gris (3)
  | 'STANDARD_USER' // H — Vert (1)
  | 'EXTERNAL'; // I — Jaune (2)

export type RoleTemplateKey =
  // A - ADMINISTRATION
  | 'ADMIN'
  | 'ADMIN_DELEGATED'
  // B - MANAGEMENT
  | 'PORTFOLIO_MANAGER'
  | 'MANAGER'
  | 'MANAGER_PROJECT_FOCUS'
  | 'MANAGER_HR_FOCUS'
  // C - PROJECT
  | 'PROJECT_LEAD'
  | 'PROJECT_LEAD_JUNIOR'
  | 'TECHNICAL_LEAD'
  | 'PROJECT_CONTRIBUTOR'
  | 'PROJECT_CONTRIBUTOR_LIGHT'
  | 'FUNCTIONAL_REFERENT'
  // D - HR_AND_THIRD_PARTIES
  | 'HR_OFFICER'
  | 'HR_OFFICER_LIGHT'
  | 'THIRD_PARTY_MANAGER'
  // E - ANALYTICS
  | 'CONTROLLER'
  | 'BUDGET_ANALYST'
  | 'DATA_ANALYST'
  // F - IT_OPERATIONS
  | 'IT_SUPPORT'
  | 'IT_INFRASTRUCTURE'
  // G - OBSERVATION
  | 'OBSERVER_FULL'
  | 'OBSERVER_PROJECTS_ONLY'
  | 'OBSERVER_HR_ONLY'
  // H - STANDARD_USER
  | 'BASIC_USER'
  // I - EXTERNAL
  | 'EXTERNAL_PRESTATAIRE'
  | 'STAGIAIRE_ALTERNANT';

export interface RoleTemplate {
  readonly key: RoleTemplateKey;
  readonly defaultLabel: string;
  readonly category: RoleCategoryKey;
  readonly description: string;
  readonly permissions: readonly PermissionCode[];
}

// ============================================================================
// 2. Helpers de composition
// ============================================================================

function dedupe<T>(codes: readonly T[]): readonly T[] {
  return Array.from(new Set(codes));
}

function without(
  source: readonly PermissionCode[],
  exclude: readonly PermissionCode[],
): readonly PermissionCode[] {
  const excludeSet = new Set<PermissionCode>(exclude);
  return source.filter((p) => !excludeSet.has(p));
}

function compose(
  ...sets: readonly (readonly PermissionCode[])[]
): readonly PermissionCode[] {
  const acc: PermissionCode[] = [];
  for (const s of sets) acc.push(...s);
  return dedupe(acc);
}

// ============================================================================
// 3. Atomiques composites réutilisées par plusieurs templates
// ============================================================================

/**
 * Socle commun à tous les templates sauf `OBSERVER_HR_ONLY`.
 *
 * Contient :
 *   - `ANNUAIRE_READ` : users:read, departments:read, services:read
 *   - `CALENDAR_CONTEXT_READ` : holidays:read, school_vacations:read
 *   - `COLLABORATION_READ` : comments:read, documents:read, epics:read,
 *                             milestones:read (quasi-universelles D4 Cat B)
 *   - `PREDEFINED_TASKS_VIEW` : predefined_tasks:view
 *
 * Taille : 10 permissions.
 *
 * Note : `settings:read` n'est PAS inclus (cf. §NOTE 3 — restreint aux
 * templates qualifiés).
 */
const COMMON_BASE = compose(
  ANNUAIRE_READ,
  CALENDAR_CONTEXT_READ,
  COLLABORATION_READ,
  PREDEFINED_TASKS_VIEW,
);

/**
 * Socle self-service standard : droits d'action de base sur ses propres
 * congés, télétravail, temps, événements, tâches orphelines + lecture tâches.
 * Taille : 18 permissions.
 */
const STANDARD_SELF_SERVICE = compose(
  LEAVES_SELF_SERVICE,
  TELEWORK_SELF_SERVICE,
  TIME_TRACKING_SELF_SERVICE,
  EVENTS_SELF_SERVICE,
  TASKS_READ,
  TASKS_SELF_AUTHORING,
);

/**
 * Base contributeur = COMMON_BASE + STANDARD_SELF_SERVICE. Socle commun des
 * templates à scope projet.
 */
const STANDARD_CONTRIBUTOR_BASE = compose(COMMON_BASE, STANDARD_SELF_SERVICE);

/**
 * Capacités standards d'un contributeur projet.
 */
const PROJECT_CONTRIB_CAPACITIES = compose(
  PROJECT_STRUCTURE_READ,
  PROJECTS_CRUD,
  EPICS_MILESTONES_CRUD,
  TASKS_PROJECT_CRUD,
  DOCUMENTS_CRUD,
  COMMENTS_CRUD,
  TIME_TRACKING_EDIT,
  EVENTS_DELETE,
);

// ============================================================================
// 4. Définition des 26 templates
// ============================================================================

export const ROLE_TEMPLATES: Record<RoleTemplateKey, RoleTemplate> = {
  // ==========================================================================
  // A — ADMINISTRATION (2)
  // ==========================================================================

  /**
   * Cluster 1 actuel (ADMIN) — 107 permissions (= catalogue complet).
   * Inclut `documents:manage_any` (D6 #4).
   */
  ADMIN: {
    key: 'ADMIN',
    defaultLabel: 'Administrateur',
    category: 'ADMINISTRATION',
    description:
      'Accès total, incluant configuration système et gestion des rôles.',
    permissions: CATALOG_PERMISSIONS,
  },

  /**
   * Cluster 2 actuel (RESPONSABLE). ADMIN moins gestion des rôles, moins
   * paramétrage système (settings:update), moins scope global congés.
   * Inclut `documents:manage_any` (D6 #4).
   *
   * Correction PO 2026-04-19 : conserve `holidays:create/update/delete`
   * (préservation stricte des droits de RESPONSABLE actuel — cf. matrice
   * ROLES-PERMISSIONS.md où RESPONSABLE ✅ sur holidays:*).
   *
   * Ne possède PAS `leaves:manage_any` (scope périmètre préservé — cf. memory
   * project_responsable_scope_perimeter : seul ADMIN a l'accès global congés).
   *
   * Total : 104 permissions (= 107 catalogue moins `users:manage_roles`,
   * `settings:update`, `leaves:manage_any`).
   */
  ADMIN_DELEGATED: {
    key: 'ADMIN_DELEGATED',
    defaultLabel: 'Directeur adjoint',
    category: 'ADMINISTRATION',
    description:
      'Direction opérationnelle de haut niveau sans droits de paramétrage système ni de gestion RBAC.',
    permissions: without(CATALOG_PERMISSIONS, [
      'users:manage_roles',
      'settings:update',
      'leaves:manage_any', // Scope périmètre préservé (memory)
    ]),
  },

  // ==========================================================================
  // B — MANAGEMENT (4)
  // ==========================================================================

  /**
   * PMO / architecte senior : MANAGER + bypass projets/tasks/events, SANS
   * scope RH. +settings:read (qualifié §NOTE 3).
   *
   * Correction PO 2026-04-19 : gagne `time_tracking:declare_for_third_party`
   * (un PMO supervise des portefeuilles incluant des prestataires, cohérent
   * avec les CRUD tiers déjà attribués).
   */
  PORTFOLIO_MANAGER: {
    key: 'PORTFOLIO_MANAGER',
    defaultLabel: 'Manager de portefeuille',
    category: 'MANAGEMENT',
    description:
      'Supervision transversale multi-projets avec bypass OwnershipGuard. PMO / architecte senior. Sans autorité RH.',
    permissions: compose(
      STANDARD_CONTRIBUTOR_BASE,
      PROJECT_CONTRIB_CAPACITIES,
      REPORTS_FULL,
      TIME_TRACKING_SCOPE_READ,
      TIME_TRACKING_FOR_THIRD_PARTY, // Correction PO 2026-04-19
      PREDEFINED_TASKS_ADMIN,
      TASKS_CROSS_ASSIGN,
      THIRD_PARTIES_CRUD,
      SETTINGS_READ, // §NOTE 3
      [
        'projects:manage_any',
        'tasks:manage_any',
        'events:manage_any',
        'telework:read_team',
      ],
    ),
  },

  /**
   * Cluster 3 actuel (MANAGER) — management d'équipe complet.
   * +settings:read (§NOTE 3). +skills:read (via PROJECT_STRUCTURE_READ).
   *
   * Corrections PO 2026-04-19 :
   *   - `users:manage` (via USERS_PAGE_ACCESS) — préservation du droit
   *     historique d'accéder à la page admin des utilisateurs, SANS gagner
   *     le CRUD (USERS_CRUD reste réservé à ADMIN/ADMIN_DELEGATED).
   *   - `time_tracking:declare_for_third_party` — régression historique à
   *     corriger (MANAGER a toujours pu saisir du temps pour un tiers).
   */
  MANAGER: {
    key: 'MANAGER',
    defaultLabel: 'Manager',
    category: 'MANAGEMENT',
    description:
      "Management d'équipe complet : projets, tâches, congés, télétravail, membres.",
    permissions: compose(
      STANDARD_CONTRIBUTOR_BASE,
      PROJECT_CONTRIB_CAPACITIES,
      LEAVES_MANAGEMENT,
      TELEWORK_TEAM_READ,
      TIME_TRACKING_SCOPE_READ,
      TIME_TRACKING_FOR_THIRD_PARTY, // Correction PO 2026-04-19
      REPORTS_FULL,
      PREDEFINED_TASKS_ADMIN,
      TASKS_CROSS_ASSIGN,
      THIRD_PARTIES_CRUD,
      USERS_PAGE_ACCESS, // Correction PO 2026-04-19 (users:manage sans CRUD)
      SETTINGS_READ, // §NOTE 3
      [
        'telework:manage_any', // D7 rename
        'tasks:manage_any', // memory: MANAGER a tasks:manage_any (cluster 3)
      ],
    ),
  },

  /**
   * Chef de programme sans équipe directe. MANAGER moins scope RH.
   * +settings:read (§NOTE 3).
   */
  MANAGER_PROJECT_FOCUS: {
    key: 'MANAGER_PROJECT_FOCUS',
    defaultLabel: 'Manager projet',
    category: 'MANAGEMENT',
    description:
      'Management centré projets, sans autorité RH. Chef de programme sans équipe directe.',
    permissions: without(DRAFT_MANAGER(), [
      'leaves:approve',
      'leaves:manage',
      'leaves:declare_for_others',
      'leaves:manage_delegations',
      'leaves:update',
      'leaves:delete',
      'telework:manage_any',
    ]),
  },

  /**
   * Chef de service : MANAGER centré RH. +D4 Cat B gains (comments/documents/
   * epics/milestones:read quasi-universal). +settings:read (§NOTE 3).
   */
  MANAGER_HR_FOCUS: {
    key: 'MANAGER_HR_FOCUS',
    defaultLabel: 'Chef de service',
    category: 'MANAGEMENT',
    description:
      'Management centré ressources humaines, sans delivery projet. Chef de service.',
    permissions: compose(
      STANDARD_CONTRIBUTOR_BASE,
      LEAVES_MANAGEMENT,
      TELEWORK_TEAM_READ,
      TIME_TRACKING_SCOPE_READ,
      PREDEFINED_TASKS_ADMIN,
      REPORTS_FULL,
      SETTINGS_READ, // §NOTE 3
      [
        'telework:manage_any', // D7
      ],
    ),
  },

  // ==========================================================================
  // C — PROJECT (6)
  // ==========================================================================

  /**
   * Cluster 4 actuel (CHEF_DE_PROJET).
   * Note : PAS de `settings:read` (§NOTE 3 — exclu des templates project-only).
   *
   * Correction PO 2026-04-19 : gagne `time_tracking:declare_for_third_party`
   * (un CHEF_DE_PROJET gère des tiers sur ses projets et déclare leur temps).
   * Propagé automatiquement à PROJECT_LEAD_JUNIOR via `DRAFT_PROJECT_LEAD()`.
   */
  PROJECT_LEAD: {
    key: 'PROJECT_LEAD',
    defaultLabel: 'Chef de projet',
    category: 'PROJECT',
    description:
      'Chef de projet confirmé : CRUD projet complet + gestion des membres.',
    permissions: compose(
      STANDARD_CONTRIBUTOR_BASE,
      PROJECT_CONTRIB_CAPACITIES,
      REPORTS_FULL,
      THIRD_PARTIES_CRUD,
      TIME_TRACKING_FOR_THIRD_PARTY, // Correction PO 2026-04-19
      [
        'telework:manage_any', // D7
      ],
    ),
  },

  /**
   * PROJECT_LEAD moins projects:create/delete/manage_members.
   */
  PROJECT_LEAD_JUNIOR: {
    key: 'PROJECT_LEAD_JUNIOR',
    defaultLabel: 'Chef de projet junior',
    category: 'PROJECT',
    description: 'Chef de projet en montée en compétence.',
    permissions: without(DRAFT_PROJECT_LEAD(), [
      'projects:create',
      'projects:delete',
      'projects:manage_members',
    ]),
  },

  /**
   * Cluster 6 actuel (REFERENT_TECHNIQUE).
   */
  TECHNICAL_LEAD: {
    key: 'TECHNICAL_LEAD',
    defaultLabel: 'Référent technique',
    category: 'PROJECT',
    description:
      'Référent technique dans les projets : création/modification tâches sans gestion de projet.',
    permissions: compose(
      STANDARD_CONTRIBUTOR_BASE,
      PROJECT_STRUCTURE_READ,
      DOCUMENTS_CRUD,
      COMMENTS_CRUD,
      TIME_TRACKING_EDIT,
      EVENTS_DELETE,
      SKILLS_ADMIN,
      [
        'tasks:create_in_project',
      ],
    ),
  },

  /**
   * Cluster 5 actuel (CHARGE_DE_MISSION, CONSULTANT_TECHNOLOGIE_SI, etc.).
   */
  PROJECT_CONTRIBUTOR: {
    key: 'PROJECT_CONTRIBUTOR',
    defaultLabel: 'Contributeur projet',
    category: 'PROJECT',
    description:
      'Contributeur projet actif : pattern couteau suisse (couvre les 4 libellés UCANSS actuels).',
    permissions: compose(
      STANDARD_CONTRIBUTOR_BASE,
      PROJECT_CONTRIB_CAPACITIES,
      [
        'telework:manage_any', // D7
      ],
    ),
  },

  /**
   * Contributeur à scope réduit.
   */
  PROJECT_CONTRIBUTOR_LIGHT: {
    key: 'PROJECT_CONTRIBUTOR_LIGHT',
    defaultLabel: 'Contributeur projet junior',
    category: 'PROJECT',
    description: 'Contributeur au scope réduit. Équipes juniors encadrées.',
    permissions: without(DRAFT_PROJECT_CONTRIB(), [
      'projects:update', // =ex projects:edit D4 A
      'projects:delete',
      'epics:create',
      'epics:delete',
      'milestones:create',
      'milestones:delete',
      'telework:manage_any', // =ex telework:manage_others D7
      'tasks:delete',
    ]),
  },

  /**
   * Référent fonctionnel applicatif.
   */
  FUNCTIONAL_REFERENT: {
    key: 'FUNCTIONAL_REFERENT',
    defaultLabel: 'Référent fonctionnel',
    category: 'PROJECT',
    description:
      "Référent fonctionnel applicatif : expertise métier sans écriture sur la structure projet.",
    permissions: without(DRAFT_PROJECT_CONTRIB(), [
      'projects:create',
      'projects:delete',
      'projects:update',
      'epics:create',
      'epics:update',
      'epics:delete',
      'milestones:create',
      'milestones:update',
      'milestones:delete',
      'tasks:create',
      'tasks:create_in_project',
      'tasks:delete',
      'telework:manage_any',
    ]),
  },

  // ==========================================================================
  // D — HR_AND_THIRD_PARTIES (3)
  // ==========================================================================

  /**
   * Gestionnaire RH avec pouvoir d'approbation. Pas de scope projet.
   * +D4 Cat B quasi-universal (comments/documents/epics/milestones:read via
   * COMMON_BASE).
   * +gestion holidays/school_vacations (write complet).
   * Pas de `settings:read` (§NOTE 3).
   */
  HR_OFFICER: {
    key: 'HR_OFFICER',
    defaultLabel: 'Gestionnaire RH',
    category: 'HR_AND_THIRD_PARTIES',
    description: "Gestionnaire RH avec pouvoir d'approbation.",
    permissions: compose(
      COMMON_BASE,
      LEAVES_SELF_SERVICE,
      TELEWORK_SELF_SERVICE,
      TIME_TRACKING_SELF_SERVICE,
      LEAVES_MANAGEMENT,
      TELEWORK_TEAM_READ,
      PREDEFINED_TASKS_ADMIN,
      [
        'telework:manage_any', // D7
        'holidays:create',
        'holidays:update',
        'holidays:delete',
        'school_vacations:create',
        'school_vacations:update',
        'school_vacations:delete',
      ],
    ),
  },

  /**
   * RH junior / assistant RH, sans pouvoir d'approbation.
   */
  HR_OFFICER_LIGHT: {
    key: 'HR_OFFICER_LIGHT',
    defaultLabel: 'Assistant RH',
    category: 'HR_AND_THIRD_PARTIES',
    description: "RH junior / assistant RH, sans pouvoir d'approbation.",
    permissions: compose(
      COMMON_BASE,
      LEAVES_SELF_SERVICE,
      TELEWORK_SELF_SERVICE,
      TIME_TRACKING_SELF_SERVICE,
    ),
  },

  /**
   * Gestionnaire de prestataires/tiers.
   * Dérive de PROJECT_CONTRIBUTOR_LIGHT + third_parties:* complet +
   * time_tracking:declare_for_third_party.
   */
  THIRD_PARTY_MANAGER: {
    key: 'THIRD_PARTY_MANAGER',
    defaultLabel: 'Gestionnaire prestataires',
    category: 'HR_AND_THIRD_PARTIES',
    description: 'Gestionnaire de prestataires/tiers.',
    permissions: compose(
      DRAFT_PROJECT_CONTRIB_LIGHT(),
      THIRD_PARTIES_CRUD,
      TIME_TRACKING_FOR_THIRD_PARTY,
    ),
  },

  // ==========================================================================
  // E — ANALYTICS (3) — tous utilisent reports:* (D5, pas analytics:*)
  // ==========================================================================

  /**
   * Contrôle de gestion : vue large en lecture. +settings:read (§NOTE 3 —
   * déjà historique).
   */
  CONTROLLER: {
    key: 'CONTROLLER',
    defaultLabel: 'Contrôleur de gestion',
    category: 'ANALYTICS',
    description:
      'Contrôle de gestion : vue large en lecture sur tous les pans opérationnels.',
    permissions: compose(
      COMMON_BASE,
      PROJECT_STRUCTURE_READ,
      SETTINGS_READ, // §NOTE 3
      [
        'events:read',
        'events:readAll',
        'leaves:read',
        'leaves:readAll',
        'telework:read',
        'telework:readAll',
        'tasks:read',
        'tasks:readAll',
        'time_tracking:read',
        'time_tracking:read_reports',
        'time_tracking:view_any',
      ],
      REPORTS_FULL,
    ),
  },

  /**
   * Analyste budgétaire. +settings:read (§NOTE 3).
   */
  BUDGET_ANALYST: {
    key: 'BUDGET_ANALYST',
    defaultLabel: 'Analyste budgétaire',
    category: 'ANALYTICS',
    description: 'Analyste budgétaire centré temps/coûts.',
    permissions: compose(
      COMMON_BASE,
      SETTINGS_READ, // §NOTE 3
      [
        'projects:read',
        'time_tracking:read',
        'time_tracking:read_reports',
        'time_tracking:view_any',
      ],
      REPORTS_FULL,
    ),
  },

  /**
   * BI/analytics pur. +settings:read (§NOTE 3).
   */
  DATA_ANALYST: {
    key: 'DATA_ANALYST',
    defaultLabel: 'Analyste données',
    category: 'ANALYTICS',
    description: 'BI/analytics pur, sans lien opérationnel.',
    permissions: compose(
      COMMON_BASE,
      SETTINGS_READ, // §NOTE 3
      ['projects:read'],
      REPORTS_FULL,
    ),
  },

  // ==========================================================================
  // F — IT_OPERATIONS (2)
  // ==========================================================================

  /**
   * Support technique utilisateurs. Pas de `settings:read` (§NOTE 3).
   */
  IT_SUPPORT: {
    key: 'IT_SUPPORT',
    defaultLabel: 'Technicien support',
    category: 'IT_OPERATIONS',
    description: 'Support technique utilisateurs.',
    permissions: compose(
      COMMON_BASE,
      LEAVES_SELF_SERVICE,
      TELEWORK_SELF_SERVICE,
      TIME_TRACKING_SELF_SERVICE,
      EVENTS_SELF_SERVICE,
      TASKS_READ,
      TASKS_SELF_AUTHORING,
    ),
  },

  /**
   * Équipe exploitation / infrastructure. +settings:read (§NOTE 3).
   */
  IT_INFRASTRUCTURE: {
    key: 'IT_INFRASTRUCTURE',
    defaultLabel: 'Équipe infrastructure',
    category: 'IT_OPERATIONS',
    description: 'Équipe exploitation / infrastructure.',
    permissions: compose(
      COMMON_BASE,
      LEAVES_SELF_SERVICE,
      TELEWORK_SELF_SERVICE,
      TIME_TRACKING_SELF_SERVICE,
      EVENTS_SELF_SERVICE,
      TASKS_READ,
      TASKS_SELF_AUTHORING,
      SETTINGS_READ, // §NOTE 3
      [
        'holidays:create',
        'holidays:update',
        'school_vacations:create',
        'school_vacations:update',
      ],
    ),
  },

  // ==========================================================================
  // G — OBSERVATION (3)
  // ==========================================================================

  /**
   * Cluster 7 actuel (OBSERVATEUR). PO D11 : volontairement large (settings,
   * users en lecture).
   */
  OBSERVER_FULL: {
    key: 'OBSERVER_FULL',
    defaultLabel: 'Observateur global',
    category: 'OBSERVATION',
    description:
      'Observateur global en lecture seule sur tout le périmètre métier. Volontairement large — inclut settings:read et users:read.',
    permissions: compose(
      ANNUAIRE_READ,
      CALENDAR_CONTEXT_READ,
      PROJECT_STRUCTURE_READ, // inclut COLLABORATION_READ + projects/skills/third_parties
      PREDEFINED_TASKS_VIEW,
      SETTINGS_READ, // §NOTE 3 (historique)
      [
        'events:read',
        'events:readAll',
        'leaves:read',
        'leaves:readAll',
        'telework:read',
        'telework:readAll',
        'tasks:read',
        'tasks:readAll',
        'time_tracking:read',
        'reports:view',
      ],
    ),
  },

  /**
   * Sponsor / comité de pilotage. +settings:read (§NOTE 3).
   */
  OBSERVER_PROJECTS_ONLY: {
    key: 'OBSERVER_PROJECTS_ONLY',
    defaultLabel: 'Sponsor projet',
    category: 'OBSERVATION',
    description: 'Observation limitée au scope projets (sponsor, COPIL).',
    permissions: compose(
      ANNUAIRE_READ,
      CALENDAR_CONTEXT_READ,
      PROJECT_STRUCTURE_READ,
      PREDEFINED_TASKS_VIEW,
      SETTINGS_READ, // §NOTE 3
      [
        'events:read',
        'events:readAll',
        'tasks:read',
        'tasks:readAll',
        'time_tracking:read',
        'reports:view',
      ],
    ),
  },

  /**
   * Audit social / direction sociale. Scope RH uniquement, pas de lectures
   * projet (comments/documents/epics/milestones). +settings:read (§NOTE 3).
   */
  OBSERVER_HR_ONLY: {
    key: 'OBSERVER_HR_ONLY',
    defaultLabel: 'Audit social',
    category: 'OBSERVATION',
    description: 'Observation limitée au scope RH (audit social, direction sociale).',
    permissions: compose(
      ANNUAIRE_READ,
      CALENDAR_CONTEXT_READ,
      PREDEFINED_TASKS_VIEW,
      SETTINGS_READ, // §NOTE 3
      [
        'leaves:read',
        'leaves:readAll',
        'telework:read',
        'telework:readAll',
        'time_tracking:read',
        'reports:view',
      ],
    ),
  },

  // ==========================================================================
  // H — STANDARD_USER (1)
  // ==========================================================================

  /**
   * Cluster 8 actuel (CONTRIBUTEUR et 4 libellés IML).
   * Gagne D4 Cat B quasi-universal (comments/documents/epics/milestones:read
   * via COMMON_BASE) + holidays/school_vacations/services:read (via
   * COMMON_BASE).
   * Pas de `settings:read` (§NOTE 3).
   */
  BASIC_USER: {
    key: 'BASIC_USER',
    defaultLabel: 'Utilisateur standard',
    category: 'STANDARD_USER',
    description:
      'Utilisateur standard : self-service complet (congés, télétravail, time tracking, tâches orphelines).',
    permissions: compose(COMMON_BASE, STANDARD_SELF_SERVICE),
  },

  // ==========================================================================
  // I — EXTERNAL (2)
  // ==========================================================================

  /**
   * Prestataire externe temporaire. Pas de `settings:read` (§NOTE 3).
   */
  EXTERNAL_PRESTATAIRE: {
    key: 'EXTERNAL_PRESTATAIRE',
    defaultLabel: 'Prestataire externe',
    category: 'EXTERNAL',
    description: 'Prestataire externe temporaire (consultant facturable).',
    permissions: compose(
      without(DRAFT_PROJECT_CONTRIB_LIGHT(), [
        'users:read',
        'events:create',
        'events:delete',
        'events:update',
      ]),
      TIME_TRACKING_FOR_THIRD_PARTY,
    ),
  },

  /**
   * Stagiaire ou alternant encadré. Pas de `settings:read` (§NOTE 3).
   */
  STAGIAIRE_ALTERNANT: {
    key: 'STAGIAIRE_ALTERNANT',
    defaultLabel: 'Stagiaire / alternant',
    category: 'EXTERNAL',
    description: 'Stagiaire ou alternant encadré, scope très réduit.',
    permissions: compose(
      without(
        compose(COMMON_BASE, STANDARD_SELF_SERVICE),
        ['events:create', 'events:update', 'telework:delete'],
      ),
      [
        'comments:create',
        'comments:update',
      ],
    ),
  },
};

// ============================================================================
// 5. Helpers de dérivation (DRAFT_*) — pour les templates dérivés de pivots
// ============================================================================

function DRAFT_MANAGER(): readonly PermissionCode[] {
  // Doit rester synchronisé avec ROLE_TEMPLATES.MANAGER. Toute perm ajoutée à
  // MANAGER doit être répercutée ici pour que MANAGER_PROJECT_FOCUS (dérivé)
  // en hérite.
  return compose(
    STANDARD_CONTRIBUTOR_BASE,
    PROJECT_CONTRIB_CAPACITIES,
    LEAVES_MANAGEMENT,
    TELEWORK_TEAM_READ,
    TIME_TRACKING_SCOPE_READ,
    TIME_TRACKING_FOR_THIRD_PARTY, // Correction PO 2026-04-19
    REPORTS_FULL,
    PREDEFINED_TASKS_ADMIN,
    TASKS_CROSS_ASSIGN,
    THIRD_PARTIES_CRUD,
    USERS_PAGE_ACCESS, // Correction PO 2026-04-19
    SETTINGS_READ,
    ['telework:manage_any', 'tasks:manage_any'],
  );
}

function DRAFT_PROJECT_LEAD(): readonly PermissionCode[] {
  // Doit rester synchronisé avec ROLE_TEMPLATES.PROJECT_LEAD. Toute perm
  // ajoutée à PROJECT_LEAD doit être répercutée ici pour que
  // PROJECT_LEAD_JUNIOR (dérivé) en hérite.
  return compose(
    STANDARD_CONTRIBUTOR_BASE,
    PROJECT_CONTRIB_CAPACITIES,
    REPORTS_FULL,
    THIRD_PARTIES_CRUD,
    TIME_TRACKING_FOR_THIRD_PARTY, // Correction PO 2026-04-19
    ['telework:manage_any'],
  );
}

function DRAFT_PROJECT_CONTRIB(): readonly PermissionCode[] {
  return compose(
    STANDARD_CONTRIBUTOR_BASE,
    PROJECT_CONTRIB_CAPACITIES,
    ['telework:manage_any'],
  );
}

function DRAFT_PROJECT_CONTRIB_LIGHT(): readonly PermissionCode[] {
  return without(DRAFT_PROJECT_CONTRIB(), [
    'projects:update',
    'projects:delete',
    'epics:create',
    'epics:delete',
    'milestones:create',
    'milestones:delete',
    'telework:manage_any',
    'tasks:delete',
  ]);
}

// ============================================================================
// 6. Export utilitaires (consommation Spec 2 / Spec 3)
// ============================================================================

/**
 * Liste ordonnée des clés de templates (ordre du design doc §4).
 */
export const ROLE_TEMPLATE_KEYS: readonly RoleTemplateKey[] = [
  'ADMIN',
  'ADMIN_DELEGATED',
  'PORTFOLIO_MANAGER',
  'MANAGER',
  'MANAGER_PROJECT_FOCUS',
  'MANAGER_HR_FOCUS',
  'PROJECT_LEAD',
  'PROJECT_LEAD_JUNIOR',
  'TECHNICAL_LEAD',
  'PROJECT_CONTRIBUTOR',
  'PROJECT_CONTRIBUTOR_LIGHT',
  'FUNCTIONAL_REFERENT',
  'HR_OFFICER',
  'HR_OFFICER_LIGHT',
  'THIRD_PARTY_MANAGER',
  'CONTROLLER',
  'BUDGET_ANALYST',
  'DATA_ANALYST',
  'IT_SUPPORT',
  'IT_INFRASTRUCTURE',
  'OBSERVER_FULL',
  'OBSERVER_PROJECTS_ONLY',
  'OBSERVER_HR_ONLY',
  'BASIC_USER',
  'EXTERNAL_PRESTATAIRE',
  'STAGIAIRE_ALTERNANT',
];

/**
 * Table de mapping libellé DB actuel → template cible (design doc §5).
 * Utilisé par la migration (Spec 2 Vague 1) pour backfill `User.roleId`.
 */
export const LEGACY_ROLE_MIGRATION: Record<string, RoleTemplateKey> = {
  ADMIN: 'ADMIN',
  RESPONSABLE: 'ADMIN_DELEGATED',
  MANAGER: 'MANAGER',
  CHEF_DE_PROJET: 'PROJECT_LEAD',
  CHARGE_DE_MISSION: 'PROJECT_CONTRIBUTOR',
  CONSULTANT_TECHNOLOGIE_SI: 'PROJECT_CONTRIBUTOR',
  CORRESPONDANT_FONCTIONNEL_APPLICATION: 'PROJECT_CONTRIBUTOR',
  DEVELOPPEUR_CONCEPTEUR: 'PROJECT_CONTRIBUTOR',
  REFERENT_TECHNIQUE: 'TECHNICAL_LEAD',
  OBSERVATEUR: 'OBSERVER_FULL',
  ADMINISTRATEUR_IML: 'BASIC_USER',
  CONTRIBUTEUR: 'BASIC_USER',
  GESTIONNAIRE_IML: 'BASIC_USER',
  GESTIONNAIRE_PARC: 'BASIC_USER',
  TECHNICIEN_SUPPORT: 'BASIC_USER',
};

/**
 * Table inverse : template → libellés DB actuels rattachés à sa migration.
 */
export const TEMPLATE_TO_LEGACY_LABELS: Record<
  RoleTemplateKey,
  readonly string[]
> = (() => {
  const out: Partial<Record<RoleTemplateKey, string[]>> = {};
  for (const [legacy, target] of Object.entries(LEGACY_ROLE_MIGRATION) as [
    string,
    RoleTemplateKey,
  ][]) {
    if (!out[target]) out[target] = [];
    out[target]!.push(legacy);
  }
  const finalOut: Record<RoleTemplateKey, readonly string[]> = {} as Record<
    RoleTemplateKey,
    readonly string[]
  >;
  for (const key of ROLE_TEMPLATE_KEYS) {
    finalOut[key] = out[key] ?? [];
  }
  return finalOut;
})();
