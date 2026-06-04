import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockConfig = {
    get: vi.fn((key: string) =>
      key === 'JWT_SECRET' ? 'test-secret' : undefined,
    ),
  };

  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
  };

  const mockBlacklist = {
    isBlacklisted: vi.fn(),
    blacklist: vi.fn(),
  };

  const mockNotBefore = {
    getNotBefore: vi.fn(),
    bumpUser: vi.fn(),
  };

  beforeEach(() => {
    mockConfig.get.mockClear();
    mockPrisma.user.findUnique.mockReset();
    mockBlacklist.isBlacklisted.mockReset();
    mockNotBefore.getNotBefore.mockReset();
    // Default: no nbf set for the user, so existing tests behave as before.
    mockNotBefore.getNotBefore.mockResolvedValue(null);
    strategy = new JwtStrategy(
      mockConfig as unknown as ConfigService,
      mockPrisma as any,
      mockBlacklist as any,
      mockNotBefore as any,
    );
  });

  it('returns the user when jti is not blacklisted', async () => {
    mockBlacklist.isBlacklisted.mockResolvedValue(false);
    const user = { id: 'u1', isActive: true, role: 'CONTRIBUTEUR' };
    mockPrisma.user.findUnique.mockResolvedValue(user);

    const result = await strategy.validate({
      sub: 'u1',
      login: 'x',
      role: 'CONTRIBUTEUR',
      jti: 'jti-ok',
      exp: 999,
    });

    expect(result).toMatchObject({ id: 'u1', jti: 'jti-ok', exp: 999 });
  });

  it('throws UnauthorizedException when jti is blacklisted', async () => {
    mockBlacklist.isBlacklisted.mockResolvedValue(true);

    await expect(
      strategy.validate({
        sub: 'u1',
        login: 'x',
        role: 'CONTRIBUTEUR',
        jti: 'jti-revoked',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('throws when user is missing or inactive', async () => {
    mockBlacklist.isBlacklisted.mockResolvedValue(false);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'u1', login: 'x', role: 'ADMIN' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // SEC-019 — per-user not-valid-before (nbf) gate. iat and nbf are both
  // UNIX seconds; the comparison is strict `iat < nbf`. nbf = 1000 here.
  describe('nbf gate (SEC-019)', () => {
    const NBF = 1000;
    const okUser = { id: 'u1', isActive: true, role: 'CONTRIBUTEUR' };

    beforeEach(() => {
      mockBlacklist.isBlacklisted.mockResolvedValue(false);
      mockNotBefore.getNotBefore.mockResolvedValue(NBF);
      mockPrisma.user.findUnique.mockResolvedValue(okUser);
    });

    it('rejects a token whose iat predates nbf (iat = nbf - 1)', async () => {
      await expect(
        strategy.validate({
          sub: 'u1',
          login: 'x',
          role: 'CONTRIBUTEUR',
          iat: NBF - 1,
        }),
      ).rejects.toThrow(UnauthorizedException);
      // Gate short-circuits before the DB fetch.
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('admits a token at the boundary (iat = nbf)', async () => {
      const result = await strategy.validate({
        sub: 'u1',
        login: 'x',
        role: 'CONTRIBUTEUR',
        iat: NBF,
      });
      expect(result).toMatchObject({ id: 'u1' });
    });

    it('admits a token minted after nbf (iat = nbf + 1)', async () => {
      const result = await strategy.validate({
        sub: 'u1',
        login: 'x',
        role: 'CONTRIBUTEUR',
        iat: NBF + 1,
      });
      expect(result).toMatchObject({ id: 'u1' });
    });

    // The +1 baked into the stored nbf is what makes a token minted in the SAME
    // second as the reset (iat = bumpSec) fail. bumpUser stores bumpSec + 1, so
    // a same-second token has iat = NBF - 1 relative to the stored value.
    it('rejects a same-second pre-reset token (stored nbf = bumpSec + 1)', async () => {
      const bumpSec = 5000;
      mockNotBefore.getNotBefore.mockResolvedValue(bumpSec + 1);
      await expect(
        strategy.validate({
          sub: 'u1',
          login: 'x',
          role: 'CONTRIBUTEUR',
          iat: bumpSec,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('admits when no nbf is set for the user (fail-open / no reset)', async () => {
      mockNotBefore.getNotBefore.mockResolvedValue(null);
      const result = await strategy.validate({
        sub: 'u1',
        login: 'x',
        role: 'CONTRIBUTEUR',
        iat: 1,
      });
      expect(result).toMatchObject({ id: 'u1' });
    });
  });
});
