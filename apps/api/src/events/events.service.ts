import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { OwnershipService } from '../common/services/ownership.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Prisma } from 'database';

/** Maximum horizon for recurrenceEndDate: 2 years from the event date (PER-005). */
const MAX_RECURRENCE_HORIZON_YEARS = 2;

/**
 * COR-038 — detect a DAT-038 event parent-chain cycle violation, either the
 * BEFORE INSERT/UPDATE trigger `events_parent_no_cycle_trg` (multi-hop cycle,
 * RAISE P0001 with the literal `events_parent_no_cycle` identifier) or the
 * CHECK constraint `events_parent_no_self_ck` (1-hop self-loop, SQLSTATE
 * 23514). Mirrors `isLeaveOverlapViolation` from COR-037: Prisma assigns no
 * dedicated code for P0001 (and the 23514 path here is a named CHECK, not
 * Prisma's generic check handling), so we match on constraint name + the
 * SQLSTATE token in `err.message` — both signals AND'd so an unrelated error
 * carrying one token cannot accidentally trigger.
 * Witness pinning the surface shape: dat038-event-parent-cycle.int.spec.ts.
 */
function isEventParentCycleViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? '';
  if (msg.includes('events_parent_no_cycle')) return true;
  if (msg.includes('events_parent_no_self_ck') && msg.includes('23514')) {
    return true;
  }
  return false;
}

const EVENT_PARENT_CYCLE_MESSAGE =
  'Cet événement créerait une boucle dans la chaîne de récurrence parente';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly ownershipService: OwnershipService,
  ) {}

  /**
   * Defense-in-depth ownership enforcement for mutations.
   * The OwnershipGuard already protects these routes, but service-layer checks
   * guard against direct internal callers and keep the invariant testable.
   */
  private async ensureCanMutate(
    eventId: string,
    userId?: string,
    role?: string | null,
  ): Promise<void> {
    if (!userId) return;
    const isOwner = await this.ownershipService.isOwner(
      'event',
      eventId,
      userId,
    );
    if (isOwner) return;
    if (role) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(role);
      if (permissions.includes('events:manage_any')) return;
    }
    throw new ForbiddenException('Event ownership violation');
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

    // PER-005: guard against an unbounded recurrence horizon (>2 years from
    // event date generates hundreds of sequential writes on the request path).
    if (isRecurring && recurrenceEndDate) {
      const eventDate = new Date(date);
      const horizon = new Date(eventDate);
      horizon.setFullYear(horizon.getFullYear() + MAX_RECURRENCE_HORIZON_YEARS);
      if (new Date(recurrenceEndDate) > horizon) {
        throw new BadRequestException(
          `La date de fin de récurrence ne peut pas dépasser ${MAX_RECURRENCE_HORIZON_YEARS} ans après la date de l'événement`,
        );
      }
    }

    // COR-012 + PER-005 — wrap parent create AND all occurrence writes in a
    // single $transaction so that a mid-batch failure rolls back the parent
    // instead of leaving an orphaned event (COR-012). Inside the transaction
    // use createMany (PER-005): 1 parent event.create + 1 event.createMany for
    // occurrences + 1 eventParticipant.createMany for participants = ≤3 statements
    // instead of N sequential event.create calls.
    //
    // COR-038 — DAT-038's BEFORE INSERT trigger `events_parent_no_cycle_trg`
    // and CHECK `events_parent_no_self_ck` fire inside the transaction; the
    // outer try/catch maps P0001 / 23514 to ConflictException(409).
    let event;
    try {
      event = await this.prisma.$transaction(async (tx) => {
        // 1. Create the parent event with nested participants
        const parentEvent = await tx.event.create({
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
            // Créer les participations du parent
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
                avatarUrl: true,
                avatarPreset: true,
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
                    avatarPreset: true,
                  },
                },
              },
            },
          },
        });

        // 2. Generate child occurrences in batch (PER-005)
        if (isRecurring) {
          const weekInterval = recurrenceWeekInterval || 1;
          const eventDateObj = new Date(date);

          const endDate = recurrenceEndDate
            ? new Date(recurrenceEndDate)
            : new Date(eventDateObj.getTime() + 365 * 24 * 60 * 60 * 1000);

          // Build all occurrence rows with pre-generated UUIDs so we can
          // batch-insert participants without a round-trip to recover IDs.
          const childRows: (Prisma.EventCreateManyInput & { id: string })[] =
            [];
          let currentDate = new Date(eventDateObj);
          currentDate.setDate(currentDate.getDate() + weekInterval * 7);

          while (currentDate <= endDate) {
            childRows.push({
              id: randomUUID(),
              title: eventData.title || parentEvent.title,
              description: eventData.description ?? null,
              date: new Date(currentDate),
              startTime: eventData.startTime ?? null,
              endTime: eventData.endTime ?? null,
              isAllDay: eventData.isAllDay ?? true,
              isExternalIntervention: eventData.isExternalIntervention ?? false,
              projectId: projectId || null,
              createdById,
              parentEventId: parentEvent.id,
            });
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + weekInterval * 7);
          }

          if (childRows.length > 0) {
            // PER-005: single batch insert for all occurrences
            await tx.event.createMany({ data: childRows });

            // PER-005: single batch insert for all participant rows
            if (participantIds && participantIds.length > 0) {
              const participantRows = childRows.flatMap((child) =>
                participantIds.map((userId) => ({
                  eventId: child.id,
                  userId,
                })),
              );
              await tx.eventParticipant.createMany({ data: participantRows });
            }
          }
        }

        return parentEvent;
      });
    } catch (err) {
      if (isEventParentCycleViolation(err)) {
        throw new ConflictException(EVENT_PARENT_CYCLE_MESSAGE);
      }
      throw err;
    }

    return event;
  }

  /**
   * Récupérer tous les événements avec filtres optionnels et pagination.
   * PER-006: enforce take ≤ 200 to prevent unbounded result sets.
   * Returns { data, meta } — callers (e.g. PlanningService) that previously
   * used the raw array must unwrap `.data`.
   */
  async findAll(
    currentUserId: string,
    currentUserRole: string | null,
    startDate?: string,
    endDate?: string,
    userId?: string,
    projectId?: string,
    page = 1,
    pageSize = 100,
  ) {
    const safePageSize = Math.min(pageSize || 100, 200);
    const skip = (page - 1) * safePageSize;

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

    // Lecture globale : vérifier la permission dynamique events:readAll
    const permissions =
      await this.permissionsService.getPermissionsForRole(currentUserRole);
    if (!permissions.includes('events:readAll')) {
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

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
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
              avatarUrl: true,
              avatarPreset: true,
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
                  avatarPreset: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'asc' },
        skip,
        take: safePageSize,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events,
      meta: {
        total,
        page,
        pageSize: safePageSize,
        totalPages: Math.ceil(total / safePageSize),
      },
    };
  }

  /**
   * Récupérer un événement par ID
   */
  async findOne(
    id: string,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
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
            avatarPreset: true,
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
                avatarPreset: true,
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

    // COR-065 — IDOR protection: permission lookup is unconditional (including
    // when role is null) so a null-role caller is never default-open. Only the
    // userId-dependent creator/participant check is guarded by `if (currentUserId)`.
    if (currentUserId) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('events:readAll')) {
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
    }

    return event;
  }

  /**
   * Mettre à jour un événement
   */
  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundException('Événement introuvable');
    }

    await this.ensureCanMutate(id, currentUserId, currentUserRole);

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
    // COR-038 — same parent-cycle surface as create(): an UPDATE that mutates
    // parentEventId hits DAT-038's trigger (P0001) or CHECK (23514) if the
    // resulting chain cycles. Wrap the $transaction so the raw error is mapped
    // to ConflictException(409) instead of leaking as 500. The tx aborts on
    // throw → no participant write persists either (correct: no successful
    // update = no participant rewrite).
    let event;
    try {
      event = await this.prisma.$transaction(async (tx) => {
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
        const updatedEvent = await tx.event.update({
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
                avatarUrl: true,
                avatarPreset: true,
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
                    avatarPreset: true,
                  },
                },
              },
            },
          },
        });

        // COR-053 — Si recurrenceEndDate est mise à jour sur un événement parent
        // récurrent, supprimer les enfants dont la date dépasse la nouvelle date
        // de fin à l'intérieur de la transaction, de façon atomique avec la mise
        // à jour du parent.
        if (
          updateEventDto.recurrenceEndDate &&
          existingEvent.isRecurring &&
          !existingEvent.parentEventId
        ) {
          const newEndDate = new Date(updateEventDto.recurrenceEndDate);
          await tx.event.deleteMany({
            where: {
              parentEventId: id,
              date: { gt: newEndDate },
            },
          });
        }

        return updatedEvent;
      });
    } catch (err) {
      if (isEventParentCycleViolation(err)) {
        throw new ConflictException(EVENT_PARENT_CYCLE_MESSAGE);
      }
      throw err;
    }

    return event;
  }

  /**
   * Supprimer un événement
   */
  async remove(
    id: string,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    await this.ensureCanMutate(id, currentUserId, currentUserRole);

    await this.prisma.event.delete({
      where: { id },
    });

    return { message: 'Événement supprimé avec succès' };
  }

  /**
   * Récupérer les événements d'un utilisateur avec pagination.
   * PER-006: enforce take ≤ 200.
   */
  async getEventsByUser(userId: string, page = 1, pageSize = 100) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Hard cap to bound the findMany (memory guard). Returns a BARE ARRAY: the
    // frontend (eventsService.getByUser) consumes this as Event[], and no caller
    // uses the page cursor. `page` is accepted for backward-compat but the route
    // returns the full (capped) set in one shot.
    void page;
    const safePageSize = Math.min(pageSize || 500, 500);
    const where: Prisma.EventWhereInput = {
      participants: { some: { userId } },
    };

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
            avatarUrl: true,
            avatarPreset: true,
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
                avatarPreset: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
      take: safePageSize,
    });

    return events;
  }

  /**
   * Récupérer les événements dans une plage de dates avec pagination.
   * PER-006: enforce take ≤ 200.
   */
  async getEventsByRange(
    startDate: string,
    endDate: string,
    currentUserId?: string,
    currentUserRole?: string | null,
    page = 1,
    pageSize = 100,
  ) {
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

    const safePageSize = Math.min(pageSize || 100, 200);
    const skip = (page - 1) * safePageSize;

    const where: Prisma.EventWhereInput = {
      date: {
        gte: start,
        lte: end,
      },
    };

    // COR-065 — scope filter must be unconditional: resolve permissions for any
    // role (including null) so a caller with no role is never default-open.
    // Guard only the userId-dependent where.OR assignment with `if (currentUserId)`.
    const rangePermissions =
      await this.permissionsService.getPermissionsForRole(currentUserRole);
    if (!rangePermissions.includes('events:readAll')) {
      if (currentUserId) {
        where.OR = [
          { participants: { some: { userId: currentUserId } } },
          { createdById: currentUserId },
        ];
      }
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
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
              avatarUrl: true,
              avatarPreset: true,
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
                  avatarPreset: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'asc' },
        skip,
        take: safePageSize,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events,
      meta: {
        total,
        page,
        pageSize: safePageSize,
        totalPages: Math.ceil(total / safePageSize),
      },
    };
  }

  /**
   * Ajouter un participant à un événement
   */
  async addParticipant(
    eventId: string,
    userId: string,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    // Vérifier que l'événement existe
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    await this.ensureCanMutate(eventId, currentUserId, currentUserRole);

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
    // COR-054 — concurrent duplicate requests both pass the findUnique guard
    // before either write commits; the second hits the DB unique constraint and
    // Prisma raises P2002. Map it to BadRequestException instead of HTTP 500.
    try {
      await this.prisma.eventParticipant.create({
        data: {
          eventId,
          userId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Cet utilisateur est déjà participant');
      }
      throw err;
    }

    return { message: 'Participant ajouté avec succès' };
  }

  /**
   * Arrêter la récurrence d'un événement parent
   */
  async stopRecurrence(
    id: string,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Événement introuvable');

    // Defense-in-depth: verify ownership at the service layer
    await this.ensureCanMutate(id, currentUserId, currentUserRole);

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
  async removeParticipant(
    eventId: string,
    userId: string,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    await this.ensureCanMutate(eventId, currentUserId, currentUserRole);

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
