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
  role?: string | { code: string } | null;
}

function roleCode(user?: AccessUser): string | null {
  if (!user?.role) return null;
  return typeof user.role === 'string' ? user.role : user.role.code;
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
  ): Promise<void> {
    const taskExists = await this.prisma.task.count({ where: { id: taskId } });
    if (taskExists === 0) throw new NotFoundException('Tâche introuvable');

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
}
