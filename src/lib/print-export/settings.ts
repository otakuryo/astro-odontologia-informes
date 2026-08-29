import { selectKnownFormats } from './formats';
import { availableLayouts, resolveOrientation } from './paper';
import {
  isFormatId,
  isOrientationId,
  isPrintLayoutId,
  type DesignSizeId,
  type ExportSettings,
  type FormatId,
  type OrientationId,
  type PaperSizeId,
  type PrintLayoutId,
} from './types';

export const PRINT_EXPORT_STORAGE_KEY = 'odo-print-export';
export const PAPER_SIZE_STORAGE_KEY = 'odo-paper-size';

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

let memorySnapshot: ExportSettings | null = null;

function coerceDesign(value: unknown): DesignSizeId | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'carta' || normalized === 'letter') {
    return 'letter';
  }
  if (normalized === 'a5' || normalized === 'a6') {
    return normalized;
  }
  return null;
}

function coercePaper(value: unknown): PaperSizeId | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'carta' || normalized === 'letter') {
    return 'letter';
  }
  if (normalized === 'a4' || normalized === 'a5' || normalized === 'a6') {
    return normalized;
  }
  return null;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function pickLayout(
  design: DesignSizeId,
  paper: PaperSizeId,
  requested: unknown,
): { paper: PaperSizeId; layout: PrintLayoutId } {
  const layouts = availableLayouts(design, paper);
  const wanted = isPrintLayoutId(requested) ? requested : null;

  if (wanted && layouts.includes(wanted)) {
    return { paper, layout: wanted };
  }
  if (layouts.includes('1up')) {
    return { paper, layout: '1up' };
  }
  if (layouts[0]) {
    return { paper, layout: layouts[0] };
  }
  return { paper: design, layout: '1up' };
}

export function normalizeExportSettings(input: unknown, currentFormat: FormatId): ExportSettings {
  const record = asRecord(input);
  const fallbackFormat = isFormatId(currentFormat) ? currentFormat : 'expedientes';
  const design = coerceDesign(record.design) ?? 'letter';
  const paper = coercePaper(record.paper) ?? design;
  const resolved = pickLayout(design, paper, record.layout);
  const preferredOrientation: OrientationId | undefined = isOrientationId(record.orientation)
    ? record.orientation
    : undefined;

  return {
    design,
    paper: resolved.paper,
    layout: resolved.layout,
    orientation: resolveOrientation(resolved.layout, preferredOrientation),
    formats: selectKnownFormats(record.formats, fallbackFormat),
  };
}

function defaultStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) {
    return storage;
  }
  return defaultStorage();
}

export function readExportSettings(currentFormat: FormatId, storage?: StorageLike | null): ExportSettings {
  const store = resolveStorage(storage);

  if (store) {
    try {
      const raw = store.getItem(PRINT_EXPORT_STORAGE_KEY);
      if (raw) {
        return normalizeExportSettings(JSON.parse(raw), currentFormat);
      }
      const design = store.getItem(PAPER_SIZE_STORAGE_KEY);
      if (design) {
        return normalizeExportSettings({ design }, currentFormat);
      }
    } catch {
      /* almacenamiento privado o JSON inválido */
    }
  }

  if (memorySnapshot) {
    return normalizeExportSettings(memorySnapshot, currentFormat);
  }

  return normalizeExportSettings(undefined, currentFormat);
}

export function writeExportSettings(settings: ExportSettings, storage?: StorageLike | null): void {
  const fallbackFormat = settings.formats[0] ?? 'expedientes';
  const normalized = normalizeExportSettings(settings, fallbackFormat);
  memorySnapshot = normalized;

  const store = resolveStorage(storage);
  if (!store) {
    return;
  }

  try {
    store.setItem(PRINT_EXPORT_STORAGE_KEY, JSON.stringify(normalized));
    store.setItem(PAPER_SIZE_STORAGE_KEY, normalized.design);
  } catch {
    /* modo privado o almacenamiento bloqueado: queda el valor en memoria */
  }
}
