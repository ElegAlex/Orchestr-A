import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PlanningExportService } from './planning-export.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  event: { findMany: vi.fn().mockResolvedValue([]) },
  leave: { findMany: vi.fn().mockResolvedValue([]) },
  teleworkSchedule: { findMany: vi.fn().mockResolvedValue([]) },
};

describe('PlanningExportService', () => {
  let service: PlanningExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningExportService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlanningExportService>(PlanningExportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('exportIcs returns valid ICS string', async () => {
    const result = await service.exportIcs('user-1');
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('END:VCALENDAR');
  });

  it('previewImport parses VEVENT from ICS content', async () => {
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
  });

  it('previewImport returns empty array for ICS with no VEVENTs', async () => {
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'END:VCALENDAR'].join('\r\n');
    const result = await service.previewImport(ics);
    expect(result).toHaveLength(0);
  });
});
