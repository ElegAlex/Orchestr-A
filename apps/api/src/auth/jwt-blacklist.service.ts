import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis-backed JWT blacklist keyed by `jti` (token identifier).
 * A token's jti is added with TTL equal to its remaining lifetime on logout,
 * so the key expires naturally when the token would have expired anyway.
 */
@Injectable()
export class JwtBlacklistService {
  private readonly redis: Redis;
  private readonly logger = new Logger(JwtBlacklistService.name);
  private static readonly KEY_PREFIX = 'jwt:blacklist:';

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

  async blacklist(jti: string, ttlSeconds: number): Promise<void> {
    if (!jti) return;
    const ttl = Math.max(1, Math.floor(ttlSeconds));
    try {
      await this.redis.set(`${JwtBlacklistService.KEY_PREFIX}${jti}`, '1', 'EX', ttl);
    } catch (err) {
      this.logger.error(`Failed to blacklist jti=${jti}: ${String(err)}`);
    }
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    if (!jti) return false;
    try {
      const exists = await this.redis.exists(
        `${JwtBlacklistService.KEY_PREFIX}${jti}`,
      );
      return exists === 1;
    } catch (err) {
      this.logger.error(`Failed to check blacklist for jti=${jti}: ${String(err)}`);
      return false;
    }
  }
}
