import { expect, test, type Page } from '@playwright/test';
import type { PrintExportHook } from '../src/scripts/export-pdf';
import { chooseToolbarOption } from './toolbar-select';

declare global {
  interface Window {
    __odoPrintExport?: PrintExportHook;
  }
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const THEME_SELECTOR = 'visual-theme-selector' as const;

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

function themeSelector(page: Page) {
  return page.getByTestId(THEME_SELECTOR);
}

function themeTriggerLabel(page: Page) {
  return themeSelector(page).locator('[data-toolbar-select-label]');
}

test.describe('Selector de estilo visual', () => {
  test('muestra el selector, oculta opciones hasta abrir y parte de Normal', async ({ page }) => {
    await page.goto('/formatos/expedientes/');

    const selector = themeSelector(page);
    await expect(selector).toBeVisible();
    await expect(themeTriggerLabel(page)).toHaveText('Normal');
    await expect(selector.locator('summary')).toHaveAttribute('aria-label', 'Estilo visual: Normal');
    await expect(selector).not.toHaveAttribute('open');
    await expect(selector.getByRole('option', { name: 'Normal' })).toBeHidden();
    await expect(selector.getByRole('option', { name: 'Rounded' })).toBeHidden();
    await expect(selector.getByRole('option', { name: 'Glassmorfismo' })).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'normal');

    await selector.locator('summary').click();

    await expect(selector).toHaveAttribute('open', '');
    await expect(selector.getByRole('option', { name: 'Normal' })).toBeVisible();
    await expect(selector.getByRole('option', { name: 'Rounded' })).toBeVisible();
    await expect(selector.getByRole('option', { name: 'Glassmorfismo' })).toBeVisible();
    await expect(selector.getByRole('option', { name: 'Normal' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('el clic pone data-visual-theme, actualiza URL y disparador, y persiste', async ({
    page,
  }) => {
    await page.goto('/formatos/expedientes/');
    const selector = themeSelector(page);

    await chooseToolbarOption(page, THEME_SELECTOR, 'Rounded');

    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');
    await expect(page).toHaveURL(/estilo=rounded/);
    await expect(themeTriggerLabel(page)).toHaveText('Rounded');
    await expect(selector.locator('summary')).toHaveAttribute('aria-label', 'Estilo visual: Rounded');
    await expect(selector).not.toHaveAttribute('open');
    await expect(selector.getByRole('option', { name: 'Rounded' })).toBeHidden();
    await expect(
      selector.getByRole('option', { name: 'Rounded', includeHidden: true }),
    ).toHaveAttribute('aria-selected', 'true');

    await chooseToolbarOption(page, THEME_SELECTOR, 'Glassmorfismo');

    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'glass');
    await expect(page).toHaveURL(/estilo=glass/);
    await expect(themeTriggerLabel(page)).toHaveText('Glassmorfismo');
    await expect(selector).not.toHaveAttribute('open');
    await expect(selector.getByRole('option', { name: 'Glassmorfismo' })).toBeHidden();

    await chooseToolbarOption(page, THEME_SELECTOR, 'Normal');

    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'normal');
    await expect(page).not.toHaveURL(/estilo=/);
    await expect(themeTriggerLabel(page)).toHaveText('Normal');
    await expect(selector).not.toHaveAttribute('open');

    await chooseToolbarOption(page, THEME_SELECTOR, 'Rounded');
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');

    await page.goto('/formatos/eventos/');

    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');
    await expect(themeTriggerLabel(page)).toHaveText('Rounded');
    await expect(
      themeSelector(page).getByRole('option', { name: 'Rounded', includeHidden: true }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  test('?estilo=glass gana sobre el valor guardado', async ({ page }) => {
    await page.goto('/formatos/expedientes/');
    await chooseToolbarOption(page, THEME_SELECTOR, 'Rounded');
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');

    await page.goto('/formatos/paciente-rx-tx/?estilo=glass');

    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'glass');
    await expect(themeTriggerLabel(page)).toHaveText('Glassmorfismo');
    await expect(
      themeSelector(page).getByRole('option', { name: 'Glassmorfismo', includeHidden: true }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  test('en Rounded el border-radius de .outlined-panel es > 0 y en Normal es 0', async ({
    page,
  }) => {
    await page.goto('/formatos/expedientes/');

    expect(await panelRadiusPx(page)).toBe(0);

    await chooseToolbarOption(page, THEME_SELECTOR, 'Rounded');
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');

    expect(await panelRadiusPx(page)).toBeGreaterThan(0);

    await chooseToolbarOption(page, THEME_SELECTOR, 'Normal');
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'normal');

    expect(await panelRadiusPx(page)).toBe(0);
  });

  test('en @media print la barra se oculta y el radio interno de Rounded se conserva', async ({
    page,
  }) => {
    await page.goto('/formatos/expedientes/');
    await chooseToolbarOption(page, THEME_SELECTOR, 'Rounded');
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'rounded');

    const screenRadius = await panelRadiusPx(page);
    expect(screenRadius).toBeGreaterThan(0);

    await page.emulateMedia({ media: 'print' });

    await expect(page.getByTestId('print-toolbar')).toBeHidden();
    expect(await panelRadiusPx(page)).toBeGreaterThan(0);
  });

  test('Escape cierra el menú sin cambiar data-visual-theme', async ({ page }) => {
    await page.goto('/formatos/expedientes/');
    const selector = themeSelector(page);

    await selector.locator('summary').click();
    await expect(selector.getByRole('option', { name: 'Rounded' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'normal');

    await page.keyboard.press('Escape');

    await expect(selector).not.toHaveAttribute('open');
    await expect(selector.getByRole('option', { name: 'Rounded' })).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'normal');
    await expect(themeTriggerLabel(page)).toHaveText('Normal');
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
