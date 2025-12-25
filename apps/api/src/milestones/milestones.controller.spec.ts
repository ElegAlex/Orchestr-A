import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MilestoneStatus } from 'database';

describe('MilestonesController', () => {
  let controller: MilestonesController;

  const mockMilestone = {
    id: 'milestone-id-1',
    name: 'Phase 1 Complete',
    description: 'First phase delivery',
    projectId: 'project-id-1',
    dueDate: new Date('2025-02-01'),
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    project: {
      id: 'project-id-1',
      name: 'Main Project',
    },
    tasks: [],
  };

  const mockMilestonesService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    complete: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MilestonesController],
      providers: [
        {
          provide: MilestonesService,
          useValue: mockMilestonesService,
        },
      ],
    }).compile();

    controller = module.get<MilestonesController>(MilestonesController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createMilestoneDto = {
      name: 'Phase 1 Complete',
      description: 'First phase delivery',
      projectId: 'project-id-1',
      dueDate: '2025-02-01',
    };

    it('should create a milestone successfully', async () => {
      mockMilestonesService.create.mockResolvedValue(mockMilestone);

      const result = await controller.create(createMilestoneDto);

      expect(result).toEqual(mockMilestone);
      expect(mockMilestonesService.create).toHaveBeenCalledWith(
        createMilestoneDto,
      );
      expect(mockMilestonesService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockMilestonesService.create.mockRejectedValue(
        new NotFoundException('Projet introuvable'),
      );

      await expect(controller.create(createMilestoneDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated milestones', async () => {
      const paginatedResult = {
        data: [mockMilestone],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockMilestonesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockMilestonesService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
      );
    });

    it('should filter by projectId', async () => {
      const projectMilestones = {
        data: [mockMilestone],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockMilestonesService.findAll.mockResolvedValue(projectMilestones);

      await controller.findAll(1, 10, 'project-id-1');

      expect(mockMilestonesService.findAll).toHaveBeenCalledWith(
        1,
        10,
        'project-id-1',
        undefined,
      );
    });

    it('should filter by status', async () => {
      const pendingMilestones = {
        data: [mockMilestone],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockMilestonesService.findAll.mockResolvedValue(pendingMilestones);

      await controller.findAll(1, 10, undefined, MilestoneStatus.PENDING);

      expect(mockMilestonesService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        'PENDING',
      );
    });
  });

  describe('findOne', () => {
    it('should return a milestone by id', async () => {
      mockMilestonesService.findOne.mockResolvedValue(mockMilestone);

      const result = await controller.findOne('milestone-id-1');

      expect(result).toEqual(mockMilestone);
      expect(mockMilestonesService.findOne).toHaveBeenCalledWith(
        'milestone-id-1',
      );
    });

    it('should throw NotFoundException when milestone not found', async () => {
      mockMilestonesService.findOne.mockRejectedValue(
        new NotFoundException('Milestone introuvable'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateMilestoneDto = {
      name: 'Phase 1 Complete - Updated',
      status: 'IN_PROGRESS' as const,
    };

    it('should update a milestone successfully', async () => {
      const updatedMilestone = { ...mockMilestone, ...updateMilestoneDto };
      mockMilestonesService.update.mockResolvedValue(updatedMilestone);

      const result = await controller.update(
        'milestone-id-1',
        updateMilestoneDto,
      );

      expect(result.name).toBe('Phase 1 Complete - Updated');
      expect(result.status).toBe('IN_PROGRESS');
      expect(mockMilestonesService.update).toHaveBeenCalledWith(
        'milestone-id-1',
        updateMilestoneDto,
      );
    });

    it('should throw NotFoundException when milestone not found', async () => {
      mockMilestonesService.update.mockRejectedValue(
        new NotFoundException('Milestone introuvable'),
      );

      await expect(
        controller.update('nonexistent', updateMilestoneDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('complete', () => {
    it('should mark a milestone as completed', async () => {
      const completedMilestone = { ...mockMilestone, status: 'COMPLETED' };
      mockMilestonesService.complete.mockResolvedValue(completedMilestone);

      const result = await controller.complete('milestone-id-1');

      expect(result.status).toBe('COMPLETED');
      expect(mockMilestonesService.complete).toHaveBeenCalledWith(
        'milestone-id-1',
      );
    });

    it('should throw NotFoundException when milestone not found', async () => {
      mockMilestonesService.complete.mockRejectedValue(
        new NotFoundException('Milestone introuvable'),
      );

      await expect(controller.complete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when milestone is already completed', async () => {
      mockMilestonesService.complete.mockRejectedValue(
        new BadRequestException('Milestone déjà complété'),
      );

      await expect(controller.complete('milestone-id-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a milestone successfully', async () => {
      mockMilestonesService.remove.mockResolvedValue({
        message: 'Milestone supprimé',
      });

      const result = await controller.remove('milestone-id-1');

      expect(result.message).toBe('Milestone supprimé');
      expect(mockMilestonesService.remove).toHaveBeenCalledWith(
        'milestone-id-1',
      );
    });

    it('should throw NotFoundException when milestone not found', async () => {
      mockMilestonesService.remove.mockRejectedValue(
        new NotFoundException('Milestone introuvable'),
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
