import { expect, test } from 'bun:test';
import { assignAtlas, extractPathD, type SpriteBox } from '../../../scripts/build-tooth-sprite';
import { TOOTH_SYMBOLS as GENERATED } from './symbols.generated';
import {
  LOWER_M3_OCCLUSAL_ID,
  LOWER_M3_OCCLUSAL_SOURCE,
  LOWER_M3_PROFILE_ID,
  LOWER_M3_PROFILE_SOURCE,
  TOOTH_SYMBOLS,
  UPPER_M3_OCCLUSAL_ID,
  UPPER_M3_OCCLUSAL_SOURCE,
  UPPER_M3_PROFILE_ID,
  UPPER_M3_PROFILE_SOURCE,
} from './symbols';

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

test('asigna paths de cada atlas solo contra las cajas de ese atlas', async () => {
  const primarySvg = await Bun.file('raw/pagina-periortograma/icons-001.svg').text();
  const m3Svg = await Bun.file('raw/pagina-periortograma/icons-002.svg').text();
  const primaryBoxes = (
    (await Bun.file('raw/pagina-periortograma/periodontograma-sprite-coordinates.json').json()) as {
      elements: SpriteBox[];
    }
  ).elements;
  const m3Boxes = (
    (await Bun.file('raw/pagina-periortograma/icons-002-coordinates.json').json()) as {
      elements: SpriteBox[];
    }
  ).elements;

  const m3Paths = extractPathD(m3Svg);
  const primaryPaths = new Set(extractPathD(primarySvg).map((raw) => raw.replace(/[\s,]+/g, ' ').trim()));
  const own = assignAtlas(m3Paths, m3Boxes, 0, false);
  const crossed = assignAtlas(m3Paths, [...primaryBoxes, ...m3Boxes], 0, false);

  expect(own.empty).toEqual([]);
  expect(own.omitted).toBeLessThan(crossed.omitted);

  for (const id of M3_IDS) {
    expect(GENERATED[id]?.outline).toEqual(own.symbols[id]?.outline);
    for (const d of GENERATED[id]!.outline) {
      expect(primaryPaths.has(d)).toBe(false);
    }
  }
});

test('el M3 superior de perfil copia lower_tooth_profiles_01 (ya raíz-arriba)', () => {
  const source = TOOTH_SYMBOLS[UPPER_M3_PROFILE_SOURCE];
  const derived = TOOTH_SYMBOLS[UPPER_M3_PROFILE_ID];
  expect(source).toBeDefined();
  expect(derived).toEqual(source);
  expect(derived).not.toEqual(GENERATED[UPPER_M3_PROFILE_ID]);
});

test('el M3 superior oclusal copia upper_occlusal_01', () => {
  const source = TOOTH_SYMBOLS[UPPER_M3_OCCLUSAL_SOURCE];
  const derived = TOOTH_SYMBOLS[UPPER_M3_OCCLUSAL_ID];
  expect(source).toBeDefined();
  expect(derived).toEqual(source);
  expect(derived).not.toEqual(GENERATED[UPPER_M3_OCCLUSAL_ID]);
});

test('el M3 inferior de perfil copia upper_tooth_profiles_01', () => {
  const source = TOOTH_SYMBOLS[LOWER_M3_PROFILE_SOURCE];
  const derived = TOOTH_SYMBOLS[LOWER_M3_PROFILE_ID];
  expect(source).toBeDefined();
  expect(derived).toEqual(source);
  expect(derived).not.toEqual(GENERATED[LOWER_M3_PROFILE_ID]);
});

test('el M3 inferior oclusal copia lower_occlusal_01', () => {
  const source = TOOTH_SYMBOLS[LOWER_M3_OCCLUSAL_SOURCE];
  const derived = TOOTH_SYMBOLS[LOWER_M3_OCCLUSAL_ID];
  expect(source).toBeDefined();
  expect(derived).toEqual(source);
  expect(derived).not.toEqual(GENERATED[LOWER_M3_OCCLUSAL_ID]);
});
