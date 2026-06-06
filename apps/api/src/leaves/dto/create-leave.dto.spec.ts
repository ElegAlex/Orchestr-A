import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateLeaveDto } from './create-leave.dto';

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const base = {
  leaveTypeId: VALID_UUID,
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

describe('CreateLeaveDto — SA-SEC-009/SEC-043 UUID validators', () => {
  it('rejects a non-UUID leaveTypeId', async () => {
    const dto = plainToInstance(CreateLeaveDto, {
      ...base,
      leaveTypeId: 'lt-cp-001',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'leaveTypeId')?.constraints,
    ).toHaveProperty('isUuid');
  });

  it('accepts a valid UUID leaveTypeId', async () => {
    const dto = plainToInstance(CreateLeaveDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'leaveTypeId')).toBeUndefined();
  });

  it('rejects a non-UUID targetUserId', async () => {
    const dto = plainToInstance(CreateLeaveDto, {
      ...base,
      targetUserId: 'user-1',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'targetUserId')?.constraints,
    ).toHaveProperty('isUuid');
  });

  it('accepts a valid UUID targetUserId', async () => {
    const dto = plainToInstance(CreateLeaveDto, {
      ...base,
      targetUserId: VALID_UUID,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'targetUserId')).toBeUndefined();
  });

  it('accepts omitted targetUserId (@IsOptional)', async () => {
    const dto = plainToInstance(CreateLeaveDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'targetUserId')).toBeUndefined();
  });
});
