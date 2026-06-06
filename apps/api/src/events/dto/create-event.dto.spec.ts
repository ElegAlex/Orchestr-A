import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateEventDto } from './create-event.dto';

const base = {
  title: 'Réunion de suivi',
  date: '2025-11-10T00:00:00Z',
};

describe('CreateEventDto — SEC-040 description MaxLength(2000)', () => {
  it('rejects a description longer than 2000 chars', async () => {
    const dto = plainToInstance(CreateEventDto, {
      ...base,
      description: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid description within limit', async () => {
    const dto = plainToInstance(CreateEventDto, {
      ...base,
      description: 'Une description normale.',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(CreateEventDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });
});
