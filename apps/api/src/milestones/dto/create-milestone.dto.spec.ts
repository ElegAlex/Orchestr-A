import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateMilestoneDto } from './create-milestone.dto';

const base = {
  name: 'Alpha Release',
  projectId: '550e8400-e29b-41d4-a716-446655440000',
  dueDate: '2025-12-31T00:00:00Z',
};

describe('CreateMilestoneDto — SEC-047/SA-SEC-010 description MaxLength(2000)', () => {
  it('rejects a description longer than 2000 chars', async () => {
    const dto = plainToInstance(CreateMilestoneDto, {
      ...base,
      description: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid description within limit', async () => {
    const dto = plainToInstance(CreateMilestoneDto, {
      ...base,
      description: 'Description du jalon.',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(CreateMilestoneDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });
});
