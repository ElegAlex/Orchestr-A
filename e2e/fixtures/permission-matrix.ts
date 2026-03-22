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
