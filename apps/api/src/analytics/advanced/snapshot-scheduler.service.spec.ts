import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

/**
 * Stateful in-memory fake for the ioredis surface used by SnapshotSchedulerService:
 * SET NX EX only. One module-level instance so two SnapshotSchedulerService
 * instances share the same store (simulating two API replicas hitting one Redis).
 */
const redisStore = new Map<string, string>();

const redisInstance = {
  // ioredis v5 SET EX NX argument order: set(key, val, 'EX', ttl, 'NX')
  set: vi.fn(
    async (
      _key: string,
      _val: string,
      _ex: string,
      _ttl: number,
      nx?: string,
    ): Promise<string | null> => {
      if (nx === 'NX') {
        if (redisStore.has(_key)) return null; // lock already held
        redisStore.set(_key, _val);
        return 'OK';
      }
      redisStore.set(_key, _val);
      return 'OK';
    },
  ),
};

vi.mock('ioredis', () => {
  function MockRedis() {
    return redisInstance;
  }
  return { default: MockRedis };
});

import { SnapshotSchedulerService } from './snapshot-scheduler.service';
import { ProjectsService } from '../../projects/projects.service';

const mockConfig = {
  get: vi.fn((key: string, fallback?: unknown) => {
    if (key === 'REDIS_URL') return undefined;
    if (key === 'REDIS_HOST') return 'localhost';
    if (key === 'REDIS_PORT') return 6379;
    return fallback;
  }),
};

describe('SnapshotSchedulerService', () => {
  let service: SnapshotSchedulerService;

  const mockProjectsService = {
    captureSnapshots: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    redisStore.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotSchedulerService,
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: ConfigService, useValue: mockConfig },
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

  /**
   * LEADER-LOCK — PER-029
   *
   * Simulates two API replicas firing the cron at the same tick.
   * Without a distributed lock both replicas would call captureSnapshots
   * (2 calls total → duplicate DB load + races).
   * With the Redis SET NX EX lock only the first replica acquires it;
   * the second skips → exactly 1 call total (RED before fix, GREEN after).
   */
  it('runs captureSnapshots exactly once when two replicas fire simultaneously (leader-lock)', async () => {
    mockProjectsService.captureSnapshots.mockResolvedValue({ captured: 5 });

    // Two separate instances share the same module-level redisInstance/store,
    // which faithfully models two replicas hitting the same Redis.
    const replicaA = new SnapshotSchedulerService(
      mockProjectsService as unknown as ProjectsService,
      mockConfig as unknown as ConfigService,
    );
    const replicaB = new SnapshotSchedulerService(
      mockProjectsService as unknown as ProjectsService,
      mockConfig as unknown as ConfigService,
    );

    await Promise.all([
      replicaA.captureDailySnapshots(),
      replicaB.captureDailySnapshots(),
    ]);

    // Only one replica must have run the actual capture.
    expect(mockProjectsService.captureSnapshots).toHaveBeenCalledTimes(1);
  });

  it('fails open — runs captureSnapshots when Redis SET throws', async () => {
    mockProjectsService.captureSnapshots.mockResolvedValue({ captured: 3 });
    redisInstance.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    // Should NOT throw — a Redis error must not prevent the snapshot from running.
    await expect(service.captureDailySnapshots()).resolves.toBeUndefined();
    expect(mockProjectsService.captureSnapshots).toHaveBeenCalledTimes(1);
  });
});
