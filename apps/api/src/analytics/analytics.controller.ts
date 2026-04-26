import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';

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
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AnalyticsResponseDto> {
    return this.analyticsService.getAnalytics(query, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Get('export')
  @RequirePermissions('reports:export')
  @ApiOperation({ summary: 'Export analytics data as JSON' })
  async exportAnalytics(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.analyticsService.exportAnalytics(query, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }
}
