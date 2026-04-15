import { BadRequestException } from '@nestjs/common';

export const UPLOAD_MIME_WHITELIST = {
  image: ['image/png', 'image/jpeg', 'image/webp'],
  document: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  any: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
} as const;

export type UploadKind = keyof typeof UPLOAD_MIME_WHITELIST;

export async function assertMagicBytes(
  buffer: Buffer,
  kind: UploadKind,
): Promise<{ mime: string; ext: string }> {
  const { fileTypeFromBuffer } = await import('file-type');
  const result = await fileTypeFromBuffer(buffer);
  if (!result) throw new BadRequestException('Unknown file type');
  if (!UPLOAD_MIME_WHITELIST[kind].includes(result.mime as never)) {
    throw new BadRequestException(`Disallowed mime: ${result.mime}`);
  }
  return result;
}
