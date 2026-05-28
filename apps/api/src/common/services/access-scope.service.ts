import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsService } from '../../rbac/permissions.service';

export interface AccessUser {
  id: string;
  role?: string | { code: string; templateKey?: string | null } | null;
}

function roleCode(user?: AccessUser): string | null {
  if (!user?.role) return null;
  return typeof user.role === 'string' ? user.role : user.role.code;
}

function roleTemplateKey(user?: AccessUser): string | null {
  if (!user?.role || typeof user.role === 'string') return null;
  return user.role.templateKey ?? null;
}

@Injectable()
export class AccessScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async permissions(user?: AccessUser): Promise<readonly string[]> {
    return this.permissionsService.getPermissionsForRole(roleCode(user));
  }

  async hasAny(
    user: AccessUser | undefined,
    codes: readonly string[],
  ): Promise<boolean> {
    const permissions = await this.permissions(user);
    return codes.some((code) => permissions.includes(code));
  }

  projectAccessWhere(
    user: AccessUser,
    bypassPermissions: readonly string[] = [],
  ): Prisma.ProjectWhereInput {
    return {
      OR: [
        { createdById: user.id },
        { managerId: user.id },
        { sponsorId: user.id },
        { members: { some: { userId: user.id } } },
        ...(bypassPermissions.length > 0 ? [] : []),
      ],
    };
  }

  async projectScopeWhere(
    user: AccessUser | undefined,
    bypassPermissions: readonly string[] = ['projects:manage_any'],
  ): Promise<Prisma.ProjectWhereInput> {
    if (!user?.id) return { id: '__no_access__' };
    if (await this.hasAny(user, bypassPermissions)) return {};
    return this.projectAccessWhere(user);
  }

  async canAccessProject(
    projectId: string,
    user: AccessUser | undefined,
    bypassPermissions: readonly string[] = ['projects:manage_any'],
  ): Promise<boolean> {
    if (!user?.id) return false;
    if (await this.hasAny(user, bypassPermissions)) return true;

    const count = await this.prisma.project.count({
      where: {
        id: projectId,
        ...this.projectAccessWhere(user),
      },
    });
    return count > 0;
  }

  async assertCanAccessProject(
    projectId: string,
    user: AccessUser | undefined,
    bypassPermissions: readonly string[] = ['projects:manage_any'],
  ): Promise<void> {
    const projectExists = await this.prisma.project.count({
      where: { id: projectId },
    });
    if (projectExists === 0) throw new NotFoundException('Projet introuvable');

    if (!(await this.canAccessProject(projectId, user, bypassPermissions))) {
      throw new ForbiddenException('Accès projet non autorisé');
    }
  }

  async taskReadWhere(
    user: AccessUser | undefined,
  ): Promise<Prisma.TaskWhereInput> {
    if (!user?.id) return { id: '__no_access__' };
    if (await this.hasAny(user, ['tasks:readAll', 'tasks:manage_any']))
      return {};

    return {
      OR: [
        { assigneeId: user.id },
        { assignees: { some: { userId: user.id } } },
        {
          project: {
            OR: [
              { createdById: user.id },
              { managerId: user.id },
              { sponsorId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          },
        },
      ],
    };
  }

  async assertCanReadTask(
    taskId: string,
    user: AccessUser | undefined,
    bypassPermissions: readonly string[] = [],
  ): Promise<void> {
    const taskExists = await this.prisma.task.count({ where: { id: taskId } });
    if (taskExists === 0) throw new NotFoundException('Tâche introuvable');

    if (
      bypassPermissions.length > 0 &&
      (await this.hasAny(user, bypassPermissions))
    ) {
      return;
    }

    const count = await this.prisma.task.count({
      where: {
        id: taskId,
        ...(await this.taskReadWhere(user)),
      },
    });
    if (count === 0) throw new ForbiddenException('Accès tâche non autorisé');
  }

  async documentReadWhere(
    user: AccessUser | undefined,
  ): Promise<Prisma.DocumentWhereInput> {
    if (!user?.id) return { id: '__no_access__' };
    if (
      await this.hasAny(user, ['documents:manage_any', 'projects:manage_any'])
    )
      return {};

    return {
      OR: [
        { uploadedBy: user.id },
        {
          project: {
            OR: [
              { createdById: user.id },
              { managerId: user.id },
              { sponsorId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          },
        },
      ],
    };
  }

  async assertCanReadDocument(
    documentId: string,
    user: AccessUser | undefined,
  ): Promise<void> {
    const documentExists = await this.prisma.document.count({
      where: { id: documentId },
    });
    if (documentExists === 0)
      throw new NotFoundException('Document introuvable');

    const count = await this.prisma.document.count({
      where: {
        id: documentId,
        ...(await this.documentReadWhere(user)),
      },
    });
    if (count === 0)
      throw new ForbiddenException('Accès document non autorisé');
  }

  /**
   * Horizontal read scope for a single user resource (GET /users/:id).
   * Holders of `users:manage` (USERS_PAGE_ACCESS — the admin-page tier:
   * MANAGER, ADMIN_DELEGATED, ADMIN) see every user (returns `{}`). Any other
   * caller — i.e. a plain `users:read` directory holder — is limited to:
   *   - self,
   *   - users sharing at least one service with the caller,
   *   - users in a service the caller manages (Service.managerId),
   *   - users in a department the caller manages (Department.managerId).
   *
   * The last bucket (managed-department) is not in the SEC-030 audit's literal
   * three (self / same-service / managed-service); it is added to keep read
   * scope a superset of the write scope enforced by `canManageUser` — a caller
   * who may manage a target must also be able to read it ("read ⊇ write").
   * Bypass is permission-driven (`users:manage`), never role-code, unlike
   * `canManageUser` whose ADMIN-template bypass predates the permission split.
   */
  async userReadWhere(
    user: AccessUser | undefined,
  ): Promise<Prisma.UserWhereInput> {
    if (!user?.id) return { id: '__no_access__' };
    if (await this.hasAny(user, ['users:manage'])) return {};

    return {
      OR: [
        { id: user.id },
        {
          userServices: {
            some: {
              service: { userServices: { some: { userId: user.id } } },
            },
          },
        },
        { userServices: { some: { service: { managerId: user.id } } } },
        { department: { managerId: user.id } },
      ],
    };
  }

  /**
   * Horizontal scope check for admin operations targeting a user (update,
   * deactivate). ADMIN template bypasses; any other caller must be either the
   * manager of the target's department, OR share at least one service with
   * the target. The vertical check (caller cannot affect a role above their
   * own template rank) lives in RoleHierarchyService.assertCanAssignRole and
   * is intentionally separate.
   */
  async canManageUser(
    targetUserId: string,
    caller: AccessUser | undefined,
  ): Promise<boolean> {
    if (!caller?.id) return false;
    if (roleTemplateKey(caller) === 'ADMIN') return true;

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        departmentId: true,
        userServices: { select: { serviceId: true } },
      },
    });
    if (!target) return false;

    if (target.departmentId) {
      const isDeptManager = await this.prisma.department.count({
        where: { id: target.departmentId, managerId: caller.id },
      });
      if (isDeptManager > 0) return true;
    }

    const targetServiceIds = target.userServices.map((us) => us.serviceId);
    if (targetServiceIds.length > 0) {
      const shared = await this.prisma.userService.count({
        where: {
          userId: caller.id,
          serviceId: { in: targetServiceIds },
        },
      });
      if (shared > 0) return true;
    }

    return false;
  }

  async assertCanManageUser(
    targetUserId: string,
    caller: AccessUser | undefined,
  ): Promise<void> {
    const exists = await this.prisma.user.count({
      where: { id: targetUserId },
    });
    if (exists === 0) throw new NotFoundException('Utilisateur introuvable');

    if (!(await this.canManageUser(targetUserId, caller))) {
      throw new ForbiddenException('Utilisateur hors de votre périmètre');
    }
  }
}
