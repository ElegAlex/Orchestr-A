import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ThirdParty, ThirdPartyType } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateThirdPartyDto } from './dto/create-third-party.dto';
import { UpdateThirdPartyDto } from './dto/update-third-party.dto';
import { QueryThirdPartyDto } from './dto/query-third-party.dto';

export interface DeletionImpact {
  timeEntriesCount: number;
  taskAssignmentsCount: number;
  projectMembershipsCount: number;
}

@Injectable()
export class ThirdPartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateThirdPartyDto,
    createdById: string,
  ): Promise<ThirdParty> {
    if (dto.type === ThirdPartyType.LEGAL_ENTITY) {
      if (dto.contactFirstName || dto.contactLastName) {
        throw new BadRequestException(
          'LEGAL_ENTITY third parties cannot have a named contact (firstName/lastName)',
        );
      }
    }

    return this.prisma.thirdParty.create({
      data: {
        type: dto.type,
        organizationName: dto.organizationName,
        contactFirstName: dto.contactFirstName,
        contactLastName: dto.contactLastName,
        contactEmail: dto.contactEmail,
        notes: dto.notes,
        createdById,
      },
    });
  }

  async findAll(query: QueryThirdPartyDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ThirdPartyWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.organizationName = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.thirdParty.findMany({
        where,
        orderBy: { organizationName: 'asc' },
        skip,
        take: limit,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          _count: {
            select: {
              taskAssignments: true,
              projectMemberships: true,
              timeEntries: { where: { isDismissal: false } },
            },
          },
        },
      }),
      this.prisma.thirdParty.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<ThirdParty> {
    const tp = await this.prisma.thirdParty.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: {
          select: {
            taskAssignments: true,
            projectMemberships: true,
            timeEntries: { where: { isDismissal: false } },
          },
        },
      },
    });
    if (!tp) {
      throw new NotFoundException(`Third party ${id} not found`);
    }
    return tp;
  }

  async update(id: string, dto: UpdateThirdPartyDto): Promise<ThirdParty> {
    const existing = await this.prisma.thirdParty.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Third party ${id} not found`);
    }

    const nextType = dto.type ?? existing.type;
    const nextFirstName =
      dto.contactFirstName !== undefined
        ? dto.contactFirstName
        : existing.contactFirstName;
    const nextLastName =
      dto.contactLastName !== undefined
        ? dto.contactLastName
        : existing.contactLastName;

    if (
      nextType === ThirdPartyType.LEGAL_ENTITY &&
      (nextFirstName || nextLastName)
    ) {
      throw new BadRequestException(
        'LEGAL_ENTITY third parties cannot have a named contact (firstName/lastName)',
      );
    }

    return this.prisma.thirdParty.update({
      where: { id },
      data: {
        type: dto.type,
        organizationName: dto.organizationName,
        contactFirstName: dto.contactFirstName,
        contactLastName: dto.contactLastName,
        contactEmail: dto.contactEmail,
        notes: dto.notes,
        isActive: dto.isActive,
      },
    });
  }

  async getDeletionImpact(id: string): Promise<DeletionImpact> {
    const tp = await this.prisma.thirdParty.findUnique({ where: { id } });
    if (!tp) {
      throw new NotFoundException(`Third party ${id} not found`);
    }

    const [timeEntriesCount, taskAssignmentsCount, projectMembershipsCount] =
      await this.prisma.$transaction([
        this.prisma.timeEntry.count({
          where: { thirdPartyId: id, isDismissal: false },
        }),
        this.prisma.taskThirdPartyAssignee.count({
          where: { thirdPartyId: id },
        }),
        this.prisma.projectThirdPartyMember.count({
          where: { thirdPartyId: id },
        }),
      ]);

    return {
      timeEntriesCount,
      taskAssignmentsCount,
      projectMembershipsCount,
    };
  }

  async hardDelete(id: string): Promise<void> {
    const tp = await this.prisma.thirdParty.findUnique({ where: { id } });
    if (!tp) {
      throw new NotFoundException(`Third party ${id} not found`);
    }
    // Cascade FK handles time_entries, task_third_party_assignees, project_third_party_members
    await this.prisma.thirdParty.delete({ where: { id } });
  }

  async assertExistsAndActive(id: string): Promise<void> {
    const tp = await this.prisma.thirdParty.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!tp) {
      throw new NotFoundException(`Third party ${id} not found`);
    }
    if (!tp.isActive) {
      throw new BadRequestException(`Third party ${id} is archived`);
    }
  }

  /**
   * Check that a third party is reachable via either the task (direct
   * assignment) or the task's parent project (or the projectId directly
   * if no taskId is given).
   *
   * - taskId given: OK if the tiers is assigned to the task OR to the
   *   task's parent project (orphan tasks skip the project check).
   * - projectId only: OK if the tiers is attached to the project.
   */
  async assertAssignedToTaskOrProject(
    thirdPartyId: string,
    ctx: { taskId?: string; projectId?: string },
  ): Promise<void> {
    if (!ctx.taskId && !ctx.projectId) {
      throw new BadRequestException(
        'assertAssignedToTaskOrProject requires at least taskId or projectId',
      );
    }

    if (ctx.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: ctx.taskId },
        select: { id: true, projectId: true },
      });
      if (!task) {
        throw new NotFoundException(`Task ${ctx.taskId} not found`);
      }

      const taskAssignment =
        await this.prisma.taskThirdPartyAssignee.findUnique({
          where: {
            taskId_thirdPartyId: { taskId: ctx.taskId, thirdPartyId },
          },
          select: { id: true },
        });
      if (taskAssignment) return;

      if (task.projectId) {
        const projectMembership =
          await this.prisma.projectThirdPartyMember.findUnique({
            where: {
              projectId_thirdPartyId: {
                projectId: task.projectId,
                thirdPartyId,
              },
            },
            select: { id: true },
          });
        if (projectMembership) return;
      }

      throw new ForbiddenException(
        `Third party ${thirdPartyId} is not assigned to task ${ctx.taskId} or its parent project`,
      );
    }

    // projectId only
    const projectMembership =
      await this.prisma.projectThirdPartyMember.findUnique({
        where: {
          projectId_thirdPartyId: {
            projectId: ctx.projectId!,
            thirdPartyId,
          },
        },
        select: { id: true },
      });
    if (!projectMembership) {
      throw new ForbiddenException(
        `Third party ${thirdPartyId} is not attached to project ${ctx.projectId}`,
      );
    }
  }

  async assignToTask(
    taskId: string,
    thirdPartyId: string,
    assignedById: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    await this.assertExistsAndActive(thirdPartyId);

    try {
      return await this.prisma.taskThirdPartyAssignee.create({
        data: { taskId, thirdPartyId, assignedById },
        include: {
          thirdParty: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Third party ${thirdPartyId} is already assigned to task ${taskId}`,
        );
      }
      throw e;
    }
  }

  async listTaskAssignees(taskId: string) {
    return this.prisma.taskThirdPartyAssignee.findMany({
      where: { taskId },
      include: {
        thirdParty: true,
        assignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listProjectMembers(projectId: string) {
    return this.prisma.projectThirdPartyMember.findMany({
      where: { projectId },
      include: {
        thirdParty: true,
        assignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async unassignFromTask(taskId: string, thirdPartyId: string): Promise<void> {
    const existing = await this.prisma.taskThirdPartyAssignee.findUnique({
      where: { taskId_thirdPartyId: { taskId, thirdPartyId } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Third party ${thirdPartyId} is not assigned to task ${taskId}`,
      );
    }
    await this.prisma.taskThirdPartyAssignee.delete({
      where: { taskId_thirdPartyId: { taskId, thirdPartyId } },
    });
  }

  async attachToProject(
    projectId: string,
    thirdPartyId: string,
    assignedById: string,
    allocation?: number,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    await this.assertExistsAndActive(thirdPartyId);

    try {
      return await this.prisma.projectThirdPartyMember.create({
        data: {
          projectId,
          thirdPartyId,
          assignedById,
          allocation: allocation ?? null,
        },
        include: {
          thirdParty: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Third party ${thirdPartyId} is already attached to project ${projectId}`,
        );
      }
      throw e;
    }
  }

  async detachFromProject(
    projectId: string,
    thirdPartyId: string,
  ): Promise<void> {
    const existing = await this.prisma.projectThirdPartyMember.findUnique({
      where: { projectId_thirdPartyId: { projectId, thirdPartyId } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Third party ${thirdPartyId} is not attached to project ${projectId}`,
      );
    }
    await this.prisma.projectThirdPartyMember.delete({
      where: { projectId_thirdPartyId: { projectId, thirdPartyId } },
    });
  }
}
