import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Prisma } from 'database';

@Injectable()
export class EventsService {
  private readonly MANAGEMENT_ROLES = ['ADMIN', 'RESPONSABLE', 'MANAGER'];

  constructor(private readonly prisma: PrismaService) {}

  private isManagementRole(role: string): boolean {
    return this.MANAGEMENT_ROLES.includes(role);
  }

  /**
   * Créer un nouvel événement
   */
  async create(createEventDto: CreateEventDto, createdById: string) {
    const {
      projectId,
      participantIds: rawParticipantIds,
      serviceIds,
      date,
      isRecurring,
      recurrenceWeekInterval,
      recurrenceDay,
      recurrenceEndDate,
      ...eventData
    } = createEventDto;

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
        isRecurring: isRecurring || false,
        recurrenceWeekInterval: recurrenceWeekInterval ?? null,
        recurrenceDay: recurrenceDay ?? null,
        recurrenceEndDate: recurrenceEndDate
          ? new Date(recurrenceEndDate)
          : null,
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

    // Générer les occurrences si l'événement est récurrent
    if (isRecurring) {
      const weekInterval = recurrenceWeekInterval || 1;
      const eventDate = new Date(date);

      const endDate = recurrenceEndDate
        ? new Date(recurrenceEndDate)
        : new Date(eventDate.getTime() + 365 * 24 * 60 * 60 * 1000);

      const occurrences: Prisma.EventCreateManyInput[] = [];
      let currentDate = new Date(eventDate);
      currentDate.setDate(currentDate.getDate() + weekInterval * 7);

      while (currentDate <= endDate) {
        occurrences.push({
          title: eventData.title || event.title,
          description: eventData.description ?? null,
          date: new Date(currentDate),
          startTime: eventData.startTime ?? null,
          endTime: eventData.endTime ?? null,
          isAllDay: eventData.isAllDay ?? true,
          isExternalIntervention: eventData.isExternalIntervention ?? false,
          projectId: projectId || null,
          createdById,
          parentEventId: event.id,
        });
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + weekInterval * 7);
      }

      if (occurrences.length > 0) {
        await this.prisma.event.createMany({ data: occurrences });
        if (participantIds && participantIds.length > 0) {
          const childEvents = await this.prisma.event.findMany({
            where: { parentEventId: event.id },
            select: { id: true },
          });
          const participantData = childEvents.flatMap((child) =>
            participantIds.map((userId) => ({ eventId: child.id, userId })),
          );
          if (participantData.length > 0) {
            await this.prisma.eventParticipant.createMany({
              data: participantData,
            });
          }
        }
      }
    }

    return event;
  }

  /**
   * Récupérer tous les événements avec filtres optionnels
   */
  async findAll(
    currentUserId: string,
    currentUserRole: string,
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

    // IDOR protection: non-management roles can only see events they participate in or created
    if (!this.isManagementRole(currentUserRole)) {
      where.OR = [
        { participants: { some: { userId: currentUserId } } },
        { createdById: currentUserId },
      ];
    } else if (userId) {
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
  async findOne(id: string, currentUserId?: string, currentUserRole?: string) {
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

    // IDOR protection: non-management roles can only see events they created or participate in
    if (
      currentUserId &&
      currentUserRole &&
      !this.isManagementRole(currentUserRole)
    ) {
      const isCreator = event.createdById === currentUserId;
      const isParticipant = event.participants.some(
        (p) => p.user.id === currentUserId,
      );
      if (!isCreator && !isParticipant) {
        throw new ForbiddenException(
          "Vous n'avez pas la permission de consulter cet événement",
        );
      }
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

    const {
      projectId,
      participantIds: rawParticipantIds,
      serviceIds,
      date,
      ...eventData
    } = updateEventDto;

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

    // Si recurrenceEndDate est mise à jour sur un événement parent récurrent,
    // supprimer les enfants dont la date dépasse la nouvelle date de fin
    if (
      updateEventDto.recurrenceEndDate &&
      existingEvent.isRecurring &&
      !existingEvent.parentEventId
    ) {
      const newEndDate = new Date(updateEventDto.recurrenceEndDate);
      await this.prisma.event.deleteMany({
        where: {
          parentEventId: id,
          date: { gt: newEndDate },
        },
      });
    }

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
   * Arrêter la récurrence d'un événement parent
   */
  async stopRecurrence(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Événement introuvable');
    if (!event.isRecurring || event.parentEventId) {
      throw new BadRequestException(
        "Cet événement n'est pas un événement parent récurrent",
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.event.deleteMany({
      where: {
        parentEventId: id,
        date: { gte: today },
      },
    });

    await this.prisma.event.update({
      where: { id },
      data: { isRecurring: false },
    });

    return { message: 'Récurrence arrêtée avec succès' };
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
