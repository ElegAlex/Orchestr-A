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
import { getTaskProgress } from './task-progress.helper';
import { PermissionsService } from '../rbac/permissions.service';
import { AccessScopeService } from '../common/services/access-scope.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { AuditAction } from '../audit/audit.service';
import { validatePayloadForAction } from '../audit/payload-schemas';

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
    subtask: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    timeEntry: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    userService: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    projectMember: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return (arg as (tx: typeof mockPrismaService) => Promise<unknown>)(
        mockPrismaService,
      );
    }),
  };

  // OBS-026 — the CSV export emits a fire-and-forget DATA_EXPORTED audit row.
  const mockAuditPersistence = { log: vi.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PermissionsService,
          useValue: {
            // Par défaut, les tests supposent un utilisateur ADMIN disposant
            // du bypass de membership (`projects:manage_any` OR
            // `tasks:assign_any_user`) — cohérent avec `mockUser.role = ADMIN`.
            getPermissionsForRole: vi
              .fn()
              .mockResolvedValue([
                'tasks:create',
                'tasks:readAll',
                'tasks:manage_any',
                'tasks:assign_any_user',
                'projects:manage_any',
              ]),
          },
        },
        {
          provide: AccessScopeService,
          useValue: {
            taskReadWhere: vi.fn().mockResolvedValue({}),
            assertCanReadTask: vi.fn().mockResolvedValue(undefined),
            assertCanAccessProject: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditPersistenceService,
          useValue: mockAuditPersistence,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    mockAuditPersistence.log.mockResolvedValue(undefined);
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

    it('should apply take/skip cap even when a date filter is present (PER-007)', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      await service.findAll(
        1,
        1000,
        undefined,
        undefined,
        undefined,
        '2026-04-13',
        '2026-04-19',
      );

      // PER-027: limit=1000 is capped at 100 (hard cap lowered from 1000)
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 0,
        }),
      );
    });

    it('COR-020: overdue+status — caller status must survive, not-DONE constraint must reach AND (not clobber)', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      // status=TODO + overdue=true: caller status must stay TODO, and {status:{not:DONE}} goes to AND
      await service.findAll(
        1,
        10,
        TaskStatus.TODO, // caller status — must not be overwritten
        undefined,
        undefined,
        undefined,
        undefined,
        true, // overdue=true
      );

      const findManyCall = mockPrismaService.task.findMany.mock.calls[0][0] as {
        where: { status?: unknown; AND?: unknown[] };
      };
      const { where } = findManyCall;

      // Caller-supplied status must not be overwritten by overdue logic
      expect(where.status).toBe(TaskStatus.TODO);

      // Overdue not-DONE constraint must be present in AND
      expect(where.AND).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: { not: TaskStatus.DONE } }),
        ]),
      );
    });

    it('COR-020: overdue+startDate — endDate lt:now must survive in AND alongside gte:startDate', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      // startDate only + overdue: both {endDate:{lt:now}} and {endDate:{gte:startDate}} must coexist in AND
      await service.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        '2020-01-01', // startDate
        undefined,
        true, // overdue=true
      );

      const findManyCall = mockPrismaService.task.findMany.mock.calls[0][0] as {
        where: { endDate?: unknown; AND?: unknown[] };
      };
      const { where } = findManyCall;

      // endDate lt:now constraint must be in AND (not clobbered by gte branch)
      expect(where.AND).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            endDate: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        ]),
      );
    });
  });

  describe('findForPlanningOverview', () => {
    const planningUser = { id: 'user-1', role: 'ADMIN' };

    beforeEach(() => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
    });

    it('always enforces the 500-row hard cap to prevent unbounded fetch (PER-008)', async () => {
      await service.findForPlanningOverview(
        '2026-01-01',
        '2026-06-30',
        planningUser,
      );

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 }),
      );
    });

    it('applies date-overlap filter (endDate >= startDate)', async () => {
      await service.findForPlanningOverview(
        '2026-01-01',
        '2026-06-30',
        planningUser,
      );

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                endDate: { gte: new Date('2026-01-01') },
              }),
            ]) as unknown[],
          }) as object,
        }),
      );
    });

    it('returns data array from planning overview', async () => {
      const mockTasks = [{ id: 't1', title: 'Planning task', status: 'TODO' }];
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);

      const result = await service.findForPlanningOverview(
        '2026-01-01',
        '2026-06-30',
        planningUser,
      );

      expect(result).toEqual({ data: mockTasks });
    });

    // Regression: the planning grid (DayCell) styles external-intervention tasks
    // in red and draws a red cell overlay, both driven by task.isExternalIntervention.
    // The explicit select MUST expose the field, otherwise the frontend receives
    // `undefined` (falsy) and renders an external task as a normal one.
    it('selects isExternalIntervention so the planning can render the external visual', async () => {
      await service.findForPlanningOverview(
        '2026-01-01',
        '2026-06-30',
        planningUser,
      );

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ isExternalIntervention: true }),
        }),
      );
    });

    // The planning cell (DayCell) also renders the task schedule and effort:
    // 🕐 startTime–endTime and ⏱️ estimatedHours. The curated select must expose
    // them, otherwise the planning silently never shows hours or estimated effort.
    it('selects the schedule/effort fields the planning cell renders', async () => {
      await service.findForPlanningOverview(
        '2026-01-01',
        '2026-06-30',
        planningUser,
      );

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            startTime: true,
            endTime: true,
            estimatedHours: true,
          }),
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
    it('should return paginated tasks assigned to user with totalLoggedHours=0 when no entries', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          assigneeId: 'user-1',
          timeEntries: [],
        },
        {
          id: 'task-2',
          title: 'Task 2',
          assigneeId: 'user-1',
          timeEntries: [],
        },
      ];

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(2);

      const result = await service.getTasksByAssignee('user-1');

      // Bare array (route contract: "toutes les tâches assignées") — no envelope.
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'task-1',
        totalLoggedHours: 0,
      });
      expect(result[1]).toMatchObject({
        id: 'task-2',
        totalLoggedHours: 0,
      });
      // timeEntries must be stripped from the response shape
      expect(result[0]).not.toHaveProperty('timeEntries');
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { assigneeId: 'user-1' },
              { assignees: { some: { userId: 'user-1' } } },
            ],
          },
          include: expect.objectContaining({
            timeEntries: {
              where: { isDismissal: false },
              select: { hours: true },
            },
          }),
        }),
      );
    });

    it('should aggregate hours per task and exclude dismissals', async () => {
      // timeEntries are folded into findMany include; groupBy is no longer called.
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          timeEntries: [{ hours: 2 }, { hours: 1.5 }],
        },
        { id: 'task-2', title: 'Task 2', timeEntries: [] },
      ];

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(2);
      mockPrismaService.timeEntry.groupBy.mockClear();

      const result = await service.getTasksByAssignee('user-1');

      expect(result).toEqual([
        expect.objectContaining({ id: 'task-1', totalLoggedHours: 3.5 }),
        expect.objectContaining({ id: 'task-2', totalLoggedHours: 0 }),
      ]);
      expect(mockPrismaService.timeEntry.groupBy).not.toHaveBeenCalled();
    });

    it('should skip groupBy call when no tasks returned', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.timeEntry.groupBy.mockClear();

      const result = await service.getTasksByAssignee('user-1');

      expect(result).toEqual([]);
      expect(mockPrismaService.timeEntry.groupBy).not.toHaveBeenCalled();
    });

    it('PER-023: should NOT call timeEntry.groupBy when tasks exist — single-pass only', async () => {
      // On unfixed code this is RED: timeEntry.groupBy is called even when tasks exist.
      // After the fix (timeEntries folded into findMany include), groupBy must never be called.
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          assigneeId: 'user-1',
          timeEntries: [{ hours: 2 }, { hours: 1.5 }],
        },
      ];
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(1);
      mockPrismaService.timeEntry.groupBy.mockClear();

      const result = await service.getTasksByAssignee('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].totalLoggedHours).toBeCloseTo(3.5);
      expect(mockPrismaService.timeEntry.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('getMyDoneUndeclaredTasks', () => {
    it('should query DONE tasks assigned to user without TimeEntry of this user', async () => {
      const mockTasks = [{ id: 'task-1', title: 'Task 1', status: 'DONE' }];
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);

      const result = await service.getMyDoneUndeclaredTasks('user-1');

      expect(result).toEqual(mockTasks);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { status: 'DONE' },
              {
                OR: [
                  { assigneeId: 'user-1' },
                  { assignees: { some: { userId: 'user-1' } } },
                ],
              },
              { NOT: { timeEntries: { some: { userId: 'user-1' } } } },
            ],
          },
          include: {
            project: { select: { id: true, name: true } },
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                avatarPreset: true,
              },
            },
          },
          orderBy: { endDate: 'desc' },
          take: 50,
        }),
      );
    });

    it('should return an empty array when no tasks match', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);

      const result = await service.getMyDoneUndeclaredTasks('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getTasksByProject', () => {
    it('should return paginated tasks for a project', async () => {
      const mockProject = { id: 'project-1' };
      const mockTasks = [
        { id: 'task-1', projectId: 'project-1' },
        { id: 'task-2', projectId: 'project-1' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(2);

      const result = await service.getTasksByProject('project-1');

      // Bare array (route contract: "toutes les tâches d'un projet") — no envelope.
      expect(Array.isArray(result)).toBe(true);
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
      // PER-024: pre-fetch of existing titles replaces per-row findFirst
      mockPrismaService.task.findMany.mockResolvedValue([]);
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

    it('COR-002 — writes each task and its subtasks atomically in one $transaction', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findFirst.mockResolvedValue(null);
      mockPrismaService.task.create.mockResolvedValue({ id: 'new-task-1' });
      mockPrismaService.subtask.create.mockResolvedValue({ id: 'sub-1' });

      const tasks = [{ title: 'Parent', subtasks: 'Sub A | Sub B' }];

      const result = await service.importTasks(projectId, tasks as any);

      expect(result.created).toBe(1);
      // The parent task row and its subtasks must be written inside a single
      // transaction so a mid-loop subtask failure rolls the task back (no
      // orphaned task row). Pre-fix there is no $transaction wrapping.
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.task.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.subtask.create).toHaveBeenCalledTimes(2);
    });

    it('should skip tasks that already exist in the project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      // Pre-fetch returns the existing task title
      mockPrismaService.task.findMany.mockResolvedValue([
        { title: 'Existing Task' },
      ]);

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
      mockPrismaService.task.findMany.mockResolvedValue([]);
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
      mockPrismaService.task.findMany.mockResolvedValue([]);

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
      mockPrismaService.task.findMany.mockResolvedValue([]);
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
      mockPrismaService.task.findMany.mockResolvedValue([]);

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
      mockPrismaService.task.findMany.mockResolvedValue([]);
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
      mockPrismaService.task.findMany.mockResolvedValue([]);
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
      mockPrismaService.task.findMany.mockResolvedValue([]);
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
      // Pre-fetch returns 'Task B' as existing — Task A and C are new
      mockPrismaService.task.findMany.mockResolvedValue([{ title: 'Task B' }]);
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
      mockPrismaService.task.findMany.mockResolvedValue([]);
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
        'title;description;status;priority;assigneeEmail;milestoneName;estimatedHours;startDate;endDate;subtasks',
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

  describe('getTaskProgress helper', () => {
    it('should return 0 for TODO', () => {
      expect(getTaskProgress(TaskStatus.TODO)).toBe(0);
    });

    it('should return 50 for IN_PROGRESS', () => {
      expect(getTaskProgress(TaskStatus.IN_PROGRESS)).toBe(50);
    });

    it('should return 75 for IN_REVIEW', () => {
      expect(getTaskProgress('IN_REVIEW' as TaskStatus)).toBe(75);
    });

    it('should return 100 for DONE', () => {
      expect(getTaskProgress(TaskStatus.DONE)).toBe(100);
    });

    it('should return 25 for BLOCKED', () => {
      expect(getTaskProgress(TaskStatus.BLOCKED)).toBe(25);
    });
  });

  describe('create - auto progress', () => {
    const mockUser = { id: 'user-1', role: Role.ADMIN };

    it('should set progress=0 when creating with TODO status', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrismaService.task.create.mockResolvedValue({
        id: '1',
        title: 'T',
        status: TaskStatus.TODO,
        progress: 0,
      });

      await service.create(
        { title: 'T', projectId: 'p1', status: TaskStatus.TODO },
        mockUser,
      );

      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ progress: 0 }) as object,
        }),
      );
    });

    it('should set progress=50 when creating with IN_PROGRESS status', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrismaService.task.create.mockResolvedValue({
        id: '1',
        title: 'T',
        status: TaskStatus.IN_PROGRESS,
        progress: 50,
      });

      await service.create(
        { title: 'T', projectId: 'p1', status: TaskStatus.IN_PROGRESS },
        mockUser,
      );

      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ progress: 50 }) as object,
        }),
      );
    });

    it('should default to TODO progress=0 when no status provided', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrismaService.task.create.mockResolvedValue({ id: '1', title: 'T' });

      await service.create({ title: 'T', projectId: 'p1' }, mockUser);

      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ progress: 0 }) as object,
        }),
      );
    });
  });

  describe('update - auto progress', () => {
    it('should recalculate progress when status changes to DONE', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: '1',
        status: TaskStatus.TODO,
      });
      mockPrismaService.task.update.mockResolvedValue({
        id: '1',
        status: TaskStatus.DONE,
        progress: 100,
      });

      await service.update('1', { status: TaskStatus.DONE });

      expect(mockPrismaService.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ progress: 100 }) as object,
        }),
      );
    });

    it('should recalculate progress when status changes to IN_REVIEW', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: '1',
        status: TaskStatus.IN_PROGRESS,
      });
      mockPrismaService.task.update.mockResolvedValue({
        id: '1',
        status: 'IN_REVIEW',
        progress: 75,
      });

      await service.update('1', { status: 'IN_REVIEW' as TaskStatus });

      expect(mockPrismaService.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ progress: 75 }) as object,
        }),
      );
    });

    it('should not set progress when status is not changed', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: '1',
        title: 'Old',
      });
      mockPrismaService.task.update.mockResolvedValue({
        id: '1',
        title: 'New',
      });

      await service.update('1', { title: 'New' });

      const callArg = mockPrismaService.task.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(callArg.data).not.toHaveProperty('progress');
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

  // OBS-026 — the project CSV export egresses task rows (including assignee
  // emails = personal data); it must leave a DATA_EXPORTED RGPD trail.
  describe('exportProjectTasksCsv', () => {
    const project = { id: 'project-1', name: 'Test Project' };
    const tasks = [
      {
        title: 'T1',
        description: '',
        status: TaskStatus.TODO,
        priority: Priority.NORMAL,
        assignee: { email: 'a@x.fr' },
        milestone: null,
        estimatedHours: null,
        startDate: null,
        endDate: null,
        subtasks: [],
      },
      {
        title: 'T2',
        description: '',
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        assignee: null,
        milestone: { name: 'M1' },
        estimatedHours: null,
        startDate: null,
        endDate: null,
        subtasks: [],
      },
    ];

    beforeEach(() => {
      mockPrismaService.project.findUnique.mockResolvedValue(project);
      mockPrismaService.task.findMany.mockResolvedValue(tasks);
    });

    it('emits DATA_EXPORTED with scope/format/recordCount/subject/ip/ua (OBS-026)', async () => {
      await service.exportProjectTasksCsv(
        'project-1',
        { id: 'user-1', role: 'ADMIN' },
        { ip: '10.0.0.7', ua: 'vitest' },
      );

      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistence.log.mock.calls[0][0];
      expect(call.action).toBe('DATA_EXPORTED');
      expect(call.entityType).toBe('Export');
      expect(call.actorId).toBe('user-1');
      expect(call.entityId).toBe('user-1');
      expect(call.payload.format).toBe('csv');
      expect(call.payload.scope).toBe('tasks');
      // 2 task rows materialized — exact, not estimated.
      expect(call.payload.recordCount).toBe(2);
      expect(call.payload.subject).toEqual({ projectId: 'project-1' });
      expect(call.payload.ip).toBe('10.0.0.7');
      expect(call.payload.ua).toBe('vitest');
    });

    it('does NOT emit when caller is undefined (caller-as-actor invariant)', async () => {
      await service.exportProjectTasksCsv('project-1');

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    it('still returns the CSV even when the audit log rejects (fire-and-forget)', async () => {
      mockAuditPersistence.log.mockRejectedValueOnce(new Error('audit down'));

      const result = await service.exportProjectTasksCsv('project-1', {
        id: 'user-1',
        role: 'ADMIN',
      });

      expect(result.csv).toContain('title;description');
    });
  });

  // COR-019 — reorderSubtasks must wrap updates in a single $transaction
  describe('reorderSubtasks', () => {
    const TASK_ID = 'task-cor019';
    const SUBTASK_IDS = ['sub-a', 'sub-b', 'sub-c'];

    beforeEach(() => {
      // Provide a task so the not-found guard passes
      (
        mockPrismaService.task.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: TASK_ID,
        projectId: 'proj-1',
      });
      (
        mockPrismaService.subtask.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        SUBTASK_IDS.map((id, i) => ({ id, position: i, taskId: TASK_ID })),
      );
      vi.clearAllMocks();
      // Re-set after clearAllMocks so the task lookup still resolves
      (
        mockPrismaService.task.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: TASK_ID,
        projectId: 'proj-1',
      });
      (
        mockPrismaService.subtask.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        SUBTASK_IDS.map((id, i) => ({ id, position: i, taskId: TASK_ID })),
      );
      (
        mockPrismaService.subtask.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});
      mockPrismaService.$transaction.mockImplementation(
        async (arg: unknown) => {
          if (Array.isArray(arg)) return Promise.all(arg);
          return (arg as (tx: typeof mockPrismaService) => Promise<unknown>)(
            mockPrismaService,
          );
        },
      );
    });

    it('wraps all subtask position updates in a single $transaction (COR-019)', async () => {
      await service.reorderSubtasks(TASK_ID, SUBTASK_IDS);

      // The discriminating assertion: unfixed code (Promise.all) never calls $transaction
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);

      // The argument must be an array of N promises, not a callback
      const [arg] = (mockPrismaService.$transaction as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      expect(Array.isArray(arg)).toBe(true);
      expect(arg).toHaveLength(SUBTASK_IDS.length);
    });
  });

  // ─── PER-027 ──────────────────────────────────────────────────────────────
  describe('PER-027 — findAll hard cap at 100', () => {
    it('PER-027 — GET /tasks?limit=1000 is capped at 100 (not 1000)', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      const result = await service.findAll(1, 1000);

      // Before fix: meta.limit === 1000. After fix: meta.limit === 100.
      expect(result.meta.limit).toBe(100);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ─── PER-021 ──────────────────────────────────────────────────────────────
  describe('PER-021 — getTasksByAssignee pagination', () => {
    it('PER-021 — getTasksByAssignee caps the findMany (memory bound) and returns a bare array', async () => {
      const manyTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        assigneeId: 'user-1',
        timeEntries: [],
      }));
      mockPrismaService.task.findMany.mockResolvedValue(manyTasks);

      const result = await service.getTasksByAssignee('user-1');

      // PER-021 is satisfied by a hard `take` cap on the otherwise-unbounded
      // findMany — NOT by an envelope. The route contract is a bare array
      // (consistent with GET /projects/user); the prior {data,meta} was a
      // half-wired regression that stranded rows past the (un-plumbed) page 1.
      expect(Array.isArray(result)).toBe(true);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1000 }),
      );
    });
  });

  describe('PER-021 — getTasksByProject pagination', () => {
    it('PER-021 — getTasksByProject caps the findMany (memory bound) and returns a bare array', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.task.findMany.mockResolvedValue([]);

      const result = await service.getTasksByProject('project-1');

      // PER-021 satisfied by the `take` cap; bare-array contract (no envelope).
      expect(Array.isArray(result)).toBe(true);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1000 }),
      );
    });
  });

  // ─── PER-022 ──────────────────────────────────────────────────────────────
  describe('PER-022 — getMyDoneUndeclaredTasks cap at 50', () => {
    it('PER-022 — findMany is called with take: 50 to cap DONE-undeclared result set', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);

      await service.getMyDoneUndeclaredTasks('user-1');

      // Before fix: no take clause. After fix: take: 50.
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  // ─── PER-025 ──────────────────────────────────────────────────────────────
  describe('PER-025 — findOrphans cap at 200', () => {
    it('PER-025 — findOrphans issues take: 200 to prevent unbounded orphan scan', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);

      await service.findOrphans();

      // Before fix: no take clause. After fix: take: 200.
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });
  });

  // ─── PER-024 ──────────────────────────────────────────────────────────────
  describe('PER-024 — importTasks pre-fetches existing titles (no N findFirst calls)', () => {
    it('PER-024 — importTasks uses task.findMany for pre-fetch, not per-row findFirst', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.create.mockResolvedValue({ id: 'new' });

      await service.importTasks('project-1', [
        { title: 'Task A' } as any,
        { title: 'Task B' } as any,
        { title: 'Task C' } as any,
      ]);

      // Before fix: task.findFirst called N times (once per row).
      // After fix: task.findMany called once for pre-fetch; findFirst not called.
      expect(mockPrismaService.task.findFirst).not.toHaveBeenCalled();
      // findMany called once for pre-fetch (not for milestones/users — those use milestone/user)
      const taskFindManyCalls = (
        mockPrismaService.task.findMany as ReturnType<typeof vi.fn>
      ).mock.calls;
      expect(taskFindManyCalls.length).toBe(1);
    });
  });

  // ─── SA-COR-004 ───────────────────────────────────────────────────────────
  describe('SA-COR-004 — addDependency rejects orphan-orphan dependencies', () => {
    it('SA-COR-004 — addDependency(orphan1, orphan2) throws BadRequestException', async () => {
      const orphan1 = { id: 'orphan-1', projectId: null };
      const orphan2 = { id: 'orphan-2', projectId: null };

      mockPrismaService.task.findUnique
        .mockResolvedValueOnce(orphan1)
        .mockResolvedValueOnce(orphan2);

      // Before fix: null !== null is false → guard passes → dependency created.
      // After fix: projectId === null → BadRequestException thrown.
      await expect(
        service.addDependency('orphan-1', { dependsOnId: 'orphan-2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('SA-COR-004 — addDependency(projectTask, orphanTask) throws BadRequestException', async () => {
      const projectTask = { id: 'task-1', projectId: 'project-1' };
      const orphanTask = { id: 'orphan-1', projectId: null };

      mockPrismaService.task.findUnique
        .mockResolvedValueOnce(projectTask)
        .mockResolvedValueOnce(orphanTask);

      await expect(
        service.addDependency('task-1', { dependsOnId: 'orphan-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── SA-COR-008 ───────────────────────────────────────────────────────────
  describe('SA-COR-008 — update rejects epic/milestone from a different project', () => {
    it('SA-COR-008 — PATCH with epicId from a different project throws BadRequestException', async () => {
      const existingTask = {
        id: 'task-1',
        projectId: 'project-1',
        project: { members: [] },
        assignees: [],
      };
      const epicFromOtherProject = { id: 'epic-bad', projectId: 'project-2' };

      mockPrismaService.task.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.epic.findUnique.mockResolvedValue(epicFromOtherProject);

      // Before fix: no cross-project check → DB trigger fires → HTTP 500.
      // After fix: service throws BadRequestException → HTTP 400.
      await expect(
        service.update('task-1', { epicId: 'epic-bad' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('SA-COR-008 — PATCH with milestoneId from a different project throws BadRequestException', async () => {
      const existingTask = {
        id: 'task-1',
        projectId: 'project-1',
        project: { members: [] },
        assignees: [],
      };
      const milestoneFromOtherProject = {
        id: 'ms-bad',
        projectId: 'project-2',
      };

      mockPrismaService.task.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.milestone.findUnique.mockResolvedValue(
        milestoneFromOtherProject,
      );

      await expect(
        service.update('task-1', { milestoneId: 'ms-bad' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── COR-030 ──────────────────────────────────────────────────────────────
  describe('COR-030 — update allows clearing startDate/endDate to null', () => {
    it('COR-030 — PATCH with endDate: null clears the date (does not leave it unchanged)', async () => {
      const existingTask = {
        id: 'task-1',
        projectId: 'project-1',
        endDate: new Date('2025-12-31'),
        project: { members: [] },
        assignees: [],
      };
      mockPrismaService.task.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.task.update.mockResolvedValue({
        id: 'task-1',
        endDate: null,
      });

      await service.update('task-1', { endDate: null as unknown as string });

      // Before fix: falsy check skips undefined AND null → endDate not sent to DB.
      // After fix: undefined=skip, null=clear → endDate: null passed to DB.
      const callData = mockPrismaService.task.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(callData.data).toHaveProperty('endDate', null);
    });
  });

  // ─── COR-028 ──────────────────────────────────────────────────────────────
  describe('COR-028 — importTasks validates dates individually', () => {
    it('COR-028 — importTasks with startDate=not-a-date and no endDate adds a per-row error', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);

      const result = await service.importTasks('project-1', [
        { title: 'Task', startDate: 'not-a-date' } as any,
      ]);

      // Before fix: passed to new Date() silently → Prisma error → generic catch.
      // After fix: per-row error with clear message before DB hit.
      expect(result.errors).toBe(1);
      expect(result.created).toBe(0);
      expect(result.errorDetails[0]).toMatch(/Date de début invalide/);
      // DB create must NOT have been called
      expect(mockPrismaService.task.create).not.toHaveBeenCalled();
    });

    it('COR-028 — validateImport flags a lone invalid startDate (not just when both dates present)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);

      const result = await service.validateImport('project-1', [
        { title: 'Task', startDate: 'not-a-date' } as any,
      ]);

      // Before fix: validation only runs when BOTH dates present → lone bad
      // startDate passes dry-run and then fails in importTasks DB call.
      // After fix: each date is validated independently.
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].messages[0]).toMatch(/Date de début invalide/);
    });
  });

  // ─── COR-029 / SEC-022 ────────────────────────────────────────────────────
  describe('COR-029 / SEC-022 — reorderSubtasks rejects foreign subtask IDs', () => {
    it('SEC-022 — reorderSubtasks with a subtaskId from a different task throws BadRequestException', async () => {
      const TASK_ID = 'task-1';
      const FOREIGN_SUBTASK_ID = 'sub-from-task-2';

      mockPrismaService.task.findUnique.mockResolvedValue({ id: TASK_ID });
      // Owned subtasks: only 0 of the 1 provided ID belongs to TASK_ID
      mockPrismaService.subtask.findMany.mockResolvedValueOnce([]); // pre-validation: 0 owned

      // Before fix: position of sub-from-task-2 is silently overwritten.
      // After fix: BadRequestException thrown.
      await expect(
        service.reorderSubtasks(TASK_ID, [FOREIGN_SUBTASK_ID]),
      ).rejects.toThrow(BadRequestException);
    });

    it('COR-029 — reorderSubtasks update where clause includes taskId as extra safety', async () => {
      const TASK_ID = 'task-reorder';
      const SUBTASK_IDS = ['sub-a', 'sub-b'];

      mockPrismaService.task.findUnique.mockResolvedValue({ id: TASK_ID });
      // Pre-validation: both subtasks belong to TASK_ID
      mockPrismaService.subtask.findMany.mockResolvedValueOnce(
        SUBTASK_IDS.map((id) => ({ id, taskId: TASK_ID })),
      );
      // getSubtasks call
      mockPrismaService.subtask.findMany.mockResolvedValueOnce([]);
      mockPrismaService.subtask.update.mockResolvedValue({});

      await service.reorderSubtasks(TASK_ID, SUBTASK_IDS);

      // Each update must include taskId in the where clause
      const updateCalls = mockPrismaService.subtask.update.mock.calls as Array<
        [{ where: Record<string, unknown> }]
      >;
      for (const [call] of updateCalls) {
        expect(call.where).toMatchObject({ taskId: TASK_ID });
      }
    });
  });

  // ─── COR-031 ──────────────────────────────────────────────────────────────
  describe('COR-031 — addDependency wraps circular-check+create in a transaction', () => {
    it('COR-031 — addDependency calls $transaction to serialise circular-check and create', async () => {
      const task = { id: 'task-1', projectId: 'project-1' };
      const dependsOnTask = { id: 'task-2', projectId: 'project-1' };
      const dependency = { taskId: 'task-1', dependsOnTaskId: 'task-2' };

      mockPrismaService.task.findUnique
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(dependsOnTask);
      // Pre-fetch for checkCircularDependency (single findMany)
      mockPrismaService.taskDependency.findMany.mockResolvedValue([]);
      mockPrismaService.taskDependency.findUnique.mockResolvedValue(null);
      mockPrismaService.taskDependency.create.mockResolvedValue(dependency);

      await service.addDependency('task-1', { dependsOnId: 'task-2' });

      // Before fix: no $transaction call (direct create). After fix: $transaction called.
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─── PER-023 ──────────────────────────────────────────────────────────────
  describe('PER-023 — checkCircularDependency uses a single pre-fetch', () => {
    it('PER-023 — circular-check issues exactly one taskDependency.findMany (not N per node)', async () => {
      // Discriminating graph: task-2 → task-3 (one edge).
      // OLD code (per-node BFS): calls findMany({ where: { taskId: 'task-2' }}) →
      //   returns the chain edge, queues task-3; then findMany({ where: { taskId: 'task-3' }}) → []
      //   Total: 2 findMany calls → witness RED on old code.
      // NEW code (single pre-fetch): one findMany with no where → returns all edges,
      //   BFS runs in-memory → exactly 1 findMany call → witness GREEN.
      const task = { id: 'task-1', projectId: 'project-1' };
      const dependsOnTask = { id: 'task-2', projectId: 'project-1' };

      mockPrismaService.task.findUnique
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(dependsOnTask);

      // First findMany call: the pre-fetch (new code) OR the task-2 BFS step (old code)
      // both return the edge task-2→task-3 (no cycle toward task-1).
      // Second findMany call (old code only): task-3 BFS step, returns empty.
      mockPrismaService.taskDependency.findMany
        .mockResolvedValueOnce([
          { taskId: 'task-2', dependsOnTaskId: 'task-3' },
        ])
        .mockResolvedValueOnce([]);

      mockPrismaService.taskDependency.findUnique.mockResolvedValue(null);
      mockPrismaService.taskDependency.create.mockResolvedValue({});

      await service.addDependency('task-1', { dependsOnId: 'task-2' });

      // After fix: exactly 1 pre-fetch query (old code would issue 2).
      const findManyCalls =
        mockPrismaService.taskDependency.findMany.mock.calls.length;
      expect(findManyCalls).toBe(1);
    });
  });

  // OBS-012 — task lifecycle (create/update/delete) must each leave a durable
  // audit_logs row (only CSV export was audited before). Witness = capture the
  // payload to the mocked AuditPersistence.log + assert the REAL strict schema
  // accepts it (validatePayloadForAction).
  describe('OBS-012 audit emits', () => {
    const findCall = (action: AuditAction) =>
      mockAuditPersistence.log.mock.calls.find(
        (c) => c[0]?.action === action,
      )?.[0];

    it('create() emits TASK_CREATED with a schema-conformant payload', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'P',
      });
      mockPrismaService.task.create.mockResolvedValue({
        id: 'task-1',
        projectId: 'project-1',
        status: 'TODO',
      });

      await service.create(
        {
          title: 'T',
          projectId: 'project-1',
          status: 'TODO' as const,
          priority: 'NORMAL' as const,
        },
        { id: 'user-1', role: Role.ADMIN },
      );

      const call = findCall(AuditAction.TASK_CREATED);
      expect(call).toMatchObject({
        action: AuditAction.TASK_CREATED,
        entityType: 'Task',
        entityId: 'task-1',
        actorId: 'user-1',
      });
      expect(call?.payload).toMatchObject({
        taskId: 'task-1',
        projectId: 'project-1',
        status: 'TODO',
      });
      expect(() =>
        validatePayloadForAction(AuditAction.TASK_CREATED, call?.payload),
      ).not.toThrow();
    });

    it('update() emits TASK_UPDATED with a before/after, schema-conformant payload', async () => {
      const existingTask = {
        id: 'task-1',
        status: 'TODO',
        projectId: null,
        assignees: [],
      };
      mockPrismaService.task.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.task.update.mockResolvedValue({
        ...existingTask,
        status: 'IN_PROGRESS',
      });

      await service.update(
        'task-1',
        { status: 'IN_PROGRESS' as const },
        'user-1',
        'MANAGER',
      );

      const call = findCall(AuditAction.TASK_UPDATED);
      expect(call).toMatchObject({
        action: AuditAction.TASK_UPDATED,
        entityType: 'Task',
        entityId: 'task-1',
        actorId: 'user-1',
      });
      expect(call?.payload).toMatchObject({
        before: expect.objectContaining({ status: 'TODO' }),
        after: expect.objectContaining({ status: 'IN_PROGRESS' }),
      });
      expect(() =>
        validatePayloadForAction(AuditAction.TASK_UPDATED, call?.payload),
      ).not.toThrow();
    });

    it('remove() emits TASK_DELETED with a snapshot of the deleted task', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test',
        assigneeId: 'user-1',
        dependents: [],
        assignees: [],
      };
      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.task.delete.mockResolvedValue(mockTask);

      await service.remove('task-1', { id: 'user-1', role: 'MANAGER' });

      const call = findCall(AuditAction.TASK_DELETED);
      expect(call).toMatchObject({
        action: AuditAction.TASK_DELETED,
        entityType: 'Task',
        entityId: 'task-1',
        actorId: 'user-1',
      });
      expect(call?.payload).toMatchObject({
        snapshot: expect.objectContaining({ id: 'task-1' }),
      });
      expect(() =>
        validatePayloadForAction(AuditAction.TASK_DELETED, call?.payload),
      ).not.toThrow();
    });
  });
});
