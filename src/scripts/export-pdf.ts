/**
 * Motor PDF en el cliente: captura → imposición → pdf-lib → Blob + descarga.
 */
import { PDFDocument, rgb, type PDFImage, type PDFPage } from 'pdf-lib';
import { exportFileName, FORMATS, getFormat } from '../lib/print-export/formats';
import { imposeBooklet, imposeDuplicate, type ImposedSheet, type PageSlot } from '../lib/print-export/impose';
import { designDimensionsMm, mmToPt, paperDimensionsMm } from '../lib/print-export/paper';
import { normalizeExportSettings, readExportSettings } from '../lib/print-export/settings';
import {
  isDesignSizeId,
  isFormatId,
  type DesignSizeId,
  type ExportSettings,
  type FormatId,
} from '../lib/print-export/types';
import { captureFormatByUrl, captureSheet } from './capture-sheet';
import { bindExportPanel, showExportError } from './export-panel';

export type PrintExportHook = {
  captureSheet: (el: HTMLElement) => Promise<Uint8Array>;
  captureFormatByUrl: (url: string, design: DesignSizeId) => Promise<Uint8Array>;
  composePdf: (settings: ExportSettings, captures: readonly Uint8Array[]) => Promise<Uint8Array>;
  exportPrintPdf: (settings: ExportSettings, currentSheet?: HTMLElement | null) => Promise<Uint8Array>;
  downloadCurrentFormatPdf: () => Promise<Uint8Array>;
  imposeDuplicate: (pageCount: number) => ImposedSheet[];
  imposeBooklet: (pageCount: number) => ImposedSheet[];
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

function fillPage(page: PDFPage, width: number, height: number): void {
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(1, 1, 1),
  });
}

function drawSlot(
  page: PDFPage,
  slot: PageSlot,
  images: readonly PDFImage[],
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (slot.kind === 'blank') {
    return;
  }
  const image = images[slot.index];
  if (!image) {
    return;
  }
  page.drawImage(image, { x, y, width, height });
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

async function captureFormats(
  settings: ExportSettings,
  currentSheet: HTMLElement | null | undefined,
  currentFormat: FormatId,
): Promise<Uint8Array[]> {
  const liveSheet = currentSheet ?? document.querySelector<HTMLElement>('.sheet');

  const captures: Uint8Array[] = [];
  for (const formatId of settings.formats) {
    if (!isFormatId(formatId)) {
      continue;
    }
    if (formatId === currentFormat && liveSheet) {
      captures.push(await captureSheet(liveSheet));
    } else {
      const definition = getFormat(formatId);
      captures.push(await captureFormatByUrl(definition.path, settings.design));
    }
  }
  return captures;
}

/** Compone un PDF ya impuesto. No descarga. Slots `blank`: no se dibujan. */
export async function composePdf(
  settings: ExportSettings,
  captures: readonly Uint8Array[],
): Promise<Uint8Array> {
  const currentFormat = settings.formats[0] ?? 'expedientes';
  const normalized = normalizeExportSettings(settings, currentFormat);

  if (captures.length === 0) {
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

  const pngBytes: Uint8Array[] = [];
  for (const capture of captures) {
    const bytes = asPngBytes(capture);
    if (normalized.layout === '1up' && normalized.orientation === 'landscape') {
      pngBytes.push(await rotatePng90Clockwise(bytes));
    } else {
      pngBytes.push(bytes);
    }
  }

  const images: PDFImage[] = [];
  for (const bytes of pngBytes) {
    images.push(await pdf.embedPng(bytes));
  }

  if (normalized.layout === '1up') {
    for (const image of images) {
      const page = pdf.addPage(pageSize);
      fillPage(page, pageWidth, pageHeight);
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
    normalized.layout === 'booklet' ? imposeBooklet(captures.length) : imposeDuplicate(captures.length);

  const designMm = designDimensionsMm(normalized.design);
  const outerMm = (paperMm.width - designMm.width * 2) / 2;
  const yMm = (paperMm.height - designMm.height) / 2;
  const slotWidth = mmToPt(designMm.width);
  const slotHeight = mmToPt(designMm.height);
  const leftX = mmToPt(outerMm);
  const rightX = mmToPt(outerMm + designMm.width);
  const slotY = mmToPt(yMm);

  for (const sheet of sheets) {
    const page = pdf.addPage(pageSize);
    fillPage(page, pageWidth, pageHeight);
    drawSlot(page, sheet.left, images, leftX, slotY, slotWidth, slotHeight);
    drawSlot(page, sheet.right, images, rightX, slotY, slotWidth, slotHeight);
  }

  return pdf.save();
}

/** Captura formatos, impone, escribe el PDF y dispara `<a download>`. */
export async function exportPrintPdf(
  settings: ExportSettings,
  currentSheet?: HTMLElement | null,
): Promise<Uint8Array> {
  const currentFormat = formatIdFromPathname(window.location.pathname) ?? settings.formats[0] ?? 'expedientes';
  const normalized = normalizeExportSettings(settings, currentFormat);

  try {
    const captures = await captureFormats(normalized, currentSheet, currentFormat);
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
  const design = currentDesignId();
  const formatId = currentFormatId();
  return exportPrintPdf(
    {
      design,
      paper: design,
      layout: '1up',
      orientation: 'portrait',
      formats: [formatId],
    },
    document.querySelector<HTMLElement>('.sheet'),
  );
}

/** Descarga con los ajustes del panel (read + normalize). No fuerza 1-up. */
export async function downloadConfiguredPdf(): Promise<Uint8Array> {
  const formatId = currentFormatId();
  const stored = readExportSettings(formatId);
  const settings = normalizeExportSettings({ ...stored, design: currentDesignId() }, formatId);
  return exportPrintPdf(settings, document.querySelector<HTMLElement>('.sheet'));
}

export function installPrintExportHook(): void {
  window.__odoPrintExport = {
    captureSheet,
    captureFormatByUrl,
    composePdf,
    exportPrintPdf,
    downloadCurrentFormatPdf,
    imposeDuplicate,
    imposeBooklet,
  };
}

export function bindPdfExport(): void {
  installPrintExportHook();
  bindExportPanel(downloadConfiguredPdf);
}
