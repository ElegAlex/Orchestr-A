import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PermissionsService } from '../rbac/permissions.service';
import { AuditService } from '../audit/audit.service';
import { RefreshTokenService } from './refresh-token.service';
import { ConfigService } from '@nestjs/config';

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
      return undefined;
    }),
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

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ login: 'nonexistent', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
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
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
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
    it('should generate a reset token and invalidate previous ones', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.passwordResetToken.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.passwordResetToken.create.mockResolvedValue({
        id: 'token-id',
        token: 'generated-uuid',
      });

      const result = await service.generateResetToken('user-id-1', 'admin-id');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('resetUrl');
      expect(result.resetUrl).toContain(result.token);
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
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.generateResetToken('nonexistent-id', 'admin-id'),
      ).rejects.toThrow('Utilisateur introuvable');
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
    });

    it('should throw UnauthorizedException for an unknown token', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('unknown-token', 'NewPassword1!'),
      ).rejects.toThrow(UnauthorizedException);
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
