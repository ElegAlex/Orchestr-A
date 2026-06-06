import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

/** Public HTTP response shape — no per-component detail (SEC-007). */
export interface HealthStatus {
  status: 'ok' | 'degraded';
}

/** Internal shape used for server-side logging only. */
type HealthDetail = {
  status: 'ok' | 'degraded';
  db: 'ok' | 'down';
  redis: 'ok' | 'down';
};

/**
 * OBS-019 — Real health check: pings DB (SELECT 1) and Redis (PING).
 * Returns HTTP 503 (via ServiceUnavailableException) if any dependency is down.
 * Does NOT expose process.uptime, NODE_ENV, or any internal process info.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        connectTimeout: 3000,
        commandTimeout: 3000,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
    } else {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');
      this.redis = new Redis({
        host,
        port,
        password: password || undefined,
        connectTimeout: 3000,
        commandTimeout: 3000,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
    }
  }

  async check(): Promise<HealthStatus> {
    let dbStatus: 'ok' | 'down' = 'ok';
    let redisStatus: 'ok' | 'down' = 'ok';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      this.logger.warn(`DB health ping failed: ${String(err)}`);
      dbStatus = 'down';
    }

    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        this.logger.warn(
          `Redis health ping returned unexpected: ${String(pong)}`,
        );
        redisStatus = 'down';
      }
    } catch (err) {
      this.logger.warn(`Redis health ping failed: ${String(err)}`);
      redisStatus = 'down';
    }

    if (dbStatus === 'down' || redisStatus === 'down') {
      const detail: HealthDetail = {
        status: 'degraded',
        db: dbStatus,
        redis: redisStatus,
      };
      this.logger.warn(`Health check degraded: ${JSON.stringify(detail)}`);
      throw new ServiceUnavailableException({ status: 'degraded' });
    }

    return { status: 'ok' };
  }
}
