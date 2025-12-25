import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as bcrypt from 'bcrypt';

vi.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

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
  };

  const mockJwtService = {
    sign: vi.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without password if credentials are valid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);

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
      (bcrypt.compare as any).mockResolvedValue(false);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token for valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
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
      departmentId: 'dept-1',
    };

    it('should create a new user with hashed password', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.department.findUnique.mockResolvedValue({
        id: 'dept-1',
        name: 'IT',
      });
      (bcrypt.hash as any).mockResolvedValue('$2b$12$hashedpassword');

      const createdUser = {
        id: 'new-user-id',
        email: registerDto.email,
        login: registerDto.login,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: 'CONTRIBUTEUR',
        departmentId: registerDto.departmentId,
        createdAt: new Date(),
      };
      mockPrismaService.user.create.mockResolvedValue(createdUser);
      mockJwtService.sign.mockReturnValue('new-user-token');

      const result = await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(result.access_token).toBe('new-user-token');
      expect(result.user.email).toBe(registerDto.email);
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

    it('should throw BadRequestException if department not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.department.findUnique.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
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
