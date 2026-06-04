import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const redisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

vi.mock('ioredis', () => {
  function MockRedis() {
    return redisInstance;
  }
  return { default: MockRedis };
});

import { CacheService } from './cache.service';
import { ConfigService } from '@nestjs/config';

describe('CacheService', () => {
  let service: CacheService;

  const mockConfig = {
    get: vi.fn((key: string, fallback?: unknown) => {
      if (key === 'REDIS_HOST') return 'localhost';
      if (key === 'REDIS_PORT') return 6379;
      return fallback;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CacheService(mockConfig as unknown as ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('returns parsed value when key exists', async () => {
      const payload = { foo: 'bar', n: 42 };
      redisInstance.get.mockResolvedValue(JSON.stringify(payload));
      const result = await service.get<typeof payload>('my:key');
      expect(result).toEqual(payload);
      expect(redisInstance.get).toHaveBeenCalledWith('my:key');
    });

    it('returns undefined when key is missing (null)', async () => {
      redisInstance.get.mockResolvedValue(null);
      const result = await service.get('missing:key');
      expect(result).toBeUndefined();
    });

    it('returns undefined and does NOT throw when Redis errors (fail-open)', async () => {
      redisInstance.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.get('any:key')).resolves.toBeUndefined();
    });
  });

  describe('set', () => {
    it('serialises value with TTL', async () => {
      redisInstance.set.mockResolvedValue('OK');
      const payload = { a: 1 };
      await service.set('cache:analytics:u1', payload, 60);
      expect(redisInstance.set).toHaveBeenCalledWith(
        'cache:analytics:u1',
        JSON.stringify(payload),
        'EX',
        60,
      );
    });

    it('does NOT throw when Redis errors (fail-open)', async () => {
      redisInstance.set.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.set('k', {}, 60)).resolves.toBeUndefined();
    });
  });

  describe('del', () => {
    it('calls redis.del with correct key', async () => {
      redisInstance.del.mockResolvedValue(1);
      await service.del('cache:analytics:u1');
      expect(redisInstance.del).toHaveBeenCalledWith('cache:analytics:u1');
    });

    it('does NOT throw when Redis errors (fail-open)', async () => {
      redisInstance.del.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.del('k')).resolves.toBeUndefined();
    });
  });
});
