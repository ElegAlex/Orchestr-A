import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { LeavesService } from './leaves.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { LeaveStatus, LeaveType, Role } from '../__mocks__/database';
import { Prisma } from 'database';
import { AuditService } from '../audit/audit.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { PermissionsService } from '../rbac/permissions.service';
import { HolidaysService } from '../holidays/holidays.service';

const mockGetPermissionsForRole = vi.fn().mockImplementation((role: string) => {
  const base = [
    'leaves:read',
    'leaves:readAll',
    'tasks:readAll',
    'telework:readAll',
    'events:readAll',
  ];
  if (role === 'ADMIN' || role === 'RESPONSABLE' || role === 'MANAGER') {
    return Promise.resolve([...base, 'leaves:delete', 'leaves:approve']);
  }
  return Promise.resolve(base);
});

describe('LeavesService', () => {
  let service: LeavesService;

  // DAT-001 — partagé entre la fixture beforeEach et les tests de régression
  // pour pouvoir asserter les appels durables au-delà du describe parent.
  const mockAuditPersistence = { log: vi.fn().mockResolvedValue(undefined) };

  // COR-003 — la table des jours fériés est un référentiel ; par défaut vide
  // (aucun férié connu = comportement legacy "que les week-ends"). Les tests
  // de câblage surchargent findByRange pour injecter un férié dans la fenêtre.
  const mockHolidaysService = {
    findByRange: vi.fn().mockResolvedValue([]),
  };

  const mockPrismaService = {
    leave: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    leaveTypeConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    leaveBalance: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    roleConfig: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    leaveValidationDelegate: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    userService: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    service: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    role: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    // Wave 3 / finding #4: create() and update() wrap the gate + write in
    // $transaction. The mock forwards the same client to the callback so
    // every queued mock (leaveBalance.findUnique etc.) continues to be
    // consumed transparently — no test rewrite needed.
    $transaction: vi.fn(
      <T>(cb: (tx: typeof mockPrismaService) => T): T => cb(mockPrismaService),
    ),
  };

  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
    role: Role.CONTRIBUTEUR,
    isActive: true,
    departmentId: 'dept-1',
    department: {
      id: 'dept-1',
      name: 'IT',
      managerId: 'manager-1',
      manager: { id: 'manager-1', firstName: 'Manager', lastName: 'One' },
    },
  };

  const mockLeaveTypeConfig = {
    id: 'leave-type-1',
    name: 'Congés payés',
    code: 'CP',
    color: '#10B981',
    icon: '🌴',
    isPaid: true,
    isActive: true,
    requiresApproval: true,
  };

  const mockLeave = {
    id: 'leave-1',
    userId: 'user-1',
    leaveTypeId: 'leave-type-1',
    type: LeaveType.CP,
    startDate: new Date('2025-06-02'), // Monday
    endDate: new Date('2025-06-06'), // Friday
    status: LeaveStatus.PENDING,
    days: 5,
    halfDay: null,
    comment: 'Summer vacation',
    validatorId: 'manager-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser,
    leaveType: mockLeaveTypeConfig,
    validator: { id: 'manager-1', firstName: 'Manager', lastName: 'One' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeavesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditService,
          useValue: { log: vi.fn() },
        },
        {
          provide: AuditPersistenceService,
          useValue: mockAuditPersistence,
        },
        {
          provide: PermissionsService,
          useValue: {
            getPermissionsForRole: mockGetPermissionsForRole,
          },
        },
        {
          provide: HolidaysService,
          useValue: mockHolidaysService,
        },
      ],
    }).compile();

    service = module.get<LeavesService>(LeavesService);
  });

  afterEach(() => {
    // resetAllMocks vs clearAllMocks: reset supprime aussi les queues
    // mockResolvedValueOnce résiduelles, évitant la pollution inter-tests.
    vi.resetAllMocks();
    // DAT-001 — restaurer l'implémentation default (resolved void) sinon les
    // tests d'autres flows qui n'attendent rien d'auditPersistence cassent.
    mockAuditPersistence.log.mockResolvedValue(undefined);
    // Restore default mock implementations
    mockPrismaService.userService.findMany.mockResolvedValue([]);
    mockPrismaService.userService.findFirst.mockResolvedValue(null);
    mockPrismaService.service.findMany.mockResolvedValue([]);
    mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([]);
    mockPrismaService.leaveBalance.findFirst.mockResolvedValue(null);
    mockPrismaService.leaveBalance.findMany.mockResolvedValue([]);
    mockPrismaService.leaveBalance.findUnique.mockResolvedValue(null);
    mockPrismaService.roleConfig.findMany.mockResolvedValue([]);
    mockPrismaService.roleConfig.findFirst.mockResolvedValue(null);
    mockPrismaService.role.findMany.mockResolvedValue([]);
    // COR-003 — référentiel jours fériés vide par défaut après chaque reset.
    mockHolidaysService.findByRange.mockResolvedValue([]);
    // Default user.findUnique to mockUser : évite les NotFoundException
    // quand update()/remove()/cancel() déclenchent getLeaveBalance pour un
    // congé CP mais que le test ne mocke pas explicitement user.findUnique.
    mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaService.user.findMany.mockResolvedValue([]);
    // Restore dynamic permissions mock — ADMIN/RESPONSABLE détiennent
    // `leaves:manage_any` (bypass périmètre), MANAGER conserve uniquement
    // `leaves:approve` (périmètre services).
    mockGetPermissionsForRole.mockImplementation((role: string) => {
      const base = [
        'leaves:read',
        'leaves:readAll',
        'tasks:readAll',
        'telework:readAll',
        'events:readAll',
      ];
      if (role === 'ADMIN') {
        return Promise.resolve([
          ...base,
          'leaves:delete',
          'leaves:approve',
          'leaves:manage_any',
          'leaves:manage_delegations',
          'leaves:declare_for_others',
        ]);
      }
      if (role === 'RESPONSABLE' || role === 'MANAGER') {
        return Promise.resolve([
          ...base,
          'leaves:delete',
          'leaves:approve',
          'leaves:manage_delegations',
          'leaves:declare_for_others',
        ]);
      }
      return Promise.resolve(base);
    });
  });

  // ============================================
  // CREATE
  // ============================================
  describe('create', () => {
    const createLeaveDto = {
      leaveTypeId: 'leave-type-1',
      startDate: '2025-06-02',
      endDate: '2025-06-06',
      reason: 'Summer vacation',
    };

    it('should create a leave request successfully', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // First call for user check
        .mockResolvedValueOnce({
          ...mockUser,
          department: { ...mockUser.department, manager: { id: 'manager-1' } },
        }); // For findValidatorForUser
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      // getLeaveBalance: leaveTypeConfig.findMany returns CP type
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        mockLeaveTypeConfig,
      ]);
      // resolveAllocatedDays: individual balance = 25 days
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany.mockResolvedValue([]); // No overlap + no approved/pending leaves
      mockPrismaService.leave.create.mockResolvedValue(mockLeave);
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );

      const result = await service.create('user-1', createLeaveDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(mockPrismaService.leave.create).toHaveBeenCalled();
    });

    it('COR-003 — fetches holidays and subtracts a non-working holiday from charged days', async () => {
      // Wiring witness: Mon 2025-06-02 → Fri 2025-06-06 = 5 weekdays. The
      // service must fetch the holiday calendar and exclude Wed 2025-06-04,
      // charging 4 days instead of 5. Proves the HolidaysService → helper
      // path end-to-end without depending on the seeded DB.
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({
          ...mockUser,
          department: { ...mockUser.department, manager: { id: 'manager-1' } },
        });
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        mockLeaveTypeConfig,
      ]);
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.create.mockResolvedValue(mockLeave);
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockHolidaysService.findByRange.mockResolvedValue([
        { date: new Date('2025-06-04T00:00:00Z'), isWorkDay: false },
      ]);

      await service.create('user-1', createLeaveDto);

      expect(mockHolidaysService.findByRange).toHaveBeenCalled();
      expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ days: 4 }),
        }),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create('nonexistent', createLeaveDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when leave type not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', createLeaveDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when leave type is inactive', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue({
        ...mockLeaveTypeConfig,
        isActive: false,
      });

      await expect(service.create('user-1', createLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when end date is before start date', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );

      const invalidDto = {
        ...createLeaveDto,
        startDate: '2025-06-10',
        endDate: '2025-06-05',
      };

      await expect(service.create('user-1', invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when there is overlap with existing leave', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]); // Overlap exists

      await expect(service.create('user-1', createLeaveDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('COR-010 — checkOverlap queries include CANCELLATION_REQUESTED in status filter', async () => {
      // A leave in CANCELLATION_REQUESTED is NOT free space: rejectCancellation
      // can restore it to APPROVED, which would create two overlapping approved leaves.
      // This test verifies the status.in list includes CANCELLATION_REQUESTED.
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leave.findMany.mockResolvedValue([]);

      // We don't care about the final result; we care that checkOverlap issued
      // a findMany with CANCELLATION_REQUESTED in its status filter.
      try {
        await service.create('user-1', createLeaveDto);
      } catch {
        // ignore — balance / validator resolution may fail in a trimmed mock
      }

      // The FIRST findMany call is the checkOverlap query.
      const overlapCall = mockPrismaService.leave.findMany.mock
        .calls[0]?.[0] as {
        where?: { status?: { in?: string[] } };
      };
      expect(overlapCall?.where?.status?.in).toContain(
        LeaveStatus.CANCELLATION_REQUESTED,
      );
    });

    it('should throw BadRequestException when configured balance is exceeded', async () => {
      const typeWithBalance = { ...mockLeaveTypeConfig, code: 'RTT' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        typeWithBalance,
      );
      // hasConfiguredBalance: no individual balance, global exists
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null); // individual (hasConfiguredBalance)
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        id: 'g1',
      }); // global (hasConfiguredBalance) → true

      // getAvailableDays → resolveAllocatedDays: no individual, global = 1 day
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null); // individual (resolveAllocatedDays)
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 1,
      }); // global (resolveAllocatedDays)

      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([]) // No overlap
        .mockResolvedValueOnce([]) // Approved leaves (0 used)
        .mockResolvedValueOnce([]); // Pending leaves

      // 1 day available, 5 days requested → rejet
      await expect(service.create('user-1', createLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow leave when type has no configured balance (unlimited)', async () => {
      const typeWithoutBalance = { ...mockLeaveTypeConfig, code: 'OTHER' };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // user check
        .mockResolvedValueOnce({ ...mockUser }); // findValidatorForUser
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        typeWithoutBalance,
      );
      // hasConfiguredBalance: no individual, no global → unlimited
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce(null);

      mockPrismaService.leave.findMany.mockResolvedValueOnce([]); // overlap check only
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.leave.create.mockResolvedValue(mockLeave);

      const result = await service.create('user-1', createLeaveDto);
      expect(result).toBeDefined();
      expect(mockPrismaService.leave.create).toHaveBeenCalled();
    });

    it('should reject leave when allocated balance is zero', async () => {
      const typeWithZeroBalance = { ...mockLeaveTypeConfig, code: 'RTT' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        typeWithZeroBalance,
      );

      // hasConfiguredBalance: no individual, global row exists (totalDays will be 0)
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        id: 'g1',
      });

      // resolveAllocatedDays inside getAvailableDays: individual null, global totalDays=0
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 0,
      });

      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([]) // overlap
        .mockResolvedValueOnce([]) // approved
        .mockResolvedValueOnce([]); // pending

      await expect(service.create('user-1', createLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use individual override when individual balance is more restrictive', async () => {
      const typeRtt = { ...mockLeaveTypeConfig, code: 'RTT' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(typeRtt);

      // hasConfiguredBalance: individual exists → returns true immediately
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce({
        id: 'i1',
      });

      // getAvailableDays → resolveAllocatedDays: individual gives totalDays=3
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce({
        totalDays: 3,
      });

      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([]) // overlap
        .mockResolvedValueOnce([]) // approved
        .mockResolvedValueOnce([]); // pending

      // 3 days available, 5 days requested → rejet
      await expect(service.create('user-1', createLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create leave without approval when not required', async () => {
      const noApprovalLeaveType = {
        ...mockLeaveTypeConfig,
        code: 'CP',
        requiresApproval: false,
      };
      const autoApprovedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        validatorId: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        noApprovalLeaveType,
      );
      // getLeaveBalance: 25 days allocated, none used
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        noApprovalLeaveType,
      ]);
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany.mockResolvedValue([]); // No overlap, no approved/pending leaves
      mockPrismaService.leave.create.mockResolvedValue(autoApprovedLeave);

      const result = await service.create('user-1', createLeaveDto);

      expect(result.status).toBe(LeaveStatus.APPROVED);
    });

    it('should use active delegate as validator when available', async () => {
      const today = new Date();
      const activeDelegate = {
        id: 'delegation-1',
        delegateId: 'delegate-1',
        delegate: { id: 'delegate-1', firstName: 'Delegate', lastName: 'One' },
        isActive: true,
        startDate: new Date(today.getTime() - 86400000),
        endDate: new Date(today.getTime() + 86400000),
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      // getLeaveBalance: 25 days allocated, none used
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        mockLeaveTypeConfig,
      ]);
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany.mockResolvedValue([]); // No overlap, no approved/pending leaves
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        activeDelegate,
      );
      mockPrismaService.leave.create.mockResolvedValue({
        ...mockLeave,
        validatorId: 'delegate-1',
      });

      const result = await service.create('user-1', createLeaveDto);

      expect(result.validatorId).toBe('delegate-1');
    });

    it('COR-005 — cross-team delegate is rejected; only dept manager delegation wins', async () => {
      // RED before fix: the unscoped findFirst returns crossTeamDelegate (dept-B manager)
      // even though user-1 belongs to dept-1 (manager-1). The validator would
      // wrongly become 'delegate-B' instead of 'manager-1'.
      // GREEN after fix: findFirst is called with delegatorId:'manager-1', which
      // is NOT 'manager-B', so mockImpl returns null → falls back to 'manager-1'.
      const today = new Date();
      const crossTeamDelegate = {
        id: 'delegation-B',
        delegatorId: 'manager-B',
        delegateId: 'delegate-B',
        delegate: { id: 'delegate-B', firstName: 'Delegate', lastName: 'B' },
        isActive: true,
        startDate: new Date(today.getTime() - 86400000),
        endDate: new Date(today.getTime() + 86400000),
      };

      // user-1 belongs to dept-1 whose manager is manager-1 (not manager-B)
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Returns cross-team delegate only when delegatorId is NOT scoped to the
      // user's dept manager (i.e. when the old unscoped query runs).
      mockPrismaService.leaveValidationDelegate.findFirst.mockImplementation(
        (args: { where?: { delegatorId?: string } } = {}) => {
          if (args?.where?.delegatorId === 'manager-1')
            return Promise.resolve(null);
          return Promise.resolve(crossTeamDelegate); // cross-team leak
        },
      );

      const validator = await (service as any).findValidatorForUser('user-1');

      // After fix: the cross-team delegate must NOT win; dept manager is returned.
      expect(validator).toBe('manager-1');
    });

    it('TST-020 — dormant manager is skipped; MANAGE_ANY fallback is returned', async () => {
      // RED before fix: findValidatorForUser checks managerId truthy but NOT
      // manager.isActive, so it returns 'manager-1' even when the manager is
      // inactive. After fix: dormant manager is ignored, fallback is used.
      const userWithDormantManager = {
        ...mockUser,
        department: {
          ...mockUser.department,
          managerId: 'manager-1',
          manager: {
            id: 'manager-1',
            firstName: 'Manager',
            lastName: 'One',
            isActive: false,
          },
        },
      };
      const fallbackValidator = {
        id: 'admin-1',
        isActive: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(
        userWithDormantManager,
      );
      // No active delegation for dormant manager
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValueOnce(
        null,
      );
      // getRoleCodesWithPermission: uses ROLE_TEMPLATES (in-memory) + prisma.role.findMany
      mockPrismaService.role.findMany.mockResolvedValueOnce([
        { code: 'ADMIN' },
      ]);
      mockPrismaService.user.findFirst.mockResolvedValueOnce(fallbackValidator);

      const validator = await (service as any).findValidatorForUser('user-1');

      // Dormant manager must NOT be returned; the MANAGE_ANY fallback wins.
      expect(validator).not.toBe('manager-1');
      expect(validator).toBe('admin-1');
    });

    it('should find fallback validator when no manager or delegate', async () => {
      const userWithoutManager = {
        ...mockUser,
        department: { ...mockUser.department, managerId: null },
      };
      const fallbackValidator = {
        id: 'admin-1',
        role: Role.ADMIN,
        isActive: true,
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(userWithoutManager)
        .mockResolvedValueOnce(userWithoutManager);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      // getLeaveBalance: 25 days allocated, none used
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        mockLeaveTypeConfig,
      ]);
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany.mockResolvedValue([]); // No overlap, no approved/pending leaves
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.user.findFirst.mockResolvedValue(fallbackValidator);
      mockPrismaService.leave.create.mockResolvedValue({
        ...mockLeave,
        validatorId: 'admin-1',
      });

      const result = await service.create('user-1', createLeaveDto);

      expect(result).toBeDefined();
    });

    it('should handle half-day leave on single day', async () => {
      const halfDayDto = {
        ...createLeaveDto,
        startDate: '2025-06-02',
        endDate: '2025-06-02',
        startHalfDay: 'morning',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      // getLeaveBalance: 25 days allocated, none used
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        mockLeaveTypeConfig,
      ]);
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany.mockResolvedValue([]); // No overlap, no approved/pending leaves
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.leave.create.mockResolvedValue({
        ...mockLeave,
        days: 0.5,
      });

      const result = await service.create('user-1', halfDayDto);

      expect(result).toBeDefined();
    });

    it('ignores DTO `type` and derives enum from leaveTypeConfig.code (#8)', async () => {
      // Wave 4 / finding #8 — the DTO still exposes `type` for surface
      // compatibility but the service must IGNORE it: enumType is derived
      // exclusively from `leaveTypeConfig.code`. Otherwise an API caller
      // could persist a row whose `type` (enum) disagreed with the
      // `leaveTypeId` (FK), and dashboards pivoting on either would
      // report inconsistent figures.
      const dtoWithMismatchedType = {
        ...createLeaveDto,
        type: LeaveType.RTT,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      // leaveTypeConfig.code is 'CP' (from mockLeaveTypeConfig). The DTO
      // tries to override to 'RTT'. The server must persist 'CP'.
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.leave.create.mockResolvedValue(mockLeave);

      await service.create('user-1', dtoWithMismatchedType);

      expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leaveTypeId: 'leave-type-1',
            type: LeaveType.CP, // derived from config, not RTT from DTO
          }),
        }),
      );
    });

    it('COR-021 — logs a warn when leaveTypeConfig.code is not a known LeaveType enum value', async () => {
      // The fallback silently maps unknown codes to OTHER. This test asserts
      // that a Logger.warn is emitted so the misconfiguration is surfaced.
      const { Logger } = await import('@nestjs/common');
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {});

      const unknownCodeConfig = {
        ...mockLeaveTypeConfig,
        code: 'UNKNOWN_CODE_XYZ',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        unknownCodeConfig,
      );
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        unknownCodeConfig,
      ]);
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.leave.create.mockResolvedValue({
        ...mockLeave,
        type: LeaveType.OTHER,
      });

      await service.create('user-1', createLeaveDto);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('UNKNOWN_CODE_XYZ'),
      );

      warnSpy.mockRestore();
    });
  });

  // ============================================
  // CROSS-YEAR BALANCE GATING (Wave 1 — findings #1, #2, #3, #10)
  // ============================================
  // Wired through splitLeaveByYear: any leave whose [startDate, endDate]
  // straddles a calendar boundary must be validated against EACH year's
  // allocation independently. Same flow drives update() with excludeLeaveId,
  // so moving a leave across years cannot over-credit the destination.
  describe('cross-year balance gating', () => {
    // 2026-12-28 (Mon) → 2027-01-08 (Fri): splitLeaveByYear emits
    //   { year: 2026, workDays: 4 } (Mon-Thu Dec 28–31)
    //   { year: 2027, workDays: 6 } (Fri Jan 1 + Mon-Fri Jan 4–8)
    const crossYearDto = {
      leaveTypeId: 'leave-type-1',
      startDate: '2026-12-28',
      endDate: '2027-01-08',
      reason: 'Year-spanning leave',
    };

    // Helper: queue one year's worth of gate-phase mocks. The bucket-loop
    // consumes, IN ORDER, for each year that has configured balance:
    //   - hasConfiguredBalance: findUnique(null) + findFirst({id})
    //   - snapshot resolveAllocatedDays: findUnique(null) + findFirst({totalDays})
    //   - inner getAvailableDays → resolveAllocatedDays: another pair
    //   - intersecting leaves: leave.findMany([])
    // Wave 3 (#4) added a re-read phase that runs AFTER the loop, once per
    // year that produced a snapshot. Use `queueRereadPair` separately so
    // the queue order matches execution order (loop, then re-read).
    const queueYearAllocation = (totalDays: number) => {
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        id: `g-${totalDays}`,
      });
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays,
      });
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays,
      });
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]);
    };

    const queueRereadPair = (totalDays: number) => {
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays,
      });
    };

    it('accepts a Dec 28 → Jan 8 leave when both years are funded', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // user check
        .mockResolvedValueOnce({ ...mockUser }); // findValidatorForUser
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]); // overlap
      queueYearAllocation(25); // 2026 loop iteration
      queueYearAllocation(25); // 2027 loop iteration
      // After the loop, re-read fires for each gated year (queue order matters).
      queueRereadPair(25); // 2026 re-read
      queueRereadPair(25); // 2027 re-read
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.leave.create.mockResolvedValue(mockLeave);

      const result = await service.create('user-1', crossYearDto);
      expect(result).toBeDefined();
      expect(mockPrismaService.leave.create).toHaveBeenCalledTimes(1);
    });

    it('rejects naming the destination year when 2027 has zero allocation', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]); // overlap
      queueYearAllocation(25); // 2026 passes loop iter, no re-read fires because 2027 throws
      queueYearAllocation(0); // 2027 exhausted, throws inside the loop

      // The rejection must name 2027 AND state the exact shortfall — the
      // user's Wave 2 acceptance is "rejection message must name the
      // failing year and the exact shortfall in days". 2027 bucket is
      // 6 work days, allocation 0, so shortfall = 6.
      await expect(service.create('user-1', crossYearDto)).rejects.toThrow(
        /en 2027.*6 jours demandés.*0 jours disponibles.*il manque 6 jours/,
      );
      expect(mockPrismaService.leave.create).not.toHaveBeenCalled();
    });

    it('rejects naming the source year when 2026 is exhausted', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]); // overlap
      queueYearAllocation(2); // 2026: only 2 days, leave needs 4 — throws in-loop

      // Gate fails on the first failing year and short-circuits before
      // checking 2027 — that's expected. 2026 bucket is 4 work days,
      // allocation 2, shortfall = 2.
      await expect(service.create('user-1', crossYearDto)).rejects.toThrow(
        /en 2026.*4 jours demandés.*2 jours disponibles.*il manque 2 jours/,
      );
      expect(mockPrismaService.leave.create).not.toHaveBeenCalled();
    });

    it('leaves with no allocation in any year are treated as unlimited', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser });
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]); // overlap

      // hasConfiguredBalance for 2026 → no individual, no global → false
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce(null);
      // hasConfiguredBalance for 2027 → no individual, no global → false
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce(null);

      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.leave.create.mockResolvedValue(mockLeave);

      const result = await service.create('user-1', crossYearDto);
      expect(result).toBeDefined();
    });

    it('update with excludeLeaveId does not over-credit when moving 2025 → 2026', async () => {
      // The hack the refactor killed: legacy code did
      //   adjustedAvailable = available + existingLeave.days
      // which credited the destination year by the FULL `days` of the
      // existing leave even when those days lived in a different year.
      // Concrete scenario: user has 25 days/2026, 0 used. They hold an
      // APPROVED 5-day leave in 2025 and edit it to start in 2026. The
      // legacy gate saw available=25 (2025 leave outside 2026 window) and
      // added +5 → 30. The user could book 30 days in 2026, breaking the
      // 25-day cap by 5.
      // The fix: getAvailableDays(year=2026, { excludeLeaveId: id }) sees
      // available=25 and the gate compares against the bucket's 5 days,
      // exactly. We assert the gate does NOT throw at the 25-day boundary
      // and DOES throw at 26.
      // The leave is PENDING so the owner (CONTRIBUTEUR) can edit it; the
      // over-credit pathology applied to PENDING too, since legacy code
      // added existingLeave.days back regardless of status.
      const existingPending2025 = {
        id: 'edit-target',
        userId: 'user-1',
        leaveTypeId: 'leave-type-1',
        type: LeaveType.CP,
        startDate: new Date('2025-06-02'),
        endDate: new Date('2025-06-06'),
        status: LeaveStatus.PENDING,
        days: 5,
        halfDay: null,
        comment: null,
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(existingPending2025);

      // checkOverlap (excludeId) — return empty
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]);

      // Single year 2026, gated and passing → re-read fires.
      queueYearAllocation(25);
      queueRereadPair(25);

      mockPrismaService.leave.update.mockResolvedValue({
        ...existingPending2025,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-05'),
        days: 5,
      });

      // 5 days requested vs 25 available — passes cleanly. Crucially, no
      // +5 over-credit; the gate's effective budget is exactly 25.
      const result = await service.update(
        'edit-target',
        {
          startDate: '2026-06-01',
          endDate: '2026-06-05',
        },
        'user-1',
        'CONTRIBUTEUR',
      );
      expect(result).toBeDefined();

      // Verify the intersecting query was issued WITH excludeLeaveId — this
      // is what neutralizes findings #2 and #5 in one stroke. Without it,
      // the existing 2025 leave would be filtered by date and never
      // counted, but adding it back would over-credit.
      const intersectingCall = mockPrismaService.leave.findMany.mock.calls.find(
        ([arg]) => arg?.where?.id?.not === 'edit-target',
      );
      expect(intersectingCall).toBeDefined();
    });
  });

  // ============================================
  // WAVE 3 — TRANSACTIONAL SAFETY & STATUS-AWARE EXCLUSION (#4, #5)
  // ============================================
  describe('Wave 3 — transactional safety and status-aware exclusion', () => {
    it('rejects with ConflictException when the snapshotted allocation changes mid-transaction (#4)', async () => {
      // Inside $transaction: snapshot reads 25 days allocated; immediately
      // before write, re-read returns 20 (admin shrank the allocation
      // between the two reads). Gate must abort with ConflictException.
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]); // overlap

      // hasConfiguredBalance
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        id: 'g',
      });
      // snapshot resolveAllocatedDays → 25
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 25,
      });
      // inner resolveAllocatedDays (getAvailableDays) → 25 too; gate passes
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]); // intersecting

      // RE-READ returns a DIFFERENT value — concurrent admin modification.
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 20,
      });

      await expect(
        service.create('user-1', {
          leaveTypeId: 'leave-type-1',
          startDate: '2026-03-02',
          endDate: '2026-03-06',
          reason: 'snapshot race',
        }),
      ).rejects.toThrow(/modifié pendant le traitement/);

      // The leave must NOT have been persisted.
      expect(mockPrismaService.leave.create).not.toHaveBeenCalled();
    });

    it('CANCELLED leaves never inflate getAvailableDays even without excludeLeaveId (#5)', async () => {
      // Wave 1 made #5's regression structurally impossible: getAvailableDays
      // filters by status ∈ {APPROVED, CANCELLATION_REQUESTED, PENDING}, so
      // CANCELLED/REJECTED rows are never in the subtraction set. excludeLeaveId
      // therefore cannot "re-credit" days that were never in the count. This
      // test pins the contract by mocking a CANCELLED row and asserting the
      // intersecting query filters it out at the SQL level.
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany.mockImplementation(({ where }) => {
        // Assert the where clause restricts statuses correctly.
        expect(where.status).toEqual({
          in: [
            LeaveStatus.APPROVED,
            LeaveStatus.CANCELLATION_REQUESTED,
            LeaveStatus.PENDING,
          ],
        });
        // The DB filter would exclude any CANCELLED/REJECTED row before it
        // reached the application; here we mimic that by returning [].
        return Promise.resolve([]);
      });

      const available = await service.getAvailableDays(
        'user-1',
        'leave-type-1',
        2026,
      );
      expect(available).toBe(25);
    });

    // DAT-024 — create() $transaction must use Serializable isolation and
    // retry exactly once on a serialization-failure (P2034). Before the fix
    // no isolationLevel was set and no retry existed, so a P2034 from the DB
    // propagated directly to the caller.
    it('DAT-024: retries create() once on P2034 serialization failure with Serializable isolation', async () => {
      // Build a P2034 error using the mocked PrismaClientKnownRequestError.
      const p2034 = new Prisma.PrismaClientKnownRequestError(
        'could not serialize access due to concurrent update',
        { code: 'P2034' } as { code: string; clientVersion: string },
      );

      // First $transaction call → throws P2034 (simulates Postgres serialization
      // failure). Second call → executes normally (retry succeeds).
      mockPrismaService.$transaction
        .mockRejectedValueOnce(p2034)
        .mockImplementationOnce(
          <T>(cb: (tx: typeof mockPrismaService) => T): T =>
            cb(mockPrismaService),
        );

      // Set up body mocks for the second (successful) attempt only.
      // user + leaveTypeConfig fetched before the $transaction
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // initial user lookup
        .mockResolvedValueOnce({
          ...mockUser,
          department: { ...mockUser.department, manager: { id: 'manager-1' } },
        }); // findValidatorForUser
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValueOnce(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValueOnce(
        null,
      );
      // overlap check (findMany before $transaction)
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]);
      // Inside the $transaction body (attempt 2): hasConfiguredBalance
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        id: 'bal-1',
      });
      // snapshot resolveAllocatedDays → 25
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 25,
      });
      // getAvailableDays inner resolveAllocatedDays → 25
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 25,
      });
      // getAvailableDays intersecting leaves (used days = 0)
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]);
      // re-read snapshot (snapshot unchanged)
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 25,
      });
      mockPrismaService.leave.create.mockResolvedValueOnce(mockLeave);

      const result = await service.create('user-1', {
        leaveTypeId: 'leave-type-1',
        startDate: '2025-06-02',
        endDate: '2025-06-06',
        reason: 'P2034 retry test',
      });

      // (a) Result must exist — the retry succeeded.
      expect(result).toBeDefined();
      expect(result.id).toBe('leave-1');

      // (b) $transaction must have been called twice (first attempt + retry).
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);

      // (c) Both calls must use Serializable isolation.
      expect(mockPrismaService.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    });

    it('DAT-024: does NOT retry on non-P2034 errors (passes through immediately)', async () => {
      // A ConflictException thrown inside the tx must propagate without retry —
      // the retry gate is narrowed to P2034 only.
      mockPrismaService.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValueOnce(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValueOnce(
        null,
      );
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]); // overlap

      // hasConfiguredBalance
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        id: 'bal-1',
      });
      // snapshot resolveAllocatedDays → 25
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 25,
      });
      // getAvailableDays
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]);
      // re-read snapshot → changed (triggers ConflictException, not P2034)
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 20,
      });

      await expect(
        service.create('user-1', {
          leaveTypeId: 'leave-type-1',
          startDate: '2025-06-02',
          endDate: '2025-06-06',
          reason: 'no retry on conflict',
        }),
      ).rejects.toThrow(ConflictException);

      // Exactly one $transaction call — no spurious retry.
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // SELF-APPROVAL (leaves:self_approve)
  // ============================================
  describe('self-approval (leaves:self_approve)', () => {
    const createLeaveDto = {
      leaveTypeId: 'leave-type-1',
      startDate: '2025-06-02',
      endDate: '2025-06-06',
      reason: 'Self-approve test',
    };

    it('grants APPROVED status when requesting user has leaves:self_approve and creates for self', async () => {
      // Mock ADMIN having leaves:self_approve
      mockGetPermissionsForRole.mockImplementation((role: string) => {
        if (role === 'ADMIN') {
          return Promise.resolve([
            'leaves:read',
            'leaves:readAll',
            'leaves:self_approve',
            'leaves:delete',
            'leaves:approve',
            'leaves:manage_any',
          ]);
        }
        return Promise.resolve(['leaves:read', 'leaves:readAll']);
      });

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue({
        ...mockLeaveTypeConfig,
        requiresApproval: true,
      });

      // hasConfiguredBalance: no balance (unlimited)
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce(null);

      // overlap check
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]);

      const autoApprovedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        validatorId: 'user-1',
        validatedById: 'user-1',
        selfApproved: true,
      };
      mockPrismaService.leave.create.mockResolvedValue(autoApprovedLeave);

      const result = await service.create('user-1', createLeaveDto, 'ADMIN');

      // Wave 3 / finding #6: self-approval must leave an explicit audit
      // trail. The leaves table now reflects who validated (validatorId =
      // validatedById = actorId) and that the validation was a
      // self-approval (selfApproved = true). validatedAt is set to the
      // moment the leave was persisted — asserted via expect.any(Date).
      expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: LeaveStatus.APPROVED,
            validatorId: 'user-1',
            validatedById: 'user-1',
            validatedAt: expect.any(Date),
            selfApproved: true,
          }),
        }),
      );
      expect(result.status).toBe(LeaveStatus.APPROVED);
    });

    it('emits an audit log entry naming the actor and the selfApproved flag', async () => {
      // Companion test to the previous one: finding #6 mandates that the
      // audit log (not just the leaves row) records both pieces of info.
      mockGetPermissionsForRole.mockImplementation((role: string) => {
        if (role === 'ADMIN') {
          return Promise.resolve([
            'leaves:read',
            'leaves:self_approve',
            'leaves:manage_any',
          ]);
        }
        return Promise.resolve([]);
      });

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue({
        ...mockLeaveTypeConfig,
        requiresApproval: true,
      });
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]);
      mockPrismaService.leave.create.mockResolvedValue({
        ...mockLeave,
        id: 'leave-self-1',
        status: LeaveStatus.APPROVED,
        selfApproved: true,
      });

      const auditLog = vi.spyOn(service['auditService'], 'log');

      await service.create('user-1', createLeaveDto, 'ADMIN');

      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LEAVE_APPROVED',
          userId: 'user-1',
          targetId: 'leave-self-1',
          details: expect.stringMatching(/selfApproved=true/),
          success: true,
        }),
      );
    });

    it('keeps PENDING status when user does not have leaves:self_approve', async () => {
      // CONTRIBUTEUR role has no leaves:self_approve
      mockGetPermissionsForRole.mockImplementation(() => {
        return Promise.resolve(['leaves:read', 'leaves:readAll']);
      });

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // user check
        .mockResolvedValueOnce({ ...mockUser }); // findValidatorForUser
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue({
        ...mockLeaveTypeConfig,
        requiresApproval: true,
      });

      // hasConfiguredBalance: no balance (unlimited)
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce(null);

      // overlap check
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]);

      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );

      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      mockPrismaService.leave.create.mockResolvedValue(pendingLeave);

      await service.create('user-1', createLeaveDto, 'CONTRIBUTEUR');

      expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: LeaveStatus.PENDING,
          }),
        }),
      );
    });

    it('does not self-approve when leave is for another user (targetUserId)', async () => {
      // ADMIN has leaves:self_approve AND leaves:declare_for_others
      mockGetPermissionsForRole.mockImplementation((role: string) => {
        if (role === 'ADMIN') {
          return Promise.resolve([
            'leaves:read',
            'leaves:readAll',
            'leaves:self_approve',
            'leaves:delete',
            'leaves:approve',
            'leaves:manage_any',
            'leaves:declare_for_others',
          ]);
        }
        return Promise.resolve(['leaves:read', 'leaves:readAll']);
      });

      const targetUser = { ...mockUser, id: 'user-2' };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // requesting user check
        .mockResolvedValueOnce(targetUser) // target user check
        .mockResolvedValueOnce(targetUser); // findValidatorForUser
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue({
        ...mockLeaveTypeConfig,
        requiresApproval: true,
      });

      // hasConfiguredBalance for target user: unlimited
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce(null);

      // overlap check
      mockPrismaService.leave.findMany.mockResolvedValueOnce([]);

      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );

      // declaredByManager path → APPROVED (existing manager-for-other logic)
      const approvedLeave = {
        ...mockLeave,
        userId: 'user-2',
        status: LeaveStatus.APPROVED,
        validatorId: 'user-1',
        validatedById: 'user-1',
        selfApproved: false,
      };
      mockPrismaService.leave.create.mockResolvedValue(approvedLeave);

      const dtoForOther = { ...createLeaveDto, targetUserId: 'user-2' };
      const result = await service.create('user-1', dtoForOther, 'ADMIN');

      // The existing manager-for-other path produces APPROVED
      // (not via self_approve but via declaredByManager=true).
      expect(result.status).toBe(LeaveStatus.APPROVED);
      // Verify leave is created for the target user, not the requesting user
      expect(result.userId).toBe('user-2');

      // Finding #12 — the manager is the validator of record. Auditor
      // reading `leaves` directly can answer "who approved this?" without
      // joining the audit log. `selfApproved` stays false (the actor isn't
      // the leave's beneficiary).
      expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            status: LeaveStatus.APPROVED,
            validatorId: 'user-1',
            validatedById: 'user-1',
            validatedAt: expect.any(Date),
            selfApproved: false,
          }),
        }),
      );
    });

    it('still respects balance check before self-approving (insufficient balance → BadRequestException)', async () => {
      // ADMIN has leaves:self_approve
      mockGetPermissionsForRole.mockImplementation((role: string) => {
        if (role === 'ADMIN') {
          return Promise.resolve([
            'leaves:read',
            'leaves:readAll',
            'leaves:self_approve',
            'leaves:manage_any',
          ]);
        }
        return Promise.resolve(['leaves:read', 'leaves:readAll']);
      });

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue({
        ...mockLeaveTypeConfig,
        requiresApproval: true,
      });

      // Balance configured globally with only 1 day
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        id: 'g1',
      });
      // resolveAllocatedDays: global = 1 day
      mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({
        totalDays: 1,
      });

      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([]) // overlap
        .mockResolvedValueOnce([]) // approved
        .mockResolvedValueOnce([]); // pending

      // 5 days requested, 1 day available → BadRequestException even with self_approve
      await expect(
        service.create('user-1', createLeaveDto, 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // FIND ALL
  // ============================================
  describe('findAll', () => {
    it('should return paginated leaves', async () => {
      const mockLeaves = [mockLeave];
      mockPrismaService.leave.findMany.mockResolvedValue(mockLeaves);
      mockPrismaService.leave.count.mockResolvedValue(1);

      const result = await service.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin-user-id',
        'ADMIN',
      );

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(1);
      expect((result.meta as { total: number }).total).toBe(1);
    });

    it('should filter by userId', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);
      mockPrismaService.leave.count.mockResolvedValue(1);

      await service.findAll(
        1,
        10,
        'user-1',
        undefined,
        undefined,
        undefined,
        undefined,
        'admin-user-id',
        'ADMIN',
      );

      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }) as object,
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.count.mockResolvedValue(0);

      await service.findAll(
        1,
        10,
        undefined,
        LeaveStatus.PENDING,
        undefined,
        undefined,
        undefined,
        'admin-user-id',
        'ADMIN',
      );

      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: LeaveStatus.PENDING,
          }) as object,
        }),
      );
    });

    it('should filter by type', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.count.mockResolvedValue(0);

      await service.findAll(
        1,
        10,
        undefined,
        undefined,
        LeaveType.CP,
        undefined,
        undefined,
        'admin-user-id',
        'ADMIN',
      );

      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: LeaveType.CP }) as object,
        }),
      );
    });

    it('should filter by date range (both dates)', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);
      mockPrismaService.leave.count.mockResolvedValue(1);

      const result = await service.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        '2025-06-01',
        '2025-06-30',
        'admin-user-id',
        'ADMIN',
      );

      // Date-filtered results MUST return paginated {data, meta} — not a raw array
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray((result as { data: unknown[] }).data)).toBe(true);
    });

    it('should filter by startDate only', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);
      mockPrismaService.leave.count.mockResolvedValue(1);

      const result = await service.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        '2025-06-01',
        undefined,
        'admin-user-id',
        'ADMIN',
      );

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('should filter by endDate only', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);
      mockPrismaService.leave.count.mockResolvedValue(1);

      const result = await service.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        '2025-06-30',
        'admin-user-id',
        'ADMIN',
      );

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('should cap limit at 500 (hard ceiling for date-windowed queries)', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.count.mockResolvedValue(0);

      await service.findAll(
        1,
        1000,
        undefined,
        undefined,
        undefined,
        '2025-06-01',
        '2025-06-30',
        'admin-user-id',
        'ADMIN',
      );

      // The hard cap must be 500, not 1000
      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 }),
      );
    });

    it('should return leaveType with name, color and icon in each leave', async () => {
      const leaveWithType = {
        ...mockLeave,
        leaveType: mockLeaveTypeConfig,
      };
      mockPrismaService.leave.findMany.mockResolvedValue([leaveWithType]);
      mockPrismaService.leave.count.mockResolvedValue(1);

      const result = await service.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin-user-id',
        'ADMIN',
      );

      expect(result).toHaveProperty('data');
      const leaves = (result as { data: (typeof leaveWithType)[] }).data;
      expect(leaves).toHaveLength(1);
      expect(leaves[0].leaveType).toBeDefined();
      expect(leaves[0].leaveType.name).toBe('Congés payés');
      expect(leaves[0].leaveType.color).toBe('#10B981');
      expect(leaves[0].leaveType.icon).toBe('🌴');
    });

    it('PER-030 — findAll uses scoped leaveType select (id,code,name,color,icon) not leaveType:true', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.count.mockResolvedValue(0);

      await service.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin-user-id',
        'ADMIN',
      );

      const callArg = mockPrismaService.leave.findMany.mock.calls[0][0];
      const leaveTypeInclude = callArg?.include?.leaveType;
      // Must be a scoped select object, not the boolean `true`
      expect(leaveTypeInclude).not.toBe(true);
      expect(leaveTypeInclude).toEqual({
        select: {
          id: true,
          code: true,
          name: true,
          color: true,
          icon: true,
        },
      });
    });
  });

  // ============================================
  // GET PENDING FOR VALIDATOR
  // ============================================
  describe('getPendingForValidator', () => {
    it('should return all pending leaves for ADMIN', async () => {
      const adminUser = { ...mockUser, role: { code: Role.ADMIN } };
      mockPrismaService.user.findUnique.mockResolvedValue(adminUser);
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);

      const result = await service.getPendingForValidator('admin-1');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: {
              in: [LeaveStatus.PENDING, LeaveStatus.CANCELLATION_REQUESTED],
            },
          },
        }),
      );
    });

    it('should return pending leaves from same services for RESPONSABLE', async () => {
      const responsableUser = { ...mockUser, role: { code: Role.RESPONSABLE } };
      const userServices = [{ serviceId: 'service-1' }];
      const managedServices = [{ id: 'service-2' }];
      const usersInServices = [{ userId: 'user-1' }, { userId: 'user-2' }];

      mockPrismaService.user.findUnique.mockResolvedValue(responsableUser);
      mockPrismaService.userService.findMany
        .mockResolvedValueOnce(userServices) // User's services
        .mockResolvedValueOnce(usersInServices); // Users in those services
      mockPrismaService.service.findMany.mockResolvedValue(managedServices);
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);

      const result = await service.getPendingForValidator('responsable-1');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.userService.findMany).toHaveBeenCalledWith({
        where: { userId: 'responsable-1' },
        select: { serviceId: true },
      });
      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith({
        where: { managerId: 'responsable-1' },
        select: { id: true },
      });
      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: {
              in: [LeaveStatus.PENDING, LeaveStatus.CANCELLATION_REQUESTED],
            },
            userId: { in: ['user-1', 'user-2'] },
          },
        }),
      );
    });

    it('should return pending leaves from managed services for MANAGER', async () => {
      const managerUser = { ...mockUser, role: { code: Role.MANAGER } };
      const userServices = []; // Manager not in any service as user
      const managedServices = [{ id: 'service-1' }]; // But manages service-1
      const usersInServices = [{ userId: 'user-3' }];

      mockPrismaService.user.findUnique.mockResolvedValue(managerUser);
      mockPrismaService.userService.findMany
        .mockResolvedValueOnce(userServices)
        .mockResolvedValueOnce(usersInServices);
      mockPrismaService.service.findMany.mockResolvedValue(managedServices);
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);

      const result = await service.getPendingForValidator('manager-1');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: {
              in: [LeaveStatus.PENDING, LeaveStatus.CANCELLATION_REQUESTED],
            },
            userId: { in: ['user-3'] },
          },
        }),
      );
    });

    it('should return empty array for RESPONSABLE with no services', async () => {
      const responsableUser = { ...mockUser, role: Role.RESPONSABLE };
      mockPrismaService.user.findUnique.mockResolvedValue(responsableUser);
      mockPrismaService.userService.findMany.mockResolvedValue([]);
      mockPrismaService.service.findMany.mockResolvedValue([]);

      const result = await service.getPendingForValidator('responsable-1');

      expect(result).toEqual([]);
    });

    it('should return empty array for MANAGER with no services', async () => {
      const managerUser = { ...mockUser, role: Role.MANAGER };
      mockPrismaService.user.findUnique.mockResolvedValue(managerUser);
      mockPrismaService.userService.findMany.mockResolvedValue([]);
      mockPrismaService.service.findMany.mockResolvedValue([]);

      const result = await service.getPendingForValidator('manager-1');

      expect(result).toEqual([]);
    });

    it('should return empty array for user without validation rights', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.CONTRIBUTEUR,
      });

      const result = await service.getPendingForValidator('user-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getPendingForValidator('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // GET USER LEAVES
  // ============================================
  describe('getOwnLeaves', () => {
    it('should return user leaves', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);

      const result = await service.getOwnLeaves('user-1');

      expect(result).toHaveLength(1);
    });

    it('should scope the leave query to the current user id only', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);

      await service.getOwnLeaves('user-1');

      // COR-028: the only userId in scope is the caller — the query can never
      // be steered to another user's leaves from inside this method.
      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });

    it('should compute canEdit/canDelete per leave status on owned leaves', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leave.findMany.mockResolvedValue([
        { ...mockLeave, id: 'leave-pending', status: LeaveStatus.PENDING },
        { ...mockLeave, id: 'leave-approved', status: LeaveStatus.APPROVED },
        { ...mockLeave, id: 'leave-rejected', status: LeaveStatus.REJECTED },
      ]);

      const result = await service.getOwnLeaves('user-1');

      const byId = Object.fromEntries(result.map((l) => [l.id, l]));
      // PENDING: editable + deletable
      expect(byId['leave-pending'].canEdit).toBe(true);
      expect(byId['leave-pending'].canDelete).toBe(true);
      // APPROVED: neither
      expect(byId['leave-approved'].canEdit).toBe(false);
      expect(byId['leave-approved'].canDelete).toBe(false);
      // REJECTED: deletable but not editable
      expect(byId['leave-rejected'].canEdit).toBe(false);
      expect(byId['leave-rejected'].canDelete).toBe(true);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getOwnLeaves('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================
  // FIND ONE
  // ============================================
  describe('findOne', () => {
    it('should return a leave by id', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);

      const result = await service.findOne('leave-1', 'admin-user-id', 'ADMIN');

      expect(result).toBeDefined();
      expect(result.id).toBe('leave-1');
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', 'admin-user-id', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // UPDATE
  // ============================================
  describe('update', () => {
    const updateDto = { reason: 'Updated reason' };

    it('should update a pending leave request', async () => {
      const pendingLeave = {
        ...mockLeave,
        status: LeaveStatus.PENDING,
        type: LeaveType.RTT,
      };
      const updatedLeave = { ...pendingLeave, comment: 'Updated reason' };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.leave.findMany.mockResolvedValue([]); // No overlap
      mockPrismaService.leave.update.mockResolvedValue(updatedLeave);

      const result = await service.update(
        'leave-1',
        updateDto,
        'admin-user-id',
        'ADMIN',
      );

      expect(result.comment).toBe('Updated reason');
    });

    // OBS-021 — every update must leave a LEAVE_UPDATED trail with before/after
    // of the mutable fields. Pre-fix update() emitted nothing.
    it('emits LEAVE_UPDATED with before/after snapshot (OBS-021)', async () => {
      const pendingLeave = {
        ...mockLeave,
        status: LeaveStatus.PENDING,
        comment: 'Old comment',
      };
      const updatedLeave = { ...pendingLeave, comment: 'Updated reason' };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.update.mockResolvedValue(updatedLeave);

      await service.update('leave-1', updateDto, 'admin-user-id', 'ADMIN', {
        templateKey: 'ADMIN',
        ip: '10.0.0.9',
        ua: 'vitest',
      });

      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistence.log.mock.calls[0][0];
      expect(call.action).toBe('LEAVE_UPDATED');
      expect(call.entityType).toBe('Leave');
      expect(call.entityId).toBe('leave-1');
      expect(call.actorId).toBe('admin-user-id');
      expect(call.payload.actor.roleCode).toBe('ADMIN');
      expect(call.payload.before).toEqual(
        expect.objectContaining({ comment: 'Old comment' }),
      );
      expect(call.payload.after).toEqual(
        expect.objectContaining({ comment: 'Updated reason' }),
      );
      expect(call.payload.ip).toBe('10.0.0.9');
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', updateDto, 'admin-user-id', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);

      // OBS-021 — no audit row on the not-found gate (negative invariant).
      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when non-management role updates a non-pending leave', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        userId: 'contrib-user-id',
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

      await expect(
        service.update('leave-1', updateDto, 'contrib-user-id', 'CONTRIBUTEUR'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when end date is before start date', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);

      const invalidDto = { startDate: '2025-06-10', endDate: '2025-06-05' };

      await expect(
        service.update('leave-1', invalidDto, 'admin-user-id', 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when update causes overlap', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.leave.findMany.mockResolvedValue([
        { id: 'other-leave' },
      ]); // Overlap

      const dateDto = { startDate: '2025-06-10', endDate: '2025-06-15' };

      await expect(
        service.update('leave-1', dateDto, 'admin-user-id', 'ADMIN'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when CP balance is insufficient for additional days', async () => {
      const cpLeave = {
        ...mockLeave,
        status: LeaveStatus.PENDING,
        type: LeaveType.CP,
        days: 3,
      };
      const cpLeaveType = { ...mockLeaveTypeConfig, code: 'CP' };
      mockPrismaService.leave.findUnique.mockResolvedValue(cpLeave);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      // getLeaveBalance: 4 days allocated, 0 used → available=4; newDays~13, additionalDays=13-3=10 > 4 → insufficient
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        cpLeaveType,
      ]);
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 4,
      });
      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([]) // No overlap
        .mockResolvedValueOnce([]) // Approved leaves (0 used)
        .mockResolvedValueOnce([]); // Pending leaves

      const dateDto = { startDate: '2025-06-02', endDate: '2025-06-20' }; // More days requested

      await expect(
        service.update('leave-1', dateDto, 'admin-user-id', 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update dates successfully', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      const updatedLeave = {
        ...pendingLeave,
        startDate: new Date('2025-06-09'),
        endDate: new Date('2025-06-13'),
      };
      const cpLeaveType = { ...mockLeaveTypeConfig, code: 'CP' };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      // getLeaveBalance (type=CP): 25 days allocated, none used → available=25 >= additionalDays=0
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        cpLeaveType,
      ]);
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([]) // No overlap
        .mockResolvedValueOnce([]) // Approved leaves
        .mockResolvedValueOnce([]); // Pending leaves
      mockPrismaService.leave.update.mockResolvedValue(updatedLeave);

      const result = await service.update(
        'leave-1',
        {
          startDate: '2025-06-09',
          endDate: '2025-06-13',
        },
        'admin-user-id',
        'ADMIN',
      );

      expect(result).toBeDefined();
    });

    it('should allow ADMIN to update an approved leave', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        leaveTypeId: 'type-1',
      };
      const updatedLeave = { ...approvedLeave, comment: 'Updated by admin' };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.findMany.mockResolvedValue([]); // No overlap
      mockPrismaService.leave.update.mockResolvedValue(updatedLeave);

      const result = await service.update(
        'leave-1',
        { reason: 'Updated by admin' },
        'admin-user-id',
        'ADMIN',
      );

      expect(result).toEqual(updatedLeave);
    });

    it('should allow RESPONSABLE to update an approved leave in their perimeter', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        leaveTypeId: 'type-1',
      };
      const updatedLeave = { ...approvedLeave, comment: 'Updated by resp' };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.update.mockResolvedValue(updatedLeave);
      // RESPONSABLE est désormais scoped à son périmètre (comme MANAGER)
      mockPrismaService.service.findMany.mockResolvedValue([
        { id: 'service-1' },
      ]);
      mockPrismaService.userService.findMany
        .mockResolvedValueOnce([{ serviceId: 'service-1' }])
        .mockResolvedValueOnce([{ userId: mockLeave.userId }]);

      const result = await service.update(
        'leave-1',
        { reason: 'Updated by resp' },
        'resp-user-id',
        'RESPONSABLE',
      );

      expect(result).toEqual(updatedLeave);
    });

    it('should allow MANAGER to update an approved leave in their perimeter', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        leaveTypeId: 'type-1',
      };
      const updatedLeave = { ...approvedLeave, comment: 'Updated by mgr' };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.update.mockResolvedValue(updatedLeave);
      // getManagedUserIds: 1st call = manager's services, 2nd call = users in those services
      mockPrismaService.service.findMany.mockResolvedValue([
        { id: 'service-1' },
      ]);
      mockPrismaService.userService.findMany
        .mockResolvedValueOnce([{ serviceId: 'service-1' }])
        .mockResolvedValueOnce([{ userId: mockLeave.userId }]);

      const result = await service.update(
        'leave-1',
        { reason: 'Updated by mgr' },
        'mgr-user-id',
        'MANAGER',
      );

      expect(result).toEqual(updatedLeave);
    });

    it('should throw ForbiddenException when MANAGER updates leave outside perimeter', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      // getManagedUserIds: manager has services but leave user not in them
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.userService.findMany
        .mockResolvedValueOnce([{ serviceId: 'other-service' }])
        .mockResolvedValueOnce([{ userId: 'other-user' }]);

      await expect(
        service.update(
          'leave-1',
          { reason: 'Want to change' },
          'mgr-user-id',
          'MANAGER',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when CONTRIBUTEUR updates approved leave', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        userId: 'contrib-user-id',
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

      await expect(
        service.update(
          'leave-1',
          { reason: 'Want to change' },
          'contrib-user-id',
          'CONTRIBUTEUR',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // COR-006 — endHalfDay from update DTO was destructured but silently dropped
    // (passed as undefined to calculateLeaveDays / splitLeaveByYear). A user
    // editing a multi-day leave with endHalfDay set must see days reduced by 0.5.
    it('threads endHalfDay through update() and reduces days by 0.5 (COR-006)', async () => {
      // mockLeave: Mon 2025-06-02 → Fri 2025-06-06, 5 work-days, halfDay: null
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      // After fix: workDays=5, endHalfDay deducts 0.5 → days=4.5
      const updatedLeave = { ...pendingLeave, days: 4.5 };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([]) // No overlap
        .mockResolvedValueOnce([]) // Approved leaves (balance gate)
        .mockResolvedValueOnce([]); // Pending leaves (balance gate)
      mockPrismaService.leave.update.mockResolvedValue(updatedLeave);

      await service.update(
        'leave-1',
        { endHalfDay: 'AFTERNOON' },
        'admin-user-id',
        'ADMIN',
      );

      const updateCall = mockPrismaService.leave.update.mock.calls[0][0];
      expect(updateCall.data.days).toBe(4.5);
    });
  });

  // ============================================
  // REMOVE
  // ============================================
  describe('remove', () => {
    it('should delete a pending leave request', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.leave.delete.mockResolvedValue(pendingLeave);

      const result = await service.remove('leave-1', 'admin-user-id', 'ADMIN');

      expect(result.message).toBe('Demande de congé supprimée avec succès');
    });

    // OBS-021 — leaves are HARD-deleted, so the audit row's `before` snapshot
    // is the only surviving trace of the deleted leave. Pre-fix remove()
    // emitted nothing.
    it('emits LEAVE_DELETED with a full before-snapshot of the deleted leave (OBS-021)', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        comment: 'Vanishing leave',
        validatedById: 'manager-1',
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.delete.mockResolvedValue(approvedLeave);

      await service.remove('leave-1', 'admin-user-id', 'ADMIN', {
        templateKey: 'ADMIN',
        ip: '10.0.0.10',
        ua: 'vitest',
      });

      expect(mockPrismaService.leave.delete).toHaveBeenCalledWith({
        where: { id: 'leave-1' },
      });
      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistence.log.mock.calls[0][0];
      expect(call.action).toBe('LEAVE_DELETED');
      expect(call.entityType).toBe('Leave');
      expect(call.actorId).toBe('admin-user-id');
      expect(call.payload.before).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          status: LeaveStatus.APPROVED,
          comment: 'Vanishing leave',
          validatedById: 'manager-1',
        }),
      );
      expect(call.payload.subject).toEqual({
        leaveId: 'leave-1',
        userId: 'user-1',
      });
    });

    it('does not emit LEAVE_DELETED when the leave is not found (OBS-021)', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', 'admin-user-id', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
      expect(mockPrismaService.leave.delete).not.toHaveBeenCalled();
    });

    it('should delete a rejected leave request', async () => {
      const rejectedLeave = { ...mockLeave, status: LeaveStatus.REJECTED };
      mockPrismaService.leave.findUnique.mockResolvedValue(rejectedLeave);
      mockPrismaService.leave.delete.mockResolvedValue(rejectedLeave);

      const result = await service.remove('leave-1', 'admin-user-id', 'ADMIN');

      expect(result.message).toBe('Demande de congé supprimée avec succès');
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', 'admin-user-id', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow management roles to delete an approved leave', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.delete.mockResolvedValue(approvedLeave);

      const result = await service.remove('leave-1', 'admin-user-id', 'ADMIN');
      expect(result.message).toBe('Demande de congé supprimée avec succès');
    });

    it('should allow RESPONSABLE to delete an approved leave in their perimeter', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.delete.mockResolvedValue(approvedLeave);
      // RESPONSABLE est désormais scoped à son périmètre (comme MANAGER)
      mockPrismaService.service.findMany.mockResolvedValue([
        { id: 'service-1' },
      ]);
      mockPrismaService.userService.findMany
        .mockResolvedValueOnce([{ serviceId: 'service-1' }])
        .mockResolvedValueOnce([{ userId: mockLeave.userId }]);

      const result = await service.remove(
        'leave-1',
        'resp-user-id',
        'RESPONSABLE',
      );
      expect(result.message).toBe('Demande de congé supprimée avec succès');
    });

    it('should allow MANAGER to delete an approved leave in their perimeter', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.delete.mockResolvedValue(approvedLeave);
      // getManagedUserIds: 1st call = manager's services, 2nd call = users in those services
      mockPrismaService.service.findMany.mockResolvedValue([
        { id: 'service-1' },
      ]);
      mockPrismaService.userService.findMany
        .mockResolvedValueOnce([{ serviceId: 'service-1' }]) // manager's own services
        .mockResolvedValueOnce([{ userId: mockLeave.userId }]); // users in perimeter

      const result = await service.remove('leave-1', 'mgr-user-id', 'MANAGER');
      expect(result.message).toBe('Demande de congé supprimée avec succès');
    });

    it('should throw ForbiddenException when MANAGER deletes leave outside perimeter', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      // getManagedUserIds: manager has services but leave user is not in them
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.userService.findMany
        .mockResolvedValueOnce([{ serviceId: 'other-service' }]) // manager's own services
        .mockResolvedValueOnce([{ userId: 'other-user' }]); // only other users in perimeter

      await expect(
        service.remove('leave-1', 'mgr-user-id', 'MANAGER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when non-management role deletes approved leave', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        userId: 'contrib-user-id',
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

      await expect(
        service.remove('leave-1', 'contrib-user-id', 'CONTRIBUTEUR'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should still allow any role to delete PENDING leaves', async () => {
      const pendingLeave = {
        ...mockLeave,
        status: LeaveStatus.PENDING,
        userId: 'contrib-user-id',
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.leave.delete.mockResolvedValue(pendingLeave);

      const result = await service.remove(
        'leave-1',
        'contrib-user-id',
        'CONTRIBUTEUR',
      );
      expect(result.message).toBe('Demande de congé supprimée avec succès');
    });

    it('should allow management roles to delete a cancellation-requested leave', async () => {
      const cancelRequestedLeave = {
        ...mockLeave,
        status: LeaveStatus.CANCELLATION_REQUESTED,
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(
        cancelRequestedLeave,
      );
      mockPrismaService.leave.delete.mockResolvedValue(cancelRequestedLeave);

      const result = await service.remove('leave-1', 'admin-user-id', 'ADMIN');
      expect(result.message).toBe('Demande de congé supprimée avec succès');
    });
  });

  // ============================================
  // CAN VALIDATE
  // ============================================
  describe('canValidate', () => {
    it('should return true for ADMIN', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });

      const result = await service.canValidate('leave-1', 'admin-1');

      expect(result).toBe(true);
    });

    it('should return true for RESPONSABLE', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.RESPONSABLE,
      });

      const result = await service.canValidate('leave-1', 'responsable-1');

      expect(result).toBe(true);
    });

    it('should return true for assigned validator', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue({
        ...mockLeave,
        validatorId: 'validator-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.CONTRIBUTEUR,
      });

      const result = await service.canValidate('leave-1', 'validator-1');

      expect(result).toBe(true);
    });

    it('should return true for active delegate', async () => {
      const today = new Date();
      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.CONTRIBUTEUR,
      });
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue({
        id: 'delegation-1',
        delegateId: 'delegate-1',
        isActive: true,
        startDate: new Date(today.getTime() - 86400000),
        endDate: new Date(today.getTime() + 86400000),
      });

      const result = await service.canValidate('leave-1', 'delegate-1');

      expect(result).toBe(true);
    });

    it('should return false when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      const result = await service.canValidate('nonexistent', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false when validator not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.canValidate('leave-1', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should return false for unauthorized user', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.CONTRIBUTEUR,
      });
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );

      const result = await service.canValidate('leave-1', 'random-user');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // APPROVE
  // ============================================
  describe('approve', () => {
    it('should approve a pending leave request', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      const approvedLeave = { ...pendingLeave, status: LeaveStatus.APPROVED };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });
      mockPrismaService.leave.update.mockResolvedValue(approvedLeave);

      const result = await service.approve('leave-1', 'admin-1');

      expect(result.status).toBe(LeaveStatus.APPROVED);
    });

    it('should approve with comment', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      const approvedLeave = {
        ...pendingLeave,
        status: LeaveStatus.APPROVED,
        validationComment: 'Approved',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });
      mockPrismaService.leave.update.mockResolvedValue(approvedLeave);

      const result = await service.approve('leave-1', 'admin-1', 'Approved');

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(service.approve('nonexistent', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when leave is not pending', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

      await expect(service.approve('leave-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException when user cannot validate', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.CONTRIBUTEUR,
      });
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );

      await expect(service.approve('leave-1', 'random-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    // DAT-001 — status mutation + durable audit must share a $transaction,
    // and the audit MUST go through AuditPersistenceService, not the legacy
    // logger-only AuditService. Pre-fix the test fails because approve()
    // called leave.update outside any tx and emitted to auditService.log
    // (logger-only — never reaches audit_logs).
    it('wraps the status mutation and a durable audit log in a single $transaction (DAT-001)', async () => {
      const pendingLeave = {
        ...mockLeave,
        status: LeaveStatus.PENDING,
        validatedById: null,
        validatedAt: null,
        validationComment: null,
        validatorId: 'manager-1',
        selfApproved: false,
      };
      const approvedLeave = {
        ...pendingLeave,
        status: LeaveStatus.APPROVED,
        validatedById: 'admin-1',
        validatedAt: new Date('2026-05-24T10:00:00Z'),
        validationComment: 'OK',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });
      mockPrismaService.leave.update.mockResolvedValue(approvedLeave);

      await service.approve('leave-1', 'admin-1', 'OK');

      // (a) $transaction must wrap the mutation+audit pair
      expect(mockPrismaService.$transaction).toHaveBeenCalled();

      // (b) durable audit emitted with required snapshot fields
      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LEAVE_APPROVED',
          entityType: 'Leave',
          entityId: 'leave-1',
          actorId: 'admin-1',
          payload: expect.objectContaining({
            targetUserId: 'user-1',
            validatorAssigned: 'manager-1',
            selfApproved: false,
            before: expect.objectContaining({ status: LeaveStatus.PENDING }),
            after: expect.objectContaining({ status: LeaveStatus.APPROVED }),
          }),
        }),
      );
    });

    // OBS-003 — the durable approve audit row must carry the actor snapshot
    // (id + roleCode + templateKey + resolved permissions AT decision time),
    // the subject, and ip/ua. Pre-fix the payload had none of these keys, so
    // the actor/subject/ip/ua assertions below fail.
    it('enriches the LEAVE_APPROVED audit payload with actor role/permissions snapshot + subject + ip/ua (OBS-003)', async () => {
      const pendingLeave = {
        ...mockLeave,
        status: LeaveStatus.PENDING,
        validatorId: 'manager-1',
        selfApproved: false,
      };
      const approvedLeave = {
        ...pendingLeave,
        status: LeaveStatus.APPROVED,
        validatedById: 'admin-1',
        validatedAt: new Date('2026-05-24T10:00:00Z'),
        validationComment: 'OK',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });
      mockPrismaService.leave.update.mockResolvedValue(approvedLeave);

      await service.approve('leave-1', 'admin-1', 'OK', {
        roleCode: 'ADMIN',
        templateKey: 'ADMIN',
        ip: '10.0.0.7',
        ua: 'vitest-agent',
      });

      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistence.log.mock.calls[0][0];
      expect(call.payload.actor).toEqual(
        expect.objectContaining({
          id: 'admin-1',
          roleCode: 'ADMIN',
          templateKey: 'ADMIN',
        }),
      );
      // permissions resolved via PermissionsService (RBAC guard source),
      // non-empty for ADMIN.
      expect(Array.isArray(call.payload.actor.permissions)).toBe(true);
      expect(call.payload.actor.permissions.length).toBeGreaterThan(0);
      expect(call.payload.actor.permissions).toContain('leaves:approve');
      expect(call.payload.subject).toEqual({
        leaveId: 'leave-1',
        userId: 'user-1',
      });
      expect(call.payload.before).toEqual(
        expect.objectContaining({ status: LeaveStatus.PENDING }),
      );
      expect(call.payload.after).toEqual(
        expect.objectContaining({ status: LeaveStatus.APPROVED }),
      );
      expect(call.payload.ip).toBe('10.0.0.7');
      expect(call.payload.ua).toBe('vitest-agent');
    });

    // DAT-001 — re-read sous tx : si une mutation concurrente a déjà fait
    // sortir le congé de PENDING (race avec un autre validateur), on doit
    // refuser au lieu d'écraser silencieusement.
    it('rejects with ConflictException when the leave is no longer PENDING inside the transaction (DAT-001)', async () => {
      const pendingOutside = { ...mockLeave, status: LeaveStatus.PENDING };
      const approvedInsideTx = { ...mockLeave, status: LeaveStatus.APPROVED };

      // Three leave.findUnique calls happen on this path:
      //  1) pre-tx gate in approve()
      //  2) inside canValidate() (re-looks the leave up by id)
      //  3) inside the tx callback (re-read after gates passed)
      // Only the third returns APPROVED — simulating a concurrent validator
      // that flipped the row between gate and tx.
      mockPrismaService.leave.findUnique
        .mockResolvedValueOnce(pendingOutside)
        .mockResolvedValueOnce(pendingOutside)
        .mockResolvedValueOnce(approvedInsideTx);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });

      await expect(service.approve('leave-1', 'admin-1')).rejects.toThrow(
        ConflictException,
      );

      // No audit write must happen on the conflict path.
      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
      // No status write either — the tx callback aborts before update.
      expect(mockPrismaService.leave.update).not.toHaveBeenCalled();
    });

    // COR-037 — the approve path does NOT re-check overlap; the DAT-023
    // EXCLUDE `leaves_no_overlap` is the only barrier. When a sibling race
    // makes the second PENDING→APPROVED transition collide with an already-
    // APPROVED overlapping leave, Postgres surfaces 23P01. Pre-fix this leaks
    // as a generic 500; post-fix the wrapper maps it to ConflictException
    // (the same 409 the create/update overlap path returns), and no audit
    // write fires (the tx aborts before the LEAVE_APPROVED log).
    it('maps DAT-023 leaves_no_overlap 23P01 from tx.leave.update to ConflictException (COR-037)', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      // Outer findUnique + inner tx findUnique both return PENDING (the gate
      // passes); the update is the surface that throws.
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });
      mockPrismaService.leave.update.mockRejectedValue(
        new Error(
          'Raw query failed. Code: 23P01. Message: conflicting key value violates exclusion constraint "leaves_no_overlap"',
        ),
      );

      await expect(service.approve('leave-1', 'admin-1')).rejects.toThrow(
        ConflictException,
      );

      // The LEAVE_APPROVED audit must NOT fire on the conflict path — the tx
      // aborted before reaching the auditPersistence.log call, and the outer
      // catch only maps the error.
      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    // COR-008 — approve() must re-validate the balance inside the tx before
    // writing APPROVED. Pre-fix: no balance check at all → no throw → RED.
    // Post-fix: yearBuckets gate (with excludeLeaveId) is run; when
    // totalDays has been reduced below the requested days since PENDING was
    // created, ConflictException is thrown (signal: stale state, not bad
    // user input). Audit must NOT fire since the tx aborts.
    it('COR-008 — rejects with ConflictException when the balance became insufficient between creation and approval', async () => {
      // mockLeave: 5 days requested (2025-06-02 → 2025-06-06), leaveTypeId='leave-type-1'
      const pendingLeave = {
        ...mockLeave,
        status: LeaveStatus.PENDING,
        days: 5,
        validatedById: null,
        validatedAt: null,
        validationComment: null,
        selfApproved: false,
        validatorId: 'manager-1',
      };

      // Three leave.findUnique calls on the approve() path:
      //   1) outer pre-tx gate
      //   2) inside canValidate()
      //   3) inside the $transaction callback (re-read)
      // All three return PENDING — the race-condition guard passes; the
      // failure must come from the balance check.
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });

      // leaveBalance.findUnique mock sequence (consumed in order):
      //   1st call  → hasConfiguredBalance: returns an id row → configured=true
      //   2nd call  → resolveAllocatedDays (inside getAvailableDays): totalDays=3
      //   (note: the leave itself is excluded via excludeLeaveId so findMany=[])
      mockPrismaService.leaveBalance.findUnique
        .mockResolvedValueOnce({ id: 'bal-2025' }) // hasConfiguredBalance
        .mockResolvedValueOnce({
          // resolveAllocatedDays
          id: 'bal-2025',
          userId: 'user-1',
          leaveTypeId: 'leave-type-1',
          year: 2025,
          totalDays: 3, // reduced: was 5, now 3
        });

      // No consumed leaves besides the leave being approved (it is excluded
      // via excludeLeaveId so getAvailableDays does not double-count it).
      mockPrismaService.leave.findMany.mockResolvedValue([]);

      // 3 available < 5 requested → ConflictException
      await expect(service.approve('leave-1', 'admin-1')).rejects.toThrow(
        ConflictException,
      );

      // No status write and no audit on the conflict path.
      expect(mockPrismaService.leave.update).not.toHaveBeenCalled();
      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // REJECT
  // ============================================
  describe('reject', () => {
    it('should reject a pending leave request', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      const rejectedLeave = { ...pendingLeave, status: LeaveStatus.REJECTED };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });
      mockPrismaService.leave.update.mockResolvedValue(rejectedLeave);

      const result = await service.reject(
        'leave-1',
        'admin-1',
        'Not enough staff',
      );

      expect(result.status).toBe(LeaveStatus.REJECTED);
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(service.reject('nonexistent', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when leave is not pending', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

      await expect(service.reject('leave-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException when user cannot validate', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.CONTRIBUTEUR,
      });
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );

      await expect(service.reject('leave-1', 'random-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    // DAT-001 — même garantie que approve() : tx + audit durable.
    it('wraps the status mutation and a durable audit log in a single $transaction (DAT-001)', async () => {
      const pendingLeave = {
        ...mockLeave,
        status: LeaveStatus.PENDING,
        validatedById: null,
        validatedAt: null,
        validationComment: null,
        validatorId: 'manager-1',
        selfApproved: false,
      };
      const rejectedLeave = {
        ...pendingLeave,
        status: LeaveStatus.REJECTED,
        validatedById: 'admin-1',
        validatedAt: new Date('2026-05-24T10:00:00Z'),
        validationComment: 'Not enough staff',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });
      mockPrismaService.leave.update.mockResolvedValue(rejectedLeave);

      await service.reject('leave-1', 'admin-1', 'Not enough staff');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LEAVE_REJECTED',
          entityType: 'Leave',
          entityId: 'leave-1',
          actorId: 'admin-1',
          payload: expect.objectContaining({
            targetUserId: 'user-1',
            validatorAssigned: 'manager-1',
            selfApproved: false,
            before: expect.objectContaining({ status: LeaveStatus.PENDING }),
            after: expect.objectContaining({ status: LeaveStatus.REJECTED }),
          }),
        }),
      );
    });

    // OBS-003 — symmetric to the approve enrichment witness: the reject audit
    // row must carry the same actor snapshot + subject + ip/ua.
    it('enriches the LEAVE_REJECTED audit payload with actor role/permissions snapshot + subject + ip/ua (OBS-003)', async () => {
      const pendingLeave = {
        ...mockLeave,
        status: LeaveStatus.PENDING,
        validatorId: 'manager-1',
        selfApproved: false,
      };
      const rejectedLeave = {
        ...pendingLeave,
        status: LeaveStatus.REJECTED,
        validatedById: 'admin-1',
        validatedAt: new Date('2026-05-24T10:00:00Z'),
        validationComment: 'No',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.ADMIN,
      });
      mockPrismaService.leave.update.mockResolvedValue(rejectedLeave);

      await service.reject('leave-1', 'admin-1', 'No', {
        roleCode: 'ADMIN',
        templateKey: 'ADMIN',
        ip: '10.0.0.8',
        ua: 'vitest-agent',
      });

      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistence.log.mock.calls[0][0];
      expect(call.payload.actor).toEqual(
        expect.objectContaining({
          id: 'admin-1',
          roleCode: 'ADMIN',
          templateKey: 'ADMIN',
        }),
      );
      expect(call.payload.actor.permissions).toContain('leaves:approve');
      expect(call.payload.subject).toEqual({
        leaveId: 'leave-1',
        userId: 'user-1',
      });
      expect(call.payload.ip).toBe('10.0.0.8');
      expect(call.payload.ua).toBe('vitest-agent');
    });
  });

  // ============================================
  // CANCEL
  // ============================================
  describe('cancel', () => {
    it('should cancel an approved leave', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      const cancelledLeave = {
        ...approvedLeave,
        status: LeaveStatus.CANCELLED,
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.update.mockResolvedValue(cancelledLeave);

      const result = await service.cancel('leave-1');

      expect(result.status).toBe(LeaveStatus.CANCELLED);
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(service.cancel('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when leave is not approved', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);

      await expect(service.cancel('leave-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    // SEC-06 — cross-perimeter cancellation must be rejected.
    it('should throw ForbiddenException when MANAGER cancels a leave outside their perimeter', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      // Manager has services, but the leave's user is not in them.
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.userService.findMany
        .mockResolvedValueOnce([{ serviceId: 'other-service' }])
        .mockResolvedValueOnce([{ userId: 'some-other-user' }]);

      await expect(
        service.cancel('leave-1', 'mgr-user-id', 'MANAGER'),
      ).rejects.toThrow(ForbiddenException);
    });

    // COR-030 — owner cancelling own APPROVED leave must be redirected to requestCancel.
    // An owner who is not a manager bypassed the guard and could cancel an APPROVED
    // leave directly. This is wrong: they must go through requestCancel() to enter
    // CANCELLATION_REQUESTED and await manager validation.
    it('COR-030 — should throw ForbiddenException when owner cancels own APPROVED leave (must use requestCancel)', async () => {
      const approvedLeave = {
        ...mockLeave,
        userId: 'user-1',
        status: LeaveStatus.APPROVED,
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      // CONTRIBUTEUR role → canManageLeave returns false (no leaves:delete or leaves:approve)

      await expect(
        service.cancel('leave-1', 'user-1', 'CONTRIBUTEUR'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to cancel any leave', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      const cancelledLeave = {
        ...approvedLeave,
        status: LeaveStatus.CANCELLED,
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.update.mockResolvedValue(cancelledLeave);

      const result = await service.cancel('leave-1', 'admin-1', 'ADMIN');
      expect(result.status).toBe(LeaveStatus.CANCELLED);
    });

    // DAT-001 — cancel est une transition audit-sensible (APPROVED →
    // REJECTED). Avant ce ticket, aucune entrée audit_logs n'était écrite
    // et la mutation ne partageait pas une tx avec l'audit.
    it('wraps the status mutation and a durable audit log in a single $transaction (DAT-001)', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        validatorId: 'manager-1',
        validatedById: 'manager-1',
        validatedAt: new Date('2026-05-20T10:00:00Z'),
        selfApproved: false,
      };
      const cancelledLeave = {
        ...approvedLeave,
        status: LeaveStatus.CANCELLED,
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.update.mockResolvedValue(cancelledLeave);

      await service.cancel('leave-1', 'admin-1', 'ADMIN');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LEAVE_CANCELLED',
          entityType: 'Leave',
          entityId: 'leave-1',
          actorId: 'admin-1',
          payload: expect.objectContaining({
            targetUserId: 'user-1',
            validatorAssigned: 'manager-1',
            selfApproved: false,
            before: expect.objectContaining({ status: LeaveStatus.APPROVED }),
            after: expect.objectContaining({ status: LeaveStatus.CANCELLED }),
          }),
        }),
      );
    });

    // COR-004 — cancel() must write CANCELLED, not REJECTED.
    // REJECTED is set by reject() (refused by validator); a self-cancellation
    // and a manager rejection must be distinguishable in audit/report flows.
    // The update call must stamp the cancelling actor via validatedById/At.
    it('COR-004 — cancel() writes CANCELLED status (not REJECTED) and stamps actor via validatedById', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        validatorId: 'manager-1',
        validatedById: 'manager-1',
        validatedAt: new Date('2026-05-20T10:00:00Z'),
        selfApproved: false,
      };
      const cancelledLeave = {
        ...approvedLeave,
        status: LeaveStatus.CANCELLED,
        validatedById: 'admin-1',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.update.mockResolvedValue(cancelledLeave);

      await service.cancel('leave-1', 'admin-1', 'ADMIN');

      // The key assertion: leave.update must be called with CANCELLED, not REJECTED,
      // and must stamp the cancelling actor.
      expect(mockPrismaService.leave.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: LeaveStatus.CANCELLED,
            validatedById: 'admin-1',
          }),
        }),
      );
    });
  });

  // ============================================
  // REJECT CANCELLATION (SEC-06 perimeter check)
  // ============================================
  // ============================================
  // REQUEST CANCEL (OBS-021)
  // ============================================
  describe('requestCancel', () => {
    it('emits LEAVE_CANCELLATION_REQUESTED with before/after status (OBS-021)', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        userId: 'user-1',
      };
      const requested = {
        ...approvedLeave,
        status: LeaveStatus.CANCELLATION_REQUESTED,
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.update.mockResolvedValue(requested);

      const result = await service.requestCancel('leave-1', 'user-1', {
        roleCode: 'CONTRIBUTEUR',
        ip: '10.0.0.11',
        ua: 'vitest',
      });

      expect(result.status).toBe(LeaveStatus.CANCELLATION_REQUESTED);
      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistence.log.mock.calls[0][0];
      expect(call.action).toBe('LEAVE_CANCELLATION_REQUESTED');
      expect(call.entityType).toBe('Leave');
      expect(call.actorId).toBe('user-1');
      expect(call.payload.before).toEqual({ status: LeaveStatus.APPROVED });
      expect(call.payload.after).toEqual({
        status: LeaveStatus.CANCELLATION_REQUESTED,
      });
      expect(call.payload.ip).toBe('10.0.0.11');
    });

    it('does not emit when requesting cancellation of someone else’s leave (OBS-021)', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        userId: 'someone-else',
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

      await expect(service.requestCancel('leave-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
      expect(mockPrismaService.leave.update).not.toHaveBeenCalled();
    });

    // COR-009 - TOCTOU: requestCancel() reads APPROVED outside tx but by the
    // time the tx.leave.update fires a concurrent actor may have already moved
    // the row out of APPROVED. Without the inner re-read+guard the update
    // proceeds silently (last-write-wins). Post-fix: the inner re-read inside
    // $transaction detects the stale status and throws ConflictException.
    it('COR-009 - rejects with ConflictException when status changed to non-APPROVED inside the transaction', async () => {
      const approvedOutside = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
        userId: 'user-1',
      };
      // Concurrent actor already moved the row to CANCELLATION_REQUESTED
      // between the outer read and the inner tx re-read.
      const alreadyRequestedInsideTx = {
        ...mockLeave,
        status: LeaveStatus.CANCELLATION_REQUESTED,
        userId: 'user-1',
      };
      // Two findUnique calls on this path:
      //   1) outer pre-tx gate in requestCancel()
      //   2) inner re-read inside $transaction (only exists after the fix)
      mockPrismaService.leave.findUnique
        .mockResolvedValueOnce(approvedOutside)
        .mockResolvedValueOnce(alreadyRequestedInsideTx);

      await expect(service.requestCancel('leave-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );

      // No status mutation and no audit on the conflict path.
      expect(mockPrismaService.leave.update).not.toHaveBeenCalled();
      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });
  });

  describe('rejectCancellation', () => {
    it('should throw ForbiddenException when MANAGER rejects a cancellation outside their perimeter', async () => {
      const leave = {
        ...mockLeave,
        status: LeaveStatus.CANCELLATION_REQUESTED,
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(leave);
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.userService.findMany
        .mockResolvedValueOnce([{ serviceId: 'other-service' }])
        .mockResolvedValueOnce([{ userId: 'some-other-user' }]);

      await expect(
        service.rejectCancellation('leave-1', 'mgr-user-id', 'MANAGER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to reject a cancellation on any leave', async () => {
      const leave = {
        ...mockLeave,
        status: LeaveStatus.CANCELLATION_REQUESTED,
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(leave);
      mockPrismaService.leave.update.mockResolvedValue({
        ...leave,
        status: LeaveStatus.APPROVED,
      });

      const result = await service.rejectCancellation(
        'leave-1',
        'admin-1',
        'ADMIN',
      );
      expect(result.status).toBe(LeaveStatus.APPROVED);
    });

    // COR-009 - TOCTOU: rejectCancellation() has no $transaction - bare
    // prisma.leave.update with no status guard. Two admins acting simultaneously
    // can each pass the CANCELLATION_REQUESTED check; both then issue UPDATE
    // last-write-wins. Post-fix: wrap in $transaction with inner re-read+guard.
    it('COR-009 - rejects with ConflictException when status changed to non-CANCELLATION_REQUESTED inside the transaction', async () => {
      const cancellationRequestedOutside = {
        ...mockLeave,
        status: LeaveStatus.CANCELLATION_REQUESTED,
      };
      // Concurrent actor already moved the row between outer read and tx.
      const approvedInsideTx = {
        ...mockLeave,
        status: LeaveStatus.APPROVED,
      };
      // Two findUnique calls on this path:
      //   1) outer pre-tx gate in rejectCancellation()
      //   2) inner re-read inside $transaction (only exists after the fix)
      mockPrismaService.leave.findUnique
        .mockResolvedValueOnce(cancellationRequestedOutside)
        .mockResolvedValueOnce(approvedInsideTx);

      await expect(
        service.rejectCancellation('leave-1', 'admin-1', 'ADMIN'),
      ).rejects.toThrow(ConflictException);

      // No status mutation on the conflict path.
      expect(mockPrismaService.leave.update).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // CREATE DELEGATION
  // ============================================
  describe('createDelegation', () => {
    const startDate = new Date('2025-06-01');
    const endDate = new Date('2025-06-15');

    it('should create a delegation successfully', async () => {
      const delegator = {
        ...mockUser,
        id: 'manager-1',
        role: { code: Role.MANAGER },
      };
      const delegate = { ...mockUser, id: 'delegate-1', isActive: true };
      const delegation = {
        id: 'delegation-1',
        delegatorId: 'manager-1',
        delegateId: 'delegate-1',
        startDate,
        endDate,
        isActive: true,
        delegator,
        delegate,
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(delegator)
        .mockResolvedValueOnce(delegate);
      mockPrismaService.leaveValidationDelegate.create.mockResolvedValue(
        delegation,
      );

      const result = await service.createDelegation(
        'manager-1',
        'delegate-1',
        startDate,
        endDate,
      );

      expect(result).toBeDefined();
      expect(result.delegatorId).toBe('manager-1');
    });

    it('should throw NotFoundException when delegator not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createDelegation(
          'nonexistent',
          'delegate-1',
          startDate,
          endDate,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when delegator is not authorized', async () => {
      const contributeur = { ...mockUser, role: Role.CONTRIBUTEUR };
      mockPrismaService.user.findUnique.mockResolvedValue(contributeur);

      await expect(
        service.createDelegation('user-1', 'delegate-1', startDate, endDate),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when delegate not found', async () => {
      const manager = { ...mockUser, role: { code: Role.MANAGER } };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(manager)
        .mockResolvedValueOnce(null);

      await expect(
        service.createDelegation(
          'manager-1',
          'nonexistent',
          startDate,
          endDate,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when delegate is inactive', async () => {
      const manager = { ...mockUser, role: { code: Role.MANAGER } };
      const inactiveDelegate = { ...mockUser, isActive: false };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(manager)
        .mockResolvedValueOnce(inactiveDelegate);

      await expect(
        service.createDelegation(
          'manager-1',
          'inactive-user',
          startDate,
          endDate,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when end date is before start date', async () => {
      const manager = { ...mockUser, role: { code: Role.MANAGER } };
      const delegate = { ...mockUser, isActive: true };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(manager)
        .mockResolvedValueOnce(delegate);

      await expect(
        service.createDelegation('manager-1', 'delegate-1', endDate, startDate),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow ADMIN to create delegation', async () => {
      const admin = { ...mockUser, role: { code: Role.ADMIN } };
      const delegate = { ...mockUser, isActive: true };
      const delegation = {
        id: 'delegation-1',
        delegatorId: 'admin-1',
        delegateId: 'delegate-1',
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(delegate);
      mockPrismaService.leaveValidationDelegate.create.mockResolvedValue(
        delegation,
      );

      const result = await service.createDelegation(
        'admin-1',
        'delegate-1',
        startDate,
        endDate,
      );

      expect(result).toBeDefined();
    });

    it('should allow RESPONSABLE to create delegation', async () => {
      const responsable = { ...mockUser, role: { code: Role.RESPONSABLE } };
      const delegate = { ...mockUser, isActive: true };
      const delegation = {
        id: 'delegation-1',
        delegatorId: 'responsable-1',
        delegateId: 'delegate-1',
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(responsable)
        .mockResolvedValueOnce(delegate);
      mockPrismaService.leaveValidationDelegate.create.mockResolvedValue(
        delegation,
      );

      const result = await service.createDelegation(
        'responsable-1',
        'delegate-1',
        startDate,
        endDate,
      );

      expect(result).toBeDefined();
    });
  });

  // ============================================
  // GET DELEGATIONS
  // ============================================
  describe('getDelegations', () => {
    it('should return given and received delegations', async () => {
      const givenDelegations = [{ id: 'delegation-1', delegate: mockUser }];
      const receivedDelegations = [{ id: 'delegation-2', delegator: mockUser }];

      mockPrismaService.leaveValidationDelegate.findMany
        .mockResolvedValueOnce(givenDelegations)
        .mockResolvedValueOnce(receivedDelegations);

      const result = await service.getDelegations('user-1');

      expect(result.given).toHaveLength(1);
      expect(result.received).toHaveLength(1);
    });
  });

  // ============================================
  // DEACTIVATE DELEGATION
  // ============================================
  describe('deactivateDelegation', () => {
    it('should deactivate a delegation by delegator', async () => {
      const delegation = {
        id: 'delegation-1',
        delegatorId: 'manager-1',
        isActive: true,
      };
      const deactivatedDelegation = { ...delegation, isActive: false };

      mockPrismaService.leaveValidationDelegate.findUnique.mockResolvedValue(
        delegation,
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.MANAGER,
      });
      mockPrismaService.leaveValidationDelegate.update.mockResolvedValue(
        deactivatedDelegation,
      );

      const result = await service.deactivateDelegation(
        'delegation-1',
        'manager-1',
      );

      expect(result.isActive).toBe(false);
    });

    it('should allow ADMIN to deactivate any delegation', async () => {
      const delegation = {
        id: 'delegation-1',
        delegatorId: 'manager-1',
        isActive: true,
      };
      const deactivatedDelegation = { ...delegation, isActive: false };

      mockPrismaService.leaveValidationDelegate.findUnique.mockResolvedValue(
        delegation,
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: { code: Role.ADMIN },
      });
      mockPrismaService.leaveValidationDelegate.update.mockResolvedValue(
        deactivatedDelegation,
      );

      const result = await service.deactivateDelegation(
        'delegation-1',
        'admin-1',
      );

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when delegation not found', async () => {
      mockPrismaService.leaveValidationDelegate.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.deactivateDelegation('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not authorized', async () => {
      const delegation = {
        id: 'delegation-1',
        delegatorId: 'manager-1',
        isActive: true,
      };
      mockPrismaService.leaveValidationDelegate.findUnique.mockResolvedValue(
        delegation,
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.CONTRIBUTEUR,
      });

      await expect(
        service.deactivateDelegation('delegation-1', 'random-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ============================================
  // GET LEAVE BALANCE
  // ============================================
  describe('getLeaveBalance', () => {
    // COR-007 helper: returns the end date such that [start..end] inclusive
    // contains exactly n workdays (Mon–Fri UTC). start MUST be a Monday.
    function addWorkdays(start: Date, n: number): Date {
      let count = 1; // start is workday #1
      const cursor = new Date(start);
      while (count < n) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        const dow = cursor.getUTCDay();
        if (dow !== 0 && dow !== 6) count++;
      }
      return cursor;
    }

    // Find next Monday at or after d (UTC)
    function nextMonday(d: Date): Date {
      const m = new Date(d);
      while (m.getUTCDay() !== 1) m.setUTCDate(m.getUTCDate() + 1);
      return m;
    }

    // Find first Monday of the year (UTC)
    function firstMondayOfYear(year: number): Date {
      return nextMonday(new Date(Date.UTC(year, 0, 1)));
    }

    it('should return leave balance for user', async () => {
      const cy = new Date().getFullYear();
      const cpLeaveType = { ...mockLeaveTypeConfig, code: 'CP' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      // leaveTypeConfig.findMany returns [CP type]
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        cpLeaveType,
      ]);
      // resolveAllocatedDays: individual balance = 25 days
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      // COR-007 fixture: leaves need real dates for splitLeaveByYear.
      // Leave A starts on first Monday of cy, spans 10 workdays.
      // Leave B starts the week after, spans 5 workdays. Total used = 15.
      const mon1 = firstMondayOfYear(cy);
      const endA = addWorkdays(mon1, 10); // [mon1..endA] = 10 workdays inclusive
      const mon2 = nextMonday(new Date(endA.getTime() + 86400000)); // Mon after endA
      const endB = addWorkdays(mon2, 5); // 5 workdays
      // PER-002: single bulk query; each fixture carries status+leaveTypeId
      // so the in-memory filter can partition them correctly.
      const leaveA = {
        days: 10,
        startDate: mon1,
        endDate: endA,
        halfDay: null,
        status: 'APPROVED',
        leaveTypeId: mockLeaveTypeConfig.id,
      };
      const leaveB = {
        days: 5,
        startDate: mon2,
        endDate: endB,
        halfDay: null,
        status: 'APPROVED',
        leaveTypeId: mockLeaveTypeConfig.id,
      };
      mockPrismaService.leave.findMany.mockResolvedValue([leaveA, leaveB]);

      const result = await service.getLeaveBalance('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.total).toBe(25);
      expect(result.used).toBe(15);
      expect(result.available).toBe(10);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getLeaveBalance('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return 0 available when all days used', async () => {
      const cy = new Date().getFullYear();
      const cpLeaveType = { ...mockLeaveTypeConfig, code: 'CP' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      // leaveTypeConfig.findMany returns [CP type]
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        cpLeaveType,
      ]);
      // resolveAllocatedDays: individual balance = 25 days
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      // COR-007 fixture: 30 workdays from first Monday of cy (6 weeks).
      // Exceeds total=25 so available clamps to 0.
      const mon1 = firstMondayOfYear(cy);
      const endBig = addWorkdays(mon1, 30);
      // PER-002: single bulk query with status+leaveTypeId
      const bigLeave = {
        days: 30,
        startDate: mon1,
        endDate: endBig,
        halfDay: null,
        status: 'APPROVED',
        leaveTypeId: mockLeaveTypeConfig.id,
      };
      mockPrismaService.leave.findMany.mockResolvedValue([bigLeave]);

      const result = await service.getLeaveBalance('user-1');

      expect(result.available).toBe(0);
    });

    it('should include pending days', async () => {
      const cpLeaveType = { ...mockLeaveTypeConfig, code: 'CP' };
      const cy = new Date().getFullYear();
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      // leaveTypeConfig.findMany returns [CP type]
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        cpLeaveType,
      ]);
      // resolveAllocatedDays: individual balance = 25 days
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      // COR-007 fixture: 5 workdays from first Monday of cy → pending=5
      const mon1 = firstMondayOfYear(cy);
      const pEnd = addWorkdays(mon1, 5);
      // PER-002: single bulk query; pending leave carries status+leaveTypeId
      mockPrismaService.leave.findMany.mockResolvedValue([
        {
          days: 5,
          startDate: mon1,
          endDate: pEnd,
          halfDay: null,
          status: 'PENDING',
          leaveTypeId: mockLeaveTypeConfig.id,
        },
      ]);

      const result = await service.getLeaveBalance('user-1');

      expect(result.pending).toBe(5);
    });

    it('COR-007 — cross-year leave sums only in-year days (parisYearWindow + splitLeaveByYear)', async () => {
      const cy = new Date().getFullYear();
      const cpLeaveType = { ...mockLeaveTypeConfig, code: 'CP' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        cpLeaveType,
      ]);
      // resolveAllocatedDays: 25 days
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      // APPROVED leave spanning Dec 28 cy → Jan 8 cy+1.
      // Stores days=10 (full span). In-year (cy) workdays = Mon 29, Tue 30
      // = 2 days (Dec 28 = Sun, Dec 31 = Wed + Jan 1 fall in cy+1).
      // Exact count varies by year; we only assert 0 < used < 10.
      const crossStart = new Date(Date.UTC(cy, 11, 28, 12, 0, 0));
      const crossEnd = new Date(Date.UTC(cy + 1, 0, 8, 12, 0, 0));
      // PER-002: single bulk query; cross-year leave carries status+leaveTypeId
      mockPrismaService.leave.findMany.mockResolvedValue([
        {
          days: 10,
          startDate: crossStart,
          endDate: crossEnd,
          halfDay: null,
          status: 'APPROVED',
          leaveTypeId: mockLeaveTypeConfig.id,
        },
      ]);

      const result = await service.getLeaveBalance('user-1');
      const used = result.byType[0].used;

      // Before fix: Number(l.days) = 10 → fails toBeGreaterThan(0) + toBeLessThan(10)
      // After fix: splitLeaveByYear in-year workdays only → 1–4 depending on year
      expect(used).toBeGreaterThan(0);
      expect(used).toBeLessThan(10);
    });

    it('PER-002 — N leave types fire exactly 1 leave.findMany (not 2N)', async () => {
      // Fail-pre witness: with 2 active leave types, unfixed code calls
      // leave.findMany 4 times (2 per type). Fixed code: exactly 1 call.
      const cy = new Date().getFullYear();
      const cpType = { ...mockLeaveTypeConfig, id: 'lt-cp', code: 'CP' };
      const rttType = {
        ...mockLeaveTypeConfig,
        id: 'lt-rtt',
        code: 'RTT',
        name: 'RTT',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        cpType,
        rttType,
      ]);
      // resolveAllocatedDays: 25 days for each type
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue({
        totalDays: 25,
      });
      // Single query returns all leaves with status+leaveTypeId.
      // Mon from first week of cy, used for approved CP leave fixture.
      const mon1 = firstMondayOfYear(cy);
      const end1 = addWorkdays(mon1, 5);
      mockPrismaService.leave.findMany.mockResolvedValue([
        {
          startDate: mon1,
          endDate: end1,
          halfDay: null,
          status: 'APPROVED',
          leaveTypeId: 'lt-cp',
        },
      ]);

      await service.getLeaveBalance('user-1');

      // RED before fix: called 4 times (2 per type × 2 types).
      // GREEN after fix: called exactly once (single bulk query).
      expect(mockPrismaService.leave.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // GET BALANCES
  // ============================================
  describe('getBalances', () => {
    it('should return all balances without filters', async () => {
      const mockBalances = [
        {
          id: 'bal-1',
          totalDays: 25,
          leaveType: mockLeaveTypeConfig,
          user: mockUser,
        },
      ];
      mockPrismaService.leaveBalance.findMany.mockResolvedValue(mockBalances);

      const result = await service.getBalances();

      expect(result).toHaveLength(1);
      expect(mockPrismaService.leaveBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should filter by year when provided', async () => {
      mockPrismaService.leaveBalance.findMany.mockResolvedValue([]);

      await service.getBalances(2025);

      expect(mockPrismaService.leaveBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { year: 2025 } }),
      );
    });

    it('should filter by userId when provided as non-null string', async () => {
      mockPrismaService.leaveBalance.findMany.mockResolvedValue([]);

      await service.getBalances(undefined, 'user-1');

      expect(mockPrismaService.leaveBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });

    it('should filter by null userId when "null" string is provided', async () => {
      mockPrismaService.leaveBalance.findMany.mockResolvedValue([]);

      await service.getBalances(undefined, 'null');

      expect(mockPrismaService.leaveBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: null } }),
      );
    });

    it('should filter by both year and userId', async () => {
      mockPrismaService.leaveBalance.findMany.mockResolvedValue([]);

      await service.getBalances(2025, 'user-1');

      expect(mockPrismaService.leaveBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { year: 2025, userId: 'user-1' } }),
      );
    });
  });

  // ============================================
  // GET DEFAULT BALANCES
  // ============================================
  describe('getDefaultBalances', () => {
    it('should return default balances without year filter', async () => {
      const mockBalances = [{ id: 'bal-1', userId: null, totalDays: 25 }];
      mockPrismaService.leaveBalance.findMany.mockResolvedValue(mockBalances);

      const result = await service.getDefaultBalances();

      expect(result).toHaveLength(1);
      expect(mockPrismaService.leaveBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: null } }),
      );
    });

    it('should filter by year when provided', async () => {
      mockPrismaService.leaveBalance.findMany.mockResolvedValue([]);

      await service.getDefaultBalances(2025);

      expect(mockPrismaService.leaveBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: null, year: 2025 } }),
      );
    });
  });

  // ============================================
  // UPSERT BALANCE
  // ============================================
  describe('upsertBalance', () => {
    const baseDto = {
      leaveTypeId: 'leave-type-1',
      year: 2025,
      totalDays: 25,
    };

    it('should throw NotFoundException when leaveType not found', async () => {
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertBalance({ ...baseDto, userId: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when userId provided but user not found', async () => {
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertBalance({ ...baseDto, userId: 'unknown-user' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use leaveBalance.upsert when userId is provided', async () => {
      const upsertedBalance = { id: 'bal-1', userId: 'user-1', totalDays: 25 };
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveBalance.upsert.mockResolvedValue(upsertedBalance);

      const result = await service.upsertBalance({
        ...baseDto,
        userId: 'user-1',
      });

      expect(result).toEqual(upsertedBalance);
      expect(mockPrismaService.leaveBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_leaveTypeId_year: {
              userId: 'user-1',
              leaveTypeId: 'leave-type-1',
              year: 2025,
            },
          },
          create: expect.objectContaining({ totalDays: 25 }),
          update: { totalDays: 25 },
        }),
      );
    });

    it('should update existing global balance when userId is null and balance exists', async () => {
      const existingBalance = { id: 'bal-global', userId: null, totalDays: 20 };
      const updatedBalance = { ...existingBalance, totalDays: 25 };
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leaveBalance.findFirst.mockResolvedValue(
        existingBalance,
      );
      mockPrismaService.leaveBalance.update.mockResolvedValue(updatedBalance);

      const result = await service.upsertBalance({ ...baseDto });

      expect(result).toEqual(updatedBalance);
      expect(mockPrismaService.leaveBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bal-global' },
          data: { totalDays: 25 },
        }),
      );
    });

    it('should create new global balance when userId is null and no existing balance', async () => {
      const createdBalance = { id: 'bal-new', userId: null, totalDays: 25 };
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.leaveBalance.findFirst.mockResolvedValue(null);
      mockPrismaService.leaveBalance.create.mockResolvedValue(createdBalance);

      const result = await service.upsertBalance({ ...baseDto });

      expect(result).toEqual(createdBalance);
      expect(mockPrismaService.leaveBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: null, totalDays: 25 }),
        }),
      );
    });

    // OBS-021 — admin balance adjustments are personal-data writes that must be
    // audited with before/after. Pre-fix upsertBalance emitted nothing.
    it('emits LEAVE_BALANCE_ADJUSTED with before/after on the user-upsert path (OBS-021)', async () => {
      const existing = { totalDays: 10 };
      const upsertedBalance = { id: 'bal-1', userId: 'user-1', totalDays: 25 };
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        mockLeaveTypeConfig,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue(existing);
      mockPrismaService.leaveBalance.upsert.mockResolvedValue(upsertedBalance);

      await service.upsertBalance({ ...baseDto, userId: 'user-1' }, 'admin-1', {
        roleCode: 'ADMIN',
        templateKey: 'ADMIN',
      });

      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistence.log.mock.calls[0][0];
      expect(call.action).toBe('LEAVE_BALANCE_ADJUSTED');
      expect(call.entityType).toBe('Leave');
      expect(call.actorId).toBe('admin-1');
      expect(call.payload.operation).toBe('UPDATE');
      expect(call.payload.before.totalDays).toBe('10');
      expect(call.payload.after.totalDays).toBe('25');
      expect(call.payload.subject).toEqual(
        expect.objectContaining({ userId: 'user-1', year: 2025 }),
      );
    });

    it('does not emit LEAVE_BALANCE_ADJUSTED when the leaveType is unknown (OBS-021)', async () => {
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertBalance({ ...baseDto, userId: 'user-1' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // DELETE BALANCE
  // ============================================
  describe('deleteBalance', () => {
    it('should delete a balance successfully', async () => {
      const balance = { id: 'bal-1', userId: 'user-1', totalDays: 25 };
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue(balance);
      mockPrismaService.leaveBalance.delete.mockResolvedValue(balance);

      const result = await service.deleteBalance('bal-1');

      expect(result).toEqual({ message: 'Solde supprimé avec succès' });
      expect(mockPrismaService.leaveBalance.delete).toHaveBeenCalledWith({
        where: { id: 'bal-1' },
      });
    });

    // OBS-021 — removing a balance override is a balance adjustment; emit with
    // operation DELETE and the prior totalDays as before (after = null).
    it('emits LEAVE_BALANCE_ADJUSTED operation=DELETE with before totalDays (OBS-021)', async () => {
      const balance = {
        id: 'bal-1',
        userId: 'user-1',
        leaveTypeId: 'leave-type-1',
        year: 2025,
        totalDays: 18,
      };
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue(balance);
      mockPrismaService.leaveBalance.delete.mockResolvedValue(balance);

      await service.deleteBalance('bal-1', 'admin-1', { roleCode: 'ADMIN' });

      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistence.log.mock.calls[0][0];
      expect(call.action).toBe('LEAVE_BALANCE_ADJUSTED');
      expect(call.actorId).toBe('admin-1');
      expect(call.payload.operation).toBe('DELETE');
      expect(call.payload.before.totalDays).toBe('18');
      expect(call.payload.after.totalDays).toBeNull();
    });

    it('should throw NotFoundException when balance not found', async () => {
      mockPrismaService.leaveBalance.findUnique.mockResolvedValue(null);

      await expect(service.deleteBalance('nonexistent')).rejects.toThrow(
        NotFoundException,
      );

      // OBS-021 — no audit row when the balance does not exist.
      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // GET IMPORT TEMPLATE
  // ============================================
  describe('getImportTemplate', () => {
    it('should return a CSV template string with headers and example rows', () => {
      const result = service.getImportTemplate();

      expect(typeof result).toBe('string');
      // Validate headers are present
      const lines = result.split('\n');
      expect(lines.length).toBe(3);
      expect(lines[0]).toContain('userEmail');
      expect(lines[0]).toContain('leaveTypeName');
      expect(lines[0]).toContain('startDate');
      expect(lines[0]).toContain('endDate');
      expect(lines[0]).toContain('halfDay');
      expect(lines[0]).toContain('comment');
      // Delimiters are semicolons
      expect(lines[0]).toContain(';');
    });
  });

  // ============================================
  // VALIDATE LEAVES IMPORT
  // ============================================
  describe('validateLeavesImport', () => {
    const activeUser = {
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };
    const activeLeaveType = {
      id: 'lt-1',
      name: 'Congé Payé',
      code: 'CP',
    };

    beforeEach(() => {
      mockPrismaService.user.findMany.mockResolvedValue([activeUser]);
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        activeLeaveType,
      ]);
      mockPrismaService.leave.findMany.mockResolvedValue([]);
    });

    it('should return error when userEmail is missing', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: '',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
        },
      ]);

      expect(result.summary.errors).toBe(1);
      expect(result.errors[0].messages[0]).toMatch(/email/i);
    });

    it('should return error when leaveTypeName is missing', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: '',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
        },
      ]);

      expect(result.summary.errors).toBe(1);
      expect(result.errors[0].messages[0]).toMatch(/type de congé/i);
    });

    it('should return error when startDate is missing', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '',
          endDate: '2026-03-05',
        },
      ]);

      expect(result.summary.errors).toBe(1);
      expect(result.errors[0].messages[0]).toMatch(/début/i);
    });

    it('should return error when endDate is missing', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: '',
        },
      ]);

      expect(result.summary.errors).toBe(1);
      expect(result.errors[0].messages[0]).toMatch(/fin/i);
    });

    it('should return error when user email is not found', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.validateLeavesImport([
        {
          userEmail: 'unknown@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
        },
      ]);

      expect(result.summary.errors).toBe(1);
      expect(result.errors[0].messages[0]).toMatch(/introuvable/i);
    });

    it('should return error when leave type name is not found', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Type Inconnu',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
        },
      ]);

      expect(result.summary.errors).toBe(1);
      expect(result.errors[0].messages[0]).toMatch(/introuvable/i);
    });

    it('should return error when startDate is invalid format', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: 'not-a-date',
          endDate: '2026-03-05',
        },
      ]);

      expect(result.summary.errors).toBe(1);
      expect(result.errors[0].messages[0]).toMatch(/invalide/i);
    });

    it('should return error when endDate is invalid format', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: 'not-a-date',
        },
      ]);

      expect(result.summary.errors).toBe(1);
      expect(result.errors[0].messages[0]).toMatch(/invalide/i);
    });

    it('should return error when endDate is before startDate', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-10',
          endDate: '2026-03-05',
        },
      ]);

      expect(result.summary.errors).toBe(1);
      expect(result.errors[0].messages[0]).toMatch(/postérieure/i);
    });

    it('should return warning when halfDay is set for multi-day leave', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
          halfDay: 'MORNING',
        },
      ]);

      expect(result.summary.warnings).toBe(1);
      expect(result.warnings[0].messages[0]).toMatch(/ignoré/i);
    });

    it('should NOT warn about halfDay when startDate and endDate are the same Paris calendar day but different UTC instants (COR-023)', async () => {
      // Same Paris calendar day (2026-03-01, UTC+1 in March),
      // but different UTC instants → getTime() differs.
      // The bug: getTime() comparison wrongly triggers the "multi-day" warning.
      // The fix: parisDayKey comparison correctly sees them as the same day.
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01T00:00:00.000Z',
          endDate: '2026-03-01T12:00:00.000Z',
          halfDay: 'MORNING',
        },
      ]);

      expect(result.summary.warnings).toBe(0);
      expect(result.summary.valid).toBe(1);
    });

    it('should return duplicate when overlap with existing leave', async () => {
      // Existing leave overlaps with the request range
      mockPrismaService.leave.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-03-10'),
        },
      ]);

      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-03',
          endDate: '2026-03-05',
        },
      ]);

      expect(result.summary.duplicates).toBe(1);
      expect(result.duplicates[0].messages[0]).toMatch(/chevauchement/i);
    });

    it('should return duplicate when overlap detected within the same file', async () => {
      // First entry is valid, second overlaps with first
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
        },
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-03',
          endDate: '2026-03-07',
        },
      ]);

      expect(result.summary.valid).toBe(1);
      expect(result.summary.duplicates).toBe(1);
      expect(result.duplicates[0].messages[0]).toMatch(/fichier/i);
    });

    it('should mark item as valid when all fields are correct', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
        },
      ]);

      expect(result.summary.valid).toBe(1);
      expect(result.summary.errors).toBe(0);
      expect(result.valid[0].resolvedUser?.id).toBe('user-1');
      expect(result.valid[0].resolvedLeaveType?.id).toBe('lt-1');
    });

    it('should return correct summary totals for mixed entries', async () => {
      const result = await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
        },
        {
          userEmail: '',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
        },
      ]);

      expect(result.summary.total).toBe(2);
      expect(result.summary.valid).toBe(1);
      expect(result.summary.errors).toBe(1);
    });

    // PER-009 — projection + date-span filter
    it('PER-009: user.findMany should use select projection (no passwordHash leak)', async () => {
      await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
        },
      ]);

      const userFindManyCall = mockPrismaService.user.findMany.mock.calls[0][0];
      // Must have a select clause projecting only safe fields
      expect(userFindManyCall).toHaveProperty('select');
      expect(userFindManyCall.select).toHaveProperty('id', true);
      expect(userFindManyCall.select).toHaveProperty('email', true);
      expect(userFindManyCall.select).toHaveProperty('firstName', true);
      expect(userFindManyCall.select).toHaveProperty('lastName', true);
      // Must NOT expose passwordHash
      expect(userFindManyCall.select).not.toHaveProperty('passwordHash');
    });

    it('PER-009: leave.findMany should include date-span filter matching CSV rows', async () => {
      await service.validateLeavesImport([
        {
          userEmail: 'user@example.com',
          leaveTypeName: 'Congé Payé',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
        },
      ]);

      const leaveFindManyCall =
        mockPrismaService.leave.findMany.mock.calls[0][0];
      // Must restrict to the date span of the uploaded CSV rows
      expect(leaveFindManyCall.where).toHaveProperty('startDate');
      expect(leaveFindManyCall.where).toHaveProperty('endDate');
    });
  });

  // ============================================
  // IMPORT LEAVES
  // ============================================
  describe('importLeaves', () => {
    const activeUser = {
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      department: {
        id: 'dept-1',
        managerId: 'manager-1',
        manager: { id: 'manager-1' },
      },
    };

    const activeLeaveTypeRequiresApproval = {
      id: 'lt-1',
      name: 'Congé Payé',
      code: 'CP',
      requiresApproval: true,
    };

    const activeLeaveTypeNoApproval = {
      id: 'lt-2',
      name: 'RTT',
      code: 'RTT',
      requiresApproval: false,
    };

    beforeEach(() => {
      mockPrismaService.user.findMany.mockResolvedValue([activeUser]);
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        activeLeaveTypeRequiresApproval,
      ]);
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.role.findMany.mockResolvedValue([]);
      mockPrismaService.leave.create.mockResolvedValue({ id: 'leave-new' });
    });

    it('should skip when user email not found', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.importLeaves(
        [
          {
            userEmail: 'unknown@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-03-01',
            endDate: '2026-03-05',
          },
        ],
        'admin-1',
      );

      expect(result.skipped).toBe(1);
      expect(result.errorDetails[0]).toMatch(/introuvable/i);
    });

    it('should skip when leave type name not found', async () => {
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([]);

      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Type Inconnu',
            startDate: '2026-03-01',
            endDate: '2026-03-05',
          },
        ],
        'admin-1',
      );

      expect(result.skipped).toBe(1);
      expect(result.errorDetails[0]).toMatch(/introuvable/i);
    });

    it('should skip when dates are invalid', async () => {
      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: 'invalid',
            endDate: '2026-03-05',
          },
        ],
        'admin-1',
      );

      expect(result.skipped).toBe(1);
      expect(result.errorDetails[0]).toMatch(/invalide/i);
    });

    it('should skip when endDate is before startDate', async () => {
      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-03-10',
            endDate: '2026-03-05',
          },
        ],
        'admin-1',
      );

      expect(result.skipped).toBe(1);
      expect(result.errorDetails[0]).toMatch(/antérieure/i);
    });

    it('should skip when overlap with existing leave', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-03-10'),
        },
      ]);

      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-03-03',
            endDate: '2026-03-05',
          },
        ],
        'admin-1',
      );

      expect(result.skipped).toBe(1);
      expect(result.errorDetails[0]).toMatch(/chevauchement/i);
    });

    it('should skip second entry when overlap detected in file', async () => {
      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-03-01',
            endDate: '2026-03-05',
          },
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-03-03',
            endDate: '2026-03-07',
          },
        ],
        'admin-1',
      );

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errorDetails[0]).toMatch(/fichier/i);
    });

    it('should create leave with PENDING status when requiresApproval is true', async () => {
      // findValidatorForUser: user.findUnique returns user with department.managerId
      mockPrismaService.user.findUnique.mockResolvedValue(activeUser);

      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-03-03',
            endDate: '2026-03-05',
          },
        ],
        'admin-1',
      );

      expect(result.created).toBe(1);
      expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            validatorId: 'manager-1',
          }),
        }),
      );
    });

    it('should create leave with APPROVED status when requiresApproval is false', async () => {
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        activeLeaveTypeNoApproval,
      ]);

      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'RTT',
            startDate: '2026-03-03',
            endDate: '2026-03-05',
          },
        ],
        'admin-1',
      );

      expect(result.created).toBe(1);
      expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            validatorId: null,
          }),
        }),
      );
    });

    it('should use LeaveType.OTHER for unknown enum code', async () => {
      const leaveTypeUnknownCode = {
        id: 'lt-x',
        name: 'Congé Spécial',
        code: 'UNKNOWN_CODE',
        requiresApproval: false,
      };
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        leaveTypeUnknownCode,
      ]);

      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Spécial',
            startDate: '2026-03-03',
            endDate: '2026-03-05',
          },
        ],
        'admin-1',
      );

      expect(result.created).toBe(1);
      expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: LeaveType.OTHER }),
        }),
      );
    });

    it('COR-021 — importLeaves logs a warn when leaveType.code is not a known LeaveType enum value', async () => {
      // The fallback silently maps unknown codes to OTHER in importLeaves.
      // This test asserts that a Logger.warn is emitted so the
      // misconfiguration is surfaced without blocking import.
      const { Logger } = await import('@nestjs/common');
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {});

      const leaveTypeUnknownCode = {
        id: 'lt-x',
        name: 'Congé Spécial',
        code: 'UNKNOWN_IMPORT_CODE',
        requiresApproval: false,
      };
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([
        leaveTypeUnknownCode,
      ]);

      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Spécial',
            startDate: '2026-03-03',
            endDate: '2026-03-05',
          },
        ],
        'admin-1',
      );

      expect(result.created).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('UNKNOWN_IMPORT_CODE'),
      );

      warnSpy.mockRestore();
    });

    it('should apply halfDay MORNING for single-day leave', async () => {
      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-03-03',
            endDate: '2026-03-03',
            halfDay: 'MORNING',
          },
        ],
        'admin-1',
      );

      expect(result.created).toBe(1);
      expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ halfDay: 'MORNING', days: 0.5 }),
        }),
      );
    });

    it('should ignore halfDay when leave spans multiple days', async () => {
      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-03-03',
            endDate: '2026-03-05',
            halfDay: 'MORNING',
          },
        ],
        'admin-1',
      );

      expect(result.created).toBe(1);
      // halfDay should be null/undefined for multi-day, and days should be > 0.5
      expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ halfDay: undefined }),
        }),
      );
    });

    it('should increment errors and capture message when leave.create throws', async () => {
      mockPrismaService.leave.create.mockRejectedValue(new Error('DB error'));

      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-03-03',
            endDate: '2026-03-05',
          },
        ],
        'admin-1',
      );

      expect(result.errors).toBe(1);
      expect(result.errorDetails[0]).toMatch(/DB error/i);
    });

    it('should return summary with correct created/skipped/errors counts', async () => {
      const result = await service.importLeaves([], 'admin-1');

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.errorDetails).toHaveLength(0);
    });

    // COR-024 — atomicity: a mid-import failure must abort the whole batch.
    // Pre-fix: the loop uses bare prisma.leave.create with no $transaction, so
    // rows created before the failure are persisted (no rollback).
    // Post-fix: the loop runs inside $transaction; a failure propagates and
    // the whole transaction is rolled back, leaving result.created === 0.
    it('COR-024: rolls back all created rows when a mid-import create fails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(activeUser);

      // First create succeeds, second throws — simulates partial failure.
      mockPrismaService.leave.create
        .mockResolvedValueOnce({ id: 'leave-1' })
        .mockRejectedValueOnce(new Error('mid-import DB error'));

      const result = await service.importLeaves(
        [
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-03-03',
            endDate: '2026-03-05',
          },
          {
            userEmail: 'user@example.com',
            leaveTypeName: 'Congé Payé',
            startDate: '2026-04-07',
            endDate: '2026-04-09',
          },
        ],
        'admin-1',
      );

      // The whole import must be wrapped in $transaction.
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      // The whole import must be rejected on mid-import failure — 0 created.
      expect(result.created).toBe(0);
      expect(result.errors).toBeGreaterThan(0);
    });
  });

  // PER-015 — getServiceIds memoization: second call with shared memo must
  // not fire additional DB queries (query-count drops from 4 to 2).
  describe('getServiceIds memoization (PER-015)', () => {
    it('fires DB queries only once when the same userId is requested twice with a shared memo', async () => {
      mockPrismaService.service.findMany.mockResolvedValue([{ id: 'svc-1' }]);
      mockPrismaService.userService.findMany.mockResolvedValue([
        { serviceId: 'svc-2' },
      ]);

      const memo = new Map<string, string[]>();

      // First call — hits the DB
      const ids1 = await (service as any).getServiceIds('user-memo-1', memo);
      // Second call with the same memo — must use the cache, no DB hit
      const ids2 = await (service as any).getServiceIds('user-memo-1', memo);

      expect(ids1).toEqual(ids2);
      // With memoization: each of the 2 DB queries fires exactly once
      expect(mockPrismaService.service.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.userService.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
