import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { Prisma } from 'database';

@Injectable()
export class TimeTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer une nouvelle entrée de temps
   */
  async create(userId: string, createTimeEntryDto: CreateTimeEntryDto) {
    const { date, hours, activityType, taskId, projectId, description } =
      createTimeEntryDto;

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier la tâche si fournie
    if (taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        throw new NotFoundException('Tâche introuvable');
      }

      // Si task fournie, prendre son projet
      if (!projectId && task.projectId) {
        createTimeEntryDto.projectId = task.projectId;
      }
    }

    // Vérifier le projet si fourni
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new NotFoundException('Projet introuvable');
      }
    }

    // Vérifier qu'au moins une tâche ou un projet est fourni
    if (!taskId && !projectId) {
      throw new BadRequestException(
        'Une tâche ou un projet doit être spécifié',
      );
    }

    const timeEntry = await this.prisma.timeEntry.create({
      data: {
        userId,
        date: new Date(date),
        hours,
        activityType,
        taskId,
        projectId: createTimeEntryDto.projectId || projectId,
        description,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return timeEntry;
  }

  /**
   * Récupérer toutes les entrées avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 10,
    userId?: string,
    projectId?: string,
    taskId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.TimeEntryWhereInput = {};
    if (userId) where.userId = userId;
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
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupérer une entrée par ID
   */
  async findOne(id: string) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Entrée de temps introuvable');
    }

    return entry;
  }

  /**
   * Mettre à jour une entrée
   */
  async update(id: string, updateTimeEntryDto: UpdateTimeEntryDto) {
    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Entrée de temps introuvable');
    }

    const { date, hours, activityType, taskId, projectId, description } =
      updateTimeEntryDto;

    // Vérifications similaires à create si les champs sont fournis
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return entry;
  }

  /**
   * Supprimer une entrée
   */
  async remove(id: string) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException('Entrée de temps introuvable');
    }

    await this.prisma.timeEntry.delete({
      where: { id },
    });

    return { message: 'Entrée de temps supprimée avec succès' };
  }

  /**
   * Récupérer les entrées de temps d'un utilisateur
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
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    return entries;
  }

  /**
   * Récupérer le rapport de temps d'un utilisateur
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
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

    // Grouper par type d'activité
    const byType = entries.reduce(
      (acc, entry) => {
        acc[entry.activityType] = (acc[entry.activityType] || 0) + entry.hours;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Grouper par projet
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
      {} as Record<string, any>,
    );

    // Grouper par date
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
   * Récupérer le rapport de temps d'un projet
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

    const where: Prisma.TimeEntryWhereInput = { projectId };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

    // Grouper par utilisateur
    const byUser = entries.reduce(
      (acc, entry) => {
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
      {} as Record<string, any>,
    );

    // Grouper par type
    const byType = entries.reduce(
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
          ? {
              start: new Date(startDate),
              end: new Date(endDate),
            }
          : null,
      totalHours,
      totalEntries: entries.length,
      byUser: Object.values(byUser),
      byType,
      entries,
    };
  }
}
