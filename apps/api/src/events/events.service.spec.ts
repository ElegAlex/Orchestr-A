import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { OwnershipService } from '../common/services/ownership.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from 'database';
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
      createMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
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
      getPermissionsForRole: vi
        .fn()
        .mockResolvedValue([
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
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          cb(mockPrismaService),
      );
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

    // COR-038 — DAT-038's BEFORE INSERT trigger (P0001, message contains
    // `events_parent_no_cycle`) and CHECK `events_parent_no_self_ck` (23514)
    // are the sole barrier against a parent-chain cycle on insert. Pre-fix
    // the raw error propagates as a 500; post-fix it maps to
    // ConflictException(409). Pinned both variants so the helper covers both
    // SQLSTATEs (mirrors the verbatim surface shape from
    // dat038-event-parent-cycle.int.spec.ts).
    it('maps DAT-038 events_parent_no_cycle (P0001) from event.create to ConflictException (COR-038)', async () => {
      const dto: CreateEventDto = {
        title: 'Cyclic event',
        date: '2025-11-10',
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          cb(mockPrismaService),
      );
      mockPrismaService.event.create.mockRejectedValue(
        new Error(
          'Raw query failed. Code: P0001. Message: events_parent_no_cycle: parent chain creates a cycle',
        ),
      );

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('maps DAT-038 events_parent_no_self_ck (23514) from event.create to ConflictException (COR-038)', async () => {
      const dto: CreateEventDto = {
        title: 'Self-loop event',
        date: '2025-11-10',
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          cb(mockPrismaService),
      );
      mockPrismaService.event.create.mockRejectedValue(
        new Error(
          'Raw query failed. Code: 23514. Message: new row for relation "events" violates check constraint "events_parent_no_self_ck"',
        ),
      );

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    // PER-024 — recurring event must NOT use createMany→findMany(parentEventId)
    // round-trip. Post-COR-012/PER-005 fix: everything runs in $transaction;
    // event.create is called exactly once (parent), event.createMany once for
    // child occurrences, eventParticipant.createMany once for participant rows.
    // event.findMany with parentEventId filter is NEVER called.
    it('PER-024: recurring event uses createMany for occurrences, no findMany round-trip', async () => {
      const parentEvent = {
        ...mockEvent,
        id: 'parent-1',
        isRecurring: true,
        recurrenceWeekInterval: 1,
      };

      // $transaction executes the callback with mockPrismaService as tx
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          cb(mockPrismaService),
      );
      mockPrismaService.event.create.mockResolvedValue(parentEvent);
      mockPrismaService.event.createMany.mockResolvedValue({ count: 2 });
      mockPrismaService.eventParticipant.createMany.mockResolvedValue({
        count: 4,
      });
      // findMany should NOT be called with parentEventId (anti-pattern)
      mockPrismaService.event.findMany.mockResolvedValue([]);

      const dto: CreateEventDto = {
        title: 'Réunion hebdo',
        date: '2025-11-10',
        isRecurring: true,
        recurrenceWeekInterval: 1,
        recurrenceEndDate: '2025-11-24', // 2 occurrences
        participantIds: ['user-2'],
      };

      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-2' }]);

      await service.create(dto, 'user-1');

      // event.create called exactly once (parent only — COR-012/PER-005 fix)
      expect(prisma.event.create).toHaveBeenCalledTimes(1);
      // event.createMany called once for all child occurrences
      expect(prisma.event.createMany).toHaveBeenCalledTimes(1);
      // POST-FIX assertion: findMany must NOT have been called with parentEventId
      expect(prisma.event.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ parentEventId: 'parent-1' }),
        }),
      );
    });

    // COR-012 — partial occurrence failure must roll back the parent event.
    // Pre-fix: parent event.create commits, then occurrence loop runs outside
    // any transaction; a mid-loop failure leaves an orphaned parent.
    // Post-fix: everything inside $transaction; if the callback throws, the
    // entire tx is aborted and the parent is not persisted.
    it('COR-012 — occurrence failure inside $transaction rolls back parent (no orphaned event)', async () => {
      const parentEvent = { ...mockEvent, id: 'parent-1', isRecurring: true };

      // $transaction rejects when the callback throws (simulates a failed child write)
      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrismaService) => Promise<unknown>) => {
          // parent create succeeds inside the tx
          mockPrismaService.event.create.mockResolvedValueOnce(parentEvent);
          // createMany throws (child batch write fails)
          mockPrismaService.event.createMany.mockRejectedValueOnce(
            new Error('DB connection reset'),
          );
          return cb(mockPrismaService);
        },
      );

      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-2' }]);

      const dto: CreateEventDto = {
        title: 'Recurring event',
        date: '2025-11-10',
        isRecurring: true,
        recurrenceWeekInterval: 1,
        recurrenceEndDate: '2025-11-24',
        participantIds: ['user-2'],
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        'DB connection reset',
      );
      // The $transaction itself is what rolled back — verify it was called
      expect(prisma.$transaction).toHaveBeenCalled();
      // event.create must have been called inside the tx (then rolled back)
      expect(prisma.event.create).toHaveBeenCalledTimes(1);
    });

    // PER-005 — recurring event creation must execute ≤3 DB statements.
    // Pre-fix: N sequential event.create calls (one per occurrence).
    // Post-fix: 1 parent event.create + 1 event.createMany for occurrences
    //           + 1 eventParticipant.createMany for participants = 3 statements.
    it('PER-005 — 52-week recurring event executes ≤3 DB write statements (createMany batching)', async () => {
      const parentEvent = { ...mockEvent, id: 'parent-1', isRecurring: true };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          cb(mockPrismaService),
      );
      mockPrismaService.event.create.mockResolvedValue(parentEvent);
      mockPrismaService.event.createMany.mockResolvedValue({ count: 52 });
      mockPrismaService.eventParticipant.createMany.mockResolvedValue({
        count: 52,
      });

      const dto: CreateEventDto = {
        title: 'Weekly meeting',
        date: '2025-01-06',
        isRecurring: true,
        recurrenceWeekInterval: 1,
        // ~52 weeks from event date
        recurrenceEndDate: '2026-01-05',
        participantIds: ['user-2'],
      };

      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-2' }]);

      await service.create(dto, 'user-1');

      // ≤3 prisma write statements:
      // 1 create (parent) + 1 createMany (occurrences) + 1 createMany (participants)
      const writeCount =
        mockPrismaService.event.create.mock.calls.length +
        mockPrismaService.event.createMany.mock.calls.length +
        mockPrismaService.eventParticipant.createMany.mock.calls.length;
      expect(writeCount).toBeLessThanOrEqual(3);
    });

    it('PER-005 — rejects recurrenceEndDate more than 2 years after event date', async () => {
      const dto: CreateEventDto = {
        title: 'Far future recurring',
        date: '2025-01-01',
        isRecurring: true,
        recurrenceWeekInterval: 1,
        recurrenceEndDate: '2028-01-02', // >2 years after 2025-01-01
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all events with pagination meta', async () => {
      const events = [mockEvent];
      mockPrismaService.event.findMany.mockResolvedValue(events);
      mockPrismaService.event.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', 'ADMIN');

      expect(result).toEqual({
        data: events,
        meta: expect.objectContaining({ total: 1 }),
      });
      expect(prisma.event.findMany).toHaveBeenCalled();
    });

    it('should filter events by date range', async () => {
      const events = [mockEvent];
      mockPrismaService.event.findMany.mockResolvedValue(events);
      mockPrismaService.event.count.mockResolvedValue(1);

      await service.findAll('user-1', 'ADMIN', '2025-11-01', '2025-11-30');

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
      mockPrismaService.event.count.mockResolvedValue(1);

      await service.findAll('user-1', 'ADMIN', undefined, undefined, 'user-1');

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

    // PER-006 — findAll must enforce a max take of 200 (no unbounded findMany).
    it('PER-006 — findAll enforces take ≤ 200 (unbounded query is capped)', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([]);
      mockPrismaService.event.count.mockResolvedValue(0);

      await service.findAll('user-1', 'ADMIN');

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: expect.any(Number),
        }),
      );
      const call = (prisma.event.findMany as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(call.take).toBeLessThanOrEqual(200);
    });

    // PER-006 — findAll with page=2&pageSize=10 returns correct slice (skip=10, take=10).
    it('PER-006 — findAll with page=2 pageSize=10 skips first 10 events', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([]);
      mockPrismaService.event.count.mockResolvedValue(25);

      const result = await service.findAll(
        'user-1',
        'ADMIN',
        undefined,
        undefined,
        undefined,
        undefined,
        2,
        10,
      );

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta).toEqual(
        expect.objectContaining({ total: 25, page: 2, pageSize: 10 }),
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

    // COR-065 — findOne IDOR check must apply even when currentUserRole is null.
    // Pre-fix: `if (currentUserId && currentUserRole)` — short-circuits when role
    // is null, granting any authenticated user unscoped read access.
    // Post-fix: permission lookup is unconditional; ForbiddenException thrown when
    // the caller is neither creator nor participant and has no events:readAll.
    it('COR-065 — findOne throws ForbiddenException for non-participant with null role', async () => {
      // Event not created by currentUser and no participants matching
      const eventOwnedByOther = {
        ...mockEvent,
        createdById: 'other-user',
        participants: [],
      };
      mockPrismaService.event.findUnique.mockResolvedValue(eventOwnedByOther);
      // Null role → no events:readAll permission
      permissionsService.getPermissionsForRole.mockResolvedValue([]);

      await expect(service.findOne('1', 'user-1', null)).rejects.toThrow(
        ForbiddenException,
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

    // COR-038 — same parent-cycle surface on the update path. The $transaction
    // resolves tx.event.update, which fires DAT-038's trigger if the resulting
    // chain cycles; pre-fix this surfaces as a 500, post-fix it maps to
    // ConflictException(409). The outer try/catch sees the rejected $transaction.
    it('maps DAT-038 events_parent_no_cycle (P0001) from tx.event.update to ConflictException (COR-038)', async () => {
      const updateEventDto: UpdateEventDto = {
        title: 'Cycling parent',
      };

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.$transaction.mockRejectedValue(
        new Error(
          'Raw query failed. Code: P0001. Message: events_parent_no_cycle: parent chain creates a cycle',
        ),
      );

      await expect(service.update('1', updateEventDto)).rejects.toThrow(
        ConflictException,
      );
    });

    // COR-053 — recurrenceEndDate child-prune must run INSIDE the $transaction,
    // not after it. Witness: capture the deleteMany call count at the moment the
    // tx callback returns; it must already be 1 (inside) vs 0 (outside/post-fix).
    it('COR-053 — child prune deleteMany fires inside the $transaction callback (not after)', async () => {
      const recurringParent = {
        ...mockEvent,
        isRecurring: true,
        parentEventId: null,
      };
      const newEndDate = '2025-11-20';
      const updateEventDto: UpdateEventDto = {
        recurrenceEndDate: newEndDate,
      };

      mockPrismaService.event.findUnique.mockResolvedValue(recurringParent);
      mockPrismaService.event.update.mockResolvedValue({
        ...recurringParent,
        recurrenceEndDate: new Date(newEndDate),
      });
      mockPrismaService.event.deleteMany.mockResolvedValue({ count: 1 });
      // Use isOwner=true so ensureCanMutate passes without needing manage_any
      ownershipService.isOwner.mockResolvedValue(true);

      // Track how many deleteMany calls had happened at the moment the tx
      // callback returned its result. Pre-fix = 0 (runs after), post-fix = 1.
      let deleteManyCallCountAtTxReturn = -1;
      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrismaService) => Promise<unknown>) => {
          const result = await cb(mockPrismaService);
          deleteManyCallCountAtTxReturn =
            mockPrismaService.event.deleteMany.mock.calls.length;
          return result;
        },
      );

      await service.update('1', updateEventDto, 'user-1', 'ADMIN');

      expect(deleteManyCallCountAtTxReturn).toBe(1);
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
    it('should return events in date range with pagination meta', async () => {
      const events = [mockEvent];
      mockPrismaService.event.findMany.mockResolvedValue(events);
      mockPrismaService.event.count.mockResolvedValue(1);

      const result = await service.getEventsByRange('2025-11-01', '2025-11-30');

      expect(result).toEqual({
        data: events,
        meta: expect.objectContaining({ total: 1 }),
      });
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

    // COR-065 — getEventsByRange must apply scope filter even when role is null.
    // Pre-fix: `if (currentUserId && currentUserRole)` is default-OPEN when role
    // is null → no where.OR → unscoped access granted to every event.
    // Post-fix: permissions always resolved; where.OR set when !events:readAll.
    it('COR-065 — getEventsByRange scopes results when currentUserRole is null (not default-open)', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([]);
      mockPrismaService.event.count.mockResolvedValue(0);
      // Role is null → getPermissionsForRole returns empty list (no events:readAll)
      permissionsService.getPermissionsForRole.mockResolvedValue([]);

      await service.getEventsByRange(
        '2025-11-01',
        '2025-11-30',
        'user-1',
        null,
      );

      const call = (prisma.event.findMany as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      // Must have a scoped where.OR — not unscoped
      expect(call.where).toHaveProperty('OR');
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

    // COR-054 — concurrent duplicate addParticipant races past the findUnique
    // check; the second create hits the DB unique constraint (P2002) and must
    // surface as BadRequestException(400), not a raw 500.
    it('COR-054 — P2002 from eventParticipant.create is mapped to BadRequestException', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      ownershipService.isOwner.mockResolvedValue(true);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });
      // No existing participation (passed the sequential guard)
      mockPrismaService.eventParticipant.findUnique.mockResolvedValue(null);
      // But the DB create throws P2002 (concurrent race)
      mockPrismaService.eventParticipant.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`eventId`,`userId`)',
          {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['eventId', 'userId'] },
          },
        ),
      );

      await expect(
        service.addParticipant('1', 'user-2', 'user-1', 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
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
      (mockPrismaService.event as any).deleteMany = vi
        .fn()
        .mockResolvedValue({ count: 0 });
      // DAT-001 — stopRecurrence now wraps both writes in $transaction; the mock
      // runs the callback with mockPrismaService as the tx client by default.
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          cb(mockPrismaService),
      );
    });

    it('DAT-001 — both writes run inside one $transaction (atomic stop)', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(recurringEvent);
      ownershipService.isOwner.mockResolvedValue(true);

      // Distinct tx client with its own spies — proves WHICH client the two
      // writes go through. Before the fix they hit the autocommit pool
      // (this.prisma.*) with no surrounding $transaction.
      const txDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
      const txUpdate = vi.fn().mockResolvedValue({ id: '1', isRecurring: false });
      const tx = { event: { deleteMany: txDeleteMany, update: txUpdate } };
      mockPrismaService.$transaction.mockImplementationOnce(
        async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      );

      await service.stopRecurrence('1', 'user-1', 'ADMIN');

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(txDeleteMany).toHaveBeenCalledTimes(1);
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isRecurring: false },
      });
      // The two writes must NOT bypass the tx via the autocommit pool.
      expect((mockPrismaService.event as any).deleteMany).not.toHaveBeenCalled();
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
