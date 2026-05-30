import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PermissionsService } from '../rbac/permissions.service';
import { AuditService, AuditAction } from '../audit/audit.service';
import { RefreshTokenService } from './refresh-token.service';
import { ConfigService } from '@nestjs/config';
import { RoleHierarchyService } from '../common/services/role-hierarchy.service';

vi.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
    login: 'testuser',
    passwordHash: '$2b$12$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    role: 'CONTRIBUTEUR',
    isActive: true,
    departmentId: 'dept-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    userService: {
      createMany: vi.fn(),
    },
    passwordResetToken: {
      updateMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  };

  const mockJwtService = {
    sign: vi.fn(),
  };

  const mockPermissionsService = {
    getPermissionsForRole: vi.fn(),
    getPermissionsForUser: vi.fn(),
  };

  const mockAuditService = {
    log: vi.fn(),
  };

  const mockRefreshTokenService = {
    issue: vi.fn().mockResolvedValue('mock-refresh-token'),
    rotate: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'JWT_ACCESS_TTL') return '15m';
      if (key === 'JWT_EXPIRES_IN') return undefined;
      if (key === 'AUTH_EXPOSE_RESET_TOKEN') return 'true';
      return undefined;
    }),
  };

  const mockRoleHierarchy = {
    assertCanAssignRole: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: RefreshTokenService,
          useValue: mockRefreshTokenService,
        },
        {
          provide: RoleHierarchyService,
          useValue: mockRoleHierarchy,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without password if credentials are valid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await service.validateUser('testuser', 'password123');

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUser.id);
      expect(result?.email).toBe(mockUser.email);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password123');

      expect(result).toBeNull();
    });

    it('should return null if password is incorrect', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token for valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login({
        login: 'testuser',
        password: 'password123',
      });

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.id).toBe(mockUser.id);
    });

    // TST-011 — assert the LOGIN_SUCCESS audit emission at the call site
    // (auth.service.ts:167). Pre-TST-011 the AuditService mock was wired but
    // never asserted, so a silent regression dropping the row went unnoticed.
    it('emits LOGIN_SUCCESS on a successful login (TST-011)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      await service.login(
        { login: 'testuser', password: 'password123' },
        { ip: '10.1.2.3', userAgent: 'vitest' },
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN_SUCCESS,
          userId: mockUser.id,
          ip: '10.1.2.3',
          ua: 'vitest',
          success: true,
        }),
      );
      // The success path must not also emit a LOGIN_FAILURE row.
      expect(mockAuditService.log).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.LOGIN_FAILURE }),
      );
    });

    // SEC-004 — a forcePasswordChange-flagged user's session must be stamped
    // with the mustChangePassword claim so the token carries restricted
    // authority. FAILS pre-fix (claim not threaded into signAccessToken).
    it('stamps mustChangePassword into the token for a flagged user (SEC-004)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: 'hash',
        forcePasswordChange: true,
        role: { code: 'CONTRIBUTEUR' },
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      await service.login({ login: 'testuser', password: 'password123' });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ mustChangePassword: true }),
        expect.anything(),
      );
    });

    it('does NOT stamp mustChangePassword for an unflagged user (SEC-004)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: 'hash',
        forcePasswordChange: false,
        role: { code: 'CONTRIBUTEUR' },
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      await service.login({ login: 'testuser', password: 'password123' });

      const signArgs = mockJwtService.sign.mock.calls[0][0] as {
        mustChangePassword?: boolean;
      };
      expect(signArgs.mustChangePassword).toBeUndefined();
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ login: 'nonexistent', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    // TST-011 — LOGIN_FAILURE fires BEFORE the UnauthorizedException throw
    // (auth.service.ts:97); the emission is observable once the rejection
    // settles. attemptedEmail carries the OBS-001 "who was targeted" subject.
    it('emits LOGIN_FAILURE before throwing on invalid credentials (TST-011)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login(
          { login: 'nonexistent', password: 'password123' },
          { ip: '10.9.9.9', userAgent: 'attacker' },
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN_FAILURE,
          attemptedEmail: 'nonexistent',
          ip: '10.9.9.9',
          ua: 'attacker',
          reason: 'invalid_credentials',
          success: false,
        }),
      );
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      login: 'newuser',
      password: 'SecurePass123!',
      firstName: 'New',
      lastName: 'User',
    };

    it('should create a new user with hashed password (inactive, pending admin approval)', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'default-role-id',
      });
      mockPrismaService.role.findUnique.mockResolvedValue({
        id: 'default-role-id',
      });
      vi.mocked(bcrypt.hash).mockResolvedValue(
        '$2b$12$hashedpassword' as never,
      );

      const createdUser = {
        id: 'new-user-id',
        email: registerDto.email,
        login: registerDto.login,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        roleId: 'default-role-id',
        role: {
          id: 'default-role-id',
          code: 'CONTRIBUTEUR',
          label: 'Contributeur',
          templateKey: 'CONTRIBUTEUR',
        },
        departmentId: null,
        createdAt: new Date(),
      };
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(result.message).toContain('administrateur');
      expect(result.user.email).toBe(registerDto.email);
      // No tokens should be issued — account is inactive
      expect(result).not.toHaveProperty('access_token');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      // TST-011 — REGISTER audit emission at auth.service.ts:255.
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.REGISTER,
          userId: 'new-user-id',
          success: true,
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      // TST-011 — no-op negative: a rejected registration (duplicate email)
      // must leave no REGISTER row; the emission is downstream of the guard.
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('should always assign the default role regardless of input', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'default-role-id',
      });
      mockPrismaService.role.findUnique.mockResolvedValue({
        id: 'default-role-id',
      });
      vi.mocked(bcrypt.hash).mockResolvedValue(
        '$2b$12$hashedpassword' as never,
      );
      const createdUser = {
        id: 'new-user-id',
        email: registerDto.email,
        login: registerDto.login,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        roleId: 'default-role-id',
        role: {
          id: 'default-role-id',
          code: 'CONTRIBUTEUR',
          label: 'Contributeur',
          templateKey: 'CONTRIBUTEUR',
        },
        departmentId: null,
        createdAt: new Date(),
      };
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      expect(result.user.role?.code).toBe('CONTRIBUTEUR');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roleId: 'default-role-id' }),
        }),
      );
    });

    it('should ignore role=ADMIN in body and create user with default role (role injection prevention)', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'default-role-id',
      });
      mockPrismaService.role.findUnique.mockResolvedValue({
        id: 'default-role-id',
      });
      vi.mocked(bcrypt.hash).mockResolvedValue(
        '$2b$12$hashedpassword' as never,
      );
      const createdUser = {
        id: 'new-user-id',
        email: registerDto.email,
        login: registerDto.login,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        roleId: 'default-role-id',
        role: {
          id: 'default-role-id',
          code: 'CONTRIBUTEUR',
          label: 'Contributeur',
          templateKey: 'CONTRIBUTEUR',
        },
        departmentId: null,
        createdAt: new Date(),
      };
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      // Simulate a malicious client sending role=ADMIN as extra JSON field
      const maliciousDto = {
        ...registerDto,
        role: 'ADMIN',
      } as typeof registerDto & { role: string };

      const result = await service.register(maliciousDto);

      // The returned user must be CONTRIBUTEUR, never ADMIN
      expect(result.user.role?.code).toBe('CONTRIBUTEUR');
      // Prisma create must have been called with the default roleId only
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roleId: 'default-role-id' }),
        }),
      );
      // The raw string "role" field from the body must NEVER be forwarded to Prisma
      const createCallData = mockPrismaService.user.create.mock.calls[0][0]
        .data as Record<string, unknown>;
      expect(createCallData.role).toBeUndefined();
    });
  });

  describe('generateResetToken', () => {
    /**
     * Le service fait deux lookups successifs : target user (avec role.code),
     * puis caller (avec role.code). On programme `findUnique` pour répondre à
     * la requête courante en inspectant `where.id`.
     */
    function arrangeUsers(opts: {
      target?: { id: string; login: string; roleCode: string | null } | null;
      caller?: { roleCode: string | null } | null;
    }) {
      const { target, caller } = opts;
      mockPrismaService.user.findUnique.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (target && where.id === target.id) {
            return Promise.resolve({
              id: target.id,
              login: target.login,
              role: target.roleCode ? { code: target.roleCode } : null,
            });
          }
          if (caller !== undefined) {
            return Promise.resolve(
              caller
                ? { role: caller.roleCode ? { code: caller.roleCode } : null }
                : null,
            );
          }
          return Promise.resolve(null);
        },
      );
    }

    it('should generate a reset token and invalidate previous ones (caller above target)', async () => {
      arrangeUsers({
        target: { id: 'user-id-1', login: 'jdoe', roleCode: 'CONTRIBUTEUR' },
        caller: { roleCode: 'ADMIN' },
      });
      mockPrismaService.passwordResetToken.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.passwordResetToken.create.mockResolvedValue({
        id: 'token-id',
        token: 'generated-uuid',
      });

      const result = await service.generateResetToken('user-id-1', 'admin-id');

      expect(mockRoleHierarchy.assertCanAssignRole).toHaveBeenCalledWith(
        'ADMIN',
        'CONTRIBUTEUR',
      );
      expect(result.ok).toBe(true);
      // AUTH_EXPOSE_RESET_TOKEN=true in mockConfigService → fields present
      expect(result.token).toBeDefined();
      expect(result.resetUrl).toContain(result.token!);
      expect(
        mockPrismaService.passwordResetToken.updateMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-id-1', usedAt: null },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
      expect(mockPrismaService.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-id-1',
            createdById: 'admin-id',
          }),
        }),
      );
      // TST-011 — PASSWORD_CHANGED audit emission at auth.service.ts:407
      // (reset-token generated). The actor is the caller (createdById).
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PASSWORD_CHANGED,
          userId: 'admin-id',
          success: true,
        }),
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.generateResetToken('nonexistent-id', 'admin-id'),
      ).rejects.toThrow('Utilisateur introuvable');
      // TST-011 — no-op negative: an unknown target emits nothing.
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when caller is not above target (Issue 2: cross-tier reset)', async () => {
      arrangeUsers({
        target: { id: 'admin-id', login: 'admin', roleCode: 'ADMIN' },
        caller: { roleCode: 'ADMIN_DELEGATED' },
      });
      mockRoleHierarchy.assertCanAssignRole.mockRejectedValueOnce(
        new ForbiddenException('cross-tier'),
      );

      await expect(
        service.generateResetToken('admin-id', 'delegated-id'),
      ).rejects.toThrow(ForbiddenException);

      // Aucun token ne doit être créé si la garde refuse
      expect(
        mockPrismaService.passwordResetToken.create,
      ).not.toHaveBeenCalled();
      // TST-011 — no-op negative: a guard-rejected reset emits no
      // PASSWORD_CHANGED row (emission is downstream of the hierarchy gate).
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('should NOT expose token/resetUrl when AUTH_EXPOSE_RESET_TOKEN is false (Issue 2: disclosure)', async () => {
      mockConfigService.get.mockImplementationOnce((key: string) => {
        if (key === 'AUTH_EXPOSE_RESET_TOKEN') return 'false';
        return undefined;
      });
      // Une seule occurrence de override → on remet en place pour les autres
      // appels (mockImplementationOnce ne couvre qu'un appel) ; le service
      // n'invoque get('AUTH_EXPOSE_RESET_TOKEN') qu'une fois par requête, OK.
      arrangeUsers({
        target: { id: 'user-id-1', login: 'jdoe', roleCode: 'CONTRIBUTEUR' },
        caller: { roleCode: 'ADMIN' },
      });
      mockPrismaService.passwordResetToken.updateMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.passwordResetToken.create.mockResolvedValue({
        id: 'token-id',
      });

      const result = await service.generateResetToken('user-id-1', 'admin-id');

      expect(result).toEqual({ ok: true });
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('resetUrl');
      // Le token doit quand même être persisté en DB pour usage ultérieur
      expect(mockPrismaService.passwordResetToken.create).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const validToken = {
      id: 'token-id',
      token: 'valid-token-uuid',
      userId: 'user-id-1',
      expiresAt: new Date(Date.now() + 3600 * 1000), // +1h
      usedAt: null,
      createdById: 'admin-id',
      createdAt: new Date(),
    };

    it('should update password and mark token as used for a valid token', async () => {
      const tokenHash = crypto
        .createHash('sha256')
        .update('valid-token-uuid')
        .digest('hex');
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(
        validToken,
      );
      vi.mocked(bcrypt.hash).mockResolvedValue(
        '$2b$12$newhashedpassword' as never,
      );
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.passwordResetToken.update.mockResolvedValue({});

      await service.resetPassword('valid-token-uuid', 'NewPassword1!');

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword1!', 12);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validToken.userId },
          data: { passwordHash: '$2b$12$newhashedpassword' },
        }),
      );
      expect(mockPrismaService.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: tokenHash },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
      // TST-011 — PASSWORD_CHANGED audit emission at auth.service.ts:460
      // (reset via token). Subject is the token's owner.
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PASSWORD_CHANGED,
          userId: validToken.userId,
          details: 'Password reset via token',
          success: true,
        }),
      );
    });

    it('should throw UnauthorizedException for an unknown token', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('unknown-token', 'NewPassword1!'),
      ).rejects.toThrow(UnauthorizedException);
      // TST-011 — no-op negative: an unknown token emits nothing.
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for an expired token', async () => {
      const expiredToken = {
        ...validToken,
        expiresAt: new Date(Date.now() - 3600 * 1000), // -1h (expired)
      };
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(
        expiredToken,
      );

      await expect(
        service.resetPassword('expired-token', 'NewPassword1!'),
      ).rejects.toThrow('Ce token de réinitialisation a expiré');
      // TST-011 — no-op negative: an expired token emits nothing.
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for an already used token', async () => {
      const usedToken = {
        ...validToken,
        usedAt: new Date(Date.now() - 600 * 1000), // used 10min ago
      };
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(
        usedToken,
      );

      await expect(
        service.resetPassword('used-token', 'NewPassword1!'),
      ).rejects.toThrow('Ce token de réinitialisation a déjà été utilisé');
      // TST-011 — no-op negative: an already-used token emits nothing.
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const userWithRelations = {
        ...mockUser,
        department: { id: 'dept-1', name: 'IT' },
        userServices: [],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(userWithRelations);

      const result = await service.getProfile('user-id-1');

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
