import { describe, it, expect, beforeEach, vi } from 'vitest';

const redisInstance = {
  set: vi.fn(),
  exists: vi.fn(),
};

vi.mock('ioredis', () => {
  function MockRedis() {
    return redisInstance;
  }
  return { default: MockRedis };
});

import { JwtBlacklistService } from './jwt-blacklist.service';
import { ConfigService } from '@nestjs/config';

describe('JwtBlacklistService', () => {
  let service: JwtBlacklistService;
  const mockConfig = {
    get: vi.fn((key: string, fallback?: unknown) => {
      if (key === 'REDIS_HOST') return 'localhost';
      if (key === 'REDIS_PORT') return 6379;
      return fallback;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JwtBlacklistService(mockConfig as unknown as ConfigService);
  });

  it('blacklist sets jwt:blacklist:<jti> with TTL', async () => {
    redisInstance.set.mockResolvedValue('OK');
    await service.blacklist('jti-1', 600);
    expect(redisInstance.set).toHaveBeenCalledWith(
      'jwt:blacklist:jti-1',
      '1',
      'EX',
      600,
    );
  });

  it('isBlacklisted returns true when key exists', async () => {
    redisInstance.exists.mockResolvedValue(1);
    await expect(service.isBlacklisted('jti-1')).resolves.toBe(true);
    expect(redisInstance.exists).toHaveBeenCalledWith('jwt:blacklist:jti-1');
  });

  it('isBlacklisted returns false when key does not exist', async () => {
    redisInstance.exists.mockResolvedValue(0);
    await expect(service.isBlacklisted('jti-2')).resolves.toBe(false);
  });

  it('isBlacklisted short-circuits on empty jti', async () => {
    await expect(service.isBlacklisted('')).resolves.toBe(false);
    expect(redisInstance.exists).not.toHaveBeenCalled();
  });

  it('blacklist clamps TTL to >= 1 second', async () => {
    redisInstance.set.mockResolvedValue('OK');
    await service.blacklist('jti-x', 0);
    expect(redisInstance.set).toHaveBeenCalledWith(
      'jwt:blacklist:jti-x',
      '1',
      'EX',
      1,
    );
  });
});
