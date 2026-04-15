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

  beforeEach(() => {
    mockConfig.get.mockClear();
    mockPrisma.user.findUnique.mockReset();
    mockBlacklist.isBlacklisted.mockReset();
    strategy = new JwtStrategy(
      mockConfig as unknown as ConfigService,
      mockPrisma as any,
      mockBlacklist as any,
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
});
