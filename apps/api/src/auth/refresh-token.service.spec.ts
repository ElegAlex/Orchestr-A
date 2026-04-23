import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { RefreshTokenService, parseDurationMs } from './refresh-token.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('parseDurationMs', () => {
  it('parses standard suffixes', () => {
    expect(parseDurationMs('7d', 0)).toBe(7 * 86_400_000);
    expect(parseDurationMs('15m', 0)).toBe(15 * 60_000);
    expect(parseDurationMs('3600s', 0)).toBe(3_600_000);
    expect(parseDurationMs('2h', 0)).toBe(7_200_000);
    expect(parseDurationMs('500ms', 0)).toBe(500);
  });

  it('falls back to default on invalid input', () => {
    expect(parseDurationMs(undefined, 42)).toBe(42);
    expect(parseDurationMs('garbage', 42)).toBe(42);
  });
});

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;

  const mockPrisma = {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(mockPrisma),
    ),
  };

  const mockConfig = {
    get: vi.fn((key: string) => (key === 'JWT_REFRESH_TTL' ? '7d' : undefined)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RefreshTokenService(
      mockPrisma as unknown as PrismaService,
      mockConfig as unknown as ConfigService,
    );
  });

  function sha256(v: string) {
    return crypto.createHash('sha256').update(v).digest('hex');
  }

  describe('issue', () => {
    it('persists the sha256 hash (never the plaintext)', async () => {
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const plaintext = await service.issue('user-1', {
        userAgent: 'UA',
        ip: '1.2.3.4',
      });

      expect(typeof plaintext).toBe('string');
      expect(plaintext.length).toBeGreaterThan(0);
      const call = mockPrisma.refreshToken.create.mock.calls[0][0];
      expect(call.data.userId).toBe('user-1');
      expect(call.data.tokenHash).toBe(sha256(plaintext));
      expect(call.data.tokenHash).not.toBe(plaintext);
      expect(call.data.userAgent).toBe('UA');
      expect(call.data.ip).toBe('1.2.3.4');
      expect(call.data.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('rotate', () => {
    it('revokes the old token and issues a new one', async () => {
      const plaintext = 'old-token';
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: sha256(plaintext),
        expiresAt: new Date(Date.now() + 1_000_000),
        revokedAt: null,
      });
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.rotate(plaintext);

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(result.userId).toBe('user-1');
      expect(typeof result.newRefreshToken).toBe('string');
    });

    it('detects reuse — revokes all user tokens and throws', async () => {
      const plaintext = 'revoked-token';
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: sha256(plaintext),
        expiresAt: new Date(Date.now() + 1_000_000),
        revokedAt: new Date(),
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await expect(service.rotate(plaintext)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('throws when token is unknown', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.rotate('unknown')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when token is expired', async () => {
      const plaintext = 'expired-token';
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-2',
        userId: 'user-1',
        tokenHash: sha256(plaintext),
        expiresAt: new Date(Date.now() - 1),
        revokedAt: null,
      });
      await expect(service.rotate(plaintext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revokeAllForUser', () => {
    it('marks all non-revoked tokens as revoked', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
      await service.revokeAllForUser('user-1');
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
