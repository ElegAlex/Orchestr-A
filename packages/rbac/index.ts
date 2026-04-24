// packages/rbac — Source de vérité du catalogue RBAC d'Orchestr'A.
//
// Ce package est consommé par :
//   - apps/api : PermissionsService résout role.code → templateKey →
//     ROLE_TEMPLATES[templateKey].permissions.
//   - apps/web : usePermissions hook + composants RBAC (Spec 3).
//   - packages/database/prisma/seed.ts : seed des 26 rôles système (V0).
//
// Conformité : Phase 1 Spec 1 (5 contrats) + arbitrages PO 2026-04-19.
// Toute modification du catalogue passe par PR + validation de Phase 1.

export type { PermissionCode } from "./atomic-permissions.ts";

export {
  CATALOG_PERMISSIONS,
  // Atomiques composables
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
  OWNERSHIP_BYPASS_ALL,
  TIME_TRACKING_SCOPE_READ,
  TELEWORK_TEAM_READ,
  LEAVES_MANAGEMENT,
  LEAVES_GLOBAL,
  TASKS_CROSS_ASSIGN,
  REPORTS_FULL,
  PREDEFINED_TASKS_VIEW,
  PREDEFINED_TASKS_ADMIN,
  PREDEFINED_TASKS_STATUS_OWN,
  PLANNING_ACTIVITY,
  THIRD_PARTIES_CRUD,
  TIME_TRACKING_FOR_THIRD_PARTY,
  SKILLS_ADMIN,
  USERS_PAGE_ACCESS,
  USERS_CRUD,
  SYSTEM_ADMIN_WRITE,
  SETTINGS_READ,
} from "./atomic-permissions.ts";

export type {
  RoleCategoryKey,
  RoleTemplateKey,
  RoleTemplate,
} from "./templates.ts";

export {
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_KEYS,
  LEGACY_ROLE_MIGRATION,
  TEMPLATE_TO_LEGACY_LABELS,
} from "./templates.ts";
