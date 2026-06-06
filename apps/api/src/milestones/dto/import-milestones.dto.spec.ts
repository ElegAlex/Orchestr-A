import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ImportMilestoneDto } from './import-milestones.dto';

const base = {
  name: 'Alpha Release',
  dueDate: '2025-12-31',
};

describe('ImportMilestoneDto — SEC-047 name MinLength(1)/MaxLength(200) and description MaxLength(2000)', () => {
  it('rejects an empty name (MinLength(1))', async () => {
    const dto = plainToInstance(ImportMilestoneDto, { ...base, name: '' });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'name')?.constraints,
    ).toHaveProperty('minLength');
  });

  it('rejects a name longer than 200 chars', async () => {
    const dto = plainToInstance(ImportMilestoneDto, {
      ...base,
      name: 'x'.repeat(201),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'name')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('rejects a description longer than 2000 chars', async () => {
    const dto = plainToInstance(ImportMilestoneDto, {
      ...base,
      description: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid name and description', async () => {
    const dto = plainToInstance(ImportMilestoneDto, {
      ...base,
      description: 'Description normale.',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'name')).toBeUndefined();
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(ImportMilestoneDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });
});
