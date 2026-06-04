/**
 * OBS-019 — /health must not expose process.uptime, must return 503 when DB/Redis down.
 *
 * Fail-pre witness (RED before fix):
 *   - AppController.getHealth() returns { uptime: process.uptime() } → assertion
 *     "response has no uptime field" is RED.
 *   - No real DB/Redis check → degraded path cannot return 503.
 *
 * Pass-post (GREEN after fix):
 *   - HealthController returns {status:'ok',db:'ok',redis:'ok'} with no uptime field.
 *   - HealthController throws ServiceUnavailableException (→ HTTP 503) when DB ping fails.
 *   - HealthController throws ServiceUnavailableException (→ HTTP 503) when Redis ping fails.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController (OBS-019)', () => {
  let controller: HealthController;

  const mockHealthService = {
    check: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health — happy path', () => {
    it('returns {status, db, redis} with no uptime field', async () => {
      mockHealthService.check.mockResolvedValue({
        status: 'ok',
        db: 'ok',
        redis: 'ok',
      });

      const result = await controller.getHealth();

      expect(result).toEqual({ status: 'ok', db: 'ok', redis: 'ok' });
      // OBS-019 core: uptime MUST NOT be in the response
      expect(result).not.toHaveProperty('uptime');
      // NODE_ENV must not leak either
      expect(result).not.toHaveProperty('environment');
      expect(result).not.toHaveProperty('timestamp');
    });
  });

  describe('GET /health — degraded DB', () => {
    it('propagates ServiceUnavailableException when DB is down', async () => {
      mockHealthService.check.mockRejectedValue(
        new ServiceUnavailableException('db ping failed'),
      );

      await expect(controller.getHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('GET /health — degraded Redis', () => {
    it('propagates ServiceUnavailableException when Redis is down', async () => {
      mockHealthService.check.mockRejectedValue(
        new ServiceUnavailableException('redis ping failed'),
      );

      await expect(controller.getHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
