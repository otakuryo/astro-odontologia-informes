import { TOOTH_SYMBOLS } from './tooth-sprite/symbols';

export type ArchId = 'upper' | 'lower';
export type ToothRowKind = 'profile' | 'occlusal';

export const PERIO_COLUMN_COUNT = 16;
export const PERIO_LATERAL_GUTTER = 0.0605;
/** Caja de arcada apaisada (~975×397 en la hoja de referencia; ≈2,456:1). */
export const PERIO_VIEWBOX = { w: 975, h: 397 } as const;

export const PERIO_UPPER_FDI = [
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
] as const;

export const PERIO_LOWER_FDI = [
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
] as const;

export type PerioUpperFdi = (typeof PERIO_UPPER_FDI)[number];
export type PerioLowerFdi = (typeof PERIO_LOWER_FDI)[number];
export type PerioFdi = PerioUpperFdi | PerioLowerFdi;

export type ToothSymbolRef = {
  id: string;
  /** Si es true, el componente debe aplicar `scale(-1, 1)`. */
  mirrored: boolean;
};

export type ArchColumn = {
  index: number;
  fdi: PerioFdi;
  x: number;
  width: number;
  cx: number;
  profile: ToothSymbolRef;
  occlusal: ToothSymbolRef;
};

type BandBase = {
  fraction: number;
  y: number;
  height: number;
};

export type GridBand = BandBase & {
  kind: 'grid';
  id: 'grid-321' | 'grid-123';
  scale: readonly number[];
  subrows: ReadonlyArray<{ index: number; y: number; height: number }>;
};

export type HatchedBand = BandBase & {
  kind: 'facial' | 'lingual';
  id: 'facial' | 'lingual';
  hatchYs: readonly number[];
  hatchRange: { y: number; height: number };
};

export type OcclusalBand = BandBase & {
  kind: 'occlusal';
  id: 'occlusal';
};

export type ArchBand = GridBand | HatchedBand | OcclusalBand;

export type ArchLayout = {
  arch: ArchId;
  viewBox: { w: number; h: number };
  gutter: { left: number; right: number };
  content: { x: number; width: number };
  columns: ArchColumn[];
  midlineX: number;
  bands: ArchBand[];
};

export const OCCLUSION_LABELS = [
  'Oclusión céntrica',
  'Lateralidad derecha',
  'Protrusión',
  'Lateralidad izquierda',
] as const;

export type OcclusionLabel = (typeof OCCLUSION_LABELS)[number];

export const OCCLUSION_CELLS = [
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
  '1',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
] as const;

export type OcclusionBlock = {
  label: OcclusionLabel;
  rows: readonly [readonly string[], readonly string[]];
};

const HEMIARCH_COUNT = 8;
const HATCH_LINE_COUNT = 9;
const GRID_321_SUBROWS = 3;
const GRID_123_SUBROWS = 3;

const SYMBOL_CATEGORY: Record<ArchId, Record<ToothRowKind, string>> = {
  upper: {
    profile: 'upper_tooth_profiles',
    occlusal: 'upper_occlusal',
  },
  lower: {
    profile: 'lower_tooth_profiles',
    occlusal: 'lower_occlusal',
  },
};

/** Fracciones medidas en la hoja: retícula 3/2/1, facial, oclusal, lingual, retícula 1/2/3.
 *  La retícula 321 queda en 3 filas (misma altura de fila que 123), no en las 4 de la plantilla. */
const MEASURED_GRID_321 = 0.1622;
const MEASURED_FACIAL = 0.2527;
const MEASURED_OCCLUSAL = 0.1436;
const MEASURED_LINGUAL = 0.2261;
const MEASURED_GRID_123 = 0.1622;

const MEASURED_TOTAL =
  MEASURED_GRID_321 + MEASURED_FACIAL + MEASURED_OCCLUSAL + MEASURED_LINGUAL + MEASURED_GRID_123;

type BandSpec =
  | { kind: 'grid'; id: GridBand['id']; measured: number; scale: readonly number[]; subrowCount: number }
  | { kind: 'facial'; id: 'facial'; measured: number }
  | { kind: 'lingual'; id: 'lingual'; measured: number }
  | { kind: 'occlusal'; id: 'occlusal'; measured: number };

const GRID_321_SPEC = {
  kind: 'grid',
  id: 'grid-321',
  measured: MEASURED_GRID_321,
  scale: [3, 2, 1],
  subrowCount: GRID_321_SUBROWS,
} as const satisfies BandSpec;

const GRID_123_SPEC = {
  kind: 'grid',
  id: 'grid-123',
  measured: MEASURED_GRID_123,
  scale: [1, 2, 3],
  subrowCount: GRID_123_SUBROWS,
} as const satisfies BandSpec;

const OCCLUSAL_SPEC = { kind: 'occlusal', id: 'occlusal', measured: MEASURED_OCCLUSAL } as const satisfies BandSpec;

const UPPER_BAND_SPECS: readonly BandSpec[] = [
  GRID_321_SPEC,
  { kind: 'facial', id: 'facial', measured: MEASURED_FACIAL },
  OCCLUSAL_SPEC,
  { kind: 'lingual', id: 'lingual', measured: MEASURED_LINGUAL },
  GRID_123_SPEC,
];

const LOWER_BAND_SPECS: readonly BandSpec[] = [
  GRID_321_SPEC,
  { kind: 'lingual', id: 'lingual', measured: MEASURED_LINGUAL },
  OCCLUSAL_SPEC,
  { kind: 'facial', id: 'facial', measured: MEASURED_FACIAL },
  GRID_123_SPEC,
];

function parseViewBoxX(viewBox: string): number {
  const x = Number.parseFloat(viewBox.split(' ')[0] ?? '');
  if (!Number.isFinite(x)) {
    throw new Error(`viewBox inválido: ${viewBox}`);
  }
  return x;
}

function idsForCategory(category: string): string[] {
  const prefix = `${category}_`;
  const ids = Object.keys(TOOTH_SYMBOLS)
    .filter((id) => id.startsWith(prefix) && /_\d+$/.test(id))
    .sort((a, b) => {
      const symbolA = TOOTH_SYMBOLS[a];
      const symbolB = TOOTH_SYMBOLS[b];
      if (!symbolA || !symbolB) {
        throw new Error(`símbolo ausente al ordenar ${category}`);
      }
      return parseViewBoxX(symbolA.viewBox) - parseViewBoxX(symbolB.viewBox);
    });

  if (ids.length !== 15) {
    throw new Error(`${category}: se esperaban 15 símbolos, hay ${ids.length}`);
  }

  return ids;
}

function rightHemiarch(category: string): readonly string[] {
  return [`${category}_m3`, ...idsForCategory(category).slice(0, 7)];
}

const RIGHT_HEMIARCH: Record<ArchId, Record<ToothRowKind, readonly string[]>> = {
  upper: {
    profile: rightHemiarch(SYMBOL_CATEGORY.upper.profile),
    occlusal: rightHemiarch(SYMBOL_CATEGORY.upper.occlusal),
  },
  lower: {
    profile: rightHemiarch(SYMBOL_CATEGORY.lower.profile),
    occlusal: rightHemiarch(SYMBOL_CATEGORY.lower.occlusal),
  },
};

function fdiList(arch: ArchId): readonly PerioFdi[] {
  return arch === 'upper' ? PERIO_UPPER_FDI : PERIO_LOWER_FDI;
}

export function toothFlipY(arch: ArchId): boolean {
  return arch === 'lower';
}

export function toothSymbolFor(arch: ArchId, row: ToothRowKind, index: number): ToothSymbolRef {
  if (!Number.isInteger(index) || index < 0 || index >= PERIO_COLUMN_COUNT) {
    throw new Error(`índice fuera de rango: ${index}`);
  }

  const hemi = RIGHT_HEMIARCH[arch][row];
  if (index < HEMIARCH_COUNT) {
    const id = hemi[index];
    if (!id) {
      throw new Error(`símbolo ausente en ${arch}/${row}[${index}]`);
    }
    return { id, mirrored: false };
  }

  const id = hemi[PERIO_COLUMN_COUNT - 1 - index];
  if (!id) {
    throw new Error(`símbolo ausente en ${arch}/${row}[${index}]`);
  }
  return { id, mirrored: true };
}

function hatchRangeFor(y: number, height: number, arch: ArchId): { y: number; height: number } {
  const rangeHeight = height / 2;
  return arch === 'upper' ? { y, height: rangeHeight } : { y: y + rangeHeight, height: rangeHeight };
}

function hatchYs(y: number, height: number, arch: ArchId): number[] {
  const range = hatchRangeFor(y, height, arch);
  return Array.from(
    { length: HATCH_LINE_COUNT },
    (_, i) => range.y + (range.height * (i + 1)) / (HATCH_LINE_COUNT + 1),
  );
}

function gridSubrows(
  y: number,
  height: number,
  count: number,
): Array<{ index: number; y: number; height: number }> {
  const rowHeight = height / count;
  return Array.from({ length: count }, (_, index) => ({
    index,
    y: y + index * rowHeight,
    height: rowHeight,
  }));
}

function makeBand(spec: BandSpec, y: number, height: number, fraction: number, arch: ArchId): ArchBand {
  if (spec.kind === 'grid') {
    return {
      kind: 'grid',
      id: spec.id,
      fraction,
      y,
      height,
      scale: spec.scale,
      subrows: gridSubrows(y, height, spec.subrowCount),
    };
  }

  if (spec.kind === 'facial' || spec.kind === 'lingual') {
    return {
      kind: spec.kind,
      id: spec.id,
      fraction,
      y,
      height,
      hatchRange: hatchRangeFor(y, height, arch),
      hatchYs: hatchYs(y, height, arch),
    };
  }

  return {
    kind: 'occlusal',
    id: 'occlusal',
    fraction,
    y,
    height,
  };
}

function buildBands(arch: ArchId, viewBoxH: number): ArchBand[] {
  const specs = arch === 'upper' ? UPPER_BAND_SPECS : LOWER_BAND_SPECS;
  let y = 0;

  return specs.map((spec, index) => {
    const isLast = index === specs.length - 1;
    const height = isLast ? viewBoxH - y : (spec.measured / MEASURED_TOTAL) * viewBoxH;
    const fraction = height / viewBoxH;
    const band = makeBand(spec, y, height, fraction, arch);
    y += height;
    return band;
  });
}

export function buildArchLayout(arch: ArchId): ArchLayout {
  const { w, h } = PERIO_VIEWBOX;
  const gutterWidth = w * PERIO_LATERAL_GUTTER;
  const contentWidth = w - 2 * gutterWidth;
  const columnWidth = contentWidth / PERIO_COLUMN_COUNT;
  const fdis = fdiList(arch);

  const columns: ArchColumn[] = fdis.map((fdi, index) => {
    const x = gutterWidth + index * columnWidth;
    return {
      index,
      fdi,
      x,
      width: columnWidth,
      cx: x + columnWidth / 2,
      profile: toothSymbolFor(arch, 'profile', index),
      occlusal: toothSymbolFor(arch, 'occlusal', index),
    };
  });

  return {
    arch,
    viewBox: { w, h },
    gutter: { left: gutterWidth, right: gutterWidth },
    content: { x: gutterWidth, width: contentWidth },
    columns,
    midlineX: w / 2,
    bands: buildBands(arch, h),
  };
}

export function buildOcclusionRows(): OcclusionBlock[] {
  const row = [...OCCLUSION_CELLS];
  return OCCLUSION_LABELS.map((label) => ({
    label,
    rows: [row, row],
  }));
}
