import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
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

@Injectable()
export class PredefinedTasksService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.predefinedTask.create({
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color,
        icon: dto.icon,
        defaultDuration: dto.defaultDuration,
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
            select: { id: true, name: true, color: true, icon: true },
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
    // Check predefined task exists
    const task = await this.prisma.predefinedTask.findUnique({
      where: { id: dto.predefinedTaskId },
    });
    if (!task || !task.isActive) {
      throw new NotFoundException(
        `Tâche prédéfinie ${dto.predefinedTaskId} introuvable ou inactive`,
      );
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const userId of dto.userIds) {
      for (const dateStr of dto.dates) {
        try {
          await this.prisma.predefinedTaskAssignment.create({
            data: {
              predefinedTaskId: dto.predefinedTaskId,
              userId,
              date: new Date(dateStr),
              period: dto.period,
              assignedById,
              isRecurring: false,
            },
          });
          results.created++;
        } catch (error: unknown) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code: string }).code === 'P2002'
          ) {
            results.skipped++;
          } else {
            results.errors.push(
              `userId=${userId} date=${dateStr}: ${String(error)}`,
            );
          }
        }
      }
    }

    return results;
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
        dayOfWeek: dto.dayOfWeek,
        period: dto.period,
        startDate: new Date(dto.startDate),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        createdById,
        isActive: true,
      },
      include: {
        predefinedTask: {
          select: { id: true, name: true, color: true, icon: true },
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
        ...(dto.dayOfWeek !== undefined && { dayOfWeek: dto.dayOfWeek }),
        ...(dto.period !== undefined && { period: dto.period }),
        ...(dto.startDate !== undefined && {
          startDate: new Date(dto.startDate),
        }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        predefinedTask: {
          select: { id: true, name: true, color: true, icon: true },
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

    // Find all active recurring rules that overlap with the date range
    const rules = await this.prisma.predefinedTaskRecurringRule.findMany({
      where: {
        isActive: true,
        startDate: { lte: rangeEnd },
        OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
      },
    });

    const results = { created: 0, skipped: 0 };

    for (const rule of rules) {
      // Iterate over each day in the range
      const current = new Date(rangeStart);
      while (current <= rangeEnd) {
        // Check if this day matches the rule's dayOfWeek (0=Monday, ..., 6=Sunday)
        // JS getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
        // Our convention: 0=Monday, ..., 6=Sunday
        const jsDayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const ourDayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1; // convert

        if (ourDayOfWeek === rule.dayOfWeek) {
          // Check date is within rule's active window
          const ruleStart = new Date(rule.startDate);
          const ruleEnd = rule.endDate ? new Date(rule.endDate) : null;

          if (current >= ruleStart && (!ruleEnd || current <= ruleEnd)) {
            try {
              await this.prisma.predefinedTaskAssignment.create({
                data: {
                  predefinedTaskId: rule.predefinedTaskId,
                  userId: rule.userId,
                  date: new Date(current),
                  period: rule.period,
                  assignedById,
                  isRecurring: true,
                  recurringRuleId: rule.id,
                },
              });
              results.created++;
            } catch (error: unknown) {
              if (
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                (error as { code: string }).code === 'P2002'
              ) {
                // Already exists — skip
                results.skipped++;
              } else {
                throw error;
              }
            }
          }
        }

        // Advance by one day
        current.setDate(current.getDate() + 1);
      }
    }

    return { ...results, rulesProcessed: rules.length };
  }
}
