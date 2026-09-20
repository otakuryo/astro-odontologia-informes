import { expect, test } from 'bun:test';
import {
  OCCLUSION_CELLS,
  PERIO_COLUMN_COUNT,
  PERIO_LOWER_FDI,
  PERIO_UPPER_FDI,
  PERIO_VIEWBOX,
  buildArchLayout,
  buildOcclusionRows,
  toothFlipY,
  toothSymbolFor,
  type ArchId,
  type ToothRowKind,
} from './periodontogram';
import { TOOTH_SYMBOLS } from './tooth-sprite/symbols';

const ARCHES: ArchId[] = ['upper', 'lower'];
const ROWS: ToothRowKind[] = ['profile', 'occlusal'];
const HEMI_END = 8;

test('tiene 16 FDI por arcada, sin repetidos y en orden de hoja', () => {
  expect(PERIO_UPPER_FDI).toHaveLength(16);
  expect(PERIO_LOWER_FDI).toHaveLength(16);
  expect(new Set(PERIO_UPPER_FDI).size).toBe(16);
  expect(new Set(PERIO_LOWER_FDI).size).toBe(16);

  expect([...PERIO_UPPER_FDI]).toEqual([
    '1.8',
    '1.7',
    '1.6',
    '1.5',
    '1.4',
    '1.3',
    '1.2',
    '1.1',
    '2.1',
    '2.2',
    '2.3',
    '2.4',
    '2.5',
    '2.6',
    '2.7',
    '2.8',
  ]);

  expect([...PERIO_LOWER_FDI]).toEqual([
    '4.8',
    '4.7',
    '4.6',
    '4.5',
    '4.4',
    '4.3',
    '4.2',
    '4.1',
    '3.1',
    '3.2',
    '3.3',
    '3.4',
    '3.5',
    '3.6',
    '3.7',
    '3.8',
  ]);

  expect(buildArchLayout('upper').columns.map((column) => column.fdi)).toEqual([...PERIO_UPPER_FDI]);
  expect(buildArchLayout('lower').columns.map((column) => column.fdi)).toEqual([...PERIO_LOWER_FDI]);
});

test('toothSymbolFor: índice 0 es _m3; 16 posiciones espejan 8 ids; 7 y 8 comparten id', () => {
  for (const arch of ARCHES) {
    for (const row of ROWS) {
      const first = toothSymbolFor(arch, row, 0);
      const last = toothSymbolFor(arch, row, 15);
      const innerRight = toothSymbolFor(arch, row, 7);
      const innerLeft = toothSymbolFor(arch, row, 8);

      expect(first.id.endsWith('_m3')).toBe(true);
      expect(first.mirrored).toBe(false);
      expect(last.id).toBe(first.id);
      expect(last.mirrored).toBe(true);

      expect(innerRight.id).toBe(innerLeft.id);
      expect(innerRight.mirrored).toBe(false);
      expect(innerLeft.mirrored).toBe(true);

      for (let index = 0; index < HEMI_END; index++) {
        expect(toothSymbolFor(arch, row, index).mirrored).toBe(false);
      }
      for (let index = HEMI_END; index < PERIO_COLUMN_COUNT; index++) {
        expect(toothSymbolFor(arch, row, index).mirrored).toBe(true);
      }

      const ids = Array.from({ length: PERIO_COLUMN_COUNT }, (_, index) => toothSymbolFor(arch, row, index).id);
      expect(new Set(ids).size).toBe(8);
    }
  }
});

test('todos los ids de toothSymbolFor existen en TOOTH_SYMBOLS', () => {
  for (const arch of ARCHES) {
    for (const row of ROWS) {
      for (let index = 0; index < PERIO_COLUMN_COUNT; index++) {
        const { id } = toothSymbolFor(arch, row, index);
        expect(TOOTH_SYMBOLS[id]).toBeDefined();
      }
    }
  }
});

test('fracciones de banda suman 1 ± 0,001 y no hay bandas gap', () => {
  for (const arch of ARCHES) {
    const { bands } = buildArchLayout(arch);
    const total = bands.reduce((sum, band) => sum + band.fraction, 0);
    expect(Math.abs(total - 1)).toBeLessThanOrEqual(0.001);
    expect(bands.map((band) => band.kind)).not.toContain('gap');
    expect(bands.map((band) => band.id).some((id) => id.startsWith('gap'))).toBe(false);
  }
});

test('orden de bandas: retículas 321/123 fijas; solo se intercambian Facial y Lingual', () => {
  expect(buildArchLayout('upper').bands.map((band) => band.id)).toEqual([
    'grid-321',
    'facial',
    'occlusal',
    'lingual',
    'grid-123',
  ]);
  expect(buildArchLayout('lower').bands.map((band) => band.id)).toEqual([
    'grid-321',
    'lingual',
    'occlusal',
    'facial',
    'grid-123',
  ]);
});

test('el viewBox de la arcada es apaisado (~975×397, ≈2,456:1)', () => {
  expect(PERIO_VIEWBOX.w).toBe(975);
  expect(PERIO_VIEWBOX.h).toBe(397);
  expect(PERIO_VIEWBOX.w / PERIO_VIEWBOX.h).toBeCloseTo(2.456, 3);
  expect(PERIO_VIEWBOX.w).toBeGreaterThan(PERIO_VIEWBOX.h * 2);

  for (const arch of ARCHES) {
    const { viewBox } = buildArchLayout(arch);
    expect(viewBox.w).toBe(PERIO_VIEWBOX.w);
    expect(viewBox.h).toBe(PERIO_VIEWBOX.h);
    expect(viewBox.w / viewBox.h).toBeGreaterThan(2.4);
    expect(viewBox.w / viewBox.h).toBeLessThan(2.5);
  }
});

test('columnas equidistantes y línea media exactamente en el centro del viewBox', () => {
  for (const arch of ARCHES) {
    const layout = buildArchLayout(arch);
    const { columns, midlineX, viewBox } = layout;

    expect(columns).toHaveLength(PERIO_COLUMN_COUNT);
    expect(midlineX).toBe(viewBox.w / 2);

    const width = columns[0]?.width;
    expect(width).toBeGreaterThan(0);

    for (let index = 1; index < columns.length; index++) {
      const previous = columns[index - 1];
      const current = columns[index];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      expect(current!.width).toBe(width);
      expect(current!.x - previous!.x).toBeCloseTo(width!, 10);
    }

    const eighth = columns[7];
    const ninth = columns[8];
    expect(eighth).toBeDefined();
    expect(ninth).toBeDefined();
    expect(eighth!.x + eighth!.width).toBeCloseTo(midlineX, 10);
    expect(ninth!.x).toBeCloseTo(midlineX, 10);
  }
});

test('retícula 3/2/1 tiene 3 subfilas, 1/2/3 tiene 3, y las bandas rayadas llevan 9 líneas', () => {
  for (const arch of ARCHES) {
    const byId = new Map(buildArchLayout(arch).bands.map((band) => [band.id, band]));
    const grid321 = byId.get('grid-321');
    const grid123 = byId.get('grid-123');
    const facial = byId.get('facial');
    const lingual = byId.get('lingual');

    expect(grid321?.kind).toBe('grid');
    expect(grid123?.kind).toBe('grid');
    expect(facial?.kind).toBe('facial');
    expect(lingual?.kind).toBe('lingual');

    if (grid321?.kind === 'grid') {
      expect(grid321.subrows).toHaveLength(3);
      expect([...grid321.scale]).toEqual([3, 2, 1]);
    }
    if (grid123?.kind === 'grid') {
      expect(grid123.subrows).toHaveLength(3);
      expect([...grid123.scale]).toEqual([1, 2, 3]);
    }
    if (facial?.kind === 'facial') {
      expect(facial.hatchYs).toHaveLength(9);
    }
    if (lingual?.kind === 'lingual') {
      expect(lingual.hatchYs).toHaveLength(9);
    }
  }
});

test('el rayado de Facial y Lingual queda estrictamente en el lado radicular', () => {
  for (const arch of ARCHES) {
    for (const band of buildArchLayout(arch).bands) {
      if (band.kind !== 'facial' && band.kind !== 'lingual') {
        continue;
      }

      const midpoint = band.y + band.height / 2;
      expect(band.hatchYs).toHaveLength(9);

      for (const y of band.hatchYs) {
        if (arch === 'upper') {
          expect(y).toBeLessThan(midpoint);
        } else {
          expect(y).toBeGreaterThan(midpoint);
        }
      }
    }
  }
});

test('el rayado radicular es equiespaciado y queda dentro de hatchRange', () => {
  for (const arch of ARCHES) {
    for (const band of buildArchLayout(arch).bands) {
      if (band.kind !== 'facial' && band.kind !== 'lingual') {
        continue;
      }

      const ys = [...band.hatchYs];
      expect(ys).toHaveLength(9);

      const first = ys[0];
      const second = ys[1];
      const last = ys[ys.length - 1];
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(last).toBeDefined();

      const step = second! - first!;
      expect(step).toBeGreaterThan(0);

      for (let index = 1; index < ys.length; index++) {
        expect(Math.abs(ys[index]! - ys[index - 1]! - step)).toBeLessThanOrEqual(0.01);
      }

      const rangeBottom = band.hatchRange.y + band.hatchRange.height;
      expect(first!).toBeGreaterThanOrEqual(band.hatchRange.y);
      expect(first!).toBeLessThanOrEqual(rangeBottom);
      expect(last!).toBeGreaterThanOrEqual(band.hatchRange.y);
      expect(last!).toBeLessThanOrEqual(rangeBottom);
    }
  }
});

test('la banda oclusal no expone hatchYs ni hatchRange', () => {
  for (const arch of ARCHES) {
    const occlusal = buildArchLayout(arch).bands.find((band) => band.kind === 'occlusal');
    expect(occlusal).toBeDefined();
    expect(occlusal?.kind).toBe('occlusal');
    expect(occlusal).not.toHaveProperty('hatchYs');
    expect(occlusal).not.toHaveProperty('hatchRange');
  }
});

test('las 6 subfilas de retícula tienen la misma altura (±0,5 %)', () => {
  for (const arch of ARCHES) {
    const heights = buildArchLayout(arch)
      .bands.filter((band) => band.kind === 'grid')
      .flatMap((band) => band.subrows.map((subrow) => subrow.height));

    expect(heights).toHaveLength(6);
    const reference = heights[0];
    expect(reference).toBeGreaterThan(0);
    for (const height of heights) {
      expect(Math.abs(height - reference!) / reference!).toBeLessThanOrEqual(0.005);
    }
  }
});

test('toothFlipY es false en upper y true en lower', () => {
  expect(toothFlipY('upper')).toBe(false);
  expect(toothFlipY('lower')).toBe(true);
});

function viewBoxWidth(id: string): number {
  const symbol = TOOTH_SYMBOLS[id];
  expect(symbol).toBeDefined();
  const width = Number.parseFloat(symbol!.viewBox.split(/\s+/)[2] ?? '');
  expect(Number.isFinite(width) && width > 0).toBe(true);
  return width;
}

test('anchos viewBox: decrecen de molar a incisivo lateral; el central puede ensancharse', () => {
  for (const arch of ARCHES) {
    for (const row of ROWS) {
      const widths = Array.from({ length: HEMI_END }, (_, index) =>
        viewBoxWidth(toothSymbolFor(arch, row, index).id),
      );

      // De M1 (índice 2) al incisivo lateral (índice 6) el recorte del atlas es no creciente.
      for (let index = 2; index < 6; index++) {
        expect(widths[index + 1]!).toBeLessThanOrEqual(widths[index]!);
      }

      // El lateral es el más estrecho del tramo molar→lateral; el central (índice 7) puede rebotar.
      expect(Math.min(...widths.slice(0, 7))).toBe(widths[6]);

      const molarMax = Math.max(widths[0]!, widths[1]!, widths[2]!);
      expect(molarMax).toBeGreaterThan(Math.max(widths[3]!, widths[4]!));
      expect(widths[7]!).toBeLessThanOrEqual(molarMax);
    }
  }
});

test('buildOcclusionRows refleja las cuatro etiquetas y dos filas 8…1 | 1…8', () => {
  const blocks = buildOcclusionRows();
  const cells = [...OCCLUSION_CELLS];

  expect(blocks.map((block) => block.label)).toEqual([
    'Oclusión céntrica',
    'Lateralidad derecha',
    'Protrusión',
    'Lateralidad izquierda',
  ]);

  expect(cells).toEqual(['8', '7', '6', '5', '4', '3', '2', '1', '1', '2', '3', '4', '5', '6', '7', '8']);

  for (const block of blocks) {
    expect(block.rows).toHaveLength(2);
    expect([...block.rows[0]]).toEqual(cells);
    expect([...block.rows[1]]).toEqual(cells);
  }
});
