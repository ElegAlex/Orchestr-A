import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateLeaveDto } from './create-leave.dto';

const base = {
  leaveTypeId: 'lt-cp-001',
  startDate: '2025-11-15T00:00:00Z',
  endDate: '2025-11-20T00:00:00Z',
};

describe('CreateLeaveDto — SEC-042 reason MaxLength(2000)', () => {
  it('rejects a reason longer than 2000 chars', async () => {
    const dto = plainToInstance(CreateLeaveDto, {
      ...base,
      reason: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'reason')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid reason within limit', async () => {
    const dto = plainToInstance(CreateLeaveDto, {
      ...base,
      reason: "Vacances d'été",
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'reason')).toBeUndefined();
  });

  it('accepts omitted reason (@IsOptional)', async () => {
    const dto = plainToInstance(CreateLeaveDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'reason')).toBeUndefined();
  });
});
