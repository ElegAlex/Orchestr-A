import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
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
import { CreateBulkRecurringRulesDto } from './dto/create-bulk-recurring-rules.dto';
import {
  generateOccurrences,
  RuleLike,
} from './occurrence-generator';
import { UpdateCompletionStatusDto } from './dto/update-completion-status.dto';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { PermissionsService } from '../rbac/permissions.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import type { PredefinedTaskAssignment } from 'database';
import { PlanningBalancerService } from './planning-balancer.service';
import type { BalancerOccurrence } from './planning-balancer.types';
import { LeavesService } from '../leaves/leaves.service';
import { GenerateBalancedDto, GenerateBalancedResult } from './dto/generate-balanced.dto';

/**
 * Transitions de statut autorisées pour les assignations de tâches prédéfinies.
 * Fonction pure exportée pour réutilisation dans planning.service.ts.
 */
export function isValidTransition(before: string, after: string): boolean {
  const transitions: Record<string, string[]> = {
    NOT_DONE: ['IN_PROGRESS', 'DONE', 'NOT_APPLICABLE'],
    IN_PROGRESS: ['DONE', 'NOT_APPLICABLE'],
    DONE: ['NOT_APPLICABLE', 'NOT_DONE'],
    NOT_APPLICABLE: ['NOT_DONE'],
  };
  return transitions[before]?.includes(after) ?? false;
}

/**
 * Vérifie si un utilisateur peut mettre à jour le statut d'une assignation.
 * Fonction pure exportée pour réutilisation dans planning.service.ts
 * (calcul de canUpdateStatus côté API computed flags).
 */
export function canUpdateAssignmentStatus(
  assignmentUserId: string,
  currentUserId: string,
  permissions: readonly string[],
  managedUserIds: Set<string> | 'all',
): boolean {
  const isOwn = assignmentUserId === currentUserId;
  const hasOwnPerm = permissions.includes('predefined_tasks:update-own-status');
  const hasAnyPerm = permissions.includes('predefined_tasks:update-any-status');

  if (isOwn) return hasOwnPerm;

  if (!hasAnyPerm) return false;

  if (managedUserIds === 'all') return true;
  return managedUserIds.has(assignmentUserId);
}

@Injectable()
export class PredefinedTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditPersistence: AuditPersistenceService,
    private readonly permissionsService: PermissionsService,
    private readonly planningBalancer: PlanningBalancerService,
    private readonly leavesService: LeavesService,
  ) {}

  /**
   * Résout le périmètre de gestion d'un utilisateur :
   * services managés (managerId) + services membres (user_services) → Set<userId>.
   *
   * NOTE: logique dupliquée de LeavesService.getManagedUserIds (privé, non partagé).
   * TODO: extraire dans un helper RBAC partagé (packages/rbac ou apps/api/src/rbac/helpers/).
   */
  private async getManagedUserIds(
    currentUserId: string,
  ): Promise<Set<string>> {
    const managedServices = await this.prisma.service.findMany({
      where: { managerId: currentUserId },
      select: { id: true },
    });
    const userServices = await this.prisma.userService.findMany({
      where: { userId: currentUserId },
      select: { serviceId: true },
    });

    const serviceIds = [
      ...new Set([
        ...managedServices.map((s) => s.id),
        ...userServices.map((us) => us.serviceId),
      ]),
    ];

    if (serviceIds.length === 0) return new Set<string>();

    const usersInServices = await this.prisma.userService.findMany({
      where: { serviceId: { in: serviceIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    return new Set(usersInServices.map((us) => us.userId));
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

  /**
   * Résout le périmètre de gestion d'un utilisateur (wrapper public de
   * `getManagedUserIds` pour réutilisation depuis PlanningService — W2.5).
   */
  async resolveManagedUserIds(currentUserId: string): Promise<Set<string>> {
    return this.getManagedUserIds(currentUserId);
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
            startTime: true,
            endTime: true,
            isExternalIntervention: true,
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
    const rules = await this.prisma.$transaction(async (tx) => {
      const created: any[] = [];
      for (const userId of dto.userIds) {
        for (const dayOfWeek of dto.daysOfWeek) {
          const rule = await tx.predefinedTaskRecurringRule.create({
            data: {
              predefinedTaskId: dto.predefinedTaskId,
              userId,
              dayOfWeek,
              period: dto.period,
              weekInterval,
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
          created.push(rule);
        }
      }
      return created;
    });

    return { created: rules.length, rules };
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

    const rules = await this.prisma.predefinedTaskRecurringRule.findMany({
      where: {
        isActive: true,
        startDate: { lte: rangeEnd },
        OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
      },
    });

    const results = { created: 0, skipped: 0 };

    for (const rule of rules) {
      // Adapter Prisma record → RuleLike interface
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
        try {
          await this.prisma.predefinedTaskAssignment.create({
            data: {
              predefinedTaskId: rule.predefinedTaskId,
              userId: rule.userId,
              date,
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
            results.skipped++;
          } else {
            throw error;
          }
        }
      }
    }

    return { ...results, rulesProcessed: rules.length };
  }

  // ===========================
  // Génération équilibrée (W3.2)
  // ===========================

  /**
   * Orchestre PlanningBalancerService pour générer des assignations équilibrées
   * à partir des règles récurrentes actives sur une plage donnée.
   *
   * Mode preview : retourne le plan sans écriture DB.
   * Mode apply   : crée transactionnellement les assignations (idempotence via skipDuplicates)
   *                et persiste un audit log BALANCER_APPLIED.
   */
  async generateBalanced(
    dto: GenerateBalancedDto,
    currentUser: AuthenticatedUser,
  ): Promise<GenerateBalancedResult> {
    // ── 1. Résolution du périmètre user ──────────────────────────────────────

    if (!dto.serviceId && (!dto.userIds || dto.userIds.length === 0)) {
      throw new BadRequestException(
        'Au moins un serviceId ou userIds doit être fourni',
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    let userIds: string[];

    if (dto.serviceId && dto.userIds && dto.userIds.length > 0) {
      // Intersection : membres du service ∩ userIds fournis
      const membersInService = await this.prisma.userService.findMany({
        where: { serviceId: dto.serviceId },
        select: { userId: true },
      });
      const memberSet = new Set(membersInService.map((m) => m.userId));
      userIds = dto.userIds.filter((id) => memberSet.has(id));
    } else if (dto.serviceId) {
      const membersInService = await this.prisma.userService.findMany({
        where: { serviceId: dto.serviceId },
        select: { userId: true },
      });
      userIds = membersInService.map((m) => m.userId);
    } else {
      userIds = dto.userIds!;
    }

    // ── RBAC scope : si pas de projects:manage_any → vérifier périmètre ─────
    const permissions = await this.permissionsService.getPermissionsForRole(
      currentUser.role?.code,
    );
    if (!permissions.includes('projects:manage_any')) {
      const managedUserIds = await this.getManagedUserIds(currentUser.id);
      const outsideScope = userIds.filter((id) => !managedUserIds.has(id));
      if (outsideScope.length > 0) {
        throw new ForbiddenException(
          'Certains utilisateurs sont hors de votre périmètre de gestion',
        );
      }
    }

    // ── 2. Charger les tâches actives ─────────────────────────────────────────
    const tasks = await this.prisma.predefinedTask.findMany({
      where: { id: { in: dto.taskIds }, isActive: true },
    });

    if (tasks.length !== dto.taskIds.length) {
      const foundIds = new Set(tasks.map((t) => t.id));
      const missingIds = dto.taskIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Tâches introuvables ou inactives : ${missingIds.join(', ')}`,
      );
    }

    // ── 3. Charger les règles récurrentes actives ─────────────────────────────
    const rules = await this.prisma.predefinedTaskRecurringRule.findMany({
      where: {
        predefinedTaskId: { in: dto.taskIds },
        userId: { in: userIds },
        isActive: true,
        startDate: { lte: endDate },
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
    });

    // ── 4. Matérialiser les occurrences ───────────────────────────────────────
    const taskWeightMap = new Map(tasks.map((t) => [t.id, t.weight]));

    const occurrences: BalancerOccurrence[] = [];
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

      const dates = generateOccurrences(ruleLike, startDate, endDate);
      const weight = taskWeightMap.get(rule.predefinedTaskId) ?? 1;

      for (const date of dates) {
        occurrences.push({
          taskId: rule.predefinedTaskId,
          weight,
          date,
          period: rule.period as 'MORNING' | 'AFTERNOON' | 'FULL_DAY',
        });
      }
    }

    // ── 5. Charger les absences approuvées ───────────────────────────────────
    const rawLeavesResult = await this.leavesService.findAll(
      1,
      1000,
      undefined,
      'APPROVED' as any,
      undefined,
      dto.startDate,
      dto.endDate,
    );
    // findAll retourne un tableau brut quand startDate/endDate est fourni
    const rawLeaves: any[] = Array.isArray(rawLeavesResult)
      ? rawLeavesResult
      : (rawLeavesResult as any).data ?? [];

    const userIdSet = new Set(userIds);
    const absencesMap = new Map<string, Array<{ startDate: Date; endDate: Date }>>();
    for (const userId of userIds) {
      absencesMap.set(userId, []);
    }
    for (const leave of rawLeaves) {
      if (leave.userId && userIdSet.has(leave.userId)) {
        absencesMap.get(leave.userId)!.push({
          startDate: new Date(leave.startDate),
          endDate: new Date(leave.endDate),
        });
      }
    }

    // ── 6. Skills — V1 non câblé ────────────────────────────────────────────
    // V2: intégrer PredefinedTask.requiredSkills

    // ── 7. Appel du balancer ─────────────────────────────────────────────────
    const agents = userIds.map((userId) => ({ userId }));
    const output = this.planningBalancer.balance({
      occurrences,
      agents,
      absences: absencesMap,
      taskRequiredSkills: undefined,
    });

    // ── 8. Mode preview ──────────────────────────────────────────────────────
    if (dto.mode === 'preview') {
      return {
        mode: 'preview',
        ...output,
        assignmentsCreated: 0,
      };
    }

    // ── 9. Mode apply ────────────────────────────────────────────────────────
    const count = await this.prisma.$transaction(async (tx) => {
      const result = await (tx as any).predefinedTaskAssignment.createMany({
        data: output.proposedAssignments.map((a) => ({
          predefinedTaskId: a.taskId,
          userId: a.userId,
          date: a.date,
          period: a.period,
          assignedById: currentUser.id,
          isRecurring: false,
        })),
        skipDuplicates: true,
      });

      await this.auditPersistence.log({
        action: 'BALANCER_APPLIED',
        entityType: 'PredefinedTaskRange',
        entityId: `${dto.startDate}_${dto.endDate}`,
        actorId: currentUser.id,
        payload: {
          range: { startDate: dto.startDate, endDate: dto.endDate },
          taskIds: dto.taskIds,
          userIds,
          assignmentsProposed: output.proposedAssignments.length,
          assignmentsCreated: result.count,
          equityRatio: output.equityRatio,
        },
      });

      return result.count;
    });

    return {
      mode: 'apply',
      ...output,
      assignmentsCreated: count,
    };
  }

  // ===========================
  // Completion Status
  // ===========================

  async updateCompletionStatus(
    assignmentId: string,
    dto: UpdateCompletionStatusDto,
    currentUser: AuthenticatedUser,
  ): Promise<PredefinedTaskAssignment> {
    // 1. Charger l'assignation
    const assignment = await this.prisma.predefinedTaskAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException(`Assignation ${assignmentId} introuvable`);
    }

    // 2. Vérifier les permissions
    const permissions = await this.permissionsService.getPermissionsForRole(
      currentUser.role?.code,
    );
    const hasAnyPerm = permissions.includes('predefined_tasks:update-any-status');
    // Résolution du périmètre uniquement si nécessaire (optimisation + sécurité)
    const managedUserIds: Set<string> | 'all' = hasAnyPerm
      ? await this.getManagedUserIds(currentUser.id)
      : new Set<string>();
    const allowed = canUpdateAssignmentStatus(
      assignment.userId,
      currentUser.id,
      permissions,
      managedUserIds,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Vous ne disposez pas des droits pour modifier le statut de cette assignation',
      );
    }

    // 3. Valider la transition
    if (!isValidTransition(assignment.completionStatus, dto.status)) {
      throw new ConflictException(
        `Transition ${assignment.completionStatus} → ${dto.status} non autorisée`,
      );
    }

    // 4. Mettre à jour en transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.predefinedTaskAssignment.update({
        where: { id: assignmentId },
        data: {
          completionStatus: dto.status,
          completedAt: dto.status === 'DONE' ? new Date() : null,
          completedById: dto.status === 'DONE' ? currentUser.id : null,
          notApplicableReason:
            dto.status === 'NOT_APPLICABLE' ? dto.reason ?? null : null,
        },
      });
    });

    // 5. Persister l'audit log (hors transaction — acceptable pour un log de statut)
    await this.auditPersistence.log({
      action: 'ASSIGNMENT_STATUS_CHANGED',
      entityType: 'PredefinedTaskAssignment',
      entityId: assignmentId,
      actorId: currentUser.id,
      payload: {
        before: assignment.completionStatus,
        after: dto.status,
        reason: dto.reason ?? null,
      },
    });

    return updated as PredefinedTaskAssignment;
  }
}
