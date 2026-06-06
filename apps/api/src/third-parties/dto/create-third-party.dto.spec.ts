import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateThirdPartyDto } from './create-third-party.dto';

const base = {
  type: 'CONTRACTOR',
  organizationName: 'Acme Consulting',
};

describe('CreateThirdPartyDto — SEC-057 contactEmail MaxLength(254)', () => {
  it('rejects a contactEmail longer than 254 chars', async () => {
    // Build: local part fills up to the 254-char limit, then add one more char
    const localPart = 'a'.repeat(243);
    const dto = plainToInstance(CreateThirdPartyDto, {
      ...base,
      contactEmail: `${localPart}@example.com`, // 243+1+11 = 255 chars
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'contactEmail')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid email within 254 chars', async () => {
    const dto = plainToInstance(CreateThirdPartyDto, {
      ...base,
      contactEmail: 'contact@acme.fr',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'contactEmail')).toBeUndefined();
  });

  it('accepts omitted contactEmail (@IsOptional)', async () => {
    const dto = plainToInstance(CreateThirdPartyDto, base);
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'contactEmail')).toBeUndefined();
  });
});
