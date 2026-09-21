import { expect, test } from 'bun:test';
import {
  OCCLUSION_CELLS,
  OCCLUSION_TEMPORAL_CELLS,
  PERIO_COLUMN_COUNTS,
  PERIO_LOWER_FDI,
  PERIO_TEMPORAL_LOWER_FDI,
  PERIO_TEMPORAL_UPPER_FDI,
  PERIO_UPPER_FDI,
  PERIO_VIEWBOX,
  buildArchLayout,
  buildOcclusionRows,
  toothSymbolFor,
  type ArchId,
  type DentitionId,
  type ToothRowKind,
} from './periodontogram';
import { TOOTH_SYMBOLS } from './tooth-sprite/symbols';

const ARCHES: ArchId[] = ['upper', 'lower'];
const ROWS: ToothRowKind[] = ['profile', 'occlusal'];

test('tiene 16 FDI superiores y 16 inferiores, con 23 entre 32 y 33 y sin repetidos en cada arcada', () => {
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
    '2.3',
    '3.3',
    '3.4',
    '3.6',
    '3.7',
    '3.8',
  ]);
  expect(PERIO_LOWER_FDI.indexOf('2.3')).toBe(PERIO_LOWER_FDI.indexOf('3.2') + 1);
  expect(PERIO_LOWER_FDI.indexOf('3.3')).toBe(PERIO_LOWER_FDI.indexOf('2.3') + 1);
  expect(PERIO_LOWER_FDI).not.toContain('3.5');

  expect(buildArchLayout('upper').columns.map((column) => column.fdi)).toEqual([...PERIO_UPPER_FDI]);
  expect(buildArchLayout('lower').columns.map((column) => column.fdi)).toEqual([...PERIO_LOWER_FDI]);
});

test('toothSymbolFor resuelve cada FDI a su glifo propio, sin espejo', () => {
  for (const arch of ARCHES) {
    for (const row of ROWS) {
      const ids: string[] = [];

      for (let index = 0; index < PERIO_COLUMN_COUNTS.permanent[arch]; index++) {
        const ref = toothSymbolFor(arch, row, index);
        const fdi = (arch === 'upper' ? PERIO_UPPER_FDI : PERIO_LOWER_FDI)[index];
        expect(fdi).toBeDefined();
        expect(ref).toEqual({ id: `permanent_${fdi!.replaceAll('.', '')}_${row}` });
        expect(ref).not.toHaveProperty('mirrored');
        ids.push(ref.id);
      }

      expect(ids).toHaveLength(PERIO_COLUMN_COUNTS.permanent[arch]);
      expect(new Set(ids).size).toBe(PERIO_COLUMN_COUNTS.permanent[arch]);
    }
  }

  expect(toothSymbolFor('upper', 'profile', 0).id).toBe('permanent_18_profile');
  expect(toothSymbolFor('upper', 'profile', 15).id).toBe('permanent_28_profile');
  expect(toothSymbolFor('upper', 'occlusal', 0).id).toBe('permanent_18_occlusal');
  expect(toothSymbolFor('upper', 'occlusal', 15).id).toBe('permanent_28_occlusal');
  expect(toothSymbolFor('lower', 'profile', 0).id).toBe('permanent_48_profile');
  expect(toothSymbolFor('lower', 'profile', 9).id).toBe('permanent_32_profile');
  expect(toothSymbolFor('lower', 'profile', 10).id).toBe('permanent_23_profile');
  expect(toothSymbolFor('lower', 'profile', 11).id).toBe('permanent_33_profile');
  expect(toothSymbolFor('lower', 'profile', 15).id).toBe('permanent_38_profile');
  expect(toothSymbolFor('lower', 'occlusal', 0).id).toBe('permanent_48_occlusal');
  expect(toothSymbolFor('lower', 'occlusal', 10).id).toBe('permanent_23_occlusal');
  expect(toothSymbolFor('lower', 'occlusal', 15).id).toBe('permanent_38_occlusal');
});

test('todos los ids de toothSymbolFor existen en TOOTH_SYMBOLS', () => {
  for (const arch of ARCHES) {
    for (const row of ROWS) {
      for (let index = 0; index < PERIO_COLUMN_COUNTS.permanent[arch]; index++) {
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

test('columnas equidistantes y línea media entre 11|21 o 41|31', () => {
  for (const arch of ARCHES) {
    const layout = buildArchLayout(arch);
    const { columns, midlineX, viewBox } = layout;

    expect(columns).toHaveLength(PERIO_COLUMN_COUNTS.permanent[arch]);
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
    expect(eighth!.fdi).toBe(arch === 'upper' ? '1.1' : '4.1');
    expect(ninth!.fdi).toBe(arch === 'upper' ? '2.1' : '3.1');
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

test('arcadas superior e inferior reutilizan el glifo FDI 23 y omiten 35', () => {
  const upperProfile = Array.from({ length: PERIO_COLUMN_COUNTS.permanent.upper }, (_, index) =>
    toothSymbolFor('upper', 'profile', index).id,
  );
  const lowerProfile = Array.from({ length: PERIO_COLUMN_COUNTS.permanent.lower }, (_, index) =>
    toothSymbolFor('lower', 'profile', index).id,
  );
  const upperOcclusal = Array.from({ length: PERIO_COLUMN_COUNTS.permanent.upper }, (_, index) =>
    toothSymbolFor('upper', 'occlusal', index).id,
  );
  const lowerOcclusal = Array.from({ length: PERIO_COLUMN_COUNTS.permanent.lower }, (_, index) =>
    toothSymbolFor('lower', 'occlusal', index).id,
  );

  expect(upperProfile).toHaveLength(16);
  expect(lowerProfile).toHaveLength(16);
  expect(new Set([...upperProfile, ...lowerProfile]).size).toBe(31);
  expect(new Set([...upperOcclusal, ...lowerOcclusal]).size).toBe(31);
  expect(lowerProfile).not.toContain('permanent_35_profile');
  expect(lowerOcclusal).not.toContain('permanent_35_occlusal');
  expect(upperProfile.filter((id) => lowerProfile.includes(id))).toEqual(['permanent_23_profile']);
  expect(upperOcclusal.filter((id) => lowerOcclusal.includes(id))).toEqual(['permanent_23_occlusal']);

  expect(TOOTH_SYMBOLS['permanent_18_profile']).not.toEqual(TOOTH_SYMBOLS['permanent_48_profile']);
  expect(TOOTH_SYMBOLS['permanent_28_profile']).not.toEqual(TOOTH_SYMBOLS['permanent_38_profile']);
  expect(TOOTH_SYMBOLS['permanent_11_profile']).not.toEqual(TOOTH_SYMBOLS['permanent_41_profile']);
  expect(TOOTH_SYMBOLS['permanent_18_occlusal']).not.toEqual(TOOTH_SYMBOLS['permanent_48_occlusal']);

  for (const column of buildArchLayout('upper').columns) {
    expect(column.profile).not.toHaveProperty('mirrored');
    expect(column.occlusal).not.toHaveProperty('mirrored');
  }
  for (const column of buildArchLayout('lower').columns) {
    expect(column.profile).not.toHaveProperty('mirrored');
    expect(column.occlusal).not.toHaveProperty('mirrored');
  }
});

function viewBoxWidth(id: string): number {
  const symbol = TOOTH_SYMBOLS[id];
  expect(symbol).toBeDefined();
  const width = Number.parseFloat(symbol!.viewBox.split(/\s+/)[2] ?? '');
  expect(Number.isFinite(width) && width > 0).toBe(true);
  return width;
}

test('cada hemiarcada usa glifos propios: los molares son más anchos que los incisivos', () => {
  for (const arch of ARCHES) {
    for (const row of ROWS) {
      const widths = Array.from({ length: PERIO_COLUMN_COUNTS.permanent[arch] }, (_, index) =>
        viewBoxWidth(toothSymbolFor(arch, row, index).id),
      );

      const rightMolars = [widths[0]!, widths[1]!, widths[2]!];
      const rightIncisors = [widths[6]!, widths[7]!];
      const leftIncisors = [widths[8]!, widths[9]!];
      const leftMolars = widths.slice(-3);

      expect(Math.min(...rightMolars)).toBeGreaterThan(Math.max(...rightIncisors));
      expect(Math.min(...leftMolars)).toBeGreaterThan(Math.max(...leftIncisors));
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

type TemporalCatalog = {
  denticion_temporal: {
    superior: { left_to_right: Array<{ posicion: number; fdI: string; nombre: string }> };
    inferior: { left_to_right: Array<{ posicion: number; fdI: string; nombre: string }> };
  };
};

function dottedFdi(compact: string): string {
  return `${compact[0]}.${compact[1]}`;
}

test('temporal tiene 10+10 FDI distintos alineados a icons-003-temporal.json, sin repetidos', async () => {
  const catalog = (await Bun.file('raw/pagina-periortograma/icons-003-temporal.json').json()) as TemporalCatalog;
  const upper = catalog.denticion_temporal.superior.left_to_right.map((tooth) => dottedFdi(tooth.fdI));
  const lower = catalog.denticion_temporal.inferior.left_to_right.map((tooth) => dottedFdi(tooth.fdI));

  expect(PERIO_COLUMN_COUNTS.temporal).toEqual({ upper: 10, lower: 10 });
  expect(PERIO_TEMPORAL_UPPER_FDI).toHaveLength(10);
  expect(PERIO_TEMPORAL_LOWER_FDI).toHaveLength(10);
  expect(new Set(PERIO_TEMPORAL_UPPER_FDI).size).toBe(10);
  expect(new Set(PERIO_TEMPORAL_LOWER_FDI).size).toBe(10);
  expect(new Set([...PERIO_TEMPORAL_UPPER_FDI, ...PERIO_TEMPORAL_LOWER_FDI]).size).toBe(20);

  expect(upper).toEqual([...PERIO_TEMPORAL_UPPER_FDI]);
  expect(lower).toEqual([...PERIO_TEMPORAL_LOWER_FDI]);
  expect([...PERIO_TEMPORAL_UPPER_FDI]).toEqual([
    '5.5',
    '5.4',
    '5.3',
    '5.2',
    '5.1',
    '6.1',
    '6.2',
    '6.3',
    '6.4',
    '6.5',
  ]);
  expect([...PERIO_TEMPORAL_LOWER_FDI]).toEqual([
    '8.5',
    '8.4',
    '8.3',
    '8.2',
    '8.1',
    '7.1',
    '7.2',
    '7.3',
    '7.4',
    '7.5',
  ]);

  expect(buildArchLayout('upper', 'temporal').columns.map((column) => column.fdi)).toEqual([
    ...PERIO_TEMPORAL_UPPER_FDI,
  ]);
  expect(buildArchLayout('lower', 'temporal').columns.map((column) => column.fdi)).toEqual([
    ...PERIO_TEMPORAL_LOWER_FDI,
  ]);
});

test("toothSymbolFor(..., 'temporal') resuelve 55…65 y 85…75", () => {
  for (const arch of ARCHES) {
    for (const row of ROWS) {
      const ids: string[] = [];
      const fdis = arch === 'upper' ? PERIO_TEMPORAL_UPPER_FDI : PERIO_TEMPORAL_LOWER_FDI;

      for (let index = 0; index < PERIO_COLUMN_COUNTS.temporal[arch]; index++) {
        const ref = toothSymbolFor(arch, row, index, 'temporal');
        expect(fdis[index]).toBeDefined();
        expect(ref).toEqual({ id: `temporal_${fdis[index]!.replaceAll('.', '')}_${row}` });
        expect(ref).not.toHaveProperty('mirrored');
        expect(TOOTH_SYMBOLS[ref.id]).toBeDefined();
        ids.push(ref.id);
      }

      expect(ids).toHaveLength(10);
      expect(new Set(ids).size).toBe(10);
    }
  }

  expect(toothSymbolFor('upper', 'profile', 0, 'temporal').id).toBe('temporal_55_profile');
  expect(toothSymbolFor('upper', 'profile', 9, 'temporal').id).toBe('temporal_65_profile');
  expect(toothSymbolFor('upper', 'occlusal', 0, 'temporal').id).toBe('temporal_55_occlusal');
  expect(toothSymbolFor('upper', 'occlusal', 9, 'temporal').id).toBe('temporal_65_occlusal');
  expect(toothSymbolFor('lower', 'profile', 0, 'temporal').id).toBe('temporal_85_profile');
  expect(toothSymbolFor('lower', 'profile', 9, 'temporal').id).toBe('temporal_75_profile');
  expect(toothSymbolFor('lower', 'occlusal', 0, 'temporal').id).toBe('temporal_85_occlusal');
  expect(toothSymbolFor('lower', 'occlusal', 9, 'temporal').id).toBe('temporal_75_occlusal');
});

test('línea media temporal 5.1|6.1 y 8.1|7.1; viewBox y bandas iguales a permanente', () => {
  for (const arch of ARCHES) {
    const layout = buildArchLayout(arch, 'temporal');
    const permanent = buildArchLayout(arch, 'permanent');
    const { columns, midlineX, viewBox } = layout;

    expect(columns).toHaveLength(10);
    expect(midlineX).toBe(viewBox.w / 2);
    expect(viewBox).toEqual(PERIO_VIEWBOX);
    expect(viewBox).toEqual(permanent.viewBox);
    expect(layout.bands.map((band) => band.id)).toEqual(permanent.bands.map((band) => band.id));
    expect(layout.bands.map((band) => band.kind)).toEqual(permanent.bands.map((band) => band.kind));

    const fifth = columns[4];
    const sixth = columns[5];
    expect(fifth).toBeDefined();
    expect(sixth).toBeDefined();
    expect(fifth!.fdi).toBe(arch === 'upper' ? '5.1' : '8.1');
    expect(sixth!.fdi).toBe(arch === 'upper' ? '6.1' : '7.1');
    expect(fifth!.x + fifth!.width).toBeCloseTo(midlineX, 10);
    expect(sixth!.x).toBeCloseTo(midlineX, 10);
  }
});

test('buildOcclusionRows temporal refleja 5…1 | 1…5', () => {
  const blocks = buildOcclusionRows('temporal');
  const cells = [...OCCLUSION_TEMPORAL_CELLS];

  expect(cells).toEqual(['5', '4', '3', '2', '1', '1', '2', '3', '4', '5']);
  expect(blocks.map((block) => block.label)).toEqual([
    'Oclusión céntrica',
    'Lateralidad derecha',
    'Protrusión',
    'Lateralidad izquierda',
  ]);

  for (const block of blocks) {
    expect(block.rows).toHaveLength(2);
    expect([...block.rows[0]]).toEqual(cells);
    expect([...block.rows[1]]).toEqual(cells);
  }
});

test("el default 'permanent' es idéntico a hoy", () => {
  expect(buildArchLayout('upper')).toEqual(buildArchLayout('upper', 'permanent'));
  expect(buildArchLayout('lower')).toEqual(buildArchLayout('lower', 'permanent'));
  expect(buildOcclusionRows()).toEqual(buildOcclusionRows('permanent'));
  expect(toothSymbolFor('lower', 'profile', 10)).toEqual(
    toothSymbolFor('lower', 'profile', 10, 'permanent'),
  );
  expect(toothSymbolFor('lower', 'profile', 10).id).toBe('permanent_23_profile');
});

test('índice fuera de rango, símbolo ausente y línea media', () => {
  expect(() => toothSymbolFor('upper', 'profile', -1)).toThrow('índice fuera de rango: -1');
  expect(() => toothSymbolFor('upper', 'profile', 16)).toThrow('índice fuera de rango: 16');
  expect(() => toothSymbolFor('upper', 'profile', 10, 'temporal')).toThrow('índice fuera de rango: 10');
  expect(() => toothSymbolFor('upper', 'profile', 0, 'primary' as DentitionId)).toThrow(
    'símbolo ausente: primary_18_profile',
  );

  const upper = buildArchLayout('upper');
  const lower = buildArchLayout('lower');
  expect(upper.columns[7]?.fdi).toBe('1.1');
  expect(upper.columns[8]?.fdi).toBe('2.1');
  expect(lower.columns[7]?.fdi).toBe('4.1');
  expect(lower.columns[8]?.fdi).toBe('3.1');
  expect(upper.midlineX).toBe(PERIO_VIEWBOX.w / 2);
  expect(lower.midlineX).toBe(PERIO_VIEWBOX.w / 2);
});
