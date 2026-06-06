import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ImportLeaveDto } from './import-leaves.dto';

const base = {
  userEmail: 'user@example.com',
  leaveTypeName: 'Congé Payé',
  startDate: '2026-03-01',
  endDate: '2026-03-05',
};

describe('ImportLeaveDto — SEC-042 comment MaxLength(2000)', () => {
  it('rejects a comment longer than 2000 chars', async () => {
    const dto = plainToInstance(ImportLeaveDto, {
      ...base,
      comment: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'comment')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid comment within limit', async () => {
    const dto = plainToInstance(ImportLeaveDto, {
      ...base,
      comment: 'Approbation manager confirmée.',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'comment')).toBeUndefined();
  });

  it('accepts omitted comment (@IsOptional)', async () => {
    const dto = plainToInstance(ImportLeaveDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'comment')).toBeUndefined();
  });
});
