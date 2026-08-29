import { expect, test, type Page } from '@playwright/test';
import { PAPER_SIZE_STORAGE_KEY, PRINT_EXPORT_STORAGE_KEY } from '../src/lib/print-export/settings';
import {
  SITE_AUTHOR,
  SITE_CONTACT_EMAIL,
  SITE_LEGAL_UPDATED_AT,
} from '../src/lib/site-config';

const LEGAL_PATHS = [
  '/aviso-legal/',
  '/politica-de-privacidad/',
  '/cookies/',
  '/preguntas-frecuentes/',
] as const;

const CLIENT_ANALYTICS_SRC = /googletagmanager|analytics\.js|umami|plausible|gtag/i;

async function assertNoClientAnalyticsScripts(page: Page) {
  const sources = await page.locator('script[src]').evaluateAll((nodes) =>
    nodes
      .map((node) => (node instanceof HTMLScriptElement ? node.getAttribute('src') : null))
      .filter((src): src is string => Boolean(src)),
  );

  for (const src of sources) {
    expect(src, src).not.toMatch(CLIENT_ANALYTICS_SRC);
  }
}

async function assertLegalChrome(page: Page) {
  await expect(page.locator('h1')).toHaveCount(1);
  const title = await page.title();
  expect(title.trim().length, 'title').toBeGreaterThan(0);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description?.trim().length, 'description').toBeGreaterThan(0);
  await expect(page.getByText(SITE_LEGAL_UPDATED_AT).first()).toBeVisible();
  await expect(page.getByRole('link', { name: SITE_CONTACT_EMAIL }).first()).toBeVisible();
  await expect(page.getByText(`Responsable: ${SITE_AUTHOR}`, { exact: true })).toBeVisible();

  for (const href of LEGAL_PATHS) {
    expect(await page.locator(`a[href="${href}"]`).count(), href).toBeGreaterThan(0);
  }

  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('#cookie-banner')).toHaveCount(0);
  await expect(page.getByText(/aceptar cookies/i)).toHaveCount(0);
  await assertNoClientAnalyticsScripts(page);
}

test.describe('Páginas legales', () => {
  for (const path of LEGAL_PATHS) {
    test(`${path} responde y tiene cromo legal mínimo`, async ({ page, request }) => {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);

      const navigation = await page.goto(path);
      expect(navigation?.ok(), path).toBe(true);
      await expect(page.locator('.legal-page')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'es-ES');
      await expect(page.getByRole('link', { name: 'Volver al catálogo' })).toBeVisible();
      await assertLegalChrome(page);
    });
  }

  test('aviso legal cubre identificación, Apache, IA/LLM, homologación y ley española', async ({
    page,
  }) => {
    await page.goto('/aviso-legal/');

    await expect(page.getByRole('heading', { level: 1, name: 'Aviso legal' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Identificación y contacto' }),
    ).toBeVisible();
    await expect(page.getByText('Apache-2.0').first()).toBeVisible();
    await expect(page.getByText('IA/LLM').first()).toBeVisible();
    await expect(page.getByText(/homologación/i).first()).toBeVisible();
    await expect(page.getByText('cualquier país').first()).toBeVisible();
    await expect(page.getByText(/uso inadecuado/i).first()).toBeVisible();
    await expect(page.getByText('legislación española').first()).toBeVisible();
  });

  test('privacidad cubre responsable, clínica, PDF, Netlify, RGPD, AEPD y Umami futuro', async ({
    page,
  }) => {
    await page.goto('/politica-de-privacidad/');

    await expect(
      page.getByRole('heading', { name: 'Responsable del tratamiento' }),
    ).toBeVisible();
    await expect(page.getByText('captura directa de datos clínicos').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tratamiento local del PDF' })).toBeVisible();
    await expect(
      page.getByText('Netlify Web Analytics es la analítica activa de este sitio'),
    ).toBeVisible();
    await expect(page.getByText(/RGPD/).first()).toBeVisible();
    await expect(page.getByText('AEPD').first()).toBeVisible();
    await expect(page.getByText('Umami no está integrado').first()).toBeVisible();
    await expect(page.getByText('no está activo').first()).toBeVisible();
  });

  test('cookies declara ausencia, Netlify, claves locales, borrado y consentimiento', async ({
    page,
  }) => {
    await page.goto('/cookies/');

    await expect(page.getByText('no utiliza cookies').first()).toBeVisible();
    await expect(page.getByText(/Netlify Web Analytics/).first()).toBeVisible();
    await expect(page.getByText(/sin cookies/).first()).toBeVisible();
    await expect(page.getByText(PAPER_SIZE_STORAGE_KEY).first()).toBeVisible();
    await expect(page.getByText(PRINT_EXPORT_STORAGE_KEY).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Cómo borrar/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /consentimiento/i })).toBeVisible();
    await expect(page.getByText('Umami no está integrado').first()).toBeVisible();
  });

  test('FAQ usa details nativos y cubre los temas pedidos', async ({ page }) => {
    await page.goto('/preguntas-frecuentes/');

    const items = page.locator('.legal-page details');
    await expect(items).toHaveCount(16);

    const summaries = page.locator('.legal-page details summary');
    await expect(summaries.getByText(/gratuito/i)).toHaveCount(1);
    await expect(summaries.getByText(/Apache-2\.0/i)).toHaveCount(1);
    await expect(summaries.getByText(/modificar y redistribuir/i)).toHaveCount(1);
    await expect(summaries.getByText(/fines comerciales/i)).toHaveCount(1);
    await expect(summaries.getByText(/cualquier país/i)).toHaveCount(1);
    await expect(summaries.getByText(/IA\/LLM/i)).toHaveCount(1);
    await expect(summaries.getByText(/revisión odontológica/i)).toHaveCount(1);
    await expect(summaries.getByText(/homologadas/i)).toHaveCount(1);
    await expect(summaries.getByText(/datos de los pacientes/i)).toHaveCount(1);
    await expect(summaries.getByText(/PDF/i)).toHaveCount(1);
    await expect(summaries.getByText(/cookies/i)).toHaveCount(1);
    await expect(summaries.getByText(/Netlify o Umami/i)).toHaveCount(1);
    await expect(summaries.getByText(/GitHub/i)).toHaveCount(1);
    await expect(summaries.getByText(/soporte/i)).toHaveCount(1);
    await expect(summaries.getByText(/garantía/i)).toHaveCount(1);
    await expect(summaries.getByText(/desaparecer/i)).toHaveCount(1);

    await summaries.getByText(/Netlify o Umami/i).click();
    const analytics = page.locator('.legal-page details[open]');
    await expect(analytics).toContainText(
      'Netlify Web Analytics es la analítica activa de este sitio',
    );
    await expect(analytics).toContainText('Umami no está integrado');
  });

  test('UsageNotice visible en el catálogo, con enlace al aviso, y ausente en un formato', async ({
    page,
  }) => {
    await page.goto('/');

    const notice = page.locator('.usage-notice');
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('link', { name: /aviso legal/i })).toHaveAttribute(
      'href',
      '/aviso-legal/',
    );
    await expect(notice.getByText(/plantilla no homologada/i)).toBeVisible();
    await expect(notice.getByText(/IA\/LLM/)).toBeVisible();

    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();
    await expect(page.locator('.usage-notice')).toHaveCount(0);
    await expect(page.locator('.sheet .usage-notice')).toHaveCount(0);
  });
});
