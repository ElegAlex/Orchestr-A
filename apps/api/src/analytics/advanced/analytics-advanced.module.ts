import { Module } from '@nestjs/common';
import { ProjectsModule } from '../../projects/projects.module';
import { SnapshotSchedulerService } from './snapshot-scheduler.service';

@Module({
  imports: [ProjectsModule],
  providers: [SnapshotSchedulerService],
})
export class AnalyticsAdvancedModule {}
