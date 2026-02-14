import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleManagementService } from './role-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

// Mock ioredis module
vi.mock('ioredis', () => ({
  default: class {
    async get() {
      return null;
    }
    async setex() {
      return 'OK';
    }
    async del() {
      return 1;
    }
  },
}));

describe('RoleManagementService', () => {
  let service: RoleManagementService;

  const mockPrismaService = {
    roleConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    permission: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    rolePermission: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };

  const mockConfigService = {
    get: vi.fn().mockReturnValue('redis://localhost:6379'),
  };

  beforeEach(async () => {
    // Mock count pour ne pas déclencher le seed automatique
    mockPrismaService.roleConfig.count.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleManagementService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RoleManagementService>(RoleManagementService);
    await service.onModuleInit();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAllRoles', () => {
    it('should return all roles with permissions', async () => {
      const mockRoles = [
        {
          id: '1',
          code: 'ADMIN',
          name: 'Administrateur',
          description: 'Accès complet',
          isSystem: true,
          isDefault: false,
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.roleConfig.findMany.mockResolvedValue(mockRoles);

      const result = await service.findAllRoles();

      expect(result).toEqual(mockRoles);
      expect(mockPrismaService.roleConfig.findMany).toHaveBeenCalledWith({
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });
  });

  describe('findOneRole', () => {
    it('should return a role with permissions', async () => {
      const mockRole = {
        id: '1',
        code: 'ADMIN',
        name: 'Administrateur',
        permissions: [],
      };

      mockPrismaService.roleConfig.findUnique.mockResolvedValue(mockRole);

      const result = await service.findOneRole('1');

      expect(result).toEqual(mockRole);
    });

    it('should throw NotFoundException when role not found', async () => {
      mockPrismaService.roleConfig.findUnique.mockResolvedValue(null);

      await expect(service.findOneRole('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createRole', () => {
    const createRoleDto = {
      code: 'CUSTOM_ROLE',
      name: 'Rôle personnalisé',
      description: 'Description',
    };

    it('should create a custom role', async () => {
      const mockRole = {
        id: '1',
        code: 'CUSTOM_ROLE',
        name: 'Rôle personnalisé',
        description: 'Description',
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.roleConfig.findUnique.mockResolvedValue(null);
      mockPrismaService.roleConfig.create.mockResolvedValue(mockRole);

      const result = await service.createRole(createRoleDto);

      expect(result).toEqual(mockRole);
      expect(mockPrismaService.roleConfig.create).toHaveBeenCalledWith({
        data: {
          code: 'CUSTOM_ROLE',
          name: 'Rôle personnalisé',
          description: 'Description',
          isSystem: false,
        },
      });
    });

    it('should throw ConflictException when code already exists', async () => {
      mockPrismaService.roleConfig.findUnique.mockResolvedValue({
        id: '1',
        code: 'CUSTOM_ROLE',
      });

      await expect(service.createRole(createRoleDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateRole', () => {
    const updateRoleDto = {
      name: 'Nouveau nom',
      description: 'Nouvelle description',
    };

    it('should update a role', async () => {
      const mockRole = {
        id: '1',
        code: 'CUSTOM_ROLE',
        name: 'Ancien nom',
      };

      const updatedRole = {
        ...mockRole,
        ...updateRoleDto,
      };

      mockPrismaService.roleConfig.findUnique.mockResolvedValue(mockRole);
      mockPrismaService.roleConfig.update.mockResolvedValue(updatedRole);

      const result = await service.updateRole('1', updateRoleDto);

      expect(result).toEqual(updatedRole);
    });

    it('should throw NotFoundException when role not found', async () => {
      mockPrismaService.roleConfig.findUnique.mockResolvedValue(null);

      await expect(service.updateRole('999', updateRoleDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeRole', () => {
    it('should remove a custom role', async () => {
      const mockRole = {
        id: '1',
        code: 'CUSTOM_ROLE',
        isSystem: false,
      };

      mockPrismaService.roleConfig.findUnique.mockResolvedValue(mockRole);
      mockPrismaService.roleConfig.delete.mockResolvedValue(mockRole);

      const result = await service.removeRole('1');

      expect(result).toEqual({ message: 'Rôle supprimé avec succès' });
      expect(mockPrismaService.roleConfig.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw BadRequestException when trying to delete system role', async () => {
      mockPrismaService.roleConfig.findUnique.mockResolvedValue({
        id: '1',
        code: 'ADMIN',
        isSystem: true,
      });

      await expect(service.removeRole('1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when role not found', async () => {
      mockPrismaService.roleConfig.findUnique.mockResolvedValue(null);

      await expect(service.removeRole('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllPermissions', () => {
    it('should return permissions grouped by module', async () => {
      const mockPermissions = [
        {
          id: '1',
          code: 'projects:create',
          module: 'projects',
          action: 'create',
        },
        {
          id: '2',
          code: 'projects:read',
          module: 'projects',
          action: 'read',
        },
        {
          id: '3',
          code: 'tasks:create',
          module: 'tasks',
          action: 'create',
        },
      ];

      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions);

      const result = await service.findAllPermissions();

      expect(result).toEqual({
        projects: [mockPermissions[0], mockPermissions[1]],
        tasks: [mockPermissions[2]],
      });
    });
  });

  describe('replaceRolePermissions', () => {
    it('should replace role permissions', async () => {
      const mockRole = {
        id: '1',
        code: 'CUSTOM_ROLE',
        permissions: [],
      };

      const mockPermissions = [
        { id: 'perm-1', code: 'projects:create' },
        { id: 'perm-2', code: 'projects:read' },
      ];

      mockPrismaService.roleConfig.findUnique.mockResolvedValue(mockRole);
      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions);
      mockPrismaService.rolePermission.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.rolePermission.createMany.mockResolvedValue({
        count: 2,
      });

      vi.spyOn(service, 'findOneRole').mockResolvedValue(mockRole as any);

      const result = await service.replaceRolePermissions('1', [
        'perm-1',
        'perm-2',
      ]);

      expect(result).toEqual(mockRole);
      expect(mockPrismaService.rolePermission.deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          { roleConfigId: '1', permissionId: 'perm-1' },
          { roleConfigId: '1', permissionId: 'perm-2' },
        ],
      });
    });

    it('should throw NotFoundException when role not found', async () => {
      mockPrismaService.roleConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.replaceRolePermissions('999', ['perm-1']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when permission not found', async () => {
      mockPrismaService.roleConfig.findUnique.mockResolvedValue({
        id: '1',
        code: 'CUSTOM_ROLE',
      });
      mockPrismaService.permission.findMany.mockResolvedValue([]);

      await expect(
        service.replaceRolePermissions('1', ['invalid-perm']),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPermissionsForRole', () => {
    it('should return permissions from database when cache miss', async () => {
      const mockRole = {
        code: 'ADMIN',
        permissions: [
          { permission: { code: 'projects:create' } },
          { permission: { code: 'projects:read' } },
        ],
      };

      mockPrismaService.roleConfig.findUnique.mockResolvedValue(mockRole);

      const result = await service.getPermissionsForRole('ADMIN');

      expect(result).toEqual(['projects:create', 'projects:read']);
    });

    it('should return empty array when role not found', async () => {
      mockPrismaService.roleConfig.findUnique.mockResolvedValue(null);

      const result = await service.getPermissionsForRole('INVALID');

      expect(result).toEqual([]);
    });
  });

  describe('seedPermissionsAndRoles', () => {
    it('should seed permissions and roles', async () => {
      mockPrismaService.permission.upsert.mockResolvedValue({
        id: 'perm-1',
        code: 'projects:create',
      });
      mockPrismaService.roleConfig.upsert.mockResolvedValue({
        id: 'role-1',
        code: 'ADMIN',
      });
      mockPrismaService.rolePermission.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.rolePermission.createMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.seedPermissionsAndRoles();

      expect(result).toEqual({
        message: 'Permissions et rôles créés avec succès',
      });
      expect(mockPrismaService.permission.upsert).toHaveBeenCalled();
      expect(mockPrismaService.roleConfig.upsert).toHaveBeenCalled();
    });
  });
});
