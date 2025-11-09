import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TasksService', () => {
  let service: TasksService;

  const mockPrismaService = {
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    taskDependency: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    taskRACI: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createTaskDto = {
      title: 'Test Task',
      description: 'Test Description',
      projectId: 'project-1',
      status: 'TODO' as const,
      priority: 'MEDIUM' as const,
    };

    it('should create a task successfully', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockTask = {
        id: '1',
        ...createTaskDto,
        estimatedHours: null,
        actualHours: null,
        assignedToId: null,
        epicId: null,
        milestoneId: null,
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.task.create.mockResolvedValue(mockTask);

      const result = await service.create(createTaskDto);

      expect(result).toBeDefined();
      expect(result.title).toBe(createTaskDto.title);
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createTaskDto)).rejects.toThrow('Projet introuvable');
    });
  });

  describe('findAll', () => {
    it('should return paginated tasks', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'TODO' },
        { id: '2', title: 'Task 2', status: 'IN_PROGRESS' },
      ];

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(2);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      const mockTask = {
        id: '1',
        title: 'Test Task',
        status: 'TODO',
        projectId: 'project-1',
      };

      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should throw error when task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow('Tâche introuvable');
    });
  });

  describe('update', () => {
    it('should update a task successfully', async () => {
      const updateTaskDto = {
        title: 'Updated Task',
        status: 'IN_PROGRESS' as const,
      };

      const existingTask = {
        id: '1',
        title: 'Old Task',
        status: 'TODO',
        projectId: 'project-1',
      };

      const updatedTask = {
        ...existingTask,
        ...updateTaskDto,
      };

      mockPrismaService.task.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.task.update.mockResolvedValue(updatedTask);

      const result = await service.update('1', updateTaskDto);

      expect(result).toBeDefined();
      expect(result.title).toBe('Updated Task');
    });
  });

  describe('remove', () => {
    it('should delete a task', async () => {
      const mockTask = {
        id: '1',
        title: 'Test Task',
        dependents: [],
      };

      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.task.delete.mockResolvedValue(mockTask);

      await service.remove('1');

      expect(mockPrismaService.task.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
