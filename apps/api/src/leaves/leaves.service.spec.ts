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

describe('LeavesService', () => {
  let service: LeavesService;

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
    },
    leaveTypeConfig: {
      findUnique: vi.fn(),
    },
    leaveValidationDelegate: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
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
    isActive: true,
    requiresApproval: true,
    maxDaysPerYear: null,
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
      ],
    }).compile();

    service = module.get<LeavesService>(LeavesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
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
      mockPrismaService.leave.findMany.mockResolvedValue([]); // No overlap
      mockPrismaService.leave.create.mockResolvedValue(mockLeave);
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );

      const result = await service.create('user-1', createLeaveDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(mockPrismaService.leave.create).toHaveBeenCalled();
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

    it('should throw BadRequestException when CP balance is insufficient', async () => {
      const cpLeaveType = { ...mockLeaveTypeConfig, code: 'CP' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        cpLeaveType,
      );
      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([]) // No overlap
        .mockResolvedValueOnce([{ days: 24 }]); // 24 days already used, only 1 available

      await expect(service.create('user-1', createLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when annual limit is exceeded', async () => {
      const limitedLeaveType = {
        ...mockLeaveTypeConfig,
        code: 'RTT',
        maxDaysPerYear: 10,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        limitedLeaveType,
      );
      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([]) // No overlap
        .mockResolvedValueOnce([{ days: 8 }]); // 8 days already used, requesting 5, limit is 10

      await expect(service.create('user-1', createLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create leave without approval when not required', async () => {
      const noApprovalLeaveType = {
        ...mockLeaveTypeConfig,
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
      mockPrismaService.leave.findMany.mockResolvedValue([]);
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
      mockPrismaService.leave.findMany.mockResolvedValue([]);
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
      mockPrismaService.leave.findMany.mockResolvedValue([]);
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
      mockPrismaService.leave.findMany.mockResolvedValue([]);
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

    it('should use provided type when specified', async () => {
      const dtoWithType = { ...createLeaveDto, type: LeaveType.RTT };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue({
        ...mockLeaveTypeConfig,
        code: 'OTHER',
      });
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.leave.create.mockResolvedValue({
        ...mockLeave,
        type: LeaveType.RTT,
      });

      const result = await service.create('user-1', dtoWithType);

      expect(result).toBeDefined();
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

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by userId', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);
      mockPrismaService.leave.count.mockResolvedValue(1);

      await service.findAll(1, 10, 'user-1');

      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, LeaveStatus.PENDING);

      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: LeaveStatus.PENDING }),
        }),
      );
    });

    it('should filter by type', async () => {
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, undefined, LeaveType.CP);

      expect(mockPrismaService.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: LeaveType.CP }),
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
      );

      // Returns array directly when filtering by dates
      expect(Array.isArray(result)).toBe(true);
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
      );

      expect(Array.isArray(result)).toBe(true);
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
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================
  // GET PENDING FOR VALIDATOR
  // ============================================
  describe('getPendingForValidator', () => {
    it('should return pending leaves for ADMIN', async () => {
      const adminUser = { ...mockUser, role: Role.ADMIN };
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(adminUser);
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);

      const result = await service.getPendingForValidator('admin-1');

      expect(result).toHaveLength(1);
    });

    it('should return pending leaves for RESPONSABLE', async () => {
      const responsableUser = { ...mockUser, role: Role.RESPONSABLE };
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(responsableUser);
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);

      const result = await service.getPendingForValidator('responsable-1');

      expect(result).toHaveLength(1);
    });

    it('should return pending leaves for MANAGER', async () => {
      const managerUser = { ...mockUser, role: Role.MANAGER };
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(managerUser);
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);

      const result = await service.getPendingForValidator('manager-1');

      expect(result).toHaveLength(1);
    });

    it('should return pending leaves for active delegate', async () => {
      const today = new Date();
      const activeDelegation = {
        id: 'delegation-1',
        isActive: true,
        startDate: new Date(today.getTime() - 86400000),
        endDate: new Date(today.getTime() + 86400000),
      };

      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        activeDelegation,
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.CONTRIBUTEUR,
      });
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);

      const result = await service.getPendingForValidator('delegate-1');

      expect(result).toHaveLength(1);
    });

    it('should return empty array for user without validation rights', async () => {
      mockPrismaService.leaveValidationDelegate.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.CONTRIBUTEUR,
      });

      const result = await service.getPendingForValidator('user-1');

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // GET USER LEAVES
  // ============================================
  describe('getUserLeaves', () => {
    it('should return user leaves', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leave.findMany.mockResolvedValue([mockLeave]);

      const result = await service.getUserLeaves('user-1');

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserLeaves('nonexistent')).rejects.toThrow(
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

      const result = await service.findOne('leave-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('leave-1');
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
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

      const result = await service.update('leave-1', updateDto);

      expect(result.comment).toBe('Updated reason');
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when leave is not pending', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

      await expect(service.update('leave-1', updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when end date is before start date', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);

      const invalidDto = { startDate: '2025-06-10', endDate: '2025-06-05' };

      await expect(service.update('leave-1', invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when update causes overlap', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.leave.findMany.mockResolvedValue([
        { id: 'other-leave' },
      ]); // Overlap

      const dateDto = { startDate: '2025-06-10', endDate: '2025-06-15' };

      await expect(service.update('leave-1', dateDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when CP balance is insufficient for additional days', async () => {
      const cpLeave = {
        ...mockLeave,
        status: LeaveStatus.PENDING,
        type: LeaveType.CP,
        days: 3,
      };
      mockPrismaService.leave.findUnique.mockResolvedValue(cpLeave);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([]) // No overlap
        .mockResolvedValueOnce([{ days: 24 }]); // Balance check - 24 used, 1 available

      const dateDto = { startDate: '2025-06-02', endDate: '2025-06-20' }; // More days requested

      await expect(service.update('leave-1', dateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update dates successfully', async () => {
      const pendingLeave = { ...mockLeave, status: LeaveStatus.PENDING };
      const updatedLeave = {
        ...pendingLeave,
        startDate: new Date('2025-06-09'),
        endDate: new Date('2025-06-13'),
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
      mockPrismaService.leave.findMany.mockResolvedValue([]); // No overlap
      mockPrismaService.leave.update.mockResolvedValue(updatedLeave);

      const result = await service.update('leave-1', {
        startDate: '2025-06-09',
        endDate: '2025-06-13',
      });

      expect(result).toBeDefined();
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

      const result = await service.remove('leave-1');

      expect(result.message).toBe('Demande de congé supprimée avec succès');
    });

    it('should delete a rejected leave request', async () => {
      const rejectedLeave = { ...mockLeave, status: LeaveStatus.REJECTED };
      mockPrismaService.leave.findUnique.mockResolvedValue(rejectedLeave);
      mockPrismaService.leave.delete.mockResolvedValue(rejectedLeave);

      const result = await service.remove('leave-1');

      expect(result.message).toBe('Demande de congé supprimée avec succès');
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when leave is approved', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

      await expect(service.remove('leave-1')).rejects.toThrow(
        BadRequestException,
      );
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
  });

  // ============================================
  // CANCEL
  // ============================================
  describe('cancel', () => {
    it('should cancel an approved leave', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      const cancelledLeave = { ...approvedLeave, status: LeaveStatus.REJECTED };

      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
      mockPrismaService.leave.update.mockResolvedValue(cancelledLeave);

      const result = await service.cancel('leave-1');

      expect(result.status).toBe(LeaveStatus.REJECTED);
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
  });

  // ============================================
  // CREATE DELEGATION
  // ============================================
  describe('createDelegation', () => {
    const startDate = new Date('2025-06-01');
    const endDate = new Date('2025-06-15');

    it('should create a delegation successfully', async () => {
      const delegator = { ...mockUser, id: 'manager-1', role: Role.MANAGER };
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
      const manager = { ...mockUser, role: Role.MANAGER };
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
      const manager = { ...mockUser, role: Role.MANAGER };
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
      const manager = { ...mockUser, role: Role.MANAGER };
      const delegate = { ...mockUser, isActive: true };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(manager)
        .mockResolvedValueOnce(delegate);

      await expect(
        service.createDelegation('manager-1', 'delegate-1', endDate, startDate),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow ADMIN to create delegation', async () => {
      const admin = { ...mockUser, role: Role.ADMIN };
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
      const responsable = { ...mockUser, role: Role.RESPONSABLE };
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
        role: Role.ADMIN,
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
    it('should return leave balance for user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leave.findMany.mockResolvedValue([
        { days: 10 },
        { days: 5 },
      ]);

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
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([{ days: 30 }]) // Approved leaves
        .mockResolvedValueOnce([]); // Pending leaves

      const result = await service.getLeaveBalance('user-1');

      expect(result.available).toBe(0);
    });

    it('should include pending days', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leave.findMany
        .mockResolvedValueOnce([{ days: 10 }]) // Approved leaves
        .mockResolvedValueOnce([{ days: 3 }, { days: 2 }]); // Pending leaves

      const result = await service.getLeaveBalance('user-1');

      expect(result.pending).toBe(5);
    });
  });
});
