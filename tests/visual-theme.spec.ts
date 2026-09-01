import { expect, test, type Page } from '@playwright/test';
import type { PrintExportHook } from '../src/scripts/export-pdf';

declare global {
  interface Window {
    __odoPrintExport?: PrintExportHook;
  }
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function parseRadiusPx(value: string): number {
  const match = value.trim().match(/^([\d.]+)/);
  return match ? Number.parseFloat(match[1] ?? '0') : 0;
}

async function panelRadiusPx(page: Page): Promise<number> {
  const radius = await page.locator('.outlined-panel').first().evaluate((el) => {
    return getComputedStyle(el).borderTopLeftRadius;
  });
  return parseRadiusPx(radius);
}

test.describe('Selector de estilo visual', () => {
  test('muestra Normal, Rounded y Glassmorfismo y parte de Normal', async ({ page }) => {
    await page.goto('/formatos/expedientes/');

    await expect(page.getByTestId('visual-theme-selector')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Normal' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Rounded' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Glassmorfismo' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'normal');
    await expect(page.getByRole('radio', { name: 'Normal' })).toHaveAttribute('aria-checked', 'true');
  });

  test('el clic pone data-visual-theme y persiste al navegar a otro formato', async ({ page }) => {
    await page.goto('/formatos/expedientes/');

    await page.getByRole('radio', { name: 'Rounded' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');
    await expect(page.getByRole('radio', { name: 'Rounded' })).toHaveAttribute('aria-checked', 'true');
    await expect(page).toHaveURL(/estilo=rounded/);

    await page.goto('/formatos/eventos/');

    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');
    await expect(page.getByRole('radio', { name: 'Rounded' })).toHaveAttribute('aria-checked', 'true');
  });

  test('?estilo=glass gana sobre el valor guardado', async ({ page }) => {
    await page.goto('/formatos/expedientes/');
    await page.getByRole('radio', { name: 'Rounded' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');

    await page.goto('/formatos/paciente-rx-tx/?estilo=glass');

    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'glass');
    await expect(page.getByRole('radio', { name: 'Glassmorfismo' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('en Rounded el border-radius de .outlined-panel es > 0 y en Normal es 0', async ({
    page,
  }) => {
    await page.goto('/formatos/expedientes/');

    expect(await panelRadiusPx(page)).toBe(0);

    await page.getByRole('radio', { name: 'Rounded' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');

    expect(await panelRadiusPx(page)).toBeGreaterThan(0);

    await page.getByRole('radio', { name: 'Normal' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'normal');

    expect(await panelRadiusPx(page)).toBe(0);
  });

  test('en @media print la barra se oculta y el radio interno de Rounded se conserva', async ({
    page,
  }) => {
    await page.goto('/formatos/expedientes/');
    await page.getByRole('radio', { name: 'Rounded' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');

    const screenRadius = await panelRadiusPx(page);
    expect(screenRadius).toBeGreaterThan(0);

    await page.emulateMedia({ media: 'print' });

    await expect(page.getByTestId('print-toolbar')).toBeHidden();
    expect(await panelRadiusPx(page)).toBeGreaterThan(0);
  });

  test('captura con Glass no lanza y el PNG no está vacío', async ({ page }) => {
    test.setTimeout(60_000);
    page.on('dialog', (dialog) => {
      throw new Error(`Diálogo nativo: ${dialog.message()}`);
    });

    await page.goto('/formatos/expedientes/?estilo=glass');
    await page.locator('.sheet').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Boolean(window.__odoPrintExport));
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'glass');

    const png = await page.evaluate(async () => {
      const api = window.__odoPrintExport;
      const sheet = document.querySelector('.sheet');
      if (!api || !(sheet instanceof HTMLElement)) {
        throw new Error('Falta window.__odoPrintExport o .sheet');
      }
      const bytes = await api.captureSheet(sheet);
      return {
        length: bytes.byteLength,
        header: Array.from(bytes.slice(0, 8)),
      };
    });

    expect(png.length).toBeGreaterThan(100);
    expect(png.header).toEqual(PNG_SIGNATURE);
  });
});
