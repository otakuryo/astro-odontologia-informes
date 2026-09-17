/**
 * Motor PDF en el cliente: captura → imposición → pdf-lib → Blob + descarga.
 */
import type { PDFImage, PDFPage } from 'pdf-lib';
import { exportFileName, FORMATS, getFormat } from '../lib/print-export/formats';
import {
  buildCapturePlan,
  captureJobKey,
  gutterSideForBookletSlot,
  gutterSideForPage,
  normalizeGutterMm,
  type CaptureJob,
} from '../lib/print-export/gutter';
import { imposeBooklet, imposeDuplicate, type ImposedSheet, type PageSlot } from '../lib/print-export/impose';
import { designDimensionsMm, mmToPt, paperDimensionsMm } from '../lib/print-export/paper';
import { normalizeExportSettings } from '../lib/print-export/settings';
import {
  isDesignSizeId,
  isFormatId,
  type DesignSizeId,
  type ExportSettings,
  type FormatId,
  type GutterSideId,
} from '../lib/print-export/types';
import { captureFormatByUrl, captureSheet, yieldForPaint, type CaptureSheetOptions } from './capture-sheet';
import { bindExportPanel, currentExportDraft, showExportError } from './export-panel';
import { downloadConfiguredPngZip } from './export-png';
import { applyGutter, beginTransientGutter, endTransientGutter, getGutterFromDocument } from './gutter';

export type { CaptureSheetOptions };
export type { CaptureJob };

export type PrintExportCaptures = Map<string, Uint8Array> | readonly Uint8Array[];

export type PrintExportHook = {
  captureSheet: (el: HTMLElement, options?: CaptureSheetOptions) => Promise<Uint8Array>;
  captureFormatByUrl: (
    url: string,
    design: DesignSizeId,
    options?: CaptureSheetOptions,
    gutter?: { mm: number; side: GutterSideId },
  ) => Promise<Uint8Array>;
  composePdf: (settings: ExportSettings, captures: PrintExportCaptures) => Promise<Uint8Array>;
  exportPrintPdf: (settings: ExportSettings, currentSheet?: HTMLElement | null) => Promise<Uint8Array>;
  downloadCurrentFormatPdf: () => Promise<Uint8Array>;
  downloadConfiguredPngZip: () => Promise<Uint8Array>;
  imposeDuplicate: (pageCount: number) => ImposedSheet[];
  imposeBooklet: (pageCount: number) => ImposedSheet[];
  buildCapturePlan: (settings: ExportSettings) => CaptureJob[];
};

declare global {
  interface Window {
    __odoPrintExport?: PrintExportHook;
  }
}

function asPngBytes(input: Uint8Array | ArrayLike<number>): Uint8Array {
  return input instanceof Uint8Array ? input : Uint8Array.from(input);
}

function toArrayBuffer(bytes: Uint8Array | ArrayLike<number>): ArrayBuffer {
  const source = asPngBytes(bytes);
  const copy = new ArrayBuffer(source.byteLength);
  new Uint8Array(copy).set(source);
  return copy;
}

async function rotatePng90Clockwise(bytes: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([toArrayBuffer(bytes)], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.height;
    canvas.height = bitmap.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo rotar la captura (canvas).');
    }
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(bitmap, 0, 0);
    const rotated = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('No se pudo rotar la captura.'));
        }
      }, 'image/png');
    });
    return new Uint8Array(await rotated.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

function fillPage(
  page: PDFPage,
  width: number,
  height: number,
  color: NonNullable<NonNullable<Parameters<PDFPage['drawRectangle']>[0]>['color']>,
): void {
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color,
  });
}

function drawSlot(
  page: PDFPage,
  slot: PageSlot,
  image: PDFImage | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (slot.kind === 'blank' || !image) {
    return;
  }
  page.drawImage(image, { x, y, width, height });
}

/**
 * Captura cada job del plan (por defecto `buildCapturePlan`).
 * Hoja viva del formato actual con lomo temporal; iframe para el resto.
 */
export async function captureFormats(
  settings: ExportSettings,
  currentSheet: HTMLElement | null | undefined,
  currentFormat: FormatId,
  options?: CaptureSheetOptions,
  plan?: CaptureJob[],
): Promise<Map<string, Uint8Array>> {
  const liveSheet = currentSheet ?? document.querySelector<HTMLElement>('.sheet');
  const jobs = plan ?? buildCapturePlan(settings);
  const captures = new Map<string, Uint8Array>();

  for (const job of jobs) {
    if (!isFormatId(job.format)) {
      continue;
    }
    const key = captureJobKey(job);
    if (captures.has(key)) {
      continue;
    }

    const gutter = job.gutterMm > 0 ? { mm: job.gutterMm, side: job.gutterSide } : undefined;

    if (job.format === currentFormat && liveSheet) {
      captures.set(key, await withLiveGutter(job, () => captureSheet(liveSheet, options)));
    } else {
      const definition = getFormat(job.format);
      captures.set(key, await captureFormatByUrl(definition.path, settings.design, options, gutter));
    }
    await yieldForPaint();
  }
  return captures;
}

async function withLiveGutter<T>(job: CaptureJob, fn: () => Promise<T>): Promise<T> {
  beginTransientGutter();
  const previous = getGutterFromDocument();
  try {
    applyGutter(job.gutterMm, job.gutterSide, { persist: false, updateUrl: false });
    await yieldForPaint();
    return await fn();
  } finally {
    try {
      applyGutter(previous.mm, previous.side, { persist: false, updateUrl: false });
    } finally {
      endTransientGutter();
    }
  }
}

function asCaptureMap(settings: ExportSettings, captures: PrintExportCaptures): Map<string, Uint8Array> {
  if (captures instanceof Map) {
    return captures;
  }

  const map = new Map<string, Uint8Array>();
  const plan = buildCapturePlan(settings);

  if (plan.length === captures.length) {
    for (let index = 0; index < plan.length; index++) {
      const job = plan[index];
      const bytes = captures[index];
      if (job && bytes) {
        map.set(captureJobKey(job), asPngBytes(bytes));
      }
    }
    return map;
  }

  const gutterMm = normalizeGutterMm(settings.gutterMm);
  for (let index = 0; index < settings.formats.length; index++) {
    const format = settings.formats[index];
    const bytes = captures[index];
    if (!format || !bytes) {
      continue;
    }
    const side = gutterMm === 0 ? 'left' : gutterSideForPage(settings.layout, index, settings.gutterSide);
    map.set(captureJobKey({ format, gutterMm, gutterSide: side }), asPngBytes(bytes));
  }
  return map;
}

function jobKeyFor(format: FormatId, gutterMm: number, side: GutterSideId): string {
  const mm = normalizeGutterMm(gutterMm);
  return captureJobKey({
    format,
    gutterMm: mm,
    gutterSide: mm === 0 ? 'left' : side,
  });
}

/** Compone un PDF ya impuesto. No descarga. Slots `blank`: no se dibujan. */
export async function composePdf(
  settings: ExportSettings,
  captures: PrintExportCaptures,
): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import('pdf-lib');
  const currentFormat = settings.formats[0] ?? 'expedientes';
  const normalized = normalizeExportSettings(settings, currentFormat);
  const captureMap = asCaptureMap(normalized, captures);

  if (captureMap.size === 0) {
    throw new Error('No hay capturas para componer el PDF.');
  }

  const pdf = await PDFDocument.create();
  const fileName = exportFileName(normalized);
  pdf.setTitle(fileName.replace(/\.pdf$/i, ''));
  pdf.setLanguage('es-ES');

  const paperMm = paperDimensionsMm(normalized.paper, normalized.orientation);
  const pageWidth = mmToPt(paperMm.width);
  const pageHeight = mmToPt(paperMm.height);
  const pageSize: [number, number] = [pageWidth, pageHeight];
  const rotateLandscape = normalized.layout === '1up' && normalized.orientation === 'landscape';
  const imageCache = new Map<string, PDFImage>();

  const embed = async (format: FormatId, side: GutterSideId): Promise<PDFImage> => {
    const key = jobKeyFor(format, normalized.gutterMm, side);
    const cached = imageCache.get(key);
    if (cached) {
      return cached;
    }
    const bytes = captureMap.get(key);
    if (!bytes) {
      throw new Error(`Falta la captura ${key} para componer el PDF.`);
    }
    let png = asPngBytes(bytes);
    if (rotateLandscape) {
      png = await rotatePng90Clockwise(png);
    }
    const image = await pdf.embedPng(png);
    imageCache.set(key, image);
    return image;
  };

  if (normalized.layout === '1up') {
    for (let index = 0; index < normalized.formats.length; index++) {
      const format = normalized.formats[index];
      if (!format) {
        continue;
      }
      const side = gutterSideForPage(normalized.layout, index, normalized.gutterSide);
      const image = await embed(format, side);
      const page = pdf.addPage(pageSize);
      fillPage(page, pageWidth, pageHeight, rgb(1, 1, 1));
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    }
    return pdf.save();
  }

  const sheets =
    normalized.layout === 'booklet'
      ? imposeBooklet(normalized.formats.length)
      : imposeDuplicate(normalized.formats.length);

  const designMm = designDimensionsMm(normalized.design);
  const outerMm = (paperMm.width - designMm.width * 2) / 2;
  const yMm = (paperMm.height - designMm.height) / 2;
  const slotWidth = mmToPt(designMm.width);
  const slotHeight = mmToPt(designMm.height);
  const leftX = mmToPt(outerMm);
  const rightX = mmToPt(outerMm + designMm.width);
  const slotY = mmToPt(yMm);

  const slotImage = async (slot: PageSlot, position: 'left' | 'right'): Promise<PDFImage | undefined> => {
    if (slot.kind === 'blank') {
      return undefined;
    }
    const format = normalized.formats[slot.index];
    if (!format) {
      return undefined;
    }
    const side =
      normalized.layout === 'booklet'
        ? gutterSideForBookletSlot(position)
        : normalized.gutterSide;
    return embed(format, side);
  };

  for (const sheet of sheets) {
    const page = pdf.addPage(pageSize);
    fillPage(page, pageWidth, pageHeight, rgb(1, 1, 1));
    drawSlot(page, sheet.left, await slotImage(sheet.left, 'left'), leftX, slotY, slotWidth, slotHeight);
    drawSlot(page, sheet.right, await slotImage(sheet.right, 'right'), rightX, slotY, slotWidth, slotHeight);
  }

  return pdf.save();
}

export function formatIdFromPathname(pathname: string): FormatId | null {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  for (const format of FORMATS) {
    if (normalized === format.path || normalized.startsWith(format.path)) {
      return format.id;
    }
  }
  return null;
}

export function currentFormatId(): FormatId {
  return formatIdFromPathname(window.location.pathname) ?? 'expedientes';
}

export function currentDesignId(): DesignSizeId {
  const raw = document.documentElement.getAttribute('data-paper-size');
  return isDesignSizeId(raw) ? raw : 'letter';
}

function triggerDownload(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 2_000);
}

/**
 * Captura formatos, impone, escribe el PDF y dispara `<a download>`.
 */
export async function exportPrintPdf(
  settings: ExportSettings,
  currentSheet?: HTMLElement | null,
): Promise<Uint8Array> {
  const currentFormat = formatIdFromPathname(window.location.pathname) ?? settings.formats[0] ?? 'expedientes';
  const normalized = normalizeExportSettings(settings, currentFormat);

  try {
    const plan = buildCapturePlan(normalized);
    const captures = await captureFormats(normalized, currentSheet, currentFormat, undefined, plan);
    const bytes = await composePdf(normalized, captures);
    triggerDownload(bytes, exportFileName(normalized));
    return bytes;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!showExportError(detail)) {
      window.alert(detail);
    }
    throw error;
  }
}

/** 1-up vertical del formato y diseño actuales (papel = diseño). */
export async function downloadCurrentFormatPdf(): Promise<Uint8Array> {
  const draftSettings = currentExportDraft();
  const design = currentDesignId();
  const formatId = currentFormatId();
  return exportPrintPdf(
    {
      design,
      paper: design,
      layout: '1up',
      orientation: 'portrait',
      formats: [formatId],
      gutterMm: draftSettings.gutterMm,
      gutterSide: draftSettings.gutterSide,
    },
    document.querySelector<HTMLElement>('.sheet'),
  );
}

/** Descarga con los ajustes del panel (borrador normalizado). No fuerza 1-up. */
export async function downloadConfiguredPdf(): Promise<Uint8Array> {
  return exportPrintPdf(currentExportDraft(), document.querySelector<HTMLElement>('.sheet'));
}

export function installPrintExportHook(): void {
  window.__odoPrintExport = {
    captureSheet,
    captureFormatByUrl,
    composePdf,
    exportPrintPdf,
    downloadCurrentFormatPdf,
    downloadConfiguredPngZip,
    imposeDuplicate,
    imposeBooklet,
    buildCapturePlan,
  };
}

export function bindPdfExport(): void {
  installPrintExportHook();
  bindExportPanel({ downloadPdf: downloadConfiguredPdf, downloadPngZip: downloadConfiguredPngZip });
}
