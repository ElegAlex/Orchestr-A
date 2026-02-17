import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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
      findMany: vi.fn(),
      count: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    userService: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    projectMember: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    leave: {
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
      deleteMany: vi.fn(),
    },
    leaveValidationDelegate: {
      deleteMany: vi.fn(),
    },
    task: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => callback(mockPrismaService)),
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
    it('should return canDelete true when no dependencies', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.projectMember.count.mockResolvedValue(0);
      mockPrismaService.leave.count.mockResolvedValue(0);
      mockPrismaService.department.count.mockResolvedValue(0);
      mockPrismaService.service.count.mockResolvedValue(0);

      const result = await service.checkDependencies('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.canDelete).toBe(true);
      expect(result.dependencies).toHaveLength(0);
    });

    it('should return canDelete false with dependencies', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      mockPrismaService.task.count.mockResolvedValue(3);
      mockPrismaService.projectMember.count.mockResolvedValue(2);
      mockPrismaService.leave.count.mockResolvedValue(0);
      mockPrismaService.department.count.mockResolvedValue(1);
      mockPrismaService.service.count.mockResolvedValue(0);

      const result = await service.checkDependencies('user-1');

      expect(result.canDelete).toBe(false);
      expect(result.dependencies.length).toBeGreaterThan(0);

      const taskDep = result.dependencies.find((d) => d.type === 'TASKS');
      expect(taskDep).toBeDefined();
      expect(taskDep!.count).toBe(3);

      const projectDep = result.dependencies.find((d) => d.type === 'PROJECTS');
      expect(projectDep).toBeDefined();
      expect(projectDep!.count).toBe(2);

      const deptDep = result.dependencies.find((d) => d.type === 'DEPARTMENTS');
      expect(deptDep).toBeDefined();
      expect(deptDep!.count).toBe(1);
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
      // checkDependencies mocks (no dependencies)
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.projectMember.count.mockResolvedValue(0);
      mockPrismaService.leave.count.mockResolvedValue(0);
      mockPrismaService.department.count.mockResolvedValue(0);
      mockPrismaService.service.count.mockResolvedValue(0);
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

    it('should throw ConflictException when dependencies exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      // checkDependencies mocks (has dependencies)
      mockPrismaService.task.count.mockResolvedValue(5);
      mockPrismaService.projectMember.count.mockResolvedValue(0);
      mockPrismaService.leave.count.mockResolvedValue(0);
      mockPrismaService.department.count.mockResolvedValue(0);
      mockPrismaService.service.count.mockResolvedValue(0);

      await expect(service.hardDelete('user-1', 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
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
  });

  describe('getUsersByDepartment', () => {
    it('should return users for a department', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          role: 'CONTRIBUTEUR',
          userServices: [],
        },
        {
          id: 'user-2',
          firstName: 'Marie',
          lastName: 'Martin',
          email: 'marie.martin@example.com',
          role: 'MANAGER',
          userServices: [],
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getUsersByDepartment('dept-1');

      expect(result).toHaveLength(2);
      expect(result[0].firstName).toBe('Jean');
      expect(result[1].firstName).toBe('Marie');
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            departmentId: 'dept-1',
            isActive: true,
          },
        }),
      );
    });
  });

  describe('getUsersByService', () => {
    it('should return users for a service', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          role: 'CONTRIBUTEUR',
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getUsersByService('service-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userServices: {
              some: {
                serviceId: 'service-1',
              },
            },
            isActive: true,
          },
        }),
      );
    });
  });

  describe('getUsersByRole', () => {
    it('should return users for a role', async () => {
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

      const result = await service.getUsersByRole(Role.ADMIN);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('admin@example.com');
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: Role.ADMIN,
            isActive: true,
          },
        }),
      );
    });
  });

  describe('importUsers', () => {
    it('should import users successfully', async () => {
      const importData = [
        {
          email: 'new@example.com',
          login: 'new.user',
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
          role: Role.CONTRIBUTEUR,
          departmentName: 'Informatique',
        },
      ];

      mockPrismaService.department.findMany.mockResolvedValue([
        { id: 'dept-1', name: 'Informatique' },
      ]);
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-1',
        email: 'new@example.com',
        login: 'new.user',
        firstName: 'New',
        lastName: 'User',
        role: Role.CONTRIBUTEUR,
        departmentId: 'dept-1',
      });

      const result = await service.importUsers(importData);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.createdUsers).toHaveLength(1);
    });

    it('should skip existing users', async () => {
      const importData = [
        {
          email: 'existing@example.com',
          login: 'existing.user',
          password: 'password123',
          firstName: 'Existing',
          lastName: 'User',
          role: Role.CONTRIBUTEUR,
        },
      ];

      mockPrismaService.department.findMany.mockResolvedValue([]);
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'existing-1',
        email: 'existing@example.com',
        login: 'existing.user',
      });

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
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
          role: Role.CONTRIBUTEUR,
          departmentName: 'Unknown Dept',
        },
      ];

      mockPrismaService.department.findMany.mockResolvedValue([]);
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.importUsers(importData);

      expect(result.created).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.errorDetails[0]).toContain('introuvable');
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
      expect(template).toContain('role');
      expect(template).toContain('departmentName');
      expect(template).toContain('serviceNames');
      // Verify it has at least header line and example line
      const lines = template.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });
  });
});
