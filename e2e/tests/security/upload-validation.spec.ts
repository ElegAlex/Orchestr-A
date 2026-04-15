/**
 * SEC-07 — Magic bytes upload validation (E2E)
 *
 * Verifies that the shared magic-bytes validator wired on the avatar
 * upload endpoint (`POST /users/me/avatar`) rejects files whose real
 * content does not match an allowed image MIME, regardless of the
 * filename/extension or client-provided Content-Type.
 *
 * Shared validator: apps/api/src/common/upload/magic-bytes.validator.ts
 * Wiring:           apps/api/src/users/users.service.ts (uploadAvatar)
 *
 * Refs: audit 2026-04-15 SEC-07 (commit 043e59d, hotfix 8946c11)
 */

import * as fs from 'fs';
import { test, expect } from '@playwright/test';
import { ROLE_STORAGE_PATHS, type Role } from '../../fixtures/roles';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTokenFromStorageState(role: Role): string {
  const storagePath = ROLE_STORAGE_PATHS[role];
  if (!fs.existsSync(storagePath)) {
    throw new Error(
      `Storage state not found for role "${role}" at ${storagePath}. Run setup first.`,
    );
  }
  const storage = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
  const origin = storage.origins?.[0];
  const tokenEntry = origin?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === 'access_token',
  );
  if (!tokenEntry?.value) {
    throw new Error(`No access_token in storage state for role "${role}"`);
  }
  return tokenEntry.value;
}

// 1x1 transparent PNG (hardcoded, valid magic bytes + IHDR + IDAT + IEND)
const REAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

// PHP payload disguised as a JPEG
const PHP_PAYLOAD = Buffer.from('<?php echo "pwn"; ?>', 'utf-8');

const ROLE: Role = 'contributeur';

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('SEC-07 — Avatar upload magic-bytes validation', () => {
  test('rejects a PHP payload renamed evil.jpg with 400 @smoke', async ({
    request,
    baseURL,
  }) => {
    const token = getTokenFromStorageState(ROLE);

    const response = await request.post(`${baseURL}/api/users/me/avatar`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'evil.jpg',
          mimeType: 'image/jpeg',
          buffer: PHP_PAYLOAD,
        },
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.text();
    expect(body).toMatch(/Unknown file type|Disallowed mime/);
  });

  test('accepts a real 1x1 PNG', async ({ request, baseURL }) => {
    const token = getTokenFromStorageState(ROLE);

    const response = await request.post(`${baseURL}/api/users/me/avatar`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'pixel.png',
          mimeType: 'image/png',
          buffer: REAL_PNG,
        },
      },
    });

    expect([200, 201]).toContain(response.status());
  });
});
