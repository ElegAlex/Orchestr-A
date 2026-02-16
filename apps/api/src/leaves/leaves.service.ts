import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { LeaveStatus, LeaveType, Role, Prisma } from 'database';

@Injectable()
export class LeavesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer une nouvelle demande de congé
   */
  async create(userId: string, createLeaveDto: CreateLeaveDto) {
    const {
      leaveTypeId,
      type,
      startDate,
      endDate,
      halfDay,
      startHalfDay,
      endHalfDay,
      reason,
    } = createLeaveDto;
    const effectiveHalfDay = halfDay || startHalfDay;

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier que le type de congé existe et est actif
    const leaveTypeConfig = await this.prisma.leaveTypeConfig.findUnique({
      where: { id: leaveTypeId },
    });

    if (!leaveTypeConfig) {
      throw new NotFoundException('Type de congé introuvable');
    }

    if (!leaveTypeConfig.isActive) {
      throw new BadRequestException("Ce type de congé n'est plus disponible");
    }

    // Vérifier que la date de fin est après la date de début
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      throw new BadRequestException(
        'La date de fin doit être postérieure ou égale à la date de début',
      );
    }

    // Calculer le nombre de jours
    const days = this.calculateLeaveDays(start, end, effectiveHalfDay, endHalfDay);

    // Vérifier les chevauchements
    const hasOverlap = await this.checkOverlap(userId, start, end);

    if (hasOverlap) {
      throw new ConflictException(
        'Cette demande chevauche une demande de congé existante',
      );
    }

    // Vérifier le solde pour les congés payés (code CP)
    if (leaveTypeConfig.code === 'CP') {
      const balance = await this.getLeaveBalance(userId);

      if (balance.available < days) {
        throw new BadRequestException(
          `Solde de congés insuffisant. Disponible: ${balance.available} jours, Demandé: ${days} jours`,
        );
      }
    }

    // Vérifier la limite annuelle si définie
    if (leaveTypeConfig.maxDaysPerYear) {
      const usedDays = await this.getUsedDaysForType(userId, leaveTypeId);
      if (usedDays + days > leaveTypeConfig.maxDaysPerYear) {
        throw new BadRequestException(
          `Limite annuelle dépassée pour ${leaveTypeConfig.name}. Disponible: ${leaveTypeConfig.maxDaysPerYear - usedDays} jours, Demandé: ${days} jours`,
        );
      }
    }

    // Trouver le validateur approprié (manager du département ou délégué actif)
    const validatorId = leaveTypeConfig.requiresApproval
      ? await this.findValidatorForUser(userId)
      : null;

    // Statut initial selon si validation requise
    const initialStatus = leaveTypeConfig.requiresApproval
      ? LeaveStatus.PENDING
      : LeaveStatus.APPROVED;

    // Déterminer le type enum à utiliser (pour rétrocompatibilité)
    // Si le code correspond à un type enum existant, l'utiliser, sinon utiliser OTHER
    const validEnumTypes = Object.values(LeaveType);
    const enumType =
      type ||
      (validEnumTypes.includes(leaveTypeConfig.code as LeaveType)
        ? (leaveTypeConfig.code as LeaveType)
        : LeaveType.OTHER);

    // Créer la demande de congé
    const leave = await this.prisma.leave.create({
      data: {
        userId,
        leaveTypeId,
        type: enumType,
        startDate: start,
        endDate: end,
        halfDay: effectiveHalfDay || undefined,
        days,
        comment: reason,
        status: initialStatus,
        validatorId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        leaveType: true,
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return leave;
  }

  /**
   * Récupérer le nombre de jours utilisés pour un type de congé cette année
   */
  private async getUsedDaysForType(
    userId: string,
    leaveTypeId: string,
  ): Promise<number> {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    const leaves = await this.prisma.leave.findMany({
      where: {
        userId,
        leaveTypeId,
        status: { in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] },
        startDate: { gte: yearStart, lte: yearEnd },
      },
    });

    return leaves.reduce((sum, l) => sum + l.days, 0);
  }

  /**
   * Trouver le validateur approprié pour un utilisateur
   */
  private async findValidatorForUser(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: {
          include: {
            manager: true,
          },
        },
      },
    });

    if (!user) return null;

    // Chercher d'abord un délégué actif
    const today = new Date();
    const activeDelegate = await this.prisma.leaveValidationDelegate.findFirst({
      where: {
        delegator: {
          OR: [{ role: Role.MANAGER }, { role: Role.RESPONSABLE }],
        },
        isActive: true,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        delegate: true,
      },
    });

    if (activeDelegate) {
      return activeDelegate.delegateId;
    }

    // Sinon, utiliser le manager du département
    if (user.department?.managerId) {
      return user.department.managerId;
    }

    // En dernier recours, chercher un responsable ou admin
    const validator = await this.prisma.user.findFirst({
      where: {
        role: { in: [Role.RESPONSABLE, Role.ADMIN] },
        isActive: true,
        id: { not: userId }, // Ne pas s'auto-valider
      },
    });

    return validator?.id || null;
  }

  /**
   * Récupérer toutes les demandes de congé avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 10,
    userId?: string,
    status?: LeaveStatus,
    type?: LeaveType,
    startDate?: string,
    endDate?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.LeaveWhereInput = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (type) where.type = type;

    // Filtrer par plage de dates (congés qui chevauchent la période demandée)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // Un congé chevauche la période si: leave.startDate <= endDate ET leave.endDate >= startDate
      where.AND = [{ startDate: { lte: end } }, { endDate: { gte: start } }];
    } else if (startDate) {
      where.endDate = { gte: new Date(startDate) };
    } else if (endDate) {
      where.startDate = { lte: new Date(endDate) };
    }

    const [leaves, total] = await Promise.all([
      this.prisma.leave.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          leaveType: true,
          validator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          validatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
      }),
      this.prisma.leave.count({ where }),
    ]);

    // Si on filtre par dates, retourner directement un tableau pour la compatibilité avec le planning
    if (startDate || endDate) {
      return leaves;
    }

    return {
      data: leaves,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupérer les demandes de congé en attente de validation pour un validateur
   */
  async getPendingForValidator(validatorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: validatorId },
    });

    if (!user) {
      return [];
    }

    // ADMIN → all pending leaves
    if (user.role === Role.ADMIN) {
      return this.prisma.leave.findMany({
        where: {
          status: LeaveStatus.PENDING,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          validator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    }

    // RESPONSABLE or MANAGER → pending leaves from same services + managed services
    if (user.role === Role.RESPONSABLE || user.role === Role.MANAGER) {
      // 1. Find services the user belongs to via user_services
      const userServices = await this.prisma.userService.findMany({
        where: { userId: validatorId },
        select: { serviceId: true },
      });

      // 2. Find services where user is manager
      const managedServices = await this.prisma.service.findMany({
        where: { managerId: validatorId },
        select: { id: true },
      });

      // Combine service IDs
      const serviceIds = [
        ...userServices.map((us) => us.serviceId),
        ...managedServices.map((s) => s.id),
      ];

      // If no services, return empty array
      if (serviceIds.length === 0) {
        return [];
      }

      // 3. Find all users in those services
      const usersInServices = await this.prisma.userService.findMany({
        where: {
          serviceId: { in: serviceIds },
        },
        select: { userId: true },
      });

      const userIds = usersInServices.map((us) => us.userId);

      // 4. Query pending leaves for those users
      return this.prisma.leave.findMany({
        where: {
          status: LeaveStatus.PENDING,
          userId: { in: userIds },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          validator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    }

    // Other roles → empty list
    return [];
  }

  /**
   * Récupérer les demandes de congé d'un utilisateur
   */
  async getUserLeaves(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const leaves = await this.prisma.leave.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        validatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return leaves;
  }

  /**
   * Récupérer une demande de congé par ID
   */
  async findOne(id: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
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
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        validatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    return leave;
  }

  /**
   * Mettre à jour une demande de congé
   */
  async update(id: string, updateLeaveDto: UpdateLeaveDto) {
    const existingLeave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!existingLeave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    // Seules les demandes en attente peuvent être modifiées
    if (existingLeave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Seules les demandes en attente peuvent être modifiées',
      );
    }

    const { type, startDate, endDate, halfDay, startHalfDay, endHalfDay, reason } =
      updateLeaveDto;
    const effectiveHalfDay = halfDay || startHalfDay;

    // Recalculer les jours si les dates changent
    const start = startDate ? new Date(startDate) : existingLeave.startDate;
    const end = endDate ? new Date(endDate) : existingLeave.endDate;

    if (end < start) {
      throw new BadRequestException(
        'La date de fin doit être postérieure ou égale à la date de début',
      );
    }

    const days = this.calculateLeaveDays(
      start,
      end,
      effectiveHalfDay ?? existingLeave.halfDay,
      undefined,
    );

    // Vérifier les chevauchements (exclure la demande actuelle)
    if (startDate || endDate) {
      const hasOverlap = await this.checkOverlap(
        existingLeave.userId,
        start,
        end,
        id,
      );

      if (hasOverlap) {
        throw new ConflictException(
          'Cette modification créerait un chevauchement avec une autre demande',
        );
      }
    }

    // Vérifier le solde si c'est un congé payé
    const leaveType = type ?? existingLeave.type;
    if (leaveType === LeaveType.CP) {
      const balance = await this.getLeaveBalance(existingLeave.userId);
      const currentDays = existingLeave.days;
      const newDays = days;
      const additionalDays = newDays - currentDays;

      if (balance.available < additionalDays) {
        throw new BadRequestException(
          `Solde de congés insuffisant. Disponible: ${balance.available} jours, Demandé en plus: ${additionalDays} jours`,
        );
      }
    }

    const leave = await this.prisma.leave.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(startDate && { startDate: start }),
        ...(endDate && { endDate: end }),
        ...(effectiveHalfDay && { halfDay: effectiveHalfDay }),
        ...(reason !== undefined && { comment: reason }),
        days,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return leave;
  }

  /**
   * Supprimer une demande de congé
   */
  async remove(id: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    // Seules les demandes en attente ou refusées peuvent être supprimées
    if (
      leave.status !== LeaveStatus.PENDING &&
      leave.status !== LeaveStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Seules les demandes en attente ou refusées peuvent être supprimées',
      );
    }

    await this.prisma.leave.delete({
      where: { id },
    });

    return { message: 'Demande de congé supprimée avec succès' };
  }

  /**
   * Vérifier si l'utilisateur peut valider une demande
   */
  async canValidate(leaveId: string, validatorId: string): Promise<boolean> {
    const leave = await this.prisma.leave.findUnique({
      where: { id: leaveId },
    });

    if (!leave) return false;

    const validator = await this.prisma.user.findUnique({
      where: { id: validatorId },
    });

    if (!validator) return false;

    // ADMIN et RESPONSABLE peuvent tout valider
    if (validator.role === Role.ADMIN || validator.role === Role.RESPONSABLE) {
      return true;
    }

    // Le validateur assigné peut valider
    if (leave.validatorId === validatorId) {
      return true;
    }

    // MANAGER peut valider les congés des agents de ses services
    if (validator.role === Role.MANAGER) {
      const userServices = await this.prisma.userService.findMany({
        where: { userId: validatorId },
        select: { serviceId: true },
      });
      const managedServices = await this.prisma.service.findMany({
        where: { managerId: validatorId },
        select: { id: true },
      });
      const serviceIds = [
        ...new Set([
          ...userServices.map((us) => us.serviceId),
          ...managedServices.map((s) => s.id),
        ]),
      ];

      if (serviceIds.length > 0) {
        const leaveUserService = await this.prisma.userService.findFirst({
          where: {
            userId: leave.userId,
            serviceId: { in: serviceIds },
          },
        });
        if (leaveUserService) return true;
      }
    }

    // Vérifier les délégations actives
    const today = new Date();
    const activeDelegation =
      await this.prisma.leaveValidationDelegate.findFirst({
        where: {
          delegateId: validatorId,
          isActive: true,
          startDate: { lte: today },
          endDate: { gte: today },
        },
      });

    return activeDelegation !== null;
  }

  /**
   * Approuver une demande de congé
   */
  async approve(id: string, validatorId: string, comment?: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Seules les demandes en attente peuvent être approuvées',
      );
    }

    // Vérifier les droits de validation
    const canValidateLeave = await this.canValidate(id, validatorId);
    if (!canValidateLeave) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à valider cette demande",
      );
    }

    const updatedLeave = await this.prisma.leave.update({
      where: { id },
      data: {
        status: LeaveStatus.APPROVED,
        validatedById: validatorId,
        validatedAt: new Date(),
        validationComment: comment,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        validatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updatedLeave;
  }

  /**
   * Refuser une demande de congé
   */
  async reject(id: string, validatorId: string, reason?: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Seules les demandes en attente peuvent être refusées',
      );
    }

    // Vérifier les droits de validation
    const canValidateLeave = await this.canValidate(id, validatorId);
    if (!canValidateLeave) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à valider cette demande",
      );
    }

    const updatedLeave = await this.prisma.leave.update({
      where: { id },
      data: {
        status: LeaveStatus.REJECTED,
        validatedById: validatorId,
        validatedAt: new Date(),
        validationComment: reason,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        validatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updatedLeave;
  }

  /**
   * Annuler une demande de congé approuvée
   */
  async cancel(id: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    if (leave.status !== LeaveStatus.APPROVED) {
      throw new BadRequestException(
        'Seules les demandes approuvées peuvent être annulées',
      );
    }

    const updatedLeave = await this.prisma.leave.update({
      where: { id },
      data: { status: LeaveStatus.REJECTED },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return updatedLeave;
  }

  // ===========================
  // GESTION DES DÉLÉGATIONS
  // ===========================

  /**
   * Créer une délégation de validation
   */
  async createDelegation(
    delegatorId: string,
    delegateId: string,
    startDate: Date,
    endDate: Date,
  ) {
    // Vérifier que le délégateur a le droit de déléguer
    const delegator = await this.prisma.user.findUnique({
      where: { id: delegatorId },
    });

    if (!delegator) {
      throw new NotFoundException('Utilisateur délégateur introuvable');
    }

    if (
      delegator.role !== Role.ADMIN &&
      delegator.role !== Role.RESPONSABLE &&
      delegator.role !== Role.MANAGER
    ) {
      throw new ForbiddenException(
        'Seuls les Admin, Responsables et Managers peuvent déléguer',
      );
    }

    // Vérifier que le délégué existe
    const delegate = await this.prisma.user.findUnique({
      where: { id: delegateId },
    });

    if (!delegate) {
      throw new NotFoundException('Utilisateur délégué introuvable');
    }

    if (!delegate.isActive) {
      throw new BadRequestException("L'utilisateur délégué doit être actif");
    }

    // Vérifier les dates
    if (endDate < startDate) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }

    // Créer la délégation
    const delegation = await this.prisma.leaveValidationDelegate.create({
      data: {
        delegatorId,
        delegateId,
        startDate,
        endDate,
        isActive: true,
      },
      include: {
        delegator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        delegate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return delegation;
  }

  /**
   * Récupérer les délégations d'un utilisateur
   */
  async getDelegations(userId: string) {
    const [given, received] = await Promise.all([
      this.prisma.leaveValidationDelegate.findMany({
        where: { delegatorId: userId },
        include: {
          delegate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.leaveValidationDelegate.findMany({
        where: { delegateId: userId },
        include: {
          delegator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    return { given, received };
  }

  /**
   * Désactiver une délégation
   */
  async deactivateDelegation(delegationId: string, userId: string) {
    const delegation = await this.prisma.leaveValidationDelegate.findUnique({
      where: { id: delegationId },
    });

    if (!delegation) {
      throw new NotFoundException('Délégation introuvable');
    }

    // Seul le délégateur ou un admin peut désactiver
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (delegation.delegatorId !== userId && user?.role !== Role.ADMIN) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à désactiver cette délégation",
      );
    }

    const updated = await this.prisma.leaveValidationDelegate.update({
      where: { id: delegationId },
      data: { isActive: false },
    });

    return updated;
  }

  /**
   * Récupérer le solde de congés d'un utilisateur
   */
  async getLeaveBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Récupérer tous les congés payés approuvés de l'année en cours
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    const approvedLeaves = await this.prisma.leave.findMany({
      where: {
        userId,
        type: LeaveType.CP,
        status: LeaveStatus.APPROVED,
        startDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
    });

    const usedDays = approvedLeaves.reduce((sum, leave) => sum + leave.days, 0);

    // En France, le droit légal est de 25 jours ouvrés (5 semaines)
    const totalDays = 25;
    const available = totalDays - usedDays;

    return {
      userId,
      year: currentYear,
      total: totalDays,
      used: usedDays,
      available: Math.max(0, available),
      pending: await this.getPendingDays(userId),
    };
  }

  /**
   * Récupérer le nombre de jours en attente
   */
  private async getPendingDays(userId: string): Promise<number> {
    const pendingLeaves = await this.prisma.leave.findMany({
      where: {
        userId,
        type: LeaveType.CP,
        status: LeaveStatus.PENDING,
      },
    });

    return pendingLeaves.reduce((sum, leave) => sum + leave.days, 0);
  }

  /**
   * Calculer le nombre de jours de congé
   */
  private calculateLeaveDays(
    startDate: Date,
    endDate: Date,
    startHalfDay?: string | null,
    endHalfDay?: string | null,
  ): number {
    // Calculer le nombre de jours calendaires
    // Note: diffTime is used for potential debugging, but we count work days below
    void Math.abs(endDate.getTime() - startDate.getTime());

    // Comptabiliser uniquement les jours ouvrés (lundi à vendredi)
    let workDays = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      // 0 = Dimanche, 6 = Samedi
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    // Ajuster pour les demi-journées
    let adjustment = 0;

    // Si c'est une seule journée
    if (startDate.getTime() === endDate.getTime()) {
      if (startHalfDay || endHalfDay) {
        return 0.5;
      }
      return 1;
    }

    // Ajustement pour le début
    if (startHalfDay) {
      adjustment -= 0.5;
    }

    // Ajustement pour la fin
    if (endHalfDay) {
      adjustment -= 0.5;
    }

    return Math.max(0.5, workDays + adjustment);
  }

  /**
   * Vérifier les chevauchements de congés
   */
  private async checkOverlap(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const where: Prisma.LeaveWhereInput = {
      userId,
      status: {
        in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      },
      OR: [
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      ],
    };

    if (excludeId) {
      where.NOT = { id: excludeId };
    }

    const overlappingLeaves = await this.prisma.leave.findMany({ where });

    return overlappingLeaves.length > 0;
  }

  // ===========================
  // IMPORT CSV
  // ===========================

  /**
   * Récupérer le modèle CSV pour l'import de congés
   */
  getImportTemplate(): string {
    const headers = [
      'userEmail',
      'leaveTypeName',
      'startDate',
      'endDate',
      'halfDay',
      'comment',
    ];
    const exampleComment = [
      '# user@example.com',
      '# Congé Payé',
      '# 2026-03-01',
      '# 2026-03-05',
      '#',
      '# Vacances',
    ];
    const exampleHalfDay = [
      '# user@example.com',
      '# RTT',
      '# 2026-03-10',
      '# 2026-03-10',
      '# MORNING',
      '# Demi-journée matin',
    ];
    return (
      headers.join(';') +
      '\n' +
      exampleComment.join(';') +
      '\n' +
      exampleHalfDay.join(';')
    );
  }

  /**
   * Valider des congés avant import (dry-run)
   */
  async validateLeavesImport(
    leaves: Array<{
      userEmail: string;
      leaveTypeName: string;
      startDate: string;
      endDate: string;
      halfDay?: string;
      comment?: string;
    }>,
  ) {
    const result: {
      valid: any[];
      duplicates: any[];
      errors: any[];
      warnings: any[];
      summary: {
        total: number;
        valid: number;
        duplicates: number;
        errors: number;
        warnings: number;
      };
    } = {
      valid: [],
      duplicates: [],
      errors: [],
      warnings: [],
      summary: {
        total: leaves.length,
        valid: 0,
        duplicates: 0,
        errors: 0,
        warnings: 0,
      },
    };

    // Récupérer tous les utilisateurs actifs
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
    });
    const usersByEmail = new Map(
      users.map((u) => [
        u.email.toLowerCase(),
        { id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}` },
      ]),
    );

    // Récupérer tous les types de congés actifs
    const leaveTypes = await this.prisma.leaveTypeConfig.findMany({
      where: { isActive: true },
    });
    const leaveTypesByName = new Map(
      leaveTypes.map((lt) => [
        lt.name.toLowerCase(),
        { id: lt.id, name: lt.name, code: lt.code },
      ]),
    );

    // Récupérer les congés existants (PENDING/APPROVED) pour détection chevauchement
    const existingLeaves = await this.prisma.leave.findMany({
      where: {
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
      },
    });

    // Map pour détecter les doublons dans le fichier
    const leavesInFile = new Map<string, Array<{ start: Date; end: Date }>>();

    for (let i = 0; i < leaves.length; i++) {
      const leaveData = leaves[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      const previewItem: {
        lineNumber: number;
        leave: any;
        status: 'valid' | 'duplicate' | 'error' | 'warning';
        messages: string[];
        resolvedUser?: { id: string; email: string; name: string };
        resolvedLeaveType?: { id: string; name: string; code: string };
      } = {
        lineNumber: lineNum,
        leave: leaveData,
        status: 'valid',
        messages: [],
        resolvedUser: undefined,
        resolvedLeaveType: undefined,
      };

      // Vérifier les champs obligatoires
      if (!leaveData.userEmail || leaveData.userEmail.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push("L'email utilisateur est obligatoire");
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!leaveData.leaveTypeName || leaveData.leaveTypeName.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('Le type de congé est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!leaveData.startDate || leaveData.startDate.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('La date de début est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!leaveData.endDate || leaveData.endDate.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('La date de fin est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Résoudre l'utilisateur par email
      const resolvedUser = usersByEmail.get(leaveData.userEmail.toLowerCase());
      if (!resolvedUser) {
        previewItem.status = 'error';
        previewItem.messages.push(
          `Utilisateur "${leaveData.userEmail}" introuvable ou inactif`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }
      previewItem.resolvedUser = resolvedUser;

      // Résoudre le type de congé par nom
      const resolvedLeaveType = leaveTypesByName.get(
        leaveData.leaveTypeName.toLowerCase(),
      );
      if (!resolvedLeaveType) {
        previewItem.status = 'error';
        previewItem.messages.push(
          `Type de congé "${leaveData.leaveTypeName}" introuvable ou inactif`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }
      previewItem.resolvedLeaveType = resolvedLeaveType;

      // Valider le format des dates
      const startDate = new Date(leaveData.startDate);
      const endDate = new Date(leaveData.endDate);

      if (isNaN(startDate.getTime())) {
        previewItem.status = 'error';
        previewItem.messages.push(
          `Date de début invalide: "${leaveData.startDate}" (format attendu: YYYY-MM-DD)`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (isNaN(endDate.getTime())) {
        previewItem.status = 'error';
        previewItem.messages.push(
          `Date de fin invalide: "${leaveData.endDate}" (format attendu: YYYY-MM-DD)`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Vérifier que endDate >= startDate
      if (endDate < startDate) {
        previewItem.status = 'error';
        previewItem.messages.push(
          'La date de fin doit être postérieure ou égale à la date de début',
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Valider halfDay uniquement sur une seule journée
      if (leaveData.halfDay) {
        if (startDate.getTime() !== endDate.getTime()) {
          previewItem.status = 'warning';
          previewItem.messages.push(
            'halfDay est ignoré pour les congés de plusieurs jours',
          );
        }
      }

      // Vérifier les chevauchements avec les congés existants
      const hasOverlap = existingLeaves.some(
        (existing) =>
          existing.userId === resolvedUser.id &&
          existing.startDate <= endDate &&
          existing.endDate >= startDate,
      );

      if (hasOverlap) {
        previewItem.status = 'duplicate';
        previewItem.messages.push(
          'Chevauchement avec un congé existant pour cet utilisateur',
        );
        result.duplicates.push(previewItem);
        result.summary.duplicates++;
        continue;
      }

      // Vérifier les chevauchements dans le fichier
      const userLeavesInFile = leavesInFile.get(resolvedUser.id) || [];
      const hasOverlapInFile = userLeavesInFile.some(
        (leave) => leave.start <= endDate && leave.end >= startDate,
      );

      if (hasOverlapInFile) {
        previewItem.status = 'duplicate';
        previewItem.messages.push(
          'Chevauchement avec un autre congé dans le fichier pour cet utilisateur',
        );
        result.duplicates.push(previewItem);
        result.summary.duplicates++;
        continue;
      }

      // Ajouter à la map pour détection de doublons
      userLeavesInFile.push({ start: startDate, end: endDate });
      leavesInFile.set(resolvedUser.id, userLeavesInFile);

      // Si tout est OK
      if (previewItem.status === 'warning') {
        result.warnings.push(previewItem);
        result.summary.warnings++;
      } else {
        result.valid.push(previewItem);
        result.summary.valid++;
      }
    }

    return result;
  }

  /**
   * Importer des congés en masse
   */
  async importLeaves(
    leaves: Array<{
      userEmail: string;
      leaveTypeName: string;
      startDate: string;
      endDate: string;
      halfDay?: string;
      comment?: string;
    }>,
    currentUserId: string,
  ) {
    const result: {
      created: number;
      skipped: number;
      errors: number;
      errorDetails: string[];
    } = {
      created: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };

    // Récupérer tous les utilisateurs actifs
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
    });
    const usersByEmail = new Map(
      users.map((u) => [u.email.toLowerCase(), u]),
    );

    // Récupérer tous les types de congés actifs
    const leaveTypes = await this.prisma.leaveTypeConfig.findMany({
      where: { isActive: true },
    });
    const leaveTypesByName = new Map(
      leaveTypes.map((lt) => [lt.name.toLowerCase(), lt]),
    );

    // Récupérer les congés existants (PENDING/APPROVED) pour détection chevauchement
    const existingLeaves = await this.prisma.leave.findMany({
      where: {
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
      },
    });

    // Map pour détecter les doublons dans le fichier
    const leavesInFile = new Map<string, Array<{ start: Date; end: Date }>>();

    for (let i = 0; i < leaves.length; i++) {
      const leaveData = leaves[i];
      const lineNum = i + 2;

      try {
        // Résoudre l'utilisateur
        const user = usersByEmail.get(leaveData.userEmail.toLowerCase());
        if (!user) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Utilisateur "${leaveData.userEmail}" introuvable`,
          );
          continue;
        }

        // Résoudre le type de congé
        const leaveType = leaveTypesByName.get(
          leaveData.leaveTypeName.toLowerCase(),
        );
        if (!leaveType) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Type de congé "${leaveData.leaveTypeName}" introuvable`,
          );
          continue;
        }

        // Valider les dates
        const startDate = new Date(leaveData.startDate);
        const endDate = new Date(leaveData.endDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          result.skipped++;
          result.errorDetails.push(`Ligne ${lineNum}: Dates invalides`);
          continue;
        }

        if (endDate < startDate) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Date de fin antérieure à la date de début`,
          );
          continue;
        }

        // Vérifier les chevauchements avec les congés existants
        const hasOverlap = existingLeaves.some(
          (existing) =>
            existing.userId === user.id &&
            existing.startDate <= endDate &&
            existing.endDate >= startDate,
        );

        if (hasOverlap) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Chevauchement avec un congé existant`,
          );
          continue;
        }

        // Vérifier les chevauchements dans le fichier
        const userLeavesInFile = leavesInFile.get(user.id) || [];
        const hasOverlapInFile = userLeavesInFile.some(
          (leave) => leave.start <= endDate && leave.end >= startDate,
        );

        if (hasOverlapInFile) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Chevauchement avec un autre congé dans le fichier`,
          );
          continue;
        }

        // Calculer le nombre de jours
        const halfDay =
          leaveData.halfDay &&
          startDate.getTime() === endDate.getTime() &&
          (leaveData.halfDay === 'MORNING' || leaveData.halfDay === 'AFTERNOON')
            ? leaveData.halfDay
            : null;

        const days = this.calculateLeaveDays(
          startDate,
          endDate,
          halfDay,
          undefined,
        );

        // Trouver le validateur approprié
        const validatorId = leaveType.requiresApproval
          ? await this.findValidatorForUser(user.id)
          : null;

        // Déterminer le statut initial
        const initialStatus = leaveType.requiresApproval
          ? LeaveStatus.PENDING
          : LeaveStatus.APPROVED;

        // Déterminer le type enum (pour rétrocompatibilité)
        const validEnumTypes = Object.values(LeaveType);
        const enumType = validEnumTypes.includes(leaveType.code as LeaveType)
          ? (leaveType.code as LeaveType)
          : LeaveType.OTHER;

        // Créer le congé
        await this.prisma.leave.create({
          data: {
            userId: user.id,
            leaveTypeId: leaveType.id,
            type: enumType,
            startDate,
            endDate,
            halfDay: halfDay || undefined,
            days,
            comment: leaveData.comment || undefined,
            status: initialStatus,
            validatorId,
          },
        });

        // Ajouter à la map pour détection de doublons
        userLeavesInFile.push({ start: startDate, end: endDate });
        leavesInFile.set(user.id, userLeavesInFile);

        result.created++;
      } catch (error) {
        result.errors++;
        result.errorDetails.push(
          `Ligne ${lineNum}: ${error.message || 'Erreur inconnue'}`,
        );
      }
    }

    return result;
  }
}
