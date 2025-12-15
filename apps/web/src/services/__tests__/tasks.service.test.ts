import { tasksService } from '../tasks.service';
import { api } from '@/lib/api';
import { TaskStatus, Priority } from '@/types';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('tasksService', () => {
  const mockTask = {
    id: 'task-1',
    title: 'Test Task',
    description: 'Test description',
    status: TaskStatus.TODO,
    priority: Priority.NORMAL,
    projectId: 'project-1',
    assigneeId: 'user-1',
    progress: 0,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  const mockTasks = [mockTask, { ...mockTask, id: 'task-2', title: 'Task 2' }];

  const mockPaginatedResponse = {
    data: mockTasks,
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all tasks without filters', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      const result = await tasksService.getAll();

      expect(api.get).toHaveBeenCalledWith('/tasks?');
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should fetch tasks with pagination', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      await tasksService.getAll(1, 10);

      expect(api.get).toHaveBeenCalledWith('/tasks?page=1&limit=10');
    });

    it('should filter by status', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      await tasksService.getAll(undefined, undefined, TaskStatus.IN_PROGRESS);

      expect(api.get).toHaveBeenCalledWith('/tasks?status=IN_PROGRESS');
    });

    it('should filter by priority', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      await tasksService.getAll(undefined, undefined, undefined, Priority.HIGH);

      expect(api.get).toHaveBeenCalledWith('/tasks?priority=HIGH');
    });

    it('should combine all parameters', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      await tasksService.getAll(1, 20, TaskStatus.TODO, Priority.CRITICAL);

      expect(api.get).toHaveBeenCalledWith('/tasks?page=1&limit=20&status=TODO&priority=CRITICAL');
    });
  });

  describe('getById', () => {
    it('should fetch task by ID', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTask });

      const result = await tasksService.getById('task-1');

      expect(api.get).toHaveBeenCalledWith('/tasks/task-1');
      expect(result).toEqual(mockTask);
    });
  });

  describe('getByProject', () => {
    it('should fetch tasks by project', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTasks });

      const result = await tasksService.getByProject('project-1');

      expect(api.get).toHaveBeenCalledWith('/tasks/project/project-1');
      expect(result).toEqual(mockTasks);
    });
  });

  describe('getByAssignee', () => {
    it('should fetch tasks by assignee', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTasks });

      const result = await tasksService.getByAssignee('user-1');

      expect(api.get).toHaveBeenCalledWith('/tasks/assignee/user-1');
      expect(result).toEqual(mockTasks);
    });
  });

  describe('getByEpic', () => {
    it('should fetch tasks by epic', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTasks });

      const result = await tasksService.getByEpic('epic-1');

      expect(api.get).toHaveBeenCalledWith('/tasks/epic/epic-1');
      expect(result).toEqual(mockTasks);
    });
  });

  describe('getByMilestone', () => {
    it('should fetch tasks by milestone', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTasks });

      const result = await tasksService.getByMilestone('milestone-1');

      expect(api.get).toHaveBeenCalledWith('/tasks/milestone/milestone-1');
      expect(result).toEqual(mockTasks);
    });
  });

  describe('getByDateRange', () => {
    it('should fetch tasks by date range', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTasks });

      const result = await tasksService.getByDateRange('2025-01-01', '2025-12-31');

      expect(api.get).toHaveBeenCalledWith('/tasks?startDate=2025-01-01&endDate=2025-12-31');
      expect(result).toEqual(mockTasks);
    });
  });

  describe('create', () => {
    it('should create a new task', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockTask });

      const createData = {
        title: 'New Task',
        projectId: 'project-1',
        assigneeId: 'user-1',
      };

      const result = await tasksService.create(createData);

      expect(api.post).toHaveBeenCalledWith('/tasks', createData);
      expect(result).toEqual(mockTask);
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const updatedTask = { ...mockTask, title: 'Updated Task' };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedTask });

      const result = await tasksService.update('task-1', { title: 'Updated Task' });

      expect(api.patch).toHaveBeenCalledWith('/tasks/task-1', { title: 'Updated Task' });
      expect(result).toEqual(updatedTask);
    });
  });

  describe('updateProgress', () => {
    it('should update task progress', async () => {
      const updatedTask = { ...mockTask, progress: 50 };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedTask });

      const result = await tasksService.updateProgress('task-1', 50);

      expect(api.patch).toHaveBeenCalledWith('/tasks/task-1/progress', { progress: 50 });
      expect(result).toEqual(updatedTask);
    });
  });

  describe('delete', () => {
    it('should delete a task', async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await tasksService.delete('task-1');

      expect(api.delete).toHaveBeenCalledWith('/tasks/task-1');
    });
  });

  describe('addDependency', () => {
    it('should add a task dependency', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await tasksService.addDependency('task-1', 'task-2');

      expect(api.post).toHaveBeenCalledWith('/tasks/task-1/dependencies', { dependsOnTaskId: 'task-2' });
    });
  });

  describe('removeDependency', () => {
    it('should remove a task dependency', async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await tasksService.removeDependency('task-1', 'dep-1');

      expect(api.delete).toHaveBeenCalledWith('/tasks/task-1/dependencies/dep-1');
    });
  });

  describe('assignRaci', () => {
    it('should assign RACI role to task', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await tasksService.assignRaci('task-1', 'user-1', 'RESPONSIBLE');

      expect(api.post).toHaveBeenCalledWith('/tasks/task-1/raci', {
        userId: 'user-1',
        role: 'RESPONSIBLE',
      });
    });
  });

  describe('removeRaci', () => {
    it('should remove RACI assignment', async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await tasksService.removeRaci('task-1', 'raci-1');

      expect(api.delete).toHaveBeenCalledWith('/tasks/task-1/raci/raci-1');
    });
  });
});
