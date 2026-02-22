import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Prisma } from 'database';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un nouvel événement
   */
  async create(createEventDto: CreateEventDto, createdById: string) {
    const { projectId, participantIds: rawParticipantIds, serviceIds, date, ...eventData } = createEventDto;

    // Résoudre les serviceIds en userIds et fusionner avec participantIds
    let participantIds = rawParticipantIds;
    if (serviceIds && serviceIds.length > 0) {
      const serviceMembers = await this.prisma.userService.findMany({
        where: { serviceId: { in: serviceIds } },
        select: { userId: true },
      });
      const serviceUserIds = serviceMembers.map((m) => m.userId);
      const merged = [...(rawParticipantIds || []), ...serviceUserIds];
      participantIds = [...new Set(merged)];
    }

    // Vérifier que le projet existe si fourni
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new NotFoundException('Projet introuvable');
      }
    }

    // Vérifier les participants si fournis
    if (participantIds && participantIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: { id: true },
      });

      if (users.length !== participantIds.length) {
        throw new NotFoundException(
          'Un ou plusieurs participants introuvables',
        );
      }
    }

    // Créer l'événement
    const event = await this.prisma.event.create({
      data: {
        ...eventData,
        date: new Date(date),
        projectId: projectId || null,
        createdById,
        // Créer les participations
        ...(participantIds &&
          participantIds.length > 0 && {
            participants: {
              create: participantIds.map((userId) => ({ userId })),
            },
          }),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return event;
  }

  /**
   * Récupérer tous les événements avec filtres optionnels
   */
  async findAll(
    startDate?: string,
    endDate?: string,
    userId?: string,
    projectId?: string,
  ) {
    const where: Prisma.EventWhereInput = {};

    // Filtrage par plage de dates
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

    // Filtrage par utilisateur (participant)
    if (userId) {
      where.participants = {
        some: {
          userId,
        },
      };
    }

    // Filtrage par projet
    if (projectId) {
      where.projectId = projectId;
    }

    const events = await this.prisma.event.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return events;
  }

  /**
   * Récupérer un événement par ID
   */
  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    return event;
  }

  /**
   * Mettre à jour un événement
   */
  async update(id: string, updateEventDto: UpdateEventDto) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundException('Événement introuvable');
    }

    const { projectId, participantIds: rawParticipantIds, serviceIds, date, ...eventData } = updateEventDto;

    // Résoudre les serviceIds en userIds et fusionner avec participantIds
    let participantIds = rawParticipantIds;
    if (serviceIds && serviceIds.length > 0) {
      const serviceMembers = await this.prisma.userService.findMany({
        where: { serviceId: { in: serviceIds } },
        select: { userId: true },
      });
      const serviceUserIds = serviceMembers.map((m) => m.userId);
      const merged = [...(rawParticipantIds || []), ...serviceUserIds];
      participantIds = [...new Set(merged)];
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

    // Vérifier les participants si fournis
    if (participantIds && participantIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: { id: true },
      });

      if (users.length !== participantIds.length) {
        throw new NotFoundException(
          'Un ou plusieurs participants introuvables',
        );
      }
    }

    // Mise à jour avec transaction pour gérer les participants
    const event = await this.prisma.$transaction(async (tx) => {
      // Si participantIds est explicitement fourni, mettre à jour les participations
      if (participantIds !== undefined) {
        // Supprimer tous les participants existants
        await tx.eventParticipant.deleteMany({
          where: { eventId: id },
        });

        // Créer les nouvelles participations
        if (participantIds.length > 0) {
          await tx.eventParticipant.createMany({
            data: participantIds.map((userId) => ({ eventId: id, userId })),
          });
        }
      }

      // Mettre à jour l'événement
      return tx.event.update({
        where: { id },
        data: {
          ...eventData,
          ...(date && { date: new Date(date) }),
          ...(projectId !== undefined && { projectId: projectId || null }),
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });
    });

    return event;
  }

  /**
   * Supprimer un événement
   */
  async remove(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    await this.prisma.event.delete({
      where: { id },
    });

    return { message: 'Événement supprimé avec succès' };
  }

  /**
   * Récupérer les événements d'un utilisateur
   */
  async getEventsByUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const events = await this.prisma.event.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return events;
  }

  /**
   * Récupérer les événements dans une plage de dates
   */
  async getEventsByRange(startDate: string, endDate: string) {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Les paramètres start et end sont obligatoires',
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Format de date invalide');
    }

    if (end < start) {
      throw new BadRequestException(
        'La date de fin ne peut pas être antérieure à la date de début',
      );
    }

    const events = await this.prisma.event.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return events;
  }

  /**
   * Ajouter un participant à un événement
   */
  async addParticipant(eventId: string, userId: string) {
    // Vérifier que l'événement existe
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier si l'utilisateur est déjà participant
    const existingParticipation = await this.prisma.eventParticipant.findUnique(
      {
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      },
    );

    if (existingParticipation) {
      throw new BadRequestException('Cet utilisateur est déjà participant');
    }

    // Ajouter le participant
    await this.prisma.eventParticipant.create({
      data: {
        eventId,
        userId,
      },
    });

    return { message: 'Participant ajouté avec succès' };
  }

  /**
   * Retirer un participant d'un événement
   */
  async removeParticipant(eventId: string, userId: string) {
    const participation = await this.prisma.eventParticipant.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!participation) {
      throw new NotFoundException('Participation introuvable');
    }

    await this.prisma.eventParticipant.delete({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    return { message: 'Participant retiré avec succès' };
  }
}
