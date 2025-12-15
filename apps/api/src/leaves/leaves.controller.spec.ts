import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('LeavesController', () => {
  let controller: LeavesController;
  let leavesService: LeavesService;

  const mockLeave = {
    id: 'leave-id-1',
    userId: 'user-id-1',
    leaveTypeId: 'leave-type-1',
    type: 'CP',
    startDate: new Date('2025-01-15'),
    endDate: new Date('2025-01-20'),
    days: 4,
    status: 'PENDING',
    comment: 'Vacances',
    validatorId: 'manager-id-1',
    validatedById: null,
    validatedAt: null,
    validationComment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-id-1',
      firstName: 'John',
      lastName: 'Doe',
    },
    leaveType: {
      id: 'leave-type-1',
      code: 'CP',
      name: 'Congés payés',
      color: '#10B981',
    },
  };

  const mockLeavesService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getUserLeaves: vi.fn(),
    getLeaveBalance: vi.fn(),
    getPendingForValidator: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    cancel: vi.fn(),
    createDelegation: vi.fn(),
    getDelegations: vi.fn(),
    deactivateDelegation: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeavesController],
      providers: [
        {
          provide: LeavesService,
          useValue: mockLeavesService,
        },
      ],
    }).compile();

    controller = module.get<LeavesController>(LeavesController);
    leavesService = module.get<LeavesService>(LeavesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createLeaveDto = {
      leaveTypeId: 'leave-type-1',
      startDate: '2025-01-15',
      endDate: '2025-01-20',
      comment: 'Vacances',
    };

    it('should create a leave request successfully', async () => {
      mockLeavesService.create.mockResolvedValue(mockLeave);

      const result = await controller.create('user-id-1', createLeaveDto);

      expect(result).toEqual(mockLeave);
      expect(mockLeavesService.create).toHaveBeenCalledWith('user-id-1', createLeaveDto);
      expect(mockLeavesService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException on insufficient balance', async () => {
      mockLeavesService.create.mockRejectedValue(
        new BadRequestException('Solde de congés insuffisant')
      );

      await expect(controller.create('user-id-1', createLeaveDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException on date overlap', async () => {
      mockLeavesService.create.mockRejectedValue(
        new BadRequestException('Chevauchement avec une demande existante')
      );

      await expect(controller.create('user-id-1', createLeaveDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated leave requests', async () => {
      const paginatedResult = {
        data: [mockLeave],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockLeavesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockLeavesService.findAll).toHaveBeenCalledWith(
        1, 10, undefined, undefined, undefined, undefined, undefined
      );
    });

    it('should filter by status', async () => {
      const pendingLeaves = {
        data: [mockLeave],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockLeavesService.findAll.mockResolvedValue(pendingLeaves);

      const result = await controller.findAll(1, 10, undefined, 'PENDING' as any);

      expect(result.data[0].status).toBe('PENDING');
      expect(mockLeavesService.findAll).toHaveBeenCalledWith(
        1, 10, undefined, 'PENDING', undefined, undefined, undefined
      );
    });

    it('should filter by userId', async () => {
      const userLeaves = {
        data: [mockLeave],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockLeavesService.findAll.mockResolvedValue(userLeaves);

      await controller.findAll(1, 10, 'user-id-1');

      expect(mockLeavesService.findAll).toHaveBeenCalledWith(
        1, 10, 'user-id-1', undefined, undefined, undefined, undefined
      );
    });

    it('should filter by date range', async () => {
      mockLeavesService.findAll.mockResolvedValue({
        data: [mockLeave],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      await controller.findAll(1, 10, undefined, undefined, undefined, '2025-01-01', '2025-01-31');

      expect(mockLeavesService.findAll).toHaveBeenCalledWith(
        1, 10, undefined, undefined, undefined, '2025-01-01', '2025-01-31'
      );
    });
  });

  describe('findOne', () => {
    it('should return a leave request by id', async () => {
      mockLeavesService.findOne.mockResolvedValue(mockLeave);

      const result = await controller.findOne('leave-id-1');

      expect(result).toEqual(mockLeave);
      expect(mockLeavesService.findOne).toHaveBeenCalledWith('leave-id-1');
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockLeavesService.findOne.mockRejectedValue(
        new NotFoundException('Demande de congé introuvable')
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyLeaves', () => {
    it('should return leaves for current user', async () => {
      const userLeaves = [mockLeave];
      mockLeavesService.getUserLeaves.mockResolvedValue(userLeaves);

      const result = await controller.getMyLeaves('user-id-1');

      expect(result).toEqual(userLeaves);
      expect(mockLeavesService.getUserLeaves).toHaveBeenCalledWith('user-id-1');
    });
  });

  describe('getMyBalance', () => {
    it('should return leave balance for current user', async () => {
      const balance = {
        total: 25,
        used: 5,
        pending: 4,
        available: 16,
        byType: [
          { type: 'CP', total: 25, used: 5, pending: 4, available: 16 },
        ],
      };

      mockLeavesService.getLeaveBalance.mockResolvedValue(balance);

      const result = await controller.getMyBalance('user-id-1');

      expect(result).toEqual(balance);
      expect(mockLeavesService.getLeaveBalance).toHaveBeenCalledWith('user-id-1');
    });
  });

  describe('getUserBalance', () => {
    it('should return leave balance for specified user (admin)', async () => {
      const balance = {
        total: 25,
        used: 10,
        pending: 0,
        available: 15,
      };

      mockLeavesService.getLeaveBalance.mockResolvedValue(balance);

      const result = await controller.getUserBalance('user-id-2');

      expect(result).toEqual(balance);
      expect(mockLeavesService.getLeaveBalance).toHaveBeenCalledWith('user-id-2');
    });
  });

  describe('getPendingForValidation', () => {
    it('should return pending leaves for validator', async () => {
      const pendingLeaves = [mockLeave];
      mockLeavesService.getPendingForValidator.mockResolvedValue(pendingLeaves);

      const result = await controller.getPendingForValidation('manager-id-1');

      expect(result).toEqual(pendingLeaves);
      expect(mockLeavesService.getPendingForValidator).toHaveBeenCalledWith('manager-id-1');
    });
  });

  describe('update', () => {
    const updateLeaveDto = {
      comment: 'Updated comment',
    };

    it('should update a pending leave request', async () => {
      const updatedLeave = { ...mockLeave, comment: 'Updated comment' };
      mockLeavesService.update.mockResolvedValue(updatedLeave);

      const result = await controller.update('leave-id-1', updateLeaveDto);

      expect(result.comment).toBe('Updated comment');
      expect(mockLeavesService.update).toHaveBeenCalledWith('leave-id-1', updateLeaveDto);
    });

    it('should throw BadRequestException when leave is not pending', async () => {
      mockLeavesService.update.mockRejectedValue(
        new BadRequestException('Seules les demandes en attente peuvent être modifiées')
      );

      await expect(controller.update('leave-id-1', updateLeaveDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException when leave not found', async () => {
      mockLeavesService.update.mockRejectedValue(
        new NotFoundException('Demande de congé introuvable')
      );

      await expect(controller.update('nonexistent', updateLeaveDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('should delete a pending leave request', async () => {
      mockLeavesService.remove.mockResolvedValue({ message: 'Demande supprimée' });

      const result = await controller.remove('leave-id-1');

      expect(result.message).toBe('Demande supprimée');
      expect(mockLeavesService.remove).toHaveBeenCalledWith('leave-id-1');
    });

    it('should throw BadRequestException when leave cannot be deleted', async () => {
      mockLeavesService.remove.mockRejectedValue(
        new BadRequestException('Impossible de supprimer cette demande')
      );

      await expect(controller.remove('leave-id-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should approve a pending leave request', async () => {
      const approvedLeave = { ...mockLeave, status: 'APPROVED', validatedById: 'manager-id-1' };
      mockLeavesService.approve.mockResolvedValue(approvedLeave);

      const result = await controller.approve('leave-id-1', 'manager-id-1', 'Approuvé');

      expect(result.status).toBe('APPROVED');
      expect(mockLeavesService.approve).toHaveBeenCalledWith('leave-id-1', 'manager-id-1', 'Approuvé');
    });

    it('should throw ForbiddenException when not authorized', async () => {
      mockLeavesService.approve.mockRejectedValue(
        new ForbiddenException('Vous n\'êtes pas autorisé à valider cette demande')
      );

      await expect(controller.approve('leave-id-1', 'other-user', undefined)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw BadRequestException when leave is not pending', async () => {
      mockLeavesService.approve.mockRejectedValue(
        new BadRequestException('Seules les demandes en attente peuvent être approuvées')
      );

      await expect(controller.approve('leave-id-1', 'manager-id-1', undefined)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('reject', () => {
    it('should reject a pending leave request', async () => {
      const rejectedLeave = { ...mockLeave, status: 'REJECTED', validatedById: 'manager-id-1' };
      mockLeavesService.reject.mockResolvedValue(rejectedLeave);

      const result = await controller.reject('leave-id-1', 'manager-id-1', 'Non disponible');

      expect(result.status).toBe('REJECTED');
      expect(mockLeavesService.reject).toHaveBeenCalledWith('leave-id-1', 'manager-id-1', 'Non disponible');
    });

    it('should throw ForbiddenException when not authorized', async () => {
      mockLeavesService.reject.mockRejectedValue(
        new ForbiddenException('Vous n\'êtes pas autorisé à valider cette demande')
      );

      await expect(controller.reject('leave-id-1', 'other-user', undefined)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('cancel', () => {
    it('should cancel an approved leave request', async () => {
      const cancelledLeave = { ...mockLeave, status: 'PENDING' };
      mockLeavesService.cancel.mockResolvedValue(cancelledLeave);

      const result = await controller.cancel('leave-id-1');

      expect(mockLeavesService.cancel).toHaveBeenCalledWith('leave-id-1');
    });

    it('should throw BadRequestException when leave is not approved', async () => {
      mockLeavesService.cancel.mockRejectedValue(
        new BadRequestException('Seules les demandes approuvées peuvent être annulées')
      );

      await expect(controller.cancel('leave-id-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createDelegation', () => {
    it('should create a validation delegation', async () => {
      const delegation = {
        id: 'delegation-id-1',
        delegatorId: 'manager-id-1',
        delegateId: 'other-manager-id',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-15'),
        isActive: true,
      };

      mockLeavesService.createDelegation.mockResolvedValue(delegation);

      const result = await controller.createDelegation(
        'manager-id-1',
        'other-manager-id',
        '2025-01-01',
        '2025-01-15'
      );

      expect(result).toEqual(delegation);
      expect(mockLeavesService.createDelegation).toHaveBeenCalledWith(
        'manager-id-1',
        'other-manager-id',
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should throw BadRequestException on invalid dates', async () => {
      mockLeavesService.createDelegation.mockRejectedValue(
        new BadRequestException('Dates invalides')
      );

      await expect(
        controller.createDelegation('manager-id-1', 'other-manager-id', '2025-01-15', '2025-01-01')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyDelegations', () => {
    it('should return user delegations', async () => {
      const delegations = {
        given: [
          {
            id: 'delegation-1',
            delegateId: 'other-user',
            startDate: new Date(),
            endDate: new Date(),
          },
        ],
        received: [],
      };

      mockLeavesService.getDelegations.mockResolvedValue(delegations);

      const result = await controller.getMyDelegations('manager-id-1');

      expect(result).toEqual(delegations);
      expect(mockLeavesService.getDelegations).toHaveBeenCalledWith('manager-id-1');
    });
  });

  describe('deactivateDelegation', () => {
    it('should deactivate a delegation', async () => {
      mockLeavesService.deactivateDelegation.mockResolvedValue({
        message: 'Délégation désactivée',
      });

      const result = await controller.deactivateDelegation('delegation-id-1', 'manager-id-1');

      expect(result.message).toBe('Délégation désactivée');
      expect(mockLeavesService.deactivateDelegation).toHaveBeenCalledWith(
        'delegation-id-1',
        'manager-id-1'
      );
    });

    it('should throw ForbiddenException when not authorized', async () => {
      mockLeavesService.deactivateDelegation.mockRejectedValue(
        new ForbiddenException('Vous n\'êtes pas autorisé à désactiver cette délégation')
      );

      await expect(
        controller.deactivateDelegation('delegation-id-1', 'other-user')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when delegation not found', async () => {
      mockLeavesService.deactivateDelegation.mockRejectedValue(
        new NotFoundException('Délégation introuvable')
      );

      await expect(
        controller.deactivateDelegation('nonexistent', 'manager-id-1')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
