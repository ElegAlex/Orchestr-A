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
    getWorkload: vi.fn(),
    getVelocity: vi.fn(),
    getBurndown: vi.fn(),
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

  describe('getWorkload', () => {
    it('should call service getWorkload and return real workload data', async () => {
      const query = { dateRange: DateRangeEnum.MONTH };
      const mockWorkload = [
        {
          userId: 'u1',
          name: 'Alice Martin',
          planned: 32,
          capacity: 160,
          utilization: 20,
        },
        {
          userId: 'u2',
          name: 'Bob Dupont',
          planned: 45,
          capacity: 160,
          utilization: 28,
        },
      ];

      mockAnalyticsService.getWorkload.mockResolvedValue(mockWorkload);

      const result = await controller.getWorkload(query);

      expect(mockAnalyticsService.getWorkload).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockWorkload);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('userId');
      expect(result[0]).toHaveProperty('planned');
      expect(result[0]).toHaveProperty('utilization');
    });
  });

  describe('getVelocity', () => {
    it('should call service getVelocity and return real weekly velocity data', async () => {
      const query = { dateRange: DateRangeEnum.MONTH };
      const mockVelocity = [
        { period: 'S1', completed: 5, planned: 8 },
        { period: 'S2', completed: 7, planned: 6 },
        { period: 'S3', completed: 4, planned: 9 },
      ];

      mockAnalyticsService.getVelocity.mockResolvedValue(mockVelocity);

      const result = await controller.getVelocity(query);

      expect(mockAnalyticsService.getVelocity).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockVelocity);
      expect(result.length).toBe(3);
      result.forEach((point) => {
        expect(point).toHaveProperty('period');
        expect(point).toHaveProperty('completed');
        expect(point).toHaveProperty('planned');
      });
    });
  });

  describe('getBurndown', () => {
    it('should call service getBurndown and return real burndown points', async () => {
      const query = { dateRange: DateRangeEnum.MONTH };
      const mockBurndown = [
        { day: 'S1', ideal: 100, actual: 100 },
        { day: 'S2', ideal: 75, actual: 80 },
        { day: 'S3', ideal: 50, actual: 55 },
        { day: 'S4', ideal: 25, actual: 30 },
      ];

      mockAnalyticsService.getBurndown.mockResolvedValue(mockBurndown);

      const result = await controller.getBurndown(query);

      expect(mockAnalyticsService.getBurndown).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockBurndown);
      expect(result.length).toBe(4);
      result.forEach((point) => {
        expect(point).toHaveProperty('day');
        expect(point).toHaveProperty('ideal');
        expect(point).toHaveProperty('actual');
      });
    });
  });
});
