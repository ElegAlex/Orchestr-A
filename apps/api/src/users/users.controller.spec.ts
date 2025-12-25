import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import {
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
    login: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    role: 'CONTRIBUTEUR',
    isActive: true,
    departmentId: 'dept-1',
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    department: { id: 'dept-1', name: 'IT Department' },
    userServices: [],
  };

  const mockUsersService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    hardDelete: vi.fn(),
    getUsersByDepartment: vi.fn(),
    getUsersByService: vi.fn(),
    getUsersByRole: vi.fn(),
    changePassword: vi.fn(),
    resetPassword: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
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
      const expectedUser = { ...mockUser, ...createUserDto, id: 'new-user-id' };
      mockUsersService.create.mockResolvedValue(expectedUser);

      const result = await controller.create(createUserDto);

      expect(result).toEqual(expectedUser);
      expect(mockUsersService.create).toHaveBeenCalledWith(createUserDto);
      expect(mockUsersService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUsersService.create.mockRejectedValue(
        new ConflictException('Cet email est déjà utilisé'),
      );

      await expect(controller.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when login already exists', async () => {
      mockUsersService.create.mockRejectedValue(
        new ConflictException('Ce login est déjà utilisé'),
      );

      await expect(controller.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when department does not exist', async () => {
      mockUsersService.create.mockRejectedValue(
        new NotFoundException('Département introuvable'),
      );

      await expect(controller.create(createUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const paginatedResult = {
        data: [mockUser],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockUsersService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockUsersService.findAll).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should filter users by role', async () => {
      const admins = [{ ...mockUser, role: 'ADMIN' }];
      const paginatedResult = {
        data: admins,
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockUsersService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10, 'ADMIN' as any);

      expect(result.data[0].role).toBe('ADMIN');
      expect(mockUsersService.findAll).toHaveBeenCalledWith(1, 10, 'ADMIN');
    });

    it('should use default pagination values', async () => {
      const paginatedResult = {
        data: [mockUser],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };

      mockUsersService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll(undefined, undefined);

      expect(mockUsersService.findAll).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne('user-id-1');

      expect(result).toEqual(mockUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('user-id-1');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.findOne.mockRejectedValue(
        new NotFoundException('Utilisateur introuvable'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUsersByDepartment', () => {
    it('should return users by department', async () => {
      const departmentUsers = [mockUser];
      mockUsersService.getUsersByDepartment.mockResolvedValue(departmentUsers);

      const result = await controller.getUsersByDepartment('dept-1');

      expect(result).toEqual(departmentUsers);
      expect(mockUsersService.getUsersByDepartment).toHaveBeenCalledWith(
        'dept-1',
      );
    });
  });

  describe('getUsersByService', () => {
    it('should return users by service', async () => {
      const serviceUsers = [mockUser];
      mockUsersService.getUsersByService.mockResolvedValue(serviceUsers);

      const result = await controller.getUsersByService('service-1');

      expect(result).toEqual(serviceUsers);
      expect(mockUsersService.getUsersByService).toHaveBeenCalledWith(
        'service-1',
      );
    });
  });

  describe('getUsersByRole', () => {
    it('should return users by role', async () => {
      const adminUsers = [{ ...mockUser, role: 'ADMIN' }];
      mockUsersService.getUsersByRole.mockResolvedValue(adminUsers);

      const result = await controller.getUsersByRole('ADMIN' as any);

      expect(result).toEqual(adminUsers);
      expect(mockUsersService.getUsersByRole).toHaveBeenCalledWith('ADMIN');
    });
  });

  describe('update', () => {
    const updateUserDto = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update a user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateUserDto };
      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-id-1', updateUserDto);

      expect(result).toEqual(updatedUser);
      expect(result.firstName).toBe('Updated');
      expect(mockUsersService.update).toHaveBeenCalledWith(
        'user-id-1',
        updateUserDto,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.update.mockRejectedValue(
        new NotFoundException('Utilisateur introuvable'),
      );

      await expect(
        controller.update('nonexistent', updateUserDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when email already used', async () => {
      mockUsersService.update.mockRejectedValue(
        new ConflictException('Cet email est déjà utilisé'),
      );

      await expect(
        controller.update('user-id-1', { email: 'existing@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should soft delete a user (deactivate)', async () => {
      const deactivatedUser = { ...mockUser, isActive: false };
      mockUsersService.remove.mockResolvedValue(deactivatedUser);

      const result = await controller.remove('user-id-1');

      expect(result.isActive).toBe(false);
      expect(mockUsersService.remove).toHaveBeenCalledWith('user-id-1');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.remove.mockRejectedValue(
        new NotFoundException('Utilisateur introuvable'),
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete a user', async () => {
      mockUsersService.hardDelete.mockResolvedValue({
        message: 'Utilisateur supprimé définitivement',
      });

      const result = await controller.hardDelete('user-id-1');

      expect(result.message).toBe('Utilisateur supprimé définitivement');
      expect(mockUsersService.hardDelete).toHaveBeenCalledWith('user-id-1');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.hardDelete.mockRejectedValue(
        new NotFoundException('Utilisateur introuvable'),
      );

      await expect(controller.hardDelete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'oldpassword',
      newPassword: 'newpassword123',
    };

    it('should change password successfully', async () => {
      mockUsersService.changePassword.mockResolvedValue({
        message: 'Mot de passe modifié avec succès',
      });

      const result = await controller.changePassword(
        'user-id-1',
        changePasswordDto,
      );

      expect(result.message).toBe('Mot de passe modifié avec succès');
      expect(mockUsersService.changePassword).toHaveBeenCalledWith(
        'user-id-1',
        changePasswordDto,
      );
    });

    it('should throw UnauthorizedException when current password is incorrect', async () => {
      mockUsersService.changePassword.mockRejectedValue(
        new UnauthorizedException('Mot de passe actuel incorrect'),
      );

      await expect(
        controller.changePassword('user-id-1', changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockUsersService.resetPassword.mockResolvedValue({
        message: 'Mot de passe réinitialisé',
      });

      const result = await controller.resetPassword(
        'user-id-1',
        'newpassword123',
      );

      expect(result.message).toBe('Mot de passe réinitialisé');
      expect(mockUsersService.resetPassword).toHaveBeenCalledWith(
        'user-id-1',
        'newpassword123',
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.resetPassword.mockRejectedValue(
        new NotFoundException('Utilisateur introuvable'),
      );

      await expect(
        controller.resetPassword('nonexistent', 'newpassword123'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
