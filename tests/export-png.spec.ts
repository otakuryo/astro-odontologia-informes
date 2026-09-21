import { expect, test, type Locator, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import type { PrintExportHook } from '../src/scripts/export-pdf';

declare global {
  interface Window {
    __odoPrintExport?: PrintExportHook;
  }
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_COLOR_TYPE_RGBA = 6;

async function openExpedientesA5Rounded(page: Page) {
  page.on('dialog', (dialog) => {
    throw new Error(`Diálogo nativo: ${dialog.message()}`);
  });
  await page.goto('/formatos/expedientes/?papel=a5&estilo=rounded');
  await page.locator('.sheet').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => Boolean(window.__odoPrintExport));
}

async function leaveFormats(page: Page, ids: readonly string[]) {
  const wanted = new Set(ids);
  const boxes = page.getByTestId('export-format');
  const count = await boxes.count();
  for (let index = 0; index < count; index += 1) {
    const box = boxes.nth(index);
    const id = await box.getAttribute('data-format-id');
    const checked = await box.isChecked();
    if (id && wanted.has(id)) {
      if (!checked) {
        await box.check();
      }
    } else if (checked) {
      await box.uncheck();
    }
  }
}

function waitAriaBusy(button: Locator) {
  return button.evaluate((el) => {
    if (el.getAttribute('aria-busy') === 'true') {
      return true;
    }
    return new Promise<boolean>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error('El botón no pasó a aria-busy durante la generación'));
      }, 8_000);
      const observer = new MutationObserver(() => {
        if (el.getAttribute('aria-busy') === 'true') {
          window.clearTimeout(timer);
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(el, { attributes: true, attributeFilter: ['aria-busy', 'class'] });
    });
  });
}

async function inspectPngCorner(page: Page, bytes: Uint8Array) {
  const encoded = Buffer.from(bytes).toString('base64');
  return page.evaluate(async (b64) => {
    const binary = atob(b64);
    const png = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      png[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([png], { type: 'image/png' });
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
      const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
      return {
        header: Array.from(png.slice(0, 8)),
        colorType: png[25] ?? -1,
        corner: { r, g, b, a },
      };
    } finally {
      bitmap.close();
    }
  }, encoded);
}

test.describe('Captura PNG', () => {
  test('opaco rellena alfa; transparente es RGBA con esquina vacía', async ({ page }) => {
    test.setTimeout(90_000);
    await openExpedientesA5Rounded(page);

    const result = await page.evaluate(async () => {
      const api = window.__odoPrintExport;
      const sheet = document.querySelector('.sheet');
      if (!api || !(sheet instanceof HTMLElement)) {
        throw new Error('Falta window.__odoPrintExport o .sheet');
      }

      const inspect = async (bytes: Uint8Array) => {
        const ihdr = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0);
        if (ihdr !== 'IHDR') {
          throw new Error(`El primer chunk no es IHDR: ${ihdr}`);
        }

        const blob = new Blob([bytes.slice()], { type: 'image/png' });
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
          const pixel = (x: number, y: number) => {
            const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(x, y, 1, 1).data;
            return { r, g, b, a };
          };
          const lastX = bitmap.width - 1;
          const lastY = bitmap.height - 1;
          const midX = Math.floor(bitmap.width / 2);
          const midY = Math.floor(bitmap.height / 2);
          const corner = pixel(0, 0);
          const samples = [corner, pixel(lastX, 0), pixel(0, lastY), pixel(midX, midY)];
          return {
            length: bytes.byteLength,
            header: Array.from(bytes.slice(0, 8)),
            colorType: bytes[25] ?? -1,
            corner,
            sampleAlphas: samples.map((sample) => sample.a),
          };
        } finally {
          bitmap.close();
        }
      };

      return {
        opaque: await inspect(await api.captureSheet(sheet)),
        transparent: await inspect(await api.captureSheet(sheet, { background: 'transparent' })),
      };
    });

    expect(result.opaque.length).toBeGreaterThan(100);
    for (const alpha of result.opaque.sampleAlphas) {
      expect(alpha).toBe(255);
    }

    expect(result.transparent.header).toEqual(PNG_SIGNATURE);
    expect(result.transparent.colorType).toBe(PNG_COLOR_TYPE_RGBA);
    expect(result.transparent.corner.a, `esquina ${JSON.stringify(result.transparent.corner)}`).toBeLessThan(16);
  });

  test('captureFormatByUrl en transparente devuelve PNG RGBA', async ({ page }) => {
    test.setTimeout(90_000);
    await openExpedientesA5Rounded(page);

    const png = await page.evaluate(async () => {
      const api = window.__odoPrintExport;
      if (!api) {
        throw new Error('Falta window.__odoPrintExport');
      }

      const bytes = await api.captureFormatByUrl('/formatos/eventos/', 'a5', {
        background: 'transparent',
      });
      const ihdr = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0);
      if (ihdr !== 'IHDR') {
        throw new Error(`El primer chunk no es IHDR: ${ihdr}`);
      }

      return {
        length: bytes.byteLength,
        header: Array.from(bytes.slice(0, 8)),
        colorType: bytes[25] ?? -1,
      };
    });

    expect(png.length).toBeGreaterThan(100);
    expect(png.header).toEqual(PNG_SIGNATURE);
    expect(png.colorType).toBe(PNG_COLOR_TYPE_RGBA);
  });

  test('ODO-F05 captureSheet transparente: esquina vacía, interior del diente claro y opaco, contorno oscuro y opaco', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    page.on('dialog', (dialog) => {
      throw new Error(`Diálogo nativo: ${dialog.message()}`);
    });
    await page.goto('/formatos/periodontograma/?papel=a5&estilo=rounded');
    await page.locator('.sheet').waitFor();
    await page.locator('[data-testid="perio-tooth"][data-fdi="1.1"][data-row="profile"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));

    const samples = await page.evaluate(async () => {
      const api = window.__odoPrintExport;
      const sheet = document.querySelector('.sheet');
      const tooth = document.querySelector(
        '[data-testid="perio-tooth"][data-fdi="1.1"][data-row="profile"]',
      );
      if (!api || !(sheet instanceof HTMLElement) || !(tooth instanceof Element)) {
        throw new Error('Falta captura o el perfil FDI 1.1');
      }

      const png = await api.captureSheet(sheet, { background: 'transparent' });
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

        const pixel = (x: number, y: number) => {
          const px = Math.min(canvas.width - 1, Math.max(0, x));
          const py = Math.min(canvas.height - 1, Math.max(0, y));
          const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(px, py, 1, 1).data;
          return { r, g, b, a, luma: (r + g + b) / 3 };
        };

        const sheetRect = sheet.getBoundingClientRect();
        const toCanvas = (cssX: number, cssY: number) => ({
          x: Math.round(((cssX - sheetRect.left) / sheetRect.width) * canvas.width),
          y: Math.round(((cssY - sheetRect.top) / sheetRect.height) * canvas.height),
        });

        const isPaper = (sample: { luma: number; a: number }) => sample.luma > 230 && sample.a === 255;
        const box = tooth.getBoundingClientRect();
        const y0 = toCanvas(box.left, box.top).y;
        const y1 = toCanvas(box.left, box.top + box.height).y;
        const minRun = Math.max(8, Math.round((y1 - y0) * 0.2));

        let best = {
          length: 0,
          interior: pixel(0, 0),
          outline: pixel(0, 0),
          minLuma: 0,
          minAlpha: 0,
        };
        for (const fx of [0.4, 0.5, 0.6]) {
          const x = toCanvas(box.left + box.width * fx, box.top).x;
          let runStart = -1;
          const consider = (start: number, end: number) => {
            const length = end - start + 1;
            if (length <= best.length) {
              return;
            }
            const mid = pixel(x, start + Math.floor(length / 2));
            const darkestOutward = (fromY: number, dir: number) => {
              let ink = pixel(x, fromY);
              for (let i = 0; i <= 4; i += 1) {
                const sample = pixel(x, fromY + dir * i);
                if (sample.luma < ink.luma) {
                  ink = sample;
                }
              }
              return ink;
            };
            const top = darkestOutward(Math.max(y0, start - 1), -1);
            const bot = darkestOutward(Math.min(y1, end + 1), 1);
            let minLuma = mid.luma;
            let minAlpha = mid.a;
            for (let y = start; y <= end; y += 1) {
              const sample = pixel(x, y);
              if (sample.luma < minLuma) {
                minLuma = sample.luma;
              }
              if (sample.a < minAlpha) {
                minAlpha = sample.a;
              }
            }
            best = {
              length,
              interior: mid,
              outline: top.luma <= bot.luma ? top : bot,
              minLuma,
              minAlpha,
            };
          };
          for (let y = y0; y <= y1; y += 1) {
            if (isPaper(pixel(x, y))) {
              if (runStart < 0) {
                runStart = y;
              }
            } else if (runStart >= 0) {
              consider(runStart, y - 1);
              runStart = -1;
            }
          }
          if (runStart >= 0) {
            consider(runStart, y1);
          }
        }

        if (best.length < minRun) {
          throw new Error(
            `no hay interior de papel continuo en el perfil FDI 1.1 (racha ${best.length} px, mínimo ${minRun}); la cuadrícula atravesaría el diente`,
          );
        }

        return {
          header: Array.from(png.slice(0, 8)),
          colorType: png[25] ?? -1,
          corner: pixel(0, 0),
          interior: best.interior,
          interiorMinLuma: best.minLuma,
          interiorMinAlpha: best.minAlpha,
          outline: best.outline,
        };
      } finally {
        bitmap.close();
      }
    });

    expect(samples.header).toEqual(PNG_SIGNATURE);
    expect(samples.colorType).toBe(PNG_COLOR_TYPE_RGBA);
    expect(
      samples.corner.a,
      `esquina de hoja transparente ${JSON.stringify(samples.corner)}`,
    ).toBeLessThan(16);
    expect(
      samples.interior.luma,
      `interior del diente claro ${JSON.stringify(samples.interior)}`,
    ).toBeGreaterThan(230);
    expect(
      samples.interior.a,
      `interior del diente opaco ${JSON.stringify(samples.interior)}`,
    ).toBe(255);
    expect(
      samples.interiorMinLuma,
      `la cuadrícula no debe reaparecer a través del diente (luma mínima ${samples.interiorMinLuma.toFixed(1)})`,
    ).toBeGreaterThan(230);
    expect(
      samples.interiorMinAlpha,
      'la cuadrícula no debe reaparecer a través del diente (alfa interior opaco)',
    ).toBe(255);
    expect(
      samples.outline.luma,
      `contorno del diente oscuro ${JSON.stringify(samples.outline)}`,
    ).toBeLessThan(140);
    expect(
      samples.outline.a,
      `contorno del diente opaco ${JSON.stringify(samples.outline)}`,
    ).toBe(255);
  });
});

test.describe('ZIP PNG para editar', () => {
  test('un formato A5 descarga ZIP con una entrada y alfa en esquina', async ({ page }) => {
    test.setTimeout(90_000);
    await openExpedientesA5Rounded(page);

    await page.getByTestId('export-options').click();
    await expect(page.getByTestId('export-panel')).toBeVisible();
    await leaveFormats(page, ['expedientes']);

    const button = page.getByTestId('download-png-panel');
    await expect(button).toBeVisible();
    const sawBusy = waitAriaBusy(button);
    const downloadPromise = page.waitForEvent('download', { timeout: 80_000 });
    await button.click();
    await sawBusy;

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('ODO-F01-a5-sin-fondo.zip');

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const unzipped = unzipSync(new Uint8Array(await readFile(filePath!)));
    const names = Object.keys(unzipped).sort();
    expect(names).toEqual(['01-ODO-F01-a5-sin-fondo.png']);

    const png = unzipped[names[0]!];
    expect(png, 'entrada PNG').toBeTruthy();
    const inspect = await inspectPngCorner(page, png!);
    expect(inspect.header).toEqual(PNG_SIGNATURE);
    expect(inspect.colorType).toBe(PNG_COLOR_TYPE_RGBA);
    expect(inspect.corner.a, `esquina ${JSON.stringify(inspect.corner)}`).toBeLessThan(16);
  });

  test('dos formatos A5 descarga ZIP de libro con entradas 01 y 02', async ({ page }) => {
    test.setTimeout(120_000);
    await openExpedientesA5Rounded(page);

    await page.getByTestId('export-options').click();
    await expect(page.getByTestId('export-panel')).toBeVisible();
    await leaveFormats(page, ['expedientes', 'paciente-rx-tx']);

    const downloadPromise = page.waitForEvent('download', { timeout: 110_000 });
    await page.getByTestId('download-png-panel').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('libro-odontologico-a5-sin-fondo.zip');

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const unzipped = unzipSync(new Uint8Array(await readFile(filePath!)));
    const names = Object.keys(unzipped).sort();
    expect(names).toEqual(['01-ODO-F01-a5-sin-fondo.png', '02-ODO-F02-a5-sin-fondo.png']);

    for (const name of names) {
      const bytes = unzipped[name];
      expect(bytes, name).toBeTruthy();
      expect(Array.from(bytes!.slice(0, 8))).toEqual(PNG_SIGNATURE);
    }
  });
});
