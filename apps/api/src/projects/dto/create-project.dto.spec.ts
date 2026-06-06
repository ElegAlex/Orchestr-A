import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateProjectDto } from './create-project.dto';

const base = {
  name: 'Refonte Application RH',
  startDate: '2025-11-10T00:00:00Z',
  endDate: '2026-03-01T00:00:00Z',
};

describe('CreateProjectDto — SEC-047 description MaxLength(2000)', () => {
  it('rejects a description longer than 2000 chars', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      ...base,
      description: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid description within limit', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      ...base,
      description: 'Description courte du projet.',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(CreateProjectDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });
});
