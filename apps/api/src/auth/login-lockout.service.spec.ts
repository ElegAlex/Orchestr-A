import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Stateful in-memory fake of the ioredis surface LoginLockoutService uses
 * (incr / expire / set EX / ttl / del). Enough fidelity to exercise the
 * progressive-lockout logic end to end without a real Redis.
 */
const store = {
  vals: new Map<string, string>(),
  ttls: new Map<string, number>(),
};

const redisInstance = {
  incr: vi.fn(async (k: string) => {
    const n = (parseInt(store.vals.get(k) ?? '0', 10) || 0) + 1;
    store.vals.set(k, String(n));
    return n;
  }),
  expire: vi.fn(async (k: string, s: number) => {
    if (!store.vals.has(k)) return 0;
    store.ttls.set(k, s);
    return 1;
  }),
  set: vi.fn(async (k: string, v: string, _ex: string, s: number) => {
    store.vals.set(k, v);
    store.ttls.set(k, s);
    return 'OK';
  }),
  ttl: vi.fn(async (k: string) => {
    if (!store.vals.has(k)) return -2;
    return store.ttls.get(k) ?? -1;
  }),
  del: vi.fn(async (...keys: string[]) => {
    let c = 0;
    for (const k of keys) {
      if (store.vals.delete(k)) c++;
      store.ttls.delete(k);
    }
    return c;
  }),
};

vi.mock('ioredis', () => {
  function MockRedis() {
    return redisInstance;
  }
  return { default: MockRedis };
});

import { LoginLockoutService } from './login-lockout.service';
import { ConfigService } from '@nestjs/config';

describe('LoginLockoutService', () => {
  let service: LoginLockoutService;
  const mockConfig = {
    get: vi.fn((key: string, fallback?: unknown) => {
      if (key === 'REDIS_HOST') return 'localhost';
      if (key === 'REDIS_PORT') return 6379;
      return fallback;
    }),
  };

  beforeEach(() => {
    store.vals.clear();
    store.ttls.clear();
    vi.clearAllMocks(); // clears call history, keeps the inline implementations
    service = new LoginLockoutService(mockConfig as unknown as ConfigService);
  });

  it('counts failures below the threshold without locking', async () => {
    for (let i = 1; i < LoginLockoutService.FAILURE_THRESHOLD; i++) {
      const r = await service.recordFailure('alice', '10.0.0.1');
      expect(r.locked).toBe(false);
      expect(r.failureCount).toBe(i);
    }
    await expect(service.isLocked('alice', '10.0.0.1')).resolves.toEqual({
      locked: false,
    });
  });

  it('arms a 15min lock when the threshold is crossed', async () => {
    let result;
    for (let i = 0; i < LoginLockoutService.FAILURE_THRESHOLD; i++) {
      result = await service.recordFailure('alice', '10.0.0.1');
    }
    expect(result).toEqual({
      locked: true,
      lockSeconds: LoginLockoutService.BASE_LOCK_SECONDS,
      level: 1,
    });
    const status = await service.isLocked('alice', '10.0.0.1');
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBe(
      LoginLockoutService.BASE_LOCK_SECONDS,
    );
  });

  it('resets the failure counter after arming a lock', async () => {
    for (let i = 0; i < LoginLockoutService.FAILURE_THRESHOLD; i++) {
      await service.recordFailure('alice', '10.0.0.1');
    }
    // Next failure starts a fresh window at count 1 (not 6).
    const r = await service.recordFailure('alice', '10.0.0.1');
    expect(r).toEqual({ locked: false, failureCount: 1 });
  });

  it('escalates the lock duration ×2 per level, capped at MAX', async () => {
    const durations: number[] = [];
    for (let cycle = 0; cycle < 9; cycle++) {
      let result;
      for (let i = 0; i < LoginLockoutService.FAILURE_THRESHOLD; i++) {
        result = await service.recordFailure('alice', '10.0.0.1');
      }
      durations.push(result!.lockSeconds);
    }
    // 900, 1800, 3600, … doubling until capped at MAX_LOCK_SECONDS.
    expect(durations[0]).toBe(LoginLockoutService.BASE_LOCK_SECONDS);
    expect(durations[1]).toBe(LoginLockoutService.BASE_LOCK_SECONDS * 2);
    expect(durations[2]).toBe(LoginLockoutService.BASE_LOCK_SECONDS * 4);
    // Monotonic non-decreasing and never above the cap.
    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]).toBeGreaterThanOrEqual(durations[i - 1]);
      expect(durations[i]).toBeLessThanOrEqual(
        LoginLockoutService.MAX_LOCK_SECONDS,
      );
    }
    expect(durations[durations.length - 1]).toBe(
      LoginLockoutService.MAX_LOCK_SECONDS,
    );
  });

  it('keeps (account, IP) pairs independent — locking one does not lock another IP', async () => {
    for (let i = 0; i < LoginLockoutService.FAILURE_THRESHOLD; i++) {
      await service.recordFailure('alice', '10.0.0.1');
    }
    await expect(service.isLocked('alice', '10.0.0.1')).resolves.toMatchObject({
      locked: true,
    });
    // Same account, different source IP → untouched (no self-DoS of the victim).
    await expect(service.isLocked('alice', '10.0.0.2')).resolves.toEqual({
      locked: false,
    });
  });

  it('clear() removes the lock and resets the pair', async () => {
    for (let i = 0; i < LoginLockoutService.FAILURE_THRESHOLD; i++) {
      await service.recordFailure('alice', '10.0.0.1');
    }
    await service.clear('alice', '10.0.0.1');
    await expect(service.isLocked('alice', '10.0.0.1')).resolves.toEqual({
      locked: false,
    });
    // Escalation level was cleared too: the next lock is back to level 1.
    let result;
    for (let i = 0; i < LoginLockoutService.FAILURE_THRESHOLD; i++) {
      result = await service.recordFailure('alice', '10.0.0.1');
    }
    expect(result).toMatchObject({ level: 1 });
  });

  it('fails OPEN when Redis is unreachable on isLocked', async () => {
    redisInstance.ttl.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(service.isLocked('alice', '10.0.0.1')).resolves.toEqual({
      locked: false,
    });
  });

  it('fails OPEN (no throw) when Redis is unreachable on recordFailure', async () => {
    redisInstance.incr.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(service.recordFailure('alice', '10.0.0.1')).resolves.toEqual({
      locked: false,
    });
  });
});
