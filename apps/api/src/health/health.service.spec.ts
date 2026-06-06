/**
 * SEC-007 — /health must NOT expose per-component infra status (db/redis) to callers.
 *
 * Fail-pre witness (RED before fix):
 *   - HealthService.check() returns { status, db, redis }
 *     → assertion "keys are exactly ['status']" is RED.
 *   - ServiceUnavailableException body also contains { db, redis }
 *     → assertion "exception body keys are exactly ['status']" is RED.
 *
 * Pass-post (GREEN after fix):
 *   - check() resolves to { status: 'ok' } — no 'db' or 'redis' keys.
 *   - check() throws ServiceUnavailableException with body { status: 'degraded' } only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';

// Must be hoisted: the Redis constructor is called in HealthService's constructor.
// Use a class (not an arrow function) so `new Redis()` works correctly.
vi.mock('ioredis', () => {
  const pingFn = vi.fn().mockResolvedValue('PONG');
  class RedisMock {
    ping = pingFn;
  }
  return { default: RedisMock };
});

import { HealthService } from './health.service';

const makePrismaMock = () => ({
  $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
});

const makeConfigMock = () => ({
  get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
});

describe('HealthService (SEC-007)', () => {
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let configMock: ReturnType<typeof makeConfigMock>;
  let service: HealthService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock = makePrismaMock();
    configMock = makeConfigMock();
    service = new HealthService(prismaMock as any, configMock as any);
  });

  describe('happy path — all dependencies healthy', () => {
    it('returns only { status: "ok" } — no db or redis keys', async () => {
      const result = await service.check();

      expect(Object.keys(result)).toEqual(['status']);
      expect(result.status).toBe('ok');
      expect(result).not.toHaveProperty('db');
      expect(result).not.toHaveProperty('redis');
    });
  });

  describe('degraded path — DB down', () => {
    it('throws ServiceUnavailableException with body { status: "degraded" } only', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('connection refused'));

      let thrown: ServiceUnavailableException | null = null;
      try {
        await service.check();
      } catch (err) {
        thrown = err as ServiceUnavailableException;
      }

      expect(thrown).toBeInstanceOf(ServiceUnavailableException);
      const body = thrown!.getResponse() as object;
      expect(Object.keys(body)).toEqual(['status']);
      expect(body).not.toHaveProperty('db');
      expect(body).not.toHaveProperty('redis');
    });
  });
});
