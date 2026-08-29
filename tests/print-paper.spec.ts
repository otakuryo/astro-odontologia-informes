import { expect, test, type Page } from '@playwright/test';

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

test.describe('Selector de formato de impresión', () => {
  test('muestra Carta, A5 y A6 y parte de Carta', async ({ page }) => {
    await page.goto('/formatos/expedientes/');

    await expect(page.getByTestId('paper-size-selector')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Carta' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'A5' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'A6' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'letter');
    await expect(page.getByRole('radio', { name: 'Carta' })).toHaveAttribute('aria-checked', 'true');
  });

  test('A5 y A6 redimensionan la hoja y persisten entre formatos', async ({ page }) => {
    await page.goto('/formatos/expedientes/');

    await page.getByRole('radio', { name: 'A5' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'a5');
    await expect(page.getByRole('radio', { name: 'A5' })).toHaveAttribute('aria-checked', 'true');
    await expect(page).toHaveURL(/papel=a5/);
    await expect
      .poll(async () => page.locator('#print-page-size').evaluate((el) => el.textContent ?? ''))
      .toContain('A5');
    await assertSheetSize(page, { width: 148 * MM, height: 210 * MM });
    await assertNoSheetOverflow(page);

    await page.goto('/formatos/eventos/');

    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'a5');
    await expect(page.getByRole('radio', { name: 'A5' })).toHaveAttribute('aria-checked', 'true');
    await assertSheetSize(page, { width: 148 * MM, height: 210 * MM });

    await page.getByRole('radio', { name: 'A6' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'a6');
    await expect(page).toHaveURL(/papel=a6/);
    await expect
      .poll(async () => page.locator('#print-page-size').evaluate((el) => el.textContent ?? ''))
      .toContain('A6');
    await assertSheetSize(page, { width: 105 * MM, height: 148 * MM });
    await assertNoSheetOverflow(page);

    await page.getByRole('radio', { name: 'Carta' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'letter');
    await expect(page).not.toHaveURL(/papel=/);
    await assertSheetSize(page, { width: 8.5 * 96, height: 11 * 96 });
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
