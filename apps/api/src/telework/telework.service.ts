import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeleworkDto } from './dto/create-telework.dto';
import { UpdateTeleworkDto } from './dto/update-telework.dto';

@Injectable()
export class TeleworkService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer une journée de télétravail
   */
  async create(currentUserId: string, createTeleworkDto: CreateTeleworkDto) {
    const {
      date,
      isTelework = true,
      isException = false,
      userId: targetUserId,
    } = createTeleworkDto;

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
    page = 1,
    limit = 50,
    userId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [teleworks, total] = await Promise.all([
      this.prisma.teleworkSchedule.findMany({
        where,
        skip,
        take: limit,
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
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupérer un télétravail par ID
   */
  async findOne(id: string) {
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
    userId: string,
    updateTeleworkDto: UpdateTeleworkDto,
  ) {
    const existingTelework = await this.prisma.teleworkSchedule.findUnique({
      where: { id },
    });

    if (!existingTelework) {
      throw new NotFoundException('Télétravail introuvable');
    }

    const { date, isTelework, isException } = updateTeleworkDto;

    const updateData: any = {};

    // Si la date change, vérifier l'unicité
    if (date && date !== existingTelework.date.toISOString().split('T')[0]) {
      const newDate = new Date(date);

      // Vérifier que la nouvelle date n'est pas déjà utilisée
      const conflict = await this.prisma.teleworkSchedule.findUnique({
        where: {
          userId_date: {
            userId,
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
  async remove(id: string, userId: string) {
    const telework = await this.prisma.teleworkSchedule.findUnique({
      where: { id },
    });

    if (!telework) {
      throw new NotFoundException('Télétravail introuvable');
    }

    if (telework.userId !== userId) {
      throw new BadRequestException(
        'Vous ne pouvez supprimer que vos propres télétravails',
      );
    }

    await this.prisma.teleworkSchedule.delete({
      where: { id },
    });

    return { message: 'Télétravail supprimé avec succès' };
  }

  /**
   * Vue équipe : qui est en télétravail aujourd'hui/une date donnée
   */
  async getTeamSchedule(date?: string, departmentId?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const where: any = {
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
