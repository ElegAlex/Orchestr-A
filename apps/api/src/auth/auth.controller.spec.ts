import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PermissionsGuard } from './guards/permissions.guard';
import { RoleManagementService } from '../role-management/role-management.service';

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

  const mockRoleManagementService = {
    getPermissionsForRole: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: RoleManagementService,
          useValue: mockRoleManagementService,
        },
        PermissionsGuard,
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

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Login ou mot de passe incorrect'),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
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

      const result = await controller.login(emailLoginDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(emailLoginDto);
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
        'CONTRIBUTEUR',
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
        'ADMIN',
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
