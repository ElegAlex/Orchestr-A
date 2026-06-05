import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DayPeriod } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredefinedTaskDto } from './dto/create-predefined-task.dto';
import { UpdatePredefinedTaskDto } from './dto/update-predefined-task.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { BulkAssignmentDto } from './dto/bulk-assignment.dto';
import {
  CreateRecurringRuleDto,
  UpdateRecurringRuleDto,
  GenerateFromRulesDto,
} from './dto/create-recurring-rule.dto';
import { CreateBulkRecurringRulesDto } from './dto/create-bulk-recurring-rules.dto';
import { generateOccurrences, RuleLike } from './occurrence-generator';

@Injectable()
export class PredefinedTasksService {
  constructor(private readonly prisma: PrismaService) {}

  // COR-022: Normalize date strings to UTC midnight to match occurrence-generator.ts
  // convention and avoid TZ ambiguity for date-only strings.
  private toUtcDates(dates: string[]): Date[] {
    return dates.map((d) => {
      const datePart = d.split('T')[0];
      const [y, m, day] = datePart.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, day));
    });
  }

  // COR-021: Accept a Prisma client (or transaction client) so the telework check
  // can run inside the same transaction as the bulk insert (atomic snapshot).
  private async assertTeleworkCompatibilityTx(
    client: {
      teleworkSchedule: {
        findMany(args: object): Promise<Array<{ userId: string; date: Date }>>;
      };
    },
    task: { isTeleworkAllowed: boolean; name: string },
    userIds: string[],
    dates: string[],
  ): Promise<void> {
    if (task.isTeleworkAllowed) return;
    if (userIds.length === 0 || dates.length === 0) return;

    const utcDates = this.toUtcDates(dates);

    const teleworkSchedules = await client.teleworkSchedule.findMany({
      where: {
        userId: { in: userIds },
        date: { in: utcDates },
        isTelework: true,
      },
      select: { userId: true, date: true },
    });

    if (teleworkSchedules.length > 0) {
      const details = teleworkSchedules
        .map(
          (schedule) =>
            `${schedule.userId}:${schedule.date.toISOString().slice(0, 10)}`,
        )
        .join(', ');
      throw new BadRequestException(
        `La tâche "${task.name}" n'est pas réalisable en télétravail. Agents incompatibles : ${details}`,
      );
    }
  }

  private async assertTeleworkCompatibility(
    task: { isTeleworkAllowed: boolean; name: string },
    userIds: string[],
    dates: string[],
  ): Promise<void> {
    return this.assertTeleworkCompatibilityTx(
      this.prisma,
      task,
      userIds,
      dates,
    );
  }

  // ===========================
  // CRUD Tâches Prédéfinies
  // ===========================

  async findAll() {
    return this.prisma.predefinedTask.findMany({
      where: { isActive: true },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { assignments: true, recurringRules: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(createdById: string, dto: CreatePredefinedTaskDto) {
    if (dto.defaultDuration === 'TIME_SLOT') {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          'startTime et endTime sont requis quand defaultDuration est TIME_SLOT',
        );
      }
    }

    const startTime =
      dto.defaultDuration === 'TIME_SLOT' ? dto.startTime : null;
    const endTime = dto.defaultDuration === 'TIME_SLOT' ? dto.endTime : null;

    return this.prisma.predefinedTask.create({
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color,
        icon: dto.icon,
        defaultDuration: dto.defaultDuration,
        startTime,
        endTime,
        isExternalIntervention: dto.isExternalIntervention ?? false,
        isTeleworkAllowed: dto.isTeleworkAllowed ?? true,
        weight: dto.weight ?? 1,
        createdById,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdatePredefinedTaskDto) {
    const existing = await this.prisma.predefinedTask.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Tâche prédéfinie ${id} introuvable`);
    }

    const effectiveDuration = dto.defaultDuration ?? existing.defaultDuration;

    if (effectiveDuration === 'TIME_SLOT') {
      const effectiveStartTime =
        dto.startTime !== undefined ? dto.startTime : existing.startTime;
      const effectiveEndTime =
        dto.endTime !== undefined ? dto.endTime : existing.endTime;
      if (!effectiveStartTime || !effectiveEndTime) {
        throw new BadRequestException(
          'startTime et endTime sont requis quand defaultDuration est TIME_SLOT',
        );
      }
    }

    const timeSlotData: Record<string, string | null> = {};
    if (effectiveDuration === 'TIME_SLOT') {
      if (dto.startTime !== undefined) timeSlotData.startTime = dto.startTime;
      if (dto.endTime !== undefined) timeSlotData.endTime = dto.endTime;
    } else if (dto.defaultDuration !== undefined) {
      // Switching away from TIME_SLOT, nullify time fields
      timeSlotData.startTime = null;
      timeSlotData.endTime = null;
    }

    return this.prisma.predefinedTask.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.defaultDuration !== undefined && {
          defaultDuration: dto.defaultDuration,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isExternalIntervention !== undefined && {
          isExternalIntervention: dto.isExternalIntervention,
        }),
        ...(dto.isTeleworkAllowed !== undefined && {
          isTeleworkAllowed: dto.isTeleworkAllowed,
        }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...timeSlotData,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.predefinedTask.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Tâche prédéfinie ${id} introuvable`);
    }

    return this.prisma.predefinedTask.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ===========================
  // Assignations
  // ===========================

  async findAssignments(filters: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    predefinedTaskId?: string;
  }) {
    return this.prisma.predefinedTaskAssignment.findMany({
      where: {
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.predefinedTaskId && {
          predefinedTaskId: filters.predefinedTaskId,
        }),
        ...(filters.startDate || filters.endDate
          ? {
              date: {
                ...(filters.startDate && { gte: new Date(filters.startDate) }),
                ...(filters.endDate && { lte: new Date(filters.endDate) }),
              },
            }
          : {}),
      },
      include: {
        predefinedTask: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            defaultDuration: true,
            startTime: true,
            endTime: true,
            isExternalIntervention: true,
            isTeleworkAllowed: true,
            weight: true,
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ date: 'asc' }, { period: 'asc' }],
    });
  }

  async createAssignment(assignedById: string, dto: CreateAssignmentDto) {
    // Check predefined task exists
    const task = await this.prisma.predefinedTask.findUnique({
      where: { id: dto.predefinedTaskId },
    });
    if (!task || !task.isActive) {
      throw new NotFoundException(
        `Tâche prédéfinie ${dto.predefinedTaskId} introuvable ou inactive`,
      );
    }
    await this.assertTeleworkCompatibility(task, [dto.userId], [dto.date]);

    try {
      return await this.prisma.predefinedTaskAssignment.create({
        data: {
          predefinedTaskId: dto.predefinedTaskId,
          userId: dto.userId,
          date: new Date(dto.date),
          period: dto.period,
          assignedById,
          isRecurring: false,
        },
        include: {
          predefinedTask: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
              isTeleworkAllowed: true,
            },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          assignedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'Une assignation existe déjà pour cet utilisateur, cette tâche, cette date et cette période',
        );
      }
      throw error;
    }
  }

  async createBulkAssignment(assignedById: string, dto: BulkAssignmentDto) {
    // Check predefined task exists (outside transaction — read-only, cheap)
    const task = await this.prisma.predefinedTask.findUnique({
      where: { id: dto.predefinedTaskId },
    });
    if (!task || !task.isActive) {
      throw new NotFoundException(
        `Tâche prédéfinie ${dto.predefinedTaskId} introuvable ou inactive`,
      );
    }

    // COR-021 + PER-012: wrap telework check + batch insert in a single transaction
    // so the snapshot and writes are atomic (eliminates TOCTOU race).
    // PER-012: build all pairs in memory then call createMany once (skipDuplicates).
    const totalPairs = dto.userIds.length * dto.dates.length;

    const { count } = await this.prisma.$transaction(async (tx) => {
      // Re-run telework check inside the transaction for atomicity (COR-021)
      await this.assertTeleworkCompatibilityTx(
        tx,
        task,
        dto.userIds,
        dto.dates,
      );

      const allPairs = dto.userIds.flatMap((userId) =>
        dto.dates.map((dateStr) => {
          const datePart = dateStr.split('T')[0];
          const [y, m, day] = datePart.split('-').map(Number);
          return {
            predefinedTaskId: dto.predefinedTaskId,
            userId,
            date: new Date(Date.UTC(y, m - 1, day)),
            period: dto.period,
            assignedById,
            isRecurring: false as const,
          };
        }),
      );

      return tx.predefinedTaskAssignment.createMany({
        data: allPairs,
        skipDuplicates: true,
      });
    });

    return {
      created: count,
      skipped: totalPairs - count,
      errors: [] as string[],
    };
  }

  async removeAssignment(id: string) {
    const existing = await this.prisma.predefinedTaskAssignment.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Assignation ${id} introuvable`);
    }

    await this.prisma.predefinedTaskAssignment.delete({ where: { id } });
    return { message: 'Assignation supprimée' };
  }

  // ===========================
  // Règles Récurrentes
  // ===========================

  async findRecurringRules(filters: {
    userId?: string;
    predefinedTaskId?: string;
  }) {
    return this.prisma.predefinedTaskRecurringRule.findMany({
      where: {
        isActive: true,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.predefinedTaskId && {
          predefinedTaskId: filters.predefinedTaskId,
        }),
      },
      include: {
        predefinedTask: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            defaultDuration: true,
            startTime: true,
            endTime: true,
            isExternalIntervention: true,
            isTeleworkAllowed: true,
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ userId: 'asc' }, { dayOfWeek: 'asc' }],
    });
  }

  async createRecurringRule(createdById: string, dto: CreateRecurringRuleDto) {
    const task = await this.prisma.predefinedTask.findUnique({
      where: { id: dto.predefinedTaskId },
    });
    if (!task || !task.isActive) {
      throw new NotFoundException(
        `Tâche prédéfinie ${dto.predefinedTaskId} introuvable ou inactive`,
      );
    }

    return this.prisma.predefinedTaskRecurringRule.create({
      data: {
        predefinedTaskId: dto.predefinedTaskId,
        userId: dto.userId,
        recurrenceType: dto.recurrenceType ?? 'WEEKLY',
        dayOfWeek: dto.dayOfWeek ?? null,
        monthlyOrdinal: dto.monthlyOrdinal ?? null,
        monthlyDayOfMonth: dto.monthlyDayOfMonth ?? null,
        period: dto.period,
        weekInterval: dto.weekInterval ?? 1,
        startDate: new Date(dto.startDate),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        createdById,
        isActive: true,
      },
      include: {
        predefinedTask: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            isTeleworkAllowed: true,
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async bulkCreateRecurringRules(
    createdById: string,
    dto: CreateBulkRecurringRulesDto,
  ) {
    const task = await this.prisma.predefinedTask.findUnique({
      where: { id: dto.predefinedTaskId },
    });
    if (!task || !task.isActive) {
      throw new NotFoundException(
        `Tâche prédéfinie ${dto.predefinedTaskId} introuvable ou inactive`,
      );
    }

    const weekInterval = dto.weekInterval ?? 1;

    // PER-013: Build all (user × dayOfWeek) pairs in memory, then createMany once.
    // Prisma 6 createMany does not support include, so fetch records with findMany after.
    const allRuleData = dto.userIds.flatMap((userId) =>
      dto.daysOfWeek.map((dayOfWeek) => ({
        predefinedTaskId: dto.predefinedTaskId,
        userId,
        dayOfWeek,
        period: dto.period,
        weekInterval,
        startDate: new Date(dto.startDate),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        createdById,
        isActive: true,
      })),
    );

    const rules = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.predefinedTaskRecurringRule.createMany({
        data: allRuleData,
      });

      if (count === 0) return [];

      // Fetch created records with full includes (createMany has no include support)
      return tx.predefinedTaskRecurringRule.findMany({
        where: {
          predefinedTaskId: dto.predefinedTaskId,
          createdById,
          isActive: true,
          userId: { in: dto.userIds },
          dayOfWeek: { in: dto.daysOfWeek },
        },
        include: {
          predefinedTask: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
              isTeleworkAllowed: true,
            },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: [{ userId: 'asc' }, { dayOfWeek: 'asc' }],
      });
    });

    return { created: allRuleData.length, rules };
  }

  async updateRecurringRule(id: string, dto: UpdateRecurringRuleDto) {
    const existing = await this.prisma.predefinedTaskRecurringRule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Règle récurrente ${id} introuvable`);
    }

    return this.prisma.predefinedTaskRecurringRule.update({
      where: { id },
      data: {
        ...(dto.recurrenceType !== undefined && {
          recurrenceType: dto.recurrenceType,
        }),
        ...(dto.dayOfWeek !== undefined && { dayOfWeek: dto.dayOfWeek }),
        ...(dto.monthlyOrdinal !== undefined && {
          monthlyOrdinal: dto.monthlyOrdinal,
        }),
        ...(dto.monthlyDayOfMonth !== undefined && {
          monthlyDayOfMonth: dto.monthlyDayOfMonth,
        }),
        ...(dto.period !== undefined && { period: dto.period }),
        ...(dto.weekInterval !== undefined && {
          weekInterval: dto.weekInterval,
        }),
        ...(dto.startDate !== undefined && {
          startDate: new Date(dto.startDate),
        }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        predefinedTask: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            isTeleworkAllowed: true,
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async removeRecurringRule(id: string) {
    const existing = await this.prisma.predefinedTaskRecurringRule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Règle récurrente ${id} introuvable`);
    }

    await this.prisma.predefinedTaskRecurringRule.delete({ where: { id } });
    return { message: 'Règle récurrente supprimée' };
  }

  async generateFromRules(assignedById: string, dto: GenerateFromRulesDto) {
    const rangeStart = new Date(dto.startDate);
    const rangeEnd = new Date(dto.endDate);

    const rules = await this.prisma.predefinedTaskRecurringRule.findMany({
      where: {
        isActive: true,
        startDate: { lte: rangeEnd },
        OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
      },
    });

    // PER-014: Collect all (rule, date) pairs across all rules into one array,
    // then issue a single createMany (skipDuplicates) instead of O(R*D) inserts.
    const allPairs: Array<{
      predefinedTaskId: string;
      userId: string;
      date: Date;
      period: DayPeriod;
      assignedById: string;
      isRecurring: boolean;
      recurringRuleId: string;
    }> = [];

    for (const rule of rules) {
      const ruleLike: RuleLike = {
        id: rule.id,
        recurrenceType: (rule.recurrenceType ?? 'WEEKLY') as
          | 'WEEKLY'
          | 'MONTHLY_ORDINAL'
          | 'MONTHLY_DAY',
        dayOfWeek: rule.dayOfWeek,
        weekInterval: rule.weekInterval ?? 1,
        monthlyOrdinal: rule.monthlyOrdinal,
        monthlyDayOfMonth: rule.monthlyDayOfMonth,
        startDate: rule.startDate,
        endDate: rule.endDate ?? null,
        isActive: rule.isActive,
      };

      const dates = generateOccurrences(ruleLike, rangeStart, rangeEnd);

      for (const date of dates) {
        allPairs.push({
          predefinedTaskId: rule.predefinedTaskId,
          userId: rule.userId,
          date,
          period: rule.period,
          assignedById,
          isRecurring: true,
          recurringRuleId: rule.id,
        });
      }
    }

    if (allPairs.length === 0) {
      return { created: 0, skipped: 0, rulesProcessed: rules.length };
    }

    const { count } = await this.prisma.predefinedTaskAssignment.createMany({
      data: allPairs,
      skipDuplicates: true,
    });

    return {
      created: count,
      skipped: allPairs.length - count,
      rulesProcessed: rules.length,
    };
  }
}
