import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ImportUserDto, ImportUsersDto } from './import-users.dto';

const base = {
  email: 'marie.martin@orchestr-a.internal',
  login: 'marie.martin',
  password: 'P@ssword1',
  firstName: 'Marie',
  lastName: 'Martin',
  roleCode: 'CONTRIBUTEUR',
};

describe('ImportUserDto — SEC-059 login MaxLength(50)', () => {
  it('rejects a login longer than 50 chars', async () => {
    const dto = plainToInstance(ImportUserDto, {
      ...base,
      login: 'a'.repeat(51),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'login')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid login within 50 chars', async () => {
    const dto = plainToInstance(ImportUserDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'login')).toBeUndefined();
  });
});

describe('ImportUsersDto — SEC-016 @ArrayMaxSize(500) batch cap', () => {
  it('rejects more than 500 users (serial bcrypt cost-12 CPU-DoS guard)', async () => {
    const dto = plainToInstance(ImportUsersDto, {
      users: Array.from({ length: 501 }, () => ({ ...base })),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'users')?.constraints,
    ).toHaveProperty('arrayMaxSize');
  });

  it('accepts a batch of exactly 500 users', async () => {
    const dto = plainToInstance(ImportUsersDto, {
      users: Array.from({ length: 500 }, () => ({ ...base })),
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'users')).toBeUndefined();
  });
});
