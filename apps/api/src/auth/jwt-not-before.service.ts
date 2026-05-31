import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * SEC-019 — per-user "not-valid-before" (nbf) gate for access JWTs.
 *
 * The jti blacklist (JwtBlacklistService) is per-token and only populated on
 * /auth/logout: there is no "revoke every access token for user X". So a
 * password reset revokes refresh tokens but leaves any *already-issued* access
 * token usable until it expires (default 15 min). This service closes that
 * window: it stamps `jwt:nbf:<userId>` with a timestamp on reset, and
 * JwtStrategy.validate rejects any token whose `iat` predates that stamp.
 *
 * ── Units: SECONDS ─────────────────────────────────────────────────────────
 * JWT `iat` is UNIX seconds. The stored nbf is therefore ALSO seconds. Mixing
 * `Date.now()` (ms) with `iat` (s) silently admits or rejects everything — the
 * #1 trap. Everything here is seconds.
 *
 * ── Same-second clock-skew guard (the +1) ──────────────────────────────────
 * `bumpUser` stores `floor(now) + 1`, and validate compares with STRICT
 * `iat < nbf`. A token minted in the SAME second as the reset has `iat == bumpSec`,
 * and `bumpSec < bumpSec + 1` → rejected. A token minted the next second or later
 * (`iat >= bumpSec + 1`) passes. Without the +1, a strict `<` would let a
 * same-second pre-existing token slip through.
 *
 * ── Fail OPEN on the nbf read ──────────────────────────────────────────────
 * On a Redis error the read returns null (no gate) and the token is admitted,
 * matching LoginLockoutService's documented fail-open stance. This is safe here:
 * JwtStrategy.validate runs the fail-CLOSED jti blacklist check FIRST, and every
 * access token carries a jti — so a full Redis outage already 401s every request
 * before the nbf gate is reached. Fail-open only affects transient errors on the
 * nbf key alone, where the 15-min access TTL caps the residual exposure.
 *
 * ── Construction ───────────────────────────────────────────────────────────
 * Same ioredis construction as JwtBlacklistService / LoginLockoutService: a
 * second connection to the SAME Redis server, not a new backend dependency.
 */
@Injectable()
export class JwtNotBeforeService {
  private readonly redis: Redis;
  private readonly logger = new Logger(JwtNotBeforeService.name);
  private static readonly KEY_PREFIX = 'jwt:nbf:';

  /**
   * Margin added to the access TTL when setting the key's own TTL, so the key
   * always OUTLIVES any token it could possibly gate. A too-long key is harmless
   * (a stale nbf older than every live token rejects nothing); a too-short key
   * would expire while a live pre-reset token still exists, silently reopening
   * the hole — so the key TTL must err long.
   */
  private static readonly TTL_MARGIN_SECONDS = 60;

  /** Generous fallback if the configured access TTL can't be parsed (errs long). */
  private static readonly DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;

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
   * Parse the configured access TTL (e.g. '15m', '900', '1h', '7d', '30s') into
   * seconds. On any ambiguity, falls back to DEFAULT_ACCESS_TTL_SECONDS — never
   * shorter — so the key TTL can only ever be too generous, never too tight.
   */
  private accessTtlSeconds(): number {
    const raw =
      this.configService.get<string>('JWT_ACCESS_TTL') ||
      this.configService.get<string>('JWT_EXPIRES_IN') ||
      '15m';
    const match = /^(\d+)\s*([smhd]?)$/.exec(String(raw).trim());
    if (!match) {
      return JwtNotBeforeService.DEFAULT_ACCESS_TTL_SECONDS;
    }
    const value = parseInt(match[1], 10);
    if (!Number.isFinite(value) || value <= 0) {
      return JwtNotBeforeService.DEFAULT_ACCESS_TTL_SECONDS;
    }
    switch (match[2]) {
      case 'd':
        return value * 86400;
      case 'h':
        return value * 3600;
      case 'm':
        return value * 60;
      case 's':
      case '':
        return value;
      default:
        return JwtNotBeforeService.DEFAULT_ACCESS_TTL_SECONDS;
    }
  }

  /**
   * Bump the user's nbf to now, invalidating every access token minted before
   * this instant. Stores `floor(now) + 1` (seconds) — see the same-second guard
   * note above. The key self-expires after the access TTL (+ margin) so a stale
   * nbf can never outlive every token it could gate.
   */
  async bumpUser(userId: string): Promise<void> {
    if (!userId) return;
    const nbfSeconds = Math.floor(Date.now() / 1000) + 1;
    const ttl = this.accessTtlSeconds() + JwtNotBeforeService.TTL_MARGIN_SECONDS;
    try {
      await this.redis.set(
        `${JwtNotBeforeService.KEY_PREFIX}${userId}`,
        String(nbfSeconds),
        'EX',
        ttl,
      );
    } catch (err) {
      this.logger.error(
        `Failed to bump nbf for user=${userId}: ${String(err)}`,
      );
    }
  }

  /**
   * Read the user's nbf (UNIX seconds), or null if none is set / on Redis error.
   * Fails OPEN (null) on error — see the fail-open note above.
   */
  async getNotBefore(userId: string): Promise<number | null> {
    if (!userId) return null;
    try {
      const value = await this.redis.get(
        `${JwtNotBeforeService.KEY_PREFIX}${userId}`,
      );
      if (value === null) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    } catch (err) {
      this.logger.warn(
        `nbf read failed for user=${userId}, failing open: ${String(err)}`,
      );
      return null;
    }
  }
}
