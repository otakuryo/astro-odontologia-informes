import { expect, test, type Page } from '@playwright/test';
import {
  SITE_AUTHOR,
  SITE_CONTACT_EMAIL,
  SITE_LICENSE,
} from '../src/lib/site-config';
import { SITE_NAME } from '../src/lib/site';

const LEGAL_HREFS = [
  '/aviso-legal/',
  '/politica-de-privacidad/',
  '/cookies/',
  '/preguntas-frecuentes/',
] as const;

const FORMAT_PATHS = [
  '/formatos/expedientes/',
  '/formatos/paciente-rx-tx/',
  '/formatos/eventos/',
  '/formatos/paciente-imagen/',
] as const;

test.describe('Cromo web (daisyUI)', () => {
  test('el índice tiene 4 enlaces a las rutas de formato', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.catalog')).toBeVisible();
    await expect(page.locator('body.is-catalog')).toBeVisible();
    await expect(page.locator('.catalog__logo')).toBeVisible();

    for (const path of FORMAT_PATHS) {
      await expect(page.locator(`.catalog a[href="${path}"]`)).toBeVisible();
    }

    await expect(page.locator('.catalog a[href^="/formatos/"]')).toHaveCount(4);
    await expect(page.locator('a[href^="/formatos/"]')).toHaveCount(4);
  });

  test('en un formato: radiogroup, imprimir y enlace a inicio visibles', async ({ page }) => {
    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();

    await expect(page.getByTestId('print-toolbar')).toBeVisible();
    await expect(page.getByTestId('paper-size-selector')).toBeVisible();
    await expect(page.getByRole('radiogroup')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimir hoja' })).toBeVisible();
    await expect(page.getByRole('link', { name: SITE_NAME })).toBeVisible();
    await expect(page.getByRole('link', { name: SITE_NAME })).toHaveAttribute('href', '/');
    await expect(page.locator('.print-toolbar__brand img')).toHaveCSS('height', '24px');
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveCount(0);
  });

  test('emulateMedia print oculta .web-chrome y deja .sheet', async ({ page }) => {
    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();

    await expect(page.locator('.web-chrome')).toBeVisible();
    await expect(page.locator('.sheet')).toBeVisible();

    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('.web-chrome')).toBeHidden();
    await expect(page.locator('.navbar')).toBeHidden();
    await expect(page.locator('.print-toolbar')).toBeHidden();
    await expect(page.locator('.sheet')).toBeVisible();
    await expect(page.locator('.sheet')).toHaveCount(1);

    const printHide = page.locator('[data-print-hide]');
    const printHideCount = await printHide.count();
    expect(printHideCount).toBeGreaterThan(0);
    for (let i = 0; i < printHideCount; i += 1) {
      await expect(printHide.nth(i)).toBeHidden();
    }
    await expect(page.locator('.site-footer')).toBeHidden();
  });

  test('cambiar el papel no altera el tamaño del cromo de configuración', async ({ page }) => {
    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();

    const measure = async () => {
      const toolbar = await page.getByTestId('print-toolbar').boundingBox();
      const printButton = await page.getByRole('button', { name: 'Imprimir hoja' }).boundingBox();
      const carta = await page.getByRole('radio', { name: 'Carta' }).boundingBox();

      return { toolbar, printButton, carta };
    };

    const letter = await measure();

    await page.getByRole('radio', { name: 'A6' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-paper-size', 'a6');

    const a6 = await measure();

    expect(letter.toolbar, 'barra en Carta').not.toBeNull();
    expect(a6.toolbar, 'barra en A6').not.toBeNull();
    expect(letter.printButton, 'imprimir en Carta').not.toBeNull();
    expect(a6.printButton, 'imprimir en A6').not.toBeNull();
    expect(letter.carta, 'Carta en Carta').not.toBeNull();
    expect(a6.carta, 'Carta en A6').not.toBeNull();

    const delta = 2;
    expect(Math.abs(a6.toolbar!.width - letter.toolbar!.width)).toBeLessThan(delta);
    expect(Math.abs(a6.toolbar!.height - letter.toolbar!.height)).toBeLessThan(delta);
    expect(Math.abs(a6.printButton!.width - letter.printButton!.width)).toBeLessThan(delta);
    expect(Math.abs(a6.printButton!.height - letter.printButton!.height)).toBeLessThan(delta);
    expect(Math.abs(a6.carta!.width - letter.carta!.width)).toBeLessThan(delta);
    expect(Math.abs(a6.carta!.height - letter.carta!.height)).toBeLessThan(delta);
  });
});

test.describe('Pie legal permanente', () => {
  test('el pie está en / y en un formato, con autor, correo, licencia y rutas legales', async ({
    page,
  }) => {
    for (const path of ['/', '/formatos/expedientes/'] as const) {
      await page.goto(path);
      if (path !== '/') {
        await page.locator('.sheet').waitFor();
      }

      const footer = page.locator('.site-footer');
      await expect(footer).toBeVisible();
      await expect(footer.getByText(`Responsable: ${SITE_AUTHOR}`, { exact: true })).toBeVisible();
      await expect(footer.getByRole('link', { name: SITE_CONTACT_EMAIL })).toBeVisible();
      await expect(footer.getByRole('link', { name: SITE_CONTACT_EMAIL })).toHaveAttribute(
        'href',
        `mailto:${SITE_CONTACT_EMAIL}`,
      );
      await expect(footer.getByText(SITE_LICENSE)).toBeVisible();

      for (const href of LEGAL_HREFS) {
        await expect(footer.locator(`a[href="${href}"]`)).toBeVisible();
      }
    }
  });

  test('al imprimir el catálogo el pie queda oculto', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-footer')).toBeVisible();

    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('.site-footer')).toBeHidden();
    const printHide = page.locator('[data-print-hide]');
    const count = await printHide.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(printHide.nth(i)).toBeHidden();
    }
  });
});

const NARROW = { width: 390, height: 844 } as const;

async function assertNoHorizontalClip(
  page: Page,
  box: { x: number; y: number; width: number; height: number } | null,
) {
  const viewport = page.viewportSize();
  expect(box, 'caja visible').not.toBeNull();
  expect(viewport, 'viewport').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

test.describe('Cromo web en viewport estrecho (390×844)', () => {
  test('el meta incluye initial-scale=1 y html computa 16px', async ({ page }) => {
    await page.setViewportSize(NARROW);

    for (const path of ['/', '/formatos/expedientes/'] as const) {
      await page.goto(path);
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
        'content',
        /(?:^|,\s*)initial-scale=1(?:\s*,|$)/,
      );
      await expect(page.locator('html')).toHaveCSS('font-size', '16px');
    }
  });

  test('el documento no desborda en horizontal en / ni en un formato', async ({ page }) => {
    await page.setViewportSize(NARROW);

    for (const path of ['/', '/formatos/expedientes/'] as const) {
      await page.goto(path);
      if (path !== '/') {
        await page.locator('.sheet').waitFor();
      }

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      expect(metrics.scrollWidth, path).toBeLessThanOrEqual(metrics.innerWidth + 1);
    }
  });

  test('los enlaces del catálogo se ven sin recorte horizontal', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto('/');

    for (const path of FORMAT_PATHS) {
      const link = page.locator(`.catalog a[href="${path}"]`);
      await expect(link).toBeVisible();
      assertNoHorizontalClip(page, await link.boundingBox());
    }
  });

  test('barra, radiogroup, imprimir y catálogo accesibles; sin Home ni recorte', async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();

    await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveCount(0);

    const toolbar = page.getByTestId('print-toolbar');
    const radiogroup = page.getByRole('radiogroup');
    const printButton = page.getByRole('button', { name: 'Imprimir hoja' });
    const catalogLink = page.getByRole('link', { name: SITE_NAME });

    await expect(toolbar).toBeVisible();
    await expect(radiogroup).toBeVisible();
    await expect(printButton).toBeVisible();
    await expect(catalogLink).toBeVisible();
    await expect(catalogLink).toHaveAttribute('href', '/');

    assertNoHorizontalClip(page, await toolbar.boundingBox());
    assertNoHorizontalClip(page, await radiogroup.boundingBox());
    assertNoHorizontalClip(page, await printButton.boundingBox());
    assertNoHorizontalClip(page, await catalogLink.boundingBox());

    const controls = [
      catalogLink,
      radiogroup,
      page.getByTestId('download-pdf'),
      printButton,
      page.getByTestId('export-options'),
    ];
    const boxes = [];
    for (const control of controls) {
      await expect(control).toBeVisible();
      boxes.push(await control.boundingBox());
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        expect(a, `caja ${i}`).not.toBeNull();
        expect(b, `caja ${j}`).not.toBeNull();
        const overlapX = a!.x < b!.x + b!.width - 1 && a!.x + a!.width > b!.x + 1;
        const overlapY = a!.y < b!.y + b!.height - 1 && a!.y + a!.height > b!.y + 1;
        expect(overlapX && overlapY, `solape ${i} vs ${j}`).toBe(false);
      }
    }
  });

  test('el pie legal no desborda en horizontal en / ni en un formato', async ({ page }) => {
    await page.setViewportSize(NARROW);

    for (const path of ['/', '/formatos/expedientes/'] as const) {
      await page.goto(path);
      if (path !== '/') {
        await page.locator('.sheet').waitFor();
      }

      const footer = page.locator('.site-footer');
      await expect(footer).toBeVisible();
      await assertNoHorizontalClip(page, await footer.boundingBox());
    }
  });

  test('el modal de exportación cabe en 390 px y el join no desborda', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();

    await page.getByTestId('export-options').click();
    await expect(page.getByTestId('export-panel')).toBeVisible();

    const modalBox = page.locator('.modal-box');
    await expect(modalBox).toBeVisible();
    assertNoHorizontalClip(page, await modalBox.boundingBox());

    const paperJoin = page.getByTestId('export-paper').locator('.join');
    await expect(paperJoin).toBeVisible();
    const joinBox = await paperJoin.boundingBox();
    const box = await modalBox.boundingBox();
    expect(joinBox, 'join de papel').not.toBeNull();
    expect(box, 'modal-box').not.toBeNull();
    expect(joinBox!.x).toBeGreaterThanOrEqual(box!.x - 1);
    expect(joinBox!.x + joinBox!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);

    const overflow = await modalBox.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(overflow, 'contenido del modal sin desborde horizontal').toBe(true);

    for (const label of ['Carta', 'A4', 'A5', 'A6'] as const) {
      await expect(page.getByTestId('export-paper').getByRole('button', { name: label })).toBeVisible();
    }
  });
});

/** Carta a 96 dpi: 8,5 in → 816 CSS px. La hoja no se remaqueta; la preview sí escala. */
const LETTER_WIDTH_PX = 8.5 * 96;
const SIZE_TOLERANCE_PX = 2;
const TABLET = { width: 768, height: 1024 } as const;

async function measureSheetPreview(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const scaler = document.querySelector('.sheet-preview__scaler');
    if (!(sheet instanceof HTMLElement) || !(scaler instanceof HTMLElement)) {
      return null;
    }

    const bodyStyles = getComputedStyle(document.body);
    const padLeft = Number.parseFloat(bodyStyles.paddingLeft) || 0;
    const padRight = Number.parseFloat(bodyStyles.paddingRight) || 0;
    const sheetRect = sheet.getBoundingClientRect();
    const scalerRect = scaler.getBoundingClientRect();

    return {
      offsetWidth: sheet.offsetWidth,
      sheetRectWidth: sheetRect.width,
      scalerRectWidth: scalerRect.width,
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      padLeft,
      padRight,
      transform: getComputedStyle(sheet).transform,
    };
  });
}

test.describe('Preview de hoja a escala', () => {
  test('en 390 px offsetWidth sigue ~816 px y el rectángulo visual cabe', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();

    await expect(page.locator('.sheet-preview')).toHaveCount(1);
    await expect(page.locator('.sheet-preview__scaler')).toHaveCount(1);

    const metrics = await measureSheetPreview(page);
    expect(metrics, 'preview medible').not.toBeNull();

    expect(metrics!.offsetWidth).toBeGreaterThanOrEqual(LETTER_WIDTH_PX - SIZE_TOLERANCE_PX);
    expect(metrics!.offsetWidth).toBeLessThanOrEqual(LETTER_WIDTH_PX + SIZE_TOLERANCE_PX);
    expect(metrics!.transform === 'none').toBe(false);

    const available = metrics!.innerWidth - metrics!.padLeft - metrics!.padRight;
    expect(metrics!.sheetRectWidth).toBeLessThanOrEqual(available + 1);
    expect(metrics!.scalerRectWidth).toBeLessThanOrEqual(available + 1);
    expect(metrics!.scrollWidth).toBeLessThanOrEqual(metrics!.innerWidth + 1);
  });

  test('en 768 px la hoja cabe a lo ancho sin scroll horizontal de documento', async ({ page }) => {
    await page.setViewportSize(TABLET);
    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();

    const metrics = await measureSheetPreview(page);
    expect(metrics, 'preview medible').not.toBeNull();

    expect(metrics!.offsetWidth).toBeGreaterThanOrEqual(LETTER_WIDTH_PX - SIZE_TOLERANCE_PX);
    expect(metrics!.offsetWidth).toBeLessThanOrEqual(LETTER_WIDTH_PX + SIZE_TOLERANCE_PX);

    const available = metrics!.innerWidth - metrics!.padLeft - metrics!.padRight;
    expect(metrics!.sheetRectWidth).toBeLessThanOrEqual(available + 1);
    expect(metrics!.scalerRectWidth).toBeLessThanOrEqual(available + 1);
    expect(metrics!.scrollWidth).toBeLessThanOrEqual(metrics!.innerWidth + 1);
  });

  test('tras emulateMedia print, .sheet vuelve al tamaño de papel', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();

    const screen = await measureSheetPreview(page);
    expect(screen, 'preview medible').not.toBeNull();
    expect(screen!.sheetRectWidth).toBeLessThan(LETTER_WIDTH_PX - SIZE_TOLERANCE_PX);

    await page.emulateMedia({ media: 'print' });

    const printed = await page.locator('.sheet').evaluate((el) => {
      const styles = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const preview = document.querySelector('.sheet-preview');
      const scaler = document.querySelector('.sheet-preview__scaler');
      const previewStyles = preview ? getComputedStyle(preview) : null;
      const scalerStyles = scaler ? getComputedStyle(scaler) : null;
      return {
        width: rect.width,
        height: rect.height,
        transform: styles.transform,
        zoom: styles.getPropertyValue('zoom'),
        previewTransform: previewStyles?.transform ?? '',
        scalerTransform: scalerStyles?.transform ?? '',
        previewOverflow: previewStyles?.overflow ?? '',
        scalerOverflow: scalerStyles?.overflow ?? '',
      };
    });

    expect(printed.width).toBeGreaterThanOrEqual(LETTER_WIDTH_PX - SIZE_TOLERANCE_PX);
    expect(printed.width).toBeLessThanOrEqual(LETTER_WIDTH_PX + SIZE_TOLERANCE_PX);
    expect(printed.height).toBeGreaterThanOrEqual(1056 - SIZE_TOLERANCE_PX);
    expect(printed.height).toBeLessThanOrEqual(1056 + SIZE_TOLERANCE_PX);
    expect(printed.transform === 'none' || printed.transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(
      true,
    );
    expect(printed.zoom === '' || printed.zoom === '1' || printed.zoom === 'normal').toBe(true);
    expect(
      printed.previewTransform === 'none' || printed.previewTransform === 'matrix(1, 0, 0, 1, 0, 0)',
    ).toBe(true);
    expect(
      printed.scalerTransform === 'none' || printed.scalerTransform === 'matrix(1, 0, 0, 1, 0, 0)',
    ).toBe(true);
    expect(printed.previewOverflow === 'visible' || printed.previewOverflow === '').toBe(true);
    expect(printed.scalerOverflow === 'visible' || printed.scalerOverflow === '').toBe(true);
  });
});
