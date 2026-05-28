import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { AddMemberDto } from './add-member.dto';
import { UpdateMemberDto } from './update-member.dto';

/**
 * DAT-035 — layer-of-rejection partner to `project_members_role_length_ck`.
 * The DTO trims whitespace then enforces 1..100 char length; the DB CHECK is
 * the structural floor at the same bounds. The DTO returns 400 for
 * pre-CHECK-rejection of plainly-invalid input; the DB CHECK catches direct
 * SQL writes that bypass the DTO entirely.
 */

const VALID_USER_ID = '00000000-0000-4000-8000-000000000001';

describe('AddMemberDto — DAT-035 role normalization + length', () => {
  it('trims leading/trailing whitespace', async () => {
    const dto = plainToInstance(AddMemberDto, {
      userId: VALID_USER_ID,
      role: '  Chef de projet  ',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.role).toBe('Chef de projet');
  });

  it('rejects empty string (length < 1)', async () => {
    const dto = plainToInstance(AddMemberDto, {
      userId: VALID_USER_ID,
      role: '',
    });
    const errors = await validate(dto);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('isLength');
  });

  it('rejects whitespace-only after trim (collapses to "")', async () => {
    const dto = plainToInstance(AddMemberDto, {
      userId: VALID_USER_ID,
      role: '   ',
    });
    const errors = await validate(dto);
    expect(dto.role).toBe(''); // trimmed
    const flat = JSON.stringify(errors);
    expect(flat).toContain('isLength');
  });

  it('rejects > 100 char role', async () => {
    const dto = plainToInstance(AddMemberDto, {
      userId: VALID_USER_ID,
      role: 'x'.repeat(101),
    });
    const errors = await validate(dto);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('isLength');
  });

  it('accepts role at exactly 1 char (inclusive lower bound)', async () => {
    const dto = plainToInstance(AddMemberDto, {
      userId: VALID_USER_ID,
      role: 'A',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts role at exactly 100 chars (inclusive upper bound)', async () => {
    const dto = plainToInstance(AddMemberDto, {
      userId: VALID_USER_ID,
      role: 'y'.repeat(100),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts role omitted (still optional)', async () => {
    const dto = plainToInstance(AddMemberDto, { userId: VALID_USER_ID });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateMemberDto — DAT-035 role normalization + length', () => {
  it('trims whitespace and accepts the canonical label', async () => {
    const dto = plainToInstance(UpdateMemberDto, {
      role: '  Lead dev  ',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.role).toBe('Lead dev');
  });

  it('rejects whitespace-only after trim', async () => {
    const dto = plainToInstance(UpdateMemberDto, { role: '   ' });
    const errors = await validate(dto);
    expect(dto.role).toBe('');
    const flat = JSON.stringify(errors);
    expect(flat).toContain('isLength');
  });

  it('rejects > 100 chars', async () => {
    const dto = plainToInstance(UpdateMemberDto, { role: 'z'.repeat(101) });
    const errors = await validate(dto);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('isLength');
  });

  it('accepts role omitted (partial update — only allocation)', async () => {
    const dto = plainToInstance(UpdateMemberDto, { allocation: 50 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
