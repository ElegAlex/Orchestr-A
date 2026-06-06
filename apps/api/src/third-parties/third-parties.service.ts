import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ThirdParty, ThirdPartyType } from 'database';
import {
  AccessScopeService,
  AccessUser,
} from '../common/services/access-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { AuditAction } from '../audit/audit-action.enum';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
    private readonly auditPersistence: AuditPersistenceService,
  ) {}

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

    const created = await this.prisma.thirdParty.create({
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

    // OBS-014 — audit tiers creation; actor = the creator.
    await this.auditPersistence.log({
      action: AuditAction.THIRD_PARTY_CREATED,
      entityType: 'ThirdParty',
      entityId: created.id,
      actorId: createdById,
      payload: {
        thirdPartyId: created.id,
        organizationName: created.organizationName,
      },
    });

    return created;
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

  async update(
    id: string,
    dto: UpdateThirdPartyDto,
    actorId?: string,
  ): Promise<ThirdParty> {
    // COR-036 — wrap the read-check-write in a SERIALIZABLE transaction so
    // concurrent PATCH requests cannot both pass the LEGAL_ENTITY invariant
    // check and then produce an inconsistent final state.
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.thirdParty.findUnique({ where: { id } });
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

          const updated = await tx.thirdParty.update({
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
          return { before: existing, after: updated };
        },
        { isolationLevel: 'Serializable' },
      );

      // OBS-014 — emit AFTER the SERIALIZABLE tx commits, never inside it: the
      // audit hash-chain read relies on READ COMMITTED per-statement snapshots;
      // inside SERIALIZABLE it would fork the chain off a frozen prevHash or trip
      // SSI (P2034). Same constraint as OBS-015/OBS-009.
      await this.auditPersistence.log({
        action: AuditAction.THIRD_PARTY_UPDATED,
        entityType: 'ThirdParty',
        entityId: id,
        actorId: actorId ?? null,
        payload: { before: result.before, after: result.after },
      });

      return result.after;
    } catch (e) {
      // COR-036 — surface serialization failures as ConflictException (HTTP 409)
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2034'
      ) {
        throw new ConflictException(
          `Concurrent update conflict on third party ${id}; please retry`,
        );
      }
      throw e;
    }
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

  async hardDelete(id: string, actorId?: string): Promise<void> {
    const tp = await this.prisma.thirdParty.findUnique({ where: { id } });
    if (!tp) {
      throw new NotFoundException(`Third party ${id} not found`);
    }
    // OBS-014 — capture the cascade impact BEFORE the delete so the immutable
    // audit row records how many time entries / task assignments / project
    // memberships the FK cascade destroyed.
    const impact = await this.getDeletionImpact(id);
    // Cascade FK handles time_entries, task_third_party_assignees, project_third_party_members
    await this.prisma.thirdParty.delete({ where: { id } });
    // OBS-014 — durable deletion audit (snapshot + cascade counts); actor = the
    // deleting user. Awaited after the delete (no surrounding tx).
    await this.auditPersistence.log({
      action: AuditAction.THIRD_PARTY_DELETED,
      entityType: 'ThirdParty',
      entityId: id,
      actorId: actorId ?? null,
      payload: { snapshot: tp, impact },
    });
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

    let assignment: Awaited<
      ReturnType<typeof this.prisma.taskThirdPartyAssignee.create>
    >;
    try {
      assignment = await this.prisma.taskThirdPartyAssignee.create({
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

    // OBS-014 — audit the task assignment; actor = assignedById.
    await this.auditPersistence.log({
      action: AuditAction.THIRD_PARTY_ASSIGNED_TO_TASK,
      entityType: 'ThirdParty',
      entityId: thirdPartyId,
      actorId: assignedById,
      payload: { thirdPartyId, taskId },
    });

    return assignment;
  }

  async listTaskAssignees(taskId: string, currentUser?: AccessUser) {
    // SEC-025 — enforce task-scope access before returning assignees. Prevents
    // any user with third_parties:read from enumerating assignees on tasks they
    // cannot read (e.g. confidential tasks in projects they are not members of).
    await this.accessScope.assertCanReadTask(taskId, currentUser);

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

  async listProjectMembers(projectId: string, currentUser?: AccessUser) {
    // SEC-026 — enforce project-scope access before returning members. Prevents
    // any user with third_parties:read from enumerating third-party contractors
    // attached to projects they are not members of.
    await this.accessScope.assertCanAccessProject(projectId, currentUser);

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

  async unassignFromTask(
    taskId: string,
    thirdPartyId: string,
    actorId?: string,
  ): Promise<void> {
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

    // OBS-014 — audit the task unassignment.
    await this.auditPersistence.log({
      action: AuditAction.THIRD_PARTY_UNASSIGNED_FROM_TASK,
      entityType: 'ThirdParty',
      entityId: thirdPartyId,
      actorId: actorId ?? null,
      payload: { thirdPartyId, taskId },
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

    let membership: Awaited<
      ReturnType<typeof this.prisma.projectThirdPartyMember.create>
    >;
    try {
      membership = await this.prisma.projectThirdPartyMember.create({
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

    // OBS-014 — audit the project attachment; actor = assignedById.
    await this.auditPersistence.log({
      action: AuditAction.THIRD_PARTY_ATTACHED_TO_PROJECT,
      entityType: 'ThirdParty',
      entityId: thirdPartyId,
      actorId: assignedById,
      payload: { thirdPartyId, projectId },
    });

    return membership;
  }

  async detachFromProject(
    projectId: string,
    thirdPartyId: string,
    actorId?: string,
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

    // OBS-014 — audit the project detachment.
    await this.auditPersistence.log({
      action: AuditAction.THIRD_PARTY_DETACHED_FROM_PROJECT,
      entityType: 'ThirdParty',
      entityId: thirdPartyId,
      actorId: actorId ?? null,
      payload: { thirdPartyId, projectId },
    });
  }
}
