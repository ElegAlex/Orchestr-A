import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreatePredefinedTaskDto } from './create-predefined-task.dto';

const base = {
  name: 'Permanence accueil',
  defaultDuration: 'FULL_DAY',
};

describe('CreatePredefinedTaskDto — SEC-046 length constraints', () => {
  it('rejects a name longer than 200 chars', async () => {
    const dto = plainToInstance(CreatePredefinedTaskDto, {
      ...base,
      name: 'x'.repeat(201),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'name')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('rejects a description longer than 2000 chars', async () => {
    const dto = plainToInstance(CreatePredefinedTaskDto, {
      ...base,
      description: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('rejects a color longer than 20 chars', async () => {
    const dto = plainToInstance(CreatePredefinedTaskDto, {
      ...base,
      color: 'x'.repeat(21),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'color')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('rejects an icon longer than 10 chars', async () => {
    const dto = plainToInstance(CreatePredefinedTaskDto, {
      ...base,
      icon: 'x'.repeat(11),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'icon')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts valid values within all limits', async () => {
    const dto = plainToInstance(CreatePredefinedTaskDto, {
      ...base,
      description: 'Accueil du public.',
      color: '#3B82F6',
      icon: '🏢',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'name')).toBeUndefined();
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
    expect(errors.find((e) => e.property === 'color')).toBeUndefined();
    expect(errors.find((e) => e.property === 'icon')).toBeUndefined();
  });
});
