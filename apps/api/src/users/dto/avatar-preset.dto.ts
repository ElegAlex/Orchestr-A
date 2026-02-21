import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export const VALID_PRESETS = [
  'avatar_01',
  'avatar_02',
  'avatar_03',
  'avatar_04',
  'avatar_05',
  'avatar_06',
  'avatar_07',
  'avatar_08',
  'avatar_09',
  'avatar_10',
] as const;

export type AvatarPreset = (typeof VALID_PRESETS)[number];

export class AvatarPresetDto {
  @ApiProperty({
    description: 'Identifiant du preset avatar',
    enum: VALID_PRESETS,
    example: 'avatar_01',
  })
  @IsEnum(VALID_PRESETS)
  preset: AvatarPreset;
}
