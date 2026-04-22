export const PERSONA_PRESETS = [
  'persona_01', 'persona_02', 'persona_03', 'persona_04', 'persona_05', 'persona_06',
  'persona_07', 'persona_08', 'persona_09', 'persona_10', 'persona_11', 'persona_12',
  'persona_13', 'persona_14', 'persona_15', 'persona_16', 'persona_17', 'persona_18',
  'persona_19', 'persona_20', 'persona_21', 'persona_22', 'persona_23', 'persona_24',
  'persona_25', 'persona_26', 'persona_27', 'persona_28', 'persona_29', 'persona_30',
  'persona_31', 'persona_32', 'persona_33', 'persona_34', 'persona_35', 'persona_36',
  'persona_37', 'persona_38', 'persona_39', 'persona_40', 'persona_41', 'persona_42',
  'persona_43', 'persona_44', 'persona_45', 'persona_46', 'persona_47', 'persona_48',
] as const;

export const VALID_PRESETS = ['initials', ...PERSONA_PRESETS] as const;

export type AvatarPreset = typeof VALID_PRESETS[number];
