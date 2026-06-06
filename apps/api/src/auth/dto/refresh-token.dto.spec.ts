import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { RefreshTokenDto, LogoutDto } from './refresh-token.dto';

describe('RefreshTokenDto — SA-SEC-004 refreshToken MaxLength(256)', () => {
  it('rejects a refreshToken longer than 256 chars', async () => {
    const dto = plainToInstance(RefreshTokenDto, {
      refreshToken: 'x'.repeat(257),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'refreshToken')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid refreshToken within 256 chars', async () => {
    const dto = plainToInstance(RefreshTokenDto, {
      refreshToken: 'tok'.repeat(10), // 30 chars
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'refreshToken')).toBeUndefined();
  });

  it('accepts omitted refreshToken (@IsOptional)', async () => {
    const dto = plainToInstance(RefreshTokenDto, {});
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'refreshToken')).toBeUndefined();
  });
});

describe('LogoutDto — SA-SEC-004 refreshToken MaxLength(256)', () => {
  it('rejects a refreshToken longer than 256 chars', async () => {
    const dto = plainToInstance(LogoutDto, {
      refreshToken: 'x'.repeat(257),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'refreshToken')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid refreshToken within 256 chars', async () => {
    const dto = plainToInstance(LogoutDto, {
      refreshToken: 'tok'.repeat(10),
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'refreshToken')).toBeUndefined();
  });

  it('accepts omitted refreshToken (@IsOptional)', async () => {
    const dto = plainToInstance(LogoutDto, {});
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'refreshToken')).toBeUndefined();
  });
});
