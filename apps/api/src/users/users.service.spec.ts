import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock fs/promises for avatar tests
vi.mock('fs', async () => {
  return {
    promises: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      unlink: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock assertMagicBytes so it doesn't need real file bytes
vi.mock('../common/upload/magic-bytes.validator', () => ({
  assertMagicBytes: vi.fn().mockResolvedValue(undefined),
}));
import { RefreshTokenService } from '../auth/refresh-token.service';
import { RoleHierarchyService } from '../common/services/role-hierarchy.service';
import { AccessScopeService } from '../common/services/access-scope.service';
import { AuditService } from '../audit/audit.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { ForbiddenException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  const mockAuditPersistence = { log: vi.fn().mockResolvedValue(undefined) };
  const mockAuditService = { log: vi.fn() };

  const mockPrismaService = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    userService: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    projectMember: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    leave: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    personalTodo: {
      deleteMany: vi.fn(),
    },
    timeEntry: {
      deleteMany: vi.fn(),
    },
    comment: {
      deleteMany: vi.fn(),
    },
    userSkill: {
      deleteMany: vi.fn(),
    },
    teleworkSchedule: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    event: {
      findMany: vi.fn(),
    },
    leaveValidationDelegate: {
      deleteMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RefreshTokenService,
          useValue: { revokeAllForUser: vi.fn().mockResolvedValue(undefined) },
        },
        // Use the REAL RoleHierarchyService against the mock prisma. The
        // Issue 1 "hierarchy gate" tests stub `prisma.role.findUnique` and
        // rely on the assertion calling through; mocking the service flat
        // would silently make those tests pass when they shouldn't.
        RoleHierarchyService,
        // Same rationale for AccessScopeService: SEC-002 horizontal-scope
        // tests stub prisma to drive its real branches; a flat mock would
        // silently pass.
        {
          provide: AccessScopeService,
          useFactory: (prisma: PrismaService) =>
            new AccessScopeService(prisma, {
              getPermissionsForRole: vi.fn().mockResolvedValue([]),
            } as never),
          inject: [PrismaService],
        },
        { provide: AuditService, useValue: mockAuditService },
        { provide: AuditPersistenceService, useValue: mockAuditPersistence },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto = {
      email: 'newuser@example.com',
      login: 'newuser',
      password: 'Password1!',
      firstName: 'New',
      lastName: 'User',
      roleCode: 'CONTRIBUTEUR',
      departmentId: 'dept-1',
      serviceIds: ['service-1'],
    };

    it('should create a new user successfully', async () => {
      const mockDepartment = { id: 'dept-1', name: 'IT' };
      const mockServices = [{ id: 'service-1', name: 'Development' }];
      const mockCreatedUser = {
        id: '1',
        email: createUserDto.email,
        login: createUserDto.login,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: {
          id: 'role-contrib',
          code: 'CONTRIBUTEUR',
          label: 'Contributeur',
          templateKey: 'CONTRIBUTOR',
          isSystem: true,
        },
        roleId: 'role-contrib',
        departmentId: createUserDto.departmentId,
        avatarUrl: null,
        isActive: true,
        createdAt: new Date(),
        department: mockDepartment,
        userServices: [],
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.service.findMany.mockResolvedValue(mockServices);
      mockPrismaService.role.findUnique.mockResolvedValue({
        id: 'role-contrib',
      });
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);
      mockPrismaService.userService.createMany.mockResolvedValue({ count: 1 });

      const result = await service.create(createUserDto);

      expect(result).toBeDefined();
      expect(result.email).toBe(createUserDto.email);
      expect(result.login).toBe(createUserDto.login);
    });

    it('should throw error when email already exists', async () => {
      const existingUser = {
        id: '1',
        email: createUserDto.email,
        login: 'otheruser',
      };
      mockPrismaService.user.findFirst.mockResolvedValue(existingUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        'Cet email est déjà utilisé',
      );
    });

    it('should throw error when login already exists', async () => {
      const existingUser = {
        id: '1',
        email: 'other@example.com',
        login: createUserDto.login,
      };
      mockPrismaService.user.findFirst.mockResolvedValue(existingUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        'Ce login est déjà utilisé',
      );
    });

    it('should throw error when department does not exist', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.department.findUnique.mockResolvedValue(null);

      await expect(service.create(createUserDto)).rejects.toThrow(
        'Département introuvable',
      );
    });

    it('should throw error when services do not exist', async () => {
      const mockDepartment = { id: 'dept-1', name: 'IT' };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.service.findMany.mockResolvedValue([]);

      await expect(service.create(createUserDto)).rejects.toThrow(
        'Un ou plusieurs services introuvables',
      );
    });

    describe('hierarchy gate', () => {
      const adminTargetDto = {
        ...createUserDto,
        email: 'newadmin@example.com',
        login: 'newadmin',
        roleCode: 'INSTITUTIONAL_ADMIN',
      };

      function mockRoleLookups(
        roleByCode: Record<
          string,
          { id?: string; templateKey: string; isSystem?: boolean } | null
        >,
      ) {
        mockPrismaService.role.findUnique.mockImplementation((args: any) => {
          const code = args?.where?.code;
          const role = roleByCode[code] ?? null;
          return Promise.resolve(role);
        });
      }

      it('throws ForbiddenException when ADMIN_DELEGATED tries to assign ADMIN-template role', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.department.findUnique.mockResolvedValue({
          id: 'dept-1',
          name: 'IT',
        });
        mockPrismaService.service.findMany.mockResolvedValue([
          { id: 'service-1', name: 'Dev' },
        ]);
        mockRoleLookups({
          INSTITUTIONAL_ADMIN: {
            id: 'role-inst-admin',
            templateKey: 'ADMIN',
            isSystem: false,
          },
          RESPONSABLE: { templateKey: 'ADMIN_DELEGATED' },
        });

        await expect(service.create(adminTargetDto, 'RESPONSABLE')).rejects.toThrow(
          'administrateur',
        );
        expect(mockPrismaService.user.create).not.toHaveBeenCalled();
      });

      it('throws ForbiddenException when caller rank is not strictly higher than target', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.department.findUnique.mockResolvedValue({
          id: 'dept-1',
          name: 'IT',
        });
        mockPrismaService.service.findMany.mockResolvedValue([
          { id: 'service-1', name: 'Dev' },
        ]);
        mockRoleLookups({
          PEER_MANAGER: {
            id: 'role-peer',
            templateKey: 'MANAGER',
            isSystem: false,
          },
          MANAGER_CALLER: { templateKey: 'MANAGER' },
        });

        await expect(
          service.create(
            { ...createUserDto, roleCode: 'PEER_MANAGER' },
            'MANAGER_CALLER',
          ),
        ).rejects.toThrow('rôles inférieurs');
        expect(mockPrismaService.user.create).not.toHaveBeenCalled();
      });

      it('allows ADMIN to assign an institutional role bound to ADMIN template', async () => {
        const mockDepartment = { id: 'dept-1', name: 'IT' };
        const mockServices = [{ id: 'service-1', name: 'Dev' }];
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
        mockPrismaService.service.findMany.mockResolvedValue(mockServices);
        mockRoleLookups({
          INSTITUTIONAL_ADMIN: {
            id: 'role-inst-admin',
            templateKey: 'ADMIN',
            isSystem: false,
          },
          ADMIN: { templateKey: 'ADMIN' },
        });
        mockPrismaService.user.create.mockResolvedValue({
          id: 'new-admin',
          email: adminTargetDto.email,
          login: adminTargetDto.login,
          firstName: 'New',
          lastName: 'Admin',
          roleId: 'role-inst-admin',
          role: {
            id: 'role-inst-admin',
            code: 'INSTITUTIONAL_ADMIN',
            label: 'Admin institutionnel',
            templateKey: 'ADMIN',
            isSystem: false,
          },
          departmentId: 'dept-1',
          avatarUrl: null,
          isActive: true,
          createdAt: new Date(),
          department: mockDepartment,
          userServices: [],
        });
        mockPrismaService.userService.createMany.mockResolvedValue({ count: 1 });

        const result = await service.create(adminTargetDto, 'ADMIN');

        expect(result.email).toBe(adminTargetDto.email);
        expect(mockPrismaService.user.create).toHaveBeenCalled();
      });

      it('allows ADMIN_DELEGATED to assign a strictly lower rank role', async () => {
        const mockDepartment = { id: 'dept-1', name: 'IT' };
        const mockServices = [{ id: 'service-1', name: 'Dev' }];
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
        mockPrismaService.service.findMany.mockResolvedValue(mockServices);
        mockRoleLookups({
          CONTRIBUTEUR: {
            id: 'role-contrib',
            templateKey: 'PROJECT_CONTRIBUTOR',
            isSystem: false,
          },
          RESPONSABLE: { templateKey: 'ADMIN_DELEGATED' },
        });
        mockPrismaService.user.create.mockResolvedValue({
          id: 'new-1',
          email: createUserDto.email,
          login: createUserDto.login,
          firstName: 'New',
          lastName: 'User',
          roleId: 'role-contrib',
          role: {
            id: 'role-contrib',
            code: 'CONTRIBUTEUR',
            label: 'Contributeur',
            templateKey: 'PROJECT_CONTRIBUTOR',
            isSystem: false,
          },
          departmentId: 'dept-1',
          avatarUrl: null,
          isActive: true,
          createdAt: new Date(),
          department: mockDepartment,
          userServices: [],
        });
        mockPrismaService.userService.createMany.mockResolvedValue({ count: 1 });

        const result = await service.create(createUserDto, 'RESPONSABLE');

        expect(result.email).toBe(createUserDto.email);
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'user1@example.com',
          login: 'user1',
          firstName: 'User',
          lastName: 'One',
          role: 'USER',
          isActive: true,
        },
        {
          id: '2',
          email: 'user2@example.com',
          login: 'user2',
          firstName: 'User',
          lastName: 'Two',
          role: 'USER',
          isActive: true,
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(2);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter users by role', async () => {
      const mockAdmins = [
        {
          id: '1',
          email: 'admin@example.com',
          login: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          role: {
            id: 'role-admin',
            code: 'ADMIN',
            label: 'Administrateur',
            templateKey: 'ADMIN',
            isSystem: true,
          },
          isActive: true,
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockAdmins);
      mockPrismaService.user.count.mockResolvedValue(1);

      await service.findAll(1, 50, 'ADMIN');

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: { code: 'ADMIN' } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const mockUser = {
        id: '1',
        email: 'user@example.com',
        login: 'user',
        firstName: 'User',
        lastName: 'Test',
        role: 'USER',
        isActive: true,
        departmentId: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
      expect(result.email).toBe('user@example.com');
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Utilisateur introuvable',
      );
    });
  });

  describe('update', () => {
    const updateUserDto = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update a user successfully', async () => {
      const existingUser = {
        id: '1',
        email: 'user@example.com',
        login: 'user',
        passwordHash: 'hashed',
        firstName: 'Old',
        lastName: 'Name',
        role: 'USER',
        isActive: true,
        departmentId: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser = { ...existingUser, ...updateUserDto };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('1', updateUserDto, 'ADMIN');

      expect(result).toBeDefined();
      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', updateUserDto, 'ADMIN'),
      ).rejects.toThrow('Utilisateur introuvable');
    });

    // SEC-002 — horizontal scope: ADMIN_DELEGATED (or any non-ADMIN holder of
    // users:update) must not be able to edit a target outside their dept /
    // shared-service perimeter.
    describe('horizontal scope (SEC-002)', () => {
      const callerOutOfScope = {
        id: 'caller-delegated-1',
        role: { code: 'INSTITUTIONAL_DELEGATED', templateKey: 'ADMIN_DELEGATED' },
      };
      const callerAdmin = {
        id: 'caller-admin-1',
        role: { code: 'ADMIN', templateKey: 'ADMIN' },
      };
      const targetId = 'target-user-1';

      it('forbids non-ADMIN caller when target is outside dept and shares no service', async () => {
        // user.count(target) > 0 (target exists), then canManageUser checks:
        //   - department.count(caller manages target dept) → 0
        //   - userService.count(caller shares a service)   → 0
        mockPrismaService.user.count.mockResolvedValueOnce(1);
        mockPrismaService.user.findUnique.mockResolvedValueOnce({
          departmentId: 'dept-foreign',
          userServices: [{ serviceId: 'svc-foreign' }],
        });
        mockPrismaService.department.count.mockResolvedValueOnce(0);
        mockPrismaService.userService.count.mockResolvedValueOnce(0);

        await expect(
          service.update(targetId, updateUserDto, 'INSTITUTIONAL_DELEGATED', callerOutOfScope),
        ).rejects.toThrow('périmètre');
        expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      });

      it('allows non-ADMIN caller when caller manages the target department', async () => {
        const updated = { id: targetId, firstName: 'Updated' };
        mockPrismaService.user.count.mockResolvedValueOnce(1);
        mockPrismaService.user.findUnique.mockResolvedValueOnce({
          departmentId: 'dept-managed',
          userServices: [],
        });
        mockPrismaService.department.count.mockResolvedValueOnce(1);
        mockPrismaService.user.findUnique.mockResolvedValueOnce({
          id: targetId,
        });
        mockPrismaService.user.update.mockResolvedValueOnce(updated);

        const result = await service.update(
          targetId,
          updateUserDto,
          'INSTITUTIONAL_DELEGATED',
          callerOutOfScope,
        );
        expect(result).toEqual(updated);
      });

      it('allows non-ADMIN caller when caller shares a service with the target', async () => {
        const updated = { id: targetId, firstName: 'Updated' };
        mockPrismaService.user.count.mockResolvedValueOnce(1);
        mockPrismaService.user.findUnique.mockResolvedValueOnce({
          departmentId: 'dept-foreign',
          userServices: [{ serviceId: 'svc-shared' }],
        });
        mockPrismaService.department.count.mockResolvedValueOnce(0);
        mockPrismaService.userService.count.mockResolvedValueOnce(1);
        mockPrismaService.user.findUnique.mockResolvedValueOnce({
          id: targetId,
        });
        mockPrismaService.user.update.mockResolvedValueOnce(updated);

        const result = await service.update(
          targetId,
          updateUserDto,
          'INSTITUTIONAL_DELEGATED',
          callerOutOfScope,
        );
        expect(result).toEqual(updated);
      });

      it('allows ADMIN caller globally without scope lookups', async () => {
        const updated = { id: targetId, firstName: 'Updated' };
        mockPrismaService.user.count.mockResolvedValueOnce(1);
        mockPrismaService.user.findUnique.mockResolvedValueOnce({
          id: targetId,
        });
        mockPrismaService.user.update.mockResolvedValueOnce(updated);

        const result = await service.update(
          targetId,
          updateUserDto,
          'ADMIN',
          callerAdmin,
        );
        expect(result).toEqual(updated);
        // ADMIN bypass: no dept / userService lookups consumed.
        expect(mockPrismaService.department.count).not.toHaveBeenCalled();
        expect(mockPrismaService.userService.count).not.toHaveBeenCalled();
      });

      it('forbids remove() for non-ADMIN caller outside the target perimeter', async () => {
        mockPrismaService.user.count.mockResolvedValueOnce(1);
        mockPrismaService.user.findUnique.mockResolvedValueOnce({
          departmentId: 'dept-foreign',
          userServices: [{ serviceId: 'svc-foreign' }],
        });
        mockPrismaService.department.count.mockResolvedValueOnce(0);
        mockPrismaService.userService.count.mockResolvedValueOnce(0);

        await expect(
          service.remove(targetId, callerOutOfScope),
        ).rejects.toThrow('périmètre');
        expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('remove', () => {
    it('should soft delete a user (set isActive to false)', async () => {
      const mockUser = {
        id: '1',
        email: 'user@example.com',
        login: 'user',
        firstName: 'User',
        lastName: 'Test',
        role: 'USER',
        isActive: true,
        departmentId: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const deactivatedUser = { ...mockUser, isActive: false };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(deactivatedUser);

      await service.remove('1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
      });
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        'Utilisateur introuvable',
      );
    });
  });

  // AUD-EMIT-001 — live ROLE_CHANGE / USER_DEACTIVATED emitters on user
  // mutations. Witness spies AuditPersistenceService.log and asserts the
  // emission shape. Actor is the caller (caller.id → actorId); emission is
  // skipped entirely when caller is undefined (SEC-003 callerId-optional
  // precedent), so all witnesses pass a real ADMIN caller.
  describe('audit emission (AUD-EMIT-001)', () => {
    const callerAdmin = {
      id: 'caller-admin-1',
      role: { code: 'ADMIN', templateKey: 'ADMIN' },
    };

    it('emits ROLE_CHANGE with before/after roleCode when roleId changes', async () => {
      // assertCanManageUser: exists check (ADMIN template bypasses scope).
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      // update() loads the target enriched with role.code (before snapshot).
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        roleId: 'role-old',
        isActive: true,
        role: { code: 'CONTRIBUTEUR' },
      });
      // RoleHierarchyService.assertCanAssignRole + resolveAssignableRoleIdByCode.
      mockPrismaService.role.findUnique.mockImplementation((args: any) => {
        const code = args?.where?.code;
        if (code === 'MANAGER')
          return Promise.resolve({
            id: 'role-manager',
            templateKey: 'MANAGER',
            isSystem: false,
          });
        if (code === 'ADMIN') return Promise.resolve({ templateKey: 'ADMIN' });
        return Promise.resolve(null);
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: true,
        role: { code: 'MANAGER' },
      });

      await service.update(
        'target-1',
        { roleCode: 'MANAGER' },
        'ADMIN',
        callerAdmin,
      );

      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_CHANGE',
          entityType: 'User',
          entityId: 'target-1',
          actorId: 'caller-admin-1',
          payload: expect.objectContaining({
            before: { roleCode: 'CONTRIBUTEUR' },
            after: { roleCode: 'MANAGER' },
          }),
        }),
      );
    });

    it('emits USER_DEACTIVATED when isActive transitions true→false via update()', async () => {
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        roleId: 'role-x',
        isActive: true,
        role: { code: 'CONTRIBUTEUR' },
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: false,
        role: { code: 'CONTRIBUTEUR' },
      });

      await service.update(
        'target-1',
        { isActive: false },
        'ADMIN',
        callerAdmin,
      );

      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_DEACTIVATED',
          entityType: 'User',
          entityId: 'target-1',
          actorId: 'caller-admin-1',
          payload: expect.objectContaining({
            before: { isActive: true },
            after: { isActive: false },
          }),
        }),
      );
    });

    it('emits USER_DEACTIVATED when remove() soft-deletes an active user', async () => {
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        isActive: true,
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: false,
      });

      await service.remove('target-1', callerAdmin);

      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_DEACTIVATED',
          entityType: 'User',
          entityId: 'target-1',
          actorId: 'caller-admin-1',
          payload: expect.objectContaining({
            before: { isActive: true },
            after: { isActive: false },
          }),
        }),
      );
    });

    it('does not emit when neither roleId nor isActive changes', async () => {
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      // OBS-004 — departmentId is now an audited field, so the no-op fixture
      // must set the existing departmentId to the SAME value the DTO carries
      // (genuine no-op), otherwise DEPARTMENT_CHANGED would legitimately fire.
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        roleId: 'role-x',
        isActive: true,
        departmentId: 'dept-x',
        role: { code: 'CONTRIBUTEUR' },
      });
      mockPrismaService.department.findUnique.mockResolvedValueOnce({
        id: 'dept-x',
        name: 'IT',
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: true,
        departmentId: 'dept-x',
        role: { code: 'CONTRIBUTEUR' },
      });

      await service.update(
        'target-1',
        { departmentId: 'dept-x' },
        'ADMIN',
        callerAdmin,
      );

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });
  });

  // OBS-004 — extends AUD-EMIT-001's emitter coverage to the remaining
  // role/admin user mutations. USER_REACTIVATED / DEPARTMENT_CHANGED /
  // SERVICE_MEMBERSHIP_CHANGED land in update(); PASSWORD_RESET_BY_ADMIN is
  // the SEC-003 admin-reset durable emit, renamed from the free-string
  // 'PASSWORD_RESET_ADMIN' to the AuditAction enum. Same spy-on-
  // AuditPersistenceService pattern, same caller-as-actor + no-op invariants.
  describe('audit emission (OBS-004)', () => {
    const callerAdmin = {
      id: 'caller-admin-1',
      role: { code: 'ADMIN', templateKey: 'ADMIN' },
    };

    it('emits USER_REACTIVATED when isActive transitions false→true via update()', async () => {
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        roleId: 'role-x',
        isActive: false,
        departmentId: 'dept-x',
        role: { code: 'CONTRIBUTEUR' },
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: true,
        role: { code: 'CONTRIBUTEUR' },
      });

      await service.update('target-1', { isActive: true }, 'ADMIN', callerAdmin);

      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_REACTIVATED',
          entityType: 'User',
          entityId: 'target-1',
          actorId: 'caller-admin-1',
          payload: expect.objectContaining({
            before: { isActive: false },
            after: { isActive: true },
          }),
        }),
      );
    });

    it('does not emit USER_REACTIVATED when the user was already active', async () => {
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        roleId: 'role-x',
        isActive: true,
        departmentId: 'dept-x',
        role: { code: 'CONTRIBUTEUR' },
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: true,
        role: { code: 'CONTRIBUTEUR' },
      });

      await service.update('target-1', { isActive: true }, 'ADMIN', callerAdmin);

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    it('emits DEPARTMENT_CHANGED when departmentId transitions via update()', async () => {
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        roleId: 'role-x',
        isActive: true,
        departmentId: 'dept-old',
        role: { code: 'CONTRIBUTEUR' },
      });
      mockPrismaService.department.findUnique.mockResolvedValueOnce({
        id: 'dept-new',
        name: 'Finance',
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: true,
        departmentId: 'dept-new',
        role: { code: 'CONTRIBUTEUR' },
      });

      await service.update(
        'target-1',
        { departmentId: 'dept-new' },
        'ADMIN',
        callerAdmin,
      );

      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DEPARTMENT_CHANGED',
          entityType: 'User',
          entityId: 'target-1',
          actorId: 'caller-admin-1',
          payload: expect.objectContaining({
            before: { departmentId: 'dept-old' },
            after: { departmentId: 'dept-new' },
          }),
        }),
      );
    });

    it('does not emit DEPARTMENT_CHANGED when departmentId is unchanged', async () => {
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        roleId: 'role-x',
        isActive: true,
        departmentId: 'dept-x',
        role: { code: 'CONTRIBUTEUR' },
      });
      mockPrismaService.department.findUnique.mockResolvedValueOnce({
        id: 'dept-x',
        name: 'IT',
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: true,
        departmentId: 'dept-x',
        role: { code: 'CONTRIBUTEUR' },
      });

      await service.update(
        'target-1',
        { departmentId: 'dept-x' },
        'ADMIN',
        callerAdmin,
      );

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    it('emits SERVICE_MEMBERSHIP_CHANGED with added/removed diff when serviceIds differ', async () => {
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        roleId: 'role-x',
        isActive: true,
        departmentId: 'dept-x',
        role: { code: 'CONTRIBUTEUR' },
        userServices: [{ serviceId: 's1' }],
      });
      mockPrismaService.service.findMany.mockResolvedValueOnce([
        { id: 's1' },
        { id: 's2' },
      ]);
      mockPrismaService.userService.deleteMany.mockResolvedValueOnce({
        count: 1,
      });
      mockPrismaService.userService.createMany.mockResolvedValueOnce({
        count: 2,
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: true,
        role: { code: 'CONTRIBUTEUR' },
      });

      await service.update(
        'target-1',
        { serviceIds: ['s1', 's2'] },
        'ADMIN',
        callerAdmin,
      );

      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SERVICE_MEMBERSHIP_CHANGED',
          entityType: 'User',
          entityId: 'target-1',
          actorId: 'caller-admin-1',
          payload: expect.objectContaining({
            before: { serviceIds: ['s1'] },
            after: { serviceIds: ['s1', 's2'] },
            added: ['s2'],
            removed: [],
          }),
        }),
      );
    });

    it('does not emit SERVICE_MEMBERSHIP_CHANGED when the set is identical (order-insensitive)', async () => {
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        roleId: 'role-x',
        isActive: true,
        departmentId: 'dept-x',
        role: { code: 'CONTRIBUTEUR' },
        userServices: [{ serviceId: 's1' }, { serviceId: 's2' }],
      });
      mockPrismaService.service.findMany.mockResolvedValueOnce([
        { id: 's1' },
        { id: 's2' },
      ]);
      mockPrismaService.userService.deleteMany.mockResolvedValueOnce({
        count: 2,
      });
      mockPrismaService.userService.createMany.mockResolvedValueOnce({
        count: 2,
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: true,
        role: { code: 'CONTRIBUTEUR' },
      });

      await service.update(
        'target-1',
        { serviceIds: ['s2', 's1'] },
        'ADMIN',
        callerAdmin,
      );

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    it('emits PASSWORD_RESET_BY_ADMIN (renamed from PASSWORD_RESET_ADMIN) without leaking the password', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          login: 'jdupont',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          role: { code: 'CONTRIBUTEUR' },
        })
        .mockResolvedValueOnce({ role: { code: 'ADMIN' } });
      mockPrismaService.role.findUnique
        .mockResolvedValueOnce({ templateKey: 'CONTRIBUTOR' })
        .mockResolvedValueOnce({ templateKey: 'ADMIN' });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        updatedAt: new Date('2026-05-25T12:00:00.000Z'),
      });

      await service.resetPassword('user-1', 'NewSecret1!', 'caller-admin');

      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_BY_ADMIN',
          entityType: 'User',
          entityId: 'user-1',
          actorId: 'caller-admin',
        }),
      );
      // OBS-001 no-PII regression invariant, extended to the renamed action.
      const auditPayload = mockAuditPersistence.log.mock.calls[0][0].payload;
      expect(JSON.stringify(auditPayload)).not.toContain('NewSecret1!');
      expect(JSON.stringify(auditPayload)).not.toMatch(/\$2[aby]\$/);
    });
  });

  describe('changePassword', () => {
    it('should change user password successfully', async () => {
      const mockUser = {
        id: '1',
        email: 'user@example.com',
        login: 'user',
        passwordHash: await bcrypt.hash('oldpassword', 12),
        firstName: 'User',
        lastName: 'Test',
        role: 'USER',
        isActive: true,
        departmentId: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const changePasswordDto = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        message: 'Mot de passe modifié avec succès',
      });

      const result = await service.changePassword('1', changePasswordDto);

      expect(result).toHaveProperty('message');
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw error when current password is incorrect', async () => {
      const mockUser = {
        id: '1',
        email: 'user@example.com',
        login: 'user',
        passwordHash: await bcrypt.hash('oldpassword', 12),
        firstName: 'User',
        lastName: 'Test',
        role: 'USER',
        isActive: true,
        departmentId: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const changePasswordDto = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.changePassword('1', changePasswordDto),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.changePassword('1', changePasswordDto),
      ).rejects.toThrow('Ancien mot de passe incorrect');
    });

    it('should throw error when user not found', async () => {
      const changePasswordDto = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', changePasswordDto),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.changePassword('nonexistent', changePasswordDto),
      ).rejects.toThrow('Utilisateur introuvable');
    });
  });

  describe('checkDependencies', () => {
    it('should return canDelete true when no dependencies', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.projectMember.count.mockResolvedValue(0);
      mockPrismaService.leave.count.mockResolvedValue(0);
      mockPrismaService.department.count.mockResolvedValue(0);
      mockPrismaService.service.count.mockResolvedValue(0);

      const result = await service.checkDependencies('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.canDelete).toBe(true);
      expect(result.dependencies).toHaveLength(0);
    });

    it('should return canDelete false with dependencies', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      mockPrismaService.task.count.mockResolvedValue(3);
      mockPrismaService.projectMember.count.mockResolvedValue(2);
      mockPrismaService.leave.count.mockResolvedValue(0);
      mockPrismaService.department.count.mockResolvedValue(1);
      mockPrismaService.service.count.mockResolvedValue(0);

      const result = await service.checkDependencies('user-1');

      expect(result.canDelete).toBe(false);
      expect(result.dependencies.length).toBeGreaterThan(0);

      const taskDep = result.dependencies.find((d) => d.type === 'TASKS');
      expect(taskDep).toBeDefined();
      expect(taskDep!.count).toBe(3);

      const projectDep = result.dependencies.find((d) => d.type === 'PROJECTS');
      expect(projectDep).toBeDefined();
      expect(projectDep!.count).toBe(2);

      const deptDep = result.dependencies.find((d) => d.type === 'DEPARTMENTS');
      expect(deptDep).toBeDefined();
      expect(deptDep!.count).toBe(1);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.checkDependencies('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('hardDelete', () => {
    it('should hard delete a user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      // checkDependencies mocks (no dependencies)
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.projectMember.count.mockResolvedValue(0);
      mockPrismaService.leave.count.mockResolvedValue(0);
      mockPrismaService.department.count.mockResolvedValue(0);
      mockPrismaService.service.count.mockResolvedValue(0);
      // Transaction mocks
      mockPrismaService.personalTodo.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.timeEntry.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.comment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.userSkill.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.teleworkSchedule.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.leaveValidationDelegate.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.projectMember.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.userService.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.leave.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.task.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.user.delete.mockResolvedValue({ id: 'user-1' });

      const result = await service.hardDelete('user-1', 'admin-1');

      expect(result).toEqual({
        success: true,
        message: 'Utilisateur supprimé définitivement',
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.hardDelete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.hardDelete('nonexistent')).rejects.toThrow(
        'Utilisateur introuvable',
      );
    });

    it('should throw BadRequestException on self-deletion', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });

      await expect(service.hardDelete('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.hardDelete('user-1', 'user-1')).rejects.toThrow(
        'Vous ne pouvez pas supprimer votre propre compte',
      );
    });

    it('should throw ConflictException when dependencies exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      // checkDependencies mocks (has dependencies)
      mockPrismaService.task.count.mockResolvedValue(5);
      mockPrismaService.projectMember.count.mockResolvedValue(0);
      mockPrismaService.leave.count.mockResolvedValue(0);
      mockPrismaService.department.count.mockResolvedValue(0);
      mockPrismaService.service.count.mockResolvedValue(0);

      await expect(service.hardDelete('user-1', 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('resetPassword', () => {
    const targetUser = {
      id: 'user-1',
      login: 'jdupont',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      role: { code: 'CONTRIBUTEUR' },
    };

    it('should reset password successfully (legacy: no caller)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(targetUser);
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        updatedAt: new Date('2026-05-24T12:00:00.000Z'),
      });

      const result = await service.resetPassword('user-1', 'newpassword123');

      expect(result).toEqual({
        message: 'Mot de passe réinitialisé avec succès',
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { passwordHash: expect.any(String) },
        }),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('nonexistent', 'newpassword123'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.resetPassword('nonexistent', 'newpassword123'),
      ).rejects.toThrow('Utilisateur introuvable');
    });

    describe('hierarchy + self-reset gates (SEC-003)', () => {
      const adminTarget = {
        id: 'admin-target',
        login: 'admin-target',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        role: { code: 'ADMIN' },
      };

      it('rejects self-reset via admin endpoint', async () => {
        mockPrismaService.user.findUnique.mockResolvedValueOnce({
          ...targetUser,
          id: 'caller-self',
        });

        await expect(
          service.resetPassword('caller-self', 'newpassword123', 'caller-self'),
        ).rejects.toThrow(ForbiddenException);

        expect(mockPrismaService.user.update).not.toHaveBeenCalled();
        expect(mockAuditPersistence.log).not.toHaveBeenCalled();
      });

      it('rejects ADMIN_DELEGATED resetting an ADMIN target (escalation vector)', async () => {
        // First findUnique = target (ADMIN), second = caller (ADMIN_DELEGATED)
        mockPrismaService.user.findUnique
          .mockResolvedValueOnce(adminTarget)
          .mockResolvedValueOnce({ role: { code: 'ADMIN_DELEGATED' } });
        // RoleHierarchyService resolves templateKey via prisma.role.findUnique
        mockPrismaService.role.findUnique
          .mockResolvedValueOnce({ templateKey: 'ADMIN' }) // target
          .mockResolvedValueOnce({ templateKey: 'ADMIN_DELEGATED' }); // caller

        await expect(
          service.resetPassword('admin-target', 'newpassword123', 'caller-delegated'),
        ).rejects.toThrow(
          'Seul un administrateur peut cibler un rôle rattaché au template ADMIN',
        );

        expect(mockPrismaService.user.update).not.toHaveBeenCalled();
        expect(mockAuditPersistence.log).not.toHaveBeenCalled();
      });

      it('rejects peer-rank caller (MANAGER → MANAGER)', async () => {
        const managerTarget = { ...targetUser, role: { code: 'MANAGER' } };
        mockPrismaService.user.findUnique
          .mockResolvedValueOnce(managerTarget)
          .mockResolvedValueOnce({ role: { code: 'MANAGER' } });
        mockPrismaService.role.findUnique
          .mockResolvedValueOnce({ templateKey: 'MANAGER' }) // first call: target template
          .mockResolvedValueOnce({ templateKey: 'MANAGER' }) // first call: caller template
          .mockResolvedValueOnce({ templateKey: 'MANAGER' }) // canAssignRole: caller
          .mockResolvedValueOnce({ templateKey: 'MANAGER' }); // canAssignRole: target

        await expect(
          service.resetPassword('user-1', 'newpassword123', 'caller-manager'),
        ).rejects.toThrow(
          'Vous ne pouvez cibler que des rôles inférieurs au vôtre',
        );

        expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      });

      it('allows ADMIN caller targeting non-ADMIN, writes audit_log entry', async () => {
        mockPrismaService.user.findUnique
          .mockResolvedValueOnce(targetUser) // target lookup
          .mockResolvedValueOnce({ role: { code: 'ADMIN' } }); // caller lookup
        mockPrismaService.role.findUnique
          .mockResolvedValueOnce({ templateKey: 'CONTRIBUTOR' }) // target tpl
          .mockResolvedValueOnce({ templateKey: 'ADMIN' }); // caller tpl
        mockPrismaService.user.update.mockResolvedValue({
          id: 'user-1',
          updatedAt: new Date('2026-05-24T12:00:00.000Z'),
        });

        const result = await service.resetPassword(
          'user-1',
          'newpassword123',
          'caller-admin',
        );

        expect(result).toEqual({
          message: 'Mot de passe réinitialisé avec succès',
        });
        expect(mockAuditPersistence.log).toHaveBeenCalledWith(
          expect.objectContaining({
            // OBS-004 — renamed from free-string 'PASSWORD_RESET_ADMIN' to the
            // AuditAction enum. SEC-003's gates (hierarchy, self-reset, no-PII)
            // are unaffected; only the durable action code is canonicalized.
            action: 'PASSWORD_RESET_BY_ADMIN',
            entityType: 'User',
            entityId: 'user-1',
            actorId: 'caller-admin',
            payload: expect.objectContaining({
              targetLogin: 'jdupont',
              before: { updatedAt: '2026-01-01T00:00:00.000Z' },
              after: { updatedAt: '2026-05-24T12:00:00.000Z' },
            }),
          }),
        );
        // Critical: the raw password and hash must NOT leak into the audit payload.
        const auditPayload = mockAuditPersistence.log.mock.calls[0][0].payload;
        expect(JSON.stringify(auditPayload)).not.toContain('newpassword123');
        expect(JSON.stringify(auditPayload)).not.toMatch(/\$2[aby]\$/); // bcrypt prefix
      });
    });
  });

  describe('getUsersByDepartment', () => {
    it('should return users for a department', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          role: 'CONTRIBUTEUR',
          userServices: [],
        },
        {
          id: 'user-2',
          firstName: 'Marie',
          lastName: 'Martin',
          email: 'marie.martin@example.com',
          role: 'MANAGER',
          userServices: [],
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getUsersByDepartment('dept-1');

      expect(result).toHaveLength(2);
      expect(result[0].firstName).toBe('Jean');
      expect(result[1].firstName).toBe('Marie');
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            departmentId: 'dept-1',
            isActive: true,
          },
        }),
      );
    });
  });

  describe('getUsersByService', () => {
    it('should return users for a service', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          role: 'CONTRIBUTEUR',
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getUsersByService('service-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userServices: {
              some: {
                serviceId: 'service-1',
              },
            },
            isActive: true,
          },
        }),
      );
    });
  });

  describe('getUsersByRole', () => {
    it('should return users for a role', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@example.com',
          departmentId: 'dept-1',
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getUsersByRole('ADMIN');

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('admin@example.com');
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: { code: 'ADMIN' },
            isActive: true,
          },
        }),
      );
    });
  });

  describe('importUsers', () => {
    const mockRoles = [
      { id: 'role-contrib', code: 'CONTRIBUTEUR' },
      { id: 'role-admin', code: 'ADMIN' },
    ];

    it('should import users successfully', async () => {
      const importData = [
        {
          email: 'new@example.com',
          login: 'new.user',
          password: 'Password1!',
          firstName: 'New',
          lastName: 'User',
          roleCode: 'CONTRIBUTEUR',
          departmentName: 'Informatique',
        },
      ];

      mockPrismaService.department.findMany.mockResolvedValue([
        { id: 'dept-1', name: 'Informatique' },
      ]);
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.role.findMany.mockResolvedValue(mockRoles);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-1',
        email: 'new@example.com',
        login: 'new.user',
        firstName: 'New',
        lastName: 'User',
        roleId: 'role-contrib',
        role: {
          id: 'role-contrib',
          code: 'CONTRIBUTEUR',
          label: 'Contributeur',
          templateKey: 'CONTRIBUTOR',
        },
        departmentId: 'dept-1',
      });

      const result = await service.importUsers(importData);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.createdUsers).toHaveLength(1);
    });

    it('should skip existing users', async () => {
      const importData = [
        {
          email: 'existing@example.com',
          login: 'existing.user',
          password: 'Password1!',
          firstName: 'Existing',
          lastName: 'User',
          roleCode: 'CONTRIBUTEUR',
        },
      ];

      mockPrismaService.department.findMany.mockResolvedValue([]);
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.role.findMany.mockResolvedValue(mockRoles);
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'existing-1',
        email: 'existing@example.com',
        login: 'existing.user',
      });

      const result = await service.importUsers(importData);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errorDetails.length).toBeGreaterThan(0);
    });

    it('should report error when department not found', async () => {
      const importData = [
        {
          email: 'new@example.com',
          login: 'new.user',
          password: 'Password1!',
          firstName: 'New',
          lastName: 'User',
          roleCode: 'CONTRIBUTEUR',
          departmentName: 'Unknown Dept',
        },
      ];

      mockPrismaService.department.findMany.mockResolvedValue([]);
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.role.findMany.mockResolvedValue(mockRoles);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.importUsers(importData);

      expect(result.created).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.errorDetails[0]).toContain('introuvable');
    });

    describe('hierarchy gate', () => {
      const importedRoles = [
        {
          id: 'role-inst-admin',
          code: 'INSTITUTIONAL_ADMIN',
          templateKey: 'ADMIN',
        },
        {
          id: 'role-contrib',
          code: 'CONTRIBUTEUR',
          templateKey: 'PROJECT_CONTRIBUTOR',
        },
      ];

      function mockCallerRoleLookups(
        roleByCode: Record<string, { templateKey: string } | null>,
      ) {
        mockPrismaService.role.findUnique.mockImplementation((args: any) => {
          const code = args?.where?.code;
          return Promise.resolve(roleByCode[code] ?? null);
        });
      }

      it('skips ADMIN-template rows with error in result.errors when caller is ADMIN_DELEGATED', async () => {
        const importData = [
          {
            email: 'attacker@example.com',
            login: 'attacker',
            password: 'Password1!',
            firstName: 'A',
            lastName: 'B',
            roleCode: 'INSTITUTIONAL_ADMIN',
          },
          {
            email: 'normal@example.com',
            login: 'normal',
            password: 'Password1!',
            firstName: 'N',
            lastName: 'O',
            roleCode: 'CONTRIBUTEUR',
          },
        ];

        mockPrismaService.department.findMany.mockResolvedValue([]);
        mockPrismaService.service.findMany.mockResolvedValue([]);
        mockPrismaService.role.findMany.mockResolvedValue(importedRoles);
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockCallerRoleLookups({
          INSTITUTIONAL_ADMIN: { templateKey: 'ADMIN' },
          CONTRIBUTEUR: { templateKey: 'PROJECT_CONTRIBUTOR' },
          RESPONSABLE: { templateKey: 'ADMIN_DELEGATED' },
        });
        mockPrismaService.user.create.mockResolvedValue({
          id: 'new-normal',
          email: 'normal@example.com',
          login: 'normal',
          firstName: 'N',
          lastName: 'O',
          roleId: 'role-contrib',
          role: { id: 'role-contrib', code: 'CONTRIBUTEUR' },
          departmentId: null,
        });

        const result = await service.importUsers(importData, 'RESPONSABLE');

        expect(result.created).toBe(1);
        expect(result.errors).toBeGreaterThanOrEqual(1);
        const joined = result.errorDetails.join('\n');
        expect(joined.toLowerCase()).toContain('admin');
        expect(
          result.createdUsers.some((u: any) => u.email === 'attacker@example.com'),
        ).toBe(false);
      });

      it('allows ADMIN to import a row with ADMIN-template role', async () => {
        const importData = [
          {
            email: 'newadmin@example.com',
            login: 'newadmin',
            password: 'Password1!',
            firstName: 'A',
            lastName: 'B',
            roleCode: 'INSTITUTIONAL_ADMIN',
          },
        ];

        mockPrismaService.department.findMany.mockResolvedValue([]);
        mockPrismaService.service.findMany.mockResolvedValue([]);
        mockPrismaService.role.findMany.mockResolvedValue(importedRoles);
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockCallerRoleLookups({
          INSTITUTIONAL_ADMIN: { templateKey: 'ADMIN' },
          ADMIN: { templateKey: 'ADMIN' },
        });
        mockPrismaService.user.create.mockResolvedValue({
          id: 'new-admin',
          email: 'newadmin@example.com',
          login: 'newadmin',
          firstName: 'A',
          lastName: 'B',
          roleId: 'role-inst-admin',
          role: { id: 'role-inst-admin', code: 'INSTITUTIONAL_ADMIN' },
          departmentId: null,
        });

        const result = await service.importUsers(importData, 'ADMIN');

        expect(result.created).toBe(1);
        expect(result.createdUsers[0].email).toBe('newadmin@example.com');
      });
    });
  });

  describe('validateImport', () => {
    it('flags ADMIN-template rows as errors when caller is ADMIN_DELEGATED', async () => {
      const importData = [
        {
          email: 'attacker@example.com',
          login: 'attacker',
          password: 'Password1!',
          firstName: 'A',
          lastName: 'B',
          roleCode: 'INSTITUTIONAL_ADMIN',
        },
      ];

      mockPrismaService.department.findMany.mockResolvedValue([]);
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.role.findMany.mockResolvedValue([
        { code: 'INSTITUTIONAL_ADMIN' },
      ]);
      mockPrismaService.role.findUnique.mockImplementation((args: any) => {
        const code = args?.where?.code;
        if (code === 'INSTITUTIONAL_ADMIN')
          return Promise.resolve({ templateKey: 'ADMIN' });
        if (code === 'RESPONSABLE')
          return Promise.resolve({ templateKey: 'ADMIN_DELEGATED' });
        return Promise.resolve(null);
      });

      const result = await service.validateImport(importData, 'RESPONSABLE');

      expect(result.summary.errors).toBeGreaterThanOrEqual(1);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const messages = result.errors.flatMap((e: any) => e.messages).join('\n');
      expect(messages.toLowerCase()).toContain('admin');
    });
  });

  describe('getImportTemplate', () => {
    it('should return a CSV template string', () => {
      const template = service.getImportTemplate();

      expect(typeof template).toBe('string');
      expect(template).toContain('email');
      expect(template).toContain('login');
      expect(template).toContain('password');
      expect(template).toContain('firstName');
      expect(template).toContain('lastName');
      expect(template).toContain('roleCode');
      expect(template).toContain('departmentName');
      expect(template).toContain('serviceNames');
      // Verify it has at least header line and example line
      const lines = template.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getUsersPresence', () => {
    const mockUsers = [
      {
        id: 'user-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        avatarUrl: null,
        avatarPreset: null,
        department: { name: 'IT' },
        userServices: [{ service: { name: 'Développement' } }],
      },
      {
        id: 'user-2',
        firstName: 'Marie',
        lastName: 'Martin',
        avatarUrl: null,
        avatarPreset: null,
        department: null,
        userServices: [],
      },
      {
        id: 'user-3',
        firstName: 'Pierre',
        lastName: 'Bernard',
        avatarUrl: null,
        avatarPreset: null,
        department: null,
        userServices: [],
      },
      {
        id: 'user-4',
        firstName: 'Sophie',
        lastName: 'Leroy',
        avatarUrl: null,
        avatarPreset: null,
        department: null,
        userServices: [],
      },
    ];

    beforeEach(() => {
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.teleworkSchedule.findMany.mockResolvedValue([
        { userId: 'user-2' },
      ]);
      mockPrismaService.leave.findMany.mockResolvedValue([
        { userId: 'user-3' },
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([
        { assignees: [{ userId: 'user-4' }] },
      ]);
      mockPrismaService.event.findMany.mockResolvedValue([]);
    });

    it('should return presence data with all four categories', async () => {
      const result = await service.getUsersPresence('2025-01-15');

      expect(result).toHaveProperty('onSite');
      expect(result).toHaveProperty('remote');
      expect(result).toHaveProperty('absent');
      expect(result).toHaveProperty('external');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('totals');

      // user-1 is onSite (not remote, not absent, not external)
      expect(result.onSite.some((u: any) => u.id === 'user-1')).toBe(true);
      // user-2 is remote (telework)
      expect(result.remote.some((u: any) => u.id === 'user-2')).toBe(true);
      // user-3 is absent (approved leave)
      expect(result.absent.some((u: any) => u.id === 'user-3')).toBe(true);
      // user-4 is external (external task)
      expect(result.external.some((u: any) => u.id === 'user-4')).toBe(true);
    });

    it('should use current date when no dateStr provided', async () => {
      const result = await service.getUsersPresence();

      expect(result).toHaveProperty('date');
      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return correct totals', async () => {
      const result = await service.getUsersPresence('2025-01-15');

      expect(result.totals.total).toBe(4);
      expect(result.totals.onSite).toBe(1);
      expect(result.totals.remote).toBe(1);
      expect(result.totals.absent).toBe(1);
      expect(result.totals.external).toBe(1);
    });
  });

  describe('uploadAvatar', () => {
    it('should throw BadRequestException for unsupported MIME type', async () => {
      const mockFile = {
        mimetype: 'image/gif',
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake')),
      } as any;

      await expect(service.uploadAvatar('user-1', mockFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadAvatar('user-1', mockFile)).rejects.toThrow(
        'Format non supporté',
      );
    });

    it('should upload a PNG avatar and update the user', async () => {
      const mockFile = {
        mimetype: 'image/png',
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
      } as any;

      const updatedUser = {
        id: 'user-1',
        avatarUrl: '/api/uploads/avatars/user-1.png',
        avatarPreset: null,
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.uploadAvatar('user-1', mockFile);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            avatarUrl: expect.stringContaining('user-1.png'),
            avatarPreset: null,
          }),
        }),
      );
      expect(result.avatarUrl).toContain('user-1.png');
    });

    it('should upload a JPEG avatar and update the user', async () => {
      const mockFile = {
        mimetype: 'image/jpeg',
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-jpeg')),
      } as any;

      const updatedUser = {
        id: 'user-1',
        avatarUrl: '/api/uploads/avatars/user-1.jpg',
        avatarPreset: null,
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.uploadAvatar('user-1', mockFile);

      expect(result.avatarUrl).toContain('user-1.jpg');
    });

    it('should upload a WEBP avatar and update the user', async () => {
      const mockFile = {
        mimetype: 'image/webp',
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-webp')),
      } as any;

      const updatedUser = {
        id: 'user-1',
        avatarUrl: '/api/uploads/avatars/user-1.webp',
        avatarPreset: null,
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.uploadAvatar('user-1', mockFile);

      expect(result.avatarUrl).toContain('user-1.webp');
    });
  });

  describe('setAvatarPreset', () => {
    it('should throw BadRequestException for invalid preset', async () => {
      await expect(
        service.setAvatarPreset('user-1', 'invalid_preset_xyz'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.setAvatarPreset('user-1', 'invalid_preset_xyz'),
      ).rejects.toThrow('Preset invalide');
    });

    it('should set a valid avatar preset and clear avatarUrl', async () => {
      // Import VALID_PRESETS to get a real valid value
      const { VALID_PRESETS } = await import('./dto/avatar-preset.dto');
      const validPreset = VALID_PRESETS[0];

      const updatedUser = {
        id: 'user-1',
        avatarPreset: validPreset,
        avatarUrl: null,
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.setAvatarPreset('user-1', validPreset);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { avatarPreset: validPreset, avatarUrl: null },
        }),
      );
      expect(result.avatarPreset).toBe(validPreset);
    });
  });

  describe('deleteAvatar', () => {
    it('should delete avatar file and clear DB fields when avatarUrl exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        avatarUrl: '/api/uploads/avatars/user-1.png',
      });
      const updatedUser = { id: 'user-1', avatarUrl: null, avatarPreset: null };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.deleteAvatar('user-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { avatarUrl: null, avatarPreset: null },
        }),
      );
      expect(result.avatarUrl).toBeNull();
    });

    it('should clear DB fields even when user has no avatarUrl', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        avatarUrl: null,
      });
      const updatedUser = { id: 'user-1', avatarUrl: null, avatarPreset: null };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.deleteAvatar('user-1');

      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(result.avatarUrl).toBeNull();
    });
  });
});
