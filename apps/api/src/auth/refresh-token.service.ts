import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface RefreshTokenMeta {
  userAgent?: string;
  ip?: string;
}

/**
 * Parse a simple duration string (e.g. "7d", "15m", "3600s", "2h") into milliseconds.
 * Falls back to the provided default if parsing fails.
 */
export function parseDurationMs(input: string | undefined, fallbackMs: number): number {
  if (!input) return fallbackMs;
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(input.trim());
  if (!match) {
    const asNumber = Number(input);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
    return fallbackMs;
  }
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'ms').toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * (multipliers[unit] ?? 1);
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private hash(plaintext: string): string {
    return crypto.createHash('sha256').update(plaintext).digest('hex');
  }

  private getTtlMs(): number {
    const raw = this.configService.get<string>('JWT_REFRESH_TTL');
    return parseDurationMs(raw, 7 * 86_400_000); // 7d default
  }

  async issue(userId: string, meta?: RefreshTokenMeta): Promise<string> {
    const plaintext = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hash(plaintext);
    const expiresAt = new Date(Date.now() + this.getTtlMs());

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: meta?.userAgent ?? null,
        ip: meta?.ip ?? null,
      },
    });

    return plaintext;
  }

  /**
   * Rotate a refresh token: validates the provided plaintext, revokes it,
   * and issues a new one. Implements reuse detection — if a revoked token is
   * presented, ALL tokens for that user are revoked and an error is thrown.
   */
  async rotate(
    refreshToken: string,
    meta?: RefreshTokenMeta,
  ): Promise<{ userId: string; newRefreshToken: string }> {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token invalide');
    }
    const tokenHash = this.hash(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) {
      throw new UnauthorizedException('Refresh token inconnu');
    }

    // Reuse detection: revoked token presented again => revoke everything.
    if (existing.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user ${existing.userId} — revoking all tokens`,
      );
      await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedException('Refresh token déjà utilisé');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expiré');
    }

    // Revoke + issue new atomically-ish (best-effort; no strict transaction needed here).
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const newRefreshToken = await this.issue(existing.userId, meta);
    return { userId: existing.userId, newRefreshToken };
  }

  async revoke(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = this.hash(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
