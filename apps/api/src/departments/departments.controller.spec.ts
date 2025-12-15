import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('DepartmentsController', () => {
  let controller: DepartmentsController;
  let departmentsService: DepartmentsService;

  const mockDepartment = {
    id: 'dept-id-1',
    name: 'IT Department',
    description: 'Information Technology',
    managerId: 'manager-id-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    manager: {
      id: 'manager-id-1',
      firstName: 'John',
      lastName: 'Doe',
    },
    services: [],
    users: [],
  };

  const mockDepartmentsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getDepartmentStats: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [
        {
          provide: DepartmentsService,
          useValue: mockDepartmentsService,
        },
      ],
    }).compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
    departmentsService = module.get<DepartmentsService>(DepartmentsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createDepartmentDto = {
      name: 'IT Department',
      description: 'Information Technology',
      managerId: 'manager-id-1',
    };

    it('should create a department successfully', async () => {
      mockDepartmentsService.create.mockResolvedValue(mockDepartment);

      const result = await controller.create(createDepartmentDto);

      expect(result).toEqual(mockDepartment);
      expect(mockDepartmentsService.create).toHaveBeenCalledWith(createDepartmentDto);
      expect(mockDepartmentsService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when name already exists', async () => {
      mockDepartmentsService.create.mockRejectedValue(
        new ConflictException('Nom de département déjà utilisé')
      );

      await expect(controller.create(createDepartmentDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated departments', async () => {
      const paginatedResult = {
        data: [mockDepartment],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockDepartmentsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockDepartmentsService.findAll).toHaveBeenCalledWith(1, 10);
    });

    it('should use default pagination when not specified', async () => {
      const paginatedResult = {
        data: [mockDepartment],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };

      mockDepartmentsService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll(undefined, undefined);

      expect(mockDepartmentsService.findAll).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('findOne', () => {
    it('should return a department by id', async () => {
      mockDepartmentsService.findOne.mockResolvedValue(mockDepartment);

      const result = await controller.findOne('dept-id-1');

      expect(result).toEqual(mockDepartment);
      expect(mockDepartmentsService.findOne).toHaveBeenCalledWith('dept-id-1');
    });

    it('should throw NotFoundException when department not found', async () => {
      mockDepartmentsService.findOne.mockRejectedValue(
        new NotFoundException('Département introuvable')
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return department statistics', async () => {
      const stats = {
        totalUsers: 25,
        usersByRole: {
          ADMIN: 1,
          MANAGER: 3,
          CONTRIBUTEUR: 21,
        },
        totalProjects: 10,
        activeProjects: 7,
        totalTasks: 150,
        completedTasks: 100,
        averageWorkload: 85,
      };

      mockDepartmentsService.getDepartmentStats.mockResolvedValue(stats);

      const result = await controller.getStats('dept-id-1');

      expect(result).toEqual(stats);
      expect(mockDepartmentsService.getDepartmentStats).toHaveBeenCalledWith('dept-id-1');
    });

    it('should throw NotFoundException when department not found', async () => {
      mockDepartmentsService.getDepartmentStats.mockRejectedValue(
        new NotFoundException('Département introuvable')
      );

      await expect(controller.getStats('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDepartmentDto = {
      name: 'IT & Digital',
      description: 'IT and Digital Transformation',
    };

    it('should update a department successfully', async () => {
      const updatedDepartment = { ...mockDepartment, ...updateDepartmentDto };
      mockDepartmentsService.update.mockResolvedValue(updatedDepartment);

      const result = await controller.update('dept-id-1', updateDepartmentDto);

      expect(result.name).toBe('IT & Digital');
      expect(mockDepartmentsService.update).toHaveBeenCalledWith('dept-id-1', updateDepartmentDto);
    });

    it('should throw NotFoundException when department not found', async () => {
      mockDepartmentsService.update.mockRejectedValue(
        new NotFoundException('Département introuvable')
      );

      await expect(controller.update('nonexistent', updateDepartmentDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ConflictException when name already exists', async () => {
      mockDepartmentsService.update.mockRejectedValue(
        new ConflictException('Nom de département déjà utilisé')
      );

      await expect(controller.update('dept-id-1', { name: 'Existing' })).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('remove', () => {
    it('should delete a department successfully', async () => {
      mockDepartmentsService.remove.mockResolvedValue({ message: 'Département supprimé' });

      const result = await controller.remove('dept-id-1');

      expect(result.message).toBe('Département supprimé');
      expect(mockDepartmentsService.remove).toHaveBeenCalledWith('dept-id-1');
    });

    it('should throw BadRequestException when department has users', async () => {
      mockDepartmentsService.remove.mockRejectedValue(
        new BadRequestException('Impossible de supprimer (contient des utilisateurs)')
      );

      await expect(controller.remove('dept-id-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when department has services', async () => {
      mockDepartmentsService.remove.mockRejectedValue(
        new BadRequestException('Impossible de supprimer (contient des services)')
      );

      await expect(controller.remove('dept-id-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when department not found', async () => {
      mockDepartmentsService.remove.mockRejectedValue(
        new NotFoundException('Département introuvable')
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
