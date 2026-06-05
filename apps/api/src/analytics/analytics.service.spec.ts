import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { DateRangeEnum } from './dto/analytics-query.dto';
import { AccessScopeService } from '../common/services/access-scope.service';
import { CacheService } from '../common/services/cache.service';
import { ArchivedFilter } from '../projects/dto/archived-filter.dto';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockPrismaService = {
    project: {
      findMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    timeEntry: {
      groupBy: vi.fn(),
    },
  };

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    status: 'ACTIVE',
    progress: 50,
    priority: 'MEDIUM',
    budgetHours: 100,
    icon: null,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { tasks: 5 },
    manager: null,
    members: [
      {
        role: 'Chef de projet',
        user: { firstName: 'John', lastName: 'Doe' },
      },
    ],
  };

  const mockTask = {
    id: 'task-1',
    projectId: 'project-1',
    status: 'DONE',
    estimatedHours: 10,
    endDate: new Date('2025-06-01'),
    createdAt: new Date(),
  };

  const mockUser = {
    id: 'user-1',
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AccessScopeService,
          useValue: {
            projectScopeWhere: vi.fn().mockResolvedValue({}),
          },
        },
        // Miss-only cache mock: existing tests never hit the cache so Prisma
        // call counts remain stable (PER-001 regression guard unaffected).
        {
          provide: CacheService,
          useValue: {
            get: vi.fn().mockResolvedValue(undefined),
            set: vi.fn().mockResolvedValue(undefined),
            del: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);

    // Default: task.groupBy returns empty array (progress groupBy used after PER-001 fix)
    mockPrismaService.task.groupBy.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAnalytics', () => {
    // PER-001 regression guard: task.findMany call count must NOT scale with project count.
    // Before fix: N projects → N+1 findMany (1 getTasks + N calculateProjectProgress).
    // After fix:  N projects → 1 findMany (getTasks only) + 1 groupBy (progress batch).
    it('PER-001: task.findMany call count is constant regardless of project count (no N+1)', async () => {
      const makeProject = (id: string) => ({
        ...mockProject,
        id,
        _count: { tasks: 2 },
      });

      // Single project: record findMany call count
      mockPrismaService.project.findMany.mockResolvedValue([
        makeProject('p-1'),
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);
      await service.getAnalytics({});
      const callsWith1Project =
        mockPrismaService.task.findMany.mock.calls.length;

      mockPrismaService.task.findMany.mockClear();

      // Three projects: call count must be identical (constant, not N+1)
      mockPrismaService.project.findMany.mockResolvedValue([
        makeProject('p-1'),
        makeProject('p-2'),
        makeProject('p-3'),
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.groupBy.mockResolvedValue([]);
      await service.getAnalytics({});
      const callsWith3Projects =
        mockPrismaService.task.findMany.mock.calls.length;

      expect(callsWith1Project).toBe(callsWith3Projects);
    });

    it('should return analytics data with default date range (MONTH)', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]); // getTasks only (no per-project findMany after PER-001)
      mockPrismaService.task.groupBy.mockResolvedValue([
        { projectId: 'project-1', status: 'DONE', _count: { _all: 1 } },
      ]); // progress batch groupBy
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([
        { projectId: 'project-1', _sum: { hours: 50 } },
      ]);

      const result = await service.getAnalytics({});

      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.projectProgressData).toBeDefined();
      expect(result.taskStatusData).toBeDefined();
      expect(result.projectDetails).toBeDefined();
    });

    it('should filter by projectId when provided', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      await service.getAnalytics({ projectId: 'project-1' });

      const callArgs = mockPrismaService.project.findMany.mock.calls[0][0] as {
        where: { id?: string };
      };
      expect(callArgs.where.id).toBe('project-1');
    });

    // Regression guard: dateRange must NOT narrow the project or task set —
    // the Reports view must always reflect the user's full project scope.
    // See incident: 36 projects in scope, only 7 displayed because of
    // `createdAt: { gte: startDate }` on getProjects/getTasks.
    it('should NOT filter projects or tasks by createdAt for any dateRange', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      for (const dateRange of [
        DateRangeEnum.WEEK,
        DateRangeEnum.MONTH,
        DateRangeEnum.QUARTER,
        DateRangeEnum.YEAR,
      ]) {
        mockPrismaService.project.findMany.mockClear();
        mockPrismaService.task.findMany.mockClear();

        await service.getAnalytics({ dateRange });

        const projectWhere = (
          mockPrismaService.project.findMany.mock.calls[0][0] as {
            where: Record<string, unknown>;
          }
        ).where;
        const taskWhere = (
          mockPrismaService.task.findMany.mock.calls[0][0] as {
            where: Record<string, unknown>;
          }
        ).where;

        expect(projectWhere).not.toHaveProperty('createdAt');
        expect(taskWhere).not.toHaveProperty('createdAt');
      }
    });

    it('should handle WEEK date range', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({
        dateRange: DateRangeEnum.WEEK,
      });

      expect(result).toBeDefined();
    });

    it('should handle QUARTER date range', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({
        dateRange: DateRangeEnum.QUARTER,
      });

      expect(result).toBeDefined();
    });

    it('should handle YEAR date range', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({
        dateRange: DateRangeEnum.YEAR,
      });

      expect(result).toBeDefined();
    });

    it('should calculate metrics correctly', async () => {
      const projects = [
        { ...mockProject, status: 'ACTIVE' },
        { ...mockProject, id: 'project-2', status: 'COMPLETED' },
      ];
      const tasks = [
        { ...mockTask, status: 'DONE', endDate: null },
        {
          ...mockTask,
          id: 'task-2',
          status: 'TODO',
          endDate: new Date('2024-01-01'),
        }, // Overdue
        { ...mockTask, id: 'task-3', status: 'IN_PROGRESS', endDate: null },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(projects);
      mockPrismaService.task.findMany.mockResolvedValue(tasks);
      mockPrismaService.user.findMany.mockResolvedValue([
        mockUser,
        { ...mockUser, id: 'user-2' },
      ]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.metrics).toHaveLength(4);
      expect(result.metrics[0].title).toBe('Projets Actifs');
      expect(result.metrics[0].value).toBe(1);
      expect(result.metrics[1].title).toBe('Taux de Completion');
      expect(result.metrics[2].title).toBe('Tâches en Retard');
      expect(result.metrics[2].value).toBe(1);
      expect(result.metrics[3].title).toBe('Équipe Active');
      expect(result.metrics[3].value).toBe(2);
    });

    it('should return project progress data', async () => {
      const projectWithLongName = {
        ...mockProject,
        name: 'This is a very long project name that should be truncated',
      };

      mockPrismaService.project.findMany.mockResolvedValue([
        projectWithLongName,
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectProgressData).toHaveLength(1);
      expect(result.projectProgressData[0].name).toBe(
        'This is a very long project name that should be truncated',
      );
    });

    it('should return task status data', async () => {
      // PER-025: status counts now come from task.groupBy, not findMany filtering.
      // findMany is still called (feeds metrics/details), but status counts use groupBy.
      const tasks = [
        { ...mockTask, status: 'TODO' },
        { ...mockTask, id: 'task-2', status: 'IN_PROGRESS' },
        { ...mockTask, id: 'task-3', status: 'DONE' },
        { ...mockTask, id: 'task-4', status: 'BLOCKED' },
      ];

      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue(tasks);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);
      // Status counts sourced from groupBy (not findMany)
      mockPrismaService.task.groupBy.mockResolvedValue([
        { projectId: null, status: 'TODO', _count: { _all: 1 } },
        { projectId: null, status: 'IN_PROGRESS', _count: { _all: 1 } },
        { projectId: null, status: 'DONE', _count: { _all: 1 } },
        { projectId: null, status: 'BLOCKED', _count: { _all: 1 } },
      ]);

      const result = await service.getAnalytics({});

      expect(result.taskStatusData).toHaveLength(5);
      const todoStatus = result.taskStatusData.find(
        (s) => s.name === 'À faire',
      );
      const inProgressStatus = result.taskStatusData.find(
        (s) => s.name === 'En cours',
      );
      const doneStatus = result.taskStatusData.find(
        (s) => s.name === 'Terminé',
      );
      const blockedStatus = result.taskStatusData.find(
        (s) => s.name === 'Bloqué',
      );

      expect(todoStatus?.value).toBe(1);
      expect(inProgressStatus?.value).toBe(1);
      expect(doneStatus?.value).toBe(1);
      expect(blockedStatus?.value).toBe(1);
    });

    it('should calculate project progress based on task count (PER-001: progress via groupBy)', async () => {
      // After PER-001 fix, progress is computed from task.groupBy, not per-project task.findMany.
      // Set up getTasks tasks for metrics/details + groupBy for progress calculation.
      const tasksWithHours = [
        { ...mockTask, status: 'DONE', estimatedHours: 10 },
        { ...mockTask, id: 'task-2', status: 'TODO', estimatedHours: 10 },
      ];

      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue(tasksWithHours);
      mockPrismaService.task.groupBy.mockResolvedValue([
        { projectId: 'project-1', status: 'DONE', _count: { _all: 1 } },
        { projectId: 'project-1', status: 'TODO', _count: { _all: 1 } },
      ]); // 1 DONE out of 2 = 50%
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectProgressData[0].progress).toBe(50);
    });

    it('should handle tasks without estimated hours (PER-001: progress via groupBy)', async () => {
      // After PER-001 fix, progress is computed from task.groupBy.
      // estimatedHours is not used for progress computation — simple done-count ratio.
      const tasksWithoutHours = [
        { ...mockTask, status: 'DONE', estimatedHours: null },
        { ...mockTask, id: 'task-2', status: 'TODO', estimatedHours: null },
      ];

      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue(tasksWithoutHours);
      mockPrismaService.task.groupBy.mockResolvedValue([
        { projectId: 'project-1', status: 'DONE', _count: { _all: 1 } },
        { projectId: 'project-1', status: 'TODO', _count: { _all: 1 } },
      ]); // 1 DONE out of 2 = 50%
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectProgressData[0].progress).toBe(50);
    });

    it('should return 0 progress for projects with no tasks', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectProgressData[0].progress).toBe(0);
    });

    it('should identify project manager from manager field', async () => {
      const projectWithManager = {
        ...mockProject,
        manager: {
          id: 'manager-1',
          firstName: 'Manager',
          lastName: 'One',
          department: null,
        },
      };

      mockPrismaService.project.findMany.mockResolvedValue([
        projectWithManager,
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].projectManager).toBe('Manager One');
    });

    it('should handle project without manager', async () => {
      const projectWithoutManager = {
        ...mockProject,
        members: [
          { role: 'Developer', user: { firstName: 'Dev', lastName: 'One' } },
        ],
      };

      mockPrismaService.project.findMany.mockResolvedValue([
        projectWithoutManager,
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].projectManager).toBeUndefined();
    });

    it('should identify overdue projects', async () => {
      const overdueProject = {
        ...mockProject,
        status: 'ACTIVE',
        endDate: new Date('2024-01-01'), // Past date
      };

      mockPrismaService.project.findMany.mockResolvedValue([overdueProject]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].isOverdue).toBe(true);
    });

    it('should not mark completed projects as overdue', async () => {
      const completedProject = {
        ...mockProject,
        status: 'COMPLETED',
        endDate: new Date('2024-01-01'), // Past date
      };

      mockPrismaService.project.findMany.mockResolvedValue([completedProject]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].isOverdue).toBe(false);
    });

    it('should include logged hours from time entries', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([
        { projectId: 'project-1', _sum: { hours: 75 } },
      ]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].loggedHours).toBe(75);
    });

    it('should handle projects with no time entries', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].loggedHours).toBe(0);
    });

    it('should calculate completion rate correctly', async () => {
      const tasks = [
        { ...mockTask, status: 'DONE' },
        { ...mockTask, id: 'task-2', status: 'DONE' },
        { ...mockTask, id: 'task-3', status: 'DONE' },
        { ...mockTask, id: 'task-4', status: 'TODO' },
      ];

      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue(tasks);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      const completionMetric = result.metrics.find(
        (m) => m.title === 'Taux de Completion',
      );
      expect(completionMetric?.value).toBe('75%');
      expect(completionMetric?.trend).toBe('up');
      expect(completionMetric?.color).toBe('success');
    });

    it('should show warning color for moderate completion rate', async () => {
      const tasks = [
        { ...mockTask, status: 'DONE' },
        { ...mockTask, id: 'task-2', status: 'TODO' },
      ];

      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue(tasks);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      const completionMetric = result.metrics.find(
        (m) => m.title === 'Taux de Completion',
      );
      expect(completionMetric?.color).toBe('warning');
      expect(completionMetric?.trend).toBe('stable');
    });

    it('should show error color for low completion rate', async () => {
      const tasks = [
        { ...mockTask, status: 'DONE' },
        { ...mockTask, id: 'task-2', status: 'TODO' },
        { ...mockTask, id: 'task-3', status: 'TODO' },
        { ...mockTask, id: 'task-4', status: 'TODO' },
        { ...mockTask, id: 'task-5', status: 'TODO' },
      ];

      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue(tasks);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      const completionMetric = result.metrics.find(
        (m) => m.title === 'Taux de Completion',
      );
      expect(completionMetric?.color).toBe('error');
      expect(completionMetric?.trend).toBe('down');
    });

    it('should handle empty data', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.metrics).toHaveLength(4);
      expect(result.projectProgressData).toHaveLength(0);
      expect(result.taskStatusData).toHaveLength(5);
      expect(result.projectDetails).toHaveLength(0);
    });

    it('should use createdAt as startDate when project has no startDate', async () => {
      const projectNoStartDate = {
        ...mockProject,
        startDate: null,
      };

      mockPrismaService.project.findMany.mockResolvedValue([
        projectNoStartDate,
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].startDate).toBeDefined();
    });

    it('should handle null endDate', async () => {
      const projectNoEndDate = {
        ...mockProject,
        endDate: null,
      };

      mockPrismaService.project.findMany.mockResolvedValue([projectNoEndDate]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].dueDate).toBeUndefined();
      expect(result.projectDetails[0].isOverdue).toBe(false);
    });

    it('should handle timeEntry groupBy with null projectId', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([
        { projectId: null, _sum: { hours: 10 } },
        { projectId: 'project-1', _sum: { hours: 20 } },
      ]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].loggedHours).toBe(20);
    });

    it('should handle timeEntry with null hours sum', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([
        { projectId: 'project-1', _sum: { hours: null } },
      ]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].loggedHours).toBe(0);
    });

    it('default analytics excludes archived projects (archivedAt: null on project where)', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      await service.getAnalytics({});

      const projectWhere = (
        mockPrismaService.project.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where;
      expect(JSON.stringify(projectWhere)).toContain('"archivedAt":null');
    });

    it('archived=all does NOT filter on archivedAt', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      await service.getAnalytics({ archived: ArchivedFilter.ALL });

      const projectWhere = (
        mockPrismaService.project.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where;
      expect(JSON.stringify(projectWhere)).not.toContain('archivedAt');
    });

    // PER-025: taskStatusData and projectProgressData.tasks must be sourced from
    // task.groupBy, not from in-memory filtering of the findMany array.
    // Proof: findMany returns 0 tasks, groupBy returns counts > 0.
    // Before fix: old code reads findMany → all zeros → test FAILS.
    // After fix:  reads groupBy → correct counts → test PASSES.
    it('PER-025: taskStatusData and projectProgressData.tasks are sourced from task.groupBy (not findMany)', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      // findMany returns EMPTY — old code would see 0 tasks for all counts
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);
      // groupBy returns real counts — new code must read these
      mockPrismaService.task.groupBy.mockResolvedValue([
        { projectId: 'project-1', status: 'TODO', _count: { _all: 3 } },
        { projectId: 'project-1', status: 'DONE', _count: { _all: 2 } },
        { projectId: 'project-1', status: 'IN_PROGRESS', _count: { _all: 1 } },
      ]);

      const result = await service.getAnalytics({});

      // taskStatusData must reflect groupBy counts, not the empty findMany
      const todoStatus = result.taskStatusData.find(
        (s) => s.name === 'À faire',
      );
      const doneStatus = result.taskStatusData.find(
        (s) => s.name === 'Terminé',
      );
      const inProgressStatus = result.taskStatusData.find(
        (s) => s.name === 'En cours',
      );
      expect(todoStatus?.value).toBe(3);
      expect(doneStatus?.value).toBe(2);
      expect(inProgressStatus?.value).toBe(1);

      // projectProgressData.tasks must reflect total from groupBy (3+2+1=6)
      expect(result.projectProgressData[0].tasks).toBe(6);
    });

    // PER-027: projectDetails payload was unbounded — tenant-admin could receive 36+ projects
    // in a single response with no upper bound on the project.findMany query.
    // Fix: add take: PROJECT_DETAILS_LIMIT (50) to the findMany call.
    // RED before fix: findMany called without take → expect(undefined).toBe(50) fails.
    // GREEN after fix: findMany called with take: 50.
    it('PER-027: project.findMany is called with take: 50 to cap projectDetails payload', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      await service.getAnalytics({});

      const callArgs = mockPrismaService.project.findMany.mock.calls[0][0] as {
        take?: number;
        where: Record<string, unknown>;
      };
      expect(callArgs.take).toBe(50);
    });

    // ─── PER-001 ─────────────────────────────────────────────────────────────
    // task.findMany must include a select with exactly the four fields consumed
    // by analytics. Without select, ALL task columns are fetched on every request.
    // RED before fix: no select passed → undefined ≠ expected object.
    // GREEN after fix: select present with exactly the projected fields.
    it('PER-001 — task.findMany is called with a select projection containing {id, status, endDate, projectId}', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      await service.getAnalytics({});

      const callArgs = mockPrismaService.task.findMany.mock.calls[0][0] as {
        select?: Record<string, unknown>;
      };
      expect(callArgs.select).toEqual({
        id: true,
        status: true,
        endDate: true,
        projectId: true,
      });
    });

    // ─── SA-PERF-011 ─────────────────────────────────────────────────────────
    // task.groupBy must be called exactly ONCE per getAnalytics invocation.
    // Before fix: called twice (once in getAnalytics, once inside getProjects).
    // RED before fix: call count is 2. GREEN after fix: call count is 1.
    it('SA-PERF-011 — task.groupBy is called exactly once per getAnalytics invocation', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      await service.getAnalytics({});

      expect(mockPrismaService.task.groupBy).toHaveBeenCalledTimes(1);
    });

    // ─── SA-PERF-012 ─────────────────────────────────────────────────────────
    // project.findMany include must NOT contain a members key — members are not
    // used in any analytics computation or response DTO.
    // RED before fix: include.members is present. GREEN after fix: absent.
    it('SA-PERF-012 — project.findMany include does NOT contain a members key', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      await service.getAnalytics({});

      const callArgs = mockPrismaService.project.findMany.mock.calls[0][0] as {
        include?: Record<string, unknown>;
      };
      expect(callArgs.include).not.toHaveProperty('members');
    });

    // ─── COR-005 ─────────────────────────────────────────────────────────────
    // taskStatusGroupBy must use where: { project: projectWhere } (uncapped, same
    // as getTasks) rather than where: { projectId: { in: projectIds } } (capped
    // at PROJECT_DETAILS_LIMIT=50). This keeps taskStatusData consistent with
    // calculateMetrics when scope > 50 projects.
    // RED before fix: groupBy uses projectId.in (no .project key).
    // GREEN after fix: groupBy uses where.project.
    it('COR-005 — task.groupBy where uses project relation filter (not projectId.in)', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      await service.getAnalytics({});

      const groupByArgs = mockPrismaService.task.groupBy.mock.calls[0][0] as {
        where?: Record<string, unknown>;
      };
      // Must use relation filter (project key) rather than a list-based filter
      expect(groupByArgs.where).toHaveProperty('project');
      expect(groupByArgs.where).not.toHaveProperty('projectId');
    });

    it('should filter dismissed time entries from both user and third-party groupBy (D3)', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      await service.getAnalytics({});

      const groupByCalls = mockPrismaService.timeEntry.groupBy.mock.calls;
      // Two calls expected: one for users, one for third parties
      expect(groupByCalls.length).toBeGreaterThanOrEqual(2);
      for (const [args] of groupByCalls) {
        expect(args).toEqual(
          expect.objectContaining({
            where: expect.objectContaining({ isDismissal: false }),
          }),
        );
      }
    });
  });

  describe('exportAnalytics', () => {
    it('should export analytics with metadata', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.exportAnalytics({
        dateRange: DateRangeEnum.MONTH,
      });

      expect(result).toBeDefined();
      expect(result.generatedAt).toBeDefined();
      expect(result.dateRange).toBe(DateRangeEnum.MONTH);
      expect(result.metrics).toBeDefined();
    });

    it('should export with projectId filter', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.exportAnalytics({
        dateRange: DateRangeEnum.MONTH,
        projectId: 'project-1',
      });

      expect(result.projectId).toBe('project-1');
    });
  });

  // PER-026: Redis caching on heavy analytics endpoint.
  // Witness: 2nd call to getAnalytics with same user+query returns cached result
  // — prisma.project.findMany called exactly ONCE regardless of call count.
  // RED on unfixed code (no CacheService in constructor → DI error or cache miss on every call).
  // GREEN after fix (stateful cache: 2nd call is a hit, Prisma not called again).
  describe('PER-026: getAnalytics caches results per user', () => {
    let cachedService: AnalyticsService;

    const mockPrismaForCache = {
      project: { findMany: vi.fn() },
      task: { findMany: vi.fn(), groupBy: vi.fn() },
      user: { findMany: vi.fn() },
      timeEntry: { groupBy: vi.fn() },
    };

    beforeEach(async () => {
      // Stateful in-memory cache — stores what set() receives, returns it on get()
      const store = new Map<string, unknown>();
      const statefulCache = {
        get: vi.fn(async (key: string) => store.get(key)),
        set: vi.fn(async (key: string, value: unknown) => {
          store.set(key, value);
        }),
        del: vi.fn(async (key: string) => {
          store.delete(key);
        }),
      };

      const cacheModule = await Test.createTestingModule({
        providers: [
          AnalyticsService,
          { provide: PrismaService, useValue: mockPrismaForCache },
          {
            provide: AccessScopeService,
            useValue: { projectScopeWhere: vi.fn().mockResolvedValue({}) },
          },
          { provide: CacheService, useValue: statefulCache },
        ],
      }).compile();

      cachedService = cacheModule.get<AnalyticsService>(AnalyticsService);

      mockPrismaForCache.project.findMany.mockResolvedValue([]);
      mockPrismaForCache.task.findMany.mockResolvedValue([]);
      mockPrismaForCache.task.groupBy.mockResolvedValue([]);
      mockPrismaForCache.user.findMany.mockResolvedValue([]);
      mockPrismaForCache.timeEntry.groupBy.mockResolvedValue([]);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('PER-026: 2nd getAnalytics call with same user hits cache — prisma.project.findMany called only once', async () => {
      const user = { id: 'user-cache-1', role: 'ADMIN' } as Parameters<
        typeof cachedService.getAnalytics
      >[1];

      // First call: cache miss → Prisma queries run
      await cachedService.getAnalytics({}, user);
      expect(mockPrismaForCache.project.findMany).toHaveBeenCalledTimes(1);

      // Second call: cache hit → Prisma NOT called again
      await cachedService.getAnalytics({}, user);
      expect(mockPrismaForCache.project.findMany).toHaveBeenCalledTimes(1);
    });

    it('PER-026: different users get independent cache entries (no cross-user data leak)', async () => {
      const userA = { id: 'user-A', role: 'ADMIN' } as Parameters<
        typeof cachedService.getAnalytics
      >[1];
      const userB = { id: 'user-B', role: 'ADMIN' } as Parameters<
        typeof cachedService.getAnalytics
      >[1];

      // Both users call — each should trigger its own Prisma query (separate cache keys)
      await cachedService.getAnalytics({}, userA);
      await cachedService.getAnalytics({}, userB);
      expect(mockPrismaForCache.project.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
