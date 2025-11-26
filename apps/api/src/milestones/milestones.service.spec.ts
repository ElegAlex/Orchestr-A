import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MilestonesService } from './milestones.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MilestonesService', () => {
  let service: MilestonesService;

  const mockPrismaService = {
    milestone: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestonesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MilestonesService>(MilestonesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createMilestoneDto = {
      name: 'MVP Release',
      description: 'First public release',
      projectId: 'project-1',
      dueDate: '2025-06-30',
    };

    it('should create a milestone successfully', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockMilestone = {
        id: '1',
        name: createMilestoneDto.name,
        description: createMilestoneDto.description,
        projectId: createMilestoneDto.projectId,
        dueDate: new Date(createMilestoneDto.dueDate),
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.create.mockResolvedValue(mockMilestone);

      const result = await service.create(createMilestoneDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createMilestoneDto.name);
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createMilestoneDto)).rejects.toThrow('Projet introuvable');
    });
  });

  describe('findAll', () => {
    it('should return paginated milestones', async () => {
      const mockMilestones = [
        {
          id: '1',
          name: 'Milestone 1',
          projectId: 'project-1',
          completed: false,
        },
        {
          id: '2',
          name: 'Milestone 2',
          projectId: 'project-1',
          completed: true,
        },
      ];

      mockPrismaService.milestone.findMany.mockResolvedValue(mockMilestones);
      mockPrismaService.milestone.count.mockResolvedValue(2);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a milestone by id', async () => {
      const mockMilestone = {
        id: '1',
        name: 'MVP Release',
        projectId: 'project-1',
        completed: false,
      };

      mockPrismaService.milestone.findUnique.mockResolvedValue(mockMilestone);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should throw error when milestone not found', async () => {
      mockPrismaService.milestone.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow('Milestone introuvable');
    });
  });

  describe('update', () => {
    it('should update a milestone successfully', async () => {
      const updateDto = {
        name: 'Updated Milestone',
        completed: true,
      };

      const existingMilestone = {
        id: '1',
        name: 'Old Name',
        projectId: 'project-1',
        completed: false,
      };

      const updatedMilestone = {
        ...existingMilestone,
        ...updateDto,
      };

      mockPrismaService.milestone.findUnique.mockResolvedValue(existingMilestone);
      mockPrismaService.milestone.update.mockResolvedValue(updatedMilestone);

      const result = await service.update('1', updateDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Milestone');
      expect(result.completed).toBe(true);
    });
  });

  describe('remove', () => {
    it('should delete a milestone', async () => {
      const mockMilestone = {
        id: '1',
        name: 'Milestone',
        tasks: [],
      };

      mockPrismaService.milestone.findUnique.mockResolvedValue(mockMilestone);
      mockPrismaService.milestone.delete.mockResolvedValue(mockMilestone);

      await service.remove('1');

      expect(mockPrismaService.milestone.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
