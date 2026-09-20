import { expect, test } from 'bun:test';
import { TOOTH_SYMBOLS } from './symbols.generated';

const M3_IDS = [
  'upper_tooth_profiles_m3',
  'upper_occlusal_m3',
  'lower_tooth_profiles_m3',
  'lower_occlusal_m3',
] as const;

test('TOOTH_SYMBOLS incluye los cuatro terceros molares', () => {
  for (const id of M3_IDS) {
    const symbol = TOOTH_SYMBOLS[id];
    expect(symbol).toBeDefined();
    expect(symbol!.outline.length).toBeGreaterThan(0);
    expect(symbol!.solid.length).toBeGreaterThan(0);

    const nums = symbol!.viewBox.split(/\s+/).map(Number);
    expect(nums).toHaveLength(4);
    for (const value of nums) {
      expect(value).toBeGreaterThan(0);
    }
  }
});
