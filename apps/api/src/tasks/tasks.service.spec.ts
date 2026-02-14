import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TaskStatus, RACIRole, Role } from 'database';

describe('TasksService', () => {
  let service: TasksService;

  const mockPrismaService = {
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
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
});
