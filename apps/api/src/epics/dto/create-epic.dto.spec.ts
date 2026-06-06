import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateEpicDto } from './create-epic.dto';

const base = {
  name: 'Module Authentification',
  projectId: '550e8400-e29b-41d4-a716-446655440000',
};

describe('CreateEpicDto — SEC-047/SA-SEC-010 description MaxLength(2000)', () => {
  it('rejects a description longer than 2000 chars', async () => {
    const dto = plainToInstance(CreateEpicDto, {
      ...base,
      description: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid description within limit', async () => {
    const dto = plainToInstance(CreateEpicDto, {
      ...base,
      description: 'Description de cet epic.',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(CreateEpicDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });
});
