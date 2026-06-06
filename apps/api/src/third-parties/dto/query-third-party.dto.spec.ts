import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { QueryThirdPartyDto } from './query-third-party.dto';

describe('QueryThirdPartyDto — SEC-035 search MaxLength(200)', () => {
  it('rejects a search string longer than 200 chars', async () => {
    const dto = plainToInstance(QueryThirdPartyDto, {
      search: 'x'.repeat(201),
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'search')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid search string within limit', async () => {
    const dto = plainToInstance(QueryThirdPartyDto, { search: 'Acme' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'search')).toBeUndefined();
  });

  it('accepts omitted search (@IsOptional)', async () => {
    const dto = plainToInstance(QueryThirdPartyDto, {});
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'search')).toBeUndefined();
  });
});
