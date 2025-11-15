import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as bcrypt from 'bcrypt';

vi.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
    login: 'testuser',
    password: '$2b$12$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    role: 'EMPLOYEE',
    isActive: true,
    departmentId: 'dept-1',
    serviceId: 'service-1',
    phoneNumber: null,
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    findOneByEmailOrLogin: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
  };

  const mockJwtService = {
    sign: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without password if credentials are valid', async () => {
      mockUsersService.findOneByEmailOrLogin.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUser.id);
      expect(result?.email).toBe(mockUser.email);
      expect(result).not.toHaveProperty('password');
    });

    it('should return null if user not found', async () => {
      mockUsersService.findOneByEmailOrLogin.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password123');

      expect(result).toBeNull();
    });

    it('should return null if password is incorrect', async () => {
      mockUsersService.findOneByEmailOrLogin.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token for valid user', async () => {
      const userWithoutPassword = { ...mockUser };
      delete (userWithoutPassword as any).password;

      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login(userWithoutPassword);

      expect(result).toEqual({
        access_token: 'mock-jwt-token',
        user: userWithoutPassword,
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
      role: 'EMPLOYEE' as const,
      departmentId: 'dept-1',
      serviceId: 'service-1',
    };

    it('should create a new user with hashed password', async () => {
      (bcrypt.hash as any).mockResolvedValue('$2b$12$hashedpassword');
      const createdUser = { ...mockUser, ...registerDto };
      mockUsersService.create.mockResolvedValue(createdUser);
      mockJwtService.sign.mockReturnValue('new-user-token');

      const result = await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 12);
      expect(result.access_token).toBe('new-user-token');
    });
  });
});
