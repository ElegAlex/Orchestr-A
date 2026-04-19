import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  AnalyticsResponseDto,
} from './dto/analytics-response.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';

@ApiTags('analytics')
@Controller('analytics')
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Get analytics data with filters' })
  async getAnalytics(
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    return this.analyticsService.getAnalytics(query);
  }

  @Get('export')
  @RequirePermissions('reports:export')
  @ApiOperation({ summary: 'Export analytics data as JSON' })
  async exportAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.exportAnalytics(query);
  }

}
