import React from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that pull in the mocked modules
// ---------------------------------------------------------------------------

jest.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => {
      const m: Record<string, string> = {
        title: "Projets",
        loading: "Chargement...",
        createProject: "Nouveau projet",
        projectCount: "{{count}} projet(s)",
        projectCountFiltered: "{{filtered}}/{{total}} projets",
        "filters.search": "Recherche",
        "filters.searchPlaceholder": "Nom ou description...",
        "filters.status": "Statut",
        "filters.priority": "Priorité",
        "filters.all": "Tous",
        "filters.allPriorities": "Toutes",
        "status.DRAFT": "Brouillon",
        "status.ACTIVE": "Actif",
        "status.SUSPENDED": "Suspendu",
        "status.COMPLETED": "Terminé",
        "status.CANCELLED": "Annulé",
        "priority.CRITICAL": "Critique",
        "priority.HIGH": "Haute",
        "priority.NORMAL": "Normale",
        "priority.LOW": "Basse",
        "messages.loadError": "Erreur de chargement",
        "messages.createSuccess": "Projet créé",
        "messages.updateSuccess": "Projet mis à jour",
        "messages.deleteSuccess": "Projet supprimé",
        "messages.archiveSuccess": "Projet archivé",
        "messages.unarchiveSuccess": "Projet désarchivé",
        "form.name": "Nom",
        "form.description": "Description",
        "form.status": "Statut",
        "form.priority": "Priorité",
        "form.startDate": "Début",
        "form.endDate": "Fin",
        "form.manager": "Responsable",
        "form.sponsor": "Sponsor",
        "form.department": "Département",
        "form.budget": "Budget",
        "form.estimated": "Heures estimées",
        "create.title": "Créer un projet",
        "edit.title": "Modifier le projet",
        cancel: "Annuler",
        save: "Enregistrer",
        create: "Créer",
        archive: "Archiver",
        unarchive: "Désarchiver",
        delete: "Supprimer",
        "showArchived": "Afficher archivés",
        "hideArchived": "Masquer archivés",
        "memberMeFilter": "Mes projets seulement",
      };
      return m[key] ?? key;
    };
    t.rich = t;
    return t;
  },
  useLocale: () => "fr",
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/fr/projects",
}));

const mockAuthState = {
  user: {
    id: "user-admin",
    email: "admin@test.com",
    login: "admin",
    firstName: "Admin",
    lastName: "User",
    role: {
      id: "role-admin",
      code: "ADMIN",
      label: "Administrateur",
      templateKey: "ADMIN",
      isSystem: true,
    },
    departmentId: "dept-1",
  },
  permissions: [
    "projects:read",
    "projects:create",
    "projects:update",
    "projects:delete",
    "clients:read",
  ] as string[],
  permissionsLoaded: true,
};

jest.mock("@/stores/auth.store", () => ({
  useAuthStore: (selector?: (state: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

jest.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: (perm: string) =>
      mockAuthState.permissions.includes(perm),
  }),
}));

const mockProjects = [
  {
    id: "proj-1",
    name: "Alpha",
    description: "Desc A",
    status: "ACTIVE",
    priority: "NORMAL",
    icon: null,
    clients: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "proj-2",
    name: "Beta",
    description: "Desc B",
    status: "DRAFT",
    priority: "HIGH",
    icon: null,
    clients: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "proj-3",
    name: "Gamma",
    description: "Desc C",
    status: "ACTIVE",
    priority: "NORMAL",
    icon: null,
    clients: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

jest.mock("@/services/projects.service", () => ({
  projectsService: {
    getAll: jest.fn(),
    getByUser: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    archive: jest.fn(),
    unarchive: jest.fn(),
  },
}));

jest.mock("@/services/users.service", () => ({
  usersService: {
    getAll: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("@/services/departments.service", () => ({
  departmentsService: {
    getAll: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("@/services/clients.service", () => ({
  clientsService: {
    getAll: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

jest.mock("@/components/EmojiPicker", () => ({
  EmojiPicker: () => <div data-testid="emoji-picker" />,
}));

jest.mock("@/components/ProjectIcon", () => ({
  ProjectIcon: () => <span data-testid="project-icon" />,
}));

jest.mock("@/components/clients/ClientSelector", () => ({
  ClientSelector: () => <div data-testid="client-selector" />,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import ProjectsPage from "../page";
import { projectsService } from "@/services/projects.service";

// ---------------------------------------------------------------------------
// Existing baseline tests (unchanged)
// ---------------------------------------------------------------------------
const MockProjectsPage = () => {
  const projects = [
    { id: "1", name: "Project Alpha", status: "ACTIVE" },
    { id: "2", name: "Project Beta", status: "ACTIVE" },
  ];

  return (
    <div>
      <h1>Projets</h1>
      <div className="projects-list">
        {projects.map((project) => (
          <div key={project.id} className="project-card">
            <h3>{project.name}</h3>
            <span className="status">{project.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

describe("Projects Page", () => {
  it("should render projects page title", () => {
    render(<MockProjectsPage />);

    expect(screen.getByText(/projets/i)).toBeInTheDocument();
  });

  it("should display list of projects", () => {
    render(<MockProjectsPage />);

    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Project Beta")).toBeInTheDocument();
  });

  it("should display project status", () => {
    render(<MockProjectsPage />);

    const statusElements = screen.getAllByText("ACTIVE");
    expect(statusElements).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// PER-018: filter useEffect causes an extra render commit on the real page
//
// The real ProjectsPage has a useEffect (line 158) that recomputes
// filteredProjects every time projects/statusFilter/priorityFilter/searchQuery/
// clientsFilter change. Since useEffect fires *after* the render, each filter
// interaction produces 2 commits:
//   commit 1 – the render triggered by setStatusFilter
//   commit 2 – the render triggered by setFilteredProjects inside the effect
//
// After the fix, that useEffect is replaced by useMemo.  The derived value is
// computed within the same render as the statusFilter update → 1 commit only.
//
// Honest-RED proof: applying the ACTIVE filter on a list that contains DRAFT
// items causes .filter() to return a new array (never reference-equal to the
// previous filteredProjects).  React cannot bail-out of the setFilteredProjects
// call → the extra commit is guaranteed before the fix.
// ---------------------------------------------------------------------------
describe("PER-018: filter useEffect produces extra render commit (real ProjectsPage)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (projectsService.getAll as jest.Mock).mockResolvedValue({
      data: mockProjects,
    });
  });

  it("applying a status filter causes exactly 1 commit after the fix", async () => {
    const commits: string[] = [];
    const handleRender = (_id: string, phase: string) => {
      commits.push(phase);
    };

    await act(async () => {
      render(
        <React.Profiler id="projects-page" onRender={handleRender}>
          <ProjectsPage />
        </React.Profiler>,
      );
    });

    // Wait until the page has finished loading (loading spinner gone).
    // This ensures the status <select> is visible and data is present.
    await waitFor(() => {
      expect(screen.queryByText(/chargement/i)).not.toBeInTheDocument();
    });

    // Reset commit counter — we only care about what happens during a filter
    // interaction, not during initial mount.
    commits.length = 0;

    // Find the status filter <select> and change it to ACTIVE.
    // This triggers setStatusFilter → render.
    // With the buggy useEffect pattern a second commit follows (setFilteredProjects).
    // With the useMemo fix only 1 commit is produced.
    const statusSelect = screen.getByDisplayValue("Tous");
    await act(async () => {
      fireEvent.change(statusSelect, { target: { value: "ACTIVE" } });
    });

    // After the fix: exactly 1 commit per filter interaction.
    expect(commits.length).toBe(1);
  });
});
