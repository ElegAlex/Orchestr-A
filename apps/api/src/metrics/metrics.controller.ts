import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { MetricsService } from './metrics.service';

/**
 * OBS-011 — Exposes /api/metrics in Prometheus text format.
 *
 * Auth logic:
 *  - If METRICS_TOKEN is unset (dev/test), the endpoint is fully open.
 *  - If METRICS_TOKEN is set, the request MUST include an Authorization header
 *    matching "Bearer <METRICS_TOKEN>". Otherwise → 401.
 *
 * We mark the controller @Public() to bypass the global JwtAuthGuard and
 * enforce our own lightweight token check instead.
 */
@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  getMetrics(
    @Headers('authorization') authorization: string | undefined,
  ): string {
    const token = process.env['METRICS_TOKEN'];
    if (token) {
      const expected = `Bearer ${token}`;
      if (!authorization || authorization !== expected) {
        throw new UnauthorizedException('Invalid or missing METRICS_TOKEN');
      }
    }
    return this.metricsService.renderMetrics();
  }
}
