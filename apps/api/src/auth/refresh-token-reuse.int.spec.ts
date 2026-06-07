import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenService } from './refresh-token.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * SEC-014-REUSE — Real-Postgres witness for refresh-token reuse detection.
 *
 * THE BUG this guards
 * -------------------
 * rotate() ran its family-wide revocation (updateMany revokedAt) INSIDE the same
 * Prisma interactive `$transaction` that then `throw`s "Refresh token déjà
 * utilisé". A throw inside an interactive transaction rolls the whole callback
 * back — so the revoke-all was silently undone and the live (rotated) token
 * stayed valid. Reuse detection therefore returned 401 to the replayer but never
 * invalidated the token family, defeating the stolen-token mitigation.
 *
 * Reproduced live (curl against the running API): rotate1→200, replay(old)→401,
 * yet the rotated token remained `revokedAt = NULL` and a subsequent refresh with
 * it returned 200. A mocked-$transaction unit test cannot catch this (the mock
 * does not roll back on throw), which is why this is a real-DB integration spec.
 *
 * GREEN expectation (fixed): replaying a revoked token revokes EVERY non-revoked
 * token for that user, and the previously-issued rotated token can no longer be
 * rotated.
 *
 * Runs against the ephemeral migrated DB from vitest.int.global-setup.ts.
 */

const db = new PrismaClient();
const svc = new RefreshTokenService(
  db as unknown as PrismaService,
  { get: () => undefined } as unknown as ConfigService,
);

async function isRevoked(plaintext: string): Promise<boolean> {
  const tokenHash = (svc as unknown as { hash: (s: string) => string }).hash(
    plaintext,
  );
  const row = await db.refreshToken.findUnique({ where: { tokenHash } });
  return row?.revokedAt != null;
}

describe('SEC-014-REUSE — refresh reuse revokes the whole token family (real DB)', () => {
  let userId: string;

  beforeAll(async () => {
    await db.$connect();
    const user = await db.user.create({
      data: {
        email: `reuse-${randomUUID()}@witness.test`,
        login: `reuse-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Reuse',
        lastName: 'Witness',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.refreshToken.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it('replaying a revoked token invalidates the rotated token (committed revoke-all)', async () => {
    // 1. Issue an initial refresh token, rotate it once → a live rotated token.
    const first = await svc.issue(userId);
    const { newRefreshToken: rotated } = await svc.rotate(first);

    expect(await isRevoked(first), 'first token revoked after rotate').toBe(
      true,
    );
    expect(await isRevoked(rotated), 'rotated token live after rotate').toBe(
      false,
    );

    // 2. Replay the OLD (revoked) token → reuse detection must reject AND revoke
    //    the whole family.
    await expect(svc.rotate(first)).rejects.toThrow(/déjà utilisé/i);

    // 3. WITNESS: the rotated token is now revoked too (the revoke-all committed).
    //    Under the bug it stayed live (the throw rolled the revoke-all back).
    expect(
      await isRevoked(rotated),
      'rotated token must be revoked after reuse detection',
    ).toBe(true);

    // 4. And it can no longer be rotated (presenting it triggers reuse again).
    await expect(svc.rotate(rotated)).rejects.toThrow(/déjà utilisé/i);
  });
});
