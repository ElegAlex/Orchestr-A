import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('should call $connect on module init', async () => {
      const service = new PrismaService();
      const connectSpy = vi
        .spyOn(service, '$connect')
        .mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should log via NestJS Logger (not console.log) on connect', async () => {
      const service = new PrismaService();
      vi.spyOn(service, '$connect').mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const loggerSpy = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect on module destroy', async () => {
      const service = new PrismaService();
      const disconnectSpy = vi
        .spyOn(service, '$disconnect')
        .mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should log via NestJS Logger (not console.log) on disconnect', async () => {
      const service = new PrismaService();
      vi.spyOn(service, '$disconnect').mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const loggerSpy = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});

      await service.onModuleDestroy();

      expect(loggerSpy).toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('slow-query observability (OBS-023)', () => {
    let service: PrismaService;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      service = new PrismaService();
      vi.spyOn(service, '$connect').mockResolvedValue(undefined);
      warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    });

    it('should register a $on("query") listener during onModuleInit', async () => {
      const onSpy = vi.spyOn(service, '$on');

      await service.onModuleInit();

      expect(onSpy).toHaveBeenCalledWith('query', expect.any(Function));
    });

    it('should call Logger.warn for queries exceeding the slow-query threshold', async () => {
      let capturedHandler:
        | ((e: { duration: number; query: string }) => void)
        | undefined;
      vi.spyOn(service, '$on').mockImplementation(
        (event: string, handler: (e: unknown) => void) => {
          if (event === 'query') {
            capturedHandler = handler as (e: {
              duration: number;
              query: string;
            }) => void;
          }
        },
      );

      await service.onModuleInit();
      expect(capturedHandler).toBeDefined();

      // Slow query — above threshold — must trigger warn
      capturedHandler!({ duration: 250, query: 'SELECT 1' });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('should NOT call Logger.warn for fast queries below the slow-query threshold', async () => {
      let capturedHandler:
        | ((e: { duration: number; query: string }) => void)
        | undefined;
      vi.spyOn(service, '$on').mockImplementation(
        (event: string, handler: (e: unknown) => void) => {
          if (event === 'query') {
            capturedHandler = handler as (e: {
              duration: number;
              query: string;
            }) => void;
          }
        },
      );

      await service.onModuleInit();
      expect(capturedHandler).toBeDefined();

      // Fast query — below threshold — must NOT trigger warn
      capturedHandler!({ duration: 50, query: 'SELECT 1' });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanDatabase', () => {
    it('should throw an error when NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const service = new PrismaService();
      await expect(service.cleanDatabase()).rejects.toThrow(
        'Cannot clean database in production',
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should call deleteMany on models with that method in non-production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const service = new PrismaService();

      // Inject a mock model with deleteMany
      const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
      (service as any).testModel = { deleteMany: mockDeleteMany };
      // A key starting with _ should be filtered out by the Reflect.ownKeys filter
      Object.defineProperty(service, '_privateKey', {
        value: { deleteMany: vi.fn() },
        enumerable: true,
      });
      // A key with no deleteMany method — should resolve to Promise.resolve()
      (service as any).nonModelProp = 'just a string';

      const result = await service.cleanDatabase();

      expect(Array.isArray(result)).toBe(true);
      expect(mockDeleteMany).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should skip non-model properties that are not objects with deleteMany', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const service = new PrismaService();
      // No real models that respond, just primitive properties
      (service as any).aStringProp = 'value';
      (service as any).aNumberProp = 42;

      // Should not throw — just resolve
      const result = await service.cleanDatabase();
      expect(Array.isArray(result)).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });
});
