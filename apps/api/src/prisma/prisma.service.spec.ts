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

    it('should refuse to clean a database whose name is not a test target', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const service = new PrismaService();
      // Dev/prod-shaped name → must be rejected before any TRUNCATE.
      (service as any).$queryRaw = vi
        .fn()
        .mockResolvedValue([{ db: 'orchestr_a_v2' }]);
      const execSpy = vi.fn().mockResolvedValue(undefined);
      (service as any).$executeRawUnsafe = execSpy;

      await expect(service.cleanDatabase()).rejects.toThrow(
        /Refusing to clean non-test database "orchestr_a_v2"/,
      );
      expect(execSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should TRUNCATE every public table (except migrations) on a test database', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const service = new PrismaService();
      // 1st $queryRaw → current_database(); 2nd → table list.
      (service as any).$queryRaw = vi
        .fn()
        .mockResolvedValueOnce([{ db: 'orchestr_a_v2_e2e' }])
        .mockResolvedValueOnce([
          { tablename: 'users' },
          { tablename: 'audit_logs' },
        ]);
      const execSpy = vi.fn().mockResolvedValue(undefined);
      (service as any).$executeRawUnsafe = execSpy;

      await expect(service.cleanDatabase()).resolves.toBeUndefined();

      const calls = execSpy.mock.calls.map((c) => String(c[0]));
      // audit_logs immutability triggers toggled around the truncate.
      expect(calls.some((s) => /DISABLE TRIGGER USER/.test(s))).toBe(true);
      expect(calls.some((s) => /ENABLE TRIGGER USER/.test(s))).toBe(true);
      // Single atomic TRUNCATE listing the discovered tables.
      const truncate = calls.find((s) => s.startsWith('TRUNCATE TABLE'));
      expect(truncate).toBeDefined();
      expect(truncate).toContain('"users"');
      expect(truncate).toContain('"audit_logs"');
      expect(truncate).toContain('RESTART IDENTITY CASCADE');

      process.env.NODE_ENV = originalEnv;
    });

    it('should re-enable audit_logs triggers even if the TRUNCATE fails', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const service = new PrismaService();
      (service as any).$queryRaw = vi
        .fn()
        .mockResolvedValueOnce([{ db: 'orchestr_a_v2_e2e' }])
        .mockResolvedValueOnce([{ tablename: 'users' }]);
      const execSpy = vi.fn().mockImplementation((sql: string) => {
        if (sql.startsWith('TRUNCATE')) {
          return Promise.reject(new Error('boom'));
        }
        return Promise.resolve(undefined);
      });
      (service as any).$executeRawUnsafe = execSpy;

      await expect(service.cleanDatabase()).rejects.toThrow('boom');
      const calls = execSpy.mock.calls.map((c) => String(c[0]));
      // The finally block must still restore the triggers.
      expect(calls.some((s) => /ENABLE TRIGGER USER/.test(s))).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });
});
