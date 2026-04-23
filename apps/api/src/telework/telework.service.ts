import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { CreateTeleworkDto } from './dto/create-telework.dto';
import { UpdateTeleworkDto } from './dto/update-telework.dto';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';
import { UpdateRecurringRuleDto } from './dto/update-recurring-rule.dto';
import { GenerateSchedulesDto } from './dto/generate-schedules.dto';
import { Prisma } from 'database';

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

    const teleworkDate = new Date(date);

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

    // Auto-expand recurring rules into individual schedules for the requested range
    if (startDate && endDate) {
      await this.expandRecurringRulesForRange(startDate, endDate, userId);
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
   * Expand recurring rules into individual telework_schedule entries for a date range.
   * Called automatically by findAll when startDate/endDate are provided.
   * Creates missing entries only (skips existing).
   */
  private async expandRecurringRulesForRange(
    startDate: string,
    endDate: string,
    filterUserId?: string,
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

    if (filterUserId) {
      ruleWhere.userId = filterUserId;
    }

    const rules = await this.prisma.teleworkRecurringRule.findMany({
      where: ruleWhere,
    });

    for (const rule of rules) {
      const cursor = new Date(start);
      while (cursor <= end) {
        const jsDay = cursor.getDay();
        const modelDay = jsDay === 0 ? 6 : jsDay - 1;

        if (modelDay === rule.dayOfWeek) {
          const ruleStart = new Date(rule.startDate);
          ruleStart.setHours(0, 0, 0, 0);
          const ruleEnd = rule.endDate ? new Date(rule.endDate) : null;
          if (ruleEnd) ruleEnd.setHours(23, 59, 59, 999);

          if (cursor >= ruleStart && (!ruleEnd || cursor <= ruleEnd)) {
            const dateOnly = new Date(cursor);
            dateOnly.setHours(0, 0, 0, 0);

            const existing = await this.prisma.teleworkSchedule.findUnique({
              where: {
                userId_date: {
                  userId: rule.userId,
                  date: dateOnly,
                },
              },
            });

            if (!existing) {
              await this.prisma.teleworkSchedule.create({
                data: {
                  userId: rule.userId,
                  date: dateOnly,
                  isTelework: true,
                  isException: false,
                },
              });
            }
          }
        }

        cursor.setDate(cursor.getDate() + 1);
      }
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

    // Calculer le début et la fin de la semaine (lundi à dimanche)
    const dayOfWeek = referenceDate.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Lundi = début

    const start = new Date(referenceDate);
    start.setDate(referenceDate.getDate() + diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Dimanche
    end.setHours(23, 59, 59, 999);

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

    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);

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
    if (date && date !== existingTelework.date.toISOString().split('T')[0]) {
      const newDate = new Date(date);

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

      updateData.date = new Date(date);
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

    let created = 0;
    let skipped = 0;

    for (const rule of rules) {
      // Parcourir chaque jour de la plage
      const cursor = new Date(start);
      while (cursor <= end) {
        // day 0=Lundi ... 6=Dimanche dans notre modèle
        // JS: getDay() → 0=Dimanche, 1=Lundi, ..., 6=Samedi
        // Conversion: Lundi=1 → model 0, ..., Dimanche=0 → model 6
        const jsDay = cursor.getDay();
        const modelDay = jsDay === 0 ? 6 : jsDay - 1;

        if (modelDay === rule.dayOfWeek) {
          // Vérifier que le jour est dans la plage de la règle
          const ruleStart = new Date(rule.startDate);
          ruleStart.setHours(0, 0, 0, 0);
          const ruleEnd = rule.endDate ? new Date(rule.endDate) : null;
          if (ruleEnd) ruleEnd.setHours(23, 59, 59, 999);

          if (cursor >= ruleStart && (!ruleEnd || cursor <= ruleEnd)) {
            const dateOnly = new Date(cursor);
            dateOnly.setHours(0, 0, 0, 0);

            // Skip si déjà existant
            const existing = await this.prisma.teleworkSchedule.findUnique({
              where: {
                userId_date: {
                  userId: rule.userId,
                  date: dateOnly,
                },
              },
            });

            if (!existing) {
              await this.prisma.teleworkSchedule.create({
                data: {
                  userId: rule.userId,
                  date: dateOnly,
                  isTelework: true,
                  isException: false,
                },
              });
              created++;
            } else {
              skipped++;
            }
          }
        }

        cursor.setDate(cursor.getDate() + 1);
      }
    }

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
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

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
