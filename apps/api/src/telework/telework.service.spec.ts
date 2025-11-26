import { Test, TestingModule } from '@nestjs/testing';
import { TeleworkService } from './telework.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('TeleworkService', () => {
  let service: TeleworkService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    telework: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
    status: 'PENDING',
    reason: 'Work from home',
    createdAt: new Date(),
    updatedAt: new Date(),
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
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a telework request successfully', async () => {
      const createDto = {
        userId: 'user-1',
        date: new Date('2025-11-20'),
        reason: 'Work from home',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.telework.findFirst.mockResolvedValue(null);
      mockPrismaService.telework.create.mockResolvedValue(mockTelework);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe(createDto.userId);
      expect(mockPrismaService.telework.create).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      const createDto = {
        userId: 'nonexistent',
        date: new Date('2025-11-20'),
        reason: 'Work from home',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw error when telework already exists for date', async () => {
      const createDto = {
        userId: 'user-1',
        date: new Date('2025-11-20'),
        reason: 'Work from home',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.telework.findFirst.mockResolvedValue(mockTelework);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated telework requests', async () => {
      const mockTeleworks = [mockTelework];
      mockPrismaService.telework.findMany.mockResolvedValue(mockTeleworks);
      mockPrismaService.telework.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter telework by user', async () => {
      mockPrismaService.telework.findMany.mockResolvedValue([mockTelework]);
      mockPrismaService.telework.count.mockResolvedValue(1);

      await service.findAll({ userId: 'user-1' });

      expect(mockPrismaService.telework.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a telework request by id', async () => {
      mockPrismaService.telework.findUnique.mockResolvedValue(mockTelework);

      const result = await service.findOne('telework-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('telework-1');
    });

    it('should throw error when telework not found', async () => {
      mockPrismaService.telework.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a telework request successfully', async () => {
      const updateDto = { status: 'APPROVED' as const };
      mockPrismaService.telework.findUnique.mockResolvedValue(mockTelework);
      mockPrismaService.telework.update.mockResolvedValue({
        ...mockTelework,
        ...updateDto,
      });

      const result = await service.update('telework-1', updateDto);

      expect(result.status).toBe('APPROVED');
    });
  });

  describe('remove', () => {
    it('should delete a telework request', async () => {
      mockPrismaService.telework.findUnique.mockResolvedValue(mockTelework);
      mockPrismaService.telework.delete.mockResolvedValue(mockTelework);

      await service.remove('telework-1');

      expect(mockPrismaService.telework.delete).toHaveBeenCalledWith({
        where: { id: 'telework-1' },
      });
    });
  });
});
