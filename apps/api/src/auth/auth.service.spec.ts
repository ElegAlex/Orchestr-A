import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
    },
    userService: {
      createMany: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
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
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user data without password when credentials are valid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        login: 'testuser',
        passwordHash: await bcrypt.hash('password123', 10),
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        departmentId: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateUser('testuser', 'password123');

      expect(result).toBeDefined();
      expect(result.login).toBe('testuser');
      expect(result.passwordHash).toBeUndefined();
    });

    it('should return null when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password123');

      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        login: 'testuser',
        passwordHash: await bcrypt.hash('password123', 10),
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        departmentId: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should throw error when user is inactive', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        login: 'testuser',
        passwordHash: await bcrypt.hash('password123', 10),
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: false,
        departmentId: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.validateUser('testuser', 'password123')).rejects.toThrow('Compte désactivé');
    });
  });

  describe('login', () => {
    it('should return access token and user data', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        login: 'testuser',
        passwordHash: await bcrypt.hash('password123', 10),
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        departmentId: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const loginDto = {
        login: 'testuser',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.login).toBe('testuser');
      expect(result.user.email).toBe('test@example.com');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        login: mockUser.login,
        role: mockUser.role,
      });
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      login: 'newuser',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
      role: 'CONTRIBUTEUR' as const,
      departmentId: 'dept-1',
      serviceIds: ['service-1'],
    };

    it('should create a new user successfully', async () => {
      const mockDepartment = { id: 'dept-1', name: 'IT' };
      const mockServices = [{ id: 'service-1', name: 'Development' }];
      const mockCreatedUser = {
        id: '1',
        email: registerDto.email,
        login: registerDto.login,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: registerDto.role,
        departmentId: registerDto.departmentId,
        createdAt: new Date(),
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.service.findMany.mockResolvedValue(mockServices);
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);
      mockPrismaService.userService.createMany.mockResolvedValue({ count: 1 });
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.register(registerDto);

      expect(result).toBeDefined();
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe(registerDto.email);
    });

    it('should throw error when email already exists', async () => {
      const existingUser = { id: '1', email: registerDto.email, login: 'otheruser' };
      mockPrismaService.user.findFirst.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow('Cet email est déjà utilisé');
    });

    it('should throw error when login already exists', async () => {
      const existingUser = { id: '1', email: 'other@example.com', login: registerDto.login };
      mockPrismaService.user.findFirst.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow('Ce login est déjà utilisé');
    });

    it('should throw error when department does not exist', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.department.findUnique.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toThrow('Département introuvable');
    });

    it('should throw error when services do not exist', async () => {
      const mockDepartment = { id: 'dept-1', name: 'IT' };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.service.findMany.mockResolvedValue([]);

      await expect(service.register(registerDto)).rejects.toThrow('Un ou plusieurs services introuvables');
    });
  });
});
