import { expect, test, type Page } from '@playwright/test';

/** Carta a 96 dpi: 215,9 × 279,4 mm → 8,5 × 11 in → 816 × 1056 CSS px. */
const LETTER = { width: 816, height: 1056 };
const SIZE_TOLERANCE_PX = 2;

const FORMATS = [
  { path: '/formatos/expedientes/', code: 'ODO-F01' },
  { path: '/formatos/paciente-rx-tx/', code: 'ODO-F02' },
  { path: '/formatos/eventos/', code: 'ODO-F03' },
  { path: '/formatos/paciente-imagen/', code: 'ODO-F04' },
] as const;

async function preparePrintSheet(page: Page, path: string) {
  await page.setViewportSize(LETTER);
  await page.goto(path);
  await page.locator('.sheet').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

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

test.describe('Modo print', () => {
  test('el catálogo permanece oculto en media print', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.catalog')).toBeVisible();

    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('.catalog')).toBeHidden();
    await expect(page.locator('body.is-catalog')).toBeHidden();
  });

  for (const format of FORMATS) {
    test(`${format.code} oculta la barra, fija Carta al 100 % y no desborda`, async ({
      page,
    }) => {
      await preparePrintSheet(page, format.path);

      await expect(page.locator('.print-toolbar')).toBeVisible();
      const printHide = page.locator('[data-print-hide]');
      const printHideCount = await printHide.count();
      expect(printHideCount).toBeGreaterThan(0);
      for (let i = 0; i < printHideCount; i += 1) {
        await expect(printHide.nth(i)).toBeVisible();
      }

      await page.emulateMedia({ media: 'print' });

      await expect(page.locator('.print-toolbar')).toBeHidden();
      for (let i = 0; i < printHideCount; i += 1) {
        await expect(printHide.nth(i)).toBeHidden();
      }
      await expect(page.locator('.sheet')).toBeVisible();
      await expect(page.locator('.sheet')).toHaveCount(1);

      const box = await page.locator('.sheet').evaluate((el) => {
        const styles = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          cssWidth: Number.parseFloat(styles.width),
          cssHeight: Number.parseFloat(styles.height),
          transform: styles.transform,
          zoom: styles.getPropertyValue('zoom'),
          boxShadow: styles.boxShadow,
          borderTopStyle: styles.borderTopStyle,
        };
      });

      expect(box.width).toBeGreaterThanOrEqual(LETTER.width - SIZE_TOLERANCE_PX);
      expect(box.width).toBeLessThanOrEqual(LETTER.width + SIZE_TOLERANCE_PX);
      expect(box.height).toBeGreaterThanOrEqual(LETTER.height - SIZE_TOLERANCE_PX);
      expect(box.height).toBeLessThanOrEqual(LETTER.height + SIZE_TOLERANCE_PX);
      expect(box.cssWidth).toBeGreaterThanOrEqual(LETTER.width - SIZE_TOLERANCE_PX);
      expect(box.cssWidth).toBeLessThanOrEqual(LETTER.width + SIZE_TOLERANCE_PX);
      expect(box.cssHeight).toBeGreaterThanOrEqual(LETTER.height - SIZE_TOLERANCE_PX);
      expect(box.cssHeight).toBeLessThanOrEqual(LETTER.height + SIZE_TOLERANCE_PX);
      expect(box.transform === 'none' || box.transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(
        true,
      );
      expect(box.zoom === '' || box.zoom === '1' || box.zoom === 'normal').toBe(true);
      expect(box.boxShadow === 'none' || box.boxShadow === '').toBe(true);

      const panelBorder = await page.locator('.outlined-panel').first().evaluate((el) => {
        const styles = getComputedStyle(el);
        return {
          style: styles.borderTopStyle,
          width: Number.parseFloat(styles.borderTopWidth),
          color: styles.borderTopColor,
        };
      });
      expect(panelBorder.style).not.toBe('none');
      expect(panelBorder.width).toBeGreaterThan(0);

      await assertNoSheetOverflow(page);
    });
  }

  test('ODO-F04 conserva siglas y patrones de leyenda en print', async ({ page }) => {
    await preparePrintSheet(page, '/formatos/paciente-imagen/');
    await page.emulateMedia({ media: 'print' });

    const markers = page.locator('[data-testid="legend-marker"]');
    await expect(markers).toHaveCount(4);
    await expect(markers).toContainText(['R', 'A', 'V', 'O']);

    const patterns = await markers.evaluateAll((nodes) =>
      nodes.map((node) => {
        const swatch = node.querySelector('.legend-marker__swatch');
        if (!(swatch instanceof HTMLElement)) {
          return null;
        }
        const styles = getComputedStyle(swatch);
        return {
          variant: node.getAttribute('data-variant'),
          backgroundImage: styles.backgroundImage,
          backgroundColor: styles.backgroundColor,
          borderStyle: styles.borderStyle,
        };
      }),
    );

    const rojo = patterns.find((item) => item?.variant === 'rojo');
    const azul = patterns.find((item) => item?.variant === 'azul');
    const verde = patterns.find((item) => item?.variant === 'verde');
    const otro = patterns.find((item) => item?.variant === 'otro');

    expect(rojo?.backgroundImage === 'none' || rojo?.backgroundImage === '').toBe(true);
    expect(rojo?.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(azul?.backgroundImage).toContain('repeating-linear-gradient');
    expect(verde?.backgroundImage).toContain('radial-gradient');
    expect(otro?.backgroundImage === 'none' || otro?.backgroundImage === '').toBe(true);
    expect(otro?.borderStyle).not.toBe('none');
  });
});

test.describe('Snapshots visuales (Chromium, media print)', () => {
  for (const format of FORMATS) {
    test(`${format.code} hoja Carta`, async ({ page }) => {
      await preparePrintSheet(page, format.path);
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.print-toolbar')).toBeHidden();

      await expect(page.locator('.sheet')).toHaveScreenshot(
        `${format.code.toLowerCase()}-sheet.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixelRatio: 0.03,
        },
      );
    });
  }
});
