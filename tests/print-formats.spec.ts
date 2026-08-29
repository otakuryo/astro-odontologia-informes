import { expect, test, type Page } from '@playwright/test';

const LETTER = { width: 816, height: 1056 };

const FORMATS = [
  {
    path: '/formatos/expedientes/',
    title: 'Expedientes · ODO-F01',
    code: 'ODO-F01',
  },
  {
    path: '/formatos/paciente-rx-tx/',
    title: 'Paciente Rx Tx · ODO-F02',
    code: 'ODO-F02',
  },
  {
    path: '/formatos/eventos/',
    title: 'Eventos · ODO-F03',
    code: 'ODO-F03',
  },
  {
    path: '/formatos/paciente-imagen/',
    title: 'Paciente imagen · ODO-F04',
    code: 'ODO-F04',
  },
] as const;

const SHARED_FIELDS = [
  'Clínica / profesional',
  'Paciente',
  'Folio / expediente',
  'Fecha',
] as const;

const FORBIDDEN_COPY = [
  'elemento adicional',
  'elemento inferior',
  'círculos conectados',
  'circulos conectados',
  'odontograma',
  'pendiente de validación',
  'pendiente de validacion',
];

async function assertNoSheetOverflow(page: Page) {
  await page.setViewportSize(LETTER);

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

test.describe('Rutas HTTP y títulos', () => {
  test('el catálogo responde 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle('Formatos odontológicos imprimibles');
  });

  for (const format of FORMATS) {
    test(`${format.code} responde 200 y usa el título del layout`, async ({ page }) => {
      const response = await page.goto(format.path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(format.title);
    });
  }
});

test.describe('Documentos de formato', () => {
  for (const format of FORMATS) {
    test(`${format.code} tiene una sola hoja, identificación y campos compartidos`, async ({
      page,
    }) => {
      await page.goto(format.path);

      await expect(page.locator('.sheet')).toHaveCount(1);
      await expect(page.getByText(format.code, { exact: true })).toBeVisible();
      await expect(page.getByText('REV. 01', { exact: true })).toBeVisible();
      await expect(page.getByText('1/1', { exact: true })).toBeVisible();

      for (const field of SHARED_FIELDS) {
        await expect(page.getByText(field, { exact: true })).toBeVisible();
      }
    });

    test(`${format.code} no presenta el diagrama adicional ni overflow en Carta`, async ({
      page,
    }) => {
      await page.goto(format.path);

      const bodyText = (await page.locator('body').innerText()).toLowerCase();
      for (const phrase of FORBIDDEN_COPY) {
        expect(bodyText, `no debe aparecer «${phrase}»`).not.toContain(phrase);
      }

      await assertNoSheetOverflow(page);
    });
  }

  test('ODO-F01 conserva EXPEDIENTES, FOLIOS y cinco filas', async ({ page }) => {
    await page.goto('/formatos/expedientes/');

    await expect(page.getByText('EXPEDIENTES', { exact: true })).toBeVisible();
    await expect(page.getByText('FOLIOS', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="folio-row"]')).toHaveCount(5);
    await expect(page.locator('[data-testid="rx-cell"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="evento-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="legend-marker"]')).toHaveCount(0);
  });

  test('ODO-F02 conserva PACIENTE, Rx, Tx, NOTAS y recuentos', async ({ page }) => {
    await page.goto('/formatos/paciente-rx-tx/');

    await expect(page.getByRole('heading', { name: 'PACIENTE', exact: true })).toBeVisible();
    await expect(page.getByText('Rx', { exact: true })).toBeVisible();
    await expect(page.getByText('Tx', { exact: true })).toBeVisible();
    await expect(page.getByText('NOTAS', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="rx-cell"]')).toHaveCount(6);
    await expect(page.locator('[data-testid="nota-line"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="superior"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="inferior"]')).toHaveCount(1);
    await expect(page.locator('[data-slot^="lat-"]')).toHaveCount(4);
  });

  test('ODO-F02 dispone las casillas Rx en cruz (superior, laterales, inferior)', async ({
    page,
  }) => {
    await page.goto('/formatos/paciente-rx-tx/');

    const layout = await page.locator('.rx-grid').evaluate((grid) => {
      const styles = getComputedStyle(grid);
      const cell = (slot: string) => {
        const el = grid.querySelector(`[data-slot="${slot}"]`);
        if (!(el instanceof HTMLElement)) {
          return null;
        }
        const rect = el.getBoundingClientRect();
        return {
          cx: rect.x + rect.width / 2,
          cy: rect.y + rect.height / 2,
          left: rect.left,
          right: rect.right,
        };
      };

      return {
        columns: styles.gridTemplateColumns.split(' ').filter(Boolean).length,
        rows: styles.gridTemplateRows.split(' ').filter(Boolean).length,
        superior: cell('superior'),
        inferior: cell('inferior'),
        l1: cell('lat-izq-1'),
        l2: cell('lat-izq-2'),
        r1: cell('lat-der-1'),
        r2: cell('lat-der-2'),
      };
    });

    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(3);
    expect(layout.superior).not.toBeNull();
    expect(layout.inferior).not.toBeNull();
    expect(layout.l1).not.toBeNull();
    expect(layout.r2).not.toBeNull();

    expect(layout.superior!.cy).toBeLessThan(layout.l1!.cy);
    expect(layout.inferior!.cy).toBeGreaterThan(layout.l1!.cy);
    expect(Math.abs(layout.superior!.cx - layout.inferior!.cx)).toBeLessThan(2);

    expect(layout.l1!.right).toBeLessThan(layout.superior!.cx);
    expect(layout.l2!.right).toBeLessThan(layout.superior!.cx);
    expect(layout.r1!.left).toBeGreaterThan(layout.superior!.cx);
    expect(layout.r2!.left).toBeGreaterThan(layout.superior!.cx);
    expect(layout.l1!.left).toBeLessThan(layout.l2!.left);
    expect(layout.r1!.left).toBeLessThan(layout.r2!.left);
  });

  test('ODO-F03 conserva EVENTOS y cuatro paneles 01–04', async ({ page }) => {
    await page.goto('/formatos/eventos/');

    await expect(page.getByText('EVENTOS', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="evento-panel"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="evento-panel"]')).toHaveText(['01', '02', '03', '04']);
  });

  test('ODO-F04 conserva PACIENTE, IMAGEN y las cuatro leyendas', async ({ page }) => {
    await page.goto('/formatos/paciente-imagen/');

    await expect(page.getByRole('heading', { name: 'PACIENTE', exact: true })).toBeVisible();
    await expect(page.getByText('IMAGEN', { exact: true })).toBeVisible();
    await expect(page.getByText('Rojo', { exact: true })).toBeVisible();
    await expect(page.getByText('Azul', { exact: true })).toBeVisible();
    await expect(page.getByText('Verde', { exact: true })).toBeVisible();
    await expect(page.getByText('Otro', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="legend-marker"]')).toHaveCount(4);
  });
});
