/**
 * seed-guard.spec.ts — DAT-030
 *
 * Verifies that the E2E seed guard refuses to create test users when
 * NODE_ENV=production, regardless of the E2E_SEED flag.
 *
 * Root cause: the original OR-only gate
 *   `E2E_SEED === "true" || NODE_ENV === "test"`
 * would have triggered in production if someone accidentally set
 * E2E_SEED=true before running prisma db seed.
 *
 * Fix: add a hard `&& NODE_ENV !== 'production'` refusal.
 */

import { describe, it, expect } from 'vitest';
import { shouldSeedE2EUsers } from 'database/prisma/seed-utils';

describe('shouldSeedE2EUsers guard (DAT-030)', () => {
  // --- cases where the block SHOULD run ---

  it('returns true when E2E_SEED=true in a non-prod environment', () => {
    expect(shouldSeedE2EUsers({ E2E_SEED: 'true', NODE_ENV: 'development' })).toBe(true);
  });

  it('returns true when NODE_ENV=test', () => {
    expect(shouldSeedE2EUsers({ E2E_SEED: undefined, NODE_ENV: 'test' })).toBe(true);
  });

  it('returns true when both E2E_SEED=true and NODE_ENV=test', () => {
    expect(shouldSeedE2EUsers({ E2E_SEED: 'true', NODE_ENV: 'test' })).toBe(true);
  });

  // --- cases where the block MUST NOT run ---

  it('returns false in a normal development environment with no flags', () => {
    expect(shouldSeedE2EUsers({ E2E_SEED: undefined, NODE_ENV: 'development' })).toBe(false);
  });

  it('returns false when NODE_ENV=production even if E2E_SEED=true (the DAT-030 fix)', () => {
    // This is the critical regression: before the fix this would return TRUE,
    // allowing predictable-credential test users to land in production.
    expect(shouldSeedE2EUsers({ E2E_SEED: 'true', NODE_ENV: 'production' })).toBe(false);
  });

  it('returns false when NODE_ENV=production even if NODE_ENV=test flag would otherwise match', () => {
    // Defensive: production always wins.
    expect(shouldSeedE2EUsers({ E2E_SEED: undefined, NODE_ENV: 'production' })).toBe(false);
  });
});
