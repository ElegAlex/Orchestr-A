import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateClientDto } from './create-client.dto';
import { UpdateClientDto } from './update-client.dto';
import { QueryClientsDto } from './query-clients.dto';

describe('CreateClientDto validation', () => {
  it('rejects empty name', async () => {
    const dto = plainToInstance(CreateClientDto, { name: '' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isLength');
  });

  it('rejects whitespace-only name (after trim)', async () => {
    const dto = plainToInstance(CreateClientDto, { name: '   ' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isLength');
  });

  it('trims whitespace and persists trimmed name', async () => {
    const dto = plainToInstance(CreateClientDto, { name: '  Valid Client  ' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Valid Client');
  });

  it('rejects name > 255 chars', async () => {
    const dto = plainToInstance(CreateClientDto, { name: 'x'.repeat(256) });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isLength');
  });

  it('accepts a valid name', async () => {
    const dto = plainToInstance(CreateClientDto, { name: 'Mairie de Lyon' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateClientDto validation', () => {
  it('rejects empty name when provided', async () => {
    const dto = plainToInstance(UpdateClientDto, { name: '' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isLength');
  });

  it('rejects whitespace-only name (after trim)', async () => {
    const dto = plainToInstance(UpdateClientDto, { name: '   ' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isLength');
  });

  it('trims whitespace in valid name', async () => {
    const dto = plainToInstance(UpdateClientDto, { name: '  New  ' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('New');
  });

  it('accepts no name (all fields optional)', async () => {
    const dto = plainToInstance(UpdateClientDto, { isActive: false });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid name + isActive toggle', async () => {
    const dto = plainToInstance(UpdateClientDto, {
      name: 'Renamed',
      isActive: true,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('QueryClientsDto — SEC-035 search MaxLength(200)', () => {
  it('rejects a search string longer than 200 chars', async () => {
    const dto = plainToInstance(QueryClientsDto, { search: 'x'.repeat(201) });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'search')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a valid search string within limit', async () => {
    const dto = plainToInstance(QueryClientsDto, { search: 'Mairie' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'search')).toBeUndefined();
  });

  it('accepts omitted search (@IsOptional)', async () => {
    const dto = plainToInstance(QueryClientsDto, {});
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'search')).toBeUndefined();
  });
});
