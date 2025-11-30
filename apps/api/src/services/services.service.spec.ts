import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('ServicesService', () => {
  let service: ServicesService;

  const mockPrismaService = {
    service: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
  };

  const mockService = {
    id: 'service-1',
    name: 'Backend',
    description: 'Backend development',
    departmentId: 'dept-1',
    managerId: 'manager-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    department: { id: 'dept-1', name: 'IT' },
    manager: { id: 'manager-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com', role: 'MANAGER' },
    _count: { userServices: 5 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a service successfully', async () => {
      const createDto = {
        name: 'Backend Development',
        departmentId: 'dept-1',
      };

      const mockDepartment = { id: 'dept-1', name: 'IT' };

      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.service.findFirst.mockResolvedValue(null);
      mockPrismaService.service.create.mockResolvedValue(mockService);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockService.name);
    });

    it('should throw error when department not found', async () => {
      const createDto = {
        name: 'Backend',
        departmentId: 'invalid',
      };

      mockPrismaService.department.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw conflict when service name already exists in department', async () => {
      const createDto = {
        name: 'Backend',
        departmentId: 'dept-1',
      };

      mockPrismaService.department.findUnique.mockResolvedValue({ id: 'dept-1' });
      mockPrismaService.service.findFirst.mockResolvedValue({ id: 'existing', name: 'Backend' });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all services', async () => {
      const mockServices = [mockService];

      mockPrismaService.service.findMany.mockResolvedValue(mockServices);
      mockPrismaService.service.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by departmentId', async () => {
      mockPrismaService.service.findMany.mockResolvedValue([mockService]);
      mockPrismaService.service.count.mockResolvedValue(1);

      await service.findAll(1, 10, 'dept-1');

      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { departmentId: 'dept-1' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a service by id', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(mockService);

      const result = await service.findOne('service-1');

      expect(result).toBeDefined();
      expect(result.name).toBe('Backend');
    });

    it('should throw error when service not found', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a service successfully', async () => {
      const updateDto = { description: 'Updated description' };
      const existingService = { ...mockService };
      const updatedService = { ...existingService, description: 'Updated description' };

      mockPrismaService.service.findUnique.mockResolvedValue(existingService);
      mockPrismaService.service.update.mockResolvedValue(updatedService);

      const result = await service.update('service-1', updateDto);

      expect(result.description).toBe('Updated description');
    });

    it('should throw error when service not found', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });

    it('should verify new department when changing departmentId', async () => {
      const updateDto = { departmentId: 'dept-2' };
      const existingService = { ...mockService, departmentId: 'dept-1' };

      mockPrismaService.service.findUnique.mockResolvedValue(existingService);
      mockPrismaService.department.findUnique.mockResolvedValue(null);

      await expect(service.update('service-1', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw conflict when new name already exists in department', async () => {
      const updateDto = { name: 'Frontend' };
      const existingService = { ...mockService, name: 'Backend' };

      mockPrismaService.service.findUnique.mockResolvedValue(existingService);
      mockPrismaService.service.findFirst.mockResolvedValue({ id: 'other-service', name: 'Frontend' });

      await expect(service.update('service-1', updateDto)).rejects.toThrow(ConflictException);
    });

    it('should allow update when name is the same', async () => {
      const updateDto = { name: 'Backend', description: 'Updated' };
      const existingService = { ...mockService };

      mockPrismaService.service.findUnique.mockResolvedValue(existingService);
      mockPrismaService.service.update.mockResolvedValue({ ...existingService, description: 'Updated' });

      const result = await service.update('service-1', updateDto);

      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should delete a service', async () => {
      const mockServiceNoUsers = {
        ...mockService,
        _count: { userServices: 0 },
      };

      mockPrismaService.service.findUnique.mockResolvedValue(mockServiceNoUsers);
      mockPrismaService.service.delete.mockResolvedValue(mockServiceNoUsers);

      const result = await service.remove('service-1');

      expect(result.message).toBe('Service supprimé avec succès');
      expect(mockPrismaService.service.delete).toHaveBeenCalledWith({
        where: { id: 'service-1' },
      });
    });

    it('should throw error when service not found', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should throw error when service has users', async () => {
      const mockServiceWithUsers = {
        ...mockService,
        _count: { userServices: 5 },
      };
      mockPrismaService.service.findUnique.mockResolvedValue(mockServiceWithUsers);

      await expect(service.remove('service-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getServicesByDepartment', () => {
    it('should return services for a department', async () => {
      const mockDepartment = { id: 'dept-1', name: 'IT' };
      const mockServices = [mockService];

      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.service.findMany.mockResolvedValue(mockServices);

      const result = await service.getServicesByDepartment('dept-1');

      expect(result).toHaveLength(1);
    });

    it('should throw error when department not found', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(null);

      await expect(service.getServicesByDepartment('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getServiceStats', () => {
    it('should return service statistics', async () => {
      const mockServiceWithUsers = {
        ...mockService,
        userServices: [
          { user: { role: 'CONTRIBUTEUR', isActive: true } },
          { user: { role: 'CONTRIBUTEUR', isActive: true } },
          { user: { role: 'MANAGER', isActive: true } },
          { user: { role: 'CONTRIBUTEUR', isActive: false } },
        ],
      };

      mockPrismaService.service.findUnique.mockResolvedValue(mockServiceWithUsers);

      const result = await service.getServiceStats('service-1');

      expect(result.serviceId).toBe('service-1');
      expect(result.users.total).toBe(4);
      expect(result.users.active).toBe(3);
      expect(result.users.inactive).toBe(1);
      expect(result.users.byRole.CONTRIBUTEUR).toBe(2);
      expect(result.users.byRole.MANAGER).toBe(1);
    });

    it('should throw error when service not found', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(service.getServiceStats('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});
