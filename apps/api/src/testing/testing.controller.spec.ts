import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TestingController } from './testing.controller';

/**
 * TST-017 witness (AC#2). FAILS pre-fix (controller does not exist yet — import
 * will throw at module load). PASSES post-fix: the reset endpoint is guarded so
 * it throws ForbiddenException when NODE_ENV==='production', and calls
 * prisma.cleanDatabase() otherwise.
 *
 * Compile/contract guard: verifies the NODE_ENV prod-guard is in place so
 * the DB-wipe route is never reachable in production.
 */

describe('TestingController (TST-017)', () => {
  const cleanDatabase = vi.fn().mockResolvedValue(undefined);
  const prisma = { cleanDatabase } as unknown as Parameters<
    typeof TestingController.prototype.reset
  >[0];

  let controller: TestingController;

  beforeEach(() => {
    cleanDatabase.mockClear();
    controller = new TestingController(prisma as never);
  });

  describe('reset() — NODE_ENV safety gate', () => {
    it('calls prisma.cleanDatabase() when NODE_ENV is test', async () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      try {
        await controller.reset();
        expect(cleanDatabase).toHaveBeenCalledOnce();
      } finally {
        process.env.NODE_ENV = original;
      }
    });

    it('throws ForbiddenException when NODE_ENV is production', async () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(controller.reset()).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(cleanDatabase).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = original;
      }
    });

    it('calls prisma.cleanDatabase() when NODE_ENV is ci', async () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'ci';
      try {
        await controller.reset();
        expect(cleanDatabase).toHaveBeenCalledOnce();
      } finally {
        process.env.NODE_ENV = original;
      }
    });
  });
});
