import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeaveTypesService', () => {
  let service: LeaveTypesService;

  const mockPrismaService = {
    leaveTypeConfig: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      $transaction: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const makeLeaveType = (overrides = {}) => ({
    id: 'lt-1',
    code: 'CP',
    name: 'Congés Payés',
    description: null,
    color: '#10B981',
    icon: '🌴',
    isPaid: true,
    requiresApproval: true,
    sortOrder: 0,
    isSystem: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { leaves: 0 },
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveTypesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LeaveTypesService>(LeaveTypesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a non-system leave type', async () => {
      const dto = { code: 'CP', name: 'Congés Payés' };
      const created = makeLeaveType();
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(null);
      mockPrismaService.leaveTypeConfig.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result.isSystem).toBe(false);
      expect(result.code).toBe('CP');
    });

    it('should throw ConflictException when code already exists', async () => {
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        makeLeaveType(),
      );

      await expect(
        service.create({ code: 'CP', name: 'Duplicate' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return only active leave types by default', async () => {
      const types = [makeLeaveType()];
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue(types);

      const result = await service.findAll();

      expect(mockPrismaService.leaveTypeConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should include inactive when includeInactive=true', async () => {
      mockPrismaService.leaveTypeConfig.findMany.mockResolvedValue([]);

      await service.findAll(true);

      expect(mockPrismaService.leaveTypeConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a leave type by id', async () => {
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        makeLeaveType(),
      );

      const result = await service.findOne('lt-1');

      expect(result.id).toBe('lt-1');
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(null);

      await expect(service.findOne('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a non-system leave type', async () => {
      const existing = makeLeaveType();
      const updated = makeLeaveType({ name: 'Renamed' });
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(existing);
      mockPrismaService.leaveTypeConfig.update.mockResolvedValue(updated);

      const result = await service.update('lt-1', { name: 'Renamed' });

      expect(result.name).toBe('Renamed');
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.update('ghost', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw BadRequestException when modifying forbidden system fields', async () => {
      const systemType = makeLeaveType({ isSystem: true });
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        systemType,
      );

      // 'code' is not in the allowed fields for system types
      await expect(
        service.update('lt-1', { code: 'NEW_CODE' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should allow updating display fields on system types', async () => {
      const systemType = makeLeaveType({ isSystem: true });
      const updated = makeLeaveType({ isSystem: true, name: 'New Name' });
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        systemType,
      );
      mockPrismaService.leaveTypeConfig.update.mockResolvedValue(updated);

      await expect(
        service.update('lt-1', { name: 'New Name' }),
      ).resolves.toBeDefined();
    });
  });

  describe('remove — soft-archive when leaves exist', () => {
    it('should soft-archive (deactivate) when leave type has active leaves', async () => {
      const typeWithLeaves = makeLeaveType({ _count: { leaves: 3 } });
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        typeWithLeaves,
      );
      mockPrismaService.leaveTypeConfig.update.mockResolvedValue({
        ...typeWithLeaves,
        isActive: false,
      });

      const result = await service.remove('lt-1');

      expect(result.deactivated).toBe(true);
      expect(mockPrismaService.leaveTypeConfig.delete).not.toHaveBeenCalled();
    });

    it('should hard-delete when no leaves reference the type', async () => {
      const typeNoLeaves = makeLeaveType({ _count: { leaves: 0 } });
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        typeNoLeaves,
      );
      mockPrismaService.leaveTypeConfig.delete.mockResolvedValue(typeNoLeaves);

      const result = await service.remove('lt-1');

      expect(result.deleted).toBe(true);
      expect(mockPrismaService.leaveTypeConfig.delete).toHaveBeenCalledWith({
        where: { id: 'lt-1' },
      });
    });

    it('should throw BadRequestException when trying to delete a system type', async () => {
      const systemType = makeLeaveType({
        isSystem: true,
        _count: { leaves: 0 },
      });
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(
        systemType,
      );

      await expect(service.remove('lt-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(null);

      await expect(service.remove('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
