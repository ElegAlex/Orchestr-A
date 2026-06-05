import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateTeleworkDto } from './create-telework.dto';
import { CreateRecurringRuleDto } from './create-recurring-rule.dto';

/**
 * SEC-023 — userId must be validated as a UUID in telework DTOs.
 * A non-UUID string was previously accepted by @IsString(), causing Prisma to
 * throw an internal database error (invalid UUID format) instead of a clean
 * HTTP 400, leaking implementation details.
 */

const VALID_UUID = '00000000-0000-4000-8000-000000000001';

describe('CreateTeleworkDto — SEC-023 userId UUID validation', () => {
  it('SEC-023 — rejects non-UUID userId (returns validation error, not 500)', async () => {
    const dto = plainToInstance(CreateTeleworkDto, {
      date: '2026-06-01',
      userId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('userId');
  });

  it('SEC-023 — accepts a valid UUID userId', async () => {
    const dto = plainToInstance(CreateTeleworkDto, {
      date: '2026-06-01',
      userId: VALID_UUID,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('SEC-023 — accepts omitted userId (optional field)', async () => {
    const dto = plainToInstance(CreateTeleworkDto, {
      date: '2026-06-01',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('CreateRecurringRuleDto — SEC-023 userId UUID validation', () => {
  it('SEC-023 — rejects non-UUID userId', async () => {
    const dto = plainToInstance(CreateRecurringRuleDto, {
      dayOfWeek: 1,
      startDate: '2026-06-01',
      userId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('userId');
  });

  it('SEC-023 — accepts a valid UUID userId', async () => {
    const dto = plainToInstance(CreateRecurringRuleDto, {
      dayOfWeek: 1,
      startDate: '2026-06-01',
      userId: VALID_UUID,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('SEC-023 — accepts omitted userId (optional field)', async () => {
    const dto = plainToInstance(CreateRecurringRuleDto, {
      dayOfWeek: 1,
      startDate: '2026-06-01',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
