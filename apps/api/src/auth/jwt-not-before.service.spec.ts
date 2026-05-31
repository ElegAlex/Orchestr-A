import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const redisInstance = {
  set: vi.fn(),
  get: vi.fn(),
};

vi.mock('ioredis', () => {
  function MockRedis() {
    return redisInstance;
  }
  return { default: MockRedis };
});

import { JwtNotBeforeService } from './jwt-not-before.service';
import { ConfigService } from '@nestjs/config';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn((key: string, fallback?: unknown) => {
      if (key in overrides) return overrides[key];
      if (key === 'REDIS_HOST') return 'localhost';
      if (key === 'REDIS_PORT') return 6379;
      return fallback;
    }),
  };
}

describe('JwtNotBeforeService (SEC-019)', () => {
  let service: JwtNotBeforeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JwtNotBeforeService(
      makeConfig() as unknown as ConfigService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('bumpUser', () => {
    it('stores floor(now/1000) + 1 (SECONDS, +1 same-second guard) with a TTL longer than the access TTL', async () => {
      // 2026-05-31T12:00:00.500Z → 1780228800.5s → floor 1780228800, +1 → 1780228801
      vi.setSystemTime(new Date('2026-05-31T12:00:00.500Z'));
      redisInstance.set.mockResolvedValue('OK');

      await service.bumpUser('user-1');

      // Default access TTL '15m' (900s) + 60s margin = 960s.
      expect(redisInstance.set).toHaveBeenCalledWith(
        'jwt:nbf:user-1',
        '1780228801',
        'EX',
        960,
      );
    });

    it('derives the key TTL from JWT_ACCESS_TTL (+ margin)', async () => {
      vi.setSystemTime(new Date('2026-05-31T12:00:00.000Z'));
      service = new JwtNotBeforeService(
        makeConfig({ JWT_ACCESS_TTL: '1h' }) as unknown as ConfigService,
      );
      redisInstance.set.mockResolvedValue('OK');

      await service.bumpUser('user-1');

      expect(redisInstance.set).toHaveBeenCalledWith(
        'jwt:nbf:user-1',
        expect.any(String),
        'EX',
        3600 + 60,
      );
    });

    it('falls back to a generous TTL on an unparseable access TTL (errs long, never short)', async () => {
      service = new JwtNotBeforeService(
        makeConfig({ JWT_ACCESS_TTL: 'garbage' }) as unknown as ConfigService,
      );
      redisInstance.set.mockResolvedValue('OK');

      await service.bumpUser('user-1');

      // 15min default (900s) + 60s margin.
      expect(redisInstance.set).toHaveBeenCalledWith(
        'jwt:nbf:user-1',
        expect.any(String),
        'EX',
        960,
      );
    });

    it('no-ops on an empty userId', async () => {
      await service.bumpUser('');
      expect(redisInstance.set).not.toHaveBeenCalled();
    });

    it('swallows Redis errors (best-effort write)', async () => {
      redisInstance.set.mockRejectedValue(new Error('redis down'));
      await expect(service.bumpUser('user-1')).resolves.toBeUndefined();
    });
  });

  describe('getNotBefore', () => {
    it('returns the stored nbf as a number', async () => {
      redisInstance.get.mockResolvedValue('1780228801');
      await expect(service.getNotBefore('user-1')).resolves.toBe(1780228801);
      expect(redisInstance.get).toHaveBeenCalledWith('jwt:nbf:user-1');
    });

    it('returns null when no nbf is set', async () => {
      redisInstance.get.mockResolvedValue(null);
      await expect(service.getNotBefore('user-1')).resolves.toBeNull();
    });

    it('fails OPEN (null) on a Redis error', async () => {
      redisInstance.get.mockRejectedValue(new Error('redis down'));
      await expect(service.getNotBefore('user-1')).resolves.toBeNull();
    });

    it('short-circuits on an empty userId', async () => {
      await expect(service.getNotBefore('')).resolves.toBeNull();
      expect(redisInstance.get).not.toHaveBeenCalled();
    });
  });
});
