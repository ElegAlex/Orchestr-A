/**
 * cors.config.spec.ts — SEC-012
 *
 * Tests for resolveAllowedOrigins():
 *  1. CORS_ORIGIN is honored (canonical var — the bug: was ignored before fix)
 *  2. ALLOWED_ORIGINS backward-compat alias still works
 *  3. CORS_ORIGIN takes priority over ALLOWED_ORIGINS when both are set
 *  4. Boot assertion: NODE_ENV=production + neither var → throws
 *  5. Dev fallback when neither var is set (non-production)
 */

import { describe, it, expect } from 'vitest';
import { resolveAllowedOrigins } from './cors.config';

describe('resolveAllowedOrigins (SEC-012)', () => {
  // --- PRIMARY WITNESS (RED before fix, GREEN after) ---
  it('resolves CORS_ORIGIN when ALLOWED_ORIGINS is unset (production deployer path)', () => {
    const result = resolveAllowedOrigins({
      CORS_ORIGIN: 'https://app.example.com',
      NODE_ENV: 'production',
    });
    expect(result).toEqual(['https://app.example.com']);
  });

  it('resolves multiple origins from CORS_ORIGIN comma-separated list', () => {
    const result = resolveAllowedOrigins({
      CORS_ORIGIN: 'https://app.example.com, https://admin.example.com',
      NODE_ENV: 'production',
    });
    expect(result).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });

  // --- BACKWARD COMPAT ---
  it('resolves ALLOWED_ORIGINS when CORS_ORIGIN is unset (backward compat)', () => {
    const result = resolveAllowedOrigins({
      ALLOWED_ORIGINS: 'http://localhost:4001',
      NODE_ENV: 'production',
    });
    expect(result).toEqual(['http://localhost:4001']);
  });

  it('CORS_ORIGIN takes priority over ALLOWED_ORIGINS when both are set', () => {
    const result = resolveAllowedOrigins({
      CORS_ORIGIN: 'https://primary.example.com',
      ALLOWED_ORIGINS: 'https://legacy.example.com',
      NODE_ENV: 'production',
    });
    expect(result).toEqual(['https://primary.example.com']);
  });

  // --- BOOT ASSERTION ---
  it('throws in production when neither CORS_ORIGIN nor ALLOWED_ORIGINS is set', () => {
    expect(() => resolveAllowedOrigins({ NODE_ENV: 'production' })).toThrow(
      /CORS_ORIGIN/,
    );
  });

  // --- DEV FALLBACK ---
  it('returns dev localhost fallback when no env var is set in non-production', () => {
    const result = resolveAllowedOrigins({ NODE_ENV: 'development' });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('http://localhost:4001');
  });
});
