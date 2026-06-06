import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateServiceDto } from './create-service.dto';

const base = {
  name: 'Recrutement',
  departmentId: '550e8400-e29b-41d4-a716-446655440000',
};

describe('CreateServiceDto — SEC-053 description MaxLength(1000)', () => {
  it('rejects a description longer than 1000 chars', async () => {
    const dto = plainToInstance(CreateServiceDto, {
      ...base,
      description: 'x'.repeat(1001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid description within limit', async () => {
    const dto = plainToInstance(CreateServiceDto, {
      ...base,
      description: "Service en charge du recrutement et de l'intégration.",
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(CreateServiceDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });
});
