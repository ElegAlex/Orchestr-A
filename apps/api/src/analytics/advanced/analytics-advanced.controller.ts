import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import {
  SnapshotsQueryDto,
  SnapshotsResponseDto,
} from './dto/snapshots-query.dto';
import { WorkloadQueryDto, WorkloadUserDto } from './dto/workload.dto';
import { ProjectHealthRowDto } from './dto/project-health.dto';
import { MilestonesCompletionResponseDto } from './dto/milestones-completion.dto';
import {
  TasksBreakdownQueryDto,
  TasksBreakdownResponseDto,
} from './dto/tasks-breakdown.dto';
import {
  RecentActivityQueryDto,
  RecentActivityResponseDto,
} from './dto/recent-activity.dto';
import { SnapshotsQueryService } from './services/snapshots-query.service';
import { WorkloadService } from './services/workload.service';
import { ProjectHealthService } from './services/project-health.service';
import { MilestonesCompletionService } from './services/milestones-completion.service';
import { TasksBreakdownService } from './services/tasks-breakdown.service';
import { RecentActivityService } from './services/recent-activity.service';

@ApiTags('analytics-advanced')
@Controller('analytics/advanced')
@ApiBearerAuth()
export class AnalyticsAdvancedController {
  constructor(
    private readonly snapshotsQuery: SnapshotsQueryService,
    private readonly workload: WorkloadService,
    private readonly projectHealth: ProjectHealthService,
    private readonly milestonesCompletion: MilestonesCompletionService,
    private readonly tasksBreakdown: TasksBreakdownService,
    private readonly recentActivity: RecentActivityService,
  ) {}

  @Get('snapshots')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary:
      'Multi-series snapshots per project + portfolio average (blocs 1 & 2)',
  })
  async getSnapshots(
    @Query() query: SnapshotsQueryDto,
  ): Promise<SnapshotsResponseDto> {
    return this.snapshotsQuery.getSnapshots(query);
  }

  @Get('workload')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Top users by active task count, UNION DISTINCT (bloc 3)',
  })
  async getWorkload(
    @Query() query: WorkloadQueryDto,
  ): Promise<WorkloadUserDto[]> {
    return this.workload.getWorkload(query);
  }

  @Get('project-health')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Per-project health table with overdueMilestones-based status (bloc 4)',
  })
  async getProjectHealth(): Promise<ProjectHealthRowDto[]> {
    return this.projectHealth.getProjectHealth();
  }

  @Get('milestones-completion')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Milestones reached on time over due, with per-project breakdown (bloc 5)',
  })
  async getMilestonesCompletion(): Promise<MilestonesCompletionResponseDto> {
    return this.milestonesCompletion.getMilestonesCompletion();
  }

  @Get('tasks-breakdown')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Tasks count grouped by priority and by status (bloc 6)',
  })
  async getTasksBreakdown(
    @Query() query: TasksBreakdownQueryDto,
  ): Promise<TasksBreakdownResponseDto> {
    return this.tasksBreakdown.getTasksBreakdown(query);
  }

  @Get('recent-activity')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: '4 KPI tiles + 30-day completion trend (bloc 7)',
  })
  async getRecentActivity(
    @Query() query: RecentActivityQueryDto,
  ): Promise<RecentActivityResponseDto> {
    return this.recentActivity.getRecentActivity(query);
  }
}
