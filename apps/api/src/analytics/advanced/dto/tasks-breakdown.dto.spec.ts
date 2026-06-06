import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { TasksBreakdownQueryDto } from './tasks-breakdown.dto';

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

describe('TasksBreakdownQueryDto — PER-037 projectIds @ArrayMaxSize(200)', () => {
  it('rejects projectIds array exceeding 200 elements', async () => {
    const dto = plainToInstance(TasksBreakdownQueryDto, {
      projectIds: Array.from({ length: 201 }, () => VALID_UUID),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'projectIds')?.constraints,
    ).toHaveProperty('arrayMaxSize');
  });

  it('accepts projectIds array of exactly 200 elements', async () => {
    const dto = plainToInstance(TasksBreakdownQueryDto, {
      projectIds: Array.from({ length: 200 }, () => VALID_UUID),
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'projectIds')).toBeUndefined();
  });

  it('accepts omitted projectIds (@IsOptional)', async () => {
    const dto = plainToInstance(TasksBreakdownQueryDto, {});
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'projectIds')).toBeUndefined();
  });
});
