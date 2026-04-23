import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotSchedulerService } from './snapshot-scheduler.service';
import { ProjectsService } from '../../projects/projects.service';

describe('SnapshotSchedulerService', () => {
  let service: SnapshotSchedulerService;

  const mockProjectsService = {
    captureSnapshots: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotSchedulerService,
        { provide: ProjectsService, useValue: mockProjectsService },
      ],
    }).compile();

    service = module.get<SnapshotSchedulerService>(SnapshotSchedulerService);
  });

  it('logs the configured cron expression and timezone on module init', () => {
    const logSpy = vi
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    service.onModuleInit();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const message = logSpy.mock.calls[0][0] as string;
    expect(message).toContain("'0 23 * * *'");
    expect(message).toContain('Europe/Paris');
  });

  it('delegates daily capture to ProjectsService.captureSnapshots', async () => {
    mockProjectsService.captureSnapshots.mockResolvedValue({ captured: 7 });

    await service.captureDailySnapshots();

    expect(mockProjectsService.captureSnapshots).toHaveBeenCalledTimes(1);
  });

  it('logs the captured count and elapsed time on success', async () => {
    mockProjectsService.captureSnapshots.mockResolvedValue({ captured: 12 });
    const logSpy = vi
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    await service.captureDailySnapshots();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const message = logSpy.mock.calls[0][0] as string;
    expect(message).toContain('12 project(s)');
    expect(message).toMatch(/in \d+ms/);
  });

  it('logs and rethrows when capture fails', async () => {
    const boom = new Error('DB unreachable');
    mockProjectsService.captureSnapshots.mockRejectedValue(boom);
    const errorSpy = vi
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);

    await expect(service.captureDailySnapshots()).rejects.toThrow(boom);
    expect(errorSpy).toHaveBeenCalledWith(
      'Daily snapshot capture failed',
      boom,
    );
  });
});
