import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import type { ExportSettings } from '../src/lib/print-export/types';
import type { PrintExportHook } from '../src/scripts/export-pdf';

declare global {
  interface Window {
    __odoPrintExport?: PrintExportHook;
  }
}

const A5_PORTRAIT_PT = { width: 419.53, height: 595.28 };
const A4_LANDSCAPE_PT = { width: 841.89, height: 595.28 };
const PT_TOLERANCE = 1;

function assertPageSize(
  page: { getSize: () => { width: number; height: number } },
  expected: { width: number; height: number },
) {
  const { width, height } = page.getSize();
  expect(Math.abs(width - expected.width)).toBeLessThanOrEqual(PT_TOLERANCE);
  expect(Math.abs(height - expected.height)).toBeLessThanOrEqual(PT_TOLERANCE);
}

async function openExpedientesA5(page: Page) {
  page.on('dialog', (dialog) => {
    throw new Error(`Diálogo nativo: ${dialog.message()}`);
  });
  await page.goto('/formatos/expedientes/?papel=a5');
  await page.locator('.sheet').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => Boolean(window.__odoPrintExport));
}

async function composeInPage(page: Page, settings: ExportSettings) {
  const base64 = await page.evaluate(async (exportSettings) => {
    const api = window.__odoPrintExport;
    const sheet = document.querySelector('.sheet');
    if (!api || !(sheet instanceof HTMLElement)) {
      throw new Error('Falta window.__odoPrintExport o .sheet');
    }
    const png = await api.captureSheet(sheet);
    const pdf = await api.composePdf(exportSettings, [png]);
    let binary = '';
    const chunk = 0x2000;
    for (let i = 0; i < pdf.length; i += chunk) {
      binary += String.fromCharCode(...pdf.subarray(i, i + chunk));
    }
    return btoa(binary);
  }, settings);

  return PDFDocument.load(Buffer.from(base64, 'base64'));
}

test.describe('Exportación PDF', () => {
  test('descarga 1-up A5 vertical del formato actual', async ({ page }) => {
    test.setTimeout(60_000);
    await openExpedientesA5(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-pdf').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('ODO-F01-a5-sobre-a5-1up.pdf');

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const buffer = await readFile(filePath!);
    const pdf = await PDFDocument.load(buffer);

    expect(pdf.getPageCount()).toBe(1);
    assertPageSize(pdf.getPage(0), A5_PORTRAIT_PT);
  });

  test('imposición duplicate A5 sobre A4: 1 página apaisada', async ({ page }) => {
    test.setTimeout(60_000);
    await openExpedientesA5(page);

    const pdf = await composeInPage(page, {
      design: 'a5',
      paper: 'a4',
      layout: 'duplicate',
      orientation: 'landscape',
      formats: ['expedientes'],
    });

    expect(pdf.getPageCount()).toBe(1);
    assertPageSize(pdf.getPage(0), A4_LANDSCAPE_PT);
  });

  test('cuadernillo de 1 formato A5 sobre A4: 2 páginas apaisadas', async ({ page }) => {
    test.setTimeout(60_000);
    await openExpedientesA5(page);

    const pdf = await composeInPage(page, {
      design: 'a5',
      paper: 'a4',
      layout: 'booklet',
      orientation: 'landscape',
      formats: ['expedientes'],
    });

    expect(pdf.getPageCount()).toBe(2);
    assertPageSize(pdf.getPage(0), A4_LANDSCAPE_PT);
    assertPageSize(pdf.getPage(1), A4_LANDSCAPE_PT);
  });

  test('panel: A5 sobre A4 duplicar descarga 1 página apaisada', async ({ page }) => {
    test.setTimeout(60_000);
    await openExpedientesA5(page);

    await page.getByTestId('export-options').click();
    await expect(page.getByTestId('export-panel')).toBeVisible();

    await page.getByTestId('export-panel').locator('[data-export-design="a5"]').click();
    await page.locator('[data-export-paper="a4"]').click();
    await expect(page.locator('[data-export-layout="duplicate"]')).toBeEnabled();
    await page.locator('[data-export-layout="duplicate"]').click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-pdf-panel').click();
    const download = await downloadPromise;

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const pdf = await PDFDocument.load(await readFile(filePath!));

    expect(pdf.getPageCount()).toBe(1);
    assertPageSize(pdf.getPage(0), A4_LANDSCAPE_PT);
  });

  test('panel: cuadernillo de 4 formatos A5 sobre A4 son 2 páginas apaisadas', async ({ page }) => {
    test.setTimeout(120_000);
    await openExpedientesA5(page);

    await page.getByTestId('export-options').click();
    await expect(page.getByTestId('export-panel')).toBeVisible();

    await page.getByTestId('export-panel').locator('[data-export-design="a5"]').click();
    await page.locator('[data-export-paper="a4"]').click();
    await expect(page.locator('[data-export-layout="booklet"]')).toBeEnabled();
    await page.locator('[data-export-layout="booklet"]').click();

    for (const id of ['expedientes', 'paciente-rx-tx', 'eventos', 'paciente-imagen'] as const) {
      await page.locator(`[data-testid="export-format"][data-format-id="${id}"]`).check();
    }

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-pdf-panel').click();
    const download = await downloadPromise;

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const pdf = await PDFDocument.load(await readFile(filePath!));

    expect(pdf.getPageCount()).toBe(2);
    assertPageSize(pdf.getPage(0), A4_LANDSCAPE_PT);
    assertPageSize(pdf.getPage(1), A4_LANDSCAPE_PT);
  });

  test('panel: no deja la lista de formatos vacía o deshabilita la descarga', async ({ page }) => {
    await openExpedientesA5(page);

    await page.getByTestId('export-options').click();
    await expect(page.getByTestId('export-panel')).toBeVisible();

    const boxes = page.getByTestId('export-format');
    const count = await boxes.count();
    for (let index = 0; index < count; index += 1) {
      const box = boxes.nth(index);
      if (await box.isChecked()) {
        await box.click();
      }
    }

    const checked = await boxes.evaluateAll(
      (nodes) => nodes.filter((node) => node instanceof HTMLInputElement && node.checked).length,
    );
    const downloadDisabled = await page.getByTestId('download-pdf-panel').isDisabled();

    expect(checked > 0 || downloadDisabled).toBeTruthy();
  });

  test('ODO-F04 conserva trazos del odontograma y relleno de la leyenda', async ({ page }) => {
    test.setTimeout(60_000);
    page.on('dialog', (dialog) => {
      throw new Error(`Diálogo nativo: ${dialog.message()}`);
    });
    await page.goto('/formatos/paciente-imagen/?papel=a5');
    await page.locator('.sheet').waitFor();
    await page.locator('[data-testid="odontogram"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));

    const samples = await page.evaluate(async () => {
      const api = window.__odoPrintExport;
      const sheet = document.querySelector('.sheet');
      const outer = document.querySelector('.odontogram__surface');
      const swatch = document.querySelector('.legend-marker__swatch.is-rojo');
      if (!api || !(sheet instanceof HTMLElement) || !(outer instanceof Element) || !(swatch instanceof Element)) {
        throw new Error('Falta captura, odontograma o leyenda');
      }

      const png = await api.captureSheet(sheet);
      const blob = new Blob([png.slice()], { type: 'image/png' });
      const bitmap = await createImageBitmap(blob);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('No hay canvas 2d');
        }
        ctx.drawImage(bitmap, 0, 0);

        const sheetRect = sheet.getBoundingClientRect();
        const at = (el: Element, fx: number, fy: number) => {
          const rect = el.getBoundingClientRect();
          return {
            x: Math.round(((rect.left + rect.width * fx - sheetRect.left) / sheetRect.width) * canvas.width),
            y: Math.round(((rect.top + rect.height * fy - sheetRect.top) / sheetRect.height) * canvas.height),
          };
        };
        const pixel = (x: number, y: number) => {
          const [r = 0, g = 0, b = 0] = ctx.getImageData(x, y, 1, 1).data;
          return { r, g, b };
        };
        const darkestNear = (el: Element, fx: number, fy: number, radius: number) => {
          const { x, y } = at(el, fx, fy);
          let best = pixel(x, y);
          let bestLuma = (best.r + best.g + best.b) / 3;
          for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              const sample = pixel(x + dx, y + dy);
              const luma = (sample.r + sample.g + sample.b) / 3;
              if (luma < bestLuma) {
                best = sample;
                bestLuma = luma;
              }
            }
          }
          return { ...best, x, y };
        };

        return {
          toothStroke: darkestNear(outer, 0.5, 0, 4),
          toothFill: pixel(at(outer, 0.5, 0.5).x, at(outer, 0.5, 0.5).y),
          legendFill: pixel(at(swatch, 0.5, 0.5).x, at(swatch, 0.5, 0.5).y),
        };
      } finally {
        bitmap.close();
      }
    });

    const strokeLuma = (samples.toothStroke.r + samples.toothStroke.g + samples.toothStroke.b) / 3;
    expect(strokeLuma, `trazo del diente ${JSON.stringify(samples.toothStroke)}`).toBeLessThan(140);
    expect(samples.toothFill.r, `interior del diente ${JSON.stringify(samples.toothFill)}`).toBeGreaterThan(230);
    expect(samples.legendFill.r, `swatch rojo ${JSON.stringify(samples.legendFill)}`).toBeGreaterThan(150);
    expect(samples.legendFill.r).toBeGreaterThan(samples.legendFill.g);
  });
});
