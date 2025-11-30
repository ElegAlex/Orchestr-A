import { Test, TestingModule } from '@nestjs/testing';
import { TeleworkService } from './telework.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('TeleworkService', () => {
  let service: TeleworkService;

  const mockPrismaService = {
    teleworkSchedule: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  const mockTelework = {
    id: 'telework-1',
    userId: 'user-1',
    date: new Date('2025-11-20'),
    isTelework: true,
    isException: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: 'CONTRIBUTEUR',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeleworkService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TeleworkService>(TeleworkService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a telework request successfully', async () => {
      const createDto = {
        date: '2025-11-20',
        isTelework: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);
      mockPrismaService.teleworkSchedule.create.mockResolvedValue(mockTelework);

      const result = await service.create('user-1', createDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(mockPrismaService.teleworkSchedule.create).toHaveBeenCalled();
    });

    it('should create telework for different user when admin', async () => {
      const createDto = {
        date: '2025-11-20',
        isTelework: true,
        userId: 'user-2',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);
      mockPrismaService.teleworkSchedule.create.mockResolvedValue({
        ...mockTelework,
        userId: 'user-2',
      });

      const result = await service.create('admin-1', createDto);

      expect(result.userId).toBe('user-2');
    });

    it('should throw error when user not found', async () => {
      const createDto = {
        date: '2025-11-20',
        isTelework: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create('nonexistent', createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw error when telework already exists for date', async () => {
      const createDto = {
        date: '2025-11-20',
        isTelework: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(mockTelework);

      await expect(service.create('user-1', createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated telework requests', async () => {
      const mockTeleworks = [mockTelework];
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue(mockTeleworks);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter telework by user', async () => {
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([mockTelework]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10, 'user-1');

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, '2025-01-01', '2025-01-31');

      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
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
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, '2025-01-01');

      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('should filter by endDate only', async () => {
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, undefined, '2025-01-31');

      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a telework request by id', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(mockTelework);

      const result = await service.findOne('telework-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('telework-1');
    });

    it('should throw error when telework not found', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWeeklySchedule', () => {
    it('should return weekly schedule for user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([
        { ...mockTelework, isTelework: true },
        { ...mockTelework, id: 'telework-2', isTelework: true },
      ]);

      const result = await service.getWeeklySchedule('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.teleworks).toHaveLength(2);
      expect(result.totalDays).toBe(2);
    });

    it('should return weekly schedule for specific date', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);

      const result = await service.getWeeklySchedule('user-1', '2025-11-15');

      expect(result.userId).toBe('user-1');
      expect(result.weekStart).toBeDefined();
      expect(result.weekEnd).toBeDefined();
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getWeeklySchedule('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserStats', () => {
    it('should return user stats for current year', async () => {
      const mockTeleworks = [
        { ...mockTelework, date: new Date('2025-01-15'), isTelework: true },
        { ...mockTelework, date: new Date('2025-01-20'), isTelework: true },
        { ...mockTelework, date: new Date('2025-02-10'), isTelework: true },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue(mockTeleworks);

      const result = await service.getUserStats('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.totalDays).toBe(3);
      expect(result.byMonth[0]).toBe(2); // January
      expect(result.byMonth[1]).toBe(1); // February
    });

    it('should return user stats for specific year', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);

      const result = await service.getUserStats('user-1', 2024);

      expect(result.year).toBe(2024);
      expect(result.totalDays).toBe(0);
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserStats('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a telework request successfully', async () => {
      const updateDto = { isTelework: false };
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(mockTelework);
      mockPrismaService.teleworkSchedule.update.mockResolvedValue({
        ...mockTelework,
        isTelework: false,
      });

      const result = await service.update('telework-1', 'user-1', updateDto);

      expect(result.isTelework).toBe(false);
    });

    it('should throw error when telework not found', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid', 'user-1', {})).rejects.toThrow(NotFoundException);
    });

    it('should update date when provided', async () => {
      const updateDto = { date: '2025-11-25' };
      mockPrismaService.teleworkSchedule.findUnique
        .mockResolvedValueOnce({ ...mockTelework, date: new Date('2025-11-20') })
        .mockResolvedValueOnce(null);
      mockPrismaService.teleworkSchedule.update.mockResolvedValue({
        ...mockTelework,
        date: new Date('2025-11-25'),
      });

      const result = await service.update('telework-1', 'user-1', updateDto);

      expect(result).toBeDefined();
    });

    it('should throw conflict when new date already has telework', async () => {
      const updateDto = { date: '2025-11-25' };
      mockPrismaService.teleworkSchedule.findUnique
        .mockResolvedValueOnce({ ...mockTelework, date: new Date('2025-11-20') })
        .mockResolvedValueOnce({ id: 'other-telework' });

      await expect(service.update('telework-1', 'user-1', updateDto)).rejects.toThrow(ConflictException);
    });

    it('should update isException', async () => {
      const updateDto = { isException: true };
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(mockTelework);
      mockPrismaService.teleworkSchedule.update.mockResolvedValue({
        ...mockTelework,
        isException: true,
      });

      const result = await service.update('telework-1', 'user-1', updateDto);

      expect(result.isException).toBe(true);
    });
  });

  describe('remove', () => {
    it('should delete a telework request', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(mockTelework);
      mockPrismaService.teleworkSchedule.delete.mockResolvedValue(mockTelework);

      const result = await service.remove('telework-1', 'user-1');

      expect(result.message).toBe('Télétravail supprimé avec succès');
      expect(mockPrismaService.teleworkSchedule.delete).toHaveBeenCalledWith({
        where: { id: 'telework-1' },
      });
    });

    it('should throw error when telework not found', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw error when user tries to delete another user telework', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue({
        ...mockTelework,
        userId: 'other-user',
      });

      await expect(service.remove('telework-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTeamSchedule', () => {
    it('should return team schedule for today', async () => {
      const mockTeleworks = [mockTelework];
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue(mockTeleworks);

      const result = await service.getTeamSchedule();

      expect(result.date).toBeDefined();
      expect(result.totalCount).toBe(1);
      expect(result.teleworks).toHaveLength(1);
    });

    it('should return team schedule for specific date', async () => {
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);

      const result = await service.getTeamSchedule('2025-11-20');

      expect(result.date).toBeDefined();
      expect(result.totalCount).toBe(0);
    });

    it('should filter by departmentId', async () => {
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);

      await service.getTeamSchedule(undefined, 'dept-1');

      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { departmentId: 'dept-1' },
          }),
        }),
      );
    });
  });
});
