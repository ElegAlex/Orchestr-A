import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const PERSONA_PRESETS = Array.from(
  { length: 48 },
  (_, i) => `persona_${String(i + 1).padStart(2, '0')}`,
);

export const VALID_PRESETS: readonly string[] = [
  'initials',
  ...PERSONA_PRESETS,
];

export type AvatarPreset = (typeof VALID_PRESETS)[number];

export class AvatarPresetDto {
  @ApiProperty({
    description: 'Identifiant du preset avatar',
    enum: VALID_PRESETS,
    example: 'persona_01',
  })
  @IsIn(VALID_PRESETS as string[])
  preset: AvatarPreset;
}
