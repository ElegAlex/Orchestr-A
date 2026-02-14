import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleManagementController } from './role-management.controller';
import { RoleManagementService } from './role-management.service';

describe('RoleManagementController', () => {
  let controller: RoleManagementController;

  const mockRoleManagementService = {
    findAllRoles: vi.fn(),
    findOneRole: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    removeRole: vi.fn(),
    findAllPermissions: vi.fn(),
    replaceRolePermissions: vi.fn(),
    seedPermissionsAndRoles: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleManagementController],
      providers: [
        {
          provide: RoleManagementService,
          useValue: mockRoleManagementService,
        },
      ],
    }).compile();

    controller = module.get<RoleManagementController>(
      RoleManagementController,
    );
  });

  describe('findAllRoles', () => {
    it('should return all roles', async () => {
      const mockRoles = [
        { id: '1', code: 'ADMIN', name: 'Administrateur', permissions: [] },
      ];

      mockRoleManagementService.findAllRoles.mockResolvedValue(mockRoles);

      const result = await controller.findAllRoles();

      expect(result).toEqual(mockRoles);
      expect(mockRoleManagementService.findAllRoles).toHaveBeenCalled();
    });
  });

  describe('createRole', () => {
    it('should create a custom role', async () => {
      const createRoleDto = {
        code: 'CUSTOM_ROLE',
        name: 'Rôle personnalisé',
        description: 'Description',
      };

      const mockRole = {
        id: '1',
        ...createRoleDto,
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRoleManagementService.createRole.mockResolvedValue(mockRole);

      const result = await controller.createRole(createRoleDto);

      expect(result).toEqual(mockRole);
      expect(mockRoleManagementService.createRole).toHaveBeenCalledWith(
        createRoleDto,
      );
    });
  });

  describe('findOneRole', () => {
    it('should return a single role', async () => {
      const mockRole = {
        id: '1',
        code: 'ADMIN',
        name: 'Administrateur',
        permissions: [],
      };

      mockRoleManagementService.findOneRole.mockResolvedValue(mockRole);

      const result = await controller.findOneRole('1');

      expect(result).toEqual(mockRole);
      expect(mockRoleManagementService.findOneRole).toHaveBeenCalledWith('1');
    });
  });

  describe('updateRole', () => {
    it('should update a role', async () => {
      const updateRoleDto = {
        name: 'Nouveau nom',
        description: 'Nouvelle description',
      };

      const mockRole = {
        id: '1',
        code: 'CUSTOM_ROLE',
        ...updateRoleDto,
      };

      mockRoleManagementService.updateRole.mockResolvedValue(mockRole);

      const result = await controller.updateRole('1', updateRoleDto);

      expect(result).toEqual(mockRole);
      expect(mockRoleManagementService.updateRole).toHaveBeenCalledWith(
        '1',
        updateRoleDto,
      );
    });
  });

  describe('removeRole', () => {
    it('should remove a role', async () => {
      const mockResponse = { message: 'Rôle supprimé avec succès' };

      mockRoleManagementService.removeRole.mockResolvedValue(mockResponse);

      const result = await controller.removeRole('1');

      expect(result).toEqual(mockResponse);
      expect(mockRoleManagementService.removeRole).toHaveBeenCalledWith('1');
    });
  });

  describe('findAllPermissions', () => {
    it('should return all permissions grouped by module', async () => {
      const mockPermissions = {
        projects: [
          { id: '1', code: 'projects:create', module: 'projects', action: 'create' },
          { id: '2', code: 'projects:read', module: 'projects', action: 'read' },
        ],
        tasks: [
          { id: '3', code: 'tasks:create', module: 'tasks', action: 'create' },
        ],
      };

      mockRoleManagementService.findAllPermissions.mockResolvedValue(
        mockPermissions,
      );

      const result = await controller.findAllPermissions();

      expect(result).toEqual(mockPermissions);
      expect(mockRoleManagementService.findAllPermissions).toHaveBeenCalled();
    });
  });

  describe('replaceRolePermissions', () => {
    it('should replace role permissions', async () => {
      const assignPermissionDto = {
        permissionIds: ['perm-1', 'perm-2'],
      };

      const mockRole = {
        id: '1',
        code: 'CUSTOM_ROLE',
        permissions: [
          { permission: { id: 'perm-1', code: 'projects:create' } },
          { permission: { id: 'perm-2', code: 'projects:read' } },
        ],
      };

      mockRoleManagementService.replaceRolePermissions.mockResolvedValue(
        mockRole,
      );

      const result = await controller.replaceRolePermissions(
        '1',
        assignPermissionDto,
      );

      expect(result).toEqual(mockRole);
      expect(
        mockRoleManagementService.replaceRolePermissions,
      ).toHaveBeenCalledWith('1', ['perm-1', 'perm-2']);
    });
  });

  describe('seedPermissionsAndRoles', () => {
    it('should seed permissions and roles', async () => {
      const mockResponse = {
        message: 'Permissions et rôles créés avec succès',
      };

      mockRoleManagementService.seedPermissionsAndRoles.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.seedPermissionsAndRoles();

      expect(result).toEqual(mockResponse);
      expect(
        mockRoleManagementService.seedPermissionsAndRoles,
      ).toHaveBeenCalled();
    });
  });
});
