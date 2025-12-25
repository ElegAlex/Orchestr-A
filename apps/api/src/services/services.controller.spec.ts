import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('ServicesController', () => {
  let controller: ServicesController;
  let servicesService: ServicesService;

  const mockService = {
    id: 'service-id-1',
    name: 'Development Team',
    description: 'Software development',
    departmentId: 'dept-id-1',
    managerId: 'manager-id-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    department: {
      id: 'dept-id-1',
      name: 'IT Department',
    },
    manager: {
      id: 'manager-id-1',
      firstName: 'John',
      lastName: 'Doe',
    },
    userServices: [],
  };

  const mockServicesService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getServicesByDepartment: vi.fn(),
    getServiceStats: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [
        {
          provide: ServicesService,
          useValue: mockServicesService,
        },
      ],
    }).compile();

    controller = module.get<ServicesController>(ServicesController);
    servicesService = module.get<ServicesService>(ServicesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createServiceDto = {
      name: 'Development Team',
      description: 'Software development',
      departmentId: 'dept-id-1',
      managerId: 'manager-id-1',
    };

    it('should create a service successfully', async () => {
      mockServicesService.create.mockResolvedValue(mockService);

      const result = await controller.create(createServiceDto);

      expect(result).toEqual(mockService);
      expect(mockServicesService.create).toHaveBeenCalledWith(createServiceDto);
      expect(mockServicesService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when department not found', async () => {
      mockServicesService.create.mockRejectedValue(
        new NotFoundException('Département introuvable'),
      );

      await expect(controller.create(createServiceDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when service name already exists in department', async () => {
      mockServicesService.create.mockRejectedValue(
        new ConflictException('Nom déjà utilisé dans ce département'),
      );

      await expect(controller.create(createServiceDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated services', async () => {
      const paginatedResult = {
        data: [mockService],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockServicesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockServicesService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
      );
    });

    it('should filter by departmentId', async () => {
      const departmentServices = {
        data: [mockService],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockServicesService.findAll.mockResolvedValue(departmentServices);

      await controller.findAll(1, 10, 'dept-id-1');

      expect(mockServicesService.findAll).toHaveBeenCalledWith(
        1,
        10,
        'dept-id-1',
      );
    });
  });

  describe('getServicesByDepartment', () => {
    it('should return services for a department', async () => {
      const departmentServices = [mockService];
      mockServicesService.getServicesByDepartment.mockResolvedValue(
        departmentServices,
      );

      const result = await controller.getServicesByDepartment('dept-id-1');

      expect(result).toEqual(departmentServices);
      expect(mockServicesService.getServicesByDepartment).toHaveBeenCalledWith(
        'dept-id-1',
      );
    });

    it('should throw NotFoundException when department not found', async () => {
      mockServicesService.getServicesByDepartment.mockRejectedValue(
        new NotFoundException('Département introuvable'),
      );

      await expect(
        controller.getServicesByDepartment('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return a service by id', async () => {
      mockServicesService.findOne.mockResolvedValue(mockService);

      const result = await controller.findOne('service-id-1');

      expect(result).toEqual(mockService);
      expect(mockServicesService.findOne).toHaveBeenCalledWith('service-id-1');
    });

    it('should throw NotFoundException when service not found', async () => {
      mockServicesService.findOne.mockRejectedValue(
        new NotFoundException('Service introuvable'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('should return service statistics', async () => {
      const stats = {
        totalUsers: 10,
        usersByRole: {
          MANAGER: 1,
          CONTRIBUTEUR: 9,
        },
      };

      mockServicesService.getServiceStats.mockResolvedValue(stats);

      const result = await controller.getStats('service-id-1');

      expect(result).toEqual(stats);
      expect(mockServicesService.getServiceStats).toHaveBeenCalledWith(
        'service-id-1',
      );
    });

    it('should throw NotFoundException when service not found', async () => {
      mockServicesService.getServiceStats.mockRejectedValue(
        new NotFoundException('Service introuvable'),
      );

      await expect(controller.getStats('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateServiceDto = {
      name: 'Development & DevOps Team',
      description: 'Software development and operations',
    };

    it('should update a service successfully', async () => {
      const updatedService = { ...mockService, ...updateServiceDto };
      mockServicesService.update.mockResolvedValue(updatedService);

      const result = await controller.update('service-id-1', updateServiceDto);

      expect(result.name).toBe('Development & DevOps Team');
      expect(mockServicesService.update).toHaveBeenCalledWith(
        'service-id-1',
        updateServiceDto,
      );
    });

    it('should throw NotFoundException when service not found', async () => {
      mockServicesService.update.mockRejectedValue(
        new NotFoundException('Service introuvable'),
      );

      await expect(
        controller.update('nonexistent', updateServiceDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when name already exists in department', async () => {
      mockServicesService.update.mockRejectedValue(
        new ConflictException('Nom déjà utilisé dans ce département'),
      );

      await expect(
        controller.update('service-id-1', { name: 'Existing' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a service successfully', async () => {
      mockServicesService.remove.mockResolvedValue({
        message: 'Service supprimé',
      });

      const result = await controller.remove('service-id-1');

      expect(result.message).toBe('Service supprimé');
      expect(mockServicesService.remove).toHaveBeenCalledWith('service-id-1');
    });

    it('should throw BadRequestException when service has users', async () => {
      mockServicesService.remove.mockRejectedValue(
        new BadRequestException(
          'Impossible de supprimer (contient des utilisateurs)',
        ),
      );

      await expect(controller.remove('service-id-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when service not found', async () => {
      mockServicesService.remove.mockRejectedValue(
        new NotFoundException('Service introuvable'),
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
