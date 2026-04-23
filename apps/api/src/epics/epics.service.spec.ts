import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EpicsService } from './epics.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

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

      await expect(service.create(createEpicDto)).rejects.toThrow(
        'Projet introuvable',
      );
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

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Epic introuvable',
      );
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

    it('should throw NotFoundException when epic not found', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update with project membership check', () => {
    const mockEpicWithProject = {
      id: '1',
      name: 'Epic',
      tasks: [],
      project: {
        id: 'project-1',
        members: [{ userId: 'user-1' }],
      },
    };

    it('should skip membership check when no currentUserId', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicWithProject);
      mockPrismaService.epic.update.mockResolvedValue({
        ...mockEpicWithProject,
        name: 'Updated',
      });

      const result = await service.update('1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      // findUnique should be called once for findOne (not for membership check)
    });

    it('should bypass membership check for ADMIN role', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicWithProject);
      mockPrismaService.epic.update.mockResolvedValue({
        ...mockEpicWithProject,
        name: 'Admin Updated',
      });

      const result = await service.update(
        '1',
        { name: 'Admin Updated' },
        'admin-user',
        'ADMIN',
      );

      expect(result.name).toBe('Admin Updated');
    });

    it('should allow member to update', async () => {
      // First call for assertProjectMembership, second for findOne
      mockPrismaService.epic.findUnique
        .mockResolvedValueOnce(mockEpicWithProject)
        .mockResolvedValueOnce(mockEpicWithProject);
      mockPrismaService.epic.update.mockResolvedValue({
        ...mockEpicWithProject,
        name: 'Member Updated',
      });

      const result = await service.update(
        '1',
        { name: 'Member Updated' },
        'user-1',
        'CONTRIBUTEUR',
      );

      expect(result.name).toBe('Member Updated');
    });

    it('should throw ForbiddenException when non-member tries to update', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicWithProject);

      await expect(
        service.update(
          '1',
          { name: 'Forbidden' },
          'non-member',
          'CONTRIBUTEUR',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove with project membership check', () => {
    const mockEpicWithProject = {
      id: '1',
      name: 'Epic',
      tasks: [],
      project: {
        id: 'project-1',
        members: [{ userId: 'user-1' }],
      },
    };

    it('should throw ForbiddenException when non-member tries to remove', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicWithProject);

      await expect(
        service.remove('1', 'non-member', 'CONTRIBUTEUR'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should skip membership check when no currentUserId is provided to remove', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicWithProject);
      mockPrismaService.epic.delete.mockResolvedValue(mockEpicWithProject);

      const result = await service.remove('1');

      expect(result).toEqual({ message: 'Epic supprimé avec succès' });
    });
  });
});
