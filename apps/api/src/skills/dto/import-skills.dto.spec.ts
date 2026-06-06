import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ImportSkillDto } from './import-skills.dto';

const base = {
  name: 'React',
  category: 'TECHNICAL',
};

describe('ImportSkillDto — SEC-054 name MinLength(2)/MaxLength(100) and description MaxLength(500)', () => {
  it('rejects a name shorter than 2 chars (MinLength(2))', async () => {
    const dto = plainToInstance(ImportSkillDto, { ...base, name: 'x' });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'name')?.constraints,
    ).toHaveProperty('minLength');
  });

  it('rejects a name longer than 100 chars', async () => {
    const dto = plainToInstance(ImportSkillDto, {
      ...base,
      name: 'x'.repeat(101),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'name')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('rejects a description longer than 500 chars', async () => {
    const dto = plainToInstance(ImportSkillDto, {
      ...base,
      description: 'x'.repeat(501),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts valid name and description within limits', async () => {
    const dto = plainToInstance(ImportSkillDto, {
      ...base,
      description: 'Description courte.',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'name')).toBeUndefined();
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(ImportSkillDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });
});
