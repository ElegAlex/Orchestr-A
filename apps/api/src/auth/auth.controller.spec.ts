import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { User } from '@prisma/client';
import { RefreshTokenService } from './refresh-token.service';
import { JwtBlacklistService } from './jwt-blacklist.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
    login: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    role: 'CONTRIBUTEUR',
    isActive: true,
    departmentId: 'dept-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuthService = {
    login: vi.fn(),
    register: vi.fn(),
    getProfile: vi.fn(),
    getPermissionsForUser: vi.fn(),
    generateResetToken: vi.fn(),
    resetPassword: vi.fn(),
  };

  const mockRefreshTokenService = {
    issue: vi.fn(),
    rotate: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    getCookieMaxAgeSeconds: vi.fn().mockReturnValue(604800),
  };

  const mockBlacklist = {
    blacklist: vi.fn(),
    isBlacklisted: vi.fn(),
  };

  const mockReq = { headers: {}, ip: '127.0.0.1', ips: [] };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: RefreshTokenService,
          useValue: mockRefreshTokenService,
        },
        {
          provide: JwtBlacklistService,
          useValue: mockBlacklist,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    const loginDto = {
      login: 'testuser',
      password: 'password123',
    };

    it('should return access token and user on successful login', async () => {
      const expectedResult = {
        access_token: 'mock-jwt-token',
        user: mockUser,
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto, mockReq as any);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginDto,
        expect.any(Object),
      );
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Login ou mot de passe incorrect'),
      );

      await expect(controller.login(loginDto, mockReq as any)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginDto,
        expect.any(Object),
      );
    });

    it('should handle login with email instead of login', async () => {
      const emailLoginDto = {
        login: 'test@example.com',
        password: 'password123',
      };

      const expectedResult = {
        access_token: 'mock-jwt-token',
        user: mockUser,
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(emailLoginDto, mockReq as any);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        emailLoginDto,
        expect.any(Object),
      );
    });
  });

  // SEC-014 — refresh-token cookie hardening (__Host- + Path=/ + Secure +
  // SameSite=Strict in production; non-__Host- workable cookie in dev/test).
  describe('refresh cookie (SEC-014)', () => {
    const captureSetCookie = () => {
      const headers: Record<string, string> = {};
      const reply = {
        header: vi.fn((name: string, value: string) => {
          headers[name.toLowerCase()] = value;
        }),
      };
      return { reply, getSetCookie: () => headers['set-cookie'] };
    };

    const withNodeEnv = async (value: string, fn: () => Promise<void>) => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = value;
      try {
        await fn();
      } finally {
        process.env.NODE_ENV = prev;
      }
    };

    it('emits a __Host- prefixed, Secure, Path=/, SameSite=Strict cookie in production (set path)', async () => {
      await withNodeEnv('production', async () => {
        mockAuthService.login.mockResolvedValue({
          access_token: 'at',
          user: mockUser,
        });
        const { reply, getSetCookie } = captureSetCookie();

        await controller.login(
          { login: 'testuser', password: 'pw' },
          mockReq as any,
          reply as any,
        );

        const cookie = getSetCookie();
        expect(cookie).toBeDefined();
        expect(cookie).toMatch(/^__Host-orchestr_a_refresh_token=/);
        expect(cookie).toContain('Path=/;');
        expect(cookie).toContain('Secure');
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Strict');
        // __Host- cookies MUST NOT carry a Domain attribute (browser drops them
        // silently otherwise) and must not be scoped to /api/auth.
        expect(cookie).not.toMatch(/Domain=/i);
        expect(cookie).not.toContain('Path=/api/auth');
        expect(cookie).not.toContain('SameSite=Lax');
      });
    });

    it('resolves the production __Host- cookie name on the read path (refresh)', async () => {
      await withNodeEnv('production', async () => {
        mockRefreshTokenService.rotate.mockResolvedValue({
          userId: 'user-id-1',
          newRefreshToken: 'rotated',
        });
        mockAuthService.issueAccessTokenForUser = vi
          .fn()
          .mockResolvedValue('new-at');
        const { reply } = captureSetCookie();
        const req = {
          headers: {
            cookie: '__Host-orchestr_a_refresh_token=the-cookie-token',
          },
          ip: '127.0.0.1',
          ips: [],
        };

        await controller.refresh({} as any, req as any, reply as any);

        expect(mockRefreshTokenService.rotate).toHaveBeenCalledWith(
          'the-cookie-token',
          expect.any(Object),
        );
      });
    });

    it('still resolves the legacy cookie name during the rename transition window', async () => {
      await withNodeEnv('production', async () => {
        mockRefreshTokenService.rotate.mockResolvedValue({
          userId: 'user-id-1',
          newRefreshToken: 'rotated',
        });
        mockAuthService.issueAccessTokenForUser = vi
          .fn()
          .mockResolvedValue('new-at');
        const { reply } = captureSetCookie();
        const req = {
          headers: { cookie: 'orchestr_a_refresh_token=legacy-token' },
          ip: '127.0.0.1',
          ips: [],
        };

        await controller.refresh({} as any, req as any, reply as any);

        expect(mockRefreshTokenService.rotate).toHaveBeenCalledWith(
          'legacy-token',
          expect.any(Object),
        );
      });
    });

    it('emits a workable non-__Host-, non-Secure cookie in dev/test (http localhost)', async () => {
      await withNodeEnv('development', async () => {
        mockAuthService.login.mockResolvedValue({
          access_token: 'at',
          user: mockUser,
        });
        const { reply, getSetCookie } = captureSetCookie();

        await controller.login(
          { login: 'testuser', password: 'pw' },
          mockReq as any,
          reply as any,
        );

        const cookie = getSetCookie();
        expect(cookie).toBeDefined();
        expect(cookie).toMatch(/^orchestr_a_refresh_token=/);
        // No __Host- prefix and no Secure in dev — http://localhost can't carry
        // Secure cookies, which would break local dev + e2e refresh.
        expect(cookie).not.toContain('__Host-');
        expect(cookie).not.toContain('Secure');
        expect(cookie).toContain('HttpOnly');
      });
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      login: 'newuser',
      password: 'SecurePass123!',
      firstName: 'New',
      lastName: 'User',
      departmentId: 'dept-1',
    };

    it('should register a new user successfully', async () => {
      const expectedResult = {
        access_token: 'new-user-token',
        user: {
          ...mockUser,
          email: registerDto.email,
          login: registerDto.login,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
        },
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockAuthService.register.mockRejectedValue(
        new ConflictException('Cet email est déjà utilisé'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });

    it('should throw ConflictException when login already exists', async () => {
      mockAuthService.register.mockRejectedValue(
        new ConflictException('Ce login est déjà utilisé'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should register user with optional serviceIds', async () => {
      const registerWithServicesDto = {
        ...registerDto,
        serviceIds: ['service-1', 'service-2'],
      };

      const expectedResult = {
        access_token: 'new-user-token',
        user: mockUser,
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerWithServicesDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.register).toHaveBeenCalledWith(
        registerWithServicesDto,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile for authenticated user', async () => {
      const userProfile = {
        ...mockUser,
        department: { id: 'dept-1', name: 'IT Department' },
        userServices: [{ service: { id: 'service-1', name: 'Development' } }],
      };

      mockAuthService.getProfile.mockResolvedValue(userProfile);

      const result = await controller.getProfile('user-id-1');

      expect(result).toEqual(userProfile);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-id-1');
      expect(mockAuthService.getProfile).toHaveBeenCalledTimes(1);
    });

    it('should throw error when user not found', async () => {
      mockAuthService.getProfile.mockRejectedValue(
        new Error('Utilisateur introuvable'),
      );

      await expect(controller.getProfile('nonexistent-id')).rejects.toThrow(
        'Utilisateur introuvable',
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user from JWT payload', () => {
      const jwtPayload = {
        id: 'user-id-1',
        email: 'test@example.com',
        login: 'testuser',
        role: 'CONTRIBUTEUR',
      } as unknown as User;

      const result = controller.getCurrentUser(jwtPayload);

      expect(result).toEqual(jwtPayload);
    });

    it('should return full user object if provided', () => {
      const fullUser = {
        id: 'user-id-1',
        email: 'test@example.com',
        login: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
        departmentId: 'dept-1',
      } as unknown as User;

      const result = controller.getCurrentUser(fullUser);

      expect(result).toEqual(fullUser);
      expect(result.role).toBe('ADMIN');
    });
  });

  describe('getMyPermissions', () => {
    it('should return permissions for authenticated user', async () => {
      const permissions = ['projects:create', 'projects:read', 'tasks:create'];
      mockAuthService.getPermissionsForUser.mockResolvedValue(permissions);

      const result = await controller.getMyPermissions(
        mockUser as unknown as User,
      );

      expect(result).toEqual({ permissions });
      expect(mockAuthService.getPermissionsForUser).toHaveBeenCalledWith(
        mockUser,
      );
    });

    it('should return all permissions for ADMIN role', async () => {
      const adminUser = { ...mockUser, role: 'ADMIN' };
      const allPermissions = [
        'projects:create',
        'projects:read',
        'projects:update',
        'projects:delete',
        'tasks:create',
        'tasks:read',
        'tasks:update',
        'tasks:delete',
        'users:create',
        'users:read',
        'users:update',
        'users:delete',
      ];
      mockAuthService.getPermissionsForUser.mockResolvedValue(allPermissions);

      const result = await controller.getMyPermissions(
        adminUser as unknown as User,
      );

      expect(result).toEqual({ permissions: allPermissions });
      expect(mockAuthService.getPermissionsForUser).toHaveBeenCalledWith(
        adminUser,
      );
    });

    it('should return empty array for role with no permissions', async () => {
      mockAuthService.getPermissionsForUser.mockResolvedValue([]);

      const result = await controller.getMyPermissions(
        mockUser as unknown as User,
      );

      expect(result).toEqual({ permissions: [] });
    });
  });

  describe('generateResetToken', () => {
    it('should return token and resetUrl for valid userId', async () => {
      const expected = {
        ok: true as const,
        token: 'uuid-token',
        resetUrl: 'http://localhost:4001/reset-password?token=uuid-token',
      };
      mockAuthService.generateResetToken.mockResolvedValue(expected);

      const result = await controller.generateResetToken(
        { userId: 'user-id-1' },
        mockUser as unknown as User,
      );

      expect(result).toEqual(expected);
      expect(mockAuthService.generateResetToken).toHaveBeenCalledWith(
        'user-id-1',
        mockUser.id,
      );
    });
  });

  describe('resetPassword', () => {
    it('should return success message when token is valid', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPass123!',
      });

      expect(result).toEqual({
        message: 'Mot de passe mis à jour avec succès',
      });
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'valid-token',
        'NewPass123!',
      );
    });

    it('should propagate UnauthorizedException for invalid token', async () => {
      mockAuthService.resetPassword.mockRejectedValue(
        new UnauthorizedException('Token invalide'),
      );

      await expect(
        controller.resetPassword({
          token: 'bad-token',
          newPassword: 'Abc12345!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
