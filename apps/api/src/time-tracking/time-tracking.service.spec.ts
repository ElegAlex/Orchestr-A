import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TimeTrackingService } from './time-tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TimeTrackingService', () => {
  let service: TimeTrackingService;

  const mockPrismaService = {
    timeEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeTrackingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TimeTrackingService>(TimeTrackingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'user-1';
    const createTimeEntryDto = {
      date: '2025-01-01',
      hours: 8,
      activityType: 'DEVELOPMENT' as const,
      taskId: 'task-1',
      projectId: 'project-1',
      description: 'Working on feature',
    };

    it('should create a time entry successfully', async () => {
      const mockUser = { id: 'user-1', firstName: 'John' };
      const mockTask = { id: 'task-1', title: 'Task', projectId: 'project-1' };
      const mockProject = { id: 'project-1', name: 'Project' };
      const mockEntry = {
        id: '1',
        userId,
        date: new Date(createTimeEntryDto.date),
        hours: createTimeEntryDto.hours,
        activityType: createTimeEntryDto.activityType,
        taskId: createTimeEntryDto.taskId,
        projectId: createTimeEntryDto.projectId,
        description: createTimeEntryDto.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.timeEntry.create.mockResolvedValue(mockEntry);

      const result = await service.create(userId, createTimeEntryDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, createTimeEntryDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw error when task not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, createTimeEntryDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw error when project not found', async () => {
      const dtoWithProject = { ...createTimeEntryDto, taskId: undefined };
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, dtoWithProject)).rejects.toThrow(NotFoundException);
    });

    it('should throw error when no task or project provided', async () => {
      const dtoNoTaskOrProject = {
        date: '2025-01-01',
        hours: 8,
        activityType: 'DEVELOPMENT' as const,
      };
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await expect(service.create(userId, dtoNoTaskOrProject)).rejects.toThrow(BadRequestException);
    });

    it('should use task projectId when no projectId provided', async () => {
      const dtoNoProject = {
        date: '2025-01-01',
        hours: 8,
        activityType: 'DEVELOPMENT' as const,
        taskId: 'task-1',
      };
      const mockTask = { id: 'task-1', projectId: 'project-from-task' };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.timeEntry.create.mockResolvedValue({ id: '1', ...dtoNoProject });

      const result = await service.create(userId, dtoNoProject);
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated time entries', async () => {
      const mockEntries = [
        { id: '1', userId: 'user-1', hours: 8 },
      ];

      mockPrismaService.timeEntry.findMany.mockResolvedValue(mockEntries);
      mockPrismaService.timeEntry.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by userId', async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);

      await service.findAll(1, 10, 'user-1');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('should filter by projectId', async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, 'project-1');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'project-1' }),
        }),
      );
    });

    it('should filter by taskId', async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, undefined, 'task-1');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ taskId: 'task-1' }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, undefined, undefined, '2025-01-01', '2025-01-31');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should filter by startDate only', async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, undefined, undefined, '2025-01-01');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('should filter by endDate only', async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, undefined, undefined, undefined, '2025-01-31');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a time entry by id', async () => {
      const mockEntry = { id: '1', userId: 'user-1', hours: 8 };

      mockPrismaService.timeEntry.findUnique.mockResolvedValue(mockEntry);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should throw error when entry not found', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a time entry successfully', async () => {
      const updateDto = { hours: 6 };
      const existingEntry = { id: '1', userId: 'user-1', hours: 8, taskId: 'task-1', projectId: 'project-1' };
      const updatedEntry = { ...existingEntry, ...updateDto };

      mockPrismaService.timeEntry.findUnique.mockResolvedValue(existingEntry);
      mockPrismaService.timeEntry.update.mockResolvedValue(updatedEntry);

      const result = await service.update('1', updateDto);

      expect(result).toBeDefined();
      expect(result.hours).toBe(6);
    });

    it('should throw error when entry not found', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(null);

      await expect(service.update('1', { hours: 6 })).rejects.toThrow(NotFoundException);
    });

    it('should update with new taskId', async () => {
      const existingEntry = { id: '1', taskId: 'task-1', projectId: 'project-1' };
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(existingEntry);
      mockPrismaService.task.findUnique.mockResolvedValue({ id: 'task-2' });
      mockPrismaService.timeEntry.update.mockResolvedValue({ ...existingEntry, taskId: 'task-2' });

      const result = await service.update('1', { taskId: 'task-2' });
      expect(result.taskId).toBe('task-2');
    });

    it('should throw error when new task not found', async () => {
      const existingEntry = { id: '1', taskId: 'task-1' };
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(existingEntry);
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.update('1', { taskId: 'invalid' })).rejects.toThrow(NotFoundException);
    });

    it('should update with new projectId', async () => {
      const existingEntry = { id: '1', projectId: 'project-1' };
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(existingEntry);
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'project-2' });
      mockPrismaService.timeEntry.update.mockResolvedValue({ ...existingEntry, projectId: 'project-2' });

      const result = await service.update('1', { projectId: 'project-2' });
      expect(result.projectId).toBe('project-2');
    });

    it('should throw error when new project not found', async () => {
      const existingEntry = { id: '1', projectId: 'project-1' };
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(existingEntry);
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.update('1', { projectId: 'invalid' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a time entry', async () => {
      const mockEntry = { id: '1', userId: 'user-1' };

      mockPrismaService.timeEntry.findUnique.mockResolvedValue(mockEntry);
      mockPrismaService.timeEntry.delete.mockResolvedValue(mockEntry);

      const result = await service.remove('1');

      expect(result.message).toBe('Entrée de temps supprimée avec succès');
      expect(mockPrismaService.timeEntry.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw error when entry not found', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserEntries', () => {
    it('should return entries for user', async () => {
      const mockEntries = [{ id: '1', userId: 'user-1', hours: 8 }];
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.timeEntry.findMany.mockResolvedValue(mockEntries);

      const result = await service.getUserEntries('user-1');

      expect(result).toHaveLength(1);
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserEntries('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should filter by date range', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      await service.getUserEntries('user-1', '2025-01-01', '2025-01-31');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should filter by startDate only', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      await service.getUserEntries('user-1', '2025-01-01');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('should filter by endDate only', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      await service.getUserEntries('user-1', undefined, '2025-01-31');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  describe('getUserReport', () => {
    it('should return user report with totals', async () => {
      const mockEntries = [
        { id: '1', userId: 'user-1', hours: 4, activityType: 'DEVELOPMENT', date: new Date('2025-01-01'), project: { id: 'p1', name: 'Project 1' } },
        { id: '2', userId: 'user-1', hours: 4, activityType: 'MEETING', date: new Date('2025-01-01'), project: { id: 'p1', name: 'Project 1' } },
      ];
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.timeEntry.findMany.mockResolvedValue(mockEntries);

      const result = await service.getUserReport('user-1', '2025-01-01', '2025-01-31');

      expect(result.userId).toBe('user-1');
      expect(result.totalHours).toBe(8);
      expect(result.totalEntries).toBe(2);
      expect(result.byType).toHaveProperty('DEVELOPMENT', 4);
      expect(result.byType).toHaveProperty('MEETING', 4);
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserReport('invalid', '2025-01-01', '2025-01-31'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getProjectReport', () => {
    it('should return project report with totals', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockEntries = [
        { id: '1', hours: 4, activityType: 'DEVELOPMENT', user: { id: 'u1', firstName: 'John', lastName: 'Doe' } },
        { id: '2', hours: 4, activityType: 'MEETING', user: { id: 'u1', firstName: 'John', lastName: 'Doe' } },
      ];
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.timeEntry.findMany.mockResolvedValue(mockEntries);

      const result = await service.getProjectReport('project-1');

      expect(result.projectId).toBe('project-1');
      expect(result.projectName).toBe('Test Project');
      expect(result.totalHours).toBe(8);
      expect(result.totalEntries).toBe(2);
      expect(result.byUser).toHaveLength(1);
      expect(result.byType).toHaveProperty('DEVELOPMENT', 4);
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getProjectReport('invalid'))
        .rejects.toThrow(NotFoundException);
    });

    it('should filter by date range when provided', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'project-1', name: 'Project' });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      const result = await service.getProjectReport('project-1', '2025-01-01', '2025-01-31');

      expect(result.period).not.toBeNull();
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });
});
