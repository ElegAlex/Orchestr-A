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
import { AccessScopeService } from '../common/services/access-scope.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';

const DECLARE_FOR_THIRD_PARTY_PERMISSION =
  'time_tracking:declare_for_third_party';
const MANAGE_ANY_PERMISSION = 'time_tracking:manage_any';
const VIEW_ANY_PERMISSION = 'time_tracking:view_any';

/**
 * Per-(userId, calendar day) ceiling on declared hours (COR-022). The single
 * entry is already bounded to [0.25, 24] by CreateTimeEntryDto; this guards the
 * aggregate so that several entries on the same day cannot silently inflate a
 * user's total beyond a physically plausible 24h.
 */
const MAX_HOURS_PER_DAY = 24;

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
    private readonly accessScopeService: AccessScopeService,
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
    const permissions = await this.permissionsService.getPermissionsForRole(
      user.role,
    );
    if (permissions.includes(MANAGE_ANY_PERMISSION)) return;
    throw new ForbiddenException('Time entry ownership violation');
  }

  /**
   * Enforce the per-(userId, calendar day) hours cap (COR-022). Sums the user's
   * existing non-dismissal hours for the UTC day of `date` (excluding the entry
   * being updated, if any) and rejects if the running total + `newHours` would
   * exceed {@link MAX_HOURS_PER_DAY}. Scope is `userId` only — third-party
   * declarations (userId = null) are out of this finding's literal scope.
   *
   * DAT-034: extended to accept either dimension via the `actor` parameter.
   * Behavior matches COR-022 verbatim for the user case; the thirdParty case
   * sums entries WHERE thirdPartyId = X with the same isDismissal/date filters.
   *
   * COR-038: the create() caller now wraps this method + timeEntry.create inside
   * a SERIALIZABLE $transaction, closing the aggregate TOCTOU race. The update()
   * path still calls this without a transaction (the update already operates on a
   * known, owned row, limiting the concurrent-insert risk). An optional `tx`
   * parameter allows the create() path to pass the active tx client so the
   * aggregate runs inside the same SERIALIZABLE boundary as the insert.
   */
  private async ensureDailyCapNotExceeded(
    actor:
      | { kind: 'user'; userId: string }
      | { kind: 'thirdParty'; thirdPartyId: string },
    date: Date,
    newHours: number,
    excludeEntryId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const startOfDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const actorWhere =
      actor.kind === 'user'
        ? { userId: actor.userId }
        : { thirdPartyId: actor.thirdPartyId };

    // Use the supplied transaction client when available (COR-038 SERIALIZABLE
    // context); fall back to the service-level prisma client for the update path.
    const db = tx ?? this.prisma;
    const aggregate = await db.timeEntry.aggregate({
      _sum: { hours: true },
      where: {
        ...actorWhere,
        isDismissal: false,
        date: { gte: startOfDay, lt: endOfDay },
        ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
      },
    });

    const existingHours = Number(aggregate._sum.hours ?? 0);
    const total = existingHours + newHours;
    if (total > MAX_HOURS_PER_DAY) {
      throw new BadRequestException(
        `Le total d'heures déclarées pour cette journée (${total}h) dépasse la limite de ${MAX_HOURS_PER_DAY}h`,
      );
    }
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

    if (createTimeEntryDto.isDismissal) {
      if (!createTimeEntryDto.taskId) {
        throw new BadRequestException('taskId requis pour un dismissal');
      }
      return this.upsertDismissal(currentUser, createTimeEntryDto.taskId);
    }

    if (taskId) {
      // Scope gate (Issue #3): caller must be able to read the task or hold
      // time_tracking:manage_any. Throws 404 if task missing, 403 if out-of-scope.
      await this.accessScopeService.assertCanReadTask(taskId, currentUser, [
        MANAGE_ANY_PERMISSION,
      ]);

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
      // Scope gate (Issue #3): caller must be able to access the project or
      // hold time_tracking:manage_any. assertCanAccessProject distinguishes
      // 404 (missing project) from 403 (out-of-scope).
      await this.accessScopeService.assertCanAccessProject(
        effectiveProjectId,
        currentUser,
        [MANAGE_ANY_PERMISSION],
      );
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

    // COR-038 — wrap cap-check + insert in a SERIALIZABLE $transaction so that
    // concurrent same-(actor, date) creates cannot both pass the 24h cap and
    // both commit rows that collectively exceed it. Under SERIALIZABLE, Postgres
    // detects the write-skew and aborts one transaction (P2034); we retry once
    // (same DAT-024 pattern as leaves.service.ts). The per-row @Max(24) CHECK
    // (DAT-033) remains a defense-in-depth guard but does not close the aggregate
    // race — only the SERIALIZABLE tx does.
    const txBody = async (tx: Prisma.TransactionClient) => {
      await this.ensureDailyCapNotExceeded(
        actor,
        new Date(date),
        hours,
        undefined,
        tx,
      );
      return tx.timeEntry.create({
        data: {
          userId: actor.kind === 'user' ? actor.userId : null,
          thirdPartyId: actor.kind === 'thirdParty' ? actor.thirdPartyId : null,
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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
          thirdParty: {
            select: {
              id: true,
              organizationName: true,
              type: true,
            },
          },
          declaredBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
          task: { select: { id: true, title: true } },
          project: { select: { id: true, name: true } },
        },
      });
    };

    try {
      return await this.prisma.$transaction(txBody, {
        isolationLevel: 'Serializable',
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2034'
      ) {
        return this.prisma.$transaction(txBody, {
          isolationLevel: 'Serializable',
        });
      }
      throw err;
    }
  }

  private async resolveActor(
    currentUser: { id: string; role: string | null },
    thirdPartyId: string | undefined,
    ctx: { taskId?: string; projectId?: string },
  ): Promise<TimeEntryActor> {
    if (!thirdPartyId) {
      return { kind: 'user', userId: currentUser.id };
    }

    const permissions = await this.permissionsService.getPermissionsForRole(
      currentUser.role,
    );
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
   * Upsert idempotent d'un dismissal pour la clé logique
   * (userId, taskId, isDismissal=true). Prisma ne supporte pas d'upsert sur
   * clé composite non-unique : on passe par findFirst + update/create.
   *
   * COR-037 — la transaction est promue en SERIALIZABLE pour éliminer le race
   * READ COMMITTED où deux requêtes concurrentes voient toutes les deux
   * findFirst=null et tentent toutes les deux un create. Sous SERIALIZABLE,
   * Postgres détecte le conflit d'écriture et rejette l'une d'elles (P2034) ;
   * on retry une fois (D9 retry pattern, cf. leaves.service.ts ligne 657).
   */
  private async upsertDismissal(
    currentUser: { id: string; role: string | null },
    taskId: string,
  ) {
    // Scope gate (Issue #3): the caller must be able to read the task before
    // writing a dismissal against it. assertCanReadTask handles 404 vs 403.
    await this.accessScopeService.assertCanReadTask(taskId, currentUser, [
      MANAGE_ANY_PERMISSION,
    ]);

    const userId = currentUser.id;
    const txBody = async (tx: Prisma.TransactionClient) => {
      const existing = await tx.timeEntry.findFirst({
        where: { userId, taskId, isDismissal: true },
        select: { id: true },
      });
      if (existing) {
        return tx.timeEntry.update({
          where: { id: existing.id },
          data: { updatedAt: new Date() },
          include: { task: true, project: true },
        });
      }
      const task = await tx.task.findUnique({
        where: { id: taskId },
        select: { id: true, projectId: true },
      });
      if (!task) {
        throw new NotFoundException('Tâche introuvable');
      }
      return tx.timeEntry.create({
        data: {
          userId,
          declaredById: userId,
          taskId,
          projectId: task.projectId,
          date: new Date(),
          hours: 0,
          activityType: 'OTHER',
          description: null,
          isDismissal: true,
        },
        include: { task: true, project: true },
      });
    };

    // COR-037 — SERIALIZABLE prevents the concurrent-findFirst-null → dual-create
    // race under READ COMMITTED. One-shot P2034 retry in case of serialization
    // failure (same pattern as leaves.service.ts DAT-024).
    try {
      return await this.prisma.$transaction(txBody, {
        isolationLevel: 'Serializable',
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2034'
      ) {
        return this.prisma.$transaction(txBody, {
          isolationLevel: 'Serializable',
        });
      }
      throw err;
    }
  }

  /**
   * Récupérer toutes les entrées avec pagination et filtres.
   *
   * Contrôle d'accès (Security Issue #4, 2026-05-05) : strict 403. Un appelant
   * qui filtre par `userId` tiers sans `time_tracking:view_any` reçoit une
   * `ForbiddenException`. Pas de coercion silencieuse — le client doit voir
   * un refus explicite plutôt qu'un dataset substitué.
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
    includeDismissals = false,
  ) {
    const permissions = await this.permissionsService.getPermissionsForRole(
      currentUser.role,
    );
    const hasViewAny = permissions.includes(VIEW_ANY_PERMISSION);

    if (userId && userId !== currentUser.id && !hasViewAny) {
      throw new ForbiddenException(
        'time_tracking:view_any requise pour filtrer par utilisateur tiers',
      );
    }

    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.TimeEntryWhereInput = {};

    // When no userId filter is provided and user lacks view_any, scope to own entries
    if (userId) {
      where.userId = userId;
    } else if (!hasViewAny) {
      where.OR = [{ userId: currentUser.id }, { declaredById: currentUser.id }];
    }

    if (thirdPartyId) where.thirdPartyId = thirdPartyId;
    if (projectId) where.projectId = projectId;
    if (taskId) where.taskId = taskId;

    if (!includeDismissals) {
      where.isDismissal = false;
    }

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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
          thirdParty: {
            select: {
              id: true,
              organizationName: true,
              type: true,
            },
          },
          declaredBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
            email: true,
          },
        },
        thirdParty: {
          select: {
            id: true,
            organizationName: true,
            type: true,
          },
        },
        declaredBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
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
        const permissions = await this.permissionsService.getPermissionsForRole(
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

    // Per-day hours cap (COR-022 user path + DAT-034 third-party path) —
    // re-check against the effective hours/date after the update, excluding
    // this entry's own contribution. Selects the dimension from the existing
    // row (the update path forbids cross-actor mutations elsewhere — see
    // `'thirdPartyId' in updateTimeEntryDto` guard).
    const effectiveHours = hours !== undefined ? hours : Number(existing.hours);
    const effectiveDate = date ? new Date(date) : existing.date;
    if (existing.userId) {
      await this.ensureDailyCapNotExceeded(
        { kind: 'user', userId: existing.userId },
        effectiveDate,
        effectiveHours,
        id,
      );
    } else if (existing.thirdPartyId) {
      await this.ensureDailyCapNotExceeded(
        { kind: 'thirdParty', thirdPartyId: existing.thirdPartyId },
        effectiveDate,
        effectiveHours,
        id,
      );
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        thirdParty: {
          select: {
            id: true,
            organizationName: true,
            type: true,
          },
        },
        declaredBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
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

    const dateWhere = {
      userId,
      isDismissal: false,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    // Push all aggregation to Postgres via groupBy — no JS reduce() over rows
    const [totalAgg, byTypeRows, byProjectRows, byDateRows] = await Promise.all(
      [
        this.prisma.timeEntry.aggregate({
          where: dateWhere,
          _sum: { hours: true },
          _count: { _all: true },
        }),
        this.prisma.timeEntry.groupBy({
          by: ['activityType'],
          where: dateWhere,
          _sum: { hours: true },
        }),
        this.prisma.timeEntry.groupBy({
          by: ['projectId'],
          where: { ...dateWhere, projectId: { not: null } },
          _sum: { hours: true },
        }),
        this.prisma.timeEntry.groupBy({
          by: ['date'],
          where: dateWhere,
          _sum: { hours: true },
        }),
      ],
    );

    const totalHours = Number(totalAgg._sum.hours ?? 0);
    const totalEntries = totalAgg._count._all;

    // byType: flat map from groupBy result
    const byType: Record<string, number> = {};
    for (const row of byTypeRows) {
      byType[row.activityType] = Number(row._sum.hours ?? 0);
    }

    // byProject: resolve project names for the small set of distinct projectIds
    const projectIds = byProjectRows
      .map((r) => r.projectId)
      .filter((id): id is string => id !== null);
    const projectNameMap: Record<string, string> = {};
    if (projectIds.length > 0) {
      const projects = await this.prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      });
      for (const p of projects) {
        projectNameMap[p.id] = p.name;
      }
    }
    const byProject = byProjectRows
      .filter(
        (r): r is typeof r & { projectId: string } => r.projectId !== null,
      )
      .map((r) => ({
        projectId: r.projectId,
        projectName: projectNameMap[r.projectId] ?? '',
        hours: Number(r._sum.hours ?? 0),
      }));

    // byDate: date key as YYYY-MM-DD (date field is @db.Date — no time component)
    const byDate: Record<string, number> = {};
    for (const row of byDateRows) {
      const dateKey = row.date.toISOString().split('T')[0];
      byDate[dateKey] = Number(row._sum.hours ?? 0);
    }

    return {
      userId,
      period: {
        start: new Date(startDate),
        end: new Date(endDate),
      },
      totalHours,
      totalEntries,
      byType,
      byProject,
      byDate,
      // NOTE: raw entries array intentionally omitted — web app does not consume
      // it; returning all rows on annual exports was the original performance bug.
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

    const userWhere = {
      projectId,
      userId: { not: null } as Prisma.StringNullableFilter,
      isDismissal: false,
      ...dateFilter,
    };
    const thirdPartyWhere = {
      projectId,
      thirdPartyId: { not: null } as Prisma.StringNullableFilter,
      isDismissal: false,
      ...dateFilter,
    };

    // Push all aggregation to Postgres via groupBy + aggregate — no JS reduce()
    const [
      userTotalAgg,
      thirdPartyTotalAgg,
      byUserRows,
      byThirdPartyRows,
      byTypeUserRows,
      byTypeThirdPartyRows,
    ] = await Promise.all([
      this.prisma.timeEntry.aggregate({
        where: userWhere,
        _sum: { hours: true },
        _count: { _all: true },
      }),
      this.prisma.timeEntry.aggregate({
        where: thirdPartyWhere,
        _sum: { hours: true },
        _count: { _all: true },
      }),
      this.prisma.timeEntry.groupBy({
        by: ['userId'],
        where: userWhere,
        _sum: { hours: true },
      }),
      this.prisma.timeEntry.groupBy({
        by: ['thirdPartyId'],
        where: thirdPartyWhere,
        _sum: { hours: true },
      }),
      this.prisma.timeEntry.groupBy({
        by: ['activityType'],
        where: userWhere,
        _sum: { hours: true },
      }),
      this.prisma.timeEntry.groupBy({
        by: ['activityType'],
        where: thirdPartyWhere,
        _sum: { hours: true },
      }),
    ]);

    const userHours = Number(userTotalAgg._sum.hours ?? 0);
    const thirdPartyHours = Number(thirdPartyTotalAgg._sum.hours ?? 0);

    // byUser: resolve names for distinct userIds
    const userIds = byUserRows
      .map((r) => r.userId)
      .filter((id): id is string => id !== null);
    const userMap: Record<
      string,
      {
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        avatarPreset: string | null;
      }
    > = {};
    if (userIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          avatarPreset: true,
        },
      });
      for (const u of users) {
        userMap[u.id] = u;
      }
    }
    const byUser = byUserRows
      .filter((r): r is typeof r & { userId: string } => r.userId !== null)
      .map((r) => ({
        userId: r.userId,
        userName: userMap[r.userId]
          ? `${userMap[r.userId].firstName} ${userMap[r.userId].lastName}`
          : r.userId,
        hours: Number(r._sum.hours ?? 0),
      }));

    // byThirdParty: resolve org names for distinct thirdPartyIds
    const thirdPartyIds = byThirdPartyRows
      .map((r) => r.thirdPartyId)
      .filter((id): id is string => id !== null);
    const thirdPartyMap: Record<
      string,
      { organizationName: string; type: string }
    > = {};
    if (thirdPartyIds.length > 0) {
      const tps = await this.prisma.thirdParty.findMany({
        where: { id: { in: thirdPartyIds } },
        select: { id: true, organizationName: true, type: true },
      });
      for (const tp of tps) {
        thirdPartyMap[tp.id] = {
          organizationName: tp.organizationName,
          type: tp.type,
        };
      }
    }
    const byThirdParty = byThirdPartyRows
      .filter(
        (r): r is typeof r & { thirdPartyId: string } =>
          r.thirdPartyId !== null,
      )
      .map((r) => ({
        thirdPartyId: r.thirdPartyId,
        organizationName: thirdPartyMap[r.thirdPartyId]?.organizationName ?? '',
        type: thirdPartyMap[r.thirdPartyId]?.type ?? '',
        hours: Number(r._sum.hours ?? 0),
      }));

    // byType: merge user+thirdParty activityType sums
    const byType: Record<string, number> = {};
    for (const row of [...byTypeUserRows, ...byTypeThirdPartyRows]) {
      byType[row.activityType] =
        (byType[row.activityType] ?? 0) + Number(row._sum.hours ?? 0);
    }

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
        user: userTotalAgg._count._all,
        thirdParty: thirdPartyTotalAgg._count._all,
      },
      byUser,
      byThirdParty,
      byType,
      // NOTE: raw userEntries/thirdPartyEntries arrays intentionally omitted —
      // web app does not consume them; returning all rows was the performance bug.
    };
  }
}
