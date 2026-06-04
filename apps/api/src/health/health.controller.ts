import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService, HealthStatus } from './health.service';

/**
 * OBS-019 — Replaces the stub /health endpoint in AppController.
 * Performs real DB + Redis pings; returns HTTP 503 when any dependency is down.
 * Does NOT expose uptime, NODE_ENV, or any process-internal information.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async getHealth(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
