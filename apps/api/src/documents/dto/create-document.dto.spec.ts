import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateDocumentDto } from './create-document.dto';
import { UpdateDocumentDto } from './update-document.dto';

const base = {
  name: 'Spécifications',
  url: 'https://storage.example.com/file.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  projectId: '550e8400-e29b-41d4-a716-446655440000',
};

describe('CreateDocumentDto — SEC-009 url/mimeType validation', () => {
  // Witness (AC#2): the original failure mode — a javascript: URL is accepted
  // pre-fix (@IsString only), rejected post-fix.
  it('rejects a javascript: scheme URL (stored XSS vector)', async () => {
    const dto = plainToInstance(CreateDocumentDto, {
      ...base,
      url: 'javascript:alert(document.cookie)',
    });
    const errors = await validate(dto);
    const urlErr = errors.find((e) => e.property === 'url');
    expect(urlErr?.constraints).toHaveProperty('isUrl');
  });

  it('rejects data: and file: scheme URLs', async () => {
    for (const url of [
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
    ]) {
      const dto = plainToInstance(CreateDocumentDto, { ...base, url });
      const errors = await validate(dto);
      expect(
        errors.find((e) => e.property === 'url')?.constraints,
      ).toHaveProperty('isUrl');
    }
  });

  it('rejects a url longer than 2048 chars', async () => {
    const url = `https://example.com/${'a'.repeat(2100)}`;
    const dto = plainToInstance(CreateDocumentDto, { ...base, url });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'url')?.constraints,
    ).toHaveProperty('maxLength');
  });

  it('accepts a normal https URL', async () => {
    const dto = plainToInstance(CreateDocumentDto, base);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid mimeType', async () => {
    const dto = plainToInstance(CreateDocumentDto, {
      ...base,
      mimeType: 'application/x-evil',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'mimeType')?.constraints,
    ).toHaveProperty('isIn');
  });
});

describe('UpdateDocumentDto — SEC-009 validation propagates via PartialType', () => {
  it('rejects a javascript: scheme URL on the update path', async () => {
    const dto = plainToInstance(UpdateDocumentDto, {
      url: 'javascript:alert(1)',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'url')?.constraints,
    ).toHaveProperty('isUrl');
  });
});

describe('CreateDocumentDto — COR-011 size field validation', () => {
  it('COR-011 — rejects a negative size', async () => {
    const dto = plainToInstance(CreateDocumentDto, { ...base, size: -1 });
    const errors = await validate(dto);
    const sizeErr = errors.find((e) => e.property === 'size');
    expect(sizeErr?.constraints).toBeDefined();
    expect(
      Object.keys(sizeErr?.constraints ?? {}).some((k) =>
        ['min', 'isInt', 'isNumber'].includes(k),
      ),
    ).toBe(true);
  });

  it('COR-011 — rejects a float size', async () => {
    const dto = plainToInstance(CreateDocumentDto, { ...base, size: 3.14 });
    const errors = await validate(dto);
    const sizeErr = errors.find((e) => e.property === 'size');
    expect(sizeErr?.constraints).toBeDefined();
    expect(
      Object.keys(sizeErr?.constraints ?? {}).some((k) =>
        ['isInt', 'isNumber'].includes(k),
      ),
    ).toBe(true);
  });

  it('COR-011 — accepts size: 0 (zero-byte document)', async () => {
    const dto = plainToInstance(CreateDocumentDto, { ...base, size: 0 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'size')).toBeUndefined();
  });
});
