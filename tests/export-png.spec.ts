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
