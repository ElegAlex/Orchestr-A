import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateSettingDto } from './update-setting.dto';

const base = {
  value: '"dd/MM/yyyy"',
};

describe('UpdateSettingDto — SEC-052 value MaxLength(10000) and description MaxLength(500)', () => {
  it('rejects a value longer than 10000 chars', async () => {
    const dto = plainToInstance(UpdateSettingDto, {
      value: 'x'.repeat(10001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'value')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('rejects a description longer than 500 chars', async () => {
    const dto = plainToInstance(UpdateSettingDto, {
      ...base,
      description: 'x'.repeat(501),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts valid value and description within limits', async () => {
    const dto = plainToInstance(UpdateSettingDto, {
      value: '"dd/MM/yyyy"',
      description: "Format de date utilisé dans l'application",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(UpdateSettingDto, base);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
