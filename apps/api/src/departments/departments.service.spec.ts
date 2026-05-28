import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from 'database';
import { DepartmentsService } from './departments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  const mockPrismaService = {
    department: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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

      mockPrismaService.department.findFirst.mockResolvedValue(null);
      mockPrismaService.department.create.mockResolvedValue(mockDepartment);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
    });

    // COR-034: TOCTOU race — findFirst saw nothing, but a concurrent peer
    // wrote first; prisma.department.create() then hits the DAT-016
    // departments_name_key UNIQUE and surfaces P2002. The wrapper must
    // collapse this to a 409, not a 500.
    it('maps Prisma P2002 from create() to ConflictException (COR-034)', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(null);
      mockPrismaService.department.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`name`)',
          { code: 'P2002', clientVersion: 'test', meta: { target: ['name'] } },
        ),
      );

      await expect(
        service.create({ name: 'Race', description: '' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all departments', async () => {
      const mockDepartments = [
        { id: '1', name: 'IT', description: 'Tech' },
        { id: '2', name: 'HR', description: 'Human Resources' },
      ];

      mockPrismaService.department.findMany.mockResolvedValue(mockDepartments);
      mockPrismaService.department.count.mockResolvedValue(2);

      const result = await service.findAll();

      expect(result.data).toHaveLength(2);
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
      const updateDto = { description: 'Updated description' };
      const existingDept = { id: '1', name: 'IT', description: 'Old' };
      const updatedDept = { ...existingDept, ...updateDto };

      mockPrismaService.department.findUnique.mockResolvedValue(existingDept);
      mockPrismaService.department.update.mockResolvedValue(updatedDept);

      const result = await service.update('1', updateDto);

      expect(result.description).toBe('Updated description');
    });

    // COR-034: same TOCTOU race on update — rename collides with a concurrent
    // peer that grabbed the new name first.
    it('maps Prisma P2002 from update() to ConflictException (COR-034)', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue({
        id: '1',
        name: 'IT',
      });
      mockPrismaService.department.findFirst.mockResolvedValue(null);
      mockPrismaService.department.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`name`)',
          { code: 'P2002', clientVersion: 'test', meta: { target: ['name'] } },
        ),
      );

      await expect(
        service.update('1', { name: 'Race' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a department', async () => {
      const mockDepartment = {
        id: '1',
        name: 'IT',
        _count: { users: 0, services: 0 },
      };

      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.department.delete.mockResolvedValue(mockDepartment);

      await service.remove('1');

      expect(mockPrismaService.department.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
