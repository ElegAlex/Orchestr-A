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
export function parseDurationMs(
  input: string | undefined,
  fallbackMs: number,
): number {
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

  getCookieMaxAgeSeconds(): number {
    return Math.floor(this.getTtlMs() / 1000);
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
        userAgent: meta?.userAgent ? meta.userAgent.slice(0, 512) : null,
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

    // Wrap find + revoke + create in a serializable transaction to prevent TOCTOU races.
    // Reuse detection does NOT mutate inside this transaction: throwing inside a
    // Prisma interactive transaction rolls the whole callback back, so a revoke-all
    // performed here would be undone by the subsequent throw — the token family
    // would stay valid and reuse detection would be a silent no-op (SEC-014-REUSE).
    // Instead we surface the reuse signal and run the family-wide revocation in its
    // own committed statement below.
    const result = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.refreshToken.findUnique({
          where: { tokenHash },
        });

        if (!existing) {
          throw new UnauthorizedException('Refresh token inconnu');
        }

        // Reuse detection: a revoked token presented again => the family may be
        // compromised. Signal it; the committed revoke-all happens after the tx.
        if (existing.revokedAt) {
          return { kind: 'reuse' as const, userId: existing.userId };
        }

        if (existing.expiresAt.getTime() < Date.now()) {
          throw new UnauthorizedException('Refresh token expiré');
        }

        // Revoke old token
        await tx.refreshToken.update({
          where: { id: existing.id },
          data: { revokedAt: new Date() },
        });

        // Issue new token within the same transaction
        const plaintext = crypto.randomBytes(48).toString('base64url');
        const newTokenHash = this.hash(plaintext);
        const expiresAt = new Date(Date.now() + this.getTtlMs());

        await tx.refreshToken.create({
          data: {
            userId: existing.userId,
            tokenHash: newTokenHash,
            expiresAt,
            userAgent: meta?.userAgent ? meta.userAgent.slice(0, 512) : null,
            ip: meta?.ip ?? null,
          },
        });

        return {
          kind: 'rotated' as const,
          userId: existing.userId,
          newRefreshToken: plaintext,
        };
      },
      { isolationLevel: 'Serializable' },
    );

    if (result.kind === 'reuse') {
      this.logger.warn(
        `Refresh token reuse detected for user ${result.userId} — revoking all tokens`,
      );
      // Committed family-wide revocation (outside the rolled-back transaction).
      await this.prisma.refreshToken.updateMany({
        where: { userId: result.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token déjà utilisé');
    }

    return {
      userId: result.userId,
      newRefreshToken: result.newRefreshToken,
    };
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
