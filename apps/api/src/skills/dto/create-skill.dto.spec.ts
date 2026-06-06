import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateSkillDto } from './create-skill.dto';

const base = {
  name: 'React',
  category: 'TECHNICAL',
};

describe('CreateSkillDto — SEC-053 description MaxLength(1000)', () => {
  it('rejects a description longer than 1000 chars', async () => {
    const dto = plainToInstance(CreateSkillDto, {
      ...base,
      description: 'x'.repeat(1001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid description within limit', async () => {
    const dto = plainToInstance(CreateSkillDto, {
      ...base,
      description: 'Bibliothèque JavaScript pour construire des interfaces.',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(CreateSkillDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });
});
