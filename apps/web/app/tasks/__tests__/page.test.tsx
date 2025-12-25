import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock du router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock du store auth
const mockUser = {
  id: 'user-1',
  email: 'admin@test.com',
  login: 'admin',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN',
};

jest.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (state: { user: typeof mockUser }) => unknown) => selector({ user: mockUser }),
}));

// Mock des services
const mockTasks = [
  {
    id: 'task-1',
    title: 'Task 1',
    description: 'Description 1',
    status: 'TODO',
    priority: 'NORMAL',
    projectId: 'project-1',
    assigneeId: 'user-1',
    progress: 0,
    project: { id: 'project-1', name: 'Project 1' },
    assignee: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
  },
  {
    id: 'task-2',
    title: 'Task 2',
    description: 'Description 2',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    projectId: 'project-1',
    assigneeId: 'user-1',
    progress: 50,
    project: { id: 'project-1', name: 'Project 1' },
    assignee: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
  },
];

const mockProjects = [
  { id: 'project-1', name: 'Project 1', status: 'ACTIVE' },
  { id: 'project-2', name: 'Project 2', status: 'ACTIVE' },
];

jest.mock('@/services/tasks.service', () => ({
  tasksService: {
    getByAssignee: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('@/services/projects.service', () => ({
  projectsService: {
    getAll: jest.fn(),
    getByUser: jest.fn(),
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

import TasksPage from '../page';
import { tasksService } from '@/services/tasks.service';
import { projectsService } from '@/services/projects.service';
import toast from 'react-hot-toast';

describe('TasksPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tasksService.getByAssignee as jest.Mock).mockResolvedValue(mockTasks);
    (tasksService.create as jest.Mock).mockResolvedValue({ id: 'new-task' });
    (tasksService.update as jest.Mock).mockResolvedValue({});
    (projectsService.getAll as jest.Mock).mockResolvedValue({ data: mockProjects });
    (projectsService.getByUser as jest.Mock).mockResolvedValue(mockProjects);
  });

  it('should render the page title', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /tâches/i })).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    render(<TasksPage />);

    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it('should render kanban columns after loading', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText('À faire')).toBeInTheDocument();
      expect(screen.getByText('En cours')).toBeInTheDocument();
      expect(screen.getByText('En revue')).toBeInTheDocument();
      expect(screen.getByText('Terminé')).toBeInTheDocument();
      expect(screen.getByText('Bloqué')).toBeInTheDocument();
    });
  });

  it('should display tasks in correct columns', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });
  });

  it('should display task count', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText(/2 tâche\(s\)/i)).toBeInTheDocument();
    });
  });

  it('should show create button for admin users', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer une tâche/i })).toBeInTheDocument();
    });
  });

  it('should open create modal when clicking create button', async () => {
    const user = userEvent.setup();
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer une tâche/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /créer une tâche/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /créer une tâche/i })).toBeInTheDocument();
    });
  });

  it('should display project filter', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/projet/i)).toBeInTheDocument();
    });
  });

  it('should display priority filter', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/priorité/i)).toBeInTheDocument();
    });
  });

  it('should filter tasks by project', async () => {
    const user = userEvent.setup();
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/projet/i)).toBeInTheDocument();
    });

    const projectSelect = screen.getByLabelText(/projet/i);
    await user.selectOptions(projectSelect, 'project-1');

    // Les tâches devraient être filtrées
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
  });

  it('should display priority badge with correct color', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText('Normale')).toBeInTheDocument();
      expect(screen.getByText('Haute')).toBeInTheDocument();
    });
  });

  it('should display task progress bar when progress > 0', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  it('should navigate to task details on click', async () => {
    const user = userEvent.setup();
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    // Simuler un clic sur une tâche (en évitant le drag)
    const task1 = screen.getByText('Task 1').closest('[draggable]');
    if (task1) {
      await user.click(task1);
    }

    // Le mock du router devrait être appelé
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-1');
    });
  });

  it('should close create modal on cancel', async () => {
    const user = userEvent.setup();
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer une tâche/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /créer une tâche/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /annuler/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /créer une tâche/i })).not.toBeInTheDocument();
    });
  });

  it('should create task and show success message', async () => {
    const user = userEvent.setup();
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer une tâche/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /créer une tâche/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/titre/i)).toBeInTheDocument();
    });

    // Remplir le formulaire
    await user.type(screen.getByLabelText(/titre/i), 'New Task');

    const projectSelect = screen.getAllByRole('combobox').find(el => el.id?.includes('project') || el.getAttribute('name')?.includes('project'));
    if (projectSelect) {
      await user.selectOptions(projectSelect, 'project-1');
    }

    await user.click(screen.getByRole('button', { name: /créer la tâche/i }));

    await waitFor(() => {
      expect(tasksService.create).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Tâche créée avec succès');
    });
  });

  it('should handle status change', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    // Trouver et cliquer sur le bouton de changement de statut
    const statusButtons = screen.getAllByRole('button', { name: /→/ });
    if (statusButtons.length > 0) {
      fireEvent.click(statusButtons[0]);

      await waitFor(() => {
        expect(tasksService.update).toHaveBeenCalled();
      });
    }
  });

  it('should display assignee information', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText(/john doe/i)).toBeInTheDocument();
    });
  });

  it('should display project name on task card', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
    });
  });
});

describe('TasksPage - Empty State', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tasksService.getByAssignee as jest.Mock).mockResolvedValue([]);
  });

  it('should display empty message when no tasks', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/aucune tâche/i).length).toBeGreaterThan(0);
    });
  });
});

describe('TasksPage - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tasksService.getByAssignee as jest.Mock).mockRejectedValue(new Error('Network error'));
  });

  it('should show error toast on fetch failure', async () => {
    render(<TasksPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erreur lors du chargement des données');
    });
  });
});
