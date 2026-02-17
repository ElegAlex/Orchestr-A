/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: PrismaService;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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

      const result = await service.findAll();

      expect(result).toEqual(events);
      expect(prisma.event.findMany).toHaveBeenCalled();
    });

    it('should filter events by date range', async () => {
      const events = [mockEvent];
      mockPrismaService.event.findMany.mockResolvedValue(events);

      const result = await service.findAll('2025-11-01', '2025-11-30');

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

      const result = await service.findAll(undefined, undefined, 'user-1');

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

      const result = await service.findOne('1');

      expect(result).toEqual(mockEvent);
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if event not found', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
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
});
