import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

describe('EventsController', () => {
  let controller: EventsController;
  let service: EventsService;

  const mockEventsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getEventsByUser: vi.fn(),
    getEventsByRange: vi.fn(),
    addParticipant: vi.fn(),
    removeParticipant: vi.fn(),
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
    project: { id: 'project-1', name: 'Projet Test' },
    createdBy: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    },
    participants: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get<EventsService>(EventsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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
        participantIds: [],
      };
      const userId = 'user-1';

      mockEventsService.create.mockResolvedValue(mockEvent);

      const result = await controller.create(createEventDto, userId);

      expect(result).toEqual(mockEvent);
      expect(service.create).toHaveBeenCalledWith(createEventDto, userId);
    });
  });

  describe('findAll', () => {
    it('should return all events', async () => {
      const events = [mockEvent];
      mockEventsService.findAll.mockResolvedValue(events);

      const result = await controller.findAll();

      expect(result).toEqual(events);
      expect(service.findAll).toHaveBeenCalled();
    });

    it('should return events with filters', async () => {
      const events = [mockEvent];
      mockEventsService.findAll.mockResolvedValue(events);

      const result = await controller.findAll(
        '2025-11-01',
        '2025-11-30',
        'user-1',
        'project-1',
      );

      expect(result).toEqual(events);
      expect(service.findAll).toHaveBeenCalledWith(
        '2025-11-01',
        '2025-11-30',
        'user-1',
        'project-1',
      );
    });
  });

  describe('findOne', () => {
    it('should return an event by id', async () => {
      mockEventsService.findOne.mockResolvedValue(mockEvent);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockEvent);
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('should update an event', async () => {
      const updateEventDto: UpdateEventDto = {
        title: 'Réunion mise à jour',
      };
      const updatedEvent = { ...mockEvent, ...updateEventDto };

      mockEventsService.update.mockResolvedValue(updatedEvent);

      const result = await controller.update('1', updateEventDto);

      expect(result).toEqual(updatedEvent);
      expect(service.update).toHaveBeenCalledWith('1', updateEventDto);
    });
  });

  describe('remove', () => {
    it('should delete an event', async () => {
      mockEventsService.remove.mockResolvedValue({
        message: 'Événement supprimé avec succès',
      });

      const result = await controller.remove('1');

      expect(result).toEqual({ message: 'Événement supprimé avec succès' });
      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });

  describe('getEventsByUser', () => {
    it('should return events for a user', async () => {
      const events = [mockEvent];
      mockEventsService.getEventsByUser.mockResolvedValue(events);

      const result = await controller.getEventsByUser('user-1');

      expect(result).toEqual(events);
      expect(service.getEventsByUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getEventsByRange', () => {
    it('should return events in date range', async () => {
      const events = [mockEvent];
      mockEventsService.getEventsByRange.mockResolvedValue(events);

      const result = await controller.getEventsByRange(
        '2025-11-01',
        '2025-11-30',
      );

      expect(result).toEqual(events);
      expect(service.getEventsByRange).toHaveBeenCalledWith(
        '2025-11-01',
        '2025-11-30',
      );
    });
  });

  describe('addParticipant', () => {
    it('should add a participant to an event', async () => {
      mockEventsService.addParticipant.mockResolvedValue({
        message: 'Participant ajouté avec succès',
      });

      const result = await controller.addParticipant('event-1', 'user-2');

      expect(result).toEqual({ message: 'Participant ajouté avec succès' });
      expect(service.addParticipant).toHaveBeenCalledWith('event-1', 'user-2');
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant from an event', async () => {
      mockEventsService.removeParticipant.mockResolvedValue({
        message: 'Participant retiré avec succès',
      });

      const result = await controller.removeParticipant('event-1', 'user-2');

      expect(result).toEqual({ message: 'Participant retiré avec succès' });
      expect(service.removeParticipant).toHaveBeenCalledWith(
        'event-1',
        'user-2',
      );
    });
  });
});
