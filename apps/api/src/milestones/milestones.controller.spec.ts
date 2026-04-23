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
    validateImport: vi.fn(),
    importMilestones: vi.fn(),
    exportProjectMilestonesCsv: vi.fn(),
    getImportTemplate: vi.fn(),
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
      const plannedMilestones = {
        data: [mockMilestone],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockMilestonesService.findAll.mockResolvedValue(plannedMilestones);

      await controller.findAll(1, 10, undefined, MilestoneStatus.PLANNED);

      expect(mockMilestonesService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        'PLANNED',
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
        'user-1',
        'ADMIN',
      );

      expect(result.name).toBe('Phase 1 Complete - Updated');
      expect(result.status).toBe('IN_PROGRESS');
      expect(mockMilestonesService.update).toHaveBeenCalledWith(
        'milestone-id-1',
        updateMilestoneDto,
        'user-1',
        'ADMIN',
      );
    });

    it('should throw NotFoundException when milestone not found', async () => {
      mockMilestonesService.update.mockRejectedValue(
        new NotFoundException('Milestone introuvable'),
      );

      await expect(
        controller.update('nonexistent', updateMilestoneDto, 'user-1', 'ADMIN'),
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

      const result = await controller.remove(
        'milestone-id-1',
        'user-1',
        'ADMIN',
      );

      expect(result.message).toBe('Milestone supprimé');
      expect(mockMilestonesService.remove).toHaveBeenCalledWith(
        'milestone-id-1',
        'user-1',
        'ADMIN',
      );
    });

    it('should throw NotFoundException when milestone not found', async () => {
      mockMilestonesService.remove.mockRejectedValue(
        new NotFoundException('Milestone introuvable'),
      );

      await expect(
        controller.remove('nonexistent', 'user-1', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateImport', () => {
    it('should validate milestones import and return preview', async () => {
      const preview = { valid: 2, errors: [] };
      mockMilestonesService.validateImport.mockResolvedValue(preview);

      const result = await controller.validateImport('project-id-1', {
        milestones: [],
      } as any);

      expect(mockMilestonesService.validateImport).toHaveBeenCalledWith(
        'project-id-1',
        [],
      );
      expect(result).toEqual(preview);
    });
  });

  describe('importMilestones', () => {
    it('should import milestones and return result', async () => {
      const importResult = { created: 3, errors: [] };
      mockMilestonesService.importMilestones.mockResolvedValue(importResult);

      const result = await controller.importMilestones('project-id-1', {
        milestones: [],
      } as any);

      expect(mockMilestonesService.importMilestones).toHaveBeenCalledWith(
        'project-id-1',
        [],
      );
      expect(result).toEqual(importResult);
    });
  });

  describe('exportProjectMilestones', () => {
    it('should export milestones as CSV and send response', async () => {
      mockMilestonesService.exportProjectMilestonesCsv.mockResolvedValue({
        csv: 'name;dueDate\nMilestone 1;2025-01-01',
        filename: 'milestones_project-id-1.csv',
      });

      const mockReply = {
        header: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      await controller.exportProjectMilestones('project-id-1', mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8',
      );
      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('milestones_project-id-1.csv'),
      );
      expect(mockReply.send).toHaveBeenCalledWith(
        'name;dueDate\nMilestone 1;2025-01-01',
      );
    });
  });

  describe('getImportTemplate', () => {
    it('should return the import template', () => {
      const csvTemplate = 'name;description;dueDate;status';
      mockMilestonesService.getImportTemplate.mockReturnValue(csvTemplate);

      const result = controller.getImportTemplate();

      expect(mockMilestonesService.getImportTemplate).toHaveBeenCalled();
      expect(result).toEqual({ template: csvTemplate });
    });
  });
});
