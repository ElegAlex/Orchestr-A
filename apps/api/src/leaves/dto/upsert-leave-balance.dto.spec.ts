import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpsertLeaveBalanceDto } from './upsert-leave-balance.dto';

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const base = {
  leaveTypeId: VALID_UUID,
  year: 2026,
  totalDays: 25,
};

describe('UpsertLeaveBalanceDto — SA-SEC-009 UUID validators', () => {
  it('rejects a non-UUID leaveTypeId', async () => {
    const dto = plainToInstance(UpsertLeaveBalanceDto, {
      ...base,
      leaveTypeId: 'leave-type-1',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'leaveTypeId')?.constraints,
    ).toHaveProperty('isUuid');
  });

  it('accepts a valid UUID leaveTypeId', async () => {
    const dto = plainToInstance(UpsertLeaveBalanceDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'leaveTypeId')).toBeUndefined();
  });

  it('rejects a non-UUID userId', async () => {
    const dto = plainToInstance(UpsertLeaveBalanceDto, {
      ...base,
      userId: 'user-1',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'userId')?.constraints,
    ).toHaveProperty('isUuid');
  });

  it('accepts a valid UUID userId', async () => {
    const dto = plainToInstance(UpsertLeaveBalanceDto, {
      ...base,
      userId: VALID_UUID,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'userId')).toBeUndefined();
  });

  it('accepts omitted userId (@IsOptional)', async () => {
    const dto = plainToInstance(UpsertLeaveBalanceDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'userId')).toBeUndefined();
  });
});
