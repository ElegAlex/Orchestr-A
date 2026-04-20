import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  ImportUserDto,
  ImportUsersResultDto,
  UsersValidationPreviewDto,
  UserPreviewItemDto,
  UserPreviewStatus,
} from './dto/import-users.dto';
import { VALID_PRESETS } from './dto/avatar-preset.dto';
import * as bcrypt from 'bcrypt';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { MultipartFile } from '@fastify/multipart';
import { assertMagicBytes } from '../common/upload/magic-bytes.validator';
import { RefreshTokenService } from '../auth/refresh-token.service';

/** Type de dépendance utilisateur */
export interface UserDependency {
  type: string;
  count: number;
  description: string;
}

/** Réponse de la vérification des dépendances */
export interface UserDependenciesResponse {
  userId: string;
  canDelete: boolean;
  dependencies: UserDependency[];
}

@Injectable()
export class UsersService {
  /**
   * Hiérarchie par code de rôle — utilisée pour restreindre l'assignation
   * (un appelant ne peut attribuer qu'un rôle strictement inférieur au sien).
   * Les rôles custom (hors templates système) reçoivent implicitement le
   * rang 0.
   */
  private readonly ROLE_HIERARCHY: Record<string, number> = {
    OBSERVATEUR: 0,
    CONTRIBUTEUR: 1,
    REFERENT_TECHNIQUE: 2,
    CHEF_DE_PROJET: 3,
    MANAGER: 4,
    RESPONSABLE: 5,
    ADMIN: 6,
  };

  private canAssignRole(
    callerRoleCode: string | null | undefined,
    targetRoleCode: string | null | undefined,
  ): boolean {
    const callerRank = callerRoleCode
      ? (this.ROLE_HIERARCHY[callerRoleCode] ?? 0)
      : 0;
    const targetRank = targetRoleCode
      ? (this.ROLE_HIERARCHY[targetRoleCode] ?? 0)
      : 0;
    return callerRank > targetRank;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Résout un rôle par code et garantit qu'il est assignable à un humain.
   * Un rôle `isSystem=true` est un blueprint bound à un template (seedé au
   * déploiement) — il ne doit jamais être affecté directement à un user.
   * L'admin doit créer un rôle institutionnel dans /admin/roles et s'en
   * servir à la place.
   */
  private async resolveAssignableRoleIdByCode(code: string): Promise<string> {
    const role = await this.prisma.role.findUnique({
      where: { code },
      select: { id: true, isSystem: true },
    });
    if (!role) {
      throw new BadRequestException(`Rôle "${code}" introuvable`);
    }
    if (role.isSystem) {
      throw new BadRequestException(
        `Rôle système "${code}" non assignable. Créez un rôle institutionnel dans /admin/roles rattaché au template correspondant.`,
      );
    }
    return role.id;
  }

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: createUserDto.email }, { login: createUserDto.login }],
      },
    });

    if (existingUser) {
      if (existingUser.email === createUserDto.email) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      if (existingUser.login === createUserDto.login) {
        throw new ConflictException('Ce login est déjà utilisé');
      }
    }

    if (createUserDto.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: createUserDto.departmentId },
      });
      if (!department) {
        throw new BadRequestException('Département introuvable');
      }
    }

    if (createUserDto.serviceIds && createUserDto.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: createUserDto.serviceIds } },
      });
      if (services.length !== createUserDto.serviceIds.length) {
        throw new BadRequestException('Un ou plusieurs services introuvables');
      }
    }

    const roleId = await this.resolveAssignableRoleIdByCode(
      createUserDto.roleCode,
    );

    const passwordHash = await bcrypt.hash(createUserDto.password, 12);

    const hashValid = await bcrypt.compare(
      createUserDto.password,
      passwordHash,
    );
    if (!hashValid) {
      console.error(
        `[CRITICAL] bcrypt hash verification failed for user ${createUserDto.login}`,
      );
      throw new Error('Password hash verification failed');
    }

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        login: createUserDto.login,
        passwordHash,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        roleId,
        departmentId: createUserDto.departmentId,
        avatarUrl: createUserDto.avatarUrl,
        isActive: createUserDto.isActive ?? true,
      },
      select: {
        id: true,
        email: true,
        login: true,
        firstName: true,
        lastName: true,
        roleId: true,
        role: {
          select: {
            id: true,
            code: true,
            label: true,
            templateKey: true,
            isSystem: true,
          },
        },
        departmentId: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        userServices: {
          select: {
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (createUserDto.serviceIds && createUserDto.serviceIds.length > 0) {
      await this.prisma.userService.createMany({
        data: createUserDto.serviceIds.map((serviceId) => ({
          userId: user.id,
          serviceId,
        })),
      });
    }

    return user;
  }

  async findAll(page: number = 1, limit: number = 20, roleCode?: string) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;

    const where = roleCode ? { role: { code: roleCode } } : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: safeLimit,
        select: {
          id: true,
          email: true,
          login: true,
          firstName: true,
          lastName: true,
          roleId: true,
          role: {
            select: {
              id: true,
              code: true,
              label: true,
              templateKey: true,
              isSystem: true,
            },
          },
          departmentId: true,
          avatarUrl: true,
          avatarPreset: true,
          isActive: true,
          createdAt: true,
          department: {
            select: {
              id: true,
              name: true,
              managerId: true,
            },
          },
          userServices: {
            select: {
              service: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          managedServices: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          lastName: 'asc',
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        login: true,
        firstName: true,
        lastName: true,
        roleId: true,
        role: {
          select: {
            id: true,
            code: true,
            label: true,
            templateKey: true,
            isSystem: true,
          },
        },
        departmentId: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        userServices: {
          select: {
            service: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
        skills: {
          select: {
            level: true,
            skill: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
          },
        },
        projectMembers: {
          select: {
            id: true,
            role: true,
            allocation: true,
            project: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    callerRoleCode?: string,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Hiérarchie : l'appelant ne peut attribuer qu'un rôle strictement
    // inférieur au sien.
    if (updateUserDto.roleCode && callerRoleCode) {
      if (updateUserDto.roleCode === 'ADMIN' && callerRoleCode !== 'ADMIN') {
        throw new ForbiddenException(
          'Seul un administrateur peut attribuer le rôle ADMIN',
        );
      }
      if (!this.canAssignRole(callerRoleCode, updateUserDto.roleCode)) {
        throw new ForbiddenException(
          'Vous ne pouvez attribuer que des rôles inférieurs au vôtre',
        );
      }
    }

    if (updateUserDto.email || updateUserDto.login) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                updateUserDto.email ? { email: updateUserDto.email } : {},
                updateUserDto.login ? { login: updateUserDto.login } : {},
              ],
            },
          ],
        },
      });

      if (duplicate) {
        if (duplicate.email === updateUserDto.email) {
          throw new ConflictException('Cet email est déjà utilisé');
        }
        if (duplicate.login === updateUserDto.login) {
          throw new ConflictException('Ce login est déjà utilisé');
        }
      }
    }

    if (updateUserDto.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: updateUserDto.departmentId },
      });
      if (!department) {
        throw new BadRequestException('Département introuvable');
      }
    }

    if (updateUserDto.serviceIds && updateUserDto.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: updateUserDto.serviceIds } },
      });
      if (services.length !== updateUserDto.serviceIds.length) {
        throw new BadRequestException('Un ou plusieurs services introuvables');
      }
    }

    const { serviceIds: _, password, roleCode, ...restDto } = updateUserDto;
    void _;
    const updateData: Record<string, unknown> = { ...restDto };

    if (roleCode) {
      updateData.roleId = await this.resolveAssignableRoleIdByCode(roleCode);
    }

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    if (updateUserDto.serviceIds !== undefined) {
      await this.prisma.userService.deleteMany({
        where: { userId: id },
      });

      if (updateUserDto.serviceIds.length > 0) {
        await this.prisma.userService.createMany({
          data: updateUserDto.serviceIds.map((serviceId) => ({
            userId: id,
            serviceId,
          })),
        });
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        login: true,
        firstName: true,
        lastName: true,
        roleId: true,
        role: {
          select: {
            id: true,
            code: true,
            label: true,
            templateKey: true,
            isSystem: true,
          },
        },
        departmentId: true,
        avatarUrl: true,
        isActive: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        userServices: {
          select: {
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return user;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Utilisateur désactivé avec succès' };
  }

  /**
   * Vérifie les dépendances d'un utilisateur avant suppression définitive
   */
  async checkDependencies(userId: string): Promise<UserDependenciesResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur ${userId} non trouvé`);
    }

    const dependencies: UserDependency[] = [];

    const assignedTasks = await this.prisma.task.count({
      where: {
        assigneeId: userId,
        status: { not: 'DONE' },
      },
    });
    if (assignedTasks > 0) {
      dependencies.push({
        type: 'TASKS',
        count: assignedTasks,
        description: `${assignedTasks} tâche(s) assignée(s) en cours`,
      });
    }

    const projectMemberships = await this.prisma.projectMember.count({
      where: {
        userId,
        project: {
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      },
    });
    if (projectMemberships > 0) {
      dependencies.push({
        type: 'PROJECTS',
        count: projectMemberships,
        description: `Membre de ${projectMemberships} projet(s) actif(s)`,
      });
    }

    const pendingLeaves = await this.prisma.leave.count({
      where: {
        userId,
        status: 'PENDING',
      },
    });
    if (pendingLeaves > 0) {
      dependencies.push({
        type: 'LEAVES',
        count: pendingLeaves,
        description: `${pendingLeaves} demande(s) de congé en attente`,
      });
    }

    const leavesToValidate = await this.prisma.leave.count({
      where: {
        validatorId: userId,
        status: 'PENDING',
      },
    });
    if (leavesToValidate > 0) {
      dependencies.push({
        type: 'LEAVES_VALIDATION',
        count: leavesToValidate,
        description: `${leavesToValidate} congé(s) en attente de validation`,
      });
    }

    const managedDepartments = await this.prisma.department.count({
      where: { managerId: userId },
    });
    if (managedDepartments > 0) {
      dependencies.push({
        type: 'DEPARTMENTS',
        count: managedDepartments,
        description: `Manager de ${managedDepartments} département(s)`,
      });
    }

    const managedServices = await this.prisma.service.count({
      where: { managerId: userId },
    });
    if (managedServices > 0) {
      dependencies.push({
        type: 'SERVICES',
        count: managedServices,
        description: `Manager de ${managedServices} service(s)`,
      });
    }

    return {
      userId,
      canDelete: dependencies.length === 0,
      dependencies,
    };
  }

  async hardDelete(id: string, requestingUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (requestingUserId && id === requestingUserId) {
      throw new BadRequestException(
        'Vous ne pouvez pas supprimer votre propre compte',
      );
    }

    const { canDelete, dependencies } = await this.checkDependencies(id);

    if (!canDelete) {
      throw new ConflictException({
        message:
          'Impossible de supprimer cet utilisateur en raison de dépendances actives',
        dependencies,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.personalTodo.deleteMany({
        where: { userId: id },
      });

      await tx.timeEntry.deleteMany({
        where: { userId: id },
      });

      await tx.comment.deleteMany({
        where: { authorId: id },
      });

      await tx.userSkill.deleteMany({
        where: { userId: id },
      });

      await tx.teleworkSchedule.deleteMany({
        where: { userId: id },
      });

      await tx.leaveValidationDelegate.deleteMany({
        where: {
          OR: [{ delegatorId: id }, { delegateId: id }],
        },
      });

      await tx.projectMember.deleteMany({
        where: { userId: id },
      });

      await tx.userService.deleteMany({
        where: { userId: id },
      });

      await tx.leave.deleteMany({
        where: {
          userId: id,
          status: { in: ['APPROVED', 'REJECTED'] },
        },
      });

      await tx.task.deleteMany({
        where: {
          assigneeId: id,
          status: 'DONE',
        },
      });

      await tx.user.delete({
        where: { id },
      });
    });

    return { success: true, message: 'Utilisateur supprimé définitivement' };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Ancien mot de passe incorrect');
    }

    const newPasswordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      12,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await this.refreshTokenService.revokeAllForUser(userId);

    return { message: 'Mot de passe modifié avec succès' };
  }

  async resetPassword(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.refreshTokenService.revokeAllForUser(userId);

    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  async getUsersByDepartment(departmentId: string) {
    return this.prisma.user.findMany({
      where: {
        departmentId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: {
          select: { id: true, code: true, label: true, templateKey: true },
        },
        userServices: {
          select: {
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async getUsersByService(serviceId: string) {
    return this.prisma.user.findMany({
      where: {
        userServices: {
          some: {
            serviceId,
          },
        },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: {
          select: { id: true, code: true, label: true, templateKey: true },
        },
      },
    });
  }

  async getUsersByRole(roleCode: string) {
    return this.prisma.user.findMany({
      where: {
        role: { code: roleCode },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        departmentId: true,
      },
    });
  }

  async importUsers(users: ImportUserDto[]): Promise<ImportUsersResultDto> {
    const result: ImportUsersResultDto = {
      created: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
      createdUsers: [],
    };

    const [departments, services, roles] = await Promise.all([
      this.prisma.department.findMany({
        select: { id: true, name: true },
      }),
      this.prisma.service.findMany({
        select: { id: true, name: true, departmentId: true },
      }),
      this.prisma.role.findMany({
        where: { isSystem: false },
        select: { id: true, code: true },
      }),
    ]);

    const departmentMap = new Map(
      departments.map((d) => [d.name.toLowerCase().trim(), d.id]),
    );
    const serviceMap = new Map(
      services.map((s) => [s.name.toLowerCase().trim(), s]),
    );
    // roleMap ne contient que des rôles institutionnels (isSystem=false).
    // L'import refuse l'assignation vers un rôle système — l'admin doit créer
    // un rôle institutionnel au wording cible dans /admin/roles avant import.
    const roleMap = new Map(roles.map((r) => [r.code, r.id]));

    for (let i = 0; i < users.length; i++) {
      const userData = users[i];
      const rowNum = i + 2;

      try {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            OR: [{ email: userData.email }, { login: userData.login }],
          },
        });

        if (existingUser) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${rowNum}: Utilisateur ${userData.email} ou login ${userData.login} existe déjà`,
          );
          continue;
        }

        let departmentId: string | undefined;
        if (userData.departmentName) {
          departmentId = departmentMap.get(
            userData.departmentName.toLowerCase().trim(),
          );
          if (!departmentId) {
            result.errors++;
            result.errorDetails.push(
              `Ligne ${rowNum}: Département "${userData.departmentName}" introuvable`,
            );
            continue;
          }
        }

        const serviceIds: string[] = [];
        if (userData.serviceNames) {
          const serviceNamesList = userData.serviceNames
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s);

          for (const serviceName of serviceNamesList) {
            const service = serviceMap.get(serviceName);
            if (!service) {
              result.errors++;
              result.errorDetails.push(
                `Ligne ${rowNum}: Service "${serviceName}" introuvable`,
              );
              continue;
            }
            if (departmentId && service.departmentId !== departmentId) {
              result.errorDetails.push(
                `Ligne ${rowNum}: Le service "${serviceName}" n'appartient pas au département spécifié (ignoré)`,
              );
              continue;
            }
            serviceIds.push(service.id);
          }
        }

        const roleId = roleMap.get(userData.roleCode);
        if (!roleId) {
          result.errors++;
          result.errorDetails.push(
            `Ligne ${rowNum}: Rôle "${userData.roleCode}" introuvable`,
          );
          continue;
        }

        const passwordHash = await bcrypt.hash(userData.password, 12);

        const user = await this.prisma.user.create({
          data: {
            email: userData.email,
            login: userData.login,
            passwordHash,
            firstName: userData.firstName,
            lastName: userData.lastName,
            roleId,
            departmentId,
            isActive: true,
          },
          select: {
            id: true,
            email: true,
            login: true,
            firstName: true,
            lastName: true,
            roleId: true,
            role: {
              select: { id: true, code: true, label: true, templateKey: true },
            },
            departmentId: true,
          },
        });

        if (serviceIds.length > 0) {
          await this.prisma.userService.createMany({
            data: serviceIds.map((serviceId) => ({
              userId: user.id,
              serviceId,
            })),
          });
        }

        result.created++;
        result.createdUsers.push(user);
      } catch (err) {
        result.errors++;
        const errorMessage =
          err instanceof Error ? err.message : 'Erreur inconnue';
        result.errorDetails.push(
          `Ligne ${rowNum}: Erreur lors de la création - ${errorMessage}`,
        );
      }
    }

    return result;
  }

  /**
   * Valider les utilisateurs avant import (dry-run)
   */
  async validateImport(
    users: ImportUserDto[],
  ): Promise<UsersValidationPreviewDto> {
    const result: UsersValidationPreviewDto = {
      valid: [],
      duplicates: [],
      errors: [],
      warnings: [],
      summary: {
        total: users.length,
        valid: 0,
        duplicates: 0,
        errors: 0,
        warnings: 0,
      },
    };

    const [departments, services, existingUsers, roles] = await Promise.all([
      this.prisma.department.findMany({
        select: { id: true, name: true },
      }),
      this.prisma.service.findMany({
        select: { id: true, name: true, departmentId: true },
      }),
      this.prisma.user.findMany({
        select: { email: true, login: true },
      }),
      this.prisma.role.findMany({
        where: { isSystem: false },
        select: { code: true },
      }),
    ]);

    const departmentMap = new Map(
      departments.map((d) => [
        d.name.toLowerCase().trim(),
        { id: d.id, name: d.name },
      ]),
    );
    const serviceMap = new Map(
      services.map((s) => [
        s.name.toLowerCase().trim(),
        { id: s.id, name: s.name, departmentId: s.departmentId },
      ]),
    );
    const existingEmails = new Set(
      existingUsers.map((u) => u.email.toLowerCase()),
    );
    const existingLogins = new Set(
      existingUsers.map((u) => u.login.toLowerCase()),
    );
    const validRoleCodes = new Set(roles.map((r) => r.code));

    for (let i = 0; i < users.length; i++) {
      const userData = users[i];
      const lineNum = i + 2;

      const previewItem: UserPreviewItemDto = {
        lineNumber: lineNum,
        user: userData,
        status: 'valid' as UserPreviewStatus,
        messages: [],
      };

      if (!userData.email || userData.email.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push("L'email est obligatoire");
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!userData.login || userData.login.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('Le login est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!userData.password || userData.password.length < 8) {
        previewItem.status = 'error';
        previewItem.messages.push(
          'Le mot de passe doit contenir au moins 8 caractères, avec une majuscule, un chiffre et un caractère spécial',
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!userData.firstName || userData.firstName.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('Le prénom est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!userData.lastName || userData.lastName.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('Le nom est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (existingEmails.has(userData.email.toLowerCase())) {
        previewItem.status = 'duplicate';
        previewItem.messages.push(`L'email "${userData.email}" existe déjà`);
        result.duplicates.push(previewItem);
        result.summary.duplicates++;
        continue;
      }

      if (existingLogins.has(userData.login.toLowerCase())) {
        previewItem.status = 'duplicate';
        previewItem.messages.push(`Le login "${userData.login}" existe déjà`);
        result.duplicates.push(previewItem);
        result.summary.duplicates++;
        continue;
      }

      if (userData.roleCode && !validRoleCodes.has(userData.roleCode)) {
        previewItem.status = 'error';
        const available = Array.from(validRoleCodes).join(', ');
        previewItem.messages.push(
          `Rôle "${userData.roleCode}" non reconnu. Valeurs possibles: ${available}`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (userData.departmentName) {
        const department = departmentMap.get(
          userData.departmentName.toLowerCase().trim(),
        );
        if (!department) {
          previewItem.status = 'error';
          previewItem.messages.push(
            `Département "${userData.departmentName}" introuvable`,
          );
          result.errors.push(previewItem);
          result.summary.errors++;
          continue;
        }
        previewItem.resolvedDepartment = department;
      }

      if (userData.serviceNames) {
        const serviceNamesList = userData.serviceNames
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s);

        const resolvedServices: Array<{ id: string; name: string }> = [];

        for (const serviceName of serviceNamesList) {
          const service = serviceMap.get(serviceName);
          if (!service) {
            previewItem.status = 'warning';
            previewItem.messages.push(
              `Service "${serviceName}" introuvable (ignoré)`,
            );
          } else if (
            previewItem.resolvedDepartment &&
            service.departmentId !== previewItem.resolvedDepartment.id
          ) {
            previewItem.status = 'warning';
            previewItem.messages.push(
              `Service "${service.name}" n'appartient pas au département (ignoré)`,
            );
          } else {
            resolvedServices.push({ id: service.id, name: service.name });
          }
        }

        if (resolvedServices.length > 0) {
          previewItem.resolvedServices = resolvedServices;
        }
      }

      if (previewItem.status === 'warning') {
        result.warnings.push(previewItem);
        result.summary.warnings++;
      } else {
        previewItem.messages.push('Prêt à être importé');
        result.valid.push(previewItem);
        result.summary.valid++;
      }

      existingEmails.add(userData.email.toLowerCase());
      existingLogins.add(userData.login.toLowerCase());
    }

    return result;
  }

  /**
   * Récupère les statuts de présence des utilisateurs pour une date donnée
   */
  async getUsersPresence(dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        department: {
          select: {
            name: true,
          },
        },
        userServices: {
          take: 1,
          select: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const teleworkSchedules = await this.prisma.teleworkSchedule.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isTelework: true,
      },
      select: { userId: true },
    });
    const remoteUserIds = new Set(teleworkSchedules.map((t) => t.userId));

    const leaves = await this.prisma.leave.findMany({
      where: {
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
        status: 'APPROVED',
      },
      select: { userId: true },
    });
    const absentUserIds = new Set(leaves.map((l) => l.userId));

    const externalTasks = await this.prisma.task.findMany({
      where: {
        isExternalIntervention: true,
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
        status: { notIn: ['DONE'] },
      },
      select: {
        assignees: {
          select: { userId: true },
        },
      },
    });
    const externalUserIds = new Set(
      externalTasks.flatMap((t) => t.assignees.map((a) => a.userId)),
    );

    const externalEvents = await this.prisma.event.findMany({
      where: {
        isExternalIntervention: true,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        participants: {
          select: { userId: true },
        },
      },
    });
    for (const event of externalEvents) {
      for (const p of event.participants) {
        externalUserIds.add(p.userId);
      }
    }

    const onSite: Array<{
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string;
      serviceName?: string;
      departmentName?: string;
    }> = [];
    const remote: typeof onSite = [];
    const absent: typeof onSite = [];
    const external: typeof onSite = [];

    for (const user of users) {
      const item = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl ?? undefined,
        serviceName: user.userServices[0]?.service?.name,
        departmentName: user.department?.name,
      };

      if (absentUserIds.has(user.id)) {
        absent.push(item);
      } else if (externalUserIds.has(user.id)) {
        external.push(item);
      } else if (remoteUserIds.has(user.id)) {
        remote.push(item);
      } else {
        onSite.push(item);
      }
    }

    return {
      onSite,
      remote,
      absent,
      external,
      date: startOfDay.toISOString().split('T')[0],
      totals: {
        onSite: onSite.length,
        remote: remote.length,
        absent: absent.length,
        external: external.length,
        total: users.length,
      },
    };
  }

  private readonly AVATAR_SELECT = {
    id: true,
    email: true,
    login: true,
    firstName: true,
    lastName: true,
    roleId: true,
    role: {
      select: {
        id: true,
        code: true,
        label: true,
        templateKey: true,
        isSystem: true,
      },
    },
    departmentId: true,
    avatarUrl: true,
    avatarPreset: true,
    isActive: true,
    updatedAt: true,
  } as const;

  async uploadAvatar(userId: string, file: MultipartFile) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Format non supporté. Utilisez jpg, png ou webp.',
      );
    }

    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const ext = extMap[file.mimetype];
    const filename = `${userId}${ext}`;
    const uploadsDir = join(process.cwd(), 'uploads', 'avatars');

    await fs.mkdir(uploadsDir, { recursive: true });

    try {
      const existing = await fs.readdir(uploadsDir);
      for (const f of existing) {
        if (f.startsWith(userId + '.') || f.startsWith(userId + '_')) {
          await fs.unlink(join(uploadsDir, f)).catch(() => null);
        }
      }
    } catch {
      // ignore
    }

    const buffer = await file.toBuffer();

    await assertMagicBytes(buffer, 'image');

    await fs.writeFile(join(uploadsDir, filename), buffer);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: `/api/uploads/avatars/${filename}`,
        avatarPreset: null,
      },
      select: this.AVATAR_SELECT,
    });
  }

  async setAvatarPreset(userId: string, preset: string) {
    if (!(VALID_PRESETS as readonly string[]).includes(preset)) {
      throw new BadRequestException('Preset invalide');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarPreset: preset, avatarUrl: null },
      select: this.AVATAR_SELECT,
    });
  }

  async deleteAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (user?.avatarUrl) {
      const relativePath = user.avatarUrl.replace(/^\/api\//, '');
      const filePath = join(process.cwd(), relativePath);
      await fs.unlink(filePath).catch(() => null);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null, avatarPreset: null },
      select: this.AVATAR_SELECT,
    });
  }

  getImportTemplate(): string {
    const headers = [
      'email',
      'login',
      'password',
      'firstName',
      'lastName',
      'roleCode',
      'departmentName',
      'serviceNames',
    ];
    const exampleComment = [
      '# email@domaine.com',
      '# prenom.nom',
      '# motdepasse (min 8 car.)',
      '# Prénom',
      '# Nom',
      '# Code de rôle (ex: CONTRIBUTEUR, MANAGER, ADMIN)',
      '# Nom département existant',
      '# Service1, Service2',
    ];

    return [headers.join(';'), exampleComment.join(';')].join('\n');
  }
}
