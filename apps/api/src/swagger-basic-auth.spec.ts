/**
 * swagger-basic-auth.spec.ts — SEC-010
 *
 * Unit tests for the RFC 7617-compliant Basic Auth credential parser.
 *
 * Verifies that passwords containing colons are NOT truncated at the first
 * colon, which is the RFC-mandated behaviour and the fix for SEC-010.
 */

import { describe, it, expect } from 'vitest';
import { parseBasicCredentials } from './swagger-basic-auth';

describe('parseBasicCredentials (SEC-010)', () => {
  it('SEC-010 — password containing colon is preserved in full', () => {
    // With the old `.split(':')` approach:
    //   "user:p@ss:word".split(':') → ['user', 'p@ss', 'word']
    //   destructuring: user='user', pass='p@ss'  ← truncated (BUG)
    // With the RFC 7617 first-colon-only split:
    //   pass = 'p@ss:word'  ← correct
    const result = parseBasicCredentials('user:p@ss:word');
    expect(result.user).toBe('user');
    expect(result.pass).toBe('p@ss:word');
  });

  it('SEC-010 — simple password without colon works normally', () => {
    const result = parseBasicCredentials('admin:secret123');
    expect(result.user).toBe('admin');
    expect(result.pass).toBe('secret123');
  });

  it('SEC-010 — no colon in input returns full string as user and empty pass', () => {
    const result = parseBasicCredentials('nocohereseparator');
    expect(result.user).toBe('nocohereseparator');
    expect(result.pass).toBe('');
  });

  it('SEC-010 — empty password (trailing colon) is preserved as empty string', () => {
    const result = parseBasicCredentials('admin:');
    expect(result.user).toBe('admin');
    expect(result.pass).toBe('');
  });

  it('SEC-010 — multiple colons: only first is separator, rest belong to password', () => {
    const result = parseBasicCredentials('svc:pass:with:many:colons');
    expect(result.user).toBe('svc');
    expect(result.pass).toBe('pass:with:many:colons');
  });
});
