import { Test, TestingModule } from '@nestjs/testing';
import { SchoolVacationsService } from './school-vacations.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SchoolVacationZone, SchoolVacationSource, Prisma } from 'database';

describe('SchoolVacationsService', () => {
  let service: SchoolVacationsService;

  const mockPrismaService = {
    schoolVacation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const mockVacation = {
    id: 'vacation-1',
    name: 'Vacances de Noël',
    startDate: new Date('2025-12-20'),
    endDate: new Date('2026-01-05'),
    zone: SchoolVacationZone.A,
    year: 2025,
    source: SchoolVacationSource.MANUAL,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolVacationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SchoolVacationsService>(SchoolVacationsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all vacations without filter', async () => {
      mockPrismaService.schoolVacation.findMany.mockResolvedValue([
        mockVacation,
      ]);

      const result = await service.findAll();

      expect(mockPrismaService.schoolVacation.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { startDate: 'asc' },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      expect(result).toEqual([mockVacation]);
    });

    it('should filter vacations by year when provided', async () => {
      mockPrismaService.schoolVacation.findMany.mockResolvedValue([
        mockVacation,
      ]);

      const result = await service.findAll(2025);

      expect(mockPrismaService.schoolVacation.findMany).toHaveBeenCalledWith({
        where: { year: 2025 },
        orderBy: { startDate: 'asc' },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      expect(result).toEqual([mockVacation]);
    });
  });

  describe('findOne', () => {
    it('should return a vacation by id', async () => {
      mockPrismaService.schoolVacation.findUnique.mockResolvedValue(
        mockVacation,
      );

      const result = await service.findOne('vacation-1');

      expect(mockPrismaService.schoolVacation.findUnique).toHaveBeenCalledWith({
        where: { id: 'vacation-1' },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      expect(result).toEqual(mockVacation);
    });

    it('should throw NotFoundException when vacation not found', async () => {
      mockPrismaService.schoolVacation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByRange', () => {
    it('should call findMany with correct overlap where clause', async () => {
      mockPrismaService.schoolVacation.findMany.mockResolvedValue([
        mockVacation,
      ]);

      const startDate = '2025-12-15';
      const endDate = '2025-12-25';
      const result = await service.findByRange(startDate, endDate);

      expect(mockPrismaService.schoolVacation.findMany).toHaveBeenCalledWith({
        where: {
          startDate: { lte: new Date(endDate) },
          endDate: { gte: new Date(startDate) },
        },
        orderBy: { startDate: 'asc' },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      expect(result).toEqual([mockVacation]);
    });

    it('should return empty array when no vacations overlap the range', async () => {
      mockPrismaService.schoolVacation.findMany.mockResolvedValue([]);

      const result = await service.findByRange('2030-01-01', '2030-01-31');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a vacation and return it', async () => {
      mockPrismaService.schoolVacation.create.mockResolvedValue(mockVacation);

      const dto = {
        name: 'Vacances de Noël',
        startDate: '2025-12-20',
        endDate: '2026-01-05',
        zone: SchoolVacationZone.A,
        year: 2025,
        source: SchoolVacationSource.MANUAL,
      };

      const result = await service.create(dto, 'user-1');

      expect(mockPrismaService.schoolVacation.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          zone: dto.zone,
          year: dto.year,
          source: dto.source,
          createdById: 'user-1',
        },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      expect(result).toEqual(mockVacation);
    });

    it('should use MANUAL as default source when source is not provided', async () => {
      mockPrismaService.schoolVacation.create.mockResolvedValue(mockVacation);

      const dto = {
        name: 'Vacances de Noël',
        startDate: '2025-12-20',
        endDate: '2026-01-05',
        zone: SchoolVacationZone.A,
        year: 2025,
      };

      await service.create(dto, 'user-1');

      expect(mockPrismaService.schoolVacation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: SchoolVacationSource.MANUAL,
          }),
        }),
      );
    });

    it('should throw ConflictException on P2002 unique constraint violation', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.0.0', meta: {} },
      );
      mockPrismaService.schoolVacation.create.mockRejectedValue(prismaError);

      const dto = {
        name: 'Vacances de Noël',
        startDate: '2025-12-20',
        endDate: '2026-01-05',
        zone: SchoolVacationZone.A,
        year: 2025,
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow non-P2002 errors', async () => {
      const genericError = new Error('Database connection error');
      mockPrismaService.schoolVacation.create.mockRejectedValue(genericError);

      const dto = {
        name: 'Vacances de Noël',
        startDate: '2025-12-20',
        endDate: '2026-01-05',
        zone: SchoolVacationZone.A,
        year: 2025,
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        'Database connection error',
      );
    });
  });

  describe('update', () => {
    it('should call findOne then update and return updated vacation', async () => {
      const updatedVacation = { ...mockVacation, name: 'Vacances de Printemps' };
      mockPrismaService.schoolVacation.findUnique.mockResolvedValue(
        mockVacation,
      );
      mockPrismaService.schoolVacation.update.mockResolvedValue(updatedVacation);

      const dto = { name: 'Vacances de Printemps' };
      const result = await service.update('vacation-1', dto);

      expect(mockPrismaService.schoolVacation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'vacation-1' } }),
      );
      expect(mockPrismaService.schoolVacation.update).toHaveBeenCalledWith({
        where: { id: 'vacation-1' },
        data: { name: 'Vacances de Printemps' },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      expect(result).toEqual(updatedVacation);
    });

    it('should throw NotFoundException when vacation to update does not exist', async () => {
      mockPrismaService.schoolVacation.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.schoolVacation.update).not.toHaveBeenCalled();
    });

    it('should only include provided fields in update data', async () => {
      mockPrismaService.schoolVacation.findUnique.mockResolvedValue(
        mockVacation,
      );
      mockPrismaService.schoolVacation.update.mockResolvedValue(mockVacation);

      const dto = { year: 2026 };
      await service.update('vacation-1', dto);

      expect(mockPrismaService.schoolVacation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { year: 2026 },
        }),
      );
    });
  });

  describe('remove', () => {
    it('should call findOne then delete the vacation', async () => {
      mockPrismaService.schoolVacation.findUnique.mockResolvedValue(
        mockVacation,
      );
      mockPrismaService.schoolVacation.delete.mockResolvedValue(mockVacation);

      await service.remove('vacation-1');

      expect(mockPrismaService.schoolVacation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'vacation-1' } }),
      );
      expect(mockPrismaService.schoolVacation.delete).toHaveBeenCalledWith({
        where: { id: 'vacation-1' },
      });
    });

    it('should throw NotFoundException when vacation to remove does not exist', async () => {
      mockPrismaService.schoolVacation.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.schoolVacation.delete).not.toHaveBeenCalled();
    });
  });
});
