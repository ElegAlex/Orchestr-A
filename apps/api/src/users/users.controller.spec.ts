import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import {
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

// Caller passé au controller.update() — forme RBAC V4 (objet role avec code).
const ADMIN_CALLER = { role: { code: 'ADMIN' } };

describe('UsersController', () => {
  let controller: UsersController;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
    login: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    roleId: 'role-contrib',
    role: {
      id: 'role-contrib',
      code: 'CONTRIBUTEUR',
      label: 'Contributeur',
      templateKey: 'CONTRIBUTOR',
      isSystem: true,
    },
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
    uploadAvatar: vi.fn(),
    setAvatarPreset: vi.fn(),
    deleteAvatar: vi.fn(),
    validateImport: vi.fn(),
    importUsers: vi.fn(),
    getImportTemplate: vi.fn(),
    getUsersPresence: vi.fn(),
    checkDependencies: vi.fn(),
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
      roleCode: 'CONTRIBUTEUR',
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
      const admins = [
        {
          ...mockUser,
          role: {
            id: 'role-admin',
            code: 'ADMIN',
            label: 'Administrateur',
            templateKey: 'ADMIN',
            isSystem: true,
          },
        },
      ];
      const paginatedResult = {
        data: admins,
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockUsersService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10, 'ADMIN');

      expect(result.data[0].role?.code).toBe('ADMIN');
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
      const adminUsers = [
        {
          ...mockUser,
          role: {
            id: 'role-admin',
            code: 'ADMIN',
            label: 'Administrateur',
            templateKey: 'ADMIN',
            isSystem: true,
          },
        },
      ];
      mockUsersService.getUsersByRole.mockResolvedValue(adminUsers);

      const result = await controller.getUsersByRole('ADMIN');

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

      const result = await controller.update(
        'user-id-1',
        updateUserDto,
        ADMIN_CALLER,
      );

      expect(result).toEqual(updatedUser);
      expect(result.firstName).toBe('Updated');
      expect(mockUsersService.update).toHaveBeenCalledWith(
        'user-id-1',
        updateUserDto,
        'ADMIN',
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.update.mockRejectedValue(
        new NotFoundException('Utilisateur introuvable'),
      );

      await expect(
        controller.update('nonexistent', updateUserDto, ADMIN_CALLER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when email already used', async () => {
      mockUsersService.update.mockRejectedValue(
        new ConflictException('Cet email est déjà utilisé'),
      );

      await expect(
        controller.update(
          'user-id-1',
          { email: 'existing@example.com' },
          ADMIN_CALLER,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should soft delete a user (deactivate)', async () => {
      mockUsersService.remove.mockResolvedValue({
        message: 'Utilisateur désactivé avec succès',
      });

      const result = await controller.remove('user-id-1');

      expect(result).toEqual({
        message: 'Utilisateur désactivé avec succès',
      });
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

      const result = await controller.hardDelete('user-id-1', 'admin-user-id');

      expect(result.message).toBe('Utilisateur supprimé définitivement');
      expect(mockUsersService.hardDelete).toHaveBeenCalledWith(
        'user-id-1',
        'admin-user-id',
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.hardDelete.mockRejectedValue(
        new NotFoundException('Utilisateur introuvable'),
      );

      await expect(
        controller.hardDelete('nonexistent', 'admin-user-id'),
      ).rejects.toThrow(NotFoundException);
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
        { newPassword: 'newpassword123' } as any,
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
        controller.resetPassword('nonexistent', { newPassword: 'newpassword123' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadAvatar', () => {
    it('should throw BadRequestException when request is not multipart', async () => {
      const req = {
        isMultipart: vi.fn().mockReturnValue(false),
        file: vi.fn(),
      } as any;

      await expect(controller.uploadAvatar('user-id-1', req)).rejects.toThrow(
        BadRequestException,
      );
      expect(req.file).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when no file is provided', async () => {
      const req = {
        isMultipart: vi.fn().mockReturnValue(true),
        file: vi.fn().mockResolvedValue(null),
      } as any;

      await expect(controller.uploadAvatar('user-id-1', req)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUsersService.uploadAvatar).not.toHaveBeenCalled();
    });

    it('should call usersService.uploadAvatar when file is provided', async () => {
      const mockFile = { mimetype: 'image/png', toBuffer: vi.fn() };
      const req = {
        isMultipart: vi.fn().mockReturnValue(true),
        file: vi.fn().mockResolvedValue(mockFile),
      } as any;

      mockUsersService.uploadAvatar.mockResolvedValue({ avatarUrl: '/uploads/avatars/user-id-1.png' });

      const result = await controller.uploadAvatar('user-id-1', req);

      expect(mockUsersService.uploadAvatar).toHaveBeenCalledWith('user-id-1', mockFile);
      expect(result).toHaveProperty('avatarUrl');
    });
  });

  describe('setAvatarPreset', () => {
    it('should call usersService.setAvatarPreset with userId and preset', async () => {
      mockUsersService.setAvatarPreset.mockResolvedValue({
        avatarPreset: 'avatar_01',
        avatarUrl: null,
      });

      const result = await controller.setAvatarPreset('user-id-1', { preset: 'avatar_01' } as any);

      expect(mockUsersService.setAvatarPreset).toHaveBeenCalledWith('user-id-1', 'avatar_01');
      expect(result).toHaveProperty('avatarPreset');
    });
  });

  describe('deleteAvatar', () => {
    it('should call usersService.deleteAvatar with userId', async () => {
      mockUsersService.deleteAvatar.mockResolvedValue({ avatarUrl: null, avatarPreset: null });

      const result = await controller.deleteAvatar('user-id-1');

      expect(mockUsersService.deleteAvatar).toHaveBeenCalledWith('user-id-1');
      expect(result).toHaveProperty('avatarUrl', null);
    });
  });

  describe('validateImport', () => {
    it('should validate import users and return preview', async () => {
      const preview = { valid: 2, invalid: 0, users: [] };
      mockUsersService.validateImport.mockResolvedValue(preview);

      const result = await controller.validateImport({ users: [] } as any);

      expect(mockUsersService.validateImport).toHaveBeenCalledWith([]);
      expect(result).toEqual(preview);
    });
  });

  describe('importUsers', () => {
    it('should import users and return result', async () => {
      const importResult = { created: 2, failed: 0, errors: [] };
      mockUsersService.importUsers.mockResolvedValue(importResult);

      const result = await controller.importUsers({ users: [] } as any);

      expect(mockUsersService.importUsers).toHaveBeenCalledWith([]);
      expect(result).toEqual(importResult);
    });
  });

  describe('getImportTemplate', () => {
    it('should return CSV template string', async () => {
      const csvTemplate = 'email;login;password;firstName;lastName;roleCode;departmentName;serviceNames';
      mockUsersService.getImportTemplate.mockReturnValue(csvTemplate);

      const result = controller.getImportTemplate();

      expect(mockUsersService.getImportTemplate).toHaveBeenCalled();
      expect(result).toBe(csvTemplate);
    });
  });

  describe('getUsersPresence', () => {
    it('should return presence data for a given date', async () => {
      const presenceData = { onSite: [], remote: [], absent: [], external: [], date: '2025-01-15', totals: {} };
      mockUsersService.getUsersPresence.mockResolvedValue(presenceData);

      const result = await controller.getUsersPresence('2025-01-15');

      expect(mockUsersService.getUsersPresence).toHaveBeenCalledWith('2025-01-15');
      expect(result).toEqual(presenceData);
    });

    it('should call getUsersPresence with undefined when no date provided', async () => {
      const presenceData = { onSite: [], remote: [], absent: [], external: [], date: '2025-01-23', totals: {} };
      mockUsersService.getUsersPresence.mockResolvedValue(presenceData);

      await controller.getUsersPresence(undefined);

      expect(mockUsersService.getUsersPresence).toHaveBeenCalledWith(undefined);
    });
  });

  describe('checkDependencies', () => {
    it('should return user dependency info', async () => {
      const depInfo = {
        userId: 'user-id-1',
        canDelete: true,
        dependencies: [],
      };
      mockUsersService.checkDependencies.mockResolvedValue(depInfo);

      const result = await controller.checkDependencies('user-id-1');

      expect(mockUsersService.checkDependencies).toHaveBeenCalledWith('user-id-1');
      expect(result.canDelete).toBe(true);
    });
  });

  describe('update - caller with no role', () => {
    it('should handle caller with null role (no roleCode)', async () => {
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      mockUsersService.update.mockResolvedValue(updatedUser);

      const callerWithNoRole = { role: null };
      const result = await controller.update('user-id-1', { firstName: 'Updated' }, callerWithNoRole);

      expect(mockUsersService.update).toHaveBeenCalledWith('user-id-1', { firstName: 'Updated' }, undefined);
      expect(result.firstName).toBe('Updated');
    });

    it('should handle caller with undefined role', async () => {
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-id-1', { firstName: 'Updated' }, {} as any);

      expect(mockUsersService.update).toHaveBeenCalledWith('user-id-1', { firstName: 'Updated' }, undefined);
    });
  });
});
