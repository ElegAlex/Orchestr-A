import { Test, TestingModule } from '@nestjs/testing';
import { LeavesService } from './leaves.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeavesService', () => {
  let service: LeavesService;

  const mockPrismaService = {
    leave: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
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
    jest.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'user-1';
    const createLeaveDto = {
      type: 'PAID' as const,
      startDate: '2025-06-01',
      endDate: '2025-06-05',
      reason: 'Summer vacation',
    };

    it('should create a leave request successfully', async () => {
      const mockUser = { id: 'user-1', firstName: 'John', lastName: 'Doe' };
      const mockLeave = {
        id: '1',
        userId,
        ...createLeaveDto,
        startDate: new Date(createLeaveDto.startDate),
        endDate: new Date(createLeaveDto.endDate),
        status: 'PENDING',
        workingDaysCount: 5,
        startHalfDay: null,
        endHalfDay: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.leave.findMany.mockResolvedValue([]);
      mockPrismaService.leave.create.mockResolvedValue(mockLeave);

      const result = await service.create(userId, createLeaveDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, createLeaveDto)).rejects.toThrow('Utilisateur introuvable');
    });
  });

  describe('findAll', () => {
    it('should return paginated leaves', async () => {
      const mockLeaves = [
        {
          id: '1',
          userId: 'user-1',
          type: 'PAID',
          status: 'PENDING',
          startDate: new Date('2025-06-01'),
          endDate: new Date('2025-06-05'),
        },
        {
          id: '2',
          userId: 'user-2',
          type: 'SICK',
          status: 'APPROVED',
          startDate: new Date('2025-07-01'),
          endDate: new Date('2025-07-03'),
        },
      ];

      mockPrismaService.leave.findMany.mockResolvedValue(mockLeaves);
      mockPrismaService.leave.count.mockResolvedValue(2);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a leave by id', async () => {
      const mockLeave = {
        id: '1',
        userId: 'user-1',
        type: 'PAID',
        status: 'PENDING',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-05'),
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should throw error when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow('Demande de congé introuvable');
    });
  });

  describe('approve', () => {
    it('should approve a leave request', async () => {
      const mockLeave = {
        id: '1',
        userId: 'user-1',
        status: 'PENDING',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-05'),
      };

      const approvedLeave = {
        ...mockLeave,
        status: 'APPROVED',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.leave.update.mockResolvedValue(approvedLeave);

      const result = await service.approve('1');

      expect(result.status).toBe('APPROVED');
    });

    it('should throw error when leave not found', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      await expect(service.approve('nonexistent')).rejects.toThrow('Demande de congé introuvable');
    });
  });

  describe('reject', () => {
    it('should reject a leave request', async () => {
      const mockLeave = {
        id: '1',
        userId: 'user-1',
        status: 'PENDING',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-05'),
      };

      const rejectedLeave = {
        ...mockLeave,
        status: 'REJECTED',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.leave.update.mockResolvedValue(rejectedLeave);

      const result = await service.reject('1', 'Insufficient leave balance');

      expect(result.status).toBe('REJECTED');
    });
  });

  describe('remove', () => {
    it('should delete a leave request', async () => {
      const mockLeave = {
        id: '1',
        userId: 'user-1',
        status: 'PENDING',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.leave.delete.mockResolvedValue(mockLeave);

      await service.remove('1');

      expect(mockPrismaService.leave.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
