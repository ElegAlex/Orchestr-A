import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TeleworkController } from './telework.controller';
import { TeleworkService } from './telework.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('TeleworkController', () => {
  let controller: TeleworkController;

  const mockTelework = {
    id: 'telework-id-1',
    userId: 'user-id-1',
    date: new Date('2025-01-15'),
    isTelework: true,
    isException: false,
    createdAt: new Date(),
    user: {
      id: 'user-id-1',
      firstName: 'John',
      lastName: 'Doe',
    },
  };

  const mockTeleworkService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getWeeklySchedule: vi.fn(),
    getUserStats: vi.fn(),
    getTeamSchedule: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeleworkController],
      providers: [
        {
          provide: TeleworkService,
          useValue: mockTeleworkService,
        },
      ],
    }).compile();

    controller = module.get<TeleworkController>(TeleworkController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createTeleworkDto = {
      date: '2025-01-15',
      isTelework: true,
      isException: false,
    };

    it('should create a telework entry successfully', async () => {
      mockTeleworkService.create.mockResolvedValue(mockTelework);

      const result = await controller.create('user-id-1', createTeleworkDto);

      expect(result).toEqual(mockTelework);
      expect(mockTeleworkService.create).toHaveBeenCalledWith(
        'user-id-1',
        createTeleworkDto,
      );
      expect(mockTeleworkService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when telework already exists for date', async () => {
      mockTeleworkService.create.mockRejectedValue(
        new ConflictException('Un télétravail existe déjà pour cette date'),
      );

      await expect(
        controller.create('user-id-1', createTeleworkDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid date', async () => {
      mockTeleworkService.create.mockRejectedValue(
        new BadRequestException('Date invalide'),
      );

      await expect(
        controller.create('user-id-1', {
          ...createTeleworkDto,
          date: 'invalid',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated telework entries', async () => {
      const paginatedResult = {
        data: [mockTelework],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockTeleworkService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockTeleworkService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should filter by userId', async () => {
      const userTelework = {
        data: [mockTelework],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockTeleworkService.findAll.mockResolvedValue(userTelework);

      await controller.findAll(1, 10, 'user-id-1');

      expect(mockTeleworkService.findAll).toHaveBeenCalledWith(
        1,
        10,
        'user-id-1',
        undefined,
        undefined,
      );
    });

    it('should filter by date range', async () => {
      mockTeleworkService.findAll.mockResolvedValue({
        data: [mockTelework],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      await controller.findAll(1, 10, undefined, '2025-01-01', '2025-01-31');

      expect(mockTeleworkService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        '2025-01-01',
        '2025-01-31',
      );
    });
  });

  describe('findOne', () => {
    it('should return a telework entry by id', async () => {
      mockTeleworkService.findOne.mockResolvedValue(mockTelework);

      const result = await controller.findOne('telework-id-1');

      expect(result).toEqual(mockTelework);
      expect(mockTeleworkService.findOne).toHaveBeenCalledWith('telework-id-1');
    });

    it('should throw NotFoundException when telework not found', async () => {
      mockTeleworkService.findOne.mockRejectedValue(
        new NotFoundException('Télétravail introuvable'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyWeeklySchedule', () => {
    it('should return weekly schedule for current user', async () => {
      const weeklySchedule = {
        userId: 'user-id-1',
        weekStart: '2025-01-13',
        days: [
          { date: '2025-01-13', isTelework: false },
          { date: '2025-01-14', isTelework: true },
          { date: '2025-01-15', isTelework: false },
          { date: '2025-01-16', isTelework: true },
          { date: '2025-01-17', isTelework: false },
        ],
      };

      mockTeleworkService.getWeeklySchedule.mockResolvedValue(weeklySchedule);

      const result = await controller.getMyWeeklySchedule(
        'user-id-1',
        '2025-01-13',
      );

      expect(result).toEqual(weeklySchedule);
      expect(mockTeleworkService.getWeeklySchedule).toHaveBeenCalledWith(
        'user-id-1',
        '2025-01-13',
      );
    });
  });

  describe('getMyStats', () => {
    it('should return telework statistics for current user', async () => {
      const stats = {
        userId: 'user-id-1',
        year: 2025,
        totalDays: 45,
        byMonth: [
          { month: 1, days: 8 },
          { month: 2, days: 10 },
        ],
        average: 8.5,
      };

      mockTeleworkService.getUserStats.mockResolvedValue(stats);

      const result = await controller.getMyStats('user-id-1', 2025);

      expect(result).toEqual(stats);
      expect(mockTeleworkService.getUserStats).toHaveBeenCalledWith(
        'user-id-1',
        2025,
      );
    });

    it('should use current year when not specified', async () => {
      const stats = { totalDays: 20 };
      mockTeleworkService.getUserStats.mockResolvedValue(stats);

      await controller.getMyStats('user-id-1', undefined);

      expect(mockTeleworkService.getUserStats).toHaveBeenCalledWith(
        'user-id-1',
        undefined,
      );
    });
  });

  describe('getTeamTelework', () => {
    it('should return team telework for a specific date', async () => {
      const teamSchedule = [
        {
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          isTelework: true,
        },
        {
          userId: 'user-2',
          firstName: 'Jane',
          lastName: 'Smith',
          isTelework: false,
        },
      ];

      mockTeleworkService.getTeamSchedule.mockResolvedValue(teamSchedule);

      const result = await controller.getTeamTelework('2025-01-15');

      expect(result).toEqual(teamSchedule);
      expect(mockTeleworkService.getTeamSchedule).toHaveBeenCalledWith(
        '2025-01-15',
        undefined,
      );
    });

    it('should filter by department', async () => {
      const departmentSchedule = [
        {
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          isTelework: true,
        },
      ];

      mockTeleworkService.getTeamSchedule.mockResolvedValue(departmentSchedule);

      await controller.getTeamTelework('2025-01-15', 'dept-1');

      expect(mockTeleworkService.getTeamSchedule).toHaveBeenCalledWith(
        '2025-01-15',
        'dept-1',
      );
    });
  });

  describe('getUserWeeklySchedule', () => {
    it('should return weekly schedule for specified user (admin)', async () => {
      const weeklySchedule = {
        userId: 'user-id-2',
        weekStart: '2025-01-13',
        days: [],
      };

      mockTeleworkService.getWeeklySchedule.mockResolvedValue(weeklySchedule);

      const result = await controller.getUserWeeklySchedule(
        'user-id-2',
        '2025-01-13',
      );

      expect(result).toEqual(weeklySchedule);
      expect(mockTeleworkService.getWeeklySchedule).toHaveBeenCalledWith(
        'user-id-2',
        '2025-01-13',
      );
    });
  });

  describe('getUserStats', () => {
    it('should return telework stats for specified user (admin)', async () => {
      const stats = { totalDays: 30 };
      mockTeleworkService.getUserStats.mockResolvedValue(stats);

      const result = await controller.getUserStats('user-id-2', 2025);

      expect(result).toEqual(stats);
      expect(mockTeleworkService.getUserStats).toHaveBeenCalledWith(
        'user-id-2',
        2025,
      );
    });
  });

  describe('update', () => {
    const updateTeleworkDto = {
      isTelework: false,
    };

    it('should update a telework entry successfully', async () => {
      const updatedTelework = { ...mockTelework, isTelework: false };
      mockTeleworkService.update.mockResolvedValue(updatedTelework);

      const result = await controller.update(
        'telework-id-1',
        'user-id-1',
        updateTeleworkDto,
      );

      expect(result.isTelework).toBe(false);
      expect(mockTeleworkService.update).toHaveBeenCalledWith(
        'telework-id-1',
        'user-id-1',
        updateTeleworkDto,
      );
    });

    it('should throw NotFoundException when telework not found', async () => {
      mockTeleworkService.update.mockRejectedValue(
        new NotFoundException('Télétravail introuvable'),
      );

      await expect(
        controller.update('nonexistent', 'user-id-1', updateTeleworkDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on date conflict', async () => {
      mockTeleworkService.update.mockRejectedValue(
        new ConflictException('Conflit avec un télétravail existant'),
      );

      await expect(
        controller.update('telework-id-1', 'user-id-1', { date: '2025-01-20' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a telework entry', async () => {
      mockTeleworkService.remove.mockResolvedValue({
        message: 'Télétravail supprimé',
      });

      const result = await controller.remove('telework-id-1', 'user-id-1');

      expect(result.message).toBe('Télétravail supprimé');
      expect(mockTeleworkService.remove).toHaveBeenCalledWith(
        'telework-id-1',
        'user-id-1',
      );
    });

    it('should throw NotFoundException when telework not found', async () => {
      mockTeleworkService.remove.mockRejectedValue(
        new NotFoundException('Télétravail introuvable'),
      );

      await expect(
        controller.remove('nonexistent', 'user-id-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
