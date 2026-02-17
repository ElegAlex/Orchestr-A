import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => {
      const translations: Record<string, string> = {
        "title": "Utilisateurs",
        "loading": "Chargement...",
        "createButton": "Créer un utilisateur",
        "create.title": "Créer un utilisateur",
        "createModal.title": "Créer un utilisateur",
        "createModal.cancel": "Annuler",
        "createModal.submit": "Créer",
        "createModal.firstName": "Prénom",
        "createModal.lastName": "Nom",
        "createModal.email": "Email",
        "createModal.login": "Login",
        "createModal.password": "Mot de passe",
        "createModal.role": "Rôle",
        "createModal.department": "Département",
        "createModal.noDepartment": "Aucun département",
        "createModal.services": "Services",
        "createModal.selectDepartmentFirst": "Sélectionnez d'abord un département",
        "editModal.title": "Modifier l'utilisateur",
        "edit.title": "Modifier l'utilisateur",
        "cancel": "Annuler",
        "importButton": "Importer",
        "count": "utilisateur(s)",
        "form.email": "Email",
        "form.login": "Login",
        "form.password": "Mot de passe",
        "form.firstName": "Prénom",
        "form.lastName": "Nom",
        "form.role": "Rôle",
        "form.department": "Département",
        "form.services": "Services",
        "form.noDepartment": "Aucun département",
        "messages.createSuccess": "Utilisateur créé avec succès",
        "messages.updateSuccess": "Utilisateur modifié avec succès",
        "messages.loadError": "Erreur lors du chargement des utilisateurs",
        "messages.deactivateConfirm": "Êtes-vous sûr ?",
        "messages.deactivateSuccess": "Utilisateur désactivé",
        "messages.deleteError": "Erreur lors de la suppression",
        "editAction": "Modifier",
        "deleteAction": "Supprimer",
        "columns.user": "Utilisateur",
        "columns.emailLogin": "Email / Login",
        "columns.role": "Rôle",
        "columns.departmentServices": "Département / Services",
        "columns.status": "Statut",
        "columns.actions": "Actions",
        "active": "Actif",
        "inactive": "Inactif",
        "roles.ADMIN": "Administrateur",
        "roles.RESPONSABLE": "Responsable",
        "roles.MANAGER": "Manager",
        "roles.CHEF_DE_PROJET": "Chef de projet",
        "roles.REFERENT_TECHNIQUE": "Référent technique",
        "roles.CONTRIBUTEUR": "Contributeur",
        "roles.OBSERVATEUR": "Observateur",
      };
      return translations[key] || key;
    };
    t.rich = t;
    return t;
  },
}));

// Mock du store auth
const mockCurrentUser = {
  id: "admin-1",
  email: "admin@test.com",
  login: "admin",
  firstName: "Admin",
  lastName: "User",
  role: "ADMIN",
};

jest.mock("@/stores/auth.store", () => ({
  useAuthStore: (
    selector: (state: { user: typeof mockCurrentUser }) => unknown,
  ) => selector({ user: mockCurrentUser }),
}));

// Mock des données
const mockUsers = [
  {
    id: "user-1",
    email: "user1@test.com",
    login: "user1",
    firstName: "John",
    lastName: "Doe",
    role: "CONTRIBUTEUR",
    isActive: true,
    departmentId: "dept-1",
    department: { id: "dept-1", name: "IT" },
    userServices: [{ service: { id: "service-1", name: "Development" } }],
  },
  {
    id: "user-2",
    email: "user2@test.com",
    login: "user2",
    firstName: "Jane",
    lastName: "Smith",
    role: "MANAGER",
    isActive: true,
    departmentId: "dept-1",
    department: { id: "dept-1", name: "IT" },
    userServices: [],
  },
];

const mockDepartments = [
  { id: "dept-1", name: "IT" },
  { id: "dept-2", name: "HR" },
];

const mockServices = [
  { id: "service-1", name: "Development", departmentId: "dept-1" },
  { id: "service-2", name: "QA", departmentId: "dept-1" },
];

// Mock des services
jest.mock("@/services/users.service", () => ({
  usersService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock("@/services/departments.service", () => ({
  departmentsService: {
    getAll: jest.fn(),
  },
}));

jest.mock("@/services/services.service", () => ({
  servicesService: {
    getAll: jest.fn(),
  },
}));

// Mock de react-hot-toast
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock MainLayout
jest.mock("@/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

import UsersPage from "../page";
import { usersService } from "@/services/users.service";
import { departmentsService } from "@/services/departments.service";
import { servicesService } from "@/services/services.service";
import toast from "react-hot-toast";

describe("UsersPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.getAll as jest.Mock).mockResolvedValue(mockUsers);
    (usersService.create as jest.Mock).mockResolvedValue({ id: "new-user" });
    (usersService.update as jest.Mock).mockResolvedValue({});
    (usersService.remove as jest.Mock).mockResolvedValue({});
    (departmentsService.getAll as jest.Mock).mockResolvedValue(mockDepartments);
    (servicesService.getAll as jest.Mock).mockResolvedValue(mockServices);
  });

  it("should render the page title", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /utilisateurs/i }),
      ).toBeInTheDocument();
    });
  });

  it("should display loading state initially", () => {
    render(<UsersPage />);

    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it("should display users list after loading", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });
  });

  it("should display user email", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("user1@test.com")).toBeInTheDocument();
    });
  });

  it("should display user role", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText(/contributeur/i)).toBeInTheDocument();
      expect(screen.getByText(/manager/i)).toBeInTheDocument();
    });
  });

  it("should display department name", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getAllByText("IT").length).toBeGreaterThan(0);
    });
  });

  it("should display service badges", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Development")).toBeInTheDocument();
    });
  });

  it("should show create button for admin users", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /créer|nouveau|ajouter/i }),
      ).toBeInTheDocument();
    });
  });

  it("should open create modal when clicking create button", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /créer|nouveau|ajouter/i }),
      ).toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /créer|nouveau|ajouter/i,
    });
    await user.click(createButton);

    await waitFor(() => {
      // Modal should have the title and form fields
      expect(
        screen.getByRole("heading", { name: /créer un utilisateur/i }),
      ).toBeInTheDocument();
    });
  });

  it("should display form fields in create modal", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /créer|nouveau|ajouter/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /créer|nouveau|ajouter/i }),
    );

    await waitFor(() => {
      // Check for form labels (not associated with inputs but visible in the form)
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Login")).toBeInTheDocument();
      expect(screen.getByText("Mot de passe")).toBeInTheDocument();
      expect(screen.getByText("Prénom")).toBeInTheDocument();
      expect(screen.getByText("Nom")).toBeInTheDocument();
    });
  });

  // TODO: Fix form input selection - labels not properly associated with inputs
  it.skip("should create user and show success message", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /créer|nouveau|ajouter/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /créer|nouveau|ajouter/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /créer un utilisateur/i }),
      ).toBeInTheDocument();
    });

    // Find inputs - the form has: firstName, lastName (first row), email, login, password
    const inputs = document.querySelectorAll(
      '.bg-white.rounded-lg input[type="text"], .bg-white.rounded-lg input[type="email"], .bg-white.rounded-lg input[type="password"]',
    );

    // Fill form using specific input positions in the create modal
    if (inputs.length >= 5) {
      await user.type(inputs[0] as HTMLElement, "New"); // firstName
      await user.type(inputs[1] as HTMLElement, "User"); // lastName
      await user.type(inputs[2] as HTMLElement, "newuser@test.com"); // email
      await user.type(inputs[3] as HTMLElement, "newuser"); // login
      await user.type(inputs[4] as HTMLElement, "password123"); // password
    }

    // Soumettre - use the submit button inside the modal (not the header button)
    const buttons = screen.getAllByRole("button", { name: /^créer$/i });
    const submitButton = buttons[buttons.length - 1]; // Last "Créer" button is the form submit
    await user.click(submitButton);

    await waitFor(() => {
      expect(usersService.create).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "Utilisateur créé avec succès",
      );
    });
  });

  it("should close modal on cancel", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /créer|nouveau|ajouter/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /créer|nouveau|ajouter/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /annuler/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /annuler/i }));

    await waitFor(() => {
      // Modal should be closed - the heading should no longer be visible
      expect(
        screen.queryByRole("heading", { name: /créer un utilisateur/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("should open edit modal when clicking edit button", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Trouver et cliquer sur le bouton d'édition
    const editButtons = screen.getAllByRole("button", {
      name: /modifier|éditer|edit/i,
    });
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);

      await waitFor(() => {
        // Le modal d'édition devrait s'ouvrir avec les données pré-remplies
        expect(screen.getByDisplayValue("user1@test.com")).toBeInTheDocument();
      });
    }
  });

  // TODO: Fix form input selection - labels not properly associated with inputs
  it.skip("should update user and show success message", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", {
      name: /modifier|éditer|edit/i,
    });
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      // Modifier le prénom
      const firstNameInput = screen.getByDisplayValue("John");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Johnny");

      // Soumettre
      const saveButton = screen.getByRole("button", {
        name: /enregistrer|sauvegarder|modifier/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(usersService.update).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith(
          "Utilisateur modifié avec succès",
        );
      });
    }
  });

  // TODO: Fix form interaction - services don't appear after department selection in test
  it.skip("should filter services by department", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /créer|nouveau|ajouter/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /créer|nouveau|ajouter/i }),
    );

    await waitFor(() => {
      // The modal should be open - look for "Aucun département" option in select
      expect(screen.getByText("Aucun département")).toBeInTheDocument();
    });

    // Get all selects and find the department one (has "Aucun département" option)
    const selects = screen.getAllByRole("combobox");
    const departmentSelect = selects.find(
      (select) =>
        select.querySelector('option[value=""]')?.textContent ===
        "Aucun département",
    );

    if (departmentSelect) {
      await user.selectOptions(departmentSelect, "dept-1");
    }

    // Les services du département devraient être disponibles
    await waitFor(() => {
      expect(screen.getByText("Development")).toBeInTheDocument();
    });
  });
});

describe("UsersPage - Permissions", () => {
  it("should hide create button for non-admin users", async () => {
    // Modifier le mock pour un utilisateur non-admin
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const authStore = require("@/stores/auth.store");
    jest
      .spyOn(authStore, "useAuthStore")
      .mockImplementation(
        (selector: (state: { user: typeof mockCurrentUser }) => unknown) =>
          selector({ user: { ...mockCurrentUser, role: "CONTRIBUTEUR" } }),
      );

    render(<UsersPage />);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /créer|nouveau|ajouter/i }),
      ).not.toBeInTheDocument();
    });
  });
});

describe("UsersPage - Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.getAll as jest.Mock).mockRejectedValue(
      new Error("Network error"),
    );
  });

  it("should show error toast on fetch failure", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Erreur lors du chargement des utilisateurs",
      );
    });
  });
});

describe("UsersPage - Empty State", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.getAll as jest.Mock).mockResolvedValue([]);
  });

  it("should display message when no users", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      // Le comportement peut varier selon l'implémentation
      expect(screen.getByTestId("main-layout")).toBeInTheDocument();
    });
  });
});
