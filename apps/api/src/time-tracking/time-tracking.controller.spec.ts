import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TimeTrackingController } from './time-tracking.controller';
import { TimeTrackingService } from './time-tracking.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TimeTrackingController', () => {
  let controller: TimeTrackingController;

  const mockTimeEntry = {
    id: 'entry-id-1',
    userId: 'user-id-1',
    projectId: 'project-id-1',
    taskId: 'task-id-1',
    date: new Date('2025-01-15'),
    hours: 4.5,
    description: 'Development work',
    activityType: 'DEVELOPMENT',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-id-1',
      firstName: 'John',
      lastName: 'Doe',
    },
    project: {
      id: 'project-id-1',
      name: 'Main Project',
    },
    task: {
      id: 'task-id-1',
      title: 'Implement feature',
    },
  };

  const mockTimeTrackingService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getUserEntries: vi.fn(),
    getUserReport: vi.fn(),
    getProjectReport: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeTrackingController],
      providers: [
        {
          provide: TimeTrackingService,
          useValue: mockTimeTrackingService,
        },
      ],
    }).compile();

    controller = module.get<TimeTrackingController>(TimeTrackingController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createTimeEntryDto = {
      projectId: 'project-id-1',
      taskId: 'task-id-1',
      date: '2025-01-15',
      hours: 4.5,
      description: 'Development work',
      activityType: 'DEVELOPMENT' as const,
    };

    it('should create a time entry successfully', async () => {
      mockTimeTrackingService.create.mockResolvedValue(mockTimeEntry);

      const result = await controller.create('user-id-1', createTimeEntryDto);

      expect(result).toEqual(mockTimeEntry);
      expect(mockTimeTrackingService.create).toHaveBeenCalledWith(
        'user-id-1',
        createTimeEntryDto,
      );
      expect(mockTimeTrackingService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when neither task nor project specified', async () => {
      mockTimeTrackingService.create.mockRejectedValue(
        new BadRequestException('Une tâche ou un projet doit être spécifié'),
      );

      await expect(
        controller.create('user-id-1', {
          ...createTimeEntryDto,
          projectId: undefined,
          taskId: undefined,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTimeTrackingService.create.mockRejectedValue(
        new NotFoundException('Tâche introuvable'),
      );

      await expect(
        controller.create('user-id-1', createTimeEntryDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated time entries', async () => {
      const paginatedResult = {
        data: [mockTimeEntry],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockTimeTrackingService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockTimeTrackingService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should filter by userId', async () => {
      mockTimeTrackingService.findAll.mockResolvedValue({
        data: [mockTimeEntry],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      await controller.findAll(1, 10, 'user-id-1');

      expect(mockTimeTrackingService.findAll).toHaveBeenCalledWith(
        1,
        10,
        'user-id-1',
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should filter by projectId', async () => {
      mockTimeTrackingService.findAll.mockResolvedValue({
        data: [mockTimeEntry],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      await controller.findAll(1, 10, undefined, 'project-id-1');

      expect(mockTimeTrackingService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        'project-id-1',
        undefined,
        undefined,
        undefined,
      );
    });

    it('should filter by date range', async () => {
      mockTimeTrackingService.findAll.mockResolvedValue({
        data: [mockTimeEntry],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      await controller.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        '2025-01-01',
        '2025-01-31',
      );

      expect(mockTimeTrackingService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
        '2025-01-01',
        '2025-01-31',
      );
    });
  });

  describe('findOne', () => {
    it('should return a time entry by id', async () => {
      mockTimeTrackingService.findOne.mockResolvedValue(mockTimeEntry);

      const result = await controller.findOne('entry-id-1');

      expect(result).toEqual(mockTimeEntry);
      expect(mockTimeTrackingService.findOne).toHaveBeenCalledWith(
        'entry-id-1',
      );
    });

    it('should throw NotFoundException when entry not found', async () => {
      mockTimeTrackingService.findOne.mockRejectedValue(
        new NotFoundException('Entrée de temps introuvable'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyEntries', () => {
    it('should return time entries for current user', async () => {
      const userEntries = [mockTimeEntry];
      mockTimeTrackingService.getUserEntries.mockResolvedValue(userEntries);

      const result = await controller.getMyEntries('user-id-1');

      expect(result).toEqual(userEntries);
      expect(mockTimeTrackingService.getUserEntries).toHaveBeenCalledWith(
        'user-id-1',
        undefined,
        undefined,
      );
    });

    it('should filter by date range', async () => {
      mockTimeTrackingService.getUserEntries.mockResolvedValue([mockTimeEntry]);

      await controller.getMyEntries('user-id-1', '2025-01-01', '2025-01-31');

      expect(mockTimeTrackingService.getUserEntries).toHaveBeenCalledWith(
        'user-id-1',
        '2025-01-01',
        '2025-01-31',
      );
    });
  });

  describe('getMyReport', () => {
    it('should return time report for current user', async () => {
      const report = {
        totalHours: 40,
        byActivityType: {
          DEVELOPMENT: 30,
          MEETING: 10,
        },
        byProject: [
          { projectId: 'project-id-1', name: 'Main Project', hours: 40 },
        ],
        byDate: [{ date: '2025-01-15', hours: 8 }],
      };

      mockTimeTrackingService.getUserReport.mockResolvedValue(report);

      const result = await controller.getMyReport(
        'user-id-1',
        '2025-01-01',
        '2025-01-31',
      );

      expect(result).toEqual(report);
      expect(mockTimeTrackingService.getUserReport).toHaveBeenCalledWith(
        'user-id-1',
        '2025-01-01',
        '2025-01-31',
      );
    });
  });

  describe('getUserReport', () => {
    it('should return time report for specified user (admin)', async () => {
      const report = { totalHours: 40 };
      mockTimeTrackingService.getUserReport.mockResolvedValue(report);

      const result = await controller.getUserReport(
        'user-id-2',
        '2025-01-01',
        '2025-01-31',
      );

      expect(result).toEqual(report);
      expect(mockTimeTrackingService.getUserReport).toHaveBeenCalledWith(
        'user-id-2',
        '2025-01-01',
        '2025-01-31',
      );
    });
  });

  describe('getProjectReport', () => {
    it('should return time report for a project', async () => {
      const report = {
        totalHours: 200,
        byUser: [
          { userId: 'user-id-1', name: 'John Doe', hours: 100 },
          { userId: 'user-id-2', name: 'Jane Smith', hours: 100 },
        ],
        byActivityType: {
          DEVELOPMENT: 150,
          MEETING: 50,
        },
      };

      mockTimeTrackingService.getProjectReport.mockResolvedValue(report);

      const result = await controller.getProjectReport('project-id-1');

      expect(result).toEqual(report);
      expect(mockTimeTrackingService.getProjectReport).toHaveBeenCalledWith(
        'project-id-1',
        undefined,
        undefined,
      );
    });

    it('should filter by date range', async () => {
      mockTimeTrackingService.getProjectReport.mockResolvedValue({
        totalHours: 100,
      });

      await controller.getProjectReport(
        'project-id-1',
        '2025-01-01',
        '2025-01-31',
      );

      expect(mockTimeTrackingService.getProjectReport).toHaveBeenCalledWith(
        'project-id-1',
        '2025-01-01',
        '2025-01-31',
      );
    });

    it('should throw NotFoundException when project not found', async () => {
      mockTimeTrackingService.getProjectReport.mockRejectedValue(
        new NotFoundException('Projet introuvable'),
      );

      await expect(controller.getProjectReport('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateTimeEntryDto = {
      hours: 6,
      description: 'Updated description',
    };

    it('should update a time entry successfully', async () => {
      const updatedEntry = { ...mockTimeEntry, ...updateTimeEntryDto };
      mockTimeTrackingService.update.mockResolvedValue(updatedEntry);

      const result = await controller.update('entry-id-1', updateTimeEntryDto);

      expect(result.hours).toBe(6);
      expect(result.description).toBe('Updated description');
      expect(mockTimeTrackingService.update).toHaveBeenCalledWith(
        'entry-id-1',
        updateTimeEntryDto,
      );
    });

    it('should throw NotFoundException when entry not found', async () => {
      mockTimeTrackingService.update.mockRejectedValue(
        new NotFoundException('Entrée de temps introuvable'),
      );

      await expect(
        controller.update('nonexistent', updateTimeEntryDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a time entry successfully', async () => {
      mockTimeTrackingService.remove.mockResolvedValue({
        message: 'Entrée de temps supprimée',
      });

      const result = await controller.remove('entry-id-1');

      expect(result.message).toBe('Entrée de temps supprimée');
      expect(mockTimeTrackingService.remove).toHaveBeenCalledWith('entry-id-1');
    });

    it('should throw NotFoundException when entry not found', async () => {
      mockTimeTrackingService.remove.mockRejectedValue(
        new NotFoundException('Entrée de temps introuvable'),
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
