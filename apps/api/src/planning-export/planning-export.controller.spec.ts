import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PlanningExportController } from './planning-export.controller';
import { PlanningExportService } from './planning-export.service';

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
});
