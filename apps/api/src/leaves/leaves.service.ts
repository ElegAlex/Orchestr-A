import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { LeaveStatus, LeaveType } from 'database';

@Injectable()
export class LeavesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer une nouvelle demande de congé
   */
  async create(userId: string, createLeaveDto: CreateLeaveDto) {
    const {
      type,
      startDate,
      endDate,
      startHalfDay,
      endHalfDay,
      reason,
    } = createLeaveDto;

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
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
    const days = this.calculateLeaveDays(start, end, startHalfDay, endHalfDay);

    // Vérifier les chevauchements
    const hasOverlap = await this.checkOverlap(userId, start, end);

    if (hasOverlap) {
      throw new ConflictException(
        'Cette demande chevauche une demande de congé existante',
      );
    }

    // Vérifier le solde pour les congés payés
    if (type === LeaveType.CP) {
      const balance = await this.getLeaveBalance(userId);

      if (balance.available < days) {
        throw new BadRequestException(
          `Solde de congés insuffisant. Disponible: ${balance.available} jours, Demandé: ${days} jours`,
        );
      }
    }

    // Créer la demande de congé
    const leave = await this.prisma.leave.create({
      data: {
        userId,
        type,
        startDate: start,
        endDate: end,
        halfDay: startHalfDay || undefined,
        days,
        comment: reason,
        status: LeaveStatus.PENDING,
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
      },
    });

    return leave;
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
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (type) where.type = type;

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
        },
        orderBy: {
          startDate: 'desc',
        },
      }),
      this.prisma.leave.count({ where }),
    ]);

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
            service: {
              select: {
                id: true,
                name: true,
              },
            },
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

    const {
      type,
      startDate,
      endDate,
      startHalfDay,
      endHalfDay,
      reason,
    } = updateLeaveDto;

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
      startHalfDay ?? existingLeave.halfDay,
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
        ...(startHalfDay && { startHalfDay }),
        ...(endHalfDay && { endHalfDay }),
        ...(reason !== undefined && { reason }),
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
   * Approuver une demande de congé
   */
  async approve(id: string) {
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

    const updatedLeave = await this.prisma.leave.update({
      where: { id },
      data: { status: LeaveStatus.APPROVED },
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

  /**
   * Refuser une demande de congé
   */
  async reject(id: string, reason?: string) {
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

    const updatedLeave = await this.prisma.leave.update({
      where: { id },
      data: {
        status: LeaveStatus.REJECTED,
        ...(reason && { reason }),
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

    const usedDays = approvedLeaves.reduce(
      (sum, leave) => sum + leave.days,
      0,
    );

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
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

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
    const where: any = {
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
}
