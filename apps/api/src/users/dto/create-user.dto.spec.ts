import { BadRequestException, ValidationPipe } from '@nestjs/common';
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

describe('SEC-011 — caller cannot set isActive on create; UPDATE path preserved', () => {
  // Mirrors the global pipe in main.ts (whitelist + forbidNonWhitelisted +
  // transform). This is the exact gate a create request hits in prod, so it is
  // the faithful witness for "the caller cannot control isActive on create".
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const asBody = (metatype: new () => object) => ({
    type: 'body' as const,
    metatype,
  });

  // Witness (AC#2): FAILS pre-fix (isActive was a whitelisted create field, so
  // the caller-supplied value was honored → user created), PASSES post-fix (the
  // field is gone from CreateUserDto, so forbidNonWhitelisted rejects it 400).
  it('rejects a caller-supplied isActive on create (forbidNonWhitelisted → 400)', async () => {
    await expect(
      pipe.transform({ ...base, isActive: false }, asBody(CreateUserDto)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform({ ...base, isActive: true }, asBody(CreateUserDto)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a create payload without isActive (server controls the default)', async () => {
    const out = (await pipe.transform(
      { ...base },
      asBody(CreateUserDto),
    )) as Record<string, unknown>;
    expect(out).not.toHaveProperty('isActive');
  });

  // The UPDATE path must keep isActive (deactivation/reactivation flow that the
  // USER_DEACTIVATED / USER_REACTIVATED audit depends on). Proves the PartialType
  // cascade did not silently drop it.
  it('accepts isActive:false on the UPDATE path (deactivation preserved)', async () => {
    const out = (await pipe.transform(
      { isActive: false },
      asBody(UpdateUserDto),
    )) as { isActive?: boolean };
    expect(out.isActive).toBe(false);
  });

  it('accepts isActive:true on the UPDATE path (reactivation preserved)', async () => {
    const out = (await pipe.transform(
      { isActive: true },
      asBody(UpdateUserDto),
    )) as { isActive?: boolean };
    expect(out.isActive).toBe(true);
  });
});

describe('SEC-025 — departmentId / serviceIds must be UUIDs v4', () => {
  // Witness (AC#2): FAILS pre-fix (@IsString accepts any string including
  // non-UUID values), PASSES post-fix (@IsUUID('4') rejects non-UUID strings).

  it('rejects a non-UUID departmentId (exact failure mode: Prisma 500 leak)', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...base,
      departmentId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'departmentId');
    expect(err?.constraints).toHaveProperty('isUuid');
  });

  it('rejects non-UUID items in serviceIds', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...base,
      serviceIds: ['not-a-uuid', 'also-not-a-uuid'],
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'serviceIds');
    expect(err?.constraints).toHaveProperty('isUuid');
  });

  it('accepts a valid UUID v4 departmentId', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...base,
      departmentId: 'd0ed2849-b92e-47c3-91ad-4c4fb549c993',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'departmentId')).toBeUndefined();
  });

  it('accepts valid UUID v4 items in serviceIds', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...base,
      serviceIds: [
        'd0ed2849-b92e-47c3-91ad-4c4fb549c993',
        '44689f12-4566-4b1c-9da4-9e43020de677',
      ],
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'serviceIds')).toBeUndefined();
  });

  it('accepts omitted departmentId and serviceIds (@IsOptional)', async () => {
    const dto = plainToInstance(CreateUserDto, { ...base });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'departmentId')).toBeUndefined();
    expect(errors.find((e) => e.property === 'serviceIds')).toBeUndefined();
  });
});

describe('CreateUserDto — SEC-059 login MaxLength(50)', () => {
  it('rejects a login longer than 50 chars', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...base,
      login: 'a'.repeat(51),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'login')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid login within 50 chars', async () => {
    const dto = plainToInstance(CreateUserDto, base); // base.login = 'marie.martin'
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'login')).toBeUndefined();
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
      avatarUrl:
        '/api/uploads/avatars/d0ed2849-b92e-47c3-91ad-4c4fb549c993.jpg',
    });
    expect(await avatarErr(dto)).toBeUndefined();
  });
});
