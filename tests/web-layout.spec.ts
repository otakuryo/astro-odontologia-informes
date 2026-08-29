import { expect, test } from '@playwright/test';

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

    for (const path of FORMAT_PATHS) {
      await expect(page.locator(`.catalog a[href="${path}"]`)).toBeVisible();
    }

    await expect(page.locator('.catalog a[href^="/formatos/"]')).toHaveCount(4);
  });

  test('en un formato: radiogroup, imprimir y enlace a inicio visibles', async ({ page }) => {
    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();

    await expect(page.getByTestId('print-toolbar')).toBeVisible();
    await expect(page.getByTestId('paper-size-selector')).toBeVisible();
    await expect(page.getByRole('radiogroup')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimir hoja' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Formatos odontológicos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Formatos odontológicos' })).toHaveAttribute(
      'href',
      '/',
    );
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
