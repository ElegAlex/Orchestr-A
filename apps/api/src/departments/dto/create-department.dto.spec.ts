import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateDepartmentDto } from './create-department.dto';

const base = {
  name: 'Ressources Humaines',
};

describe('CreateDepartmentDto — SEC-053 description MaxLength(1000)', () => {
  it('rejects a description longer than 1000 chars', async () => {
    const dto = plainToInstance(CreateDepartmentDto, {
      ...base,
      description: 'x'.repeat(1001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid description within limit', async () => {
    const dto = plainToInstance(CreateDepartmentDto, {
      ...base,
      description:
        'Département en charge de la gestion des ressources humaines.',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(CreateDepartmentDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });
});
