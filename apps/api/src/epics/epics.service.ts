import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { Prisma } from 'database';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';

@Injectable()
export class EpicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(
    createEpicDto: CreateEpicDto,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: createEpicDto.projectId },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    // SEC-004: epics:create alone is not enough — the caller must also be a
    // member of the target project (or hold projects:manage_any), mirroring the
    // membership gate already enforced on update()/remove(). The epic does not
    // exist yet, so the check targets createEpicDto.projectId directly.
    if (currentUserId) {
      await this.assertProjectMembershipByProjectId(
        createEpicDto.projectId,
        currentUserId,
        currentUserRole,
      );
    }

    return this.prisma.epic.create({
      data: createEpicDto,
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async findAll(
    page = 1,
    limit = 1000,
    projectId?: string,
    userId?: string,
    userRole?: string,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;

    // SEC-006: scope list to projects the caller is a member of, unless the
    // caller holds projects:manage_any (full visibility, e.g. ADMIN template).
    const permissions = userRole
      ? await this.permissionsService.getPermissionsForRole(userRole)
      : [];
    const hasFullVisibility = permissions.includes('projects:manage_any');
    const membershipFilter =
      !hasFullVisibility && userId
        ? { project: { members: { some: { userId } } } }
        : {};

    const where = {
      ...(projectId ? { projectId } : {}),
      ...membershipFilter,
    };

    const [data, total] = await Promise.all([
      this.prisma.epic.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          project: { select: { id: true, name: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.epic.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findOne(id: string) {
    const epic = await this.prisma.epic.findUnique({
      where: { id },
      include: {
        // SEC-008: do not leak the full parent project row (budget, dates,
        // createdById, …) cross-project to any epics:read holder. The epic
        // detail card only needs the project id + name.
        project: { select: { id: true, name: true } },
        tasks: { select: { id: true, title: true, status: true } },
      },
    });
    if (!epic) throw new NotFoundException('Epic introuvable');
    return epic;
  }

  async update(
    id: string,
    updateEpicDto: UpdateEpicDto,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    if (currentUserId) {
      await this.assertProjectMembership(id, currentUserId, currentUserRole);
    }
    await this.findOne(id);
    try {
      return await this.prisma.epic.update({
        where: { id },
        data: updateEpicDto,
        include: { project: { select: { id: true, name: true } } },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Epic introuvable');
      }
      throw err;
    }
  }

  async remove(
    id: string,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    if (currentUserId) {
      await this.assertProjectMembership(id, currentUserId, currentUserRole);
    }
    await this.findOne(id);
    try {
      await this.prisma.epic.delete({ where: { id } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Epic introuvable');
      }
      throw err;
    }
    return { message: 'Epic supprimé avec succès' };
  }

  /**
   * Verify the current user is a member of the epic's parent project.
   * Holders of the `projects:manage_any` bypass permission skip this check.
   *
   * PER-004: uses a targeted projectMember.count query instead of fetching
   * the full members relation and filtering in-memory.
   */
  private async assertProjectMembership(
    epicId: string,
    userId: string,
    userRole?: string | null,
  ): Promise<void> {
    const permissions =
      await this.permissionsService.getPermissionsForRole(userRole);
    if (permissions.includes('projects:manage_any')) return;

    // Slim fetch: only the projectId is needed to drive the membership count.
    const epic = await this.prisma.epic.findUnique({
      where: { id: epicId },
      select: { id: true, projectId: true },
    });
    if (!epic) throw new NotFoundException('Epic introuvable');

    // PER-004: single COUNT query replaces unbounded members include.
    const memberCount = await this.prisma.projectMember.count({
      where: { projectId: epic.projectId, userId },
    });
    if (memberCount === 0) {
      throw new ForbiddenException('Not a member of this project');
    }
  }

  /**
   * SEC-004: membership gate keyed by projectId (used by create(), where the
   * epic does not exist yet). Holders of projects:manage_any bypass the check.
   */
  private async assertProjectMembershipByProjectId(
    projectId: string,
    userId: string,
    userRole?: string | null,
  ): Promise<void> {
    const permissions =
      await this.permissionsService.getPermissionsForRole(userRole);
    if (permissions.includes('projects:manage_any')) return;

    const memberCount = await this.prisma.projectMember.count({
      where: { projectId, userId },
    });
    if (memberCount === 0) {
      throw new ForbiddenException('Not a member of this project');
    }
  }
}
