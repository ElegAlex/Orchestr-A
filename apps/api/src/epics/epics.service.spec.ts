import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EpicsService } from './epics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EpicsService', () => {
  let service: EpicsService;

  const mockPrismaService = {
    epic: {
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
        EpicsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EpicsService>(EpicsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createEpicDto = {
      name: 'User Authentication',
      description: 'Epic for all auth features',
      projectId: 'project-1',
      startDate: '2025-01-01',
      endDate: '2025-03-31',
    };

    it('should create an epic successfully', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockEpic = {
        id: '1',
        name: createEpicDto.name,
        description: createEpicDto.description,
        projectId: createEpicDto.projectId,
        startDate: new Date(createEpicDto.startDate),
        endDate: new Date(createEpicDto.endDate),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.epic.create.mockResolvedValue(mockEpic);

      const result = await service.create(createEpicDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createEpicDto.name);
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createEpicDto)).rejects.toThrow('Projet introuvable');
    });
  });

  describe('findAll', () => {
    it('should return paginated epics', async () => {
      const mockEpics = [
        {
          id: '1',
          name: 'Epic 1',
          projectId: 'project-1',
        },
        {
          id: '2',
          name: 'Epic 2',
          projectId: 'project-1',
        },
      ];

      mockPrismaService.epic.findMany.mockResolvedValue(mockEpics);
      mockPrismaService.epic.count.mockResolvedValue(2);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return an epic by id', async () => {
      const mockEpic = {
        id: '1',
        name: 'User Authentication',
        projectId: 'project-1',
      };

      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpic);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should throw error when epic not found', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow('Epic introuvable');
    });
  });

  describe('update', () => {
    it('should update an epic successfully', async () => {
      const updateDto = {
        name: 'Updated Epic Name',
        description: 'Updated description',
      };

      const existingEpic = {
        id: '1',
        name: 'Old Name',
        projectId: 'project-1',
      };

      const updatedEpic = {
        ...existingEpic,
        ...updateDto,
      };

      mockPrismaService.epic.findUnique.mockResolvedValue(existingEpic);
      mockPrismaService.epic.update.mockResolvedValue(updatedEpic);

      const result = await service.update('1', updateDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Epic Name');
    });
  });

  describe('remove', () => {
    it('should delete an epic', async () => {
      const mockEpic = {
        id: '1',
        name: 'Epic',
        tasks: [],
      };

      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpic);
      mockPrismaService.epic.delete.mockResolvedValue(mockEpic);

      await service.remove('1');

      expect(mockPrismaService.epic.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
