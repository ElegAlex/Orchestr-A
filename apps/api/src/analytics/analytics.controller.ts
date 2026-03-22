import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  AnalyticsResponseDto,
  WorkloadUserDto,
  VelocityPeriodDto,
  BurndownPointDto,
} from './dto/analytics-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @Permissions('reports:view')
  @ApiOperation({ summary: 'Get analytics data with filters' })
  async getAnalytics(
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    return this.analyticsService.getAnalytics(query);
  }

  @Get('export')
  @Permissions('reports:export')
  @ApiOperation({ summary: 'Export analytics data as JSON' })
  async exportAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.exportAnalytics(query);
  }

  @Get('workload')
  @Permissions('reports:view')
  @ApiOperation({
    summary: 'Get workload per user (planned hours vs capacity)',
  })
  async getWorkload(
    @Query() query: AnalyticsQueryDto,
  ): Promise<WorkloadUserDto[]> {
    return this.analyticsService.getWorkload(query);
  }

  @Get('velocity')
  @Permissions('reports:view')
  @ApiOperation({
    summary: 'Get team velocity: completed vs planned tasks per week',
  })
  async getVelocity(
    @Query() query: AnalyticsQueryDto,
  ): Promise<VelocityPeriodDto[]> {
    return this.analyticsService.getVelocity(query);
  }

  @Get('burndown')
  @Permissions('reports:view')
  @ApiOperation({
    summary: 'Get burndown chart data: ideal vs actual remaining tasks',
  })
  async getBurndown(
    @Query() query: AnalyticsQueryDto,
  ): Promise<BurndownPointDto[]> {
    return this.analyticsService.getBurndown(query);
  }
}
