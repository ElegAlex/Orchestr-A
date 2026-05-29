/**
 * Permission Matrix — Source de vérité pour les tests RBAC E2E.
 *
 * Chaque entrée décrit :
 *  - l'action testée (code permission NestJS)
 *  - la ressource (module)
 *  - la méthode HTTP et l'endpoint API
 *  - les rôles autorisés et interdits, basés sur le seed RBAC (seed.ts)
 *
 * Rôles disponibles dans les tests (6 rôles principaux) :
 *   admin > responsable > manager > referent > contributeur > observateur
 *
 * Mapping rôles → codes RBAC :
 *   admin        → ADMIN           (toutes les permissions)
 *   responsable  → RESPONSABLE     (tout sauf users:manage_roles, settings:update)
 *   manager      → MANAGER         (gestion projets/tâches/congés équipe)
 *   referent     → REFERENT_TECHNIQUE (tâches dans projets, skills, télétravail)
 *   contributeur → CONTRIBUTEUR    (tâches orphelines + gestion personnelle)
 *   observateur  → OBSERVATEUR     (lecture seule — actions read/view)
 */

export interface PermissionEntry {
  /** Code de permission NestJS (ex: 'projects:create') */
  action: string;
  /** Module/ressource concerné (ex: 'projects') */
  resource: string;
  /** Méthode HTTP */
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Endpoint API relatif (ex: '/api/projects') */
  apiEndpoint: string;
  /** Rôles qui DOIVENT avoir accès (réponse != 403) */
  allowedRoles: string[];
  /** Rôles qui DOIVENT être refusés (réponse === 403) */
  deniedRoles: string[];
  /** Body minimal valide pour les POST/PATCH */
  testBody?: Record<string, unknown>;
  /** Description lisible de l'entrée */
  description?: string;
}

// UUID placeholder utilisé pour les endpoints avec :id
// Le test vérifie le statut d'autorisation, pas l'existence de la ressource.
// 404 = autorisé mais ressource absente ; 403 = interdit
const PLACEHOLDER_UUID = "00000000-0000-0000-0000-000000000001";

// UUID v4 valide pour les endpoints utilisant ParseUUIDPipe (version: 4 par défaut).
// Le nil UUID ci-dessus n'étant pas v4, le pipe 400-reject avant le guard d'autorisation.
const PLACEHOLDER_UUID_V4 = "00000000-0000-4000-8000-000000000001";

export const PERMISSION_MATRIX: PermissionEntry[] = [
  // ═══════════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════════
  {
    action: "projects:read",
    resource: "projects",
    method: "GET",
    apiEndpoint: "/api/projects",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description: "Lister les projets — accessible à tous les rôles",
  },
  {
    action: "projects:create",
    resource: "projects",
    method: "POST",
    apiEndpoint: "/api/projects",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      name: "Projet Test RBAC",
      description: "Test de permission",
      status: "ACTIVE",
    },
    description: "Créer un projet — Admin, Responsable, Manager",
  },
  {
    action: "projects:update",
    resource: "projects",
    method: "PATCH",
    apiEndpoint: `/api/projects/${PLACEHOLDER_UUID}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      name: "Projet modifié",
    },
    description: "Modifier un projet — Admin, Responsable, Manager",
  },
  {
    action: "projects:delete",
    resource: "projects",
    method: "DELETE",
    apiEndpoint: `/api/projects/${PLACEHOLDER_UUID}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    description: "Supprimer un projet — Admin, Responsable, Manager",
  },

  // ═══════════════════════════════════════════════════════════
  // TASKS
  // ═══════════════════════════════════════════════════════════
  {
    action: "tasks:read",
    resource: "tasks",
    method: "GET",
    apiEndpoint: "/api/tasks",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description:
      "Lister les tâches — tous les rôles (tasks:read dans tous les seeds)",
  },

  // ═══════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════
  {
    action: "events:read",
    resource: "events",
    method: "GET",
    apiEndpoint: "/api/events",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description:
      "Lister les événements — tous les rôles (events:read dans tous les seeds)",
  },

  // ═══════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════
  {
    action: "users:read",
    resource: "users",
    method: "GET",
    apiEndpoint: "/api/users",
    allowedRoles: ["admin", "responsable", "manager", "observateur"],
    deniedRoles: ["referent", "contributeur"],
    description:
      "Lister les utilisateurs — Admin, Responsable, Manager, Observateur",
  },
  {
    action: "users:create",
    resource: "users",
    method: "POST",
    apiEndpoint: "/api/users",
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
    testBody: {
      login: "test-rbac-user",
      email: "test-rbac@orchestr-a.test",
      firstName: "Test",
      lastName: "RBAC",
      role: "CONTRIBUTEUR",
      password: "Test1234!",
    },
    description: "Créer un utilisateur — Admin, Responsable uniquement",
  },
  {
    action: "users:update",
    resource: "users",
    method: "PATCH",
    apiEndpoint: `/api/users/${PLACEHOLDER_UUID}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
    testBody: {
      firstName: "Modifié",
    },
    description: "Modifier un utilisateur — Admin, Responsable uniquement",
  },

  // ═══════════════════════════════════════════════════════════
  // DEPARTMENTS
  // ═══════════════════════════════════════════════════════════
  {
    action: "departments:read",
    resource: "departments",
    method: "GET",
    apiEndpoint: "/api/departments",
    allowedRoles: ["admin", "responsable", "manager", "observateur"],
    deniedRoles: ["referent", "contributeur"],
    description:
      "Lister les départements — Admin, Responsable, Manager, Observateur",
  },
  {
    action: "departments:create",
    resource: "departments",
    method: "POST",
    apiEndpoint: "/api/departments",
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
    testBody: {
      name: "Département Test RBAC",
      code: "TEST-RBAC",
    },
    description: "Créer un département — Admin, Responsable uniquement",
  },

  // ═══════════════════════════════════════════════════════════
  // SKILLS
  // ═══════════════════════════════════════════════════════════
  {
    action: "skills:read",
    resource: "skills",
    method: "GET",
    apiEndpoint: "/api/skills",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "observateur",
    ],
    deniedRoles: ["contributeur"],
    description:
      "Lister les compétences — Admin, Responsable, Manager, Référent, Observateur",
  },
  {
    action: "skills:create",
    resource: "skills",
    method: "POST",
    apiEndpoint: "/api/skills",
    allowedRoles: ["admin", "responsable", "referent"],
    deniedRoles: ["manager", "contributeur", "observateur"],
    testBody: {
      name: "Compétence Test RBAC",
      category: "TECHNICAL",
    },
    description:
      "Créer une compétence — Admin, Responsable, Référent Technique",
  },

  // ═══════════════════════════════════════════════════════════
  // LEAVES (Congés)
  // ═══════════════════════════════════════════════════════════
  {
    action: "leaves:read",
    resource: "leaves",
    method: "GET",
    apiEndpoint: "/api/leaves",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description:
      "Lister les congés — tous les rôles (filtrage par ownership côté service)",
  },
  {
    action: "leaves:create",
    resource: "leaves",
    method: "POST",
    apiEndpoint: "/api/leaves",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
    ],
    deniedRoles: ["observateur"],
    testBody: {
      leaveTypeId: "lt-cp-001",
      startDate: "2027-08-01T00:00:00Z",
      endDate: "2027-08-05T00:00:00Z",
      reason: "Test RBAC",
    },
    description:
      "Créer une demande de congé — tous sauf Observateur (endpoint sans @Permissions, géré par le service via rôle)",
  },
  {
    action: "leaves:approve",
    resource: "leaves",
    method: "POST",
    apiEndpoint: `/api/leaves/${PLACEHOLDER_UUID}/approve`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      status: "APPROVED",
    },
    description: "Approuver/refuser un congé — Admin, Responsable, Manager",
  },
  {
    action: "leaves:manage",
    resource: "leaves",
    method: "GET",
    apiEndpoint: "/api/leaves/balances",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    description: "Gérer les soldes de congés — Admin, Responsable, Manager",
  },

  // ═══════════════════════════════════════════════════════════
  // TELEWORK (Télétravail)
  // ═══════════════════════════════════════════════════════════
  {
    action: "telework:read",
    resource: "telework",
    method: "GET",
    apiEndpoint: "/api/telework",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description:
      "Lister les télétravails — tous les rôles (filtrage par ownership côté service)",
  },
  {
    action: "telework:create",
    resource: "telework",
    method: "POST",
    apiEndpoint: "/api/telework",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
    ],
    deniedRoles: ["observateur"],
    testBody: {
      date: "2027-09-15T00:00:00Z",
    },
    description: "Déclarer une journée de télétravail — tous sauf Observateur",
  },

  // ═══════════════════════════════════════════════════════════
  // ANALYTICS / REPORTS
  // ═══════════════════════════════════════════════════════════
  {
    action: "reports:view",
    resource: "analytics",
    method: "GET",
    apiEndpoint: "/api/analytics",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    description: "Accéder aux analytics — Admin, Responsable, Manager",
  },
  {
    action: "reports:export",
    resource: "analytics",
    method: "GET",
    apiEndpoint: "/api/analytics/export",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    description: "Exporter les analytics — Admin, Responsable, Manager",
  },

  // ═══════════════════════════════════════════════════════════
  // PREDEFINED TASKS (Tâches prédéfinies)
  // ═══════════════════════════════════════════════════════════
  {
    action: "predefined_tasks:view",
    resource: "predefined-tasks",
    method: "GET",
    apiEndpoint: "/api/predefined-tasks",
    allowedRoles: ["admin", "responsable", "manager", "observateur"],
    deniedRoles: ["referent", "contributeur"],
    description:
      "Lister les tâches prédéfinies — Admin, Responsable, Manager, Observateur (action=view → inclus dans OBSERVATEUR)",
  },
  {
    action: "predefined_tasks:create",
    resource: "predefined-tasks",
    method: "POST",
    apiEndpoint: "/api/predefined-tasks",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      title: "Tâche prédéfinie Test RBAC",
      description: "Test permission",
      estimatedHours: 2,
    },
    description: "Créer une tâche prédéfinie — Admin, Responsable, Manager",
  },
  {
    action: "predefined_tasks:assign",
    resource: "predefined-tasks",
    method: "POST",
    apiEndpoint: "/api/predefined-tasks/recurring-rules/bulk",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      predefinedTaskId: "{{predefinedTaskId}}",
      userIds: ["{{userId}}"],
      daysOfWeek: [0],
      period: "FULL_DAY",
      weekInterval: 1,
      startDate: "2026-04-01T00:00:00Z",
    },
    description:
      "Créer des règles récurrentes en masse — Admin, Responsable, Manager",
  },

  // ═══════════════════════════════════════════════════════════
  // THIRD PARTIES (Tiers)
  // ═══════════════════════════════════════════════════════════
  {
    action: "third_parties:read",
    resource: "third-parties",
    method: "GET",
    apiEndpoint: "/api/third-parties",
    allowedRoles: ["admin", "responsable", "manager", "observateur"],
    deniedRoles: ["referent", "contributeur"],
    description:
      "Lister les tiers — Admin, Responsable, Manager, Observateur (hérite :read via action=read pattern)",
  },
  {
    action: "third_parties:create",
    resource: "third-parties",
    method: "POST",
    apiEndpoint: "/api/third-parties",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      type: "EXTERNAL_PROVIDER",
      organizationName: "Acme RBAC Test",
    },
    description:
      "Créer un tiers — Admin, Responsable, Manager, Chef de projet (Chef de projet non testé : absent des 6 rôles de test)",
  },
  {
    action: "third_parties:update",
    resource: "third-parties",
    method: "PATCH",
    apiEndpoint: `/api/third-parties/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      organizationName: "Acme modifié",
    },
    description:
      "Modifier un tiers — Admin, Responsable, Manager, Chef de projet",
  },
  {
    action: "third_parties:delete",
    resource: "third-parties",
    method: "DELETE",
    apiEndpoint: `/api/third-parties/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    description:
      "Hard delete d'un tiers — Admin, Responsable, Manager, Chef de projet",
  },
  {
    action: "third_parties:assign_to_task",
    resource: "third-parties",
    method: "POST",
    apiEndpoint: `/api/tasks/${PLACEHOLDER_UUID_V4}/third-party-assignees`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      thirdPartyId: PLACEHOLDER_UUID_V4,
    },
    description:
      "Assigner un tiers à une tâche — Admin, Responsable, Manager, Chef de projet",
  },
  {
    action: "third_parties:assign_to_project",
    resource: "third-parties",
    method: "POST",
    apiEndpoint: `/api/projects/${PLACEHOLDER_UUID_V4}/third-party-members`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      thirdPartyId: PLACEHOLDER_UUID_V4,
    },
    description:
      "Rattacher un tiers à un projet — Admin, Responsable, Manager, Chef de projet",
  },

  // NOTE : time_tracking:declare_for_third_party n'est PAS exposé via
  // @Permissions() sur le controller — le gating se fait côté service
  // APRÈS la vérification d'existence du projet/tâche. Impossible à
  // tester au niveau matrix (un PLACEHOLDER projet inexistant renverrait
  // 404 avant le check de permission). Couverture assurée par les
  // scenarios dans time-tracking-third-parties.spec.ts.

  // ═══════════════════════════════════════════════════════════
  // CLIENTS (Commanditaires) — Module Clients V1 (W5)
  // ═══════════════════════════════════════════════════════════
  //
  // Mapping rôles de test → templates V4 (confirmé par lecture de
  // packages/rbac/templates.ts + atomic-permissions.ts) :
  //   admin        → ADMIN           (CATALOG_PERMISSIONS — toutes les perms)
  //   responsable  → ADMIN_DELEGATED (catalog minus 3 perms non-clients)
  //   manager      → MANAGER         (clients:assign_to_project explicite ; pas CLIENTS_CRUD)
  //   referent     → TECHNICAL_LEAD  (PROJECT_STRUCTURE_READ → clients:read seulement)
  //   contributeur → PROJECT_CONTRIBUTOR (PROJECT_CONTRIB_CAPACITIES → PROJECT_STRUCTURE_READ → clients:read)
  //   observateur  → OBSERVER_FULL   (PROJECT_STRUCTURE_READ → clients:read)
  //
  // clients:create/update/delete  → ADMIN, ADMIN_DELEGATED uniquement (CLIENTS_CRUD)
  // clients:assign_to_project     → ADMIN, ADMIN_DELEGATED, MANAGER (+ PROJECT_LEAD hors scope 6 rôles)
  // clients:read                  → tous les 6 rôles via PROJECT_STRUCTURE_READ

  {
    action: "clients:create",
    resource: "clients",
    method: "POST",
    apiEndpoint: "/api/clients",
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
    testBody: {
      name: "Client Test RBAC",
    },
    description:
      "Créer un client commanditaire — Admin, Responsable uniquement (CLIENTS_CRUD via ADMIN/ADMIN_DELEGATED)",
  },
  {
    action: "clients:read",
    resource: "clients",
    method: "GET",
    apiEndpoint: "/api/clients",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description:
      "Lister les clients — tous les rôles (clients:read via PROJECT_STRUCTURE_READ quasi-universel)",
  },
  {
    action: "clients:read",
    resource: "clients",
    method: "GET",
    apiEndpoint: `/api/clients/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description:
      "Détail d'un client — tous les rôles (clients:read). 404 = autorisé mais ressource absente",
  },
  {
    action: "clients:read",
    resource: "clients",
    method: "GET",
    apiEndpoint: `/api/clients/${PLACEHOLDER_UUID_V4}/projects`,
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description:
      "Projets d'un client — tous les rôles (clients:read AND projects:read, les deux présents dans PROJECT_STRUCTURE_READ)",
  },
  {
    action: "clients:delete",
    resource: "clients",
    method: "GET",
    apiEndpoint: `/api/clients/${PLACEHOLDER_UUID_V4}/deletion-impact`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
    description:
      "Vérifier l'impact avant suppression d'un client — Admin, Responsable uniquement (clients:delete requis)",
  },
  {
    action: "clients:update",
    resource: "clients",
    method: "PATCH",
    apiEndpoint: `/api/clients/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
    testBody: {
      name: "Client modifié RBAC",
    },
    description:
      "Modifier un client — Admin, Responsable uniquement (clients:update via CLIENTS_CRUD)",
  },
  {
    action: "clients:delete",
    resource: "clients",
    method: "DELETE",
    apiEndpoint: `/api/clients/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
    description:
      "Supprimer un client (hard delete) — Admin, Responsable uniquement (clients:delete via CLIENTS_CRUD)",
  },
  {
    action: "clients:read",
    resource: "clients",
    method: "GET",
    apiEndpoint: `/api/projects/${PLACEHOLDER_UUID_V4}/clients`,
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description:
      "Lister les clients d'un projet — tous les rôles (clients:read). 404 projet inexistant = autorisé",
  },
  {
    action: "clients:assign_to_project",
    resource: "clients",
    method: "POST",
    apiEndpoint: `/api/projects/${PLACEHOLDER_UUID_V4}/clients`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      clientId: PLACEHOLDER_UUID_V4,
    },
    description:
      "Rattacher un client à un projet — Admin, Responsable, Manager (clients:assign_to_project). PROJECT_LEAD hors scope 6 rôles de test",
  },
  {
    action: "clients:assign_to_project",
    resource: "clients",
    method: "DELETE",
    apiEndpoint: `/api/projects/${PLACEHOLDER_UUID_V4}/clients/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    description:
      "Détacher un client d'un projet — Admin, Responsable, Manager (clients:assign_to_project). 404 = autorisé mais rattachement absent",
  },

  // ═══════════════════════════════════════════════════════════
  // TST-001 — backfill : couverture 100% des codes @RequirePermissions
  // Rôles dérivés par construction de ROLE_TEMPLATES (rbac) via le
  // binding test-user→template du seed (admin=ADMIN, responsable=
  // ADMIN_DELEGATED, manager=MANAGER, referent=TECHNICAL_LEAD,
  // contributeur=BASIC_USER, observateur=OBSERVER_FULL). allowedRoles =
  // rôles dont le set de permissions contient le code ; deniedRoles = les
  // autres — identique à la décision du PermissionsGuardV2.
  // ═══════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────
  // COMMENTS
  // ───────────────────────────────────────────────────────────
  {
    action: "comments:create",
    resource: "comments",
    method: "POST",
    apiEndpoint: "/api/comments",
    allowedRoles: ["admin", "responsable", "manager", "referent"],
    deniedRoles: ["contributeur", "observateur"],
  },
  {
    action: "comments:read",
    resource: "comments",
    method: "GET",
    apiEndpoint: "/api/comments",
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur", "observateur"],
    deniedRoles: [],
  },
  {
    action: "comments:update",
    resource: "comments",
    method: "PATCH",
    apiEndpoint: `/api/comments/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent"],
    deniedRoles: ["contributeur", "observateur"],
  },
  {
    action: "comments:delete",
    resource: "comments",
    method: "DELETE",
    apiEndpoint: `/api/comments/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent"],
    deniedRoles: ["contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // DOCUMENTS
  // ───────────────────────────────────────────────────────────
  {
    action: "documents:create",
    resource: "documents",
    method: "POST",
    apiEndpoint: "/api/documents",
    allowedRoles: ["admin", "responsable", "manager", "referent"],
    deniedRoles: ["contributeur", "observateur"],
  },
  {
    action: "documents:read",
    resource: "documents",
    method: "GET",
    apiEndpoint: "/api/documents",
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur", "observateur"],
    deniedRoles: [],
  },
  {
    action: "documents:update",
    resource: "documents",
    method: "PATCH",
    apiEndpoint: `/api/documents/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent"],
    deniedRoles: ["contributeur", "observateur"],
  },
  {
    action: "documents:delete",
    resource: "documents",
    method: "DELETE",
    apiEndpoint: `/api/documents/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent"],
    deniedRoles: ["contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // EPICS
  // ───────────────────────────────────────────────────────────
  {
    action: "epics:create",
    resource: "epics",
    method: "POST",
    apiEndpoint: "/api/epics",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },
  {
    action: "epics:read",
    resource: "epics",
    method: "GET",
    apiEndpoint: "/api/epics",
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur", "observateur"],
    deniedRoles: [],
  },
  {
    action: "epics:update",
    resource: "epics",
    method: "PATCH",
    apiEndpoint: `/api/epics/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },
  {
    action: "epics:delete",
    resource: "epics",
    method: "DELETE",
    apiEndpoint: `/api/epics/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // MILESTONES
  // ───────────────────────────────────────────────────────────
  {
    action: "milestones:create",
    resource: "milestones",
    method: "POST",
    apiEndpoint: "/api/milestones",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },
  {
    action: "milestones:read",
    resource: "milestones",
    method: "GET",
    apiEndpoint: "/api/milestones",
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur", "observateur"],
    deniedRoles: [],
  },
  {
    action: "milestones:update",
    resource: "milestones",
    method: "PATCH",
    apiEndpoint: `/api/milestones/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },
  {
    action: "milestones:delete",
    resource: "milestones",
    method: "DELETE",
    apiEndpoint: `/api/milestones/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // HOLIDAYS
  // ───────────────────────────────────────────────────────────
  {
    action: "holidays:create",
    resource: "holidays",
    method: "POST",
    apiEndpoint: "/api/holidays",
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },
  {
    action: "holidays:read",
    resource: "holidays",
    method: "GET",
    apiEndpoint: "/api/holidays",
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur", "observateur"],
    deniedRoles: [],
  },
  {
    action: "holidays:update",
    resource: "holidays",
    method: "PATCH",
    apiEndpoint: `/api/holidays/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },
  {
    action: "holidays:delete",
    resource: "holidays",
    method: "DELETE",
    apiEndpoint: `/api/holidays/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // SCHOOL VACATIONS
  // ───────────────────────────────────────────────────────────
  {
    action: "school_vacations:create",
    resource: "school-vacations",
    method: "POST",
    apiEndpoint: "/api/school-vacations",
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },
  {
    action: "school_vacations:read",
    resource: "school-vacations",
    method: "GET",
    apiEndpoint: "/api/school-vacations",
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur", "observateur"],
    deniedRoles: [],
  },
  {
    action: "school_vacations:update",
    resource: "school-vacations",
    method: "PATCH",
    apiEndpoint: `/api/school-vacations/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },
  {
    action: "school_vacations:delete",
    resource: "school-vacations",
    method: "DELETE",
    apiEndpoint: `/api/school-vacations/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // SETTINGS
  // ───────────────────────────────────────────────────────────
  {
    action: "settings:read",
    resource: "settings",
    method: "GET",
    apiEndpoint: "/api/settings",
    allowedRoles: ["admin", "responsable", "manager", "observateur"],
    deniedRoles: ["referent", "contributeur"],
  },
  {
    action: "settings:update",
    resource: "settings",
    method: "POST",
    apiEndpoint: "/api/settings/bulk",
    allowedRoles: ["admin"],
    deniedRoles: ["responsable", "manager", "referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // TIME TRACKING
  // ───────────────────────────────────────────────────────────
  {
    action: "time_tracking:create",
    resource: "time-tracking",
    method: "POST",
    apiEndpoint: "/api/time-tracking",
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur"],
    deniedRoles: ["observateur"],
  },
  {
    action: "time_tracking:update",
    resource: "time-tracking",
    method: "PATCH",
    apiEndpoint: `/api/time-tracking/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent"],
    deniedRoles: ["contributeur", "observateur"],
  },
  {
    action: "time_tracking:delete",
    resource: "time-tracking",
    method: "DELETE",
    apiEndpoint: `/api/time-tracking/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent"],
    deniedRoles: ["contributeur", "observateur"],
  },
  {
    action: "time_tracking:read_reports",
    resource: "time-tracking",
    method: "GET",
    apiEndpoint: `/api/time-tracking/user/${PLACEHOLDER_UUID_V4}/report`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // SERVICES
  // ───────────────────────────────────────────────────────────
  {
    action: "services:create",
    resource: "services",
    method: "POST",
    apiEndpoint: "/api/services",
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },
  {
    action: "services:read",
    resource: "services",
    method: "GET",
    apiEndpoint: "/api/services",
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur", "observateur"],
    deniedRoles: [],
  },
  {
    action: "services:update",
    resource: "services",
    method: "PATCH",
    apiEndpoint: `/api/services/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },
  {
    action: "services:delete",
    resource: "services",
    method: "DELETE",
    apiEndpoint: `/api/services/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // DEPARTMENTS (compléments)
  // ───────────────────────────────────────────────────────────
  {
    action: "departments:update",
    resource: "departments",
    method: "PATCH",
    apiEndpoint: `/api/departments/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },
  {
    action: "departments:delete",
    resource: "departments",
    method: "DELETE",
    apiEndpoint: `/api/departments/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // TASKS (compléments)
  // ───────────────────────────────────────────────────────────
  {
    action: "tasks:create",
    resource: "tasks",
    method: "POST",
    apiEndpoint: "/api/tasks",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },
  {
    action: "tasks:update",
    resource: "tasks",
    method: "PATCH",
    apiEndpoint: `/api/tasks/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur"],
    deniedRoles: ["observateur"],
  },
  {
    action: "tasks:delete",
    resource: "tasks",
    method: "DELETE",
    apiEndpoint: `/api/tasks/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // TELEWORK (compléments)
  // ───────────────────────────────────────────────────────────
  {
    action: "telework:update",
    resource: "telework",
    method: "PATCH",
    apiEndpoint: `/api/telework/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur"],
    deniedRoles: ["observateur"],
  },
  {
    action: "telework:delete",
    resource: "telework",
    method: "DELETE",
    apiEndpoint: `/api/telework/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur"],
    deniedRoles: ["observateur"],
  },
  {
    action: "telework:read_team",
    resource: "telework",
    method: "GET",
    apiEndpoint: `/api/telework/team/2027-01-01`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // LEAVES (compléments)
  // ───────────────────────────────────────────────────────────
  {
    action: "leaves:update",
    resource: "leaves",
    method: "PATCH",
    apiEndpoint: `/api/leaves/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },
  {
    action: "leaves:delete",
    resource: "leaves",
    method: "DELETE",
    apiEndpoint: `/api/leaves/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },
  {
    action: "leaves:manage_delegations",
    resource: "leaves",
    method: "POST",
    apiEndpoint: "/api/leaves/delegations",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // PROJECTS (compléments)
  // ───────────────────────────────────────────────────────────
  {
    action: "projects:archive",
    resource: "projects",
    method: "POST",
    apiEndpoint: `/api/projects/${PLACEHOLDER_UUID_V4}/archive`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },
  {
    action: "projects:manage_members",
    resource: "projects",
    method: "POST",
    apiEndpoint: `/api/projects/${PLACEHOLDER_UUID_V4}/members`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // SKILLS (compléments)
  // ───────────────────────────────────────────────────────────
  {
    action: "skills:update",
    resource: "skills",
    method: "PATCH",
    apiEndpoint: `/api/skills/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "referent"],
    deniedRoles: ["manager", "contributeur", "observateur"],
  },
  {
    action: "skills:delete",
    resource: "skills",
    method: "DELETE",
    apiEndpoint: `/api/skills/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "referent"],
    deniedRoles: ["manager", "contributeur", "observateur"],
  },
  {
    action: "skills:manage_matrix",
    resource: "skills",
    method: "GET",
    apiEndpoint: "/api/skills/matrix",
    allowedRoles: ["admin", "responsable", "referent"],
    deniedRoles: ["manager", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // PREDEFINED TASKS (compléments)
  // ───────────────────────────────────────────────────────────
  {
    action: "predefined_tasks:edit",
    resource: "predefined-tasks",
    method: "PATCH",
    apiEndpoint: `/api/predefined-tasks/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },
  {
    action: "predefined_tasks:delete",
    resource: "predefined-tasks",
    method: "DELETE",
    apiEndpoint: `/api/predefined-tasks/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // EVENTS (compléments)
  // ───────────────────────────────────────────────────────────
  {
    action: "events:create",
    resource: "events",
    method: "POST",
    apiEndpoint: "/api/events",
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur"],
    deniedRoles: ["observateur"],
  },
  {
    action: "events:update",
    resource: "events",
    method: "PATCH",
    apiEndpoint: `/api/events/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent", "contributeur"],
    deniedRoles: ["observateur"],
  },
  {
    action: "events:delete",
    resource: "events",
    method: "DELETE",
    apiEndpoint: `/api/events/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable", "manager", "referent"],
    deniedRoles: ["contributeur", "observateur"],
  },

  // ───────────────────────────────────────────────────────────
  // USERS (compléments)
  // ───────────────────────────────────────────────────────────
  {
    action: "users:delete",
    resource: "users",
    method: "DELETE",
    apiEndpoint: `/api/users/${PLACEHOLDER_UUID_V4}`,
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },
  {
    action: "users:import",
    resource: "users",
    method: "POST",
    apiEndpoint: "/api/users/import",
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },
  {
    action: "users:manage_roles",
    resource: "users",
    method: "GET",
    apiEndpoint: "/api/roles",
    allowedRoles: ["admin"],
    deniedRoles: ["responsable", "manager", "referent", "contributeur", "observateur"],
  },
  {
    action: "users:reset_password",
    resource: "users",
    method: "POST",
    apiEndpoint: "/api/auth/reset-password-token",
    allowedRoles: ["admin", "responsable"],
    deniedRoles: ["manager", "referent", "contributeur", "observateur"],
  },
];

/**
 * Retourne les entrées de la matrice pour une ressource donnée.
 */
export function getEntriesForResource(resource: string): PermissionEntry[] {
  return PERMISSION_MATRIX.filter((entry) => entry.resource === resource);
}

/**
 * Retourne toutes les ressources distinctes présentes dans la matrice.
 */
export function getResources(): string[] {
  return [...new Set(PERMISSION_MATRIX.map((e) => e.resource))];
}
