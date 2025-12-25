import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

describe('TasksController', () => {
  let controller: TasksController;
  let tasksService: TasksService;

  const mockTask = {
    id: 'task-id-1',
    title: 'Test Task',
    description: 'A test task',
    status: 'TODO',
    priority: 'NORMAL',
    projectId: 'project-id-1',
    epicId: null,
    milestoneId: null,
    assigneeId: 'user-id-1',
    estimatedHours: 8,
    progress: 0,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
    project: { id: 'project-id-1', name: 'Test Project' },
    assignee: { id: 'user-id-1', firstName: 'John', lastName: 'Doe' },
    dependencies: [],
    dependents: [],
    raci: [],
    comments: [],
    timeEntries: [],
  };

  const mockTasksService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getTasksByAssignee: vi.fn(),
    getTasksByProject: vi.fn(),
    addDependency: vi.fn(),
    removeDependency: vi.fn(),
    assignRACI: vi.fn(),
    removeRACI: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    tasksService = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createTaskDto = {
      title: 'New Task',
      description: 'A new task',
      projectId: 'project-id-1',
      status: 'TODO' as const,
      priority: 'HIGH' as const,
      estimatedHours: 4,
    };

    it('should create a new task successfully', async () => {
      const expectedTask = { ...mockTask, ...createTaskDto, id: 'new-task-id' };
      mockTasksService.create.mockResolvedValue(expectedTask);

      const result = await controller.create(createTaskDto);

      expect(result).toEqual(expectedTask);
      expect(mockTasksService.create).toHaveBeenCalledWith(createTaskDto);
      expect(mockTasksService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockTasksService.create.mockRejectedValue(
        new NotFoundException('Projet introuvable'),
      );

      await expect(controller.create(createTaskDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create task with assignee', async () => {
      const taskWithAssignee = {
        ...createTaskDto,
        assigneeId: 'user-id-1',
      };
      const expectedTask = { ...mockTask, ...taskWithAssignee };
      mockTasksService.create.mockResolvedValue(expectedTask);

      const result = await controller.create(taskWithAssignee);

      expect(result.assigneeId).toBe('user-id-1');
    });

    it('should create task with epic and milestone', async () => {
      const taskWithRelations = {
        ...createTaskDto,
        epicId: 'epic-id-1',
        milestoneId: 'milestone-id-1',
      };
      const expectedTask = { ...mockTask, ...taskWithRelations };
      mockTasksService.create.mockResolvedValue(expectedTask);

      const result = await controller.create(taskWithRelations);

      expect(result.epicId).toBe('epic-id-1');
      expect(result.milestoneId).toBe('milestone-id-1');
    });
  });

  describe('findAll', () => {
    it('should return paginated tasks', async () => {
      const paginatedResult = {
        data: [mockTask],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockTasksService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockTasksService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should filter tasks by status', async () => {
      const todoTasks = [mockTask];
      const paginatedResult = {
        data: todoTasks,
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockTasksService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10, 'TODO' as any);

      expect(result.data[0].status).toBe('TODO');
      expect(mockTasksService.findAll).toHaveBeenCalledWith(
        1,
        10,
        'TODO',
        undefined,
        undefined,
      );
    });

    it('should filter tasks by projectId', async () => {
      const paginatedResult = {
        data: [mockTask],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockTasksService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll(1, 10, undefined, 'project-id-1');

      expect(mockTasksService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        'project-id-1',
        undefined,
      );
    });

    it('should filter tasks by assigneeId', async () => {
      const paginatedResult = {
        data: [mockTask],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockTasksService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll(1, 10, undefined, undefined, 'user-id-1');

      expect(mockTasksService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        'user-id-1',
      );
    });

    it('should combine multiple filters', async () => {
      const paginatedResult = {
        data: [mockTask],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockTasksService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll(
        1,
        10,
        'IN_PROGRESS' as any,
        'project-id-1',
        'user-id-1',
      );

      expect(mockTasksService.findAll).toHaveBeenCalledWith(
        1,
        10,
        'IN_PROGRESS',
        'project-id-1',
        'user-id-1',
      );
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      mockTasksService.findOne.mockResolvedValue(mockTask);

      const result = await controller.findOne('task-id-1');

      expect(result).toEqual(mockTask);
      expect(mockTasksService.findOne).toHaveBeenCalledWith('task-id-1');
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTasksService.findOne.mockRejectedValue(
        new NotFoundException('Tâche introuvable'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTasksByAssignee', () => {
    it('should return tasks assigned to a user', async () => {
      const userTasks = [mockTask];
      mockTasksService.getTasksByAssignee.mockResolvedValue(userTasks);

      const result = await controller.getTasksByAssignee('user-id-1');

      expect(result).toEqual(userTasks);
      expect(mockTasksService.getTasksByAssignee).toHaveBeenCalledWith(
        'user-id-1',
      );
    });

    it('should return empty array when user has no tasks', async () => {
      mockTasksService.getTasksByAssignee.mockResolvedValue([]);

      const result = await controller.getTasksByAssignee('user-without-tasks');

      expect(result).toEqual([]);
    });
  });

  describe('getTasksByProject', () => {
    it('should return tasks for a project', async () => {
      const projectTasks = [mockTask];
      mockTasksService.getTasksByProject.mockResolvedValue(projectTasks);

      const result = await controller.getTasksByProject('project-id-1');

      expect(result).toEqual(projectTasks);
      expect(mockTasksService.getTasksByProject).toHaveBeenCalledWith(
        'project-id-1',
      );
    });

    it('should throw NotFoundException when project not found', async () => {
      mockTasksService.getTasksByProject.mockRejectedValue(
        new NotFoundException('Projet introuvable'),
      );

      await expect(controller.getTasksByProject('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateTaskDto = {
      title: 'Updated Task Title',
      status: 'IN_PROGRESS' as const,
      progress: 25,
    };

    it('should update a task successfully', async () => {
      const updatedTask = { ...mockTask, ...updateTaskDto };
      mockTasksService.update.mockResolvedValue(updatedTask);

      const result = await controller.update('task-id-1', updateTaskDto);

      expect(result).toEqual(updatedTask);
      expect(result.title).toBe('Updated Task Title');
      expect(result.status).toBe('IN_PROGRESS');
      expect(mockTasksService.update).toHaveBeenCalledWith(
        'task-id-1',
        updateTaskDto,
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTasksService.update.mockRejectedValue(
        new NotFoundException('Tâche introuvable'),
      );

      await expect(
        controller.update('nonexistent', updateTaskDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update task to DONE with 100% progress', async () => {
      const completedTask = { ...mockTask, status: 'DONE', progress: 100 };
      mockTasksService.update.mockResolvedValue(completedTask);

      const result = await controller.update('task-id-1', {
        status: 'DONE',
        progress: 100,
      });

      expect(result.status).toBe('DONE');
      expect(result.progress).toBe(100);
    });
  });

  describe('remove', () => {
    it('should delete a task', async () => {
      mockTasksService.remove.mockResolvedValue({ message: 'Tâche supprimée' });

      const result = await controller.remove('task-id-1');

      expect(result.message).toBe('Tâche supprimée');
      expect(mockTasksService.remove).toHaveBeenCalledWith('task-id-1');
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTasksService.remove.mockRejectedValue(
        new NotFoundException('Tâche introuvable'),
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when task has dependents', async () => {
      mockTasksService.remove.mockRejectedValue(
        new BadRequestException(
          'Impossible de supprimer: cette tâche a des dépendances',
        ),
      );

      await expect(controller.remove('task-with-dependents')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('addDependency', () => {
    const addDependencyDto = {
      dependsOnTaskId: 'task-id-2',
    };

    it('should add a dependency successfully', async () => {
      const dependency = {
        id: 'dep-id-1',
        taskId: 'task-id-1',
        dependsOnTaskId: 'task-id-2',
      };

      mockTasksService.addDependency.mockResolvedValue(dependency);

      const result = await controller.addDependency(
        'task-id-1',
        addDependencyDto,
      );

      expect(result).toEqual(dependency);
      expect(mockTasksService.addDependency).toHaveBeenCalledWith(
        'task-id-1',
        addDependencyDto,
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTasksService.addDependency.mockRejectedValue(
        new NotFoundException('Tâche introuvable'),
      );

      await expect(
        controller.addDependency('nonexistent', addDependencyDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for circular dependency', async () => {
      mockTasksService.addDependency.mockRejectedValue(
        new BadRequestException('Dépendance circulaire détectée'),
      );

      await expect(
        controller.addDependency('task-id-1', addDependencyDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when tasks are from different projects', async () => {
      mockTasksService.addDependency.mockRejectedValue(
        new BadRequestException('Les tâches doivent appartenir au même projet'),
      );

      await expect(
        controller.addDependency('task-id-1', addDependencyDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when dependency already exists', async () => {
      mockTasksService.addDependency.mockRejectedValue(
        new ConflictException('Cette dépendance existe déjà'),
      );

      await expect(
        controller.addDependency('task-id-1', addDependencyDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeDependency', () => {
    it('should remove a dependency', async () => {
      mockTasksService.removeDependency.mockResolvedValue({
        message: 'Dépendance supprimée',
      });

      const result = await controller.removeDependency(
        'task-id-1',
        'task-id-2',
      );

      expect(result.message).toBe('Dépendance supprimée');
      expect(mockTasksService.removeDependency).toHaveBeenCalledWith(
        'task-id-1',
        'task-id-2',
      );
    });

    it('should throw NotFoundException when dependency not found', async () => {
      mockTasksService.removeDependency.mockRejectedValue(
        new NotFoundException('Dépendance introuvable'),
      );

      await expect(
        controller.removeDependency('task-id-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignRACI', () => {
    const assignRACIDto = {
      userId: 'user-id-1',
      role: 'RESPONSIBLE' as const,
    };

    it('should assign RACI role successfully', async () => {
      const raciAssignment = {
        id: 'raci-id-1',
        taskId: 'task-id-1',
        userId: 'user-id-1',
        role: 'RESPONSIBLE',
      };

      mockTasksService.assignRACI.mockResolvedValue(raciAssignment);

      const result = await controller.assignRACI('task-id-1', assignRACIDto);

      expect(result).toEqual(raciAssignment);
      expect(mockTasksService.assignRACI).toHaveBeenCalledWith(
        'task-id-1',
        assignRACIDto,
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTasksService.assignRACI.mockRejectedValue(
        new NotFoundException('Tâche introuvable'),
      );

      await expect(
        controller.assignRACI('nonexistent', assignRACIDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockTasksService.assignRACI.mockRejectedValue(
        new NotFoundException('Utilisateur introuvable'),
      );

      await expect(
        controller.assignRACI('task-id-1', assignRACIDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when RACI assignment already exists', async () => {
      mockTasksService.assignRACI.mockRejectedValue(
        new ConflictException('Cette assignation RACI existe déjà'),
      );

      await expect(
        controller.assignRACI('task-id-1', assignRACIDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeRACI', () => {
    it('should remove RACI assignment', async () => {
      mockTasksService.removeRACI.mockResolvedValue({
        message: 'Assignation RACI supprimée',
      });

      const result = await controller.removeRACI(
        'task-id-1',
        'user-id-1',
        'RESPONSIBLE',
      );

      expect(result.message).toBe('Assignation RACI supprimée');
      expect(mockTasksService.removeRACI).toHaveBeenCalledWith(
        'task-id-1',
        'user-id-1',
        'RESPONSIBLE',
      );
    });

    it('should throw NotFoundException when RACI assignment not found', async () => {
      mockTasksService.removeRACI.mockRejectedValue(
        new NotFoundException('Assignation RACI introuvable'),
      );

      await expect(
        controller.removeRACI('task-id-1', 'user-id-1', 'RESPONSIBLE'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
