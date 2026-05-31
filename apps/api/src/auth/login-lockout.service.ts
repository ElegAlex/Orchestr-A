import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'crypto';

export interface LockStatus {
  locked: boolean;
  /** Seconds until the active lock expires (only present when `locked`). */
  retryAfterSeconds?: number;
}

export interface FailureResult {
  /** True when THIS failure crossed the threshold and armed a (new) lock. */
  locked: boolean;
  /** Duration of the lock just armed, in seconds (only when `locked`). */
  lockSeconds?: number;
  /** Escalation level of the lock just armed: 1, 2, 3 … (only when `locked`). */
  level?: number;
  /** Consecutive-failure count within the current window (when not yet locked). */
  failureCount?: number;
}

/**
 * SEC-006 — Redis-backed per-(account, IP) failed-login counter with
 * progressive lockout.
 *
 * ── Why account + IP, not bare account ─────────────────────────────────────
 * A pure per-ACCOUNT lock (keyed on the username alone) is itself a DoS vector:
 * anyone can lock a legitimate user out of their own account by spamming failed
 * logins against their username. Keying the lock on the (account, IP) pair
 * removes that: an attacker spraying a victim's username from their own IP only
 * locks *their own* (victim, attackerIP) pair — the victim, logging in from a
 * different IP, is untouched. The per-IP throttle (`@Throttle` on /auth/login,
 * 5/min) remains the outer bound on single-IP brute force.
 *
 * LIMIT, stated honestly: account+IP keying does little against the named
 * "distributed password spraying" threat — by definition each (account, IP)
 * pair stays under the threshold there. The IP throttle is the only bound on
 * that residual; CAPTCHA-after-N / per-account anomaly detection is the genuine
 * follow-up (see SEC-006 Learnings). This layer stops single-IP *targeted*
 * brute force, which the throttle alone only rate-limits, never locks out.
 *
 * ── Fail OPEN on Redis error ───────────────────────────────────────────────
 * Unlike JwtBlacklistService (which fails CLOSED because it gates token
 * revocation), this service fails OPEN: a Redis outage must not deny every
 * login (a self-inflicted DoS). The independent in-memory IP throttle still
 * applies, so an open failure degrades gracefully to throttle-only protection.
 *
 * ── Construction ───────────────────────────────────────────────────────────
 * Same ioredis construction as JwtBlacklistService (SEC-021) / PermissionsService:
 * a second connection to the SAME Redis server, not a new backend dependency.
 */
@Injectable()
export class LoginLockoutService {
  private readonly redis: Redis;
  private readonly logger = new Logger(LoginLockoutService.name);

  private static readonly FAIL_PREFIX = 'login:lockout:fail:';
  private static readonly LOCK_PREFIX = 'login:lockout:until:';
  private static readonly LEVEL_PREFIX = 'login:lockout:level:';

  /** Consecutive failures within the window that arm the first lock. */
  static readonly FAILURE_THRESHOLD = 5;
  /** First lock duration; doubles per escalation level (×2). */
  static readonly BASE_LOCK_SECONDS = 15 * 60;
  /** Hard cap so escalation can't lock an (account, IP) pair effectively forever. */
  static readonly MAX_LOCK_SECONDS = 24 * 60 * 60;
  /** Sliding window the failure counter lives in before it self-expires. */
  static readonly FAILURE_WINDOW_SECONDS = 15 * 60;
  /** How long the escalation level is remembered across successive locks. */
  static readonly LEVEL_TTL_SECONDS = 24 * 60 * 60;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    } else {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');
      this.redis = new Redis({ host, port, password: password || undefined });
    }
  }

  /**
   * Derive the opaque Redis key fragment for an (account, IP) pair. The
   * identifier is lowercased (matching the audit-trail normalization) and
   * sha256-hashed with the IP so no raw login/email ever lands in Redis.
   */
  private keyId(identifier: string, ip?: string): string {
    return createHash('sha256')
      .update(`${(identifier ?? '').toLowerCase()}|${ip ?? ''}`)
      .digest('hex');
  }

  /** Is the (account, IP) pair currently locked? Fails open on Redis error. */
  async isLocked(identifier: string, ip?: string): Promise<LockStatus> {
    const id = this.keyId(identifier, ip);
    try {
      const ttl = await this.redis.ttl(
        `${LoginLockoutService.LOCK_PREFIX}${id}`,
      );
      if (ttl > 0) return { locked: true, retryAfterSeconds: ttl };
      return { locked: false };
    } catch (err) {
      this.logger.warn(`isLocked check failed, failing open: ${String(err)}`);
      return { locked: false };
    }
  }

  /**
   * Record a failed login for an (account, IP) pair. When the failure crosses
   * the threshold it arms a lock whose duration escalates ×2 per prior lock
   * (capped at MAX_LOCK_SECONDS), resets the failure counter, and returns
   * `{ locked: true, … }` so the caller can emit the ACCOUNT_LOCKED audit row.
   * Fails open on Redis error.
   */
  async recordFailure(identifier: string, ip?: string): Promise<FailureResult> {
    const id = this.keyId(identifier, ip);
    const failKey = `${LoginLockoutService.FAIL_PREFIX}${id}`;
    const lockKey = `${LoginLockoutService.LOCK_PREFIX}${id}`;
    const levelKey = `${LoginLockoutService.LEVEL_PREFIX}${id}`;
    try {
      const fails = await this.redis.incr(failKey);
      if (fails === 1) {
        await this.redis.expire(
          failKey,
          LoginLockoutService.FAILURE_WINDOW_SECONDS,
        );
      }
      if (fails < LoginLockoutService.FAILURE_THRESHOLD) {
        return { locked: false, failureCount: fails };
      }
      // Threshold crossed — arm (or re-arm) the lock with escalating duration.
      const level = await this.redis.incr(levelKey);
      if (level === 1) {
        await this.redis.expire(
          levelKey,
          LoginLockoutService.LEVEL_TTL_SECONDS,
        );
      }
      const lockSeconds = Math.min(
        LoginLockoutService.BASE_LOCK_SECONDS * 2 ** (level - 1),
        LoginLockoutService.MAX_LOCK_SECONDS,
      );
      await this.redis.set(lockKey, '1', 'EX', lockSeconds);
      // Reset the failure counter so the post-lock window starts clean; the
      // escalation level persists (LEVEL_TTL) so the next lock is longer.
      await this.redis.del(failKey);
      return { locked: true, lockSeconds, level };
    } catch (err) {
      this.logger.warn(`recordFailure failed, ignoring: ${String(err)}`);
      return { locked: false };
    }
  }

  /**
   * Reset all lockout state for an (account, IP) pair after a successful login:
   * the failure counter, any active lock, and the escalation level (a valid
   * authentication proves the pair is legitimate). Best-effort; errors ignored.
   */
  async clear(identifier: string, ip?: string): Promise<void> {
    const id = this.keyId(identifier, ip);
    try {
      await this.redis.del(
        `${LoginLockoutService.FAIL_PREFIX}${id}`,
        `${LoginLockoutService.LOCK_PREFIX}${id}`,
        `${LoginLockoutService.LEVEL_PREFIX}${id}`,
      );
    } catch (err) {
      this.logger.warn(`clear failed, ignoring: ${String(err)}`);
    }
  }
}
