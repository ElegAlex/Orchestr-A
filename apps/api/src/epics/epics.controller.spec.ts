import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EpicsController } from './epics.controller';
import { EpicsService } from './epics.service';
import { NotFoundException } from '@nestjs/common';

describe('EpicsController', () => {
  let controller: EpicsController;

  const mockEpic = {
    id: 'epic-id-1',
    name: 'User Authentication',
    description: 'Implement user authentication system',
    projectId: 'project-id-1',
    progress: 50,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-03-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
    project: {
      id: 'project-id-1',
      name: 'Main Project',
    },
    tasks: [],
  };

  const mockEpicsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EpicsController],
      providers: [
        {
          provide: EpicsService,
          useValue: mockEpicsService,
        },
      ],
    }).compile();

    controller = module.get<EpicsController>(EpicsController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createEpicDto = {
      name: 'User Authentication',
      description: 'Implement user authentication system',
      projectId: 'project-id-1',
      startDate: '2025-01-01',
      endDate: '2025-03-01',
    };

    it('should create an epic successfully', async () => {
      mockEpicsService.create.mockResolvedValue(mockEpic);

      const result = await controller.create(createEpicDto);

      expect(result).toEqual(mockEpic);
      expect(mockEpicsService.create).toHaveBeenCalledWith(createEpicDto);
      expect(mockEpicsService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockEpicsService.create.mockRejectedValue(
        new NotFoundException('Projet introuvable'),
      );

      await expect(controller.create(createEpicDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated epics', async () => {
      const paginatedResult = {
        data: [mockEpic],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockEpicsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockEpicsService.findAll).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should filter by projectId', async () => {
      const projectEpics = {
        data: [mockEpic],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockEpicsService.findAll.mockResolvedValue(projectEpics);

      await controller.findAll(1, 10, 'project-id-1');

      expect(mockEpicsService.findAll).toHaveBeenCalledWith(
        1,
        10,
        'project-id-1',
      );
    });
  });

  describe('findOne', () => {
    it('should return an epic by id', async () => {
      mockEpicsService.findOne.mockResolvedValue(mockEpic);

      const result = await controller.findOne('epic-id-1');

      expect(result).toEqual(mockEpic);
      expect(mockEpicsService.findOne).toHaveBeenCalledWith('epic-id-1');
    });

    it('should throw NotFoundException when epic not found', async () => {
      mockEpicsService.findOne.mockRejectedValue(
        new NotFoundException('Epic introuvable'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateEpicDto = {
      name: 'User Authentication v2',
      progress: 75,
    };

    it('should update an epic successfully', async () => {
      const updatedEpic = { ...mockEpic, ...updateEpicDto };
      mockEpicsService.update.mockResolvedValue(updatedEpic);

      const result = await controller.update('epic-id-1', updateEpicDto);

      expect(result.name).toBe('User Authentication v2');
      expect(result.progress).toBe(75);
      expect(mockEpicsService.update).toHaveBeenCalledWith(
        'epic-id-1',
        updateEpicDto,
      );
    });

    it('should throw NotFoundException when epic not found', async () => {
      mockEpicsService.update.mockRejectedValue(
        new NotFoundException('Epic introuvable'),
      );

      await expect(
        controller.update('nonexistent', updateEpicDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an epic successfully', async () => {
      mockEpicsService.remove.mockResolvedValue({ message: 'Epic supprimé' });

      const result = await controller.remove('epic-id-1');

      expect(result.message).toBe('Epic supprimé');
      expect(mockEpicsService.remove).toHaveBeenCalledWith('epic-id-1');
    });

    it('should throw NotFoundException when epic not found', async () => {
      mockEpicsService.remove.mockRejectedValue(
        new NotFoundException('Epic introuvable'),
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
