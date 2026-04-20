import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { ThirdPartiesService } from '../third-parties/third-parties.service';
import { OwnershipService } from '../common/services/ownership.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';

const DECLARE_FOR_THIRD_PARTY_PERMISSION =
  'time_tracking:declare_for_third_party';
const MANAGE_ANY_PERMISSION = 'time_tracking:manage_any';
const VIEW_ANY_PERMISSION = 'time_tracking:view_any';

type TimeEntryActor =
  | { kind: 'user'; userId: string }
  | { kind: 'thirdParty'; thirdPartyId: string };

@Injectable()
export class TimeTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly thirdPartiesService: ThirdPartiesService,
    private readonly permissionsService: PermissionsService,
    private readonly ownershipService: OwnershipService,
  ) {}

  /**
   * Defense-in-depth ownership enforcement for mutations.
   * The OwnershipGuard already protects PATCH/DELETE /:id routes, but a
   * service-level check guards against direct internal callers and keeps the
   * invariant unit-testable.
   *
   * Ownership for a TimeEntry = entry.userId === user.id OR
   * entry.declaredById === user.id (the declarer for a third-party entry).
   * Bypassed by the `time_tracking:manage_any` permission.
   */
  private async ensureCanMutate(
    entryId: string,
    user: { id: string; role: string | null },
  ): Promise<void> {
    const isOwner = await this.ownershipService.isOwner(
      'timeEntry',
      entryId,
      user.id,
    );
    if (isOwner) return;
    const permissions =
      await this.permissionsService.getPermissionsForRole(user.role);
    if (permissions.includes(MANAGE_ANY_PERMISSION)) return;
    throw new ForbiddenException('Time entry ownership violation');
  }

  /**
   * Créer une nouvelle entrée de temps.
   *
   * Deux modes d'écriture :
   * - standard : `userId = currentUser`, `declaredById = currentUser`, `thirdPartyId = null`
   * - pour compte d'un tiers : `thirdPartyId` fourni → `userId = null`, `declaredById = currentUser`.
   *   Nécessite la permission `time_tracking:declare_for_third_party` et que le tiers soit
   *   rattaché à la tâche ou au projet cible.
   */
  async create(
    currentUser: { id: string; role: string | null },
    createTimeEntryDto: CreateTimeEntryDto,
  ) {
    const {
      date,
      hours,
      activityType,
      taskId,
      projectId,
      description,
      thirdPartyId,
    } = createTimeEntryDto;

    const currentUserRecord = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
    });
    if (!currentUserRecord) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
      });
      if (!task) {
        throw new NotFoundException('Tâche introuvable');
      }
      if (!projectId && task.projectId) {
        createTimeEntryDto.projectId = task.projectId;
      }
    }

    const effectiveProjectId = createTimeEntryDto.projectId || projectId;

    if (effectiveProjectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: effectiveProjectId },
      });
      if (!project) {
        throw new NotFoundException('Projet introuvable');
      }
    }

    if (!taskId && !effectiveProjectId) {
      throw new BadRequestException(
        'Une tâche ou un projet doit être spécifié',
      );
    }

    const actor = await this.resolveActor(currentUser, thirdPartyId, {
      taskId,
      projectId: effectiveProjectId ?? undefined,
    });

    return this.prisma.timeEntry.create({
      data: {
        userId: actor.kind === 'user' ? actor.userId : null,
        thirdPartyId:
          actor.kind === 'thirdParty' ? actor.thirdPartyId : null,
        declaredById: currentUser.id,
        date: new Date(date),
        hours,
        activityType,
        taskId,
        projectId: effectiveProjectId,
        description,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        thirdParty: {
          select: {
            id: true,
            organizationName: true,
            type: true,
          },
        },
        declaredBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }

  private async resolveActor(
    currentUser: { id: string; role: string | null },
    thirdPartyId: string | undefined,
    ctx: { taskId?: string; projectId?: string },
  ): Promise<TimeEntryActor> {
    if (!thirdPartyId) {
      return { kind: 'user', userId: currentUser.id };
    }

    const permissions =
      await this.permissionsService.getPermissionsForRole(currentUser.role);
    if (!permissions.includes(DECLARE_FOR_THIRD_PARTY_PERMISSION)) {
      throw new ForbiddenException(
        'Permission time_tracking:declare_for_third_party requise pour déclarer pour un tiers',
      );
    }

    await this.thirdPartiesService.assertExistsAndActive(thirdPartyId);
    await this.thirdPartiesService.assertAssignedToTaskOrProject(
      thirdPartyId,
      ctx,
    );

    return { kind: 'thirdParty', thirdPartyId };
  }

  /**
   * Récupérer toutes les entrées avec pagination et filtres.
   *
   * Contrôle d'accès (D8 PO 2026-04-19) : coercion silencieuse — un appelant
   * sans `time_tracking:view_any` qui filtre par `userId` autre que le sien
   * voit son filtre **coercé** vers son propre userId. Aucun 403 surprise.
   * Aligné sur le pattern coercion des modules tasks/leaves/telework/events.
   */
  async findAll(
    currentUser: { id: string; role: string | null },
    page = 1,
    limit = 10,
    userId?: string,
    projectId?: string,
    taskId?: string,
    startDate?: string,
    endDate?: string,
    thirdPartyId?: string,
  ) {
    const permissions = await this.permissionsService.getPermissionsForRole(
      currentUser.role,
    );
    const hasViewAny = permissions.includes(VIEW_ANY_PERMISSION);

    // D8 : coercion silencieuse au lieu de 403. Si l'appelant veut filtrer un
    // userId tiers sans la perm view_any, on le redirige vers ses propres
    // entries (cohérent avec readAll pattern des autres modules).
    if (userId && userId !== currentUser.id && !hasViewAny) {
      userId = currentUser.id;
    }

    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.TimeEntryWhereInput = {};

    // When no userId filter is provided and user lacks view_any, scope to own entries
    if (userId) {
      where.userId = userId;
    } else if (!hasViewAny) {
      where.OR = [
        { userId: currentUser.id },
        { declaredById: currentUser.id },
      ];
    }

    if (thirdPartyId) where.thirdPartyId = thirdPartyId;
    if (projectId) where.projectId = projectId;
    if (taskId) where.taskId = taskId;

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    } else if (endDate) {
      where.date = { lte: new Date(endDate) };
    }

    const [entries, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          thirdParty: {
            select: {
              id: true,
              organizationName: true,
              type: true,
            },
          },
          declaredBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          task: { select: { id: true, title: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Récupérer une entrée par ID
   */
  async findOne(id: string, currentUser?: { id: string; role: string | null }) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        thirdParty: {
          select: {
            id: true,
            organizationName: true,
            type: true,
          },
        },
        declaredBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        task: { select: { id: true, title: true, status: true } },
        project: { select: { id: true, name: true, status: true } },
      },
    });

    if (!entry) {
      throw new NotFoundException('Entrée de temps introuvable');
    }

    // Ownership check: user must own the entry, have declared it, or have view_any permission
    if (currentUser) {
      const isOwner =
        entry.userId === currentUser.id ||
        entry.declaredById === currentUser.id;
      if (!isOwner) {
        const permissions =
          await this.permissionsService.getPermissionsForRole(
            currentUser.role,
          );
        if (!permissions.includes(VIEW_ANY_PERMISSION)) {
          throw new ForbiddenException(
            "Vous n'avez pas la permission de consulter cette entrée de temps",
          );
        }
      }
    }

    return entry;
  }

  /**
   * Mettre à jour une entrée.
   *
   * Interdit explicitement toute mutation croisant l'acteur (user → thirdParty
   * ou inverse) : une entry user reste une entry user, une entry tiers reste
   * une entry tiers. Pour changer d'acteur, supprimer et recréer.
   */
  async update(
    id: string,
    updateTimeEntryDto: UpdateTimeEntryDto,
    currentUser: { id: string; role: string | null },
  ) {
    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Entrée de temps introuvable');
    }

    await this.ensureCanMutate(id, currentUser);

    const { date, hours, activityType, taskId, projectId, description } =
      updateTimeEntryDto;

    // Interdiction explicite d'une mutation d'acteur via update
    if ('thirdPartyId' in updateTimeEntryDto) {
      const dtoThirdPartyId = (
        updateTimeEntryDto as UpdateTimeEntryDto & {
          thirdPartyId?: string | null;
        }
      ).thirdPartyId;
      if (dtoThirdPartyId !== existing.thirdPartyId) {
        throw new BadRequestException(
          "Impossible de changer l'acteur (user/tiers) d'une entrée existante. Supprimer et recréer.",
        );
      }
    }

    if (taskId && taskId !== existing.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
      });
      if (!task) {
        throw new NotFoundException('Tâche introuvable');
      }
    }

    if (projectId && projectId !== existing.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        throw new NotFoundException('Projet introuvable');
      }
    }

    const entry = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(hours !== undefined && { hours }),
        ...(activityType && { activityType }),
        ...(taskId && { taskId }),
        ...(projectId && { projectId }),
        ...(description !== undefined && { description }),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        thirdParty: {
          select: {
            id: true,
            organizationName: true,
            type: true,
          },
        },
        declaredBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return entry;
  }

  /**
   * Supprimer une entrée
   */
  async remove(id: string, currentUser: { id: string; role: string | null }) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException('Entrée de temps introuvable');
    }

    await this.ensureCanMutate(id, currentUser);

    await this.prisma.timeEntry.delete({
      where: { id },
    });

    return { message: 'Entrée de temps supprimée avec succès' };
  }

  /**
   * Récupérer les entrées de temps d'un utilisateur (user-only, par définition)
   */
  async getUserEntries(userId: string, startDate?: string, endDate?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const where: Prisma.TimeEntryWhereInput = { userId };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    } else if (endDate) {
      where.date = { lte: new Date(endDate) };
    }

    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    return entries;
  }

  /**
   * Récupérer le rapport de temps d'un utilisateur (user-only, par définition)
   */
  async getUserReport(userId: string, startDate: string, endDate: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        userId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

    const byType = entries.reduce(
      (acc, entry) => {
        acc[entry.activityType] = (acc[entry.activityType] || 0) + entry.hours;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byProject = entries.reduce(
      (acc, entry) => {
        if (entry.project) {
          const key = entry.project.id;
          if (!acc[key]) {
            acc[key] = {
              projectId: entry.project.id,
              projectName: entry.project.name,
              hours: 0,
            };
          }
          acc[key].hours += entry.hours;
        }
        return acc;
      },
      {} as Record<
        string,
        { projectId: string; projectName: string; hours: number }
      >,
    );

    const byDate = entries.reduce(
      (acc, entry) => {
        const dateKey = entry.date.toISOString().split('T')[0];
        acc[dateKey] = (acc[dateKey] || 0) + entry.hours;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      userId,
      period: {
        start: new Date(startDate),
        end: new Date(endDate),
      },
      totalHours,
      totalEntries: entries.length,
      byType,
      byProject: Object.values(byProject),
      byDate,
      entries,
    };
  }

  /**
   * Récupérer le rapport de temps d'un projet.
   *
   * Ségrégation explicite : les `userEntries` et `thirdPartyEntries` sont retournées
   * séparément, avec des totaux distincts. Aucune somme mélangée n'est exposée pour
   * éviter toute confusion entre charge user et charge tiers dans les agrégations.
   */
  async getProjectReport(
    projectId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    const dateFilter =
      startDate && endDate
        ? {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }
        : {};

    const [userEntries, thirdPartyEntries] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: { projectId, userId: { not: null }, ...dateFilter },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          declaredBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          task: { select: { id: true, title: true } },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.timeEntry.findMany({
        where: { projectId, thirdPartyId: { not: null }, ...dateFilter },
        include: {
          thirdParty: {
            select: {
              id: true,
              organizationName: true,
              type: true,
            },
          },
          declaredBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          task: { select: { id: true, title: true } },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    const userHours = userEntries.reduce((sum, e) => sum + e.hours, 0);
    const thirdPartyHours = thirdPartyEntries.reduce(
      (sum, e) => sum + e.hours,
      0,
    );

    const byUser = userEntries.reduce(
      (acc, entry) => {
        if (!entry.user) return acc;
        const key = entry.user.id;
        if (!acc[key]) {
          acc[key] = {
            userId: entry.user.id,
            userName: `${entry.user.firstName} ${entry.user.lastName}`,
            hours: 0,
          };
        }
        acc[key].hours += entry.hours;
        return acc;
      },
      {} as Record<
        string,
        { userId: string; userName: string; hours: number }
      >,
    );

    const byThirdParty = thirdPartyEntries.reduce(
      (acc, entry) => {
        if (!entry.thirdParty) return acc;
        const key = entry.thirdParty.id;
        if (!acc[key]) {
          acc[key] = {
            thirdPartyId: entry.thirdParty.id,
            organizationName: entry.thirdParty.organizationName,
            type: entry.thirdParty.type,
            hours: 0,
          };
        }
        acc[key].hours += entry.hours;
        return acc;
      },
      {} as Record<
        string,
        {
          thirdPartyId: string;
          organizationName: string;
          type: string;
          hours: number;
        }
      >,
    );

    const allEntries = [...userEntries, ...thirdPartyEntries];
    const byType = allEntries.reduce(
      (acc, entry) => {
        acc[entry.activityType] = (acc[entry.activityType] || 0) + entry.hours;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      projectId,
      projectName: project.name,
      period:
        startDate && endDate
          ? { start: new Date(startDate), end: new Date(endDate) }
          : null,
      totals: {
        userHours,
        thirdPartyHours,
      },
      totalEntries: {
        user: userEntries.length,
        thirdParty: thirdPartyEntries.length,
      },
      byUser: Object.values(byUser),
      byThirdParty: Object.values(byThirdParty),
      byType,
      userEntries,
      thirdPartyEntries,
    };
  }
}
