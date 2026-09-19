import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { PRINT_EXPORT_STORAGE_KEY } from '../src/lib/print-export/settings';
import { FORMAT_IDS, type ExportSettings } from '../src/lib/print-export/types';
import type { PrintExportHook } from '../src/scripts/export-pdf';

declare global {
  interface Window {
    __odoPrintExport?: PrintExportHook;
  }
}

/** 96 dpi: 1 mm = 96 / 25,4 CSS px. 12 mm ≈ 45,35 px. */
const MM = 96 / 25.4;
const A5 = { width: 148 * MM, height: 210 * MM };
const GUTTER_12_PX = 12 * MM;
const PAD_TOLERANCE_PX = 1;
const SIZE_TOLERANCE_PX = 2;
const A5_PORTRAIT_PT = { width: 419.53, height: 595.28 };
const A4_LANDSCAPE_PT = { width: 841.89, height: 595.28 };
const PT_TOLERANCE = 1;
const CAPTURE_DPI = 300;
const ALL_FORMATS = [...FORMAT_IDS] as ExportSettings['formats'];

async function openExpedientes(page: Page, query: string) {
  page.on('dialog', (dialog) => {
    throw new Error(`Diálogo nativo: ${dialog.message()}`);
  });
  await page.goto(`/formatos/expedientes/${query}`);
  await page.locator('.sheet').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function innerPaddings(page: Page) {
  return page.locator('.sheet__inner').evaluate((el) => {
    const styles = getComputedStyle(el);
    return {
      left: Number.parseFloat(styles.paddingLeft),
      right: Number.parseFloat(styles.paddingRight),
    };
  });
}

async function sheetCssSize(page: Page) {
  return page.locator('.sheet').evaluate((el) => {
    const styles = getComputedStyle(el);
    return {
      width: Number.parseFloat(styles.width),
      height: Number.parseFloat(styles.height),
    };
  });
}

async function captureSheetSize(page: Page) {
  return page.evaluate(async () => {
    const api = window.__odoPrintExport;
    const sheet = document.querySelector('.sheet');
    if (!api || !(sheet instanceof HTMLElement)) {
      throw new Error('Falta window.__odoPrintExport o .sheet');
    }
    const bytes = await api.captureSheet(sheet);
    const blob = new Blob([bytes.slice()], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  });
}

async function captureSheetPng(page: Page) {
  return page.evaluate(async () => {
    const api = window.__odoPrintExport;
    const sheet = document.querySelector('.sheet');
    if (!api || !(sheet instanceof HTMLElement)) {
      throw new Error('Falta window.__odoPrintExport o .sheet');
    }
    const bytes = await api.captureSheet(sheet);
    let binary = '';
    const chunk = 0x2000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  });
}

function assertPageSize(
  page: { getSize: () => { width: number; height: number } },
  expected: { width: number; height: number },
) {
  const { width, height } = page.getSize();
  expect(Math.abs(width - expected.width)).toBeLessThanOrEqual(PT_TOLERANCE);
  expect(Math.abs(height - expected.height)).toBeLessThanOrEqual(PT_TOLERANCE);
}

async function setRangeMm(page: Page, mm: number) {
  const slider = page.locator('[data-export-gutter-mm]');
  await expect(slider).toBeEnabled();
  await slider.evaluate((el, value) => {
    const input = el as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, mm);
}

test.describe('Anillado (reflujo de lomo)', () => {
  test('?anillado=12&lomo=derecha fija atributos y el padding derecho ≈ 12 mm', async ({
    page,
  }) => {
    await openExpedientes(page, '?papel=a5&anillado=12&lomo=derecha');

    await expect(page.locator('html')).toHaveAttribute('data-gutter-mm', '12');
    await expect(page.locator('html')).toHaveAttribute('data-gutter-side', 'right');

    const pad = await innerPaddings(page);
    expect(pad.right - pad.left).toBeGreaterThanOrEqual(GUTTER_12_PX - PAD_TOLERANCE_PX);
    expect(pad.right - pad.left).toBeLessThanOrEqual(GUTTER_12_PX + PAD_TOLERANCE_PX);

    const size = await sheetCssSize(page);
    expect(size.width).toBeGreaterThanOrEqual(A5.width - SIZE_TOLERANCE_PX);
    expect(size.width).toBeLessThanOrEqual(A5.width + SIZE_TOLERANCE_PX);
    expect(size.height).toBeGreaterThanOrEqual(A5.height - SIZE_TOLERANCE_PX);
    expect(size.height).toBeLessThanOrEqual(A5.height + SIZE_TOLERANCE_PX);
  });

  test('sin anillado no hay data-gutter-mm y los paddings son iguales', async ({ page }) => {
    await openExpedientes(page, '?papel=a5');

    await expect(page.locator('html')).not.toHaveAttribute('data-gutter-mm');

    const pad = await innerPaddings(page);
    expect(Math.abs(pad.right - pad.left)).toBeLessThanOrEqual(PAD_TOLERANCE_PX);
  });

  test('?anillado=20 recorta a 15 y ?anillado=0 apaga', async ({ page }) => {
    await openExpedientes(page, '?papel=a5&anillado=20');
    await expect(page.locator('html')).toHaveAttribute('data-gutter-mm', '15');

    await page.goto('/formatos/expedientes/?papel=a5&anillado=0');
    await page.locator('.sheet').waitFor();
    await expect(page.locator('html')).not.toHaveAttribute('data-gutter-mm');
  });

  test('la guía existe en pantalla y no aparece en print', async ({ page }) => {
    await openExpedientes(page, '?papel=a5&anillado=12&lomo=izquierda');

    const guide = page.locator('.sheet__gutter-guide');
    await expect(guide).toHaveCount(1);
    await expect(guide).toHaveAttribute('data-print-hide', '');
    await expect(guide).toHaveAttribute('aria-hidden', 'true');

    const screenDisplay = await guide.evaluate((el) => getComputedStyle(el).display);
    expect(screenDisplay).not.toBe('none');

    await page.emulateMedia({ media: 'print' });

    const printDisplay = await guide.evaluate((el) => getComputedStyle(el).display);
    expect(printDisplay).toBe('none');
  });

  test('captureSheet con anillado tiene el mismo tamaño en píxeles que sin él', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openExpedientes(page, '?papel=a5');
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));

    const withoutGutter = await captureSheetSize(page);

    await page.goto('/formatos/expedientes/?papel=a5&anillado=12&lomo=derecha');
    await page.locator('.sheet').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));

    const withGutter = await captureSheetSize(page);

    expect(withGutter.width).toBe(withoutGutter.width);
    expect(withGutter.height).toBe(withoutGutter.height);
  });

  test('panel: activar anillado, 15 mm y Derecha actualiza html, URL y localStorage', async ({
    page,
  }) => {
    await openExpedientes(page, '?papel=a5');
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));

    await page.getByTestId('export-options').click();
    await expect(page.getByTestId('export-panel')).toBeVisible();
    await expect(page.getByTestId('export-gutter')).toBeVisible();

    await page.locator('[data-export-gutter-enabled]').check();
    await setRangeMm(page, 15);
    await page.locator('[name="export-gutter-side"][value="right"]').check();

    await expect(page.locator('html')).toHaveAttribute('data-gutter-mm', '15');
    await expect(page.locator('html')).toHaveAttribute('data-gutter-side', 'right');
    expect(page.url()).toContain('anillado=15&lomo=derecha');

    const stored = await page.evaluate((key) => localStorage.getItem(key), PRINT_EXPORT_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).gutterMm).toBe(15);
  });

  test('1-up A5 con 5 formatos y anillado 12: PDF de 5 páginas y plan L,R,L,R,L', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openExpedientes(page, '?papel=a5');
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));

    const settings: ExportSettings = {
      design: 'a5',
      paper: 'a5',
      layout: '1up',
      orientation: 'portrait',
      formats: ALL_FORMATS,
      gutterMm: 12,
      gutterSide: 'left',
    };

    const plan = await page.evaluate((exportSettings) => {
      const api = window.__odoPrintExport;
      if (!api) {
        throw new Error('Falta window.__odoPrintExport');
      }
      return api.buildCapturePlan(exportSettings);
    }, settings);

    expect(plan.map((job) => job.gutterSide)).toEqual(['left', 'right', 'left', 'right', 'left']);

    const downloadPromise = page.waitForEvent('download');
    await page.evaluate(async (exportSettings) => {
      const api = window.__odoPrintExport;
      if (!api) {
        throw new Error('Falta window.__odoPrintExport');
      }
      await api.exportPrintPdf(exportSettings);
    }, settings);
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('libro-odontologico-a5-sobre-a5-1up-anillado12mm.pdf');

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const pdf = await PDFDocument.load(await readFile(filePath!));
    expect(pdf.getPageCount()).toBe(5);
    for (let index = 0; index < 5; index += 1) {
      assertPageSize(pdf.getPage(index), A5_PORTRAIT_PT);
    }
  });

  test('captureSheet: la columna a 6 mm del borde izquierdo cambia de lado con el lomo', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openExpedientes(page, '?papel=a5&anillado=12&lomo=izquierda');
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));
    const leftPng = await captureSheetPng(page);

    await page.goto('/formatos/expedientes/?papel=a5&anillado=12&lomo=derecha');
    await page.locator('.sheet').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));
    const rightPng = await captureSheetPng(page);

    const sample = await page.evaluate(
      async ({ leftB64, rightB64, dpi }) => {
        const toBitmap = async (b64: string) => {
          const binary = atob(b64);
          const png = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            png[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([png], { type: 'image/png' });
          return createImageBitmap(blob);
        };

        const columnMin = (ctx: CanvasRenderingContext2D, x: number, height: number) => {
          let min = 255;
          const y0 = Math.round(height * 0.08);
          const y1 = Math.round(height * 0.4);
          for (let y = y0; y < y1; y += 2) {
            const [r = 0, g = 0, b = 0] = ctx.getImageData(x, y, 1, 1).data;
            min = Math.min(min, (r + g + b) / 3);
          }
          return min;
        };

        const leftBmp = await toBitmap(leftB64);
        const rightBmp = await toBitmap(rightB64);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = leftBmp.width;
          canvas.height = leftBmp.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('No hay canvas 2d');
          }

          const mmToPx = (mm: number) => Math.round((mm * dpi) / 25.4);
          const read = (bmp: ImageBitmap, x: number) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bmp, 0, 0);
            return columnMin(ctx, x, canvas.height);
          };

          const x6 = mmToPx(6);
          const left6 = read(leftBmp, x6);
          const right6 = read(rightBmp, x6);

          let x = x6;
          let leftMin = left6;
          let rightMin = right6;
          const xMax = mmToPx(16);
          while (x <= xMax && Math.abs(leftMin - rightMin) < 20) {
            x += 2;
            leftMin = read(leftBmp, x);
            rightMin = read(rightBmp, x);
          }

          return { x6, left6, right6, x, leftMin, rightMin };
        } finally {
          leftBmp.close();
          rightBmp.close();
        }
      },
      { leftB64: leftPng, rightB64: rightPng, dpi: CAPTURE_DPI },
    );

    const leftWhite = sample.leftMin > 245;
    const rightWhite = sample.rightMin > 245;
    const leftInk = sample.leftMin < 200;
    const rightInk = sample.rightMin < 200;

    expect(
      (leftWhite && rightInk) || (rightWhite && leftInk),
      `columna ~${sample.x}px (6 mm=${sample.x6}px) left=${sample.leftMin} right=${sample.rightMin}`,
    ).toBeTruthy();
  });

  test('cuadernillo A5 sobre A4 de 5 formatos con anillado: 4 páginas A4 y plan hacia el pliegue', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openExpedientes(page, '?papel=a5');
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));

    const settings: ExportSettings = {
      design: 'a5',
      paper: 'a4',
      layout: 'booklet',
      orientation: 'landscape',
      formats: ALL_FORMATS,
      gutterMm: 12,
      gutterSide: 'left',
    };

    const plan = await page.evaluate((exportSettings) => {
      const api = window.__odoPrintExport;
      if (!api) {
        throw new Error('Falta window.__odoPrintExport');
      }
      return api.buildCapturePlan(exportSettings);
    }, settings);

    expect(plan).toHaveLength(5);
    expect(plan.map((job) => job.gutterSide)).toEqual(['left', 'right', 'left', 'right', 'left']);
    expect(plan.every((job) => job.gutterMm === 12)).toBeTruthy();

    const downloadPromise = page.waitForEvent('download');
    await page.evaluate(async (exportSettings) => {
      const api = window.__odoPrintExport;
      if (!api) {
        throw new Error('Falta window.__odoPrintExport');
      }
      await api.exportPrintPdf(exportSettings);
    }, settings);
    const download = await downloadPromise;

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const pdf = await PDFDocument.load(await readFile(filePath!));
    expect(pdf.getPageCount()).toBe(4);
    assertPageSize(pdf.getPage(0), A4_LANDSCAPE_PT);
    assertPageSize(pdf.getPage(1), A4_LANDSCAPE_PT);
    assertPageSize(pdf.getPage(2), A4_LANDSCAPE_PT);
    assertPageSize(pdf.getPage(3), A4_LANDSCAPE_PT);
  });

  test('PNG para editar con anillado activo ignora el lomo y no pone anillado en el iframe', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openExpedientes(page, '?papel=a5&anillado=12&lomo=derecha');
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));

    const liveSize = await captureSheetSize(page);

    const iframeUrls: string[] = [];
    await page.route('**/formatos/**', async (route) => {
      iframeUrls.push(route.request().url());
      await route.continue();
    });

    await page.getByTestId('export-options').click();
    await expect(page.getByTestId('export-panel')).toBeVisible();
    await page.locator('[data-testid="export-format"][data-format-id="expedientes"]').check();
    await page.locator('[data-testid="export-format"][data-format-id="paciente-rx-tx"]').check();

    const downloadPromise = page.waitForEvent('download', { timeout: 110_000 });
    await page.getByTestId('download-png-panel').click();
    const download = await downloadPromise;

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const unzipped = unzipSync(new Uint8Array(await readFile(filePath!)));
    const names = Object.keys(unzipped).sort();
    expect(names.length).toBeGreaterThanOrEqual(1);
    const png = unzipped[names[0]!];
    expect(png).toBeTruthy();

    const pngSize = await page.evaluate(async (b64) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      const bitmap = await createImageBitmap(blob);
      try {
        return { width: bitmap.width, height: bitmap.height };
      } finally {
        bitmap.close();
      }
    }, Buffer.from(png!).toString('base64'));

    expect(pngSize.width).toBe(liveSize.width);
    expect(pngSize.height).toBe(liveSize.height);

    const otherFormatUrls = iframeUrls.filter((url) => url.includes('/formatos/') && !url.includes('/formatos/expedientes/'));
    expect(otherFormatUrls.length).toBeGreaterThan(0);
    for (const url of otherFormatUrls) {
      const query = new URL(url).searchParams;
      expect(query.has('anillado'), url).toBeFalsy();
    }
  });

  test('elegir cuadernillo bloquea los radios de lado y muestra el hint', async ({ page }) => {
    await openExpedientes(page, '?papel=a5');
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));

    await page.getByTestId('export-options').click();
    await expect(page.getByTestId('export-panel')).toBeVisible();

    await page.getByTestId('export-panel').locator('[data-export-design="a5"]').click();
    await page.locator('[data-export-paper="a4"]').click();
    await expect(page.locator('[data-export-layout="booklet"]')).toBeEnabled();
    await page.locator('[data-export-layout="booklet"]').click();

    await expect(page.locator('[name="export-gutter-side"][value="left"]')).toBeDisabled();
    await expect(page.locator('[name="export-gutter-side"][value="right"]')).toBeDisabled();
    await expect(page.locator('[data-gutter-booklet-auto]')).toBeVisible();
    await expect(page.locator('[data-gutter-booklet-auto]')).toHaveText('Hacia el pliegue, automático');
  });
});
