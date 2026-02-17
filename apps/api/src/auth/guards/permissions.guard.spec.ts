/* eslint-disable @typescript-eslint/unbound-method */
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, User } from '@prisma/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PermissionsGuard } from './permissions.guard';
import { RoleManagementService } from '../../role-management/role-management.service';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let roleManagementService: RoleManagementService;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'CONTRIBUTEUR' as Role,
    password: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
    departmentId: null,
    serviceId: null,
    isActive: true,
    preferredTheme: null,
    preferredLocale: null,
  };

  const mockRoleManagementService = {
    getPermissionsForRole: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: vi.fn(),
          },
        },
        {
          provide: RoleManagementService,
          useValue: mockRoleManagementService,
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
    roleManagementService = module.get<RoleManagementService>(
      RoleManagementService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockExecutionContext = (user?: User): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: vi.fn(),
      getClass: vi.fn(),
    } as any;
  };

  describe('canActivate', () => {
    it('should allow access when no @Permissions() decorator is present', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockExecutionContext(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(
        roleManagementService.getPermissionsForRole,
      ).not.toHaveBeenCalled();
    });

    it('should allow access when @Permissions() decorator is empty', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
      const context = createMockExecutionContext(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(
        roleManagementService.getPermissionsForRole,
      ).not.toHaveBeenCalled();
    });

    it('should deny access when user is not authenticated', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        'tasks:create',
      ]);
      const context = createMockExecutionContext(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(
        roleManagementService.getPermissionsForRole,
      ).not.toHaveBeenCalled();
    });

    it('should deny access when user has no role', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        'tasks:create',
      ]);
      const userWithoutRole = { ...mockUser, role: null };
      const context = createMockExecutionContext(userWithoutRole as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(
        roleManagementService.getPermissionsForRole,
      ).not.toHaveBeenCalled();
    });

    it('should allow access when user has the required permission', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        'tasks:create_orphan',
      ]);
      mockRoleManagementService.getPermissionsForRole.mockResolvedValue([
        'tasks:create_orphan',
        'tasks:read',
        'events:create',
      ]);
      const context = createMockExecutionContext(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(roleManagementService.getPermissionsForRole).toHaveBeenCalledWith(
        'CONTRIBUTEUR',
      );
    });

    it('should allow access when user has all required permissions', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        'tasks:read',
        'tasks:create_orphan',
      ]);
      mockRoleManagementService.getPermissionsForRole.mockResolvedValue([
        'tasks:create_orphan',
        'tasks:read',
        'tasks:update',
        'events:create',
      ]);
      const context = createMockExecutionContext(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(roleManagementService.getPermissionsForRole).toHaveBeenCalledWith(
        'CONTRIBUTEUR',
      );
    });

    it('should deny access when user lacks the required permission', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        'projects:create',
      ]);
      mockRoleManagementService.getPermissionsForRole.mockResolvedValue([
        'tasks:create_orphan',
        'tasks:read',
        'events:create',
      ]);
      const context = createMockExecutionContext(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(roleManagementService.getPermissionsForRole).toHaveBeenCalledWith(
        'CONTRIBUTEUR',
      );
    });

    it('should deny access when user lacks one of multiple required permissions', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        'tasks:read',
        'tasks:delete',
      ]);
      mockRoleManagementService.getPermissionsForRole.mockResolvedValue([
        'tasks:create_orphan',
        'tasks:read',
        'tasks:update',
      ]);
      const context = createMockExecutionContext(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(roleManagementService.getPermissionsForRole).toHaveBeenCalledWith(
        'CONTRIBUTEUR',
      );
    });

    it('should use cache from RoleManagementService (Redis)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['tasks:read']);
      mockRoleManagementService.getPermissionsForRole.mockResolvedValue([
        'tasks:read',
      ]);
      const context = createMockExecutionContext(mockUser);

      await guard.canActivate(context);
      await guard.canActivate(context);

      // Verify that getPermissionsForRole was called twice
      // (Redis cache is handled internally by RoleManagementService)
      expect(roleManagementService.getPermissionsForRole).toHaveBeenCalledTimes(
        2,
      );
    });

    it('should work with ADMIN role having all permissions', async () => {
      const adminUser = { ...mockUser, role: 'ADMIN' as Role };
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        'projects:create',
        'projects:delete',
        'users:manage_roles',
      ]);
      mockRoleManagementService.getPermissionsForRole.mockResolvedValue([
        'projects:create',
        'projects:read',
        'projects:update',
        'projects:delete',
        'users:manage_roles',
        'settings:update',
        // ... all permissions
      ]);
      const context = createMockExecutionContext(adminUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(roleManagementService.getPermissionsForRole).toHaveBeenCalledWith(
        'ADMIN',
      );
    });

    it('should work with OBSERVATEUR role having only read permissions', async () => {
      const observateurUser = { ...mockUser, role: 'OBSERVATEUR' as Role };
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        'projects:read',
      ]);
      mockRoleManagementService.getPermissionsForRole.mockResolvedValue([
        'projects:read',
        'tasks:read',
        'events:read',
      ]);
      const context = createMockExecutionContext(observateurUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(roleManagementService.getPermissionsForRole).toHaveBeenCalledWith(
        'OBSERVATEUR',
      );
    });
  });
});
