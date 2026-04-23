import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HolidaysService } from './holidays.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { HolidayType, Prisma } from 'database';

describe('HolidaysService', () => {
  let service: HolidaysService;

  const mockPrismaService = {
    holiday: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const mockHoliday = {
    id: 'holiday-1',
    date: new Date('2025-01-01'),
    name: "Jour de l'An",
    type: HolidayType.LEGAL,
    isWorkDay: false,
    description: null,
    recurring: false,
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
        HolidaysService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<HolidaysService>(HolidaysService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all holidays ordered by date', async () => {
      const holidays = [mockHoliday];
      mockPrismaService.holiday.findMany.mockResolvedValue(holidays);

      const result = await service.findAll();

      expect(result).toEqual(holidays);
      expect(mockPrismaService.holiday.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { date: 'asc' } }),
      );
    });

    it('should return empty array when no holidays exist', async () => {
      mockPrismaService.holiday.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a holiday by id', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(mockHoliday);

      const result = await service.findOne('holiday-1');

      expect(result).toEqual(mockHoliday);
      expect(mockPrismaService.holiday.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'holiday-1' } }),
      );
    });

    it('should throw NotFoundException when holiday not found', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'nonexistent',
      );
    });
  });

  describe('findByYear', () => {
    it('should return holidays for a given year', async () => {
      const holidays = [mockHoliday];
      mockPrismaService.holiday.findMany.mockResolvedValue(holidays);

      const result = await service.findByYear(2025);

      expect(result).toEqual(holidays);
      expect(mockPrismaService.holiday.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date: {
              gte: new Date(2025, 0, 1),
              lte: new Date(2025, 11, 31),
            },
          },
        }),
      );
    });

    it('should return empty array when no holidays for the year', async () => {
      mockPrismaService.holiday.findMany.mockResolvedValue([]);

      const result = await service.findByYear(2099);

      expect(result).toEqual([]);
    });
  });

  describe('findByRange', () => {
    it('should return holidays in a date range', async () => {
      const holidays = [mockHoliday];
      mockPrismaService.holiday.findMany.mockResolvedValue(holidays);

      const result = await service.findByRange('2025-01-01', '2025-12-31');

      expect(result).toEqual(holidays);
      expect(mockPrismaService.holiday.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date: {
              gte: new Date('2025-01-01'),
              lte: new Date('2025-12-31'),
            },
          },
        }),
      );
    });
  });

  describe('create', () => {
    const createHolidayDto = {
      date: '2025-06-15',
      name: 'Custom Holiday',
      type: HolidayType.LOCAL,
      isWorkDay: false,
      description: 'A local holiday',
      recurring: true,
    };

    it('should create a holiday successfully', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(null);
      mockPrismaService.holiday.create.mockResolvedValue({
        ...mockHoliday,
        date: new Date('2025-06-15'),
        name: 'Custom Holiday',
      });

      const result = await service.create(createHolidayDto, 'user-1');

      expect(result).toBeDefined();
      expect(result.name).toBe('Custom Holiday');
      expect(mockPrismaService.holiday.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Custom Holiday',
            type: HolidayType.LOCAL,
            isWorkDay: false,
            recurring: true,
            createdById: 'user-1',
          }),
        }),
      );
    });

    it('should use LEGAL type as default when type not provided', async () => {
      const dtoWithoutType = {
        date: '2025-06-15',
        name: 'Holiday Without Type',
      };

      mockPrismaService.holiday.findUnique.mockResolvedValue(null);
      mockPrismaService.holiday.create.mockResolvedValue({
        ...mockHoliday,
        name: 'Holiday Without Type',
      });

      await service.create(dtoWithoutType as any, 'user-1');

      expect(mockPrismaService.holiday.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: HolidayType.LEGAL }),
        }),
      );
    });

    it('should throw ConflictException when holiday already exists for date', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(mockHoliday);

      await expect(service.create(createHolidayDto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.holiday.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update holiday name without changing date', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(mockHoliday);
      const updated = { ...mockHoliday, name: 'Updated Name' };
      mockPrismaService.holiday.update.mockResolvedValue(updated);

      const result = await service.update('holiday-1', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockPrismaService.holiday.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'holiday-1' },
          data: { name: 'Updated Name' },
        }),
      );
    });

    it('should update holiday date when new date is provided and no conflict', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(mockHoliday);
      mockPrismaService.holiday.findFirst.mockResolvedValue(null);
      const updated = { ...mockHoliday, date: new Date('2025-03-15') };
      mockPrismaService.holiday.update.mockResolvedValue(updated);

      await service.update('holiday-1', { date: '2025-03-15' });

      expect(mockPrismaService.holiday.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date: new Date('2025-03-15'),
            id: { not: 'holiday-1' },
          },
        }),
      );
      expect(mockPrismaService.holiday.update).toHaveBeenCalled();
    });

    it('should throw ConflictException when another holiday exists at the new date', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(mockHoliday);
      mockPrismaService.holiday.findFirst.mockResolvedValue({
        ...mockHoliday,
        id: 'other-holiday',
        date: new Date('2025-03-15'),
      });

      await expect(
        service.update('holiday-1', { date: '2025-03-15' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.holiday.update).not.toHaveBeenCalled();
    });

    it('should update isWorkDay, type, description and recurring fields', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(mockHoliday);
      const updated = {
        ...mockHoliday,
        isWorkDay: true,
        type: HolidayType.LOCAL,
        description: 'New description',
        recurring: true,
      };
      mockPrismaService.holiday.update.mockResolvedValue(updated);

      await service.update('holiday-1', {
        isWorkDay: true,
        type: HolidayType.LOCAL,
        description: 'New description',
        recurring: true,
      });

      expect(mockPrismaService.holiday.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            isWorkDay: true,
            type: HolidayType.LOCAL,
            description: 'New description',
            recurring: true,
          },
        }),
      );
    });

    it('should throw NotFoundException when holiday to update does not exist', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a holiday successfully', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(mockHoliday);
      mockPrismaService.holiday.delete.mockResolvedValue(mockHoliday);

      await service.remove('holiday-1');

      expect(mockPrismaService.holiday.delete).toHaveBeenCalledWith({
        where: { id: 'holiday-1' },
      });
    });

    it('should throw NotFoundException when holiday to remove does not exist', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.holiday.delete).not.toHaveBeenCalled();
    });
  });

  describe('importFrenchHolidays', () => {
    it('should create all 11 French public holidays and return created count', async () => {
      mockPrismaService.holiday.create.mockResolvedValue(mockHoliday);

      const result = await service.importFrenchHolidays(2025, 'user-1');

      expect(result.created).toBe(11);
      expect(result.skipped).toBe(0);
      expect(mockPrismaService.holiday.create).toHaveBeenCalledTimes(11);
    });

    it('should skip holidays that already exist (P2002 unique constraint)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.0.0', meta: {} },
      );
      // First 5 succeed, rest throw P2002
      let callCount = 0;
      mockPrismaService.holiday.create.mockImplementation(() => {
        callCount++;
        if (callCount <= 5) {
          return Promise.resolve(mockHoliday);
        }
        return Promise.reject(prismaError);
      });

      const result = await service.importFrenchHolidays(2025, 'user-1');

      expect(result.created).toBe(5);
      expect(result.skipped).toBe(6);
    });

    it('should rethrow non-P2002 errors from holiday creation', async () => {
      const genericError = new Error('Database connection error');
      mockPrismaService.holiday.create.mockRejectedValue(genericError);

      await expect(
        service.importFrenchHolidays(2025, 'user-1'),
      ).rejects.toThrow('Database connection error');
    });

    it('should calculate correct Easter-based holidays for 2025', async () => {
      // Easter 2025 is April 20 — Lundi de Pâques should be April 21
      mockPrismaService.holiday.create.mockResolvedValue(mockHoliday);

      await service.importFrenchHolidays(2025, 'user-1');

      const calls = mockPrismaService.holiday.create.mock.calls;
      const names = calls.map((c) => c[0].data.name as string);

      // Check fixed dates
      expect(names).toContain("Jour de l'An");
      expect(names).toContain('Fête du Travail');
      expect(names).toContain('Noël');
      // Check Easter-based holidays
      expect(names).toContain('Lundi de Pâques');
      expect(names).toContain('Ascension');
      expect(names).toContain('Lundi de Pentecôte');
    });
  });

  describe('isNonWorkingHoliday', () => {
    it('should return false when date is not a holiday', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue(null);

      const result = await service.isNonWorkingHoliday(new Date('2025-06-16'));

      expect(result).toBe(false);
    });

    it('should return false when holiday is a work day', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue({
        ...mockHoliday,
        isWorkDay: true,
      });

      const result = await service.isNonWorkingHoliday(new Date('2025-01-01'));

      expect(result).toBe(false);
    });

    it('should return true when holiday is not a work day', async () => {
      mockPrismaService.holiday.findUnique.mockResolvedValue({
        ...mockHoliday,
        isWorkDay: false,
      });

      const result = await service.isNonWorkingHoliday(new Date('2025-01-01'));

      expect(result).toBe(true);
    });
  });

  describe('countWorkingDays', () => {
    it('should count working days excluding weekends and non-working holidays', async () => {
      // Week of 2025-01-06 (Mon) to 2025-01-10 (Fri): 5 working days, no holidays
      mockPrismaService.holiday.findMany.mockResolvedValue([]);

      const result = await service.countWorkingDays(
        new Date('2025-01-06'),
        new Date('2025-01-10'),
      );

      expect(result).toBe(5);
    });

    it('should exclude non-working holidays from count', async () => {
      // Week Mon 06 to Fri 10 with a non-working holiday on Wed 08
      mockPrismaService.holiday.findMany.mockResolvedValue([
        {
          ...mockHoliday,
          date: new Date('2025-01-08'),
          isWorkDay: false,
        },
      ]);

      const result = await service.countWorkingDays(
        new Date('2025-01-06'),
        new Date('2025-01-10'),
      );

      expect(result).toBe(4);
    });

    it('should NOT exclude holidays that are work days from count', async () => {
      // Week Mon 06 to Fri 10 with a work-day holiday on Wed 08 (still counts)
      mockPrismaService.holiday.findMany.mockResolvedValue([
        {
          ...mockHoliday,
          date: new Date('2025-01-08'),
          isWorkDay: true,
        },
      ]);

      const result = await service.countWorkingDays(
        new Date('2025-01-06'),
        new Date('2025-01-10'),
      );

      expect(result).toBe(5);
    });

    it('should exclude weekend days from count', async () => {
      // Full week including Sat and Sun: 2025-01-06 (Mon) to 2025-01-12 (Sun) = 5 working days
      mockPrismaService.holiday.findMany.mockResolvedValue([]);

      const result = await service.countWorkingDays(
        new Date('2025-01-06'),
        new Date('2025-01-12'),
      );

      expect(result).toBe(5);
    });

    it('should return 0 for a weekend range with no holidays', async () => {
      // Saturday to Sunday
      mockPrismaService.holiday.findMany.mockResolvedValue([]);

      const result = await service.countWorkingDays(
        new Date('2025-01-04'),
        new Date('2025-01-05'),
      );

      expect(result).toBe(0);
    });
  });
});
