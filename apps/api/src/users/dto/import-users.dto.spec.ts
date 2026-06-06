import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ImportUserDto } from './import-users.dto';

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
