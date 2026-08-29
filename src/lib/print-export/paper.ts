import {
  isOrientationId,
  type DesignSizeId,
  type OrientationId,
  type PaperSizeId,
  type PrintLayoutId,
  type SizeMm,
} from './types';

/** 1 pt = 1/72 in; mm × 72 / 25,4. */
export const MM_TO_PT = 72 / 25.4;

const DESIGN_MM: Record<DesignSizeId, SizeMm> = {
  letter: { width: 215.9, height: 279.4 },
  a5: { width: 148, height: 210 },
  a6: { width: 105, height: 148 },
};

const PAPER_MM: Record<PaperSizeId, SizeMm> = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  a6: { width: 105, height: 148 },
};

const ISO_NESTING: ReadonlyArray<readonly [DesignSizeId, PaperSizeId]> = [
  ['a5', 'a4'],
  ['a6', 'a5'],
];

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

export function designDimensionsMm(design: DesignSizeId): SizeMm {
  const size = DESIGN_MM[design];
  return { width: size.width, height: size.height };
}

export function paperDimensionsMm(paper: PaperSizeId, orientation: OrientationId = 'portrait'): SizeMm {
  const size = PAPER_MM[paper];
  if (orientation === 'landscape') {
    return { width: size.height, height: size.width };
  }
  return { width: size.width, height: size.height };
}

/**
 * Anidación ISO a 100 % de un escalón: el menor es la mitad del mayor.
 * Solo (a5, a4) y (a6, a5). Carta×A4 y A6×A4 (4-up) no están disponibles.
 */
export function nestingFactor(design: DesignSizeId, paper: PaperSizeId): 2 | null {
  for (const [nested, parent] of ISO_NESTING) {
    if (design === nested && paper === parent) {
      return 2;
    }
  }
  return null;
}

/**
 * Layouts exportables sin escalar.
 * - Mismo tamaño: solo 1up.
 * - Factor 2: duplicate y booklet (nunca 1up centrado).
 * - Cualquier otro cruce: vacío; hay que alinear el papel al diseño.
 */
export function availableLayouts(design: DesignSizeId, paper: PaperSizeId): PrintLayoutId[] {
  if (design === paper) {
    return ['1up'];
  }
  if (nestingFactor(design, paper) === 2) {
    return ['duplicate', 'booklet'];
  }
  return [];
}

export function resolveOrientation(
  layout: PrintLayoutId,
  preferred: OrientationId | string | undefined = 'portrait',
): OrientationId {
  if (layout === 'duplicate' || layout === 'booklet') {
    return 'landscape';
  }
  return isOrientationId(preferred) ? preferred : 'portrait';
}
