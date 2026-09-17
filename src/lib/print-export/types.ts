/** Tamaño del diseño clínico (`.sheet`). No existe diseño A4. */
export type DesignSizeId = 'letter' | 'a5' | 'a6';

/** Tamaño de cada página del PDF de salida. */
export type PaperSizeId = 'letter' | 'a4' | 'a5' | 'a6';

/** Disposición sobre el papel. No hay dos-up secuencial. */
export type PrintLayoutId = '1up' | 'duplicate' | 'booklet';

/** Orientación del papel de salida. El diseño clínico permanece vertical. */
export type OrientationId = 'portrait' | 'landscape';

export type FormatId = 'expedientes' | 'paciente-rx-tx' | 'eventos' | 'paciente-imagen';

/** Lado del margen de anillado (lomo). */
export type GutterSideId = 'left' | 'right';

export type SizeMm = {
  width: number;
  height: number;
};

export type ExportSettings = {
  design: DesignSizeId;
  paper: PaperSizeId;
  layout: PrintLayoutId;
  orientation: OrientationId;
  formats: FormatId[];
  gutterMm: number;
  gutterSide: GutterSideId;
};

export const DESIGN_SIZE_IDS = ['letter', 'a5', 'a6'] as const;
export const PAPER_SIZE_IDS = ['letter', 'a4', 'a5', 'a6'] as const;
export const PRINT_LAYOUT_IDS = ['1up', 'duplicate', 'booklet'] as const;
export const ORIENTATION_IDS = ['portrait', 'landscape'] as const;
export const FORMAT_IDS = ['expedientes', 'paciente-rx-tx', 'eventos', 'paciente-imagen'] as const;
export const GUTTER_SIDE_IDS = ['left', 'right'] as const;
export const GUTTER_MIN_MM = 10;
export const GUTTER_MAX_MM = 15;
export const GUTTER_DEFAULT_MM = 12;

export function isDesignSizeId(value: unknown): value is DesignSizeId {
  return typeof value === 'string' && (DESIGN_SIZE_IDS as readonly string[]).includes(value);
}

export function isPaperSizeId(value: unknown): value is PaperSizeId {
  return typeof value === 'string' && (PAPER_SIZE_IDS as readonly string[]).includes(value);
}

export function isPrintLayoutId(value: unknown): value is PrintLayoutId {
  return typeof value === 'string' && (PRINT_LAYOUT_IDS as readonly string[]).includes(value);
}

export function isOrientationId(value: unknown): value is OrientationId {
  return typeof value === 'string' && (ORIENTATION_IDS as readonly string[]).includes(value);
}

export function isFormatId(value: unknown): value is FormatId {
  return typeof value === 'string' && (FORMAT_IDS as readonly string[]).includes(value);
}

export function isGutterSideId(value: unknown): value is GutterSideId {
  return typeof value === 'string' && (GUTTER_SIDE_IDS as readonly string[]).includes(value);
}
