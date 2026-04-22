export const PERSONA_PRESETS = Array.from(
  { length: 48 },
  (_, i) => `persona_${String(i + 1).padStart(2, '0')}`,
);

export const VALID_PRESETS = ['initials', ...PERSONA_PRESETS] as const;

export type AvatarPreset = typeof VALID_PRESETS[number];
