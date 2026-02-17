import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TaskStatus, RACIRole, Role, Priority } from 'database';

describe('TasksService', () => {
  let service: TasksService;

  const mockPrismaService = {
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    epic: {
      findUnique: vi.fn(),
    },
    milestone: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    taskDependency: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    taskRACI: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    taskAssignee: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(
      async <T>(
        callback: (tx: typeof mockPrismaService) => Promise<T>,
      ): Promise<T> => callback(mockPrismaService),
    ),
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
    vi.clearAllMocks();
  });

  describe('create', () => {
    const mockUser = { id: 'user-1', role: Role.ADMIN };
    const createTaskDto = {
      title: 'Test Task',
      description: 'Test Description',
      projectId: 'project-1',
      status: 'TODO' as const,
      priority: 'NORMAL' as const,
    };

    it('should create a task successfully', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockTask = {
        id: '1',
        ...createTaskDto,
        estimatedHours: null,
        actualHours: null,
        assigneeId: null,
        epicId: null,
        milestoneId: null,
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.task.create.mockResolvedValue(mockTask);

      const result = await service.create(createTaskDto, mockUser);

      expect(result).toBeDefined();
      expect(result.title).toBe(createTaskDto.title);
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createTaskDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create task with epic', async () => {
      const dtoWithEpic = { ...createTaskDto, epicId: 'epic-1' };
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockEpic = { id: 'epic-1', name: 'Epic', projectId: 'project-1' };
      const mockTask = { id: '1', ...dtoWithEpic };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpic);
      mockPrismaService.task.create.mockResolvedValue(mockTask);

      const result = await service.create(dtoWithEpic, mockUser);
      expect(result.epicId).toBe('epic-1');
    });

    it('should throw error when epic not found', async () => {
      const dtoWithEpic = { ...createTaskDto, epicId: 'epic-1' };
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.create(dtoWithEpic, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error when epic belongs to different project', async () => {
      const dtoWithEpic = { ...createTaskDto, epicId: 'epic-1' };
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.epic.findUnique.mockResolvedValue({
        id: 'epic-1',
        projectId: 'other-project',
      });

      await expect(service.create(dtoWithEpic, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create task with milestone', async () => {
      const dtoWithMilestone = { ...createTaskDto, milestoneId: 'milestone-1' };
      const mockProject = { id: 'project-1' };
      const mockMilestone = { id: 'milestone-1', projectId: 'project-1' };
      const mockTask = { id: '1', ...dtoWithMilestone };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findUnique.mockResolvedValue(mockMilestone);
      mockPrismaService.task.create.mockResolvedValue(mockTask);

      const result = await service.create(dtoWithMilestone, mockUser);
      expect(result.milestoneId).toBe('milestone-1');
    });

    it('should throw error when milestone not found', async () => {
      const dtoWithMilestone = { ...createTaskDto, milestoneId: 'milestone-1' };
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.milestone.findUnique.mockResolvedValue(null);

      await expect(service.create(dtoWithMilestone, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error when milestone belongs to different project', async () => {
      const dtoWithMilestone = { ...createTaskDto, milestoneId: 'milestone-1' };
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.milestone.findUnique.mockResolvedValue({
        id: 'milestone-1',
        projectId: 'other-project',
      });

      await expect(service.create(dtoWithMilestone, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create task with assignee', async () => {
      const dtoWithAssignee = { ...createTaskDto, assigneeId: 'user-1' };
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.task.create.mockResolvedValue({
        id: '1',
        ...dtoWithAssignee,
      });

      const result = await service.create(dtoWithAssignee, mockUser);
      expect(result.assigneeId).toBe('user-1');
    });

    it('should throw error when assignee not found', async () => {
      const dtoWithAssignee = { ...createTaskDto, assigneeId: 'user-1' };
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(dtoWithAssignee, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error when end date is before start date', async () => {
      const dtoWithDates = {
        ...createTaskDto,
        startDate: '2025-12-01',
        endDate: '2025-11-01',
      };
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });

      await expect(service.create(dtoWithDates, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create task with valid dates', async () => {
      const dtoWithDates = {
        ...createTaskDto,
        startDate: '2025-11-01',
        endDate: '2025-12-01',
      };
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.task.create.mockResolvedValue({
        id: '1',
        ...dtoWithDates,
      });

      const result = await service.create(dtoWithDates, mockUser);
      expect(result).toBeDefined();
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
      expect(result.meta.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      await service.findAll(1, 10, TaskStatus.TODO);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'TODO' }) as object,
        }),
      );
    });

    it('should filter by projectId', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, 'project-1');

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'project-1' }) as object,
        }),
      );
    });

    it('should filter by assigneeId', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, undefined, 'user-1');

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assigneeId: 'user-1' }) as object,
        }),
      );
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

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
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

    it('should throw error when task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.update('1', { title: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update task with new projectId', async () => {
      const existingTask = { id: '1', projectId: 'project-1' };
      mockPrismaService.task.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-2',
      });
      mockPrismaService.task.update.mockResolvedValue({
        ...existingTask,
        projectId: 'project-2',
      });

      const result = await service.update('1', { projectId: 'project-2' });
      expect(result.projectId).toBe('project-2');
    });

    it('should throw error when new project not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({ id: '1' });
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.update('1', { projectId: 'invalid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update task with new epicId', async () => {
      const existingTask = { id: '1', epicId: null };
      mockPrismaService.task.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.epic.findUnique.mockResolvedValue({ id: 'epic-1' });
      mockPrismaService.task.update.mockResolvedValue({
        ...existingTask,
        epicId: 'epic-1',
      });

      const result = await service.update('1', { epicId: 'epic-1' });
      expect(result.epicId).toBe('epic-1');
    });

    it('should throw error when new epic not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({ id: '1' });
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.update('1', { epicId: 'invalid' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update task with new milestoneId', async () => {
      const existingTask = { id: '1', milestoneId: null };
      mockPrismaService.task.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.milestone.findUnique.mockResolvedValue({
        id: 'milestone-1',
      });
      mockPrismaService.task.update.mockResolvedValue({
        ...existingTask,
        milestoneId: 'milestone-1',
      });

      const result = await service.update('1', { milestoneId: 'milestone-1' });
      expect(result.milestoneId).toBe('milestone-1');
    });

    it('should throw error when new milestone not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({ id: '1' });
      mockPrismaService.milestone.findUnique.mockResolvedValue(null);

      await expect(
        service.update('1', { milestoneId: 'invalid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update task with new assigneeId', async () => {
      const existingTask = { id: '1', assigneeId: null };
      mockPrismaService.task.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.task.update.mockResolvedValue({
        ...existingTask,
        assigneeId: 'user-1',
      });

      const result = await service.update('1', { assigneeId: 'user-1' });
      expect(result.assigneeId).toBe('user-1');
    });

    it('should throw error when new assignee not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({ id: '1' });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('1', { assigneeId: 'invalid' }),
      ).rejects.toThrow(NotFoundException);
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

    it('should throw error when task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });

    it('should throw error when task has dependents', async () => {
      const mockTask = {
        id: '1',
        dependents: [{ id: 'dep-1' }],
      };
      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);

      await expect(service.remove('1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('addDependency', () => {
    it('should add dependency successfully', async () => {
      const task = { id: 'task-1', projectId: 'project-1' };
      const dependsOnTask = { id: 'task-2', projectId: 'project-1' };
      const dependency = { taskId: 'task-1', dependsOnTaskId: 'task-2' };

      mockPrismaService.task.findUnique
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(dependsOnTask);
      mockPrismaService.taskDependency.findMany.mockResolvedValue([]);
      mockPrismaService.taskDependency.findUnique.mockResolvedValue(null);
      mockPrismaService.taskDependency.create.mockResolvedValue(dependency);

      const result = await service.addDependency('task-1', {
        dependsOnId: 'task-2',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.taskDependency.create).toHaveBeenCalled();
    });

    it('should throw error when task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.addDependency('task-1', { dependsOnId: 'task-2' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when depends on task not found', async () => {
      mockPrismaService.task.findUnique
        .mockResolvedValueOnce({ id: 'task-1', projectId: 'project-1' })
        .mockResolvedValueOnce(null);

      await expect(
        service.addDependency('task-1', { dependsOnId: 'task-2' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when tasks belong to different projects', async () => {
      mockPrismaService.task.findUnique
        .mockResolvedValueOnce({ id: 'task-1', projectId: 'project-1' })
        .mockResolvedValueOnce({ id: 'task-2', projectId: 'project-2' });

      await expect(
        service.addDependency('task-1', { dependsOnId: 'task-2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when dependency already exists', async () => {
      const task = { id: 'task-1', projectId: 'project-1' };
      const dependsOnTask = { id: 'task-2', projectId: 'project-1' };

      mockPrismaService.task.findUnique
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(dependsOnTask);
      mockPrismaService.taskDependency.findMany.mockResolvedValue([]);
      mockPrismaService.taskDependency.findUnique.mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.addDependency('task-1', { dependsOnId: 'task-2' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should detect circular dependency', async () => {
      const task1 = { id: 'task-1', projectId: 'project-1' };
      const task2 = { id: 'task-2', projectId: 'project-1' };

      mockPrismaService.task.findUnique
        .mockResolvedValueOnce(task1)
        .mockResolvedValueOnce(task2);
      // task-2 already depends on task-1, creating circular dependency
      mockPrismaService.taskDependency.findMany.mockResolvedValue([
        { taskId: 'task-2', dependsOnTaskId: 'task-1' },
      ]);

      await expect(
        service.addDependency('task-1', { dependsOnId: 'task-2' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeDependency', () => {
    it('should remove dependency successfully', async () => {
      mockPrismaService.taskDependency.findUnique.mockResolvedValue({
        taskId: 'task-1',
        dependsOnTaskId: 'task-2',
      });
      mockPrismaService.taskDependency.delete.mockResolvedValue({});

      const result = await service.removeDependency('task-1', 'task-2');

      expect(result.message).toBe('Dépendance supprimée avec succès');
    });

    it('should throw error when dependency not found', async () => {
      mockPrismaService.taskDependency.findUnique.mockResolvedValue(null);

      await expect(
        service.removeDependency('task-1', 'task-2'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignRACI', () => {
    it('should assign RACI role successfully', async () => {
      const task = { id: 'task-1' };
      const user = { id: 'user-1' };
      const raciAssignment = {
        taskId: 'task-1',
        userId: 'user-1',
        role: 'RESPONSIBLE',
      };

      mockPrismaService.task.findUnique.mockResolvedValue(task);
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.taskRACI.findUnique.mockResolvedValue(null);
      mockPrismaService.taskRACI.create.mockResolvedValue(raciAssignment);

      const result = await service.assignRACI('task-1', {
        userId: 'user-1',
        role: RACIRole.RESPONSIBLE,
      });

      expect(result).toBeDefined();
      expect(result.role).toBe('RESPONSIBLE');
    });

    it('should throw error when task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(
        service.assignRACI('task-1', {
          userId: 'user-1',
          role: RACIRole.RESPONSIBLE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({ id: 'task-1' });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assignRACI('task-1', {
          userId: 'user-1',
          role: RACIRole.RESPONSIBLE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when RACI assignment already exists', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({ id: 'task-1' });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.taskRACI.findUnique.mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.assignRACI('task-1', {
          userId: 'user-1',
          role: RACIRole.RESPONSIBLE,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeRACI', () => {
    it('should remove RACI assignment successfully', async () => {
      mockPrismaService.taskRACI.findUnique.mockResolvedValue({
        taskId: 'task-1',
        userId: 'user-1',
        role: 'RESPONSIBLE',
      });
      mockPrismaService.taskRACI.delete.mockResolvedValue({});

      const result = await service.removeRACI(
        'task-1',
        'user-1',
        'RESPONSIBLE',
      );

      expect(result.message).toBe('Assignation RACI supprimée avec succès');
    });

    it('should throw error when RACI assignment not found', async () => {
      mockPrismaService.taskRACI.findUnique.mockResolvedValue(null);

      await expect(
        service.removeRACI('task-1', 'user-1', 'RESPONSIBLE'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTasksByAssignee', () => {
    it('should return tasks assigned to user', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', assigneeId: 'user-1' },
        { id: 'task-2', title: 'Task 2', assigneeId: 'user-1' },
      ];

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);

      const result = await service.getTasksByAssignee('user-1');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { assigneeId: 'user-1' },
              { assignees: { some: { userId: 'user-1' } } },
            ],
          },
        }),
      );
    });
  });

  describe('getTasksByProject', () => {
    it('should return tasks for a project', async () => {
      const mockProject = { id: 'project-1' };
      const mockTasks = [
        { id: 'task-1', projectId: 'project-1' },
        { id: 'task-2', projectId: 'project-1' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);

      const result = await service.getTasksByProject('project-1');

      expect(result).toHaveLength(2);
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getTasksByProject('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('importTasks', () => {
    const projectId = 'project-1';
    const mockProject = { id: projectId, name: 'Test Project' };

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.importTasks(projectId, [])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should import a valid task successfully', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst.mockResolvedValue(null);
      mockPrismaService.task.create.mockResolvedValue({ id: 'new-task-1' });

      const tasks = [{ title: 'New Task' }];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'New Task',
            projectId,
            status: TaskStatus.TODO,
            priority: Priority.NORMAL,
          }) as object,
        }),
      );
    });

    it('should skip tasks that already exist in the project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst.mockResolvedValue({
        id: 'existing-task',
        title: 'Existing Task',
      });

      const tasks = [{ title: 'Existing Task' }];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
      expect(result.errorDetails).toContain(
        'Ligne 2: Tâche "Existing Task" existe déjà',
      );
    });

    it('should resolve assignee by email', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'john@example.com',
          isActive: true,
        },
      ]);
      mockPrismaService.task.findFirst.mockResolvedValue(null);
      mockPrismaService.task.create.mockResolvedValue({ id: 'new-task-1' });

      const tasks = [
        { title: 'Task with assignee', assigneeEmail: 'john@example.com' },
      ];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.created).toBe(1);
      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assigneeId: 'user-1',
          }) as object,
        }),
      );
    });

    it('should error when assignee email is not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      const tasks = [
        {
          title: 'Task with unknown assignee',
          assigneeEmail: 'unknown@example.com',
        },
      ];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.errors).toBe(1);
      expect(result.created).toBe(0);
      expect(result.errorDetails[0]).toContain('unknown@example.com');
    });

    it('should resolve milestone by name', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([
        { id: 'ms-1', name: 'Sprint 1', projectId },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst.mockResolvedValue(null);
      mockPrismaService.task.create.mockResolvedValue({ id: 'new-task-1' });

      const tasks = [
        { title: 'Task with milestone', milestoneName: 'Sprint 1' },
      ];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.created).toBe(1);
      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            milestoneId: 'ms-1',
          }) as object,
        }),
      );
    });

    it('should error when milestone name is not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      const tasks = [
        {
          title: 'Task with unknown milestone',
          milestoneName: 'Unknown Sprint',
        },
      ];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.errors).toBe(1);
      expect(result.created).toBe(0);
      expect(result.errorDetails[0]).toContain('Unknown Sprint');
    });

    it('should parse valid status and priority', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst.mockResolvedValue(null);
      mockPrismaService.task.create.mockResolvedValue({ id: 'new-task-1' });

      const tasks = [
        { title: 'Task', status: 'in_progress', priority: 'high' },
      ];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.created).toBe(1);
      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TaskStatus.IN_PROGRESS,
            priority: Priority.HIGH,
          }) as object,
        }),
      );
    });

    it('should default to TODO/NORMAL for unrecognized status/priority', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst.mockResolvedValue(null);
      mockPrismaService.task.create.mockResolvedValue({ id: 'new-task-1' });

      const tasks = [
        { title: 'Task', status: 'INVALID_STATUS', priority: 'INVALID_PRIO' },
      ];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.created).toBe(1);
      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TaskStatus.TODO,
            priority: Priority.NORMAL,
          }) as object,
        }),
      );
    });

    it('should handle task creation errors gracefully', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst.mockResolvedValue(null);
      mockPrismaService.task.create.mockRejectedValue(
        new Error('Database error'),
      );

      const tasks = [{ title: 'Task that fails' }];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.errors).toBe(1);
      expect(result.created).toBe(0);
      expect(result.errorDetails[0]).toContain('Database error');
    });

    it('should import multiple tasks and count results correctly', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing', title: 'Task B' })
        .mockResolvedValueOnce(null);
      mockPrismaService.task.create.mockResolvedValue({ id: 'new' });

      const tasks = [
        { title: 'Task A' },
        { title: 'Task B' },
        { title: 'Task C' },
      ];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(1);
    });

    it('should parse dates and estimated hours in task data', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst.mockResolvedValue(null);
      mockPrismaService.task.create.mockResolvedValue({ id: 'new-task-1' });

      const tasks = [
        {
          title: 'Task with dates',
          startDate: '2025-01-15',
          endDate: '2025-01-20',
          estimatedHours: 8,
          description: 'Some desc',
        },
      ];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.created).toBe(1);
      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startDate: new Date('2025-01-15'),
            endDate: new Date('2025-01-20'),
            estimatedHours: 8,
            description: 'Some desc',
          }) as object,
        }),
      );
    });
  });

  describe('validateImport', () => {
    const projectId = 'project-1';
    const mockProject = { id: projectId, name: 'Test Project' };

    const setupValidationMocks = () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
    };

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.validateImport(projectId, [])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate a valid task as ready for import', async () => {
      setupValidationMocks();

      const tasks = [{ title: 'New Task' }];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].status).toBe('valid');
      expect(result.valid[0].messages).toContain('Prêt à être importé');
      expect(result.summary.valid).toBe(1);
      expect(result.summary.total).toBe(1);
    });

    it('should flag tasks with empty title as error', async () => {
      setupValidationMocks();

      const tasks = [{ title: '' }];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].status).toBe('error');
      expect(result.errors[0].messages).toContain('Le titre est obligatoire');
      expect(result.summary.errors).toBe(1);
    });

    it('should flag duplicate tasks', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([
        { title: 'Existing Task' },
      ]);

      const tasks = [{ title: 'Existing Task' }];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].status).toBe('duplicate');
      expect(result.summary.duplicates).toBe(1);
    });

    it('should detect duplicates within the same import batch', async () => {
      setupValidationMocks();

      const tasks = [{ title: 'Same Title' }, { title: 'Same Title' }];

      const result = await service.validateImport(projectId, tasks as any);

      // First one should be valid, second should be duplicate
      expect(result.valid).toHaveLength(1);
      expect(result.duplicates).toHaveLength(1);
      expect(result.summary.valid).toBe(1);
      expect(result.summary.duplicates).toBe(1);
    });

    it('should error when assignee email is not found', async () => {
      setupValidationMocks();

      const tasks = [
        { title: 'Task', assigneeEmail: 'nonexistent@example.com' },
      ];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].messages[0]).toContain('nonexistent@example.com');
      expect(result.summary.errors).toBe(1);
    });

    it('should resolve assignee and include in preview item', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
        },
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([]);

      const tasks = [{ title: 'Task', assigneeEmail: 'john@example.com' }];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].resolvedAssignee).toEqual({
        id: 'user-1',
        email: 'john@example.com',
        name: 'John Doe',
      });
    });

    it('should error when milestone name is not found', async () => {
      setupValidationMocks();

      const tasks = [{ title: 'Task', milestoneName: 'Unknown Sprint' }];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].messages[0]).toContain('Unknown Sprint');
      expect(result.summary.errors).toBe(1);
    });

    it('should resolve milestone and include in preview item', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([
        { id: 'ms-1', name: 'Sprint 1', projectId },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);

      const tasks = [{ title: 'Task', milestoneName: 'Sprint 1' }];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].resolvedMilestone).toEqual({
        id: 'ms-1',
        name: 'Sprint 1',
      });
    });

    it('should warn on unrecognized status', async () => {
      setupValidationMocks();

      const tasks = [{ title: 'Task', status: 'INVALID_STATUS' }];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].status).toBe('warning');
      expect(result.warnings[0].messages[0]).toContain('Statut');
      expect(result.warnings[0].messages[0]).toContain('INVALID_STATUS');
      expect(result.summary.warnings).toBe(1);
    });

    it('should warn on unrecognized priority', async () => {
      setupValidationMocks();

      const tasks = [{ title: 'Task', priority: 'INVALID_PRIO' }];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].messages[0]).toContain('Priorité');
      expect(result.warnings[0].messages[0]).toContain('INVALID_PRIO');
      expect(result.summary.warnings).toBe(1);
    });

    it('should error on invalid start date', async () => {
      setupValidationMocks();

      const tasks = [
        { title: 'Task', startDate: 'not-a-date', endDate: '2025-01-20' },
      ];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].messages[0]).toContain('Date de début invalide');
      expect(result.summary.errors).toBe(1);
    });

    it('should error on invalid end date', async () => {
      setupValidationMocks();

      const tasks = [
        { title: 'Task', startDate: '2025-01-15', endDate: 'not-a-date' },
      ];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].messages[0]).toContain('Date de fin invalide');
      expect(result.summary.errors).toBe(1);
    });

    it('should warn when end date is before or equal to start date', async () => {
      setupValidationMocks();

      const tasks = [
        { title: 'Task', startDate: '2025-01-20', endDate: '2025-01-15' },
      ];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].messages[0]).toContain('antérieure ou égale');
      expect(result.summary.warnings).toBe(1);
    });

    it('should handle a mix of valid, duplicate, error, and warning items', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([
        { title: 'Duplicate Task' },
      ]);

      const tasks = [
        { title: 'Valid Task' },
        { title: 'Duplicate Task' },
        { title: '' },
        { title: 'Warn Task', status: 'BOGUS' },
      ];

      const result = await service.validateImport(projectId, tasks as any);

      expect(result.summary.total).toBe(4);
      expect(result.summary.valid).toBe(1);
      expect(result.summary.duplicates).toBe(1);
      expect(result.summary.errors).toBe(1);
      expect(result.summary.warnings).toBe(1);
    });
  });

  describe('getImportTemplate', () => {
    it('should return a CSV template string with headers', () => {
      const template = service.getImportTemplate();

      expect(template).toContain('title');
      expect(template).toContain('description');
      expect(template).toContain('status');
      expect(template).toContain('priority');
      expect(template).toContain('assigneeEmail');
      expect(template).toContain('milestoneName');
      expect(template).toContain('estimatedHours');
      expect(template).toContain('startDate');
      expect(template).toContain('endDate');
    });

    it('should use semicolon as separator', () => {
      const template = service.getImportTemplate();
      const firstLine = template.split('\n')[0];

      expect(firstLine).toBe(
        'title;description;status;priority;assigneeEmail;milestoneName;estimatedHours;startDate;endDate',
      );
    });

    it('should include example comments on second line', () => {
      const template = service.getImportTemplate();
      const lines = template.split('\n');

      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('# Exemple');
    });
  });

  describe('findOrphans', () => {
    it('should return tasks without a project', async () => {
      const orphanTasks = [
        {
          id: 'task-1',
          title: 'Orphan 1',
          projectId: null,
          assignee: null,
          assignees: [],
          _count: { dependencies: 0, dependents: 0, comments: 0 },
        },
        {
          id: 'task-2',
          title: 'Orphan 2',
          projectId: null,
          assignee: null,
          assignees: [],
          _count: { dependencies: 0, dependents: 0, comments: 0 },
        },
      ];

      mockPrismaService.task.findMany.mockResolvedValue(orphanTasks);

      const result = await service.findOrphans();

      expect(result).toHaveLength(2);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: null },
        }),
      );
    });

    it('should return empty array when no orphan tasks exist', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);

      const result = await service.findOrphans();

      expect(result).toHaveLength(0);
    });

    it('should include assignee and counts in returned orphans', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);

      await service.findOrphans();

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            assignee: expect.any(Object),
            assignees: expect.any(Object),
            _count: expect.any(Object),
          }) as object,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('attachToProject', () => {
    it('should attach an orphan task to a project', async () => {
      const mockTask = { id: 'task-1', projectId: null };
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const updatedTask = {
        ...mockTask,
        projectId: 'project-1',
        project: { id: 'project-1', name: 'Test Project' },
        assignee: null,
      };

      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.task.update.mockResolvedValue(updatedTask);

      const result = await service.attachToProject('task-1', 'project-1');

      expect(result.projectId).toBe('project-1');
      expect(mockPrismaService.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: { projectId: 'project-1' },
        }),
      );
    });

    it('should throw NotFoundException when task does not exist', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(
        service.attachToProject('nonexistent', 'project-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: null,
      });
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.attachToProject('task-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('detachFromProject', () => {
    it('should detach a task from its project', async () => {
      const mockTask = { id: 'task-1', projectId: 'project-1' };
      const detachedTask = {
        ...mockTask,
        projectId: null,
        epicId: null,
        milestoneId: null,
        assignee: null,
      };

      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.task.update.mockResolvedValue(detachedTask);

      const result = await service.detachFromProject('task-1');

      expect(result.projectId).toBeNull();
      expect(mockPrismaService.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: {
            projectId: null,
            epicId: null,
            milestoneId: null,
          },
        }),
      );
    });

    it('should throw NotFoundException when task does not exist', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.detachFromProject('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should clear epicId and milestoneId when detaching', async () => {
      const mockTask = {
        id: 'task-1',
        projectId: 'project-1',
        epicId: 'epic-1',
        milestoneId: 'ms-1',
      };

      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.task.update.mockResolvedValue({
        ...mockTask,
        projectId: null,
        epicId: null,
        milestoneId: null,
        assignee: null,
      });

      await service.detachFromProject('task-1');

      expect(mockPrismaService.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: null,
            epicId: null,
            milestoneId: null,
          }) as object,
        }),
      );
    });
  });
});
