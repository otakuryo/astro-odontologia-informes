import { TOOTH_SYMBOLS as GENERATED } from './symbols.generated';

export const UPPER_M3_PROFILE_SOURCE = 'lower_tooth_profiles_01';
export const UPPER_M3_PROFILE_ID = 'upper_tooth_profiles_m3';
export const UPPER_M3_OCCLUSAL_SOURCE = 'upper_occlusal_01';
export const UPPER_M3_OCCLUSAL_ID = 'upper_occlusal_m3';
export const LOWER_M3_PROFILE_SOURCE = 'upper_tooth_profiles_01';
export const LOWER_M3_PROFILE_ID = 'lower_tooth_profiles_m3';
export const LOWER_M3_OCCLUSAL_SOURCE = 'lower_occlusal_01';
export const LOWER_M3_OCCLUSAL_ID = 'lower_occlusal_m3';

function cloneSymbol(id: string): { viewBox: string; outline: string[]; solid: string[] } {
  const source = GENERATED[id];
  if (!source) {
    throw new Error(`símbolo fuente ausente: ${id}`);
  }
  return {
    viewBox: source.viewBox,
    outline: [...source.outline],
    solid: [...source.solid],
  };
}

/**
 * Sprite público: los cuatro M3 se clonan del atlas principal (`*_01`).
 * Perfiles raíz-arriba; la arcada inferior los voltea con `toothFlipY`.
 * Las oclusales no se voltean.
 */
export const TOOTH_SYMBOLS: typeof GENERATED = {
  ...GENERATED,
  [UPPER_M3_PROFILE_ID]: cloneSymbol(UPPER_M3_PROFILE_SOURCE),
  [UPPER_M3_OCCLUSAL_ID]: cloneSymbol(UPPER_M3_OCCLUSAL_SOURCE),
  [LOWER_M3_PROFILE_ID]: cloneSymbol(LOWER_M3_PROFILE_SOURCE),
  [LOWER_M3_OCCLUSAL_ID]: cloneSymbol(LOWER_M3_OCCLUSAL_SOURCE),
};
