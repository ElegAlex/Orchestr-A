import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { OwnershipService } from '../common/services/ownership.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: PrismaService;
  let ownershipService: { isOwner: ReturnType<typeof vi.fn> };
  let permissionsService: {
    getPermissionsForRole: ReturnType<typeof vi.fn>;
  };

  const mockPrismaService = {
    event: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    eventParticipant: {
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockEvent = {
    id: '1',
    title: 'Réunion de suivi',
    description: 'Revue du projet',
    date: new Date('2025-11-10'),
    startTime: '14:00',
    endTime: '15:00',
    isAllDay: false,
    projectId: 'project-1',
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    ownershipService = {
      isOwner: vi.fn().mockResolvedValue(false),
    };
    permissionsService = {
      getPermissionsForRole: vi.fn().mockResolvedValue([
        'events:read',
        'events:readAll',
        'tasks:readAll',
        'leaves:readAll',
        'telework:readAll',
      ]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PermissionsService,
          useValue: permissionsService,
        },
        {
          provide: OwnershipService,
          useValue: ownershipService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an event', async () => {
      const createEventDto: CreateEventDto = {
        title: 'Réunion de suivi',
        description: 'Revue du projet',
        date: '2025-11-10',
        startTime: '14:00',
        endTime: '15:00',
        isAllDay: false,
        projectId: 'project-1',
        participantIds: ['user-2'],
      };
      const userId = 'user-1';

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-2' }]);
      mockPrismaService.event.create.mockResolvedValue(mockEvent);

      const result = await service.create(createEventDto, userId);

      expect(result).toEqual(mockEvent);
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
      expect(prisma.event.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project not found', async () => {
      const createEventDto: CreateEventDto = {
        title: 'Réunion',
        date: '2025-11-10',
        projectId: 'invalid-project',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createEventDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if participant not found', async () => {
      const createEventDto: CreateEventDto = {
        title: 'Réunion',
        date: '2025-11-10',
        participantIds: ['user-2', 'user-3'],
      };

      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-2' }]);

      await expect(service.create(createEventDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all events', async () => {
      const events = [mockEvent];
      mockPrismaService.event.findMany.mockResolvedValue(events);

      const result = await service.findAll('user-1', 'ADMIN');

      expect(result).toEqual(events);
      expect(prisma.event.findMany).toHaveBeenCalled();
    });

    it('should filter events by date range', async () => {
      const events = [mockEvent];
      mockPrismaService.event.findMany.mockResolvedValue(events);

      const result = await service.findAll(
        'user-1',
        'ADMIN',
        '2025-11-01',
        '2025-11-30',
      );

      expect(result).toEqual(events);
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: {
              gte: new Date('2025-11-01'),
              lte: new Date('2025-11-30'),
            },
          }),
        }),
      );
    });

    it('should filter events by user', async () => {
      const events = [mockEvent];
      mockPrismaService.event.findMany.mockResolvedValue(events);

      const result = await service.findAll(
        'user-1',
        'ADMIN',
        undefined,
        undefined,
        'user-1',
      );

      expect(result).toEqual(events);
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            participants: {
              some: {
                userId: 'user-1',
              },
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an event by id', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);

      const result = await service.findOne('1', 'user-1', 'ADMIN');

      expect(result).toEqual(mockEvent);
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if event not found', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('invalid-id', 'user-1', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an event', async () => {
      const updateEventDto: UpdateEventDto = {
        title: 'Réunion mise à jour',
      };

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.$transaction.mockImplementation((callback) =>
        callback(mockPrismaService),
      );
      mockPrismaService.event.update.mockResolvedValue({
        ...mockEvent,
        ...updateEventDto,
      });

      const result = await service.update('1', updateEventDto);

      expect(result.title).toBe('Réunion mise à jour');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if event not found', async () => {
      const updateEventDto: UpdateEventDto = {
        title: 'Réunion mise à jour',
      };

      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(
        service.update('invalid-id', updateEventDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an event', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.event.delete.mockResolvedValue(mockEvent);

      const result = await service.remove('1');

      expect(result).toEqual({ message: 'Événement supprimé avec succès' });
      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw NotFoundException if event not found', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEventsByRange', () => {
    it('should return events in date range', async () => {
      const events = [mockEvent];
      mockPrismaService.event.findMany.mockResolvedValue(events);

      const result = await service.getEventsByRange('2025-11-01', '2025-11-30');

      expect(result).toEqual(events);
      expect(prisma.event.findMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException if dates are missing', async () => {
      await expect(service.getEventsByRange('', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if end date is before start date', async () => {
      await expect(
        service.getEventsByRange('2025-11-30', '2025-11-01'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addParticipant', () => {
    it('should add a participant to an event', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrismaService.eventParticipant.findUnique.mockResolvedValue(null);
      mockPrismaService.eventParticipant.create.mockResolvedValue({
        eventId: '1',
        userId: 'user-2',
      });

      const result = await service.addParticipant('1', 'user-2');

      expect(result).toEqual({ message: 'Participant ajouté avec succès' });
      expect(prisma.eventParticipant.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if participant already exists', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrismaService.eventParticipant.findUnique.mockResolvedValue({
        eventId: '1',
        userId: 'user-2',
      });

      await expect(service.addParticipant('1', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant from an event', async () => {
      mockPrismaService.eventParticipant.findUnique.mockResolvedValue({
        eventId: '1',
        userId: 'user-2',
      });
      mockPrismaService.eventParticipant.delete.mockResolvedValue({
        eventId: '1',
        userId: 'user-2',
      });

      const result = await service.removeParticipant('1', 'user-2');

      expect(result).toEqual({ message: 'Participant retiré avec succès' });
      expect(prisma.eventParticipant.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if participation not found', async () => {
      mockPrismaService.eventParticipant.findUnique.mockResolvedValue(null);

      await expect(service.removeParticipant('1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ownership enforcement (SEC-06 / BUG-05)', () => {
    const updateDto: UpdateEventDto = { title: 'edit' };

    describe('update', () => {
      it('rejects non-creator CONTRIBUTEUR with 403', async () => {
        mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
        ownershipService.isOwner.mockResolvedValue(false);
        permissionsService.getPermissionsForRole.mockResolvedValue([
          'events:update',
        ]);

        await expect(
          service.update('1', updateDto, 'other-user', 'CONTRIBUTEUR'),
        ).rejects.toThrow(ForbiddenException);
        expect(ownershipService.isOwner).toHaveBeenCalledWith(
          'event',
          '1',
          'other-user',
        );
      });

      it('allows the creator', async () => {
        mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
        ownershipService.isOwner.mockResolvedValue(true);
        mockPrismaService.$transaction.mockImplementation((cb) =>
          cb(mockPrismaService),
        );
        mockPrismaService.event.update.mockResolvedValue({
          ...mockEvent,
          ...updateDto,
        });

        const result = await service.update(
          '1',
          updateDto,
          'user-1',
          'CONTRIBUTEUR',
        );
        expect(result.title).toBe('edit');
      });

      it('allows non-creator holding events:manage_any', async () => {
        mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
        ownershipService.isOwner.mockResolvedValue(false);
        permissionsService.getPermissionsForRole.mockResolvedValue([
          'events:update',
          'events:manage_any',
        ]);
        mockPrismaService.$transaction.mockImplementation((cb) =>
          cb(mockPrismaService),
        );
        mockPrismaService.event.update.mockResolvedValue({
          ...mockEvent,
          ...updateDto,
        });

        const result = await service.update(
          '1',
          updateDto,
          'other-user',
          'ADMIN',
        );
        expect(result.title).toBe('edit');
      });
    });

    describe('remove', () => {
      it('rejects non-creator CONTRIBUTEUR with 403', async () => {
        mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
        ownershipService.isOwner.mockResolvedValue(false);
        permissionsService.getPermissionsForRole.mockResolvedValue([
          'events:delete',
        ]);

        await expect(
          service.remove('1', 'other-user', 'CONTRIBUTEUR'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('allows the creator', async () => {
        mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
        ownershipService.isOwner.mockResolvedValue(true);
        mockPrismaService.event.delete.mockResolvedValue(mockEvent);

        const result = await service.remove('1', 'user-1', 'CONTRIBUTEUR');
        expect(result).toEqual({ message: 'Événement supprimé avec succès' });
      });

      it('allows non-creator holding events:manage_any', async () => {
        mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
        ownershipService.isOwner.mockResolvedValue(false);
        permissionsService.getPermissionsForRole.mockResolvedValue([
          'events:delete',
          'events:manage_any',
        ]);
        mockPrismaService.event.delete.mockResolvedValue(mockEvent);

        const result = await service.remove('1', 'other-user', 'ADMIN');
        expect(result).toEqual({ message: 'Événement supprimé avec succès' });
      });
    });

    describe('addParticipant', () => {
      it('rejects non-creator without bypass with 403', async () => {
        mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
        ownershipService.isOwner.mockResolvedValue(false);
        permissionsService.getPermissionsForRole.mockResolvedValue([
          'events:update',
        ]);

        await expect(
          service.addParticipant('1', 'user-2', 'other-user', 'CONTRIBUTEUR'),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('addParticipant - user not found', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      ownershipService.isOwner.mockResolvedValue(true);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addParticipant('1', 'nonexistent-user', 'user-1', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('stopRecurrence', () => {
    const recurringEvent = {
      ...mockEvent,
      isRecurring: true,
      parentEventId: null,
    };

    beforeEach(() => {
      // Mock deleteMany and update for stopRecurrence
      (mockPrismaService.event as any).deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    });

    it('should stop recurrence of a parent recurring event', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(recurringEvent);
      ownershipService.isOwner.mockResolvedValue(true);
      mockPrismaService.event.update.mockResolvedValue({
        ...recurringEvent,
        isRecurring: false,
      });

      const result = await service.stopRecurrence('1', 'user-1', 'ADMIN');

      expect(result).toEqual({ message: 'Récurrence arrêtée avec succès' });
      expect((mockPrismaService.event as any).deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: { isRecurring: false },
        }),
      );
    });

    it('should throw NotFoundException when event not found', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(
        service.stopRecurrence('nonexistent', 'user-1', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when event is not a recurring parent', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({
        ...mockEvent,
        isRecurring: false,
        parentEventId: null,
      });
      ownershipService.isOwner.mockResolvedValue(true);

      await expect(
        service.stopRecurrence('1', 'user-1', 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when event is a child (has parentEventId)', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({
        ...mockEvent,
        isRecurring: true,
        parentEventId: 'parent-event-id',
      });
      ownershipService.isOwner.mockResolvedValue(true);

      await expect(
        service.stopRecurrence('1', 'user-1', 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
