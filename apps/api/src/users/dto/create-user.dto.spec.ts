import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

const base = {
  email: 'marie.martin@orchestr-a.internal',
  login: 'marie.martin',
  password: 'P@ssword1',
  firstName: 'Marie',
  lastName: 'Martin',
  roleCode: 'CONTRIBUTEUR',
};

const avatarErr = async (dto: object) =>
  (await validate(dto)).find((e) => e.property === 'avatarUrl');

describe('CreateUserDto — SEC-010 avatarUrl scheme/host restriction', () => {
  // Witness (AC#2): the original failure mode — a javascript: URL is accepted
  // pre-fix (@IsString only), rejected post-fix.
  it('rejects a javascript: scheme avatarUrl (stored XSS vector)', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...base,
      avatarUrl: 'javascript:alert(1)',
    });
    expect((await avatarErr(dto))?.constraints).toHaveProperty('matches');
  });

  it('rejects data: and file: scheme avatarUrls', async () => {
    for (const avatarUrl of [
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
    ]) {
      const dto = plainToInstance(CreateUserDto, { ...base, avatarUrl });
      expect((await avatarErr(dto))?.constraints).toHaveProperty('matches');
    }
  });

  // Relative-only: distinguishes this fix from SEC-009's @IsUrl. An external
  // https host is a tracking-pixel / SSRF-from-browser vector and is rejected.
  it('rejects an external https host (tracking-pixel / SSRF vector)', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...base,
      avatarUrl: 'https://evil.com/pixel.png',
    });
    expect((await avatarErr(dto))?.constraints).toHaveProperty('matches');
  });

  // ../ traversal (feeds SEC-015's avatar-delete path) must not pass.
  it('rejects path traversal under the avatar prefix', async () => {
    for (const avatarUrl of [
      '/api/uploads/avatars/../../../etc/passwd',
      '/api/../../../etc/passwd',
    ]) {
      const dto = plainToInstance(CreateUserDto, { ...base, avatarUrl });
      expect((await avatarErr(dto))?.constraints).toHaveProperty('matches');
    }
  });

  // Deploy-safety witness: the exact value the server's upload flow writes
  // (/api/uploads/avatars/<id>.<ext>) must pass — a round-trip PATCH of a legit
  // stored avatarUrl is never rejected.
  it('accepts the server-issued relative avatar path', async () => {
    for (const avatarUrl of [
      '/api/uploads/avatars/d0ed2849-b92e-47c3-91ad-4c4fb549c993.jpg',
      '/api/uploads/avatars/44689f12-4566-4b1c-9da4-9e43020de677.png',
      '/api/uploads/avatars/c0c8f0ac-b29d-4dc3-a340-776d6a34217c.webp',
    ]) {
      const dto = plainToInstance(CreateUserDto, { ...base, avatarUrl });
      expect(await avatarErr(dto)).toBeUndefined();
    }
  });

  it('accepts an omitted avatarUrl (@IsOptional)', async () => {
    const dto = plainToInstance(CreateUserDto, { ...base });
    expect(await avatarErr(dto)).toBeUndefined();
  });
});

describe('UpdateUserDto — SEC-010 propagation via PartialType', () => {
  it('rejects a javascript: scheme avatarUrl on the PATCH path', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      avatarUrl: 'javascript:alert(1)',
    });
    expect((await avatarErr(dto))?.constraints).toHaveProperty('matches');
  });

  it('accepts the server-issued relative avatar path on the PATCH path', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      avatarUrl: '/api/uploads/avatars/d0ed2849-b92e-47c3-91ad-4c4fb549c993.jpg',
    });
    expect(await avatarErr(dto)).toBeUndefined();
  });
});
