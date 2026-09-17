import { imposeBooklet } from './impose';
import {
  GUTTER_MAX_MM,
  GUTTER_MIN_MM,
  isGutterSideId,
  type ExportSettings,
  type FormatId,
  type GutterSideId,
  type PrintLayoutId,
} from './types';

export type CaptureJob = {
  format: FormatId;
  gutterMm: number;
  gutterSide: GutterSideId;
};

const GUTTER_SIDE_ALIASES: Record<string, GutterSideId> = {
  left: 'left',
  right: 'right',
  izquierda: 'left',
  derecha: 'right',
};

const LOMO_QUERY: Record<GutterSideId, string> = {
  left: 'izquierda',
  right: 'derecha',
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value.trim());
  }
  return null;
}

/** Entero en [10, 15] o 0 (desactivado). */
export function normalizeGutterMm(value: unknown): number {
  const parsed = asFiniteNumber(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  const rounded = Math.round(parsed);
  if (rounded === 0) {
    return 0;
  }

  return Math.min(GUTTER_MAX_MM, Math.max(GUTTER_MIN_MM, rounded));
}

export function normalizeGutterSide(value: unknown): GutterSideId {
  if (typeof value !== 'string') {
    return 'left';
  }

  return GUTTER_SIDE_ALIASES[value.trim().toLowerCase()] ?? 'left';
}

export function oppositeSide(side: GutterSideId): GutterSideId {
  return side === 'left' ? 'right' : 'left';
}

/**
 * 1-up dúplex: índice par (pág. 1-indexada impar) lleva el lado configurado.
 * Duplicate: siempre el configurado.
 */
export function gutterSideForPage(
  layout: PrintLayoutId,
  pageIndex0: number,
  configured: GutterSideId,
): GutterSideId {
  const side = isGutterSideId(configured) ? configured : 'left';
  if (layout === '1up' && pageIndex0 % 2 !== 0) {
    return oppositeSide(side);
  }
  return side;
}

/** El lomo mira al pliegue: slot izquierdo → lomo derecho. */
export function gutterSideForBookletSlot(position: 'left' | 'right'): GutterSideId {
  return position === 'left' ? 'right' : 'left';
}

export function captureJobKey(job: CaptureJob): string {
  return `${job.format}:${job.gutterMm}:${job.gutterSide}`;
}

export function buildCapturePlan(settings: ExportSettings): CaptureJob[] {
  const gutterMm = normalizeGutterMm(settings.gutterMm);
  const configured = normalizeGutterSide(settings.gutterSide);
  const formats = settings.formats;
  const jobs: CaptureJob[] = [];
  const seen = new Set<string>();

  const push = (format: FormatId, side: GutterSideId) => {
    const job: CaptureJob = {
      format,
      gutterMm,
      gutterSide: gutterMm === 0 ? 'left' : side,
    };
    const key = captureJobKey(job);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    jobs.push(job);
  };

  if (settings.layout === 'booklet') {
    const pairs: Array<{ index: number; side: GutterSideId }> = [];

    for (const sheet of imposeBooklet(formats.length)) {
      for (const position of ['left', 'right'] as const) {
        const slot = sheet[position];
        if (slot.kind === 'blank') {
          continue;
        }
        pairs.push({ index: slot.index, side: gutterSideForBookletSlot(position) });
      }
    }

    pairs.sort((a, b) => a.index - b.index);

    for (const pair of pairs) {
      const format = formats[pair.index];
      if (!format) {
        continue;
      }
      push(format, pair.side);
    }

    return jobs;
  }

  for (let index = 0; index < formats.length; index++) {
    const format = formats[index];
    if (!format) {
      continue;
    }
    push(format, gutterSideForPage(settings.layout, index, configured));
  }

  return jobs;
}

export function gutterQuery(
  mm: number,
  side: GutterSideId,
): { anillado?: string; lomo?: string } {
  const gutterMm = normalizeGutterMm(mm);
  if (gutterMm <= 0) {
    return {};
  }

  const gutterSide = normalizeGutterSide(side);
  return {
    anillado: String(gutterMm),
    lomo: LOMO_QUERY[gutterSide],
  };
}

export function parseGutterQuery(params: URLSearchParams): {
  gutterMm: number;
  gutterSide: GutterSideId;
} {
  return {
    gutterMm: normalizeGutterMm(params.get('anillado')),
    gutterSide: normalizeGutterSide(params.get('lomo')),
  };
}
