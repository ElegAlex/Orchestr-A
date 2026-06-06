import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ImportTaskDto } from './import-tasks.dto';

const base = {
  title: 'Développer le module Auth',
};

describe('ImportTaskDto — SEC-055 assigneeEmail @IsEmail + @MaxLength(254)', () => {
  it('rejects a non-email assigneeEmail', async () => {
    const dto = plainToInstance(ImportTaskDto, {
      ...base,
      assigneeEmail: 'not-an-email',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'assigneeEmail')?.constraints,
    ).toHaveProperty('isEmail');
  });

  it('rejects an assigneeEmail longer than 254 chars', async () => {
    const dto = plainToInstance(ImportTaskDto, {
      ...base,
      assigneeEmail: `${'a'.repeat(244)}@example.com`,
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'assigneeEmail')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid assigneeEmail', async () => {
    const dto = plainToInstance(ImportTaskDto, {
      ...base,
      assigneeEmail: 'user@example.com',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'assigneeEmail')).toBeUndefined();
  });

  it('accepts omitted assigneeEmail (@IsOptional)', async () => {
    const dto = plainToInstance(ImportTaskDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'assigneeEmail')).toBeUndefined();
  });
});
