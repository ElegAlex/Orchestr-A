import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateProjectDto } from './update-project.dto';

describe('UpdateProjectDto — SEC-049 visibleStatuses @IsEnum(TaskStatus)', () => {
  it('rejects an invalid TaskStatus in visibleStatuses', async () => {
    const dto = plainToInstance(UpdateProjectDto, {
      visibleStatuses: ['NOT_A_STATUS'],
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'visibleStatuses')?.constraints,
    ).toHaveProperty('isEnum');
  });

  it('accepts valid TaskStatus values in visibleStatuses', async () => {
    const dto = plainToInstance(UpdateProjectDto, {
      visibleStatuses: ['TODO', 'IN_PROGRESS', 'DONE'],
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'visibleStatuses'),
    ).toBeUndefined();
  });

  it('accepts omitted visibleStatuses (@IsOptional)', async () => {
    const dto = plainToInstance(UpdateProjectDto, {});
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'visibleStatuses'),
    ).toBeUndefined();
  });
});
