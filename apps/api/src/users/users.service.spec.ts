import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { promises as fs } from 'fs';
import { join, resolve, sep } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
import { JwtNotBeforeService } from '../auth/jwt-not-before.service';
import { RoleHierarchyService } from '../common/services/role-hierarchy.service';
import { AccessScopeService } from '../common/services/access-scope.service';
import { AuditService } from '../audit/audit.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { ForbiddenException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  const mockAuditPersistence = { log: vi.fn().mockResolvedValue(undefined) };
  const mockAuditService = { log: vi.fn() };
  const mockJwtNotBefore = { bumpUser: vi.fn().mockResolvedValue(undefined) };
  // Drives the real AccessScopeService's permission resolution. Default = no
  // permissions (plain directory caller); SEC-030 tests override per-case.
  const mockGetPermissionsForRole = vi.fn().mockResolvedValue([]);

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
    // DAT-008/026 — owned-record models hardDelete now erases explicitly.
    refreshToken: {
      deleteMany: vi.fn(),
    },
    passwordResetToken: {
      deleteMany: vi.fn(),
    },
    teleworkRecurringRule: {
      deleteMany: vi.fn(),
    },
    eventParticipant: {
      deleteMany: vi.fn(),
    },
    taskAssignee: {
      deleteMany: vi.fn(),
    },
    taskRACI: {
      deleteMany: vi.fn(),
    },
    predefinedTaskAssignment: {
      deleteMany: vi.fn(),
    },
    predefinedTaskRecurringRule: {
      deleteMany: vi.fn(),
    },
    leaveBalance: {
      deleteMany: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    mockGetPermissionsForRole.mockReset();
    mockGetPermissionsForRole.mockResolvedValue([]);
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
              getPermissionsForRole: mockGetPermissionsForRole,
            } as never),
          inject: [PrismaService],
        },
        { provide: AuditService, useValue: mockAuditService },
        { provide: AuditPersistenceService, useValue: mockAuditPersistence },
        { provide: JwtNotBeforeService, useValue: mockJwtNotBefore },
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

    // SEC-011 — defense-in-depth below the ValidationPipe: even if a caller
    // smuggles isActive:false past the DTO, create() forces it server-side. The
    // user is always created active (Model A); state changes go via the UPDATE
    // path. FAILS pre-fix (create spread `createUserDto.isActive ?? true`,
    // honoring the caller), PASSES post-fix (hardcoded true).
    it('SEC-011: create() forces isActive:true, ignoring any caller-supplied value', async () => {
      const mockDepartment = { id: 'dept-1', name: 'IT' };
      const mockServices = [{ id: 'service-1', name: 'Development' }];

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.service.findMany.mockResolvedValue(mockServices);
      mockPrismaService.role.findUnique.mockResolvedValue({
        id: 'role-contrib',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: '1',
        ...createUserDto,
        isActive: true,
        role: { code: 'CONTRIBUTEUR' },
        userServices: [],
      });
      mockPrismaService.userService.createMany.mockResolvedValue({ count: 1 });

      await service.create({ ...createUserDto, isActive: false } as never);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
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

    // DAT-015 — case-insensitive uniqueness: 'Admin@Foo.com' and 'admin@foo.com'
    // must be treated as duplicates. Pre-fix the service-layer === comparison
    // is case-sensitive, so the conflict is missed when the DB returns a user
    // whose email differs only in case. FAILS before fix (no throw), PASSES after.
    it('DAT-015: should throw conflict when email already exists with different case', async () => {
      const existingUser = {
        id: '1',
        email: 'NEWUSER@EXAMPLE.COM', // stored with uppercase
        login: 'otheruser',
      };
      mockPrismaService.user.findFirst.mockResolvedValue(existingUser);
      // dto email is lowercase — without toLowerCase(), === comparison misses the dup
      await expect(service.create(createUserDto)).rejects.toThrow(
        'Cet email est déjà utilisé',
      );
    });

    it('DAT-015: should throw conflict when login already exists with different case', async () => {
      const existingUser = {
        id: '1',
        email: 'other@example.com',
        login: 'NEWUSER', // stored with uppercase
      };
      mockPrismaService.user.findFirst.mockResolvedValue(existingUser);
      // dto login is lowercase 'newuser' — without toLowerCase(), === comparison misses
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

        await expect(
          service.create(adminTargetDto, 'RESPONSABLE'),
        ).rejects.toThrow('administrateur');
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
        mockPrismaService.department.findUnique.mockResolvedValue(
          mockDepartment,
        );
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
        mockPrismaService.userService.createMany.mockResolvedValue({
          count: 1,
        });

        const result = await service.create(adminTargetDto, 'ADMIN');

        expect(result.email).toBe(adminTargetDto.email);
        expect(mockPrismaService.user.create).toHaveBeenCalled();
      });

      it('allows ADMIN_DELEGATED to assign a strictly lower rank role', async () => {
        const mockDepartment = { id: 'dept-1', name: 'IT' };
        const mockServices = [{ id: 'service-1', name: 'Dev' }];
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.department.findUnique.mockResolvedValue(
          mockDepartment,
        );
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
        mockPrismaService.userService.createMany.mockResolvedValue({
          count: 1,
        });

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
          where: { deletedAt: null, role: { code: 'ADMIN' } },
        }),
      );
    });

    // SEC-031: findAll is payload-only — directory visibility (the returned
    // user SET) is preserved per SEC-030's design intent; only the per-row
    // payload is restricted for non-management callers.
    const managementCaller = {
      id: 'mgr-1',
      role: { code: 'ADMIN', templateKey: 'ADMIN' },
    };
    const directoryCaller = {
      id: 'caller-1',
      role: { code: 'CONTRIBUTEUR', templateKey: 'PROJECT_CONTRIBUTOR' },
    };

    it('SEC-031: a management caller gets the full list payload (email/login), set NOT scoped', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:manage']);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll(1, 50, undefined, managementCaller);

      const args = mockPrismaService.user.findMany.mock.calls[0][0];
      // Full payload: sensitive fields exposed to management.
      expect(args.select.email).toBe(true);
      expect(args.select.login).toBe(true);
      // Set NOT horizontally scoped — no OR buckets merged. Shells excluded.
      expect(args.where).toEqual({ deletedAt: null });
      expect(args.where.OR).toBeUndefined();
    });

    it('SEC-031: a directory caller gets the reduced list payload (no email/login) but the SAME set (no where-scope)', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:read']);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll(1, 50, undefined, directoryCaller);

      const args = mockPrismaService.user.findMany.mock.calls[0][0];
      // Proof-of-defect: pre-fix the list exposed email/login to a directory
      // caller; post-fix they are stripped.
      expect(args.select.email).toBeUndefined();
      expect(args.select.login).toBeUndefined();
      // Directory fields still present.
      expect(args.select.firstName).toBe(true);
      expect(args.select.role).toBeDefined();
      // Set unchanged: no horizontal scope — same users as management would see
      // (shells excluded via deletedAt:null).
      expect(args.where).toEqual({ deletedAt: null });
      expect(args.where.OR).toBeUndefined();
      // count uses the same unscoped where (totals reflect the full directory).
      const countArgs = mockPrismaService.user.count.mock.calls[0][0];
      expect(countArgs.where).toEqual({ deletedAt: null });
    });

    // PER-004: hard ceiling of 200 to prevent 5-20 MB planning payloads
    it('PER-004: caps limit at 200 when no allowFullScan opt-in', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll(1, 1000);

      const args = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(args.take).toBe(200);
    });

    it('PER-004: allowFullScan:true bypasses the 200 ceiling', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll(1, 1000, undefined, undefined, {
        allowFullScan: true,
      });

      const args = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(args.take).toBe(1000);
    });
  });

  describe('findOne', () => {
    // Management-tier caller (`users:manage`): MANAGER / ADMIN_DELEGATED /
    // ADMIN. Directory-tier caller: a plain `users:read` holder.
    const managementCaller = {
      id: 'mgr-1',
      role: { code: 'ADMIN', templateKey: 'ADMIN' },
    };
    const directoryCaller = {
      id: 'caller-1',
      role: { code: 'CONTRIBUTEUR', templateKey: 'PROJECT_CONTRIBUTOR' },
    };

    it('should return the full admin payload for a management caller', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:manage']);
      const mockUser = {
        id: '1',
        email: 'user@example.com',
        login: 'user',
        firstName: 'User',
        lastName: 'Test',
        role: { id: 'r1', code: 'USER', label: 'User' },
        isActive: true,
        departmentId: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findOne('1', managementCaller);

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
      // Management caller resolves to an empty scope where (every user); shells
      // (deletedAt set) are excluded.
      const args = mockPrismaService.user.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: '1', deletedAt: null });
      // Full payload exposes the sensitive fields.
      expect(args.select.email).toBe(true);
      expect(args.select.login).toBe(true);
      expect(args.select.skills).toBeDefined();
      expect(args.select.projectMembers).toBeDefined();
    });

    it('SEC-030: a directory caller gets the scoped where and the reduced payload (no email/login/skills/memberships)', async () => {
      // Plain `users:read` directory caller — no users:manage.
      mockGetPermissionsForRole.mockResolvedValue(['users:read']);
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'in-scope',
        firstName: 'In',
        lastName: 'Scope',
      });

      await service.findOne('in-scope', directoryCaller);

      const args = mockPrismaService.user.findFirst.mock.calls[0][0];
      // Horizontal scope applied: not just { id }, an OR of scope buckets.
      expect(args.where.id).toBe('in-scope');
      expect(args.where.OR).toBeDefined();
      expect(args.where.OR).toContainEqual({ id: 'caller-1' });
      // Reduced payload: the SEC-030 sensitive fields are stripped.
      expect(args.select.email).toBeUndefined();
      expect(args.select.login).toBeUndefined();
      expect(args.select.skills).toBeUndefined();
      expect(args.select.projectMembers).toBeUndefined();
      // Directory fields are still present.
      expect(args.select.firstName).toBe(true);
      expect(args.select.role).toBeDefined();
    });

    it('SEC-030: an out-of-scope user is a 404 for a directory caller', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:read']);
      // The scope where filters the row out → findFirst returns null.
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('out-of-scope', directoryCaller),
      ).rejects.toThrow('Utilisateur introuvable');
    });

    it('SEC-030: a directory caller reading their own profile is in scope (self bucket)', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:read']);
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'caller-1',
        firstName: 'Self',
        lastName: 'Read',
      });

      const result = await service.findOne('caller-1', directoryCaller);

      expect(result.id).toBe('caller-1');
      const args = mockPrismaService.user.findFirst.mock.calls[0][0];
      expect(args.where.OR).toContainEqual({ id: 'caller-1' });
      // Self still gets the reduced payload via this admin endpoint.
      expect(args.select.email).toBeUndefined();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:manage']);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', managementCaller),
      ).rejects.toThrow('Utilisateur introuvable');
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
        role: {
          code: 'INSTITUTIONAL_DELEGATED',
          templateKey: 'ADMIN_DELEGATED',
        },
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
          service.update(
            targetId,
            updateUserDto,
            'INSTITUTIONAL_DELEGATED',
            callerOutOfScope,
          ),
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

  // TST-018 — negative pendant of the L845 ROLE_CHANGE happy-path. The
  // hierarchy guard `roleHierarchy.assertCanAssignRole(callerRoleCode, roleCode)`
  // already exists at update() (users.service.ts:500-502) and is live on the
  // HTTP path (controller threads `caller?.role?.code` as the 3rd arg). No spec
  // pinned the REJECTION: a non-ADMIN caller attempting a `roleCode` escalation
  // must be refused BEFORE `prisma.user.update` runs and BEFORE any ROLE_CHANGE
  // audit is emitted. Both services are real (RoleHierarchyService +
  // AccessScopeService against the mock prisma — see beforeEach rationale), so
  // these exercise the genuine guard, not a flat stub. `assertCanManageUser` is
  // set up to PASS (caller is dept-manager of the target) so the rejection is
  // attributable to `assertCanAssignRole`, not the perimeter gate — the
  // proof-of-non-vacuity (stash L500-502 → these FAIL: user.update called +
  // ROLE_CHANGE emitted) depends on that.
  describe('role-escalation rejection (TST-018)', () => {
    // Caller in the target's perimeter (dept-manager) so the L476
    // assertCanManageUser gate passes; the only thing that can reject is the
    // hierarchy guard.
    function arrangeManageableTarget() {
      // assertCanManageUser → user.count (exists) === 1.
      mockPrismaService.user.count.mockResolvedValue(1);
      // Both read sites get one object: canManageUser reads
      // departmentId/userServices; update() reads roleId/role.code/isActive.
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'target-1',
        roleId: 'role-old',
        isActive: true,
        role: { code: 'CONTRIBUTEUR' },
        departmentId: 'dept-1',
        userServices: [],
      });
      // canManageUser → caller is the manager of the target's department.
      mockPrismaService.department.count.mockResolvedValue(1);
      // If the guard were (wrongly) bypassed, update() would call user.update;
      // mocking it lets the stashed-guard non-vacuity run reach ROLE_CHANGE
      // cleanly rather than throwing a TypeError on an undefined return.
      mockPrismaService.user.update.mockResolvedValue({
        id: 'target-1',
        isActive: true,
        role: { code: 'ADMIN' },
      });
    }

    // role.findUnique serves three sites: resolveTemplateKey (select
    // templateKey), canAssignRole→resolveTemplateKey, and
    // resolveAssignableRoleIdByCode (select id+isSystem). A superset object per
    // code satisfies all. ADMIN is isSystem:false here ONLY so the stashed-guard
    // non-vacuity run gets past resolveAssignableRoleIdByCode to user.update
    // (real ADMIN is a system role; irrelevant when the guard rejects first).
    function arrangeRoleLookup() {
      mockPrismaService.role.findUnique.mockImplementation((args: any) => {
        const code = args?.where?.code;
        if (code === 'ADMIN')
          return Promise.resolve({
            id: 'role-admin',
            isSystem: false,
            templateKey: 'ADMIN',
          });
        if (code === 'RESPONSABLE')
          return Promise.resolve({
            id: 'role-resp',
            isSystem: false,
            templateKey: 'ADMIN_DELEGATED',
          });
        if (code === 'MANAGER')
          return Promise.resolve({
            id: 'role-manager',
            isSystem: false,
            templateKey: 'MANAGER',
          });
        if (code === 'CONTRIBUTEUR')
          return Promise.resolve({
            id: 'role-contrib',
            isSystem: false,
            templateKey: 'BASIC_USER',
          });
        return Promise.resolve(null);
      });
    }

    it('rejects a RESPONSABLE caller escalating a target to ADMIN, with no user.update and no ROLE_CHANGE', async () => {
      arrangeManageableTarget();
      arrangeRoleLookup();

      const callerResponsable = {
        id: 'caller-resp-1',
        role: { code: 'RESPONSABLE', templateKey: 'ADMIN_DELEGATED' },
      };

      await expect(
        service.update(
          'target-1',
          { roleCode: 'ADMIN' },
          'RESPONSABLE',
          callerResponsable,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      // Invariant: rejected BEFORE the mutation and BEFORE the audit emit.
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockAuditPersistence.log).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ROLE_CHANGE' }),
      );
      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    it('rejects a CONTRIBUTEUR caller escalating a target to MANAGER (generic-rank branch), with no user.update and no ROLE_CHANGE', async () => {
      arrangeManageableTarget();
      arrangeRoleLookup();

      const callerContributeur = {
        id: 'caller-contrib-1',
        role: { code: 'CONTRIBUTEUR', templateKey: 'BASIC_USER' },
      };

      await expect(
        service.update(
          'target-1',
          { roleCode: 'MANAGER' },
          'CONTRIBUTEUR',
          callerContributeur,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
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

      await service.update(
        'target-1',
        { isActive: true },
        'ADMIN',
        callerAdmin,
      );

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

      await service.update(
        'target-1',
        { isActive: true },
        'ADMIN',
        callerAdmin,
      );

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
      // TST-011 — the parallel console-parity PASSWORD_CHANGED dual-write at
      // users.service.ts:994 (AuditService.log, distinct from the
      // PASSWORD_RESET_BY_ADMIN persistence row above) was wired but unasserted.
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_CHANGED',
          userId: 'caller-admin',
          targetId: 'user-1',
          success: true,
        }),
      );
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
        forcePasswordChange: false,
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

    // SEC-004 (AC#2 + AC#4) — a forced password change clears the flag in the
    // same update and emits a durable PASSWORD_CHANGED audit row with the flag
    // before/after transition. FAILS pre-fix (no flag clear, no audit emit).
    it('clears forcePasswordChange and emits a PASSWORD_CHANGED audit on a forced change', async () => {
      const mockUser = {
        id: 'flagged-1',
        email: 'flagged@example.com',
        login: 'flagged',
        passwordHash: await bcrypt.hash('oldpassword', 12),
        firstName: 'Flagged',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        departmentId: null,
        avatarUrl: null,
        forcePasswordChange: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.changePassword('flagged-1', {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      });

      // Flag cleared atomically with the new hash.
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'flagged-1' },
          data: expect.objectContaining({ forcePasswordChange: false }),
        }),
      );

      // Durable audit row with the before/after flag transition.
      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_CHANGED',
          entityType: 'User',
          entityId: 'flagged-1',
          actorId: 'flagged-1',
          payload: expect.objectContaining({
            success: true,
            before: { forcePasswordChange: true },
            after: { forcePasswordChange: false },
          }),
        }),
      );
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
    it('should return canDelete true when no audit history', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      const result = await service.checkDependencies('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.canDelete).toBe(true);
      expect(result.dependencies).toHaveLength(0);
    });

    // DAT-008/026 (A′): deletion ALWAYS succeeds (canDelete=true) — audit-bearing
    // users are anonymised (shell), not blocked. Audit history is surfaced only as
    // an INFORMATIONAL dependency so the UI can warn it will be an anonymised shell.
    // Former "active dependencies" (tasks, project memberships, managed
    // departments/services, pending leaves) are gone — erased (owned) or unlinked
    // (SetNull) by hardDelete.
    it('reports audit history as informational only (canDelete stays true)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      // Active tasks/memberships present, but they are no longer consulted.
      mockPrismaService.task.count.mockResolvedValue(3);
      mockPrismaService.projectMember.count.mockResolvedValue(2);
      mockPrismaService.department.count.mockResolvedValue(1);
      mockPrismaService.auditLog.count.mockResolvedValue(5);

      const result = await service.checkDependencies('user-1');

      // Audit history does NOT block — the account is anonymised, not refused.
      expect(result.canDelete).toBe(true);
      expect(result.dependencies).toHaveLength(1);

      const auditDep = result.dependencies.find((d) => d.type === 'AUDIT_LOGS');
      expect(auditDep).toBeDefined();
      expect(auditDep!.count).toBe(5);
      expect(auditDep!.description).toMatch(/anonymis/i);

      // The former active-dependency types are gone.
      expect(result.dependencies.some((d) => d.type === 'TASKS')).toBe(false);
      expect(result.dependencies.some((d) => d.type === 'PROJECTS')).toBe(
        false,
      );
      expect(result.dependencies.some((d) => d.type === 'DEPARTMENTS')).toBe(
        false,
      );
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
      // checkDependencies: no audit history → deletable (full-erasure)
      mockPrismaService.auditLog.count.mockResolvedValue(0);
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

    it('DAT-002 — erases owned RACI rows (taskRACI.deleteMany) on hard delete', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      // Trail-less user → physical delete path; owned data erased explicitly.
      mockPrismaService.auditLog.count.mockResolvedValue(0);
      mockPrismaService.user.delete.mockResolvedValue({ id: 'user-1' });

      await service.hardDelete('user-1', 'admin-1');

      // RACI rows are owned operational data; before DAT-002 they were orphaned
      // (no FK + not in the owned-set deleteMany list).
      expect(mockPrismaService.taskRACI.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
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

    // DAT-008/026 — full erasure: active tasks / project memberships used to
    // block hardDelete; they no longer do. With no audit history the user is
    // fully erasable (owned records deleted, secondary references SetNull).
    it('no longer blocks on active tasks/memberships — full erasure proceeds', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      mockPrismaService.task.count.mockResolvedValue(5);
      mockPrismaService.projectMember.count.mockResolvedValue(2);
      mockPrismaService.auditLog.count.mockResolvedValue(0);
      mockPrismaService.user.delete.mockResolvedValue({ id: 'user-1' });

      const result = await service.hardDelete('user-1', 'admin-1');

      expect(result.success).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.user.delete).toHaveBeenCalled();
    });

    // DAT-008/026 (decision A′) — an audit-authoring user cannot be physically
    // deleted (audit_logs.actorId FK is ON DELETE NO ACTION + OBS-002 forbids the
    // SET NULL), so full erasure is achieved by ANONYMISING the User row in place:
    // identifiers tombstoned (keyed by id → DAT-015 unique-safe), names cleared,
    // deletedAt set, deactivated. Owned data is still erased; audit_logs rows are
    // kept intact and still reference the (now anonymised) id. The audit subsystem
    // is never touched.
    it('anonymises the User row (shell) instead of physically deleting when the user authored audit_logs rows', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-7',
        email: 'real.person@example.com',
        login: 'rperson',
        firstName: 'Real',
        lastName: 'Person',
        avatarUrl: '/api/uploads/avatars/user-7.png',
        avatarPreset: null,
        isActive: true,
      });
      mockPrismaService.auditLog.count.mockResolvedValue(7);
      mockPrismaService.user.update.mockResolvedValue({ id: 'user-7' });

      const result = await service.hardDelete('user-7', 'admin-1');

      expect(result.success).toBe(true);

      // No physical delete; the row is anonymised in place, owned data still erased.
      expect(mockPrismaService.user.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-7' },
          data: expect.objectContaining({
            email: 'deleted-user-7@anonymized.invalid',
            login: 'deleted-user-7',
            avatarUrl: null,
            avatarPreset: null,
            isActive: false,
            deletedAt: expect.any(Date),
          }),
        }),
      );
      // Names are cleared (tombstoned, not the originals) — NOT NULL forces a
      // constant rather than literal null.
      const updateArg = mockPrismaService.user.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateArg.data.firstName).not.toBe('Real');
      expect(updateArg.data.lastName).not.toBe('Person');
      // OBS-028 (PART B) — the credential is wiped on the shell (pure
      // data-minimisation; isActive=false already blocks login). NOT NULL forces a
      // fixed unusable non-bcrypt constant rather than literal null.
      expect(updateArg.data.passwordHash).toBeDefined();
      expect(updateArg.data.passwordHash).not.toMatch(/^\$2[aby]\$/);

      // The deletion is still audited (USER_DELETED snapshot, captured before
      // anonymisation), and the snapshot never leaks the password hash.
      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_DELETED', entityId: 'user-7' }),
      );
    });

    it('hard-deletes and emits USER_DELETED with a column snapshot when the user has zero audit_logs rows', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        login: 'jdupont',
        firstName: 'Jean',
        lastName: 'Dupont',
        passwordHash: 'super-secret-hash',
        roleId: 'role-1',
        departmentId: 'dept-1',
        isActive: false,
        avatarUrl: null,
        avatarPreset: null,
        forcePasswordChange: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      });
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.projectMember.count.mockResolvedValue(0);
      mockPrismaService.leave.count.mockResolvedValue(0);
      mockPrismaService.department.count.mockResolvedValue(0);
      mockPrismaService.service.count.mockResolvedValue(0);
      mockPrismaService.auditLog.count.mockResolvedValue(0);
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
      expect(mockPrismaService.user.delete).toHaveBeenCalled();

      // USER_DELETED emitted before the delete, mirroring DAT-007 PROJECT_DELETED.
      // OBS-027 — REFERENCE-ONLY: the immutable trail records who (id) + which
      // role/department + active state was deleted by which admin (actorId) at the
      // row timestamp. It must NOT denormalise the person's identity, so anonymising
      // the User row erases PII everywhere.
      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_DELETED',
          entityType: 'User',
          entityId: 'user-1',
          actorId: 'admin-1',
          payload: expect.objectContaining({
            snapshot: expect.objectContaining({ id: 'user-1' }),
          }),
        }),
      );
      // OBS-027 — no direct identifier (nor the password hash) enters the trail.
      const logArg = mockAuditPersistence.log.mock.calls[0][0] as {
        payload: { snapshot: Record<string, unknown> };
      };
      for (const pii of [
        'email',
        'login',
        'firstName',
        'lastName',
        'avatarUrl',
        'avatarPreset',
        'passwordHash',
      ]) {
        expect(logArg.payload.snapshot).not.toHaveProperty(pii);
      }
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
          service.resetPassword(
            'admin-target',
            'newpassword123',
            'caller-delegated',
          ),
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

  // SEC-031: the getUsersBy* helpers get the FULL treatment (horizontal
  // where-scope via userReadWhere + payload reduction) — they have no live
  // frontend consumer so scoping carries no app-wide-dropdown blast radius.
  const sec031ManagementCaller = {
    id: 'mgr-1',
    role: { code: 'ADMIN', templateKey: 'ADMIN' },
  };
  const sec031DirectoryCaller = {
    id: 'caller-1',
    role: { code: 'CONTRIBUTEUR', templateKey: 'PROJECT_CONTRIBUTOR' },
  };

  describe('getUsersByDepartment', () => {
    it('management caller: full payload (email) and an unscoped where', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:manage']);
      const mockUsers = [
        {
          id: 'user-1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          userServices: [],
        },
        {
          id: 'user-2',
          firstName: 'Marie',
          lastName: 'Martin',
          email: 'marie.martin@example.com',
          userServices: [],
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getUsersByDepartment(
        'dept-1',
        sec031ManagementCaller,
      );

      expect(result).toHaveLength(2);
      expect(result[0].firstName).toBe('Jean');
      const args = mockPrismaService.user.findMany.mock.calls[0][0];
      // users:manage → empty scope → where unchanged.
      expect(args.where).toEqual({ departmentId: 'dept-1', isActive: true });
      expect(args.select.email).toBe(true);
      expect(args.select.role.select.templateKey).toBe(true);
    });

    it('SEC-031: directory caller gets the scoped where (OR buckets) and the reduced payload (no email/templateKey)', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:read']);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.getUsersByDepartment('dept-1', sec031DirectoryCaller);

      const args = mockPrismaService.user.findMany.mock.calls[0][0];
      // Horizontal scope merged with the base filter.
      expect(args.where.departmentId).toBe('dept-1');
      expect(args.where.isActive).toBe(true);
      expect(args.where.OR).toBeDefined();
      expect(args.where.OR).toContainEqual({ id: 'caller-1' });
      // Reduced payload.
      expect(args.select.email).toBeUndefined();
      expect(args.select.role.select.templateKey).toBeUndefined();
      expect(args.select.firstName).toBe(true);
    });
  });

  describe('getUsersByService', () => {
    it('management caller: full payload (email) and an unscoped where', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:manage']);
      const mockUsers = [
        {
          id: 'user-1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getUsersByService(
        'service-1',
        sec031ManagementCaller,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
      const args = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        userServices: { some: { serviceId: 'service-1' } },
        isActive: true,
      });
      expect(args.select.email).toBe(true);
    });

    it('SEC-031: directory caller gets the scoped where (OR buckets) and the reduced payload (no email)', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:read']);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.getUsersByService('service-1', sec031DirectoryCaller);

      const args = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(args.where.userServices).toEqual({
        some: { serviceId: 'service-1' },
      });
      expect(args.where.isActive).toBe(true);
      expect(args.where.OR).toBeDefined();
      expect(args.where.OR).toContainEqual({ id: 'caller-1' });
      expect(args.select.email).toBeUndefined();
      expect(args.select.role.select.templateKey).toBeUndefined();
    });
  });

  describe('getUsersByRole', () => {
    it('management caller: full payload (email) and an unscoped where', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:manage']);
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

      const result = await service.getUsersByRole(
        'ADMIN',
        sec031ManagementCaller,
      );

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('admin@example.com');
      const args = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ role: { code: 'ADMIN' }, isActive: true });
      expect(args.select.email).toBe(true);
    });

    it('SEC-031: directory caller gets the scoped where (OR buckets) and the reduced payload (no email)', async () => {
      mockGetPermissionsForRole.mockResolvedValue(['users:read']);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.getUsersByRole('ADMIN', sec031DirectoryCaller);

      const args = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(args.where.role).toEqual({ code: 'ADMIN' });
      expect(args.where.isActive).toBe(true);
      expect(args.where.OR).toBeDefined();
      expect(args.where.OR).toContainEqual({ id: 'caller-1' });
      expect(args.select.email).toBeUndefined();
      expect(args.select.departmentId).toBe(true);
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

    // SEC-007 witness: the import service path bcrypts userData.password
    // directly. Before the fix a row with password 'a' was created with zero
    // checks; after the fix it is rejected as a per-row error and no user is
    // persisted. Drives importUsers with no callerRoleCode so the hierarchy
    // gate short-circuits and the password check is the only thing under test.
    it('rejects a row whose password violates the policy (no user created)', async () => {
      const importData = [
        {
          email: 'weak@example.com',
          login: 'weak.user',
          password: 'a',
          firstName: 'Weak',
          lastName: 'User',
          roleCode: 'CONTRIBUTEUR',
        },
      ];

      mockPrismaService.department.findMany.mockResolvedValue([]);
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.role.findMany.mockResolvedValue(mockRoles);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.importUsers(importData);

      expect(result.created).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.createdUsers).toHaveLength(0);
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    // PER-030 — test updated: importUsers now uses a pre-flight findMany rather
    // than a per-row findFirst. Mock user.findMany to return the existing user.
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
      // PER-030: pre-flight findMany returns the existing user so the row is skipped
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'existing@example.com', login: 'existing.user' },
      ]);

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
          result.createdUsers.some(
            (u: any) => u.email === 'attacker@example.com',
          ),
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
    beforeEach(() => {
      // PER-016: single $queryRaw consolidates all 5 fan-out queries
      mockPrismaService.$queryRaw.mockResolvedValue([
        {
          id: 'user-1',
          first_name: 'Jean',
          last_name: 'Dupont',
          avatar_url: null,
          avatar_preset: null,
          department_name: 'IT',
          service_name: 'Développement',
          presence_status: 'ON_SITE',
        },
        {
          id: 'user-2',
          first_name: 'Marie',
          last_name: 'Martin',
          avatar_url: null,
          avatar_preset: null,
          department_name: null,
          service_name: null,
          presence_status: 'REMOTE',
        },
        {
          id: 'user-3',
          first_name: 'Pierre',
          last_name: 'Bernard',
          avatar_url: null,
          avatar_preset: null,
          department_name: null,
          service_name: null,
          presence_status: 'ABSENT',
        },
        {
          id: 'user-4',
          first_name: 'Sophie',
          last_name: 'Leroy',
          avatar_url: null,
          avatar_preset: null,
          department_name: null,
          service_name: null,
          presence_status: 'EXTERNAL',
        },
      ]);
    });

    it('PER-016: should use a single $queryRaw instead of 5 separate findMany fan-outs', async () => {
      await service.getUsersPresence('2025-01-15');

      // After the fix: one raw query replaces all fan-outs
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1);
      // None of the 5 individual table scans should fire
      expect(mockPrismaService.user.findMany).not.toHaveBeenCalled();
      expect(
        mockPrismaService.teleworkSchedule.findMany,
      ).not.toHaveBeenCalled();
      expect(mockPrismaService.leave.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.task.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.event.findMany).not.toHaveBeenCalled();
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

    it('SEC-017: cleanup only deletes files with known extensions (.jpg/.png/.webp), not arbitrary userId-prefixed files', async () => {
      // Before the fix: startsWith(userId+'.') also matches e.g. 'user-1.txt',
      // 'user-1.sh' etc. — unlink would be called on non-avatar files.
      (fs.readdir as unknown as Mock).mockResolvedValueOnce([
        'user-1.jpg', // should be deleted (old avatar)
        'user-1.txt', // must NOT be deleted
        'user-1.sh', // must NOT be deleted
        'user-1_backup.png', // must NOT be deleted (underscore variant, unknown extension)
        'user-2.jpg', // must NOT be deleted (different user)
      ]);
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        avatarUrl: '/api/uploads/avatars/user-1.png',
        avatarPreset: null,
      });

      const mockFile = {
        mimetype: 'image/png',
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
      } as any;

      await service.uploadAvatar('user-1', mockFile);

      const unlinkMock = fs.unlink as unknown as Mock;
      const uploadsDir = join(process.cwd(), 'uploads', 'avatars');

      // Must NOT unlink non-image-extension files
      expect(unlinkMock).not.toHaveBeenCalledWith(
        join(uploadsDir, 'user-1.txt'),
      );
      expect(unlinkMock).not.toHaveBeenCalledWith(
        join(uploadsDir, 'user-1.sh'),
      );
      expect(unlinkMock).not.toHaveBeenCalledWith(
        join(uploadsDir, 'user-1_backup.png'),
      );
      // Must NOT touch other users' files
      expect(unlinkMock).not.toHaveBeenCalledWith(
        join(uploadsDir, 'user-2.jpg'),
      );
      // Must unlink the old avatar
      expect(unlinkMock).toHaveBeenCalledWith(join(uploadsDir, 'user-1.jpg'));
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

    it('SEC-015: never unlinks outside the uploads dir, even if stored avatarUrl traverses', async () => {
      // Inject a malicious stored value directly, bypassing SEC-010's write
      // validation — the whole point is that deleteAvatar must stay safe even
      // if a traversing value somehow reaches the DB.
      mockPrismaService.user.findUnique.mockResolvedValue({
        avatarUrl: '/api/../../../../../../etc/passwd',
      });
      mockPrismaService.user.update.mockResolvedValue({
        avatarUrl: null,
        avatarPreset: null,
      });
      (fs.readdir as unknown as Mock).mockResolvedValueOnce([]);

      await service.deleteAvatar('user-1');

      const uploadsDir = resolve(process.cwd(), 'uploads', 'avatars');
      const unlinkMock = fs.unlink as unknown as Mock;
      for (const call of unlinkMock.mock.calls) {
        expect(resolve(String(call[0])).startsWith(uploadsDir + sep)).toBe(
          true,
        );
      }
      expect(unlinkMock).not.toHaveBeenCalledWith(
        expect.stringContaining('etc'),
      );
    });

    it('SEC-015: deletes the reconstructed in-dir avatar file by userId stem', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        avatarUrl: '/api/uploads/avatars/user-1.png',
      });
      mockPrismaService.user.update.mockResolvedValue({
        avatarUrl: null,
        avatarPreset: null,
      });
      (fs.readdir as unknown as Mock).mockResolvedValueOnce([
        'user-1.png',
        'user-2.png',
      ]);

      await service.deleteAvatar('user-1');

      const uploadsDir = resolve(process.cwd(), 'uploads', 'avatars');
      const unlinkMock = fs.unlink as unknown as Mock;
      expect(unlinkMock).toHaveBeenCalledWith(join(uploadsDir, 'user-1.png'));
      expect(unlinkMock).not.toHaveBeenCalledWith(
        join(uploadsDir, 'user-2.png'),
      );
    });
  });

  // SEC-020 — deactivating a user must immediately bump their nbf so any
  // live access token is rejected by JwtStrategy.validate on the next request.
  // Both update() (isActive true→false) and remove() (soft-delete) must call
  // JwtNotBeforeService.bumpUser with the target userId.
  describe('SEC-020: nbf bump on user deactivation', () => {
    const callerAdmin = {
      id: 'caller-admin-1',
      role: { code: 'ADMIN', templateKey: 'ADMIN' },
    };

    it('update(isActive:false) bumps nbf for the deactivated user', async () => {
      // assertCanManageUser → user.count
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      // update() loads existing user (isActive: true = transition will trigger)
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-1',
        roleId: 'role-x',
        isActive: true,
        departmentId: null,
        role: { code: 'CONTRIBUTEUR' },
        userServices: [],
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-1',
        isActive: false,
        role: { code: 'CONTRIBUTEUR' },
        userServices: [],
      });

      await service.update(
        'target-1',
        { isActive: false },
        'ADMIN',
        callerAdmin,
      );

      expect(mockJwtNotBefore.bumpUser).toHaveBeenCalledWith('target-1');
    });

    it('remove() bumps nbf for the soft-deleted user', async () => {
      // assertCanManageUser → user.count
      mockPrismaService.user.count.mockResolvedValueOnce(1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'target-2',
        isActive: true,
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 'target-2',
        isActive: false,
      });

      await service.remove('target-2', callerAdmin);

      expect(mockJwtNotBefore.bumpUser).toHaveBeenCalledWith('target-2');
    });
  });

  // COR-039 — changePassword() must call jwtNotBefore.bumpUser() so that live
  // access tokens are immediately invalidated after a password change.
  // Revoking refresh tokens alone (revokeAllForUser) does not invalidate tokens
  // that are already live; bumpUser sets a per-user nbf so JwtStrategy rejects them.
  it('COR-039 — changePassword() calls jwtNotBefore.bumpUser() after revoking refresh tokens', async () => {
    const mockUser = {
      id: 'user-cor039',
      passwordHash: await bcrypt.hash('OldPass1!', 12),
      forcePasswordChange: false,
    };
    mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaService.user.update.mockResolvedValue(mockUser);

    await service.changePassword('user-cor039', {
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass2@',
    });

    expect(mockJwtNotBefore.bumpUser).toHaveBeenCalledWith('user-cor039');
  });

  // SEC-028 / COR-039 — resetPassword() must also call jwtNotBefore.bumpUser()
  // so that the target's live access tokens are invalidated immediately after an
  // admin-forced password reset.
  it('SEC-028/COR-039 — resetPassword() calls jwtNotBefore.bumpUser() after revoking refresh tokens', async () => {
    const targetUser = {
      id: 'user-sec028',
      login: 'tsec028',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      role: { code: 'CONTRIBUTEUR' },
    };
    // resetPassword() calls findUnique twice when callerId is provided:
    // first for the target, second for the caller's role lookup.
    mockPrismaService.user.findUnique
      .mockResolvedValueOnce(targetUser) // target
      .mockResolvedValueOnce({ role: { code: 'ADMIN' } }); // caller
    // roleHierarchy.assertCanAssignRole calls prisma.role.findUnique for templateKey
    mockPrismaService.role.findUnique
      .mockResolvedValueOnce({ templateKey: 'CONTRIBUTOR' }) // target role
      .mockResolvedValueOnce({ templateKey: 'ADMIN' }); // caller role
    mockPrismaService.user.update.mockResolvedValue({
      id: 'user-sec028',
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    await service.resetPassword('user-sec028', 'NewAdminPass3!', 'admin-1');

    expect(mockJwtNotBefore.bumpUser).toHaveBeenCalledWith('user-sec028');
  });

  // OBS-017 — create() must emit a USER_CREATED audit row so that admin user
  // provisioning is traceable in the immutable audit trail.
  it('OBS-017 — create() emits a USER_CREATED audit row after prisma.user.create()', async () => {
    const mockDepartment = { id: 'dept-1', name: 'IT' };
    const mockCreatedUser = {
      id: 'new-obs017',
      email: 'obs017@example.com',
      login: 'obs017',
      firstName: 'Obs',
      lastName: 'Seventeen',
      role: {
        id: 'role-contrib',
        code: 'CONTRIBUTEUR',
        label: 'Contributeur',
        templateKey: 'CONTRIBUTOR',
        isSystem: false,
      },
      roleId: 'role-contrib',
      departmentId: 'dept-1',
      avatarUrl: null,
      avatarPreset: null,
      isActive: true,
      createdAt: new Date(),
      department: mockDepartment,
      userServices: [],
    };

    mockPrismaService.user.findFirst.mockResolvedValue(null);
    mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
    mockPrismaService.service.findMany.mockResolvedValue([]);
    mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-contrib' });
    mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);

    await service.create(
      {
        email: 'obs017@example.com',
        login: 'obs017',
        password: 'Password1!',
        firstName: 'Obs',
        lastName: 'Seventeen',
        roleCode: 'CONTRIBUTEUR',
        departmentId: 'dept-1',
      },
      undefined,
      'admin-caller-1',
    );

    expect(mockAuditPersistence.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: 'new-obs017',
      }),
    );
  });

  // OBS-016 — importUsers() must emit a USER_CREATED audit row for each
  // successfully imported user so that bulk provisioning is traceable.
  it('OBS-016 — importUsers() emits USER_CREATED audit row for each successfully created user', async () => {
    const importData = [
      {
        email: 'obs016@example.com',
        login: 'obs016',
        password: 'Password1!',
        firstName: 'Obs',
        lastName: 'Sixteen',
        roleCode: 'CONTRIBUTEUR',
      },
    ];

    mockPrismaService.department.findMany.mockResolvedValue([]);
    mockPrismaService.service.findMany.mockResolvedValue([]);
    mockPrismaService.role.findMany.mockResolvedValue([
      { id: 'role-contrib', code: 'CONTRIBUTEUR' },
    ]);
    mockPrismaService.user.findMany.mockResolvedValue([]);
    mockPrismaService.user.create.mockResolvedValue({
      id: 'created-obs016',
      email: 'obs016@example.com',
      login: 'obs016',
      firstName: 'Obs',
      lastName: 'Sixteen',
      roleId: 'role-contrib',
      role: {
        id: 'role-contrib',
        code: 'CONTRIBUTEUR',
        label: 'Contributeur',
        templateKey: 'CONTRIBUTOR',
      },
      departmentId: null,
      avatarUrl: null,
      avatarPreset: null,
    });

    const result = await service.importUsers(importData, undefined, 'admin-1');

    expect(result.created).toBe(1);
    expect(mockAuditPersistence.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: 'created-obs016',
      }),
    );
  });

  // SA-DAT-004 — hardDelete() must write the USER_DELETED audit AFTER the
  // erasure transaction commits. Writing it before the transaction means the
  // audit entry is durable even if the transaction rolls back (ghost audit).
  it('SA-DAT-004 — hardDelete() writes USER_DELETED audit AFTER the erasure transaction, not before', async () => {
    const callOrder: string[] = [];

    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'user-sadat004',
      email: 'sadat004@example.com',
      login: 'sadat004',
      firstName: 'Sa',
      lastName: 'Dat004',
      roleId: 'role-1',
      departmentId: null,
      isActive: true,
      avatarUrl: null,
      avatarPreset: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrismaService.auditLog.count.mockResolvedValue(0);

    // Override $transaction to record when it runs
    mockPrismaService.$transaction.mockImplementationOnce(
      async (callback: (tx: typeof mockPrismaService) => Promise<void>) => {
        callOrder.push('transaction');
        return callback(mockPrismaService);
      },
    );

    // Override auditPersistence.log to record when it runs
    mockAuditPersistence.log.mockImplementationOnce(async () => {
      callOrder.push('audit');
    });

    mockPrismaService.user.delete.mockResolvedValue({ id: 'user-sadat004' });

    await service.hardDelete('user-sadat004', 'admin-1');

    // Audit must come AFTER transaction (index of 'audit' > index of 'transaction')
    expect(callOrder.indexOf('transaction')).toBeLessThan(
      callOrder.indexOf('audit'),
    );
  });

  // COR-040 — update() must wrap the serviceIds deleteMany+createMany+user.update
  // inside a single $transaction so that a failure in user.update does not leave
  // orphaned (deleted but not re-created) service memberships.
  it('COR-040 — update() wraps serviceIds mutation and user.update in a single $transaction', async () => {
    // assertCanManageUser → user.count
    mockPrismaService.user.count.mockResolvedValueOnce(1);
    mockPrismaService.user.findUnique.mockResolvedValueOnce({
      id: 'cor040-user',
      roleId: 'role-x',
      isActive: true,
      departmentId: null,
      role: { code: 'CONTRIBUTEUR' },
      userServices: [{ serviceId: 'svc-old' }],
    });
    mockPrismaService.service.findMany.mockResolvedValue([
      { id: 'svc-new', name: 'New Service' },
    ]);
    mockPrismaService.userService.deleteMany.mockResolvedValue({ count: 1 });
    mockPrismaService.userService.createMany.mockResolvedValue({ count: 1 });
    mockPrismaService.user.update.mockResolvedValueOnce({
      id: 'cor040-user',
      isActive: true,
      role: { code: 'CONTRIBUTEUR' },
      userServices: [{ service: { id: 'svc-new', name: 'New Service' } }],
    });

    await service.update('cor040-user', { serviceIds: ['svc-new'] }, 'ADMIN');

    // $transaction must have been called (wrapping the serviceIds mutation + user.update)
    expect(mockPrismaService.$transaction).toHaveBeenCalled();
  });

  // PER-030 — importUsers() must not call prisma.user.findFirst() once per row.
  // A single pre-flight findMany for all emails+logins must replace the N per-row
  // findFirst calls, reducing DB round-trips from O(N) to O(1).
  it('PER-030 — importUsers() uses a single pre-flight findMany for duplicate check, not per-row findFirst calls', async () => {
    const importData = [
      {
        email: 'per030a@example.com',
        login: 'per030a',
        password: 'Password1!',
        firstName: 'Per',
        lastName: 'ThirtyA',
        roleCode: 'CONTRIBUTEUR',
      },
      {
        email: 'per030b@example.com',
        login: 'per030b',
        password: 'Password1!',
        firstName: 'Per',
        lastName: 'ThirtyB',
        roleCode: 'CONTRIBUTEUR',
      },
    ];

    mockPrismaService.department.findMany.mockResolvedValue([]);
    mockPrismaService.service.findMany.mockResolvedValue([]);
    mockPrismaService.role.findMany.mockResolvedValue([
      { id: 'role-contrib', code: 'CONTRIBUTEUR' },
    ]);
    // Pre-flight findMany returns empty (no duplicates)
    mockPrismaService.user.findMany.mockResolvedValue([]);
    mockPrismaService.user.create.mockResolvedValue({
      id: 'any-id',
      email: 'per030a@example.com',
      login: 'per030a',
      firstName: 'Per',
      lastName: 'ThirtyA',
      roleId: 'role-contrib',
      role: {
        id: 'role-contrib',
        code: 'CONTRIBUTEUR',
        label: 'Contributeur',
        templateKey: 'CONTRIBUTOR',
      },
      departmentId: null,
      avatarUrl: null,
      avatarPreset: null,
    });

    await service.importUsers(importData);

    // findFirst must NOT have been called (N+1 eliminated)
    expect(mockPrismaService.user.findFirst).not.toHaveBeenCalled();
    // findMany must have been called exactly once for the pre-flight duplicate check
    // (note: findMany is also called for departments/services/roles via Promise.all,
    //  so we check that the user.findMany call includes the OR with emails/logins)
    const userFindManyCalls = mockPrismaService.user.findMany.mock.calls;
    expect(userFindManyCalls.length).toBeGreaterThanOrEqual(1);
    const preflightCall = userFindManyCalls.find((call: unknown[]) => {
      const arg = call[0] as { where?: { OR?: unknown[] } };
      return arg?.where?.OR !== undefined;
    });
    expect(preflightCall).toBeDefined();
  });
});
