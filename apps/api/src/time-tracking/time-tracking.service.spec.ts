import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { ThirdPartiesService } from '../third-parties/third-parties.service';
import { OwnershipService } from '../common/services/ownership.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { TimeTrackingService } from './time-tracking.service';

describe('TimeTrackingService', () => {
  let service: TimeTrackingService;

  const mockPrismaService = {
    timeEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };

  const mockThirdPartiesService = {
    assertExistsAndActive: vi.fn(),
    assertAssignedToTaskOrProject: vi.fn(),
  };

  const mockPermissionsService = {
    getPermissionsForRole: vi.fn(),
  };

  const mockOwnershipService = {
    isOwner: vi.fn(),
  };

  const currentUser: { id: string; role: string | null } = {
    id: 'user-1',
    role: 'MANAGER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeTrackingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ThirdPartiesService, useValue: mockThirdPartiesService },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        { provide: OwnershipService, useValue: mockOwnershipService },
      ],
    }).compile();
    service = module.get<TimeTrackingService>(TimeTrackingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create (user mode)', () => {
    const dto = {
      date: '2025-01-01',
      hours: 8,
      activityType: 'DEVELOPMENT' as const,
      taskId: 'task-1',
      projectId: 'project-1',
      description: 'Working on feature',
    };

    it('creates a user time entry with declaredById = currentUser.id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: 'project-1',
      });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.timeEntry.create.mockResolvedValue({
        id: '1',
        userId: 'user-1',
        declaredById: 'user-1',
      });

      await service.create(currentUser, dto);

      expect(mockPrismaService.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            declaredById: 'user-1',
            thirdPartyId: null,
          }),
        }),
      );
    });

    it('throws NotFoundException when current user is missing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.create(currentUser, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when task is missing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.task.findUnique.mockResolvedValue(null);
      await expect(service.create(currentUser, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when project is missing', async () => {
      const projectOnly = { ...dto, taskId: undefined };
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.project.findUnique.mockResolvedValue(null);
      await expect(service.create(currentUser, projectOnly)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when neither task nor project provided', async () => {
      const bad = {
        date: '2025-01-01',
        hours: 8,
        activityType: 'DEVELOPMENT' as const,
      };
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      await expect(service.create(currentUser, bad)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("falls back to task.projectId when dto.projectId is missing", async () => {
      const taskOnly = {
        date: '2025-01-01',
        hours: 8,
        activityType: 'DEVELOPMENT' as const,
        taskId: 'task-1',
      };
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: 'project-from-task',
      });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-from-task',
      });
      mockPrismaService.timeEntry.create.mockResolvedValue({ id: '1' });

      await service.create(currentUser, taskOnly);

      expect(mockPrismaService.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'project-from-task',
          }),
        }),
      );
    });
  });

  describe('create (third party mode)', () => {
    const baseDto = {
      date: '2025-01-01',
      hours: 4,
      activityType: 'DEVELOPMENT' as const,
      taskId: 'task-1',
      projectId: 'project-1',
      thirdPartyId: 'tp-1',
    };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: 'project-1',
      });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
    });

    it('throws ForbiddenException when declarer lacks permission', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:create',
      ]);
      await expect(service.create(currentUser, baseDto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.timeEntry.create).not.toHaveBeenCalled();
    });

    it('throws when third party does not exist or is archived', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:declare_for_third_party',
      ]);
      mockThirdPartiesService.assertExistsAndActive.mockRejectedValue(
        new BadRequestException('archived'),
      );
      await expect(service.create(currentUser, baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when third party is not assigned to task/project', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:declare_for_third_party',
      ]);
      mockThirdPartiesService.assertExistsAndActive.mockResolvedValue(
        undefined,
      );
      mockThirdPartiesService.assertAssignedToTaskOrProject.mockRejectedValue(
        new ForbiddenException('not assigned'),
      );
      await expect(service.create(currentUser, baseDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('creates a third party entry with userId null and declaredById = currentUser.id', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:declare_for_third_party',
      ]);
      mockThirdPartiesService.assertExistsAndActive.mockResolvedValue(
        undefined,
      );
      mockThirdPartiesService.assertAssignedToTaskOrProject.mockResolvedValue(
        undefined,
      );
      mockPrismaService.timeEntry.create.mockResolvedValue({
        id: '1',
        userId: null,
        thirdPartyId: 'tp-1',
        declaredById: 'user-1',
      });

      await service.create(currentUser, baseDto);

      expect(mockPrismaService.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: null,
            thirdPartyId: 'tp-1',
            declaredById: 'user-1',
          }),
        }),
      );
    });

    it('creates a third party entry on an orphan task (no projectId)', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: null,
      });
      const orphanDto = {
        ...baseDto,
        projectId: undefined,
      };
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:declare_for_third_party',
      ]);
      mockThirdPartiesService.assertExistsAndActive.mockResolvedValue(
        undefined,
      );
      mockThirdPartiesService.assertAssignedToTaskOrProject.mockResolvedValue(
        undefined,
      );
      mockPrismaService.timeEntry.create.mockResolvedValue({ id: '1' });

      await service.create(currentUser, orphanDto);

      expect(
        mockThirdPartiesService.assertAssignedToTaskOrProject,
      ).toHaveBeenCalledWith('tp-1', {
        taskId: 'task-1',
        projectId: undefined,
      });
    });
  });

  describe('findAll', () => {
    it('filters by thirdPartyId when provided', async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);
      await service.findAll(
        currentUser,
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'tp-1',
      );
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ thirdPartyId: 'tp-1' }),
        }),
      );
    });

    it('filters by userId === self without needing view_any', async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);
      await service.findAll(currentUser, 1, 10, 'user-1');
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('coerces userId to currentUser.id when filtering by another user without time_tracking:view_any (D8 PO 2026-04-19)', async () => {
      // D8 PO : remplacement du 403 historique par coercion silencieuse —
      // alignement avec tasks/leaves/telework/events qui coercent eux aussi.
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:read',
      ]);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);
      await service.findAll(currentUser, 1, 10, 'user-2');
      // Le filtre cross-user a été coercé : where.userId === currentUser.id.
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: currentUser.id }),
        }),
      );
    });

    it('allows filtering by another user when time_tracking:view_any is granted', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:view_any',
      ]);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);
      await service.findAll(currentUser, 1, 10, 'user-2');
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-2' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns entry when found', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({ id: '1' });
      const result = await service.findOne('1');
      expect(result.id).toBe('1');
    });

    it('throws NotFoundException when missing', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates hours on a user entry (owner)', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user-1',
        thirdPartyId: null,
      });
      mockOwnershipService.isOwner.mockResolvedValue(true);
      mockPrismaService.timeEntry.update.mockResolvedValue({
        id: '1',
        hours: 6,
      });
      const result = await service.update('1', { hours: 6 }, currentUser);
      expect(result.hours).toBe(6);
    });

    it('allows update when caller is the declaredBy (on-behalf actor)', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        userId: null,
        thirdPartyId: 'tp-1',
        declaredById: 'user-1',
      });
      // OwnershipService.isOwner accepts declaredById === userId
      mockOwnershipService.isOwner.mockResolvedValue(true);
      mockPrismaService.timeEntry.update.mockResolvedValue({
        id: '1',
        hours: 3,
      });
      const result = await service.update('1', { hours: 3 }, currentUser);
      expect(result.hours).toBe(3);
    });

    it('throws ForbiddenException when caller is neither owner nor has manage_any', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user-other',
        thirdPartyId: null,
        declaredById: 'user-other',
      });
      mockOwnershipService.isOwner.mockResolvedValue(false);
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:update',
      ]);
      await expect(
        service.update('1', { hours: 6 }, currentUser),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.timeEntry.update).not.toHaveBeenCalled();
    });

    it('allows update when caller has time_tracking:manage_any', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user-other',
        thirdPartyId: null,
        declaredById: 'user-other',
      });
      mockOwnershipService.isOwner.mockResolvedValue(false);
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:manage_any',
      ]);
      mockPrismaService.timeEntry.update.mockResolvedValue({
        id: '1',
        hours: 6,
      });
      const result = await service.update('1', { hours: 6 }, currentUser);
      expect(result.hours).toBe(6);
    });

    it('throws NotFoundException when entry missing', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(null);
      await expect(
        service.update('1', { hours: 6 }, currentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects attempts to mutate thirdPartyId on a user entry', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user-1',
        thirdPartyId: null,
      });
      mockOwnershipService.isOwner.mockResolvedValue(true);
      await expect(
        service.update(
          '1',
          {
            thirdPartyId: 'tp-1',
          } as unknown as Parameters<typeof service.update>[1],
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects attempts to clear thirdPartyId on a tiers entry', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        userId: null,
        thirdPartyId: 'tp-1',
        declaredById: 'user-1',
      });
      mockOwnershipService.isOwner.mockResolvedValue(true);
      await expect(
        service.update(
          '1',
          {
            thirdPartyId: null,
          } as unknown as Parameters<typeof service.update>[1],
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when new task missing', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        taskId: 'task-1',
        userId: 'user-1',
      });
      mockOwnershipService.isOwner.mockResolvedValue(true);
      mockPrismaService.task.findUnique.mockResolvedValue(null);
      await expect(
        service.update('1', { taskId: 'invalid' }, currentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when new project missing', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        projectId: 'project-1',
        userId: 'user-1',
      });
      mockOwnershipService.isOwner.mockResolvedValue(true);
      mockPrismaService.project.findUnique.mockResolvedValue(null);
      await expect(
        service.update('1', { projectId: 'invalid' }, currentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes entry when caller is owner', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user-1',
        declaredById: 'user-1',
      });
      mockOwnershipService.isOwner.mockResolvedValue(true);
      mockPrismaService.timeEntry.delete.mockResolvedValue({ id: '1' });
      const result = await service.remove('1', currentUser);
      expect(result.message).toContain('supprimée');
    });

    it('deletes when caller is declaredBy (on-behalf actor)', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        userId: null,
        thirdPartyId: 'tp-1',
        declaredById: 'user-1',
      });
      mockOwnershipService.isOwner.mockResolvedValue(true);
      mockPrismaService.timeEntry.delete.mockResolvedValue({ id: '1' });
      const result = await service.remove('1', currentUser);
      expect(result.message).toContain('supprimée');
    });

    it('throws ForbiddenException when caller is neither owner nor has manage_any', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user-other',
        declaredById: 'user-other',
      });
      mockOwnershipService.isOwner.mockResolvedValue(false);
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:delete',
      ]);
      await expect(service.remove('1', currentUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.timeEntry.delete).not.toHaveBeenCalled();
    });

    it('allows delete when caller has time_tracking:manage_any', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user-other',
        declaredById: 'user-other',
      });
      mockOwnershipService.isOwner.mockResolvedValue(false);
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'time_tracking:manage_any',
      ]);
      mockPrismaService.timeEntry.delete.mockResolvedValue({ id: '1' });
      const result = await service.remove('1', currentUser);
      expect(result.message).toContain('supprimée');
    });

    it('throws NotFoundException when missing', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing', currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserReport', () => {
    it('returns report with user-only entries', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([
        {
          id: '1',
          hours: 4,
          activityType: 'DEVELOPMENT',
          date: new Date('2025-01-01'),
          project: { id: 'p1', name: 'Project 1' },
        },
      ]);
      const result = await service.getUserReport(
        'user-1',
        '2025-01-01',
        '2025-01-31',
      );
      expect(result.totalHours).toBe(4);
      expect(result.byType).toHaveProperty('DEVELOPMENT', 4);
    });

    it('throws NotFoundException when user missing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(
        service.getUserReport('missing', '2025-01-01', '2025-01-31'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProjectReport (segregated)', () => {
    it('returns segregated user and third party entries with separate totals', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });
      const userEntries = [
        {
          id: 'u1',
          hours: 5,
          activityType: 'DEVELOPMENT',
          user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
        },
      ];
      const thirdPartyEntries = [
        {
          id: 'tp1',
          hours: 3,
          activityType: 'MEETING',
          thirdParty: {
            id: 'tp-1',
            organizationName: 'Acme',
            type: 'EXTERNAL_PROVIDER',
          },
        },
      ];
      mockPrismaService.timeEntry.findMany
        .mockResolvedValueOnce(userEntries)
        .mockResolvedValueOnce(thirdPartyEntries);

      const result = await service.getProjectReport('project-1');

      expect(result.totals.userHours).toBe(5);
      expect(result.totals.thirdPartyHours).toBe(3);
      expect(result.userEntries).toHaveLength(1);
      expect(result.thirdPartyEntries).toHaveLength(1);
      expect(result.byUser).toHaveLength(1);
      expect(result.byThirdParty).toHaveLength(1);
      expect(result.byType).toEqual({ DEVELOPMENT: 5, MEETING: 3 });
    });

    it('throws NotFoundException when project missing', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);
      await expect(service.getProjectReport('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('applies date range filter on both queries', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
      });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      await service.getProjectReport(
        'project-1',
        '2025-01-01',
        '2025-01-31',
      );

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-1',
            userId: { not: null },
          }),
        }),
      );
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-1',
            thirdPartyId: { not: null },
          }),
        }),
      );
    });
  });

  // =====================================================================
  // V1-A : dismissal marker
  // =====================================================================

  describe('CreateTimeEntryDto — @ValidateIf hours vs isDismissal (D1)', () => {
    const baseDto = {
      date: '2025-01-01T00:00:00Z',
      activityType: 'DEVELOPMENT',
      taskId: '11111111-1111-1111-1111-111111111111',
    };

    it('rejects hours=0 when isDismissal absent', async () => {
      const dto = plainToInstance(CreateTimeEntryDto, {
        ...baseDto,
        hours: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'hours')).toBe(true);
    });

    it('rejects hours=0 when isDismissal=false', async () => {
      const dto = plainToInstance(CreateTimeEntryDto, {
        ...baseDto,
        hours: 0,
        isDismissal: false,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'hours')).toBe(true);
    });

    it('accepts hours=0 when isDismissal=true', async () => {
      const dto = plainToInstance(CreateTimeEntryDto, {
        ...baseDto,
        hours: 0,
        isDismissal: true,
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'hours')).toHaveLength(0);
    });

    it('still accepts hours=4 when isDismissal=false (regular entry)', async () => {
      const dto = plainToInstance(CreateTimeEntryDto, {
        ...baseDto,
        hours: 4,
        isDismissal: false,
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'hours')).toHaveLength(0);
    });
  });

  describe('create (dismissal mode)', () => {
    const dismissalDto = {
      date: '2025-01-01',
      hours: 0,
      activityType: 'OTHER' as const,
      taskId: 'task-1',
      isDismissal: true,
    };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          cb(mockPrismaService),
      );
    });

    it('throws BadRequestException when dismissal has no taskId', async () => {
      const bad = { ...dismissalDto, taskId: undefined };
      await expect(service.create(currentUser, bad)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('creates a new dismissal when none exists, forcing hours=0/OTHER/description=null', async () => {
      mockPrismaService.timeEntry.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: 'project-1',
      });
      mockPrismaService.timeEntry.create.mockResolvedValue({
        id: 'new-dismissal',
        isDismissal: true,
      });

      await service.create(currentUser, dismissalDto);

      expect(mockPrismaService.timeEntry.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', taskId: 'task-1', isDismissal: true },
        select: { id: true },
      });
      expect(mockPrismaService.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            declaredById: 'user-1',
            taskId: 'task-1',
            projectId: 'project-1',
            hours: 0,
            activityType: 'OTHER',
            description: null,
            isDismissal: true,
          }),
        }),
      );
    });

    it('updates the existing dismissal (idempotent) instead of creating a new one', async () => {
      mockPrismaService.timeEntry.findFirst.mockResolvedValue({
        id: 'existing-dismissal',
      });
      mockPrismaService.timeEntry.update.mockResolvedValue({
        id: 'existing-dismissal',
        isDismissal: true,
      });

      await service.create(currentUser, dismissalDto);

      expect(mockPrismaService.timeEntry.create).not.toHaveBeenCalled();
      expect(mockPrismaService.timeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-dismissal' },
          data: expect.objectContaining({ updatedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws NotFoundException when task missing during dismissal creation', async () => {
      mockPrismaService.timeEntry.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.create(currentUser, dismissalDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.timeEntry.create).not.toHaveBeenCalled();
    });

    it('bypasses resolveActor (no thirdParties call even if thirdPartyId in DTO)', async () => {
      mockPrismaService.timeEntry.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: 'project-1',
      });
      mockPrismaService.timeEntry.create.mockResolvedValue({ id: 'd1' });

      const withTp = { ...dismissalDto, thirdPartyId: 'tp-1' };
      await service.create(currentUser, withTp);

      expect(
        mockThirdPartiesService.assertExistsAndActive,
      ).not.toHaveBeenCalled();
      // Ensure the row is still user-anchored and the tp is ignored.
      expect(mockPrismaService.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            declaredById: 'user-1',
          }),
        }),
      );
    });
  });

  describe('findAll — includeDismissals filter (D3)', () => {
    beforeEach(() => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);
    });

    it('injects isDismissal=false in where by default', async () => {
      await service.findAll(currentUser, 1, 10, 'user-1');
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isDismissal: false }),
        }),
      );
    });

    it('omits the isDismissal filter when includeDismissals=true', async () => {
      await service.findAll(
        currentUser,
        1,
        10,
        'user-1',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      );
      const callArg = mockPrismaService.timeEntry.findMany.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('isDismissal');
    });
  });

  describe('report dismissal filter (D3)', () => {
    it('getUserReport filters out dismissals', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      await service.getUserReport('user-1', '2025-01-01', '2025-01-31');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            isDismissal: false,
          }),
        }),
      );
    });

    it('getProjectReport filters out dismissals on both queries', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
      });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      await service.getProjectReport('project-1');

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-1',
            userId: { not: null },
            isDismissal: false,
          }),
        }),
      );
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-1',
            thirdPartyId: { not: null },
            isDismissal: false,
          }),
        }),
      );
    });
  });
});
