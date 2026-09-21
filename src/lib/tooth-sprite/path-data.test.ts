import { expect, test } from 'bun:test';
import { isHatchFragment } from '../../../scripts/build-m3-atlas';
import { atlasToUserSpace, splitSubpaths, subpathBBox } from './path-data';
import { TOOTH_SYMBOLS } from './symbols.generated';

const KNOWN_PATH =
  'M3590 6922 c0 -12 108 -87 115 -80 3 2 -16 20 -42 39 -63 46 -73 52 -73 41z';

const COORDS_PATH = 'raw/pagina-periortograma/icons-003-permanent-coordinates.json';

test('splitSubpaths separa subpaths en cada z m', () => {
  const compact = 'M10 10 l5 0 z m 20 0 l5 0 z m 10 5 z';
  expect(splitSubpaths(compact)).toEqual(['M10 10 l5 0 z', 'm 20 0 l5 0 z', 'm 10 5 z']);

  const withNewlines = 'M0 0 l10 0z\nm20 0 l5 0z\nm1 1z';
  expect(splitSubpaths(withNewlines)).toHaveLength(3);
  expect(splitSubpaths(withNewlines)[0]).toStartWith('M');
  expect(splitSubpaths(withNewlines)[1]?.trim()).toStartWith('m');
  expect(splitSubpaths(withNewlines)[2]?.trim()).toStartWith('m');

  const potrace = 'M3620 8403 c-20 -25 -54 -23z m95 -48 c92 -96 66 148z m118 -929 c18 -7 195 59z';
  const parts = splitSubpaths(potrace);
  expect(parts).toHaveLength(3);
  expect(parts[0]).toStartWith('M3620');
  expect(parts[1]).toStartWith('m95');
  expect(parts[2]).toStartWith('m118');
});

test('subpathBBox del path conocido del atlas', () => {
  const bbox = subpathBBox(KNOWN_PATH);
  expect(bbox.x).toBeCloseTo(3590, 5);
  expect(bbox.y).toBeCloseTo(6841.54, 2);
  expect(bbox.w).toBeCloseTo(115.312, 2);
  expect(bbox.h).toBeCloseTo(85.2, 2);
});

test('subpathBBox soporta h, v, l y C', () => {
  expect(subpathBBox('M10 10 h10 v10')).toEqual({ x: 10, y: 10, w: 10, h: 10 });
  expect(subpathBBox('M10 10 l10 0 l0 10 z')).toEqual({ x: 10, y: 10, w: 10, h: 10 });
  expect(subpathBBox('M0 0 C0 0 10 0 10 0')).toEqual({ x: 0, y: 0, w: 10, h: 0 });
});

test('atlasToUserSpace aplica translate(0,887) scale(0.1,-0.1)', () => {
  expect(atlasToUserSpace({ x: 0, y: 0, w: 10, h: 20 })).toEqual({
    x: 0,
    y: 885,
    w: 1,
    h: 2,
  });

  const point = atlasToUserSpace({ x: 3590, y: 6922, w: 0, h: 0 });
  expect(point.x).toBeCloseTo(359);
  expect(point.y).toBeCloseTo(887 - 692.2);

  const known = atlasToUserSpace(subpathBBox(KNOWN_PATH));
  const bbox = subpathBBox(KNOWN_PATH);
  expect(known.x).toBeCloseTo(bbox.x * 0.1);
  expect(known.y).toBeCloseTo(887 - (bbox.y + bbox.h) * 0.1);
  expect(known.w).toBeCloseTo(bbox.w * 0.1);
  expect(known.h).toBeCloseTo(bbox.h * 0.1);
});

test('isHatchFragment detecta rayas horizontales largas y finas', () => {
  expect(isHatchFragment({ h: 2, w: 40 })).toBe(true);
  expect(isHatchFragment({ h: 95, w: 55 })).toBe(false);
  expect(isHatchFragment({ h: 2, w: 8 })).toBe(false);
});

test('TOOTH_SYMBOLS alinea las 64 entradas del atlas permanente', async () => {
  const coords = (await Bun.file(COORDS_PATH).json()) as {
    elements: Array<{ id: string; rect: [number, number, number, number] }>;
  };

  const ids = coords.elements.map((element) => element.id);
  expect(ids).toHaveLength(64);
  expect(Object.keys(TOOTH_SYMBOLS).filter((id) => id.startsWith('permanent_'))).toEqual(ids);
  expect(new Set(ids.map((id) => /^permanent_(\d{2})_/.exec(id)?.[1])).size).toBe(32);

  for (const fdi of ['18', '28', '38', '48']) {
    expect(ids).toContain(`permanent_${fdi}_profile`);
    expect(ids).toContain(`permanent_${fdi}_occlusal`);
  }

  for (const element of coords.elements) {
    const symbol = TOOTH_SYMBOLS[element.id];
    expect(symbol).toBeDefined();
    expect(symbol?.viewBox).toBe(element.rect.join(' '));
    expect(symbol!.outline.length).toBeGreaterThan(0);
    expect(symbol!.solid).toHaveLength(symbol!.outline.length);

    for (const d of symbol!.solid) {
      expect(d.match(/M/g)).toHaveLength(1);
    }
  }
});
