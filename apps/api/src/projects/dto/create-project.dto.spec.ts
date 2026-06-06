import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateProjectDto } from './create-project.dto';

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const base = {
  name: 'Refonte Application RH',
  startDate: '2025-11-10T00:00:00Z',
  endDate: '2026-03-01T00:00:00Z',
};

describe('CreateProjectDto — SEC-047 description MaxLength(2000)', () => {
  it('rejects a description longer than 2000 chars', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      ...base,
      description: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'description')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid description within limit', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      ...base,
      description: 'Description courte du projet.',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });

  it('accepts omitted description (@IsOptional)', async () => {
    const dto = plainToInstance(CreateProjectDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'description')).toBeUndefined();
  });
});

describe('CreateProjectDto — SEC-048 managerId/sponsorId @IsUUID', () => {
  it('rejects a non-UUID managerId', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      ...base,
      managerId: 'manager-1',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'managerId')?.constraints,
    ).toHaveProperty('isUuid');
  });

  it('accepts a valid UUID managerId', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      ...base,
      managerId: VALID_UUID,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'managerId')).toBeUndefined();
  });

  it('accepts omitted managerId (@IsOptional)', async () => {
    const dto = plainToInstance(CreateProjectDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'managerId')).toBeUndefined();
  });

  it('rejects a non-UUID sponsorId', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      ...base,
      sponsorId: 'sponsor-1',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'sponsorId')?.constraints,
    ).toHaveProperty('isUuid');
  });

  it('accepts a valid UUID sponsorId', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      ...base,
      sponsorId: VALID_UUID,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'sponsorId')).toBeUndefined();
  });

  it('accepts omitted sponsorId (@IsOptional)', async () => {
    const dto = plainToInstance(CreateProjectDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'sponsorId')).toBeUndefined();
  });
});
