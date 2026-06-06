import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ProjectsService } from '../../projects/projects.service';
import Redis from 'ioredis';

const SNAPSHOT_CRON = '0 23 * * *';
const SNAPSHOT_TZ = 'Europe/Paris';

/**
 * PER-029 — Redis-based leader-lock key for the daily snapshot cron.
 *
 * All API replicas fire the @Cron at the same tick. Only the replica that
 * acquires the SET NX EX lock runs captureSnapshots(); the others skip it.
 *
 * We do NOT delete the key in a finally block: if the job finishes quickly a
 * slightly-slower replica would immediately re-acquire and double-run — defeating
 * the purpose. The TTL (10 min) is long enough to cover any realistic snapshot
 * duration yet short enough to not block the NEXT night's cron.
 *
 * Fail-open: if Redis is unreachable the snapshot still runs on every replica.
 * For a nightly background job a double-run is less harmful than a missed snapshot.
 */
const LEADER_LOCK_KEY = 'snapshot:leader-lock';
const LEADER_LOCK_TTL_SECONDS = 600; // 10 minutes

@Injectable()
export class SnapshotSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SnapshotSchedulerService.name);
  private readonly redis: Redis;

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly configService: ConfigService,
  ) {
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

  onModuleInit() {
    this.logger.log(
      `Snapshot capture cron registered: '${SNAPSHOT_CRON}' (timezone ${SNAPSHOT_TZ})`,
    );
  }

  // COR-049: close the Redis connection on graceful shutdown to avoid open-handle leaks.
  async onModuleDestroy() {
    await this.redis.quit();
  }

  @Cron(SNAPSHOT_CRON, { timeZone: SNAPSHOT_TZ })
  async captureDailySnapshots() {
    // Acquire distributed leader-lock — fail open if Redis is unreachable.
    let isLeader = true;
    try {
      const result = await this.redis.set(
        LEADER_LOCK_KEY,
        '1',
        'EX',
        LEADER_LOCK_TTL_SECONDS,
        'NX',
      );
      isLeader = result === 'OK';
    } catch (err) {
      this.logger.warn(
        `Snapshot leader-lock unavailable (Redis error), running anyway: ${String(err)}`,
      );
      // isLeader remains true — fail open
    }

    if (!isLeader) {
      this.logger.log(
        'Snapshot cron: leader-lock held by another replica, skipping',
      );
      return;
    }

    const start = Date.now();
    try {
      const result = await this.projectsService.captureSnapshots();
      this.logger.log(
        `Daily snapshot capture done: ${result.captured} project(s) in ${Date.now() - start}ms`,
      );
    } catch (err) {
      this.logger.error('Daily snapshot capture failed', err as Error);
      throw err;
    }
  }
}
