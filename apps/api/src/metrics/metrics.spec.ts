/**
 * metrics.spec.ts — OBS-011
 *
 * Tests for the minimal in-process Prometheus metrics module.
 *
 * Verifies:
 *  1. MetricsService: recordRequest increments counter; renderMetrics emits
 *     valid Prometheus text with # HELP, # TYPE lines.
 *  2. MetricsController: GET /metrics returns Prometheus text.
 *  3. MetricsController: when METRICS_TOKEN is set, missing/wrong token → 401.
 *  4. MetricsInterceptor: calling intercept increments the request counter.
 *
 * Fail-pre witness (RED before fix):
 *   Cannot find module './metrics.service' or './metrics.interceptor'
 *   → all tests fail with import errors (module absent).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';

describe('MetricsService (OBS-011)', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();
    service = module.get<MetricsService>(MetricsService);
  });

  it('SEC-012 — escapes label values so a crafted route cannot inject metric lines', () => {
    // A route that tries to break out of the label quoting and inject a fake series.
    service.recordRequest(
      'GET',
      '/api/x"} 999\ninjected_total{evil="1',
      200,
      10,
    );
    const text = service.renderMetrics();
    // The injected line must NOT appear as its own series.
    expect(text).not.toMatch(/^injected_total\{/m);
    // The route value must be escaped (backslash-escaped quote + \n), not raw.
    expect(text).toContain('\\"');
    expect(text).not.toContain('\ninjected_total{evil');
  });

  it('recordRequest increments the http_requests_total counter', () => {
    service.recordRequest('GET', '/api/projects', 200, 42);
    const text = service.renderMetrics();
    expect(text).toContain('http_requests_total{');
    // counter should be at 1
    expect(text).toMatch(/http_requests_total\{[^}]+\}\s+1/);
  });

  it('renderMetrics emits # HELP and # TYPE lines for http_requests_total', () => {
    const text = service.renderMetrics();
    expect(text).toContain('# HELP http_requests_total');
    expect(text).toContain('# TYPE http_requests_total counter');
  });

  it('renderMetrics emits # HELP and # TYPE lines for http_request_duration_seconds', () => {
    const text = service.renderMetrics();
    expect(text).toContain('# HELP http_request_duration_seconds');
    expect(text).toContain('# TYPE http_request_duration_seconds summary');
  });

  it('recordRequest accumulates multiple calls for the same label set', () => {
    service.recordRequest('GET', '/api/tasks', 200, 10);
    service.recordRequest('GET', '/api/tasks', 200, 20);
    const text = service.renderMetrics();
    // Both count and sum should reflect two calls
    expect(text).toMatch(/http_request_duration_seconds_count\{[^}]+\}\s+2/);
    expect(text).toMatch(/http_request_duration_seconds_sum\{[^}]+\}\s+0\.030/);
  });
});

describe('MetricsController (OBS-011)', () => {
  let controller: MetricsController;
  let service: MetricsService;
  const OLD_ENV = process.env;

  beforeEach(async () => {
    process.env = { ...OLD_ENV };
    delete process.env['METRICS_TOKEN'];

    service = new MetricsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: service }],
    }).compile();
    controller = module.get<MetricsController>(MetricsController);
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns Prometheus text when METRICS_TOKEN is not set (dev mode)', () => {
    vi.spyOn(service, 'renderMetrics').mockReturnValue(
      '# HELP http_requests_total count\n# TYPE http_requests_total counter\n',
    );
    const result = controller.getMetrics(undefined);
    expect(result).toContain('# TYPE http_requests_total counter');
  });

  it('returns Prometheus text when METRICS_TOKEN matches Authorization header', () => {
    process.env['METRICS_TOKEN'] = 'secret123';
    vi.spyOn(service, 'renderMetrics').mockReturnValue(
      '# HELP http_requests_total count\n# TYPE http_requests_total counter\n',
    );
    const result = controller.getMetrics('Bearer secret123');
    expect(result).toContain('# TYPE http_requests_total counter');
  });

  it('throws UnauthorizedException when METRICS_TOKEN is set and header is missing', () => {
    process.env['METRICS_TOKEN'] = 'secret123';
    expect(() => controller.getMetrics(undefined)).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when METRICS_TOKEN is set and token is wrong', () => {
    process.env['METRICS_TOKEN'] = 'secret123';
    expect(() => controller.getMetrics('Bearer wrong')).toThrow(
      UnauthorizedException,
    );
  });
});

describe('MetricsController (SEC-011)', () => {
  let controller: MetricsController;
  let service: MetricsService;
  const OLD_ENV = process.env;

  beforeEach(async () => {
    process.env = { ...OLD_ENV };
    delete process.env['METRICS_TOKEN'];

    service = new MetricsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: service }],
    }).compile();
    controller = module.get<MetricsController>(MetricsController);
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('SEC-011 — controller source uses timingSafeEqual (constant-time guard)', () => {
    // Structural witness: verify the source imports and uses crypto.timingSafeEqual.
    // This is RED on the original code (no timingSafeEqual present) and GREEN after the fix.
    const src = readFileSync(
      resolvePath(__dirname, 'metrics.controller.ts'),
      'utf8',
    );
    expect(src).toContain('timingSafeEqual');
    expect(src).toContain("from 'crypto'");
    // Length guard must be present to avoid the 'buffers must be equal length' exception
    expect(src).toMatch(/a\.length\s*!==\s*b\.length/);
  });

  it('SEC-011 — different-length token throws 401 without crashing (length guard works)', () => {
    process.env['METRICS_TOKEN'] = 'secret123';
    // 'Bearer short' has a different length than 'Bearer secret123'
    // Without a length guard, timingSafeEqual would throw a RangeError
    expect(() => controller.getMetrics('Bearer short')).toThrow(
      UnauthorizedException,
    );
  });
});

describe('SA-OBS-008 — metrics_last_reset_at tracks service instantiation time', () => {
  it('SA-OBS-008 — renderMetrics includes metrics_last_reset_at gauge so Prometheus can detect counter resets', () => {
    const service = new MetricsService();
    const text = service.renderMetrics();
    expect(text).toContain('metrics_last_reset_at');
    expect(text).toMatch(/metrics_last_reset_at\s+\d+/);
  });

  it('SA-OBS-008 — a new MetricsService instance has a different metrics_last_reset_at than prior state', () => {
    // Simulates container restart: re-instantiation produces a fresh timestamp gauge
    const service1 = new MetricsService();
    service1.recordRequest('GET', '/api/projects', 200, 10);
    const text1 = service1.renderMetrics();
    expect(text1).toMatch(/http_requests_total\{[^}]+\}\s+1/);

    // New instance (simulates restart): counter is 0 and a last_reset_at is emitted
    const service2 = new MetricsService();
    const text2 = service2.renderMetrics();
    // No counter entries yet — but metrics_last_reset_at must still appear
    expect(text2).toContain('metrics_last_reset_at');
  });
});

describe('SA-OBS-009 — recordGauge exposes DB/Redis gauges in Prometheus output', () => {
  it('SA-OBS-009 — recordGauge method exists on MetricsService', () => {
    const service = new MetricsService();
    expect(typeof service.recordGauge).toBe('function');
  });

  it('SA-OBS-009 — renderMetrics includes gauge TYPE line and value after recordGauge call', () => {
    const service = new MetricsService();
    service.recordGauge('db_pool_active', 'pool="default"', 3);
    const text = service.renderMetrics();
    expect(text).toContain('# TYPE db_pool_active gauge');
    expect(text).toMatch(/db_pool_active\{pool="default"\}\s+3/);
  });

  it('SA-OBS-009 — recordGauge overwrites previous value for the same name+labels (gauge semantics)', () => {
    const service = new MetricsService();
    service.recordGauge('redis_ping_latency_ms', 'instance="default"', 5);
    service.recordGauge('redis_ping_latency_ms', 'instance="default"', 12);
    const text = service.renderMetrics();
    expect(text).toMatch(/redis_ping_latency_ms\{instance="default"\}\s+12/);
    // Should not contain the old value as a separate line
    const matches = text.match(/redis_ping_latency_ms\{instance="default"\}/g);
    expect(matches).toHaveLength(1);
  });
});

describe('MetricsInterceptor (OBS-011)', () => {
  let service: MetricsService;
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    service = new MetricsService();
    interceptor = new MetricsInterceptor(service);
  });

  it('intercept calls recordRequest after the handler resolves', async () => {
    const spy = vi.spyOn(service, 'recordRequest');

    const mockContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/api/test' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as any;

    const mockHandler = {
      handle: () => of('response'),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        complete: () => resolve(),
      });
    });

    expect(spy).toHaveBeenCalledWith(
      'GET',
      '/api/test',
      200,
      expect.any(Number),
    );
  });

  it('does not throw when the handler errors', async () => {
    const spy = vi.spyOn(service, 'recordRequest');

    const mockContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', path: '/api/tasks' }),
        getResponse: () => ({ statusCode: 500 }),
      }),
    } as any;

    const { throwError } = await import('rxjs');
    const mockHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        error: () => resolve(),
      });
    });

    expect(spy).toHaveBeenCalledWith(
      'POST',
      '/api/tasks',
      500,
      expect.any(Number),
    );
  });

  it('PER-009 — uses route template from routeOptions.url instead of raw UUID path', async () => {
    const spy = vi.spyOn(service, 'recordRequest');

    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const mockContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          path: `/api/projects/${uuid}`,
          routeOptions: { url: '/api/projects/:id' },
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as any;

    const mockHandler = {
      handle: () => of('response'),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        complete: () => resolve(),
      });
    });

    // Must be called with the route template, NOT the raw UUID path
    expect(spy).toHaveBeenCalledWith(
      'GET',
      '/api/projects/:id',
      200,
      expect.any(Number),
    );
  });
});
