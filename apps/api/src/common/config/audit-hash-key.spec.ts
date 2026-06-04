import { describe, it, expect } from 'vitest';
import {
  assertAuditHashKey,
  AUDIT_HASH_KEY_MIN_LENGTH,
} from './audit-hash-key';

describe('assertAuditHashKey (OBS-028 boot validation)', () => {
  it('throws when the key is absent (no raw fallback)', () => {
    expect(() => assertAuditHashKey(undefined)).toThrow(
      /AUDIT_HASH_KEY must be set/,
    );
  });

  it('throws when the key is empty', () => {
    expect(() => assertAuditHashKey('')).toThrow(/AUDIT_HASH_KEY/);
  });

  it(`throws when the key is shorter than ${AUDIT_HASH_KEY_MIN_LENGTH} chars`, () => {
    expect(() =>
      assertAuditHashKey('a'.repeat(AUDIT_HASH_KEY_MIN_LENGTH - 1)),
    ).toThrow(/at least/);
  });

  it('passes for a sufficiently long key', () => {
    expect(() =>
      assertAuditHashKey('a'.repeat(AUDIT_HASH_KEY_MIN_LENGTH)),
    ).not.toThrow();
  });
});
