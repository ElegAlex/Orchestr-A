import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsService } from './departments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  const mockPrismaService = {
    department: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a department successfully', async () => {
      const createDto = {
        name: 'IT Department',
        description: 'Information Technology',
      };

      const mockDepartment = {
        id: '1',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.department.create.mockResolvedValue(mockDepartment);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
    });
  });

  describe('findAll', () => {
    it('should return all departments', async () => {
      const mockDepartments = [
        { id: '1', name: 'IT', description: 'Tech' },
        { id: '2', name: 'HR', description: 'Human Resources' },
      ];

      mockPrismaService.department.findMany.mockResolvedValue(mockDepartments);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a department by id', async () => {
      const mockDepartment = { id: '1', name: 'IT' };

      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });
  });

  describe('update', () => {
    it('should update a department successfully', async () => {
      const updateDto = { name: 'Updated IT' };
      const existingDept = { id: '1', name: 'IT' };
      const updatedDept = { ...existingDept, ...updateDto };

      mockPrismaService.department.findUnique.mockResolvedValue(existingDept);
      mockPrismaService.department.update.mockResolvedValue(updatedDept);

      const result = await service.update('1', updateDto);

      expect(result.name).toBe('Updated IT');
    });
  });

  describe('remove', () => {
    it('should delete a department', async () => {
      const mockDepartment = { id: '1', name: 'IT' };

      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.department.delete.mockResolvedValue(mockDepartment);

      await service.remove('1');

      expect(mockPrismaService.department.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
