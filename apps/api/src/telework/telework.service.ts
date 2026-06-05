import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { CreateTeleworkDto } from './dto/create-telework.dto';
import { UpdateTeleworkDto } from './dto/update-telework.dto';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';
import { UpdateRecurringRuleDto } from './dto/update-recurring-rule.dto';
import { GenerateSchedulesDto } from './dto/generate-schedules.dto';
import { Prisma } from 'database';

/** Timezone anchor for all telework day arithmetic — must match Europe/Paris. */
const TELEWORK_TZ = 'Europe/Paris';

/**
 * Return the Paris calendar day as a `yyyy-MM-dd` key for a given instant.
 * Safe across DST transitions: uses formatInTimeZone, not local getters.
 */
function teleworkDayKey(d: Date): string {
  return formatInTimeZone(d, TELEWORK_TZ, 'yyyy-MM-dd');
}

/**
 * Advance a `yyyy-MM-dd` key by exactly one calendar day using UTC arithmetic
 * (no local-TZ involvement, no DST skew).
 */
function nextTeleworkDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Convert a `yyyy-MM-dd` day key to a UTC-midnight Date (suitable for Prisma
 * @db.Date fields). Avoids local-TZ midnight which may land on the wrong UTC
 * calendar day during DST transitions.
 */
function dayKeyToUTCDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Return the model weekday (0=Mon … 6=Sun) for a `yyyy-MM-dd` key.
 * Uses UTC arithmetic so it is immune to local-TZ getDay() DST hazards.
 */
function modelDayOfWeekFromKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun … 6=Sat
  return jsDay === 0 ? 6 : jsDay - 1; // model: 0=Mon … 6=Sun
}

@Injectable()
export class TeleworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  /**
   * Créer une journée de télétravail
   */
  async create(
    currentUserId: string,
    currentUserRole: string | null,
    createTeleworkDto: CreateTeleworkDto,
  ) {
    const {
      date,
      isTelework = true,
      isException = false,
      userId: targetUserId,
    } = createTeleworkDto;

    // Si le userId du DTO est différent de l'utilisateur connecté, vérifier la permission
    if (targetUserId && targetUserId !== currentUserId) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('telework:manage_any')) {
        throw new ForbiddenException(
          "Vous n'avez pas la permission de saisir le télétravail pour autrui",
        );
      }
    }

    // Utiliser le userId du DTO si fourni (admin/manager), sinon l'utilisateur connecté
    const userId = targetUserId || currentUserId;

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Normalise to UTC-midnight of the Paris calendar day regardless of any
    // time-of-day component or UTC offset in the DTO string (COR-027).
    const teleworkDate = dayKeyToUTCDate(teleworkDayKey(new Date(date)));

    // Vérifier qu'il n'y a pas déjà un télétravail pour cette date
    const existing = await this.prisma.teleworkSchedule.findUnique({
      where: {
        userId_date: {
          userId,
          date: teleworkDate,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Un télétravail existe déjà pour cette date');
    }

    const telework = await this.prisma.teleworkSchedule.create({
      data: {
        userId,
        date: teleworkDate,
        isTelework,
        isException,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return telework;
  }

  /**
   * Récupérer tous les télétravails avec filtres
   */
  async findAll(
    currentUserId: string,
    currentUserRole: string | null,
    page = 1,
    limit = 50,
    userId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.TeleworkScheduleWhereInput = {};

    // Lecture globale : vérifier la permission dynamique telework:readAll
    const permissions =
      await this.permissionsService.getPermissionsForRole(currentUserRole);
    if (!permissions.includes('telework:readAll')) {
      where.userId = currentUserId;
    } else if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    // Auto-expand recurring rules into individual schedules for the requested range.
    // COR-003 — expand with the ALREADY-SCOPE-NARROWED `where.userId`, not the raw
    // query param: a non-privileged caller (no telework:readAll) who omits userId
    // must only materialise their OWN rules, never every user's (write-side leak).
    if (startDate && endDate) {
      // SEC-024 — bound the range to 366 days to prevent an O(days × rules) DoS
      // through unbounded auto-expansion.
      const rangeDays =
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        86_400_000;
      if (rangeDays > 366) {
        throw new BadRequestException(
          'La plage de dates ne peut pas dépasser 366 jours',
        );
      }
      await this.expandRecurringRulesForRange(
        startDate,
        endDate,
        where.userId as string | undefined,
      );
    }

    const [teleworks, total] = await Promise.all([
      this.prisma.teleworkSchedule.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { date: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
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
          },
        },
      }),
      this.prisma.teleworkSchedule.count({ where }),
    ]);

    return {
      data: teleworks,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Récupère les télétravails strictement pour les agents déjà visibles dans
   * planning/overview. Utilisé pour l'éligibilité des predefined tasks sans
   * élargir les droits du endpoint public GET /telework.
   */
  async findForPlanningOverview(
    userIds: string[],
    startDate: string,
    endDate: string,
  ) {
    if (userIds.length === 0) {
      return [];
    }

    // COR-032: pass the scoped userIds so only rules for visible users are
    // materialised, preventing cross-user schedule leakage.
    await this.expandRecurringRulesForRange(startDate, endDate, [
      ...new Set(userIds),
    ]);

    return this.prisma.teleworkSchedule.findMany({
      where: {
        userId: { in: [...new Set(userIds)] },
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
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
        },
      },
    });
  }

  /**
   * Expand recurring rules into individual telework_schedule entries for a date range.
   * Called automatically by findAll when startDate/endDate are provided.
   * Creates missing entries only (skips existing).
   *
   * COR-032: filterUserIds accepts a single userId string, an array of userIds,
   * or undefined (no filter = all active rules). This prevents cross-user
   * schedule leakage when called from findForPlanningOverview with a scoped list.
   *
   * PER-028 / COR-033: Uses a single bulk findMany to pre-load existing rows
   * and a single createMany({skipDuplicates:true}) for inserts, eliminating
   * the O(days × rules) N+1 pattern and the TOCTOU P2002 race condition.
   */
  private async expandRecurringRulesForRange(
    startDate: string,
    endDate: string,
    filterUserIds?: string | string[],
  ) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const ruleWhere: Prisma.TeleworkRecurringRuleWhereInput = {
      isActive: true,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    };

    if (filterUserIds !== undefined) {
      if (Array.isArray(filterUserIds)) {
        ruleWhere.userId = { in: filterUserIds };
      } else {
        ruleWhere.userId = filterUserIds;
      }
    }

    const rules = await this.prisma.teleworkRecurringRule.findMany({
      where: ruleWhere,
    });

    if (rules.length === 0) {
      return;
    }

    // COR-012: iterate in day-key space (Europe/Paris) to avoid DST skew.
    // Local getDay()/setDate() mix with UTC-anchored Dates causes off-by-one
    // on spring-forward days (23-hour day → cursor lands on wrong UTC date).

    // Compute the full set of (userId, dateKey) pairs that rules require.
    const expected = new Map<string, { userId: string; dateKey: string }>();
    for (const rule of rules) {
      const ruleStartKey = teleworkDayKey(new Date(rule.startDate));
      const ruleEndKey = rule.endDate
        ? teleworkDayKey(new Date(rule.endDate))
        : null;

      let cursorKey = teleworkDayKey(start);
      const endKey = teleworkDayKey(end);

      while (cursorKey <= endKey) {
        const modelDay = modelDayOfWeekFromKey(cursorKey);

        if (
          modelDay === rule.dayOfWeek &&
          cursorKey >= ruleStartKey &&
          (!ruleEndKey || cursorKey <= ruleEndKey)
        ) {
          const key = `${rule.userId}|${cursorKey}`;
          expected.set(key, { userId: rule.userId, dateKey: cursorKey });
        }

        cursorKey = nextTeleworkDayKey(cursorKey);
      }
    }

    if (expected.size === 0) {
      return;
    }

    // Pre-load all existing rows for the affected users × date range in one query.
    const affectedUserIds = [...new Set(rules.map((r) => r.userId))];
    const existing = await this.prisma.teleworkSchedule.findMany({
      where: {
        userId: { in: affectedUserIds },
        date: {
          gte: dayKeyToUTCDate(teleworkDayKey(start)),
          lte: dayKeyToUTCDate(teleworkDayKey(end)),
        },
      },
      select: { userId: true, date: true },
    });

    const existingSet = new Set<string>(
      existing.map((e) => `${e.userId}|${teleworkDayKey(e.date)}`),
    );

    // Create only the missing entries in a single bulk insert.
    const toCreate = [...expected.values()].filter(
      ({ userId, dateKey }) => !existingSet.has(`${userId}|${dateKey}`),
    );

    if (toCreate.length > 0) {
      await this.prisma.teleworkSchedule.createMany({
        data: toCreate.map(({ userId, dateKey }) => ({
          userId,
          date: dayKeyToUTCDate(dateKey),
          isTelework: true,
          isException: false,
        })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * Récupérer un télétravail par ID
   */
  async findOne(
    id: string,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    const telework = await this.prisma.teleworkSchedule.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!telework) {
      throw new NotFoundException('Télétravail introuvable');
    }

    // IDOR protection: check telework:manage_any permission to view others' telework
    if (currentUserId && currentUserRole && telework.userId !== currentUserId) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('telework:manage_any')) {
        throw new ForbiddenException(
          "Vous n'avez pas la permission de consulter le télétravail d'autrui",
        );
      }
    }

    return telework;
  }

  /**
   * Planning hebdomadaire d'un utilisateur
   */
  async getWeeklySchedule(userId: string, date?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const referenceDate = date ? new Date(date) : new Date();

    // COR-034: use UTC-anchored day-key helpers to compute week boundaries —
    // avoids local-TZ getDay()/setDate()/setHours() which break on non-UTC
    // servers (e.g. Europe/Paris DST spring-forward days).
    const refKey = teleworkDayKey(referenceDate);
    const [ry, rm, rd] = refKey.split('-').map(Number);
    const jsDay = new Date(Date.UTC(ry, rm - 1, rd)).getUTCDay(); // 0=Sun … 6=Sat
    const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay; // number of days to subtract

    let startKey = refKey;
    // Walk backwards to Monday
    for (let i = 0; i < Math.abs(diffToMonday); i++) {
      // Advance by -1 using UTC: subtract one day
      const [y, m, d] = startKey.split('-').map(Number);
      const prev = new Date(Date.UTC(y, m - 1, d - 1));
      const yy = prev.getUTCFullYear();
      const mm = String(prev.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(prev.getUTCDate()).padStart(2, '0');
      startKey = `${yy}-${mm}-${dd}`;
    }

    // Walk forward 6 days to Sunday
    let endKey = startKey;
    for (let i = 0; i < 6; i++) {
      endKey = nextTeleworkDayKey(endKey);
    }

    const start = dayKeyToUTCDate(startKey);
    const [ey, em, ed] = endKey.split('-').map(Number);
    const end = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));

    const teleworks = await this.prisma.teleworkSchedule.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'asc' },
    });

    return {
      userId,
      weekStart: start,
      weekEnd: end,
      teleworks,
      totalDays: teleworks.filter((t) => t.isTelework).length,
    };
  }

  /**
   * Statistiques annuelles d'un utilisateur
   */
  async getUserStats(userId: string, year?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const currentYear = year ?? new Date().getFullYear();

    // COR-035: use UTC constructors so year boundaries are 2026-01-01T00:00:00Z
    // (not 2025-12-31T23:00:00Z under Europe/Paris UTC+1 in winter).
    const startDate = new Date(Date.UTC(currentYear, 0, 1));
    const endDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));

    const teleworks = await this.prisma.teleworkSchedule.findMany({
      where: {
        userId,
        isTelework: true,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    const totalDays = teleworks.length;

    // Calculer par mois
    const byMonth = teleworks.reduce(
      (acc, telework) => {
        const month = telework.date.getMonth();
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    // Moyenne par mois
    const monthsWithData = Object.keys(byMonth).length;
    const averagePerMonth = monthsWithData > 0 ? totalDays / monthsWithData : 0;

    return {
      userId,
      year: currentYear,
      totalDays,
      byMonth,
      averagePerMonth: Math.round(averagePerMonth * 10) / 10,
    };
  }

  /**
   * Modifier un télétravail
   */
  async update(
    id: string,
    currentUserId: string,
    currentUserRole: string | null,
    updateTeleworkDto: UpdateTeleworkDto,
  ) {
    const existingTelework = await this.prisma.teleworkSchedule.findUnique({
      where: { id },
    });

    if (!existingTelework) {
      throw new NotFoundException('Télétravail introuvable');
    }

    // Check permission if modifying someone else's telework
    if (existingTelework.userId !== currentUserId) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('telework:manage_any')) {
        throw new ForbiddenException(
          "Vous n'avez pas la permission de modifier le télétravail d'autrui",
        );
      }
    }

    const { date, isTelework, isException } = updateTeleworkDto;

    const updateData: Prisma.TeleworkScheduleUpdateInput = {};

    // Si la date change, vérifier l'unicité
    // Normalise input to Paris calendar-day UTC-midnight (COR-027) before
    // comparing — avoids false "changed" detection for timed/offset inputs.
    if (date) {
      const newDate = dayKeyToUTCDate(teleworkDayKey(new Date(date)));
      const existingDateKey = teleworkDayKey(existingTelework.date);
      const newDateKey = teleworkDayKey(newDate);

      if (newDateKey !== existingDateKey) {
        // Vérifier que la nouvelle date n'est pas déjà utilisée
        const conflict = await this.prisma.teleworkSchedule.findUnique({
          where: {
            userId_date: {
              userId: existingTelework.userId,
              date: newDate,
            },
          },
        });

        if (conflict && conflict.id !== id) {
          throw new ConflictException(
            'Un télétravail existe déjà pour cette date',
          );
        }

        updateData.date = newDate;
      }
    }

    if (isTelework !== undefined) {
      updateData.isTelework = isTelework;
    }

    if (isException !== undefined) {
      updateData.isException = isException;
    }

    const telework = await this.prisma.teleworkSchedule.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return telework;
  }

  /**
   * Supprimer un télétravail
   */
  async remove(
    id: string,
    currentUserId: string,
    currentUserRole: string | null,
  ) {
    const telework = await this.prisma.teleworkSchedule.findUnique({
      where: { id },
    });

    if (!telework) {
      throw new NotFoundException('Télétravail introuvable');
    }

    // Check permission if deleting someone else's telework
    if (telework.userId !== currentUserId) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('telework:manage_any')) {
        throw new ForbiddenException(
          "Vous n'avez pas la permission de supprimer le télétravail d'autrui",
        );
      }
    }

    await this.prisma.teleworkSchedule.delete({
      where: { id },
    });

    return { message: 'Télétravail supprimé avec succès' };
  }

  // ─────────────────────────────────────────────
  // RECURRING RULES
  // ─────────────────────────────────────────────

  /**
   * Lister les règles récurrentes (avec filtre userId)
   */
  async findAllRecurringRules(
    currentUserId: string,
    currentUserRole: string | null,
    userId?: string,
  ) {
    const permissions =
      await this.permissionsService.getPermissionsForRole(currentUserRole);
    const canManageOthers = permissions.includes('telework:manage_any');

    let targetUserId: string;
    if (userId && userId !== currentUserId) {
      if (!canManageOthers) {
        throw new ForbiddenException(
          "Vous n'avez pas la permission de consulter les règles récurrentes d'autrui",
        );
      }
      targetUserId = userId;
    } else {
      // Non-management: only own rules; management without userId: all
      if (!canManageOthers) {
        targetUserId = currentUserId;
      } else {
        targetUserId = userId || '';
      }
    }

    const where: Prisma.TeleworkRecurringRuleWhereInput = {};
    if (targetUserId) {
      where.userId = targetUserId;
    }

    const rules = await this.prisma.teleworkRecurringRule.findMany({
      where,
      orderBy: [{ userId: 'asc' }, { dayOfWeek: 'asc' }, { startDate: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return rules;
  }

  /**
   * Créer une règle récurrente
   */
  async createRecurringRule(
    currentUserId: string,
    currentUserRole: string | null,
    dto: CreateRecurringRuleDto,
  ) {
    const {
      userId: targetUserId,
      dayOfWeek,
      startDate,
      endDate,
      isActive,
    } = dto;

    const resolvedUserId = targetUserId || currentUserId;

    if (resolvedUserId !== currentUserId) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('telework:manage_any')) {
        throw new ForbiddenException(
          "Vous n'avez pas la permission de créer des règles récurrentes pour autrui",
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: resolvedUserId },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const start = new Date(startDate);

    // Check unique constraint (userId, dayOfWeek, startDate)
    const existing = await this.prisma.teleworkRecurringRule.findUnique({
      where: {
        userId_dayOfWeek_startDate: {
          userId: resolvedUserId,
          dayOfWeek,
          startDate: start,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Une règle récurrente existe déjà pour ce jour et cette date de début',
      );
    }

    const rule = await this.prisma.teleworkRecurringRule.create({
      data: {
        userId: resolvedUserId,
        dayOfWeek,
        startDate: start,
        endDate: endDate ? new Date(endDate) : undefined,
        isActive: isActive !== undefined ? isActive : true,
        createdById: currentUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return rule;
  }

  /**
   * Modifier une règle récurrente
   */
  async updateRecurringRule(
    id: string,
    currentUserId: string,
    currentUserRole: string | null,
    dto: UpdateRecurringRuleDto,
  ) {
    const rule = await this.prisma.teleworkRecurringRule.findUnique({
      where: { id },
    });
    if (!rule) {
      throw new NotFoundException('Règle récurrente introuvable');
    }

    if (rule.userId !== currentUserId) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('telework:manage_any')) {
        throw new ForbiddenException(
          "Vous n'avez pas la permission de modifier les règles récurrentes d'autrui",
        );
      }
    }

    const updateData: Prisma.TeleworkRecurringRuleUpdateInput = {};
    if (dto.dayOfWeek !== undefined) updateData.dayOfWeek = dto.dayOfWeek;
    if (dto.startDate !== undefined)
      updateData.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.teleworkRecurringRule.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Supprimer une règle récurrente
   */
  async removeRecurringRule(
    id: string,
    currentUserId: string,
    currentUserRole: string | null,
  ) {
    const rule = await this.prisma.teleworkRecurringRule.findUnique({
      where: { id },
    });
    if (!rule) {
      throw new NotFoundException('Règle récurrente introuvable');
    }

    if (rule.userId !== currentUserId) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('telework:manage_any')) {
        throw new ForbiddenException(
          "Vous n'avez pas la permission de supprimer les règles récurrentes d'autrui",
        );
      }
    }

    await this.prisma.teleworkRecurringRule.delete({ where: { id } });

    return { message: 'Règle récurrente supprimée avec succès' };
  }

  /**
   * Matérialiser les TeleworkSchedules depuis les règles actives pour une plage de dates.
   * Ne crée que les entrées manquantes (skip si déjà existant).
   */
  async generateSchedulesFromRules(
    currentUserId: string,
    currentUserRole: string | null,
    dto: GenerateSchedulesDto,
  ) {
    const permissions =
      await this.permissionsService.getPermissionsForRole(currentUserRole);
    const canManageOthers = permissions.includes('telework:manage_any');

    const start = new Date(dto.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dto.endDate);
    end.setHours(23, 59, 59, 999);

    // Charger les règles actives couvrant la plage
    const where: Prisma.TeleworkRecurringRuleWhereInput = {
      isActive: true,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    };

    // Les non-managers ne peuvent générer que pour eux-mêmes
    if (!canManageOthers) {
      where.userId = currentUserId;
    }

    const rules = await this.prisma.teleworkRecurringRule.findMany({ where });

    // PER-029 / COR-033: Replace N+1 findUnique+create loop with a bulk approach:
    // 1) compute the full expected set in memory (COR-012: day-key space, DST-safe)
    // 2) pre-load existing rows in one findMany
    // 3) insert missing rows via createMany({skipDuplicates:true})
    // This reduces O(R×D) DB round-trips to O(2) and eliminates the TOCTOU P2002 race.

    // COR-012: iterate in day-key space (Europe/Paris) to avoid DST skew.
    // See expandRecurringRulesForRange for the same fix and rationale.
    const expected = new Map<string, { userId: string; dateKey: string }>();
    for (const rule of rules) {
      const ruleStartKey = teleworkDayKey(new Date(rule.startDate));
      const ruleEndKey = rule.endDate
        ? teleworkDayKey(new Date(rule.endDate))
        : null;

      let cursorKey = teleworkDayKey(start);
      const endKey = teleworkDayKey(end);

      while (cursorKey <= endKey) {
        const modelDay = modelDayOfWeekFromKey(cursorKey);

        if (
          modelDay === rule.dayOfWeek &&
          cursorKey >= ruleStartKey &&
          (!ruleEndKey || cursorKey <= ruleEndKey)
        ) {
          const key = `${rule.userId}|${cursorKey}`;
          expected.set(key, { userId: rule.userId, dateKey: cursorKey });
        }

        cursorKey = nextTeleworkDayKey(cursorKey);
      }
    }

    if (expected.size === 0) {
      return {
        message: `Génération terminée : 0 créé(s), 0 ignoré(s) (déjà existant)`,
        created: 0,
        skipped: 0,
        rulesProcessed: rules.length,
      };
    }

    // Pre-load all existing rows for the affected users × date range in one query.
    const affectedUserIds = [...new Set(rules.map((r) => r.userId))];
    const existingRows = await this.prisma.teleworkSchedule.findMany({
      where: {
        userId: { in: affectedUserIds },
        date: {
          gte: dayKeyToUTCDate(teleworkDayKey(start)),
          lte: dayKeyToUTCDate(teleworkDayKey(end)),
        },
      },
      select: { userId: true, date: true },
    });

    const existingSet = new Set<string>(
      existingRows.map((e) => `${e.userId}|${teleworkDayKey(e.date)}`),
    );

    const toCreate = [...expected.values()].filter(
      ({ userId, dateKey }) => !existingSet.has(`${userId}|${dateKey}`),
    );

    if (toCreate.length > 0) {
      await this.prisma.teleworkSchedule.createMany({
        data: toCreate.map(({ userId, dateKey }) => ({
          userId,
          date: dayKeyToUTCDate(dateKey),
          isTelework: true,
          isException: false,
        })),
        skipDuplicates: true,
      });
    }

    const created = toCreate.length;
    const skipped = expected.size - created;

    return {
      message: `Génération terminée : ${created} créé(s), ${skipped} ignoré(s) (déjà existant)`,
      created,
      skipped,
      rulesProcessed: rules.length,
    };
  }

  /**
   * Vue équipe : qui est en télétravail aujourd'hui/une date donnée
   */
  async getTeamSchedule(date?: string, departmentId?: string) {
    // COR-035: use dayKeyToUTCDate via teleworkDayKey to get UTC-midnight for the
    // target date, instead of local setHours(0,0,0,0) which produces wrong UTC
    // instant under non-UTC servers (e.g. Europe/Paris UTC+1/+2).
    const rawDate = date ? new Date(date) : new Date();
    const targetDate = dayKeyToUTCDate(teleworkDayKey(rawDate));

    const where: Prisma.TeleworkScheduleWhereInput = {
      date: targetDate,
      isTelework: true,
    };

    if (departmentId) {
      where.user = {
        departmentId,
      };
    }

    const teleworks = await this.prisma.teleworkSchedule.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
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
        },
      },
    });

    return {
      date: targetDate,
      totalCount: teleworks.length,
      teleworks,
    };
  }
}
