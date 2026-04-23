import { describe, it, expect, vi, afterEach } from 'vitest';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  afterEach(() => {
    vi.clearAllMocks();
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
