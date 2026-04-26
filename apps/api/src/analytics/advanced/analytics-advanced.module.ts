import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsModule } from '../../projects/projects.module';
import { CommonModule } from '../../common/common.module';
import { AnalyticsAdvancedController } from './analytics-advanced.controller';
import { SnapshotSchedulerService } from './snapshot-scheduler.service';
import { SnapshotsQueryService } from './services/snapshots-query.service';
import { WorkloadService } from './services/workload.service';
import { ProjectHealthService } from './services/project-health.service';
import { MilestonesCompletionService } from './services/milestones-completion.service';
import { TasksBreakdownService } from './services/tasks-breakdown.service';
import { RecentActivityService } from './services/recent-activity.service';

@Module({
  imports: [PrismaModule, ProjectsModule, CommonModule],
  controllers: [AnalyticsAdvancedController],
  providers: [
    SnapshotSchedulerService,
    SnapshotsQueryService,
    WorkloadService,
    ProjectHealthService,
    MilestonesCompletionService,
    TasksBreakdownService,
    RecentActivityService,
  ],
})
export class AnalyticsAdvancedModule {}
