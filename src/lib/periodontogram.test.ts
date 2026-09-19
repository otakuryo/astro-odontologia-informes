import { expect, test } from 'bun:test';
import {
  OCCLUSION_CELLS,
  PERIO_COLUMN_COUNT,
  PERIO_LOWER_FDI,
  PERIO_UPPER_FDI,
  PERIO_VIEWBOX,
  buildArchLayout,
  buildOcclusionRows,
  toothSymbolFor,
  type ArchId,
  type ToothRowKind,
} from './periodontogram';
import { TOOTH_SYMBOLS } from './tooth-sprite/symbols.generated';

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

test('toothSymbolFor: mirrored false en 0-7, true en 8-15; pares (0,15) y (7,8) comparten id', () => {
  for (const arch of ARCHES) {
    for (const row of ROWS) {
      for (let index = 0; index < HEMI_END; index++) {
        expect(toothSymbolFor(arch, row, index).mirrored).toBe(false);
      }
      for (let index = HEMI_END; index < PERIO_COLUMN_COUNT; index++) {
        expect(toothSymbolFor(arch, row, index).mirrored).toBe(true);
      }

      expect(toothSymbolFor(arch, row, 0).id).toBe(toothSymbolFor(arch, row, 15).id);
      expect(toothSymbolFor(arch, row, 7).id).toBe(toothSymbolFor(arch, row, 8).id);
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

test('fracciones de banda suman 1 ± 0,001', () => {
  for (const arch of ARCHES) {
    const total = buildArchLayout(arch).bands.reduce((sum, band) => sum + band.fraction, 0);
    expect(Math.abs(total - 1)).toBeLessThanOrEqual(0.001);
  }
});

test('la arcada inferior invierte el orden de bandas respecto a la superior', () => {
  const upper = buildArchLayout('upper').bands.map((band) => band.id);
  const lower = buildArchLayout('lower').bands.map((band) => band.id);

  expect(lower).toEqual([...upper].reverse());
  expect(upper).toEqual([
    'grid-321',
    'facial',
    'gap-facial-occlusal',
    'occlusal',
    'gap-occlusal-lingual',
    'lingual',
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

test('retícula 3/2/1 tiene 4 subfilas, 1/2/3 tiene 3, y las bandas rayadas llevan 7 líneas', () => {
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
      expect(grid321.subrows).toHaveLength(4);
      expect([...grid321.scale]).toEqual([3, 2, 1]);
    }
    if (grid123?.kind === 'grid') {
      expect(grid123.subrows).toHaveLength(3);
      expect([...grid123.scale]).toEqual([1, 2, 3]);
    }
    if (facial?.kind === 'facial') {
      expect(facial.hatchYs).toHaveLength(7);
    }
    if (lingual?.kind === 'lingual') {
      expect(lingual.hatchYs).toHaveLength(7);
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
