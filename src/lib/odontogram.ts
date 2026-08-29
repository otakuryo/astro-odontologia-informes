export const OUTER_R = 20;
export const TOOTH_INNER_R = 8.6;
export const INNER_R = TOOTH_INNER_R;
export const TOOTH_STEP = 45;
export const MIDLINE_STEP = 55.6;
export const ROW_GAP_ARCH = 80;
export const ROW_GAP_OCCLUSAL = 56.6;
export const LABEL_OFFSET = 29;
export const PAD = 10;

const GLYPH_RAY_DEG = [45, 135, 225, 315] as const;

export type LabelSide = 'above' | 'below';

export type ToothLayout = {
  fdi: string;
  cx: number;
  cy: number;
  labelX: number;
  labelY: number;
  labelSide: LabelSide;
};

export type OdontogramLayout = {
  viewBox: { w: number; h: number };
  teeth: ToothLayout[];
};

export type ToothGlyph = {
  outer: { cx: number; cy: number; r: number };
  inner: { cx: number; cy: number; r: number };
  rays: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};

function columnCx(archSide: 'left' | 'right', n: number): number {
  const cx11 = PAD + OUTER_R + 7 * TOOTH_STEP;
  const cx21 = cx11 + MIDLINE_STEP;

  if (archSide === 'left') {
    return cx11 - (n - 1) * TOOTH_STEP;
  }

  return cx21 + (n - 1) * TOOTH_STEP;
}

function layoutTooth(
  quadrant: number,
  n: number,
  archSide: 'left' | 'right',
  cy: number,
  labelSide: LabelSide,
): ToothLayout {
  const cx = columnCx(archSide, n);

  return {
    fdi: `${quadrant}.${n}`,
    cx,
    cy,
    labelX: cx,
    labelY: labelSide === 'above' ? cy - LABEL_OFFSET : cy + LABEL_OFFSET,
    labelSide,
  };
}

function rowTeeth(
  leftQuadrant: number,
  rightQuadrant: number,
  maxN: number,
  cy: number,
  labelSide: LabelSide,
): ToothLayout[] {
  const teeth: ToothLayout[] = [];

  for (let n = maxN; n >= 1; n--) {
    teeth.push(layoutTooth(leftQuadrant, n, 'left', cy, labelSide));
  }

  for (let n = 1; n <= maxN; n++) {
    teeth.push(layoutTooth(rightQuadrant, n, 'right', cy, labelSide));
  }

  return teeth;
}

export function buildOdontogramLayout(): OdontogramLayout {
  const labelClearance = Math.max(OUTER_R, LABEL_OFFSET);
  const cyPermSup = PAD + labelClearance;
  const cyTempSup = cyPermSup + ROW_GAP_ARCH;
  const cyTempInf = cyTempSup + ROW_GAP_OCCLUSAL;
  const cyPermInf = cyTempInf + ROW_GAP_ARCH;

  const teeth = [
    ...rowTeeth(1, 2, 8, cyPermSup, 'above'),
    ...rowTeeth(5, 6, 5, cyTempSup, 'above'),
    ...rowTeeth(8, 7, 5, cyTempInf, 'below'),
    ...rowTeeth(4, 3, 8, cyPermInf, 'below'),
  ];

  return {
    viewBox: {
      w: PAD + OUTER_R + 7 * TOOTH_STEP + MIDLINE_STEP + 7 * TOOTH_STEP + OUTER_R + PAD,
      h: PAD + labelClearance + ROW_GAP_ARCH + ROW_GAP_OCCLUSAL + ROW_GAP_ARCH + labelClearance + PAD,
    },
    teeth,
  };
}

export function toothGlyph(cx: number, cy: number): ToothGlyph {
  return {
    outer: { cx, cy, r: OUTER_R },
    inner: { cx, cy, r: INNER_R },
    rays: GLYPH_RAY_DEG.map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      return {
        x1: cx + INNER_R * cos,
        y1: cy + INNER_R * sin,
        x2: cx + OUTER_R * cos,
        y2: cy + OUTER_R * sin,
      };
    }),
  };
}
