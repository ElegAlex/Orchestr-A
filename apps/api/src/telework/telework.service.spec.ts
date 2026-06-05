import { Test, TestingModule } from '@nestjs/testing';
import { TeleworkService } from './telework.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
  vi,
  afterEach,
} from 'vitest';

describe('TeleworkService', () => {
  let service: TeleworkService;

  const mockPrismaService = {
    teleworkSchedule: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    teleworkRecurringRule: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  const mockPermissionsService = {
    getPermissionsForRole: vi.fn(),
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
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    }).compile();

    service = module.get<TeleworkService>(TeleworkService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a telework request for self (allowed for all)', async () => {
      const createDto = {
        date: '2025-11-20',
        isTelework: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);
      mockPrismaService.teleworkSchedule.create.mockResolvedValue(mockTelework);

      const result = await service.create('user-1', 'CONTRIBUTEUR', createDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(mockPrismaService.teleworkSchedule.create).toHaveBeenCalled();
      expect(
        mockPermissionsService.getPermissionsForRole,
      ).not.toHaveBeenCalled();
    });

    it('should create telework for different user when having telework:manage_any permission', async () => {
      const createDto = {
        date: '2025-11-20',
        isTelework: true,
        userId: 'user-2',
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:manage_any',
        'telework:create',
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);
      mockPrismaService.teleworkSchedule.create.mockResolvedValue({
        ...mockTelework,
        userId: 'user-2',
      });

      const result = await service.create('admin-1', 'ADMIN', createDto);

      expect(result.userId).toBe('user-2');
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        'ADMIN',
      );
    });

    it('should throw ForbiddenException when creating for others without telework:manage_any', async () => {
      const createDto = {
        date: '2025-11-20',
        isTelework: true,
        userId: 'user-2',
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:read',
      ]);

      await expect(
        service.create('user-1', 'CONTRIBUTEUR', createDto),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        'CONTRIBUTEUR',
      );
    });

    it('un CONTRIBUTEUR ne peut pas déclarer du télétravail pour un autre userId', async () => {
      // Un CONTRIBUTEUR n'a pas la permission telework:manage_any
      // → toute tentative de déclarer pour un autre userId doit lever ForbiddenException
      const createDto = {
        date: '2025-12-05',
        isTelework: true,
        userId: 'other-user-id',
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:read',
        'telework:update',
        'telework:delete',
      ]);

      await expect(
        service.create('contributeur-id', 'CONTRIBUTEUR', createDto),
      ).rejects.toThrow(ForbiddenException);

      // Le service doit interroger les permissions du rôle CONTRIBUTEUR
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        'CONTRIBUTEUR',
      );

      // Aucun accès BDD ne doit avoir été effectué après le contrôle de permission
      expect(mockPrismaService.teleworkSchedule.create).not.toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      const createDto = {
        date: '2025-11-20',
        isTelework: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create('nonexistent', 'CONTRIBUTEUR', createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when telework already exists for date', async () => {
      const createDto = {
        date: '2025-11-20',
        isTelework: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(
        mockTelework,
      );

      await expect(
        service.create('user-1', 'CONTRIBUTEUR', createDto),
      ).rejects.toThrow(ConflictException);
    });

    // COR-027: timezone-shifted input must be normalised to UTC-midnight of the
    // Paris calendar day — not to the raw UTC instant of the input string.
    // Input 2026-03-10T00:30:00+01:00 = Paris day March 10, but UTC = March 9.
    // Before fix: new Date(...) passes T23:30:00Z → stored as March 9 → wrong.
    // After fix: dayKeyToUTCDate(teleworkDayKey(...)) → T00:00:00.000Z (March 10).
    it('COR-027: normalises timezone-shifted DTO date to UTC-midnight of the Paris calendar day', async () => {
      // Paris: 2026-03-10T00:30:00+01:00 = calendar day March 10
      // Raw UTC: 2026-03-09T23:30:00Z  → wrong day if not normalised
      const createDto = {
        date: '2026-03-10T00:30:00+01:00',
        isTelework: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);
      mockPrismaService.teleworkSchedule.create.mockResolvedValue({
        ...mockTelework,
        date: new Date('2026-03-10T00:00:00.000Z'),
      });

      await service.create('user-1', 'CONTRIBUTEUR', createDto);

      // The date passed to Prisma create must be UTC midnight of March 10 (not March 9)
      expect(mockPrismaService.teleworkSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date: new Date('2026-03-10T00:00:00.000Z'),
          }) as object,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated telework requests', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:readAll',
      ]);
      const mockTeleworks = [mockTelework];
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue(
        mockTeleworks,
      );
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', 'ADMIN', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter telework by user', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:readAll',
      ]);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([
        mockTelework,
      ]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', 'ADMIN', 1, 10, 'user-1');

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }) as object,
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:readAll',
      ]);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(0);
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([]);

      await service.findAll(
        'user-1',
        'ADMIN',
        1,
        10,
        undefined,
        '2025-01-01',
        '2025-01-31',
      );

      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date) as Date,
              lte: expect.any(Date) as Date,
            }) as object,
          }) as object,
        }),
      );
    });

    it('COR-003 — a non-privileged caller without userId expands only its own recurring rules', async () => {
      // No telework:readAll → the read scope is narrowed to the caller.
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:read',
      ]);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(0);
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([]);

      // The caller omits userId from the query.
      await service.findAll(
        'user-1',
        'CONTRIBUTEUR',
        1,
        10,
        undefined,
        '2025-01-01',
        '2025-01-31',
      );

      // The recurring-rule expansion MUST be scoped to the enforced user, not
      // materialise schedules for every user (a write-side scope leak).
      expect(
        mockPrismaService.teleworkRecurringRule.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('should filter by startDate only', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:readAll',
      ]);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(0);

      await service.findAll('user-1', 'ADMIN', 1, 10, undefined, '2025-01-01');

      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date) as Date,
            }) as object,
          }) as object,
        }),
      );
    });

    it('should filter by endDate only', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:readAll',
      ]);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(0);

      await service.findAll(
        'user-1',
        'ADMIN',
        1,
        10,
        undefined,
        undefined,
        '2025-01-31',
      );

      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              lte: expect.any(Date) as Date,
            }) as object,
          }) as object,
        }),
      );
    });

    it('should still scope to current user when user can assign predefined tasks without telework:readAll', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:read',
        'predefined_tasks:assign',
      ]);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([
        mockTelework,
      ]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(1);

      await service.findAll('user-1', 'RESPONSABLE', 1, 10);

      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }) as object,
        }),
      );
    });
  });

  describe('findForPlanningOverview', () => {
    it('should fetch telework only for provided visible user ids', async () => {
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([
        mockTelework,
      ]);

      const result = await service.findForPlanningOverview(
        ['user-1', 'user-1', 'user-2'],
        '2025-01-01',
        '2025-01-31',
      );

      expect(result).toEqual([mockTelework]);
      expect(mockPrismaService.teleworkSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: { in: ['user-1', 'user-2'] },
          }) as object,
        }),
      );
    });

    it('should return empty array without querying schedules when no user ids are visible', async () => {
      const result = await service.findForPlanningOverview(
        [],
        '2025-01-01',
        '2025-01-31',
      );

      expect(result).toEqual([]);
      expect(
        mockPrismaService.teleworkSchedule.findMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a telework request by id', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(
        mockTelework,
      );

      const result = await service.findOne('telework-1', 'user-1', 'ADMIN');

      expect(result).toBeDefined();
      expect(result.id).toBe('telework-1');
    });

    it('should throw error when telework not found', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', 'user-1', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when CONTRIBUTEUR tries to read another user's telework", async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue({
        ...mockTelework,
        userId: 'other-user',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:read',
        'telework:update',
        'telework:delete',
      ]);

      await expect(
        service.findOne('telework-1', 'user-1', 'CONTRIBUTEUR'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        'CONTRIBUTEUR',
      );
    });

    it("should allow ADMIN to read another user's telework via telework:manage_any", async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue({
        ...mockTelework,
        userId: 'other-user',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:read',
        'telework:manage_any',
      ]);

      const result = await service.findOne('telework-1', 'admin-1', 'ADMIN');

      expect(result).toBeDefined();
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        'ADMIN',
      );
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

      await expect(service.getWeeklySchedule('invalid')).rejects.toThrow(
        NotFoundException,
      );
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
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue(
        mockTeleworks,
      );

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

      await expect(service.getUserStats('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update own telework request successfully', async () => {
      const updateDto = { isTelework: false };
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(
        mockTelework,
      );
      mockPrismaService.teleworkSchedule.update.mockResolvedValue({
        ...mockTelework,
        isTelework: false,
      });

      const result = await service.update(
        'telework-1',
        'user-1',
        'CONTRIBUTEUR',
        updateDto,
      );

      expect(result.isTelework).toBe(false);
      expect(
        mockPermissionsService.getPermissionsForRole,
      ).not.toHaveBeenCalled();
    });

    it('should throw error when telework not found', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);

      await expect(
        service.update('invalid', 'user-1', 'CONTRIBUTEUR', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when updating other's telework without permission", async () => {
      const updateDto = { isTelework: false };
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue({
        ...mockTelework,
        userId: 'other-user',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:read',
      ]);

      await expect(
        service.update('telework-1', 'user-1', 'CONTRIBUTEUR', updateDto),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        'CONTRIBUTEUR',
      );
    });

    it("should update other's telework when having telework:manage_any permission", async () => {
      const updateDto = { isTelework: false };
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue({
        ...mockTelework,
        userId: 'other-user',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:read',
        'telework:manage_any',
      ]);
      mockPrismaService.teleworkSchedule.update.mockResolvedValue({
        ...mockTelework,
        userId: 'other-user',
        isTelework: false,
      });

      const result = await service.update(
        'telework-1',
        'admin-1',
        'ADMIN',
        updateDto,
      );

      expect(result.isTelework).toBe(false);
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        'ADMIN',
      );
    });

    it('should update date when provided', async () => {
      const updateDto = { date: '2025-11-25' };
      mockPrismaService.teleworkSchedule.findUnique
        .mockResolvedValueOnce({
          ...mockTelework,
          date: new Date('2025-11-20'),
        })
        .mockResolvedValueOnce(null);
      mockPrismaService.teleworkSchedule.update.mockResolvedValue({
        ...mockTelework,
        date: new Date('2025-11-25'),
      });

      const result = await service.update(
        'telework-1',
        'user-1',
        'CONTRIBUTEUR',
        updateDto,
      );

      expect(result).toBeDefined();
    });

    it('should throw conflict when new date already has telework', async () => {
      const updateDto = { date: '2025-11-25' };
      mockPrismaService.teleworkSchedule.findUnique
        .mockResolvedValueOnce({
          ...mockTelework,
          date: new Date('2025-11-20'),
        })
        .mockResolvedValueOnce({ id: 'other-telework' });

      await expect(
        service.update('telework-1', 'user-1', 'CONTRIBUTEUR', updateDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should update isException', async () => {
      const updateDto = { isException: true };
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(
        mockTelework,
      );
      mockPrismaService.teleworkSchedule.update.mockResolvedValue({
        ...mockTelework,
        isException: true,
      });

      const result = await service.update(
        'telework-1',
        'user-1',
        'CONTRIBUTEUR',
        updateDto,
      );

      expect(result.isException).toBe(true);
    });
  });

  describe('remove', () => {
    it('should delete own telework request', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(
        mockTelework,
      );
      mockPrismaService.teleworkSchedule.delete.mockResolvedValue(mockTelework);

      const result = await service.remove(
        'telework-1',
        'user-1',
        'CONTRIBUTEUR',
      );

      expect(result.message).toBe('Télétravail supprimé avec succès');
      expect(mockPrismaService.teleworkSchedule.delete).toHaveBeenCalledWith({
        where: { id: 'telework-1' },
      });
      expect(
        mockPermissionsService.getPermissionsForRole,
      ).not.toHaveBeenCalled();
    });

    it('should throw error when telework not found', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('invalid', 'user-1', 'CONTRIBUTEUR'),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when deleting other's telework without permission", async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue({
        ...mockTelework,
        userId: 'other-user',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:read',
      ]);

      await expect(
        service.remove('telework-1', 'user-1', 'CONTRIBUTEUR'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        'CONTRIBUTEUR',
      );
    });

    it("should delete other's telework when having telework:manage_any permission", async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue({
        ...mockTelework,
        userId: 'other-user',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:read',
        'telework:manage_any',
      ]);
      mockPrismaService.teleworkSchedule.delete.mockResolvedValue(mockTelework);

      const result = await service.remove('telework-1', 'admin-1', 'ADMIN');

      expect(result.message).toBe('Télétravail supprimé avec succès');
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        'ADMIN',
      );
    });
  });

  describe('getTeamSchedule', () => {
    it('should return team schedule for today', async () => {
      const mockTeleworks = [mockTelework];
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue(
        mockTeleworks,
      );

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
          }) as object,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // RECURRING RULES
  // ─────────────────────────────────────────────

  const mockRule = {
    id: 'rule-1',
    userId: 'user-1',
    dayOfWeek: 1, // Mardi
    startDate: new Date('2026-04-01'),
    endDate: null,
    isActive: true,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: 'CONTRIBUTEUR',
    },
    createdBy: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
  };

  describe('createRecurringRule', () => {
    it('should create a recurring rule for self', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:read',
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkRecurringRule.findUnique.mockResolvedValue(
        null,
      );
      mockPrismaService.teleworkRecurringRule.create.mockResolvedValue(
        mockRule,
      );

      const result = await service.createRecurringRule(
        'user-1',
        'CONTRIBUTEUR',
        {
          dayOfWeek: 1,
          startDate: '2026-04-01',
        },
      );

      expect(result).toBeDefined();
      expect(result.dayOfWeek).toBe(1);
      expect(mockPrismaService.teleworkRecurringRule.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when creating for others without telework:manage_any', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:read',
      ]);

      await expect(
        service.createRecurringRule('user-1', 'CONTRIBUTEUR', {
          userId: 'user-2',
          dayOfWeek: 1,
          startDate: '2026-04-01',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow creating for others with telework:manage_any', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:manage_any',
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrismaService.teleworkRecurringRule.findUnique.mockResolvedValue(
        null,
      );
      mockPrismaService.teleworkRecurringRule.create.mockResolvedValue({
        ...mockRule,
        userId: 'user-2',
      });

      const result = await service.createRecurringRule('admin-1', 'ADMIN', {
        userId: 'user-2',
        dayOfWeek: 1,
        startDate: '2026-04-01',
      });

      expect(result.userId).toBe('user-2');
    });

    it('should throw ConflictException when rule already exists', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.teleworkRecurringRule.findUnique.mockResolvedValue(
        mockRule,
      );

      await expect(
        service.createRecurringRule('user-1', 'CONTRIBUTEUR', {
          dayOfWeek: 1,
          startDate: '2026-04-01',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createRecurringRule('user-1', 'CONTRIBUTEUR', {
          dayOfWeek: 1,
          startDate: '2026-04-01',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRecurringRule', () => {
    it('should update own recurring rule', async () => {
      mockPrismaService.teleworkRecurringRule.findUnique.mockResolvedValue(
        mockRule,
      );
      mockPrismaService.teleworkRecurringRule.update.mockResolvedValue({
        ...mockRule,
        endDate: new Date('2026-12-31'),
      });

      const result = await service.updateRecurringRule(
        'rule-1',
        'user-1',
        'CONTRIBUTEUR',
        { endDate: '2026-12-31' },
      );

      expect(result.endDate).toBeDefined();
      expect(
        mockPermissionsService.getPermissionsForRole,
      ).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when updating other's rule without permission", async () => {
      mockPrismaService.teleworkRecurringRule.findUnique.mockResolvedValue({
        ...mockRule,
        userId: 'other-user',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:update',
      ]);

      await expect(
        service.updateRecurringRule('rule-1', 'user-1', 'CONTRIBUTEUR', {
          endDate: '2026-12-31',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when rule not found', async () => {
      mockPrismaService.teleworkRecurringRule.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.updateRecurringRule('invalid', 'user-1', 'CONTRIBUTEUR', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeRecurringRule', () => {
    it('should delete own recurring rule', async () => {
      mockPrismaService.teleworkRecurringRule.findUnique.mockResolvedValue(
        mockRule,
      );
      mockPrismaService.teleworkRecurringRule.delete.mockResolvedValue(
        mockRule,
      );

      const result = await service.removeRecurringRule(
        'rule-1',
        'user-1',
        'CONTRIBUTEUR',
      );

      expect(result.message).toBe('Règle récurrente supprimée avec succès');
      expect(
        mockPermissionsService.getPermissionsForRole,
      ).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when rule not found', async () => {
      mockPrismaService.teleworkRecurringRule.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.removeRecurringRule('invalid', 'user-1', 'CONTRIBUTEUR'),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when deleting other's rule without permission", async () => {
      mockPrismaService.teleworkRecurringRule.findUnique.mockResolvedValue({
        ...mockRule,
        userId: 'other-user',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:delete',
      ]);

      await expect(
        service.removeRecurringRule('rule-1', 'user-1', 'CONTRIBUTEUR'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('generateSchedulesFromRules', () => {
    // COR-012 — DST-boundary test: under Europe/Paris, spring-forward 2025-03-30
    // (23-hour day). Unfixed code stores local-midnight which is 2025-03-29 in UTC
    // (off by one). Fixed code must store UTC-midnight 2025-03-30.
    describe('DST boundary — spring-forward 2025-03-30 (Europe/Paris)', () => {
      const origTZ = process.env.TZ;

      beforeAll(() => {
        process.env.TZ = 'Europe/Paris';
      });

      afterAll(() => {
        if (origTZ === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = origTZ;
        }
      });

      it('should store the correct UTC calendar day on the DST spring-forward boundary', async () => {
        // 2025-03-30 is the spring-forward day in Europe/Paris (clocks go 2h→3h).
        // Rule: dayOfWeek = 6 (Sunday in model: 0=Mon … 6=Sun), no end date.
        // Range: startDate = endDate = '2025-03-30' (the Sunday that is also DST+1).
        const sundayRule = {
          ...mockRule,
          dayOfWeek: 6, // Sunday in model
          startDate: new Date('2025-03-01'),
          endDate: null,
        };

        mockPermissionsService.getPermissionsForRole.mockResolvedValue([
          'telework:create',
          'telework:manage_any',
        ]);
        mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([
          sundayRule,
        ]);
        // Bulk findMany pre-load returns no existing rows
        mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
        mockPrismaService.teleworkSchedule.createMany.mockResolvedValue({
          count: 1,
        });

        const result = await service.generateSchedulesFromRules(
          'admin-1',
          'ADMIN',
          {
            startDate: '2025-03-30', // Sunday, DST spring-forward day
            endDate: '2025-03-30',
          },
        );

        // Must create exactly one schedule (the Sunday)
        expect(result.created).toBe(1);

        // The date in createMany data must have UTC parts 2025-03-30,
        // NOT 2025-03-29 (which is what local-midnight produces under Paris TZ).
        const createManyCall =
          mockPrismaService.teleworkSchedule.createMany.mock.calls[0][0];
        const storedDate: Date = createManyCall.data[0].date;
        expect(storedDate.getUTCFullYear()).toBe(2025);
        expect(storedDate.getUTCMonth()).toBe(2); // March = 2 (0-indexed)
        expect(storedDate.getUTCDate()).toBe(30); // Must be 30, not 29
      });
    });

    it('should generate telework schedules from active recurring rules', async () => {
      // Tuesday (dayOfWeek=1 in our model) rules for user-1
      // Week of 2026-04-06 (Mon) - 2026-04-07 is Tuesday
      const tuesdayRule = {
        ...mockRule,
        dayOfWeek: 1, // Tuesday in model (0=Mon)
        startDate: new Date('2026-04-01'),
        endDate: null,
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:manage_any',
      ]);
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([
        tuesdayRule,
      ]);
      // Bulk pre-load: no existing rows
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.createMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.generateSchedulesFromRules(
        'admin-1',
        'ADMIN',
        {
          startDate: '2026-04-06', // Monday
          endDate: '2026-04-12', // Sunday (1 Tuesday: 2026-04-07)
        },
      );

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.rulesProcessed).toBe(1);
      expect(
        mockPrismaService.teleworkSchedule.createMany,
      ).toHaveBeenCalledTimes(1);
      // Individual findUnique must NOT have been called (N+1 eliminated)
      expect(
        mockPrismaService.teleworkSchedule.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('should skip days that already have a telework schedule', async () => {
      const tuesdayRule = {
        ...mockRule,
        dayOfWeek: 1,
        startDate: new Date('2026-04-01'),
        endDate: null,
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:manage_any',
      ]);
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([
        tuesdayRule,
      ]);
      // Bulk pre-load returns the existing row for 2026-04-07 (Tuesday)
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          date: new Date('2026-04-07T00:00:00.000Z'),
        },
      ]);

      const result = await service.generateSchedulesFromRules(
        'admin-1',
        'ADMIN',
        {
          startDate: '2026-04-06',
          endDate: '2026-04-12',
        },
      );

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(
        mockPrismaService.teleworkSchedule.createMany,
      ).not.toHaveBeenCalled();
      // Individual findUnique must NOT have been called (N+1 eliminated)
      expect(
        mockPrismaService.teleworkSchedule.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('should not process rules that end before the start of the range', async () => {
      // expiredRule would have dayOfWeek: 1, endDate: 2026-03-31 (before our range)
      // The DB filter already excludes it, so we simulate empty result

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:manage_any',
      ]);
      // The DB filter should already exclude it, but simulate empty result
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([]);

      const result = await service.generateSchedulesFromRules(
        'admin-1',
        'ADMIN',
        {
          startDate: '2026-04-06',
          endDate: '2026-04-12',
        },
      );

      expect(result.created).toBe(0);
      expect(result.rulesProcessed).toBe(0);
    });

    it('should restrict non-managers to their own rules only', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:read',
      ]);
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([]);

      await service.generateSchedulesFromRules('user-1', 'CONTRIBUTEUR', {
        startDate: '2026-04-06',
        endDate: '2026-04-12',
      });

      expect(
        mockPrismaService.teleworkRecurringRule.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }) as object,
        }),
      );
    });

    // PER-029 — bulk approach: findUnique must not be called, createMany called once
    it('PER-029 — generateSchedulesFromRules uses bulk findMany+createMany, not N+1 findUnique+create', async () => {
      const rules = [
        {
          ...mockRule,
          dayOfWeek: 0,
          startDate: new Date('2026-04-01'),
          endDate: null,
        },
        {
          ...mockRule,
          id: 'rule-2',
          userId: 'user-2',
          dayOfWeek: 0,
          startDate: new Date('2026-04-01'),
          endDate: null,
        },
        {
          ...mockRule,
          id: 'rule-3',
          userId: 'user-3',
          dayOfWeek: 0,
          startDate: new Date('2026-04-01'),
          endDate: null,
        },
      ];

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:manage_any',
      ]);
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue(rules);
      // Bulk pre-load: no existing rows
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.createMany.mockResolvedValue({
        count: 3,
      });

      await service.generateSchedulesFromRules('admin-1', 'ADMIN', {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      });

      // No individual findUnique must have been called
      expect(
        mockPrismaService.teleworkSchedule.findUnique,
      ).not.toHaveBeenCalled();
      // createMany called exactly once (bulk insert)
      expect(
        mockPrismaService.teleworkSchedule.createMany,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockPrismaService.teleworkSchedule.createMany,
      ).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    });
  });

  // ─────────────────────────────────────────────
  // Finding witnesses
  // ─────────────────────────────────────────────

  describe('SEC-024 — unbounded date range guard', () => {
    it('SEC-024 — findAll throws BadRequestException when date range exceeds 366 days', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:readAll',
      ]);

      await expect(
        service.findAll(
          'user-1',
          'ADMIN',
          1,
          10,
          undefined,
          '1970-01-01',
          '2099-12-31',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('SEC-024 — findAll accepts a 366-day range without throwing', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:readAll',
      ]);
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.count.mockResolvedValue(0);

      await expect(
        service.findAll(
          'user-1',
          'ADMIN',
          1,
          10,
          undefined,
          '2026-01-01',
          '2026-12-31',
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('COR-032 — findForPlanningOverview scopes expansion to visible userIds', () => {
    it('COR-032 — expandRecurringRulesForRange is called with userId:in filter matching only visible users', async () => {
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);

      await service.findForPlanningOverview(
        ['user-A', 'user-B'],
        '2026-06-01',
        '2026-06-30',
      );

      // The recurring-rule query must restrict to the visible userIds
      expect(
        mockPrismaService.teleworkRecurringRule.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: {
              in: expect.arrayContaining(['user-A', 'user-B']) as unknown[],
            },
          }) as object,
        }),
      );
    });
  });

  describe('COR-033 — P2002 concurrency handled via skipDuplicates', () => {
    it('COR-033 — createMany is called with skipDuplicates:true (no TOCTOU P2002 risk)', async () => {
      const rule = {
        ...mockRule,
        dayOfWeek: 1,
        startDate: new Date('2026-04-01'),
        endDate: null,
      };
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'telework:create',
        'telework:manage_any',
      ]);
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([
        rule,
      ]);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.teleworkSchedule.createMany.mockResolvedValue({
        count: 1,
      });

      await service.generateSchedulesFromRules('admin-1', 'ADMIN', {
        startDate: '2026-04-06',
        endDate: '2026-04-12',
      });

      expect(
        mockPrismaService.teleworkSchedule.createMany,
      ).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    });
  });

  describe('COR-034 — getWeeklySchedule uses UTC week boundaries', () => {
    describe('TZ=Europe/Paris DST spring-forward 2026-03-29', () => {
      const origTZ = process.env.TZ;

      beforeAll(() => {
        process.env.TZ = 'Europe/Paris';
      });

      afterAll(() => {
        if (origTZ === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = origTZ;
        }
      });

      it('COR-034 — weekStart is 2026-03-23T00:00:00Z and weekEnd ends at 23:59:59 UTC on 2026-03-29', async () => {
        mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
        mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);

        const result = await service.getWeeklySchedule('user-1', '2026-03-29');

        // 2026-03-29 is a Sunday (DST spring-forward day in Europe/Paris).
        // The week containing it runs Mon 2026-03-23 → Sun 2026-03-29.
        expect(result.weekStart).toEqual(new Date('2026-03-23T00:00:00.000Z'));
        expect(result.weekEnd.getUTCFullYear()).toBe(2026);
        expect(result.weekEnd.getUTCMonth()).toBe(2); // March
        expect(result.weekEnd.getUTCDate()).toBe(29);
        expect(result.weekEnd.getUTCHours()).toBe(23);
      });
    });
  });

  describe('COR-035 — UTC year/day boundaries', () => {
    describe('TZ=Europe/Paris', () => {
      const origTZ = process.env.TZ;

      beforeAll(() => {
        process.env.TZ = 'Europe/Paris';
      });

      afterAll(() => {
        if (origTZ === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = origTZ;
        }
      });

      it('COR-035 — getUserStats year filter gte is 2026-01-01T00:00:00.000Z (not 2025-12-31T23:00:00Z)', async () => {
        mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
        mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);

        await service.getUserStats('user-1', 2026);

        const findManyCall =
          mockPrismaService.teleworkSchedule.findMany.mock.calls[0][0];
        const gteDate: Date = findManyCall.where.date.gte;
        expect(gteDate).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      });

      it('COR-035 — getTeamSchedule passes UTC-midnight date to Prisma (not local-midnight)', async () => {
        mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([]);

        await service.getTeamSchedule('2026-01-15');

        const findManyCall =
          mockPrismaService.teleworkSchedule.findMany.mock.calls[0][0];
        const whereDate: Date = findManyCall.where.date;
        expect(whereDate).toEqual(new Date('2026-01-15T00:00:00.000Z'));
      });
    });
  });

  describe('PER-028 — expandRecurringRulesForRange uses bulk findMany+createMany', () => {
    it('PER-028 — findUnique not called; createMany called once with skipDuplicates after findForPlanningOverview', async () => {
      const rule = {
        ...mockRule,
        userId: 'user-A',
        dayOfWeek: 0, // Monday
        startDate: new Date('2026-04-01'),
        endDate: null,
      };

      // findForPlanningOverview with 3 rules over a 30-day range
      mockPrismaService.teleworkRecurringRule.findMany.mockResolvedValue([
        rule,
        { ...rule, id: 'rule-2', userId: 'user-B' },
        { ...rule, id: 'rule-3', userId: 'user-C' },
      ]);
      // Bulk pre-load: no existing rows
      // First findMany is the bulk existence check; second is the schedule list
      mockPrismaService.teleworkSchedule.findMany
        .mockResolvedValueOnce([]) // bulk existence check
        .mockResolvedValueOnce([]); // listing call in findForPlanningOverview
      mockPrismaService.teleworkSchedule.createMany.mockResolvedValue({
        count: 4,
      });

      await service.findForPlanningOverview(
        ['user-A', 'user-B', 'user-C'],
        '2026-04-01',
        '2026-04-30',
      );

      // N+1 individual findUnique must NOT have been called
      expect(
        mockPrismaService.teleworkSchedule.findUnique,
      ).not.toHaveBeenCalled();
      // Bulk createMany must have been called once
      expect(
        mockPrismaService.teleworkSchedule.createMany,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
