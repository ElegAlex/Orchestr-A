import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Get analytics data with filters' })
  async getAnalytics(
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    return this.analyticsService.getAnalytics(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export analytics data as JSON' })
  async exportAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.exportAnalytics(query);
  }
}
