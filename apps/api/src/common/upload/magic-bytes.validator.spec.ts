import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { assertMagicBytes } from './magic-bytes.validator';

// Minimal 1x1 PNG (89 50 4E 47 0D 0A 1A 0A ...)
const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

// Minimal PDF (%PDF-1.4 header)
const PDF_BUFFER = Buffer.concat([
  Buffer.from('%PDF-1.4\n'),
  Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
  Buffer.from('2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\n'),
  Buffer.from(
    'xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n',
  ),
  Buffer.from('trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n110\n%%EOF\n'),
]);

describe('assertMagicBytes', () => {
  it('accepts a real PNG buffer for kind "image"', async () => {
    const result = await assertMagicBytes(PNG_BUFFER, 'image');
    expect(result.mime).toBe('image/png');
    expect(result.ext).toBe('png');
  });

  it('rejects a zero-byte buffer with "Unknown file type"', async () => {
    await expect(assertMagicBytes(Buffer.alloc(0), 'image')).rejects.toThrow(
      BadRequestException,
    );
    await expect(assertMagicBytes(Buffer.alloc(0), 'image')).rejects.toThrow(
      'Unknown file type',
    );
  });

  it('rejects a PHP shebang buffer masquerading as an image', async () => {
    const phpBuffer = Buffer.from(
      '<?php echo "pwn"; system($_GET["c"]); ?>\n' + 'A'.repeat(256),
    );
    // file-type does not recognize text/script content -> Unknown
    await expect(assertMagicBytes(phpBuffer, 'image')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a PDF buffer when kind is "image" (disallowed mime)', async () => {
    await expect(assertMagicBytes(PDF_BUFFER, 'image')).rejects.toThrow(
      /Disallowed mime: application\/pdf/,
    );
  });

  it('accepts a PDF buffer when kind is "document"', async () => {
    const result = await assertMagicBytes(PDF_BUFFER, 'document');
    expect(result.mime).toBe('application/pdf');
    expect(result.ext).toBe('pdf');
  });
});
