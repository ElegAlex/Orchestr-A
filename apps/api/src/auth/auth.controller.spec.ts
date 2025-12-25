import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
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
      };

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
      };

      const result = controller.getCurrentUser(fullUser);

      expect(result).toEqual(fullUser);
      expect(result.role).toBe('ADMIN');
    });
  });
});
