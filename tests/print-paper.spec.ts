import { expect, test, type Page } from '@playwright/test';
import { chooseToolbarOption } from './toolbar-select';

/** 96 dpi: 1 mm = 96 / 25,4 CSS px. */
const MM = 96 / 25.4;
const SIZE_TOLERANCE_PX = 2;

const PAPERS = [
  {
    id: 'letter',
    name: 'Carta',
    query: '',
    width: 8.5 * 96,
    height: 11 * 96,
  },
  {
    id: 'a5',
    name: 'A5',
    query: '?papel=a5',
    width: 148 * MM,
    height: 210 * MM,
  },
  {
    id: 'a6',
    name: 'A6',
    query: '?papel=a6',
    width: 105 * MM,
    height: 148 * MM,
  },
] as const;

const FORMATS = [
  { path: '/formatos/expedientes/', code: 'ODO-F01' },
  { path: '/formatos/paciente-rx-tx/', code: 'ODO-F02' },
  { path: '/formatos/eventos/', code: 'ODO-F03' },
  { path: '/formatos/paciente-imagen/', code: 'ODO-F04' },
] as const;

async function assertNoSheetOverflow(page: Page) {
  const metrics = await page.locator('.sheet').evaluate((sheet) => {
    const inner = sheet.querySelector('.sheet__inner');
    const body = sheet.querySelector('.sheet__body');

    const measure = (el: Element | null) => {
      if (!el) {
        return null;
      }

      const rect = el.getBoundingClientRect();
      return {
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        rect: {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
        },
      };
    };

    const sheetBox = measure(sheet);
    const innerBox = measure(inner);
    const contained =
      sheetBox && innerBox
        ? innerBox.rect.left >= sheetBox.rect.left - 0.5 &&
          innerBox.rect.top >= sheetBox.rect.top - 0.5 &&
          innerBox.rect.right <= sheetBox.rect.right + 0.5 &&
          innerBox.rect.bottom <= sheetBox.rect.bottom + 0.5
        : false;

    return {
      sheet: sheetBox,
      inner: innerBox,
      body: measure(body),
      contained,
    };
  });

  expect(metrics.sheet, 'debe existir .sheet').not.toBeNull();
  expect(metrics.sheet!.scrollWidth).toBeLessThanOrEqual(metrics.sheet!.clientWidth + 1);
  expect(metrics.sheet!.scrollHeight).toBeLessThanOrEqual(metrics.sheet!.clientHeight + 1);
  expect(metrics.inner, 'debe existir .sheet__inner').not.toBeNull();
  expect(metrics.inner!.scrollWidth).toBeLessThanOrEqual(metrics.inner!.clientWidth + 1);
  expect(metrics.inner!.scrollHeight).toBeLessThanOrEqual(metrics.inner!.clientHeight + 1);
  expect(metrics.body, 'debe existir .sheet__body').not.toBeNull();
  expect(metrics.body!.scrollWidth).toBeLessThanOrEqual(metrics.body!.clientWidth + 1);
  expect(metrics.body!.scrollHeight).toBeLessThanOrEqual(metrics.body!.clientHeight + 1);
  expect(metrics.contained).toBe(true);
}

async function assertSheetSize(
  page: Page,
  expected: { width: number; height: number },
) {
  const box = await page.locator('.sheet').evaluate((el) => {
    const styles = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      cssWidth: Number.parseFloat(styles.width),
      cssHeight: Number.parseFloat(styles.height),
    };
  });

  expect(box.width).toBeGreaterThanOrEqual(expected.width - SIZE_TOLERANCE_PX);
  expect(box.width).toBeLessThanOrEqual(expected.width + SIZE_TOLERANCE_PX);
  expect(box.height).toBeGreaterThanOrEqual(expected.height - SIZE_TOLERANCE_PX);
  expect(box.height).toBeLessThanOrEqual(expected.height + SIZE_TOLERANCE_PX);
  expect(box.cssWidth).toBeGreaterThanOrEqual(expected.width - SIZE_TOLERANCE_PX);
  expect(box.cssWidth).toBeLessThanOrEqual(expected.width + SIZE_TOLERANCE_PX);
  expect(box.cssHeight).toBeGreaterThanOrEqual(expected.height - SIZE_TOLERANCE_PX);
  expect(box.cssHeight).toBeLessThanOrEqual(expected.height + SIZE_TOLERANCE_PX);
}

const PAPER_SELECTOR = 'paper-size-selector' as const;

function paperSelector(page: Page) {
  return page.getByTestId(PAPER_SELECTOR);
}

function paperTriggerLabel(page: Page) {
  return paperSelector(page).locator('[data-toolbar-select-label]');
}

test.describe('Selector de formato de impresión', () => {
  test('muestra el selector, oculta opciones hasta abrir y parte de Carta', async ({ page }) => {
    await page.goto('/formatos/expedientes/');

    const selector = paperSelector(page);
    await expect(selector).toBeVisible();
    await expect(paperTriggerLabel(page)).toHaveText('Carta');
    await expect(selector.locator('summary')).toHaveAttribute('aria-label', 'Papel: Carta');
    await expect(selector).not.toHaveAttribute('open');
    await expect(selector.getByRole('option', { name: 'Carta' })).toBeHidden();
    await expect(selector.getByRole('option', { name: 'A5' })).toBeHidden();
    await expect(selector.getByRole('option', { name: 'A6' })).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'letter');

    await selector.locator('summary').click();

    await expect(selector).toHaveAttribute('open', '');
    await expect(selector.getByRole('option', { name: 'Carta' })).toBeVisible();
    await expect(selector.getByRole('option', { name: 'A5' })).toBeVisible();
    await expect(selector.getByRole('option', { name: 'A6' })).toBeVisible();
    await expect(selector.getByRole('option', { name: 'Carta' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('A5 y A6 redimensionan la hoja, actualizan el disparador y persisten', async ({ page }) => {
    await page.goto('/formatos/expedientes/');
    const selector = paperSelector(page);

    await chooseToolbarOption(page, PAPER_SELECTOR, 'A5');

    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'a5');
    await expect(page).toHaveURL(/papel=a5/);
    await expect(paperTriggerLabel(page)).toHaveText('A5');
    await expect(selector.locator('summary')).toHaveAttribute('aria-label', 'Papel: A5');
    await expect(selector).not.toHaveAttribute('open');
    await expect(selector.getByRole('option', { name: 'A5' })).toBeHidden();
    await expect(selector.getByRole('option', { name: 'A5', includeHidden: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect
      .poll(async () => page.locator('#print-page-size').evaluate((el) => el.textContent ?? ''))
      .toContain('A5');
    await assertSheetSize(page, { width: 148 * MM, height: 210 * MM });
    await assertNoSheetOverflow(page);

    await page.goto('/formatos/eventos/');

    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'a5');
    await expect(paperTriggerLabel(page)).toHaveText('A5');
    await expect(
      paperSelector(page).getByRole('option', { name: 'A5', includeHidden: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await assertSheetSize(page, { width: 148 * MM, height: 210 * MM });

    await chooseToolbarOption(page, PAPER_SELECTOR, 'A6');

    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'a6');
    await expect(page).toHaveURL(/papel=a6/);
    await expect(paperTriggerLabel(page)).toHaveText('A6');
    await expect(paperSelector(page)).not.toHaveAttribute('open');
    await expect
      .poll(async () => page.locator('#print-page-size').evaluate((el) => el.textContent ?? ''))
      .toContain('A6');
    await assertSheetSize(page, { width: 105 * MM, height: 148 * MM });
    await assertNoSheetOverflow(page);

    await chooseToolbarOption(page, PAPER_SELECTOR, 'Carta');

    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'letter');
    await expect(page).not.toHaveURL(/papel=/);
    await expect(paperTriggerLabel(page)).toHaveText('Carta');
    await expect(paperSelector(page)).not.toHaveAttribute('open');
    await assertSheetSize(page, { width: 8.5 * 96, height: 11 * 96 });
  });

  test('Escape cierra el menú sin cambiar data-paper-size', async ({ page }) => {
    await page.goto('/formatos/expedientes/');
    const selector = paperSelector(page);

    await selector.locator('summary').click();
    await expect(selector.getByRole('option', { name: 'A5' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'letter');

    await page.keyboard.press('Escape');

    await expect(selector).not.toHaveAttribute('open');
    await expect(selector.getByRole('option', { name: 'A5' })).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'letter');
    await expect(paperTriggerLabel(page)).toHaveText('Carta');
  });

  test('el parámetro papel fuerza el tamaño aunque haya otro guardado', async ({ page }) => {
    await page.goto('/formatos/paciente-rx-tx/?papel=a6');

    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'a6');
    await assertSheetSize(page, { width: 105 * MM, height: 148 * MM });

    await page.goto('/formatos/paciente-rx-tx/?papel=carta');

    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'letter');
    await assertSheetSize(page, { width: 8.5 * 96, height: 11 * 96 });
  });
});

test.describe('Hojas A5 y A6 (todos los formatos)', () => {
  for (const paper of PAPERS.filter((item) => item.id !== 'letter')) {
    for (const format of FORMATS) {
      test(`${format.code} en ${paper.name} no desborda en pantalla ni en print`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: Math.ceil(paper.width) + 48,
          height: Math.ceil(paper.height) + 48,
        });
        await page.goto(`${format.path}${paper.query}`);
        await page.locator('.sheet').waitFor();
        await page.evaluate(() => document.fonts.ready);

        await expect(page.locator('html')).toHaveAttribute('data-paper-size', paper.id);
        await assertSheetSize(page, paper);
        await assertNoSheetOverflow(page);

        await page.emulateMedia({ media: 'print' });

        await expect(page.getByTestId('print-toolbar')).toBeHidden();
        await expect(page.locator('.sheet')).toHaveCount(1);
        await assertSheetSize(page, paper);
        await assertNoSheetOverflow(page);
      });
    }
  }
});
