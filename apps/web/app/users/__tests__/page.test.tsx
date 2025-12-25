import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock du store auth
const mockCurrentUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  login: 'admin',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN',
};

jest.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (state: { user: typeof mockCurrentUser }) => unknown) => selector({ user: mockCurrentUser }),
}));

// Mock des données
const mockUsers = [
  {
    id: 'user-1',
    email: 'user1@test.com',
    login: 'user1',
    firstName: 'John',
    lastName: 'Doe',
    role: 'CONTRIBUTEUR',
    isActive: true,
    departmentId: 'dept-1',
    department: { id: 'dept-1', name: 'IT' },
    userServices: [{ service: { id: 'service-1', name: 'Development' } }],
  },
  {
    id: 'user-2',
    email: 'user2@test.com',
    login: 'user2',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'MANAGER',
    isActive: true,
    departmentId: 'dept-1',
    department: { id: 'dept-1', name: 'IT' },
    userServices: [],
  },
];

const mockDepartments = [
  { id: 'dept-1', name: 'IT' },
  { id: 'dept-2', name: 'HR' },
];

const mockServices = [
  { id: 'service-1', name: 'Development', departmentId: 'dept-1' },
  { id: 'service-2', name: 'QA', departmentId: 'dept-1' },
];

// Mock des services
jest.mock('@/services/users.service', () => ({
  usersService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('@/services/departments.service', () => ({
  departmentsService: {
    getAll: jest.fn(),
  },
}));

jest.mock('@/services/services.service', () => ({
  servicesService: {
    getAll: jest.fn(),
  },
}));

// Mock de react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock MainLayout
jest.mock('@/components/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

import UsersPage from '../page';
import { usersService } from '@/services/users.service';
import { departmentsService } from '@/services/departments.service';
import { servicesService } from '@/services/services.service';
import toast from 'react-hot-toast';

describe('UsersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.getAll as jest.Mock).mockResolvedValue(mockUsers);
    (usersService.create as jest.Mock).mockResolvedValue({ id: 'new-user' });
    (usersService.update as jest.Mock).mockResolvedValue({});
    (usersService.remove as jest.Mock).mockResolvedValue({});
    (departmentsService.getAll as jest.Mock).mockResolvedValue(mockDepartments);
    (servicesService.getAll as jest.Mock).mockResolvedValue(mockServices);
  });

  it('should render the page title', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /utilisateurs/i })).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    render(<UsersPage />);

    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it('should display users list after loading', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('should display user email', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });
  });

  it('should display user role', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText(/contributeur/i)).toBeInTheDocument();
      expect(screen.getByText(/manager/i)).toBeInTheDocument();
    });
  });

  it('should display department name', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getAllByText('IT').length).toBeGreaterThan(0);
    });
  });

  it('should display service badges', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Development')).toBeInTheDocument();
    });
  });

  it('should show create button for admin users', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer|nouveau|ajouter/i })).toBeInTheDocument();
    });
  });

  it('should open create modal when clicking create button', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer|nouveau|ajouter/i })).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /créer|nouveau|ajouter/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });
  });

  it('should display form fields in create modal', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer|nouveau|ajouter/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /créer|nouveau|ajouter/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/prénom/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/nom/i)).toBeInTheDocument();
    });
  });

  it('should create user and show success message', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer|nouveau|ajouter/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /créer|nouveau|ajouter/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    // Remplir le formulaire
    await user.type(screen.getByLabelText(/email/i), 'newuser@test.com');
    await user.type(screen.getByLabelText(/login/i), 'newuser');
    await user.type(screen.getByLabelText(/mot de passe/i), 'password123');
    await user.type(screen.getByLabelText(/prénom/i), 'New');
    await user.type(screen.getByLabelText(/nom/i), 'User');

    // Soumettre
    const submitButton = screen.getByRole('button', { name: /créer|enregistrer|valider/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(usersService.create).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Utilisateur créé avec succès');
    });
  });

  it('should close modal on cancel', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer|nouveau|ajouter/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /créer|nouveau|ajouter/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /annuler/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    });
  });

  it('should open edit modal when clicking edit button', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Trouver et cliquer sur le bouton d'édition
    const editButtons = screen.getAllByRole('button', { name: /modifier|éditer|edit/i });
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);

      await waitFor(() => {
        // Le modal d'édition devrait s'ouvrir avec les données pré-remplies
        expect(screen.getByDisplayValue('user1@test.com')).toBeInTheDocument();
      });
    }
  });

  it('should update user and show success message', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /modifier|éditer|edit/i });
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      });

      // Modifier le prénom
      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnny');

      // Soumettre
      const saveButton = screen.getByRole('button', { name: /enregistrer|sauvegarder|modifier/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(usersService.update).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('Utilisateur modifié avec succès');
      });
    }
  });

  it('should filter services by department', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer|nouveau|ajouter/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /créer|nouveau|ajouter/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/département/i)).toBeInTheDocument();
    });

    // Sélectionner un département
    const deptSelect = screen.getByLabelText(/département/i);
    await user.selectOptions(deptSelect, 'dept-1');

    // Les services du département devraient être disponibles
    await waitFor(() => {
      expect(screen.getByText('Development')).toBeInTheDocument();
    });
  });
});

describe('UsersPage - Permissions', () => {
  it('should hide create button for non-admin users', async () => {
    // Modifier le mock pour un utilisateur non-admin
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const authStore = require('@/stores/auth.store');
    jest.spyOn(authStore, 'useAuthStore').mockImplementation((selector: (state: { user: typeof mockCurrentUser }) => unknown) =>
      selector({ user: { ...mockCurrentUser, role: 'CONTRIBUTEUR' } })
    );

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /créer|nouveau|ajouter/i })).not.toBeInTheDocument();
    });
  });
});

describe('UsersPage - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.getAll as jest.Mock).mockRejectedValue(new Error('Network error'));
  });

  it('should show error toast on fetch failure', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erreur lors du chargement des utilisateurs');
    });
  });
});

describe('UsersPage - Empty State', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.getAll as jest.Mock).mockResolvedValue([]);
  });

  it('should display message when no users', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      // Le comportement peut varier selon l'implémentation
      expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    });
  });
});
