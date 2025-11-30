import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { DateRangeEnum } from './dto/analytics-query.dto';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockPrismaService = {
    project: {
      findMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
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
    budgetHours: 100,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { tasks: 5 },
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
    dueDate: new Date('2025-06-01'),
    createdAt: new Date(),
  };

  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
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
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAnalytics', () => {
    it('should return analytics data with default date range (MONTH)', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany
        .mockResolvedValueOnce([mockTask]) // getTasks
        .mockResolvedValueOnce([mockTask]); // calculateProjectProgress
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

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'project-1' }),
        }),
      );
    });

    it('should handle WEEK date range', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({ dateRange: DateRangeEnum.WEEK });

      expect(result).toBeDefined();
    });

    it('should handle QUARTER date range', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({ dateRange: DateRangeEnum.QUARTER });

      expect(result).toBeDefined();
    });

    it('should handle YEAR date range', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({ dateRange: DateRangeEnum.YEAR });

      expect(result).toBeDefined();
    });

    it('should calculate metrics correctly', async () => {
      const projects = [
        { ...mockProject, status: 'ACTIVE' },
        { ...mockProject, id: 'project-2', status: 'COMPLETED' },
      ];
      const tasks = [
        { ...mockTask, status: 'DONE', dueDate: null },
        { ...mockTask, id: 'task-2', status: 'TODO', dueDate: new Date('2024-01-01') }, // Overdue
        { ...mockTask, id: 'task-3', status: 'IN_PROGRESS', dueDate: null },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(projects);
      mockPrismaService.task.findMany.mockResolvedValue(tasks);
      mockPrismaService.user.findMany.mockResolvedValue([mockUser, { ...mockUser, id: 'user-2' }]);
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

      mockPrismaService.project.findMany.mockResolvedValue([projectWithLongName]);
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectProgressData).toHaveLength(1);
      expect(result.projectProgressData[0].name).toContain('...');
    });

    it('should return task status data', async () => {
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

      const result = await service.getAnalytics({});

      expect(result.taskStatusData).toHaveLength(4);
      const todoStatus = result.taskStatusData.find((s) => s.name === 'À faire');
      const inProgressStatus = result.taskStatusData.find((s) => s.name === 'En cours');
      const doneStatus = result.taskStatusData.find((s) => s.name === 'Terminé');
      const blockedStatus = result.taskStatusData.find((s) => s.name === 'Bloqué');

      expect(todoStatus?.value).toBe(1);
      expect(inProgressStatus?.value).toBe(1);
      expect(doneStatus?.value).toBe(1);
      expect(blockedStatus?.value).toBe(1);
    });

    it('should calculate project progress based on task hours', async () => {
      const tasksWithHours = [
        { ...mockTask, status: 'DONE', estimatedHours: 10 },
        { ...mockTask, id: 'task-2', status: 'TODO', estimatedHours: 10 },
      ];

      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue(tasksWithHours);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectProgressData[0].progress).toBe(50);
    });

    it('should handle tasks without estimated hours', async () => {
      const tasksWithoutHours = [
        { ...mockTask, status: 'DONE', estimatedHours: null },
        { ...mockTask, id: 'task-2', status: 'TODO', estimatedHours: null },
      ];

      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue(tasksWithoutHours);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectProgressData[0].progress).toBe(50); // Default 1 hour per task
    });

    it('should return 0 progress for projects with no tasks', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectProgressData[0].progress).toBe(0);
    });

    it('should identify project manager from members', async () => {
      const projectWithManager = {
        ...mockProject,
        members: [
          { role: 'MANAGER', user: { firstName: 'Manager', lastName: 'One' } },
          { role: 'Developer', user: { firstName: 'Dev', lastName: 'Two' } },
        ],
      };

      mockPrismaService.project.findMany.mockResolvedValue([projectWithManager]);
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

      mockPrismaService.project.findMany.mockResolvedValue([projectWithoutManager]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics({});

      expect(result.projectDetails[0].projectManager).toBeNull();
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

      const completionMetric = result.metrics.find((m) => m.title === 'Taux de Completion');
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

      const completionMetric = result.metrics.find((m) => m.title === 'Taux de Completion');
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

      const completionMetric = result.metrics.find((m) => m.title === 'Taux de Completion');
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
      expect(result.taskStatusData).toHaveLength(4);
      expect(result.projectDetails).toHaveLength(0);
    });

    it('should use createdAt as startDate when project has no startDate', async () => {
      const projectNoStartDate = {
        ...mockProject,
        startDate: null,
      };

      mockPrismaService.project.findMany.mockResolvedValue([projectNoStartDate]);
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

      expect(result.projectDetails[0].dueDate).toBeNull();
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
  });

  describe('exportAnalytics', () => {
    it('should export analytics with metadata', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      const result = await service.exportAnalytics({ dateRange: DateRangeEnum.MONTH });

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
});
