import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PlanningExportController } from './planning-export.controller';
import { PlanningExportService } from './planning-export.service';
import { REQUIRE_PERMISSIONS_KEY } from '../rbac/decorators/require-permissions.decorator';

const mockService = {
  exportIcs: vi.fn().mockResolvedValue('BEGIN:VCALENDAR\r\nEND:VCALENDAR'),
  previewImport: vi.fn().mockResolvedValue([]),
  importIcs: vi.fn().mockResolvedValue({ imported: 0, skipped: 0 }),
};

describe('PlanningExportController', () => {
  let controller: PlanningExportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanningExportController],
      providers: [{ provide: PlanningExportService, useValue: mockService }],
    }).compile();

    controller = module.get<PlanningExportController>(PlanningExportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('previewImport calls service', async () => {
    const result = await controller.previewImport({ icsContent: '' });
    expect(mockService.previewImport).toHaveBeenCalledWith('');
    expect(result).toEqual([]);
  });

  it('importIcs calls service with userId', async () => {
    const result = await controller.importIcs({ icsContent: '' }, 'user-1');
    expect(mockService.importIcs).toHaveBeenCalledWith('', 'user-1');
    expect(result).toEqual({ imported: 0, skipped: 0 });
  });

  describe('SEC-012 — ICS import requires events:create (creates Event rows)', () => {
    it('ics/import requires BOTH leaves:create and events:create', () => {
      const metadata = Reflect.getMetadata(
        REQUIRE_PERMISSIONS_KEY,
        PlanningExportController.prototype.importIcs,
      );
      expect(metadata).toEqual(['leaves:create', 'events:create']);
    });

    it('ics/import/preview requires BOTH leaves:create and events:create', () => {
      const metadata = Reflect.getMetadata(
        REQUIRE_PERMISSIONS_KEY,
        PlanningExportController.prototype.previewImport,
      );
      expect(metadata).toEqual(['leaves:create', 'events:create']);
    });
  });
});
