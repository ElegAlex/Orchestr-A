import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from 'database';

describe('UsersService', () => {
  let service: UsersService;

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
    },
    service: {
      findMany: vi.fn(),
    },
    userService: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
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
        email: createUserDto.email,
        login: createUserDto.login,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role,
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
          role: 'ADMIN',
          isActive: true,
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockAdmins);
      mockPrismaService.user.count.mockResolvedValue(1);

      await service.findAll(1, 50, Role.ADMIN);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'ADMIN' },
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

      const result = await service.update('1', updateUserDto);

      expect(result).toBeDefined();
      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', updateUserDto),
      ).rejects.toThrow('Utilisateur introuvable');
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
      ).rejects.toThrow('Mot de passe actuel incorrect');
    });
  });
});
