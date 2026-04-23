import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProjectsService } from '../../projects/projects.service';

const SNAPSHOT_CRON = '0 23 * * *';
const SNAPSHOT_TZ = 'Europe/Paris';

@Injectable()
export class SnapshotSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SnapshotSchedulerService.name);

  constructor(private readonly projectsService: ProjectsService) {}

  onModuleInit() {
    this.logger.log(
      `Snapshot capture cron registered: '${SNAPSHOT_CRON}' (timezone ${SNAPSHOT_TZ})`,
    );
  }

  @Cron(SNAPSHOT_CRON, { timeZone: SNAPSHOT_TZ })
  async captureDailySnapshots() {
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
