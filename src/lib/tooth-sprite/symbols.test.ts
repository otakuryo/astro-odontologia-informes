import { expect, test } from 'bun:test';
import { assignAtlas, extractPathD, type SpriteBox } from '../../../scripts/build-tooth-sprite';
import { TOOTH_SYMBOLS as GENERATED } from './symbols.generated';
import { TOOTH_SYMBOLS } from './symbols';

const PERMANENT_SVG = 'raw/pagina-periortograma/icons-003-permanent.svg';
const PERMANENT_JSON = 'raw/pagina-periortograma/icons-003-permanent-coordinates.json';
const PERMANENT_DISPOSICION = 'raw/pagina-periortograma/icons-003-disposicion.json';
const TEMPORAL_SVG = 'raw/pagina-periortograma/icons-003-temporal.svg';
const TEMPORAL_JSON = 'raw/pagina-periortograma/icons-003-temporal-coordinates.json';
const TEMPORAL_CATALOG = 'raw/pagina-periortograma/icons-003-temporal.json';
const ATLAS_W = 1774;
const ATLAS_H = 887;
const THIRD_MOLARS = ['18', '28', '38', '48'] as const;

type PermanentBox = SpriteBox & { fdi?: string; view?: string; source?: string };

type PermanentCoordinates = {
  elements: PermanentBox[];
};

type PermanentDisposicion = {
  denticion_permanente: {
    superior: { left_to_right: string[] };
    inferior: { left_to_right: string[] };
  };
};

type TemporalBox = SpriteBox & { fdi?: string; view?: string; source?: string; nombre?: string };

type TemporalCoordinates = {
  elements: TemporalBox[];
};

type TemporalCatalog = {
  denticion_temporal: {
    superior: { left_to_right: Array<{ posicion: number; fdI: string; nombre: string }> };
    inferior: { left_to_right: Array<{ posicion: number; fdI: string; nombre: string }> };
  };
};

function boxesOverlap(a: SpriteBox, b: SpriteBox): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function fdiFromSymbolId(id: string): string | undefined {
  return /^(?:permanent|temporal)_(\d{2})_(?:profile|occlusal)$/.exec(id)?.[1];
}

async function loadPermanentAtlas(): Promise<{
  boxes: PermanentBox[];
  clinical: string[];
  expectedIds: string[];
}> {
  const coords = (await Bun.file(PERMANENT_JSON).json()) as PermanentCoordinates;
  const disposicion = (await Bun.file(PERMANENT_DISPOSICION).json()) as PermanentDisposicion;
  const clinical = [
    ...disposicion.denticion_permanente.superior.left_to_right,
    ...disposicion.denticion_permanente.inferior.left_to_right,
  ];
  const expectedIds = clinical.flatMap((fdi) => [`permanent_${fdi}_profile`, `permanent_${fdi}_occlusal`]);
  return { boxes: coords.elements, clinical, expectedIds };
}

async function loadTemporalAtlas(): Promise<{
  boxes: TemporalBox[];
  clinical: string[];
  expectedIds: string[];
  catalog: TemporalCatalog;
}> {
  const coords = (await Bun.file(TEMPORAL_JSON).json()) as TemporalCoordinates;
  const catalog = (await Bun.file(TEMPORAL_CATALOG).json()) as TemporalCatalog;
  const clinical = [
    ...catalog.denticion_temporal.superior.left_to_right.map((tooth) => tooth.fdI),
    ...catalog.denticion_temporal.inferior.left_to_right.map((tooth) => tooth.fdI),
  ];
  const expectedIds = clinical.flatMap((fdi) => [`temporal_${fdi}_profile`, `temporal_${fdi}_occlusal`]);
  return { boxes: coords.elements, clinical, expectedIds, catalog };
}

test('TOOTH_SYMBOLS es fachada del generado: 104 símbolos no vacíos y 32+20 FDI', () => {
  expect(TOOTH_SYMBOLS).toBe(GENERATED);

  const ids = Object.keys(TOOTH_SYMBOLS);
  expect(ids).toHaveLength(104);
  expect(new Set(ids).size).toBe(104);

  const permanentIds = ids.filter((id) => id.startsWith('permanent_'));
  const temporalIds = ids.filter((id) => id.startsWith('temporal_'));
  expect(permanentIds).toHaveLength(64);
  expect(temporalIds).toHaveLength(40);

  const fdis = ids.map((id) => fdiFromSymbolId(id));
  expect(fdis.every((fdi) => fdi !== undefined)).toBe(true);
  expect(new Set(fdis).size).toBe(52);

  for (const id of ids) {
    const symbol = TOOTH_SYMBOLS[id];
    expect(symbol).toBeDefined();
    expect(symbol!.outline.length).toBeGreaterThan(0);
    expect(symbol!.solid.length).toBeGreaterThan(0);
    expect(symbol!.solid).toHaveLength(symbol!.outline.length);

    const nums = symbol!.viewBox.split(/\s+/).map(Number);
    expect(nums).toHaveLength(4);
    for (const value of nums) {
      expect(Number.isFinite(value)).toBe(true);
    }
  }

  expect(ids.some((id) => id.includes('_m3') || id.startsWith('upper_') || id.startsWith('lower_'))).toBe(false);
});

test('el sprite permanente incluye glifos propios de 18, 28, 38 y 48', () => {
  for (const fdi of THIRD_MOLARS) {
    for (const view of ['profile', 'occlusal'] as const) {
      const id = `permanent_${fdi}_${view}`;
      const symbol = TOOTH_SYMBOLS[id];
      expect(symbol).toBeDefined();
      expect(symbol!.outline.length).toBeGreaterThan(0);
      expect(symbol!.solid.length).toBeGreaterThan(0);
    }
  }

  expect(TOOTH_SYMBOLS.permanent_18_profile).not.toEqual(TOOTH_SYMBOLS.permanent_28_profile);
  expect(TOOTH_SYMBOLS.permanent_48_profile).not.toEqual(TOOTH_SYMBOLS.permanent_38_profile);
  expect(TOOTH_SYMBOLS.permanent_18_profile).not.toEqual(TOOTH_SYMBOLS.permanent_48_profile);
  expect(TOOTH_SYMBOLS.permanent_11_profile).not.toEqual(TOOTH_SYMBOLS.permanent_41_profile);
});

test('el atlas permanente canónico tiene 32 FDI exactos, dos símbolos por FDI y cero IDs duplicados', async () => {
  const { boxes, clinical } = await loadPermanentAtlas();
  const ids = boxes.map((box) => box.id);

  expect(clinical).toHaveLength(32);
  expect(new Set(clinical).size).toBe(32);
  expect(boxes).toHaveLength(64);
  expect(ids).toHaveLength(64);
  expect(new Set(ids).size).toBe(64);

  for (const fdi of clinical) {
    expect(ids.filter((id) => id === `permanent_${fdi}_profile`)).toHaveLength(1);
    expect(ids.filter((id) => id === `permanent_${fdi}_occlusal`)).toHaveLength(1);
  }

  const byId = new Map(boxes.map((box) => [box.id, box]));
  expect(byId.get('permanent_11_profile')?.source).toBe('11_duplicate');
  expect(byId.get('permanent_21_profile')?.source).toBe('21');
  expect(byId.get('permanent_22_profile')?.source).toBe('21_duplicate');
  expect(byId.get('permanent_26_profile')?.source).toBe('26');
  expect(byId.get('permanent_32_profile')?.source).toBe('32');
  expect(byId.get('permanent_41_profile')?.source).toBe('41_duplicate');
});

test('el atlas permanente canónico sigue la secuencia clínica de icons-003-disposicion.json', async () => {
  const { boxes, expectedIds } = await loadPermanentAtlas();
  expect(boxes.map((box) => box.id)).toEqual(expectedIds);
  expect(Object.keys(TOOTH_SYMBOLS).filter((id) => id.startsWith('permanent_'))).toEqual(expectedIds);
});

test('las cajas permanentes caben en 1774×887, no se solapan y no están vacías', async () => {
  const { boxes } = await loadPermanentAtlas();
  const svg = await Bun.file(PERMANENT_SVG).text();
  const assignment = assignAtlas(extractPathD(svg), boxes, 0, false);

  expect(assignment.empty).toEqual([]);
  expect(assignment.ambiguous).toBe(0);
  expect(assignment.omitted).toBe(0);
  expect(Object.keys(assignment.symbols)).toHaveLength(64);

  for (const box of boxes) {
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(ATLAS_W);
    expect(box.y + box.height).toBeLessThanOrEqual(ATLAS_H);
    expect(box.rect).toEqual([box.x, box.y, box.width, box.height]);

    const generated = TOOTH_SYMBOLS[box.id];
    expect(generated?.outline).toEqual(assignment.symbols[box.id]?.outline);
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(boxesOverlap(boxes[i]!, boxes[j]!)).toBe(false);
    }
  }
});

test('el atlas temporal tiene 20 FDI, ambos views, nombres y orden de icons-003-temporal.json', async () => {
  const { boxes, clinical, expectedIds, catalog } = await loadTemporalAtlas();
  const ids = boxes.map((box) => box.id);

  expect(clinical).toHaveLength(20);
  expect(new Set(clinical).size).toBe(20);
  expect(boxes).toHaveLength(40);
  expect(ids).toHaveLength(40);
  expect(new Set(ids).size).toBe(40);
  expect(ids).toEqual(expectedIds);
  expect(Object.keys(TOOTH_SYMBOLS).filter((id) => id.startsWith('temporal_'))).toEqual(expectedIds);

  for (const tooth of [
    ...catalog.denticion_temporal.superior.left_to_right,
    ...catalog.denticion_temporal.inferior.left_to_right,
  ]) {
    expect(ids.filter((id) => id === `temporal_${tooth.fdI}_profile`)).toHaveLength(1);
    expect(ids.filter((id) => id === `temporal_${tooth.fdI}_occlusal`)).toHaveLength(1);
    expect(fdiFromSymbolId(`temporal_${tooth.fdI}_profile`)).toBe(tooth.fdI);
    expect(fdiFromSymbolId(`temporal_${tooth.fdI}_occlusal`)).toBe(tooth.fdI);
    expect(boxes.find((box) => box.id === `temporal_${tooth.fdI}_profile`)?.nombre).toBe(tooth.nombre);
    expect(boxes.find((box) => box.id === `temporal_${tooth.fdI}_occlusal`)?.nombre).toBe(tooth.nombre);
  }

  const byId = new Map(boxes.map((box) => [box.id, box]));
  expect(byId.get('temporal_85_profile')?.source).toBe('75');
  expect(byId.get('temporal_81_profile')?.source).toBe('71');
  expect(byId.get('temporal_71_profile')?.source).toBe('81');
  expect(byId.get('temporal_75_profile')?.source).toBe('85');
});

test('las cajas temporales caben en 1774×887, no se solapan y no están vacías', async () => {
  const { boxes } = await loadTemporalAtlas();
  const svg = await Bun.file(TEMPORAL_SVG).text();
  const assignment = assignAtlas(extractPathD(svg), boxes, 0, false);

  expect(assignment.empty).toEqual([]);
  expect(assignment.ambiguous).toBe(0);
  expect(assignment.omitted).toBe(0);
  expect(Object.keys(assignment.symbols)).toHaveLength(40);

  for (const box of boxes) {
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(ATLAS_W);
    expect(box.y + box.height).toBeLessThanOrEqual(ATLAS_H);
    expect(box.rect).toEqual([box.x, box.y, box.width, box.height]);

    const generated = TOOTH_SYMBOLS[box.id];
    expect(generated?.outline).toEqual(assignment.symbols[box.id]?.outline);
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(boxesOverlap(boxes[i]!, boxes[j]!)).toBe(false);
    }
  }
});
