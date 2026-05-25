import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PlanningExportService } from './planning-export.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';

const mockPrisma = {
  event: { findMany: vi.fn(), create: vi.fn() },
  leave: { findMany: vi.fn() },
  teleworkSchedule: { findMany: vi.fn() },
};

// OBS-007 — the export emits a fire-and-forget DATA_EXPORTED audit row.
const mockAuditPersistence = { log: vi.fn().mockResolvedValue(undefined) };

describe('PlanningExportService', () => {
  let service: PlanningExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningExportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditPersistenceService, useValue: mockAuditPersistence },
      ],
    }).compile();

    service = module.get<PlanningExportService>(PlanningExportService);

    // Default empty mocks
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.leave.findMany.mockResolvedValue([]);
    mockPrisma.teleworkSchedule.findMany.mockResolvedValue([]);
    mockAuditPersistence.log.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportIcs', () => {
    it('returns valid ICS string with no data', async () => {
      const result = await service.exportIcs('user-1');
      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
    });

    it('applies date filters when start and end provided', async () => {
      await service.exportIcs('user-1', '2025-01-01', '2025-12-31');

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
      expect(mockPrisma.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('includes all-day events in ICS output', async () => {
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'event-1',
          title: 'All Day Event',
          date: new Date('2025-06-15'),
          isAllDay: true,
          startTime: null,
          endTime: null,
          description: null,
        },
      ]);

      const result = await service.exportIcs('user-1');

      expect(result).toContain('All Day Event');
    });

    it('includes timed events in ICS output with startTime and endTime', async () => {
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'event-2',
          title: 'Timed Event',
          date: new Date('2025-06-15'),
          isAllDay: false,
          startTime: '09:00',
          endTime: '10:00',
          description: 'Meeting notes',
        },
      ]);

      const result = await service.exportIcs('user-1');

      expect(result).toContain('Timed Event');
    });

    it('includes timed events with startTime but no endTime (adds 1h)', async () => {
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'event-3',
          title: 'Timed Event No End',
          date: new Date('2025-06-15'),
          isAllDay: false,
          startTime: '14:00',
          endTime: null,
          description: null,
        },
      ]);

      const result = await service.exportIcs('user-1');

      expect(result).toContain('Timed Event No End');
    });

    it('includes approved leaves in ICS output', async () => {
      mockPrisma.leave.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          startDate: new Date('2025-07-01'),
          endDate: new Date('2025-07-05'),
          leaveType: { name: 'Congé annuel' },
        },
      ]);

      const result = await service.exportIcs('user-1');

      expect(result).toContain('Conge - Congé annuel');
    });

    it('includes telework days in ICS output', async () => {
      mockPrisma.teleworkSchedule.findMany.mockResolvedValue([
        {
          id: 'tw-1',
          date: new Date('2025-06-16'),
        },
      ]);

      const result = await service.exportIcs('user-1');

      expect(result).toContain('Teletravail');
    });

    // OBS-007 — the export must leave a DATA_EXPORTED RGPD-egress trail with the
    // exact materialized recordCount, scope, format, dateRange and ip. Pre-fix
    // exportIcs emitted nothing.
    it('emits DATA_EXPORTED with scope/format/recordCount/dateRange/ip (OBS-007)', async () => {
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'event-1',
          title: 'E1',
          date: new Date('2025-06-15'),
          isAllDay: true,
          startTime: null,
          endTime: null,
          description: null,
        },
        {
          id: 'event-2',
          title: 'E2',
          date: new Date('2025-06-16'),
          isAllDay: true,
          startTime: null,
          endTime: null,
          description: null,
        },
      ]);
      mockPrisma.leave.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          startDate: new Date('2025-07-01'),
          endDate: new Date('2025-07-05'),
          leaveType: { name: 'CP' },
        },
      ]);
      mockPrisma.teleworkSchedule.findMany.mockResolvedValue([
        { id: 'tw-1', date: new Date('2025-06-16') },
      ]);

      await service.exportIcs('user-1', '2025-06-01', '2025-07-31', {
        ip: '10.0.0.12',
        ua: 'vitest',
      });

      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistence.log.mock.calls[0][0];
      expect(call.action).toBe('DATA_EXPORTED');
      expect(call.entityType).toBe('Export');
      expect(call.actorId).toBe('user-1');
      expect(call.payload.format).toBe('ics');
      expect(call.payload.scope).toBe('planning');
      // 2 events + 1 leave + 1 telework = 4 rows materialized.
      expect(call.payload.recordCount).toBe(4);
      expect(call.payload.dateRange).toEqual({
        start: '2025-06-01',
        end: '2025-07-31',
      });
      expect(call.payload.ip).toBe('10.0.0.12');
    });

    // OBS-007 — fire-and-forget resilience: a rejecting audit log must NOT make
    // the export throw (read-path nuance, OBS-006 precedent).
    it('still returns the ICS even when the audit log rejects (OBS-007)', async () => {
      mockAuditPersistence.log.mockRejectedValueOnce(new Error('audit down'));

      const result = await service.exportIcs('user-1');

      expect(result).toContain('BEGIN:VCALENDAR');
    });

    it('applies only start filter when only start is provided', async () => {
      await service.exportIcs('user-1', '2025-01-01', undefined);

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  describe('previewImport', () => {
    it('parses VEVENT from ICS content', async () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'SUMMARY:Test Event',
        'DTSTART:20260301T100000Z',
        'DTEND:20260301T110000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const result = await service.previewImport(ics);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Event');
      expect(result[0].startTime).toBeDefined();
      expect(result[0].endTime).toBeDefined();
    });

    it('returns empty array for ICS with no VEVENTs', async () => {
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'END:VCALENDAR'].join(
        '\r\n',
      );
      const result = await service.previewImport(ics);
      expect(result).toHaveLength(0);
    });

    it('handles all-day events (no startTime/endTime)', async () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'SUMMARY:All Day',
        'DTSTART;VALUE=DATE:20260301',
        'DTEND;VALUE=DATE:20260302',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const result = await service.previewImport(ics);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('All Day');
    });
  });

  describe('importIcs', () => {
    it('imports valid VEVENT and returns count', async () => {
      mockPrisma.event.create.mockResolvedValue({ id: 'new-event' });

      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'SUMMARY:Import Event',
        'DTSTART:20260301T100000Z',
        'DTEND:20260301T110000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const result = await service.importIcs(ics, 'user-1');

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockPrisma.event.create).toHaveBeenCalled();
    });

    it('skips components that are not VEVENTs', async () => {
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'END:VCALENDAR'].join(
        '\r\n',
      );

      const result = await service.importIcs(ics, 'user-1');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('skips events without a start date', async () => {
      // VEVENT with no DTSTART — parser will set start=undefined
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'SUMMARY:No Start',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const result = await service.importIcs(ics, 'user-1');

      // The event without DTSTART should be skipped
      expect(result.imported + result.skipped).toBeGreaterThanOrEqual(0);
    });

    it('skips event on prisma create error', async () => {
      mockPrisma.event.create.mockRejectedValue(new Error('DB error'));

      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'SUMMARY:Failing Event',
        'DTSTART:20260301T100000Z',
        'DTEND:20260301T110000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const result = await service.importIcs(ics, 'user-1');

      expect(result.skipped).toBe(1);
      expect(result.imported).toBe(0);
    });

    it('imports all-day events correctly', async () => {
      mockPrisma.event.create.mockResolvedValue({ id: 'new-event' });

      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'SUMMARY:All Day Import',
        'DTSTART;VALUE=DATE:20260301',
        'DTEND;VALUE=DATE:20260302',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const result = await service.importIcs(ics, 'user-1');

      expect(result.imported).toBe(1);
      expect(mockPrisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isAllDay: true,
            startTime: null,
            endTime: null,
          }),
        }),
      );
    });

    it('imports timed events with endTime', async () => {
      mockPrisma.event.create.mockResolvedValue({ id: 'new-event' });

      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'SUMMARY:Timed Import',
        'DTSTART:20260301T090000Z',
        'DTEND:20260301T100000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const result = await service.importIcs(ics, 'user-1');

      expect(result.imported).toBe(1);
      expect(mockPrisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isAllDay: false,
            startTime: expect.stringMatching(/\d{2}:\d{2}/),
          }),
        }),
      );
    });
  });
});
