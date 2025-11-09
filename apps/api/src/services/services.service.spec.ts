import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ServicesService', () => {
  let service: ServicesService;

  const mockPrismaService = {
    service: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
    },
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
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a service successfully', async () => {
      const createDto = {
        name: 'Backend Development',
        departmentId: 'dept-1',
      };

      const mockDepartment = { id: 'dept-1', name: 'IT' };
      const mockService = {
        id: '1',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.service.create.mockResolvedValue(mockService);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
    });
  });

  describe('findAll', () => {
    it('should return all services', async () => {
      const mockServices = [
        { id: '1', name: 'Backend', departmentId: 'dept-1' },
        { id: '2', name: 'Frontend', departmentId: 'dept-1' },
      ];

      mockPrismaService.service.findMany.mockResolvedValue(mockServices);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a service by id', async () => {
      const mockService = { id: '1', name: 'Backend' };

      mockPrismaService.service.findUnique.mockResolvedValue(mockService);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });
  });

  describe('update', () => {
    it('should update a service successfully', async () => {
      const updateDto = { name: 'Updated Backend' };
      const existingService = { id: '1', name: 'Backend' };
      const updatedService = { ...existingService, ...updateDto };

      mockPrismaService.service.findUnique.mockResolvedValue(existingService);
      mockPrismaService.service.update.mockResolvedValue(updatedService);

      const result = await service.update('1', updateDto);

      expect(result.name).toBe('Updated Backend');
    });
  });

  describe('remove', () => {
    it('should delete a service', async () => {
      const mockService = { id: '1', name: 'Backend' };

      mockPrismaService.service.findUnique.mockResolvedValue(mockService);
      mockPrismaService.service.delete.mockResolvedValue(mockService);

      await service.remove('1');

      expect(mockPrismaService.service.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
