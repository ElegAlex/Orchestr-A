import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';

/**
 * OBS-011 — Minimal in-process Prometheus metrics module.
 *
 * Registers:
 *  - MetricsService: in-process counters and summaries (no prom-client dep).
 *  - MetricsController: GET /api/metrics → Prometheus text format.
 *  - MetricsInterceptor: global APP_INTERCEPTOR to capture every request.
 */
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
