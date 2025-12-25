import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DateRangeEnum } from './dto/analytics-query.dto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  const mockAnalyticsService = {
    getAnalytics: vi.fn(),
    exportAnalytics: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAnalytics', () => {
    it('should call service with correct parameters', async () => {
      const query = { dateRange: DateRangeEnum.MONTH };
      const mockResult = {
        metrics: [],
        projectProgressData: [],
        taskStatusData: [],
        projectDetails: [],
      };

      mockAnalyticsService.getAnalytics.mockResolvedValue(mockResult);

      const result = await controller.getAnalytics(query);

      expect(mockAnalyticsService.getAnalytics).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('exportAnalytics', () => {
    it('should call service export method', async () => {
      const query = { dateRange: DateRangeEnum.WEEK };
      const mockExport = {
        metrics: [],
        projectProgressData: [],
        taskStatusData: [],
        projectDetails: [],
        generatedAt: new Date().toISOString(),
        dateRange: DateRangeEnum.WEEK,
      };

      mockAnalyticsService.exportAnalytics.mockResolvedValue(mockExport);

      const result = await controller.exportAnalytics(query);

      expect(mockAnalyticsService.exportAnalytics).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockExport);
    });
  });
});
