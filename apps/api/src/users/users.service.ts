import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleHierarchyService } from '../common/services/role-hierarchy.service';
import {
  AccessScopeService,
  AccessUser,
} from '../common/services/access-scope.service';
import { AuditService, AuditAction } from '../audit/audit.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
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
import { join, resolve, sep } from 'path';
import type { MultipartFile } from '@fastify/multipart';
import { assertMagicBytes } from '../common/upload/magic-bytes.validator';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { validatePasswordStrength } from '../common/validators/password-policy';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly roleHierarchy: RoleHierarchyService,
    private readonly accessScope: AccessScopeService,
    private readonly auditService: AuditService,
    private readonly auditPersistence: AuditPersistenceService,
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

  async create(createUserDto: CreateUserDto, callerRoleCode?: string) {
    await this.roleHierarchy.assertCanAssignRole(callerRoleCode, createUserDto.roleCode);

    const existingUser = await this.prisma.user.findFirst({
      where: {
        // DAT-015: case-insensitive search (matches the LOWER() unique index)
        OR: [
          { email: { equals: createUserDto.email, mode: 'insensitive' } },
          { login: { equals: createUserDto.login, mode: 'insensitive' } },
        ],
      },
    });

    if (existingUser) {
      // DAT-015: case-fold before comparing so 'Admin@Foo.com' === 'admin@foo.com'
      if (existingUser.email.toLowerCase() === createUserDto.email.toLowerCase()) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      if (existingUser.login.toLowerCase() === createUserDto.login.toLowerCase()) {
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
        // SEC-011 — isActive is server-controlled on create (Model A: admins
        // create active users). The CreateUserDto no longer carries this field,
        // so the value is never caller-supplied. State changes go through the
        // UPDATE path, which audits USER_DEACTIVATED / USER_REACTIVATED.
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        login: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        avatarPreset: true,
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

  async findAll(
    page: number = 1,
    limit: number = 20,
    roleCode?: string,
    caller?: AccessUser,
    options?: { allowFullScan?: boolean },
  ) {
    const HARD_CEILING = 200;
    const safeLimit =
      options?.allowFullScan === true
        ? Math.min(limit || 20, 1000)
        : Math.min(limit || 20, HARD_CEILING);
    const skip = (page - 1) * safeLimit;

    const where = roleCode ? { role: { code: roleCode } } : {};

    // SEC-031: payload restriction only — the directory list is intentionally
    // NOT where-scoped (see FULL_LIST_SELECT comment). Management-tier callers
    // see the sensitive fields; a plain directory caller gets the reduced
    // projection.
    const isManagement = await this.accessScope.hasAny(caller, ['users:manage']);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: safeLimit,
        select: isManagement
          ? UsersService.FULL_LIST_SELECT
          : UsersService.DIRECTORY_LIST_SELECT,
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

  // Full admin profile — exposed only to management-tier callers
  // (`users:manage`). Includes the SEC-030 sensitive fields: email, login,
  // the full skills list and project memberships with project status.
  private static readonly FULL_USER_SELECT = {
    id: true,
    email: true,
    login: true,
    firstName: true,
    lastName: true,
    avatarUrl: true,
    avatarPreset: true,
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
  } as const;

  // Directory projection — what a plain `users:read` (ANNUAIRE_READ) caller
  // sees for an in-scope user. Serves the "qui est qui à quel service" need
  // while stripping the SEC-030 sensitive fields (email, login, skills,
  // project memberships) and audit metadata (createdAt/updatedAt, roleId,
  // role.templateKey/isSystem).
  private static readonly DIRECTORY_USER_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    avatarUrl: true,
    avatarPreset: true,
    role: {
      select: {
        id: true,
        code: true,
        label: true,
      },
    },
    departmentId: true,
    isActive: true,
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
  } as const;

  // SEC-031: list (GET /users) projections. Unlike findOne, the list is NOT
  // horizontally where-scoped — directory visibility ("qui est qui à quel
  // service") is preserved per SEC-030's design intent (operator decision
  // 2026-05-29). Only the payload is restricted: management-tier callers
  // (`users:manage`) get the full list select; a plain directory caller gets
  // the reduced one (email/login + audit metadata stripped, same fields
  // DIRECTORY_USER_SELECT drops). The returned user *set* is identical.
  private static readonly FULL_LIST_SELECT = {
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
  } as const;

  private static readonly DIRECTORY_LIST_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    role: {
      select: {
        id: true,
        code: true,
        label: true,
      },
    },
    departmentId: true,
    avatarUrl: true,
    avatarPreset: true,
    isActive: true,
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
    managedServices: {
      select: {
        id: true,
        name: true,
      },
    },
  } as const;

  async findOne(id: string, caller?: AccessUser) {
    // Horizontal scope (SEC-030): management-tier callers (`users:manage`)
    // resolve to an empty where (every user); a plain directory caller is
    // restricted to self / same-service / managed-service/department. An
    // out-of-scope id therefore collapses to a 404 (non-disclosing).
    const scopeWhere = await this.accessScope.userReadWhere(caller);
    const isManagement = await this.accessScope.hasAny(caller, ['users:manage']);

    const user = await this.prisma.user.findFirst({
      where: { id, ...scopeWhere },
      select: isManagement
        ? UsersService.FULL_USER_SELECT
        : UsersService.DIRECTORY_USER_SELECT,
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
    caller?: AccessUser,
  ) {
    // SEC-002 — horizontal scope: non-ADMIN callers (incl. ADMIN_DELEGATED or
    // any institutional role granted USERS_CRUD) must be inside the target's
    // perimeter (dept manager or shared service). NotFound is raised here as
    // well, so the explicit guard below is redundant when caller is provided.
    if (caller) {
      await this.accessScope.assertCanManageUser(id, caller);
    }

    // AUD-EMIT-001 — role.code is loaded here (enriching the existing lookup,
    // not an extra query) so the ROLE_CHANGE audit payload can carry the
    // before-snapshot roleCode without a second round-trip.
    // OBS-004 — same lookup enriched with userServices.serviceId for the
    // SERVICE_MEMBERSHIP_CHANGED before-snapshot (still one round-trip).
    // departmentId / isActive are scalars returned by `include` already.
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: { select: { code: true } },
        userServices: { select: { serviceId: true } },
      },
    });

    if (!existingUser) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Hiérarchie : l'appelant ne peut attribuer qu'un rôle dont le template
    // est strictement inférieur au sien. Les templates ADMIN et ADMIN_DELEGATED
    // ne sont assignables que par un ADMIN (pas par un ADMIN_DELEGATED).
    if (updateUserDto.roleCode) {
      await this.roleHierarchy.assertCanAssignRole(callerRoleCode, updateUserDto.roleCode);
    }

    if (updateUserDto.email || updateUserDto.login) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                // DAT-015: case-insensitive lookup matches the LOWER() unique index
                updateUserDto.email
                  ? { email: { equals: updateUserDto.email, mode: 'insensitive' } }
                  : {},
                updateUserDto.login
                  ? { login: { equals: updateUserDto.login, mode: 'insensitive' } }
                  : {},
              ],
            },
          ],
        },
      });

      if (duplicate) {
        // DAT-015: case-fold before comparing
        if (updateUserDto.email && duplicate.email.toLowerCase() === updateUserDto.email.toLowerCase()) {
          throw new ConflictException('Cet email est déjà utilisé');
        }
        if (updateUserDto.login && duplicate.login.toLowerCase() === updateUserDto.login.toLowerCase()) {
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
        avatarUrl: true,
        avatarPreset: true,
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

    // AUD-EMIT-001 — durable audit trail for role / deactivation mutations.
    // Actor is the caller; when caller is undefined (internal/test paths) no
    // event is emitted, matching the SEC-003 callerId-optional precedent.
    if (caller) {
      if (updateData.roleId && updateData.roleId !== existingUser.roleId) {
        await this.auditPersistence.log({
          action: AuditAction.ROLE_CHANGE,
          entityType: 'User',
          entityId: id,
          actorId: caller.id ?? null,
          payload: {
            before: { roleCode: existingUser.role?.code ?? null },
            after: { roleCode: user.role?.code ?? null },
          },
        });
      }

      if (existingUser.isActive === true && updateUserDto.isActive === false) {
        await this.auditPersistence.log({
          action: AuditAction.USER_DEACTIVATED,
          entityType: 'User',
          entityId: id,
          actorId: caller.id ?? null,
          payload: {
            before: { isActive: true },
            after: { isActive: false },
          },
        });
      }

      // OBS-004 — USER_REACTIVATED on the inactive→active transition (the
      // mirror of USER_DEACTIVATED; only update() can reactivate, remove()
      // only ever deactivates).
      if (existingUser.isActive === false && updateUserDto.isActive === true) {
        await this.auditPersistence.log({
          action: AuditAction.USER_REACTIVATED,
          entityType: 'User',
          entityId: id,
          actorId: caller.id ?? null,
          payload: {
            before: { isActive: false },
            after: { isActive: true },
          },
        });
      }

      // OBS-004 — DEPARTMENT_CHANGED when the DTO carries a departmentId that
      // differs from the loaded value. departmentId stored in before/after
      // (name snapshot deferred — departments are not hard-deleted like the
      // actor case that motivated DAT-009's label snapshot).
      if (
        updateUserDto.departmentId !== undefined &&
        updateUserDto.departmentId !== existingUser.departmentId
      ) {
        await this.auditPersistence.log({
          action: AuditAction.DEPARTMENT_CHANGED,
          entityType: 'User',
          entityId: id,
          actorId: caller.id ?? null,
          payload: {
            before: { departmentId: existingUser.departmentId ?? null },
            after: { departmentId: updateUserDto.departmentId },
          },
        });
      }

      // OBS-004 — SERVICE_MEMBERSHIP_CHANGED when the DTO carries serviceIds
      // whose set differs from the current memberships (order-insensitive).
      // Payload keeps the full before/after arrays AND the computed diff so an
      // auditor can query "who gained/lost service S" without re-deriving it.
      if (updateUserDto.serviceIds !== undefined) {
        const beforeServiceIds = (existingUser.userServices ?? []).map(
          (us) => us.serviceId,
        );
        const afterServiceIds = updateUserDto.serviceIds;
        const beforeSet = new Set(beforeServiceIds);
        const afterSet = new Set(afterServiceIds);
        const added = afterServiceIds.filter((sid) => !beforeSet.has(sid));
        const removed = beforeServiceIds.filter((sid) => !afterSet.has(sid));

        if (added.length > 0 || removed.length > 0) {
          await this.auditPersistence.log({
            action: AuditAction.SERVICE_MEMBERSHIP_CHANGED,
            entityType: 'User',
            entityId: id,
            actorId: caller.id ?? null,
            payload: {
              before: { serviceIds: beforeServiceIds },
              after: { serviceIds: afterServiceIds },
              added,
              removed,
            },
          });
        }
      }
    }

    return user;
  }

  async remove(id: string, caller?: AccessUser) {
    // SEC-002 — same horizontal scope guard as update(): non-ADMIN callers
    // can only deactivate users inside their perimeter.
    if (caller) {
      await this.accessScope.assertCanManageUser(id, caller);
    }

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

    // AUD-EMIT-001 — remove() is a soft-delete (isActive flip), so it emits
    // USER_DEACTIVATED on the true→false transition, same shape as update().
    if (caller && user.isActive === true) {
      await this.auditPersistence.log({
        action: AuditAction.USER_DEACTIVATED,
        entityType: 'User',
        entityId: id,
        actorId: caller.id ?? null,
        payload: {
          before: { isActive: true },
          after: { isActive: false },
        },
      });
    }

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

    // USR-DEL-001 — audit_logs.actor_id is ON DELETE NO ACTION (d6299cc, forced
    // by the OBS-002 immutability trigger which rejects the implicit UPDATE a
    // SET NULL would issue). A user who authored ≥1 audit row therefore cannot
    // be hard-deleted: the DB raises a raw P2003. Counting the rows here turns
    // that into the same typed ConflictException as the other dependencies and
    // points the caller at the canonical alternative — soft-deactivation
    // (USER_DEACTIVATED via update()/remove()), which preserves the trail.
    const auditLogs = await this.prisma.auditLog.count({
      where: { actorId: userId },
    });
    if (auditLogs > 0) {
      dependencies.push({
        type: 'AUDIT_LOGS',
        count: auditLogs,
        description: `${auditLogs} entrée(s) d'audit attribuée(s) à cet utilisateur — désactivez le compte (USER_DEACTIVATED) au lieu de le supprimer pour préserver la traçabilité`,
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

    // USR-DEL-001 — final snapshot to the immutable audit trail BEFORE the row
    // is erased, mirroring DAT-007's PROJECT_DELETED and OBS-005's ROLE_DELETED.
    // The pre-check above guarantees this user authored zero audit_logs rows, so
    // hardDelete is reserved for trail-less accounts; this USER_DELETED row is
    // the deletion's only record. Plain await, non-transactional with the delete
    // (AuditPersistenceService runs its own client + advisory lock and takes no
    // tx client — the archive()/unarchive() + DAT-007 precedent). The snapshot
    // is an explicit allow-list: passwordHash and the token relations are never
    // included.
    await this.auditPersistence.log({
      action: AuditAction.USER_DELETED,
      entityType: 'User',
      entityId: id,
      actorId: requestingUserId ?? null,
      payload: {
        snapshot: {
          id: user.id,
          email: user.email,
          login: user.login,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
          departmentId: user.departmentId,
          isActive: user.isActive,
          avatarUrl: user.avatarUrl,
          avatarPreset: user.avatarPreset,
          forcePasswordChange: user.forcePasswordChange,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });

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

    // SEC-004 — clear `forcePasswordChange` atomically with the new hash. The
    // single update IS the success operation: the flag can never linger set
    // after the password landed. JwtStrategy.validate re-reads this on the next
    // request, so the user is unblocked immediately (no re-login needed).
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash, forcePasswordChange: false },
    });

    await this.refreshTokenService.revokeAllForUser(userId);

    // SEC-004 / AC#4 — durable, hash-chained audit_logs entry. Every
    // self-service password change is audit-sensitive; before/after track the
    // flag transition (true→false on a forced change, false→false otherwise).
    // The secret itself is never recorded.
    await this.auditPersistence.log({
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: userId,
      actorId: userId,
      payload: {
        success: true,
        timestamp: new Date().toISOString(),
        details: 'Self-service password change',
        before: { forcePasswordChange: user.forcePasswordChange },
        after: { forcePasswordChange: false },
      },
    });

    return { message: 'Mot de passe modifié avec succès' };
  }

  /**
   * Réinitialisation administrative du mot de passe (endpoint
   * `POST /users/:id/reset-password`).
   *
   * Deux gardes critiques, mêmes invariants que `AuthService.generateResetToken` :
   *
   * 1. Hiérarchie : l'appelant ne peut viser qu'une cible dont le template
   *    est strictement inférieur au sien (`roleHierarchy.assertCanAssignRole`).
   *    Sans cette garde, un détenteur de `users:manage_roles` (ex. un futur
   *    rôle institutionnel bound à ADMIN_DELEGATED) pourrait s'auto-promouvoir
   *    en réinitialisant le mot de passe d'un ADMIN.
   * 2. Self-reset interdit : le bon chemin self-service est
   *    `/auth/change-password`. Cet endpoint admin n'est pas un raccourci pour
   *    le caller (qui pourrait par ce biais contourner la vérification du
   *    mot de passe actuel).
   *
   * Émet une entrée `audit_logs` durable (actor, target, before/after sans
   * le mot de passe). Émet aussi un événement console via AuditService pour
   * parité avec le path AuthService — OBS-001 unifiera ces deux sinks.
   */
  async resetPassword(
    userId: string,
    newPassword: string,
    callerId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        login: true,
        updatedAt: true,
        role: { select: { code: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (callerId && callerId === userId) {
      throw new ForbiddenException(
        "Self-reset interdit via cet endpoint admin — utilisez /auth/change-password",
      );
    }

    if (callerId) {
      const caller = await this.prisma.user.findUnique({
        where: { id: callerId },
        select: { role: { select: { code: true } } },
      });
      await this.roleHierarchy.assertCanAssignRole(
        caller?.role?.code,
        user.role?.code,
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true, updatedAt: true },
    });

    await this.refreshTokenService.revokeAllForUser(userId);

    // OBS-004 — durable admin-reset event. Renamed from the SEC-003 free-string
    // 'PASSWORD_RESET_ADMIN' to the AuditAction enum value (advances OBS-024's
    // enum-vs-free-string unification). The console-parity auditService.log
    // below still emits PASSWORD_CHANGED — that dual sink is OBS-024 territory.
    await this.auditPersistence.log({
      action: AuditAction.PASSWORD_RESET_BY_ADMIN,
      entityType: 'User',
      entityId: userId,
      actorId: callerId ?? null,
      payload: {
        targetLogin: user.login,
        // Password value is deliberately NOT included. `updatedAt` acts as a
        // before/after marker: Prisma touches it on every write, so its
        // transition proves the reset landed without leaking the secret.
        before: { updatedAt: user.updatedAt.toISOString() },
        after: { updatedAt: updated.updatedAt.toISOString() },
      },
    });

    this.auditService.log({
      action: AuditAction.PASSWORD_CHANGED,
      userId: callerId,
      targetId: userId,
      details: `Admin password reset for user ${user.login}`,
      success: true,
    });

    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  // SEC-031: the getUsersBy* helpers get the full treatment (horizontal
  // where-scope via userReadWhere + payload reduction). Unlike findAll they
  // have no live frontend consumer (service-layer + unit tests only), so
  // scoping them carries no app-wide-dropdown blast radius. Management-tier
  // callers (`users:manage`) resolve to an empty scope (every user) + full
  // payload (incl. email); a directory caller gets the OR-bucketed scope and
  // the reduced payload (email + role.templateKey stripped).
  async getUsersByDepartment(departmentId: string, caller?: AccessUser) {
    const scopeWhere = await this.accessScope.userReadWhere(caller);
    const isManagement = await this.accessScope.hasAny(caller, ['users:manage']);
    return this.prisma.user.findMany({
      where: {
        departmentId,
        isActive: true,
        ...scopeWhere,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        avatarPreset: true,
        ...(isManagement ? { email: true } : {}),
        role: {
          select: {
            id: true,
            code: true,
            label: true,
            ...(isManagement ? { templateKey: true } : {}),
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
  }

  async getUsersByService(serviceId: string, caller?: AccessUser) {
    const scopeWhere = await this.accessScope.userReadWhere(caller);
    const isManagement = await this.accessScope.hasAny(caller, ['users:manage']);
    return this.prisma.user.findMany({
      where: {
        userServices: {
          some: {
            serviceId,
          },
        },
        isActive: true,
        ...scopeWhere,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        avatarPreset: true,
        ...(isManagement ? { email: true } : {}),
        role: {
          select: {
            id: true,
            code: true,
            label: true,
            ...(isManagement ? { templateKey: true } : {}),
          },
        },
      },
    });
  }

  async getUsersByRole(roleCode: string, caller?: AccessUser) {
    const scopeWhere = await this.accessScope.userReadWhere(caller);
    const isManagement = await this.accessScope.hasAny(caller, ['users:manage']);
    return this.prisma.user.findMany({
      where: {
        role: { code: roleCode },
        isActive: true,
        ...scopeWhere,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        avatarPreset: true,
        ...(isManagement ? { email: true } : {}),
        departmentId: true,
      },
    });
  }

  async importUsers(
    users: ImportUserDto[],
    callerRoleCode?: string,
  ): Promise<ImportUsersResultDto> {
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
            // DAT-015: case-insensitive lookup
            OR: [
              { email: { equals: userData.email, mode: 'insensitive' } },
              { login: { equals: userData.login, mode: 'insensitive' } },
            ],
          },
        });

        if (existingUser) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${rowNum}: Utilisateur ${userData.email} ou login ${userData.login} existe déjà`,
          );
          continue;
        }

        // SEC-007: the global ValidationPipe already rejects weak passwords on
        // the HTTP /import path, but importUsers bcrypts userData.password
        // directly — so any non-HTTP caller would bypass the policy. Enforce it
        // imperatively here too (defense-in-depth), surfacing the violation as a
        // per-row error rather than a hard 400 that fails the whole batch.
        const passwordError = validatePasswordStrength(userData.password);
        if (passwordError) {
          result.errors++;
          result.errorDetails.push(`Ligne ${rowNum}: ${passwordError}`);
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

        try {
          await this.roleHierarchy.assertCanAssignRole(callerRoleCode, userData.roleCode);
        } catch (err) {
          result.errors++;
          const message =
            err instanceof Error ? err.message : 'Rôle non assignable';
          result.errorDetails.push(`Ligne ${rowNum}: ${message}`);
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
            avatarUrl: true,
            avatarPreset: true,
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
    callerRoleCode?: string,
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

      // SEC-007: use the shared policy so the dry-run preview matches what the
      // real import (and the ValidationPipe) will accept — the old check only
      // verified length >= 8 and would mark a complexity-weak password "valid".
      const passwordError = validatePasswordStrength(userData.password);
      if (passwordError) {
        previewItem.status = 'error';
        previewItem.messages.push(passwordError);
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

      if (userData.roleCode) {
        try {
          await this.roleHierarchy.assertCanAssignRole(callerRoleCode, userData.roleCode);
        } catch (err) {
          previewItem.status = 'error';
          previewItem.messages.push(
            err instanceof Error ? err.message : 'Rôle non assignable',
          );
          result.errors.push(previewItem);
          result.summary.errors++;
          continue;
        }
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
   * Récupère les statuts de présence des utilisateurs pour une date donnée.
   *
   * PER-016: consolidates the former 5 sequential findMany fan-outs into a
   * single $queryRaw round-trip. Status precedence: ABSENT > EXTERNAL > REMOTE
   * > ON_SITE (matches the original if/else-if ordering).
   */
  async getUsersPresence(dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    type PresenceRow = {
      id: string;
      first_name: string;
      last_name: string;
      avatar_url: string | null;
      avatar_preset: string | null;
      department_name: string | null;
      service_name: string | null;
      presence_status: 'ON_SITE' | 'REMOTE' | 'ABSENT' | 'EXTERNAL';
    };

    // Single round-trip: JOIN users with the four status sources and compute
    // presence via a CASE expression that respects absent > external > remote
    // > on_site precedence. The sub-queries replace the four auxiliary
    // findMany calls (telework_schedules, leaves, task_assignees via tasks,
    // event_participants via events).
    const rows = await this.prisma.$queryRaw<PresenceRow[]>`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.avatar_url,
        u.avatar_preset,
        d.name            AS department_name,
        s.name            AS service_name,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM leaves l
            WHERE l.user_id = u.id
              AND l.start_date <= ${endOfDay}::date
              AND l.end_date   >= ${startOfDay}::date
              AND l.status = 'APPROVED'
          ) THEN 'ABSENT'
          WHEN EXISTS (
            SELECT 1 FROM task_assignees ta
            JOIN tasks t ON t.id = ta.task_id
            WHERE ta.user_id = u.id
              AND t.is_external_intervention = TRUE
              AND t.start_date <= ${endOfDay}
              AND t.end_date   >= ${startOfDay}
              AND t.status <> 'DONE'
          ) OR EXISTS (
            SELECT 1 FROM event_participants ep
            JOIN events e ON e.id = ep.event_id
            WHERE ep.user_id = u.id
              AND e.is_external_intervention = TRUE
              AND e.date >= ${startOfDay}
              AND e.date <= ${endOfDay}
          ) THEN 'EXTERNAL'
          WHEN EXISTS (
            SELECT 1 FROM telework_schedules ts
            WHERE ts.user_id = u.id
              AND ts.date >= ${startOfDay}::date
              AND ts.date <= ${endOfDay}::date
              AND ts.is_telework = TRUE
          ) THEN 'REMOTE'
          ELSE 'ON_SITE'
        END AS presence_status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN LATERAL (
        SELECT sv.name
        FROM user_services us2
        JOIN services sv ON sv.id = us2.service_id
        WHERE us2.user_id = u.id
        LIMIT 1
      ) s ON TRUE
      WHERE u.is_active = TRUE
      ORDER BY u.last_name ASC, u.first_name ASC
    `;

    const onSite: Array<{
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string;
      avatarPreset?: string | null;
      serviceName?: string;
      departmentName?: string;
    }> = [];
    const remote: typeof onSite = [];
    const absent: typeof onSite = [];
    const external: typeof onSite = [];

    for (const row of rows) {
      const item = {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        avatarUrl: row.avatar_url ?? undefined,
        avatarPreset: row.avatar_preset ?? undefined,
        serviceName: row.service_name ?? undefined,
        departmentName: row.department_name ?? undefined,
      };

      switch (row.presence_status) {
        case 'ABSENT':
          absent.push(item);
          break;
        case 'EXTERNAL':
          external.push(item);
          break;
        case 'REMOTE':
          remote.push(item);
          break;
        default:
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
        total: rows.length,
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

    // SEC-017: restrict cleanup to the three known extensions only.
    // The old startsWith(userId+'.') / startsWith(userId+'_') was permissive
    // and could delete non-image files (e.g. user-<id>.sh) sharing the prefix.
    const KNOWN_AVATAR_EXTS = ['.jpg', '.png', '.webp'];
    try {
      const existing = await fs.readdir(uploadsDir);
      for (const f of existing) {
        if (KNOWN_AVATAR_EXTS.some((ext) => f === `${userId}${ext}`)) {
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
    if (!VALID_PRESETS.includes(preset)) {
      throw new BadRequestException('Preset invalide');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarPreset: preset, avatarUrl: null },
      select: this.AVATAR_SELECT,
    });
  }

  async deleteAvatar(userId: string) {
    // SEC-015: never derive the filesystem path from the stored avatarUrl — a
    // DB-held string could traverse (e.g. "/api/../../../etc/passwd") and lead
    // to arbitrary file deletion. Reconstruct strictly from server-controlled
    // components: the fixed uploads dir + the userId stem, mirroring
    // uploadAvatar's own cleanup. readdir entries are bare basenames (cannot
    // traverse); the resolve() boundary check is a belt-and-suspenders guard so
    // even a logic slip (or a malformed userId) cannot escape the uploads dir.
    const uploadsDir = join(process.cwd(), 'uploads', 'avatars');
    const resolvedUploadsDir = resolve(uploadsDir);

    // SEC-017: mirror uploadAvatar's tightened cleanup — only the three known
    // image extensions, matched by exact basename. The resolve() boundary check
    // is kept as belt-and-suspenders from SEC-015.
    const KNOWN_AVATAR_EXTS = ['.jpg', '.png', '.webp'];
    try {
      const existing = await fs.readdir(uploadsDir);
      for (const f of existing) {
        if (KNOWN_AVATAR_EXTS.some((ext) => f === `${userId}${ext}`)) {
          const candidate = resolve(uploadsDir, f);
          if (candidate.startsWith(resolvedUploadsDir + sep)) {
            await fs.unlink(candidate).catch(() => null);
          }
        }
      }
    } catch {
      // uploads dir may not exist yet — nothing to delete
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
