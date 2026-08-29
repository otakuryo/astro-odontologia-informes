import { expect, test } from '@playwright/test';
import {
  FAQ_ITEMS,
  SITE_DEFINITION,
  SITE_DESCRIPTION,
  SITE_H1,
  SITE_TITLE,
  seoForFormat,
} from '../src/lib/site';

function jsonLdGraph(raw: string | null) {
  expect(raw, 'JSON-LD presente').not.toBeNull();
  const data = JSON.parse(raw!) as { '@graph'?: Array<{ '@type'?: string }> };
  expect(Array.isArray(data['@graph']), '@graph').toBe(true);
  return data['@graph']!;
}

test.describe('SEO del catálogo y de un formato', () => {
  test('en /: título, description, canonical, iconos, describedby y JSON-LD', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(SITE_TITLE);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      SITE_DESCRIPTION,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$/);
    await expect(page.locator('link[rel="icon"][href="/favicon.ico"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"][href="/favicon.png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="describedby"]')).toHaveAttribute('href', '/llms.txt');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      'width=device-width, initial-scale=1',
    );

    const graph = jsonLdGraph(
      await page.locator('script[type="application/ld+json"]').textContent(),
    );
    const types = graph.map((node) => node['@type']);
    expect(types).toContain('WebSite');
    expect(types).toContain('FAQPage');
  });

  test('en /: H1 de marca y las tres preguntas del FAQ', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: SITE_H1 })).toBeVisible();
    await expect(page.getByText(SITE_DEFINITION, { exact: true })).toHaveCount(2);

    for (const item of FAQ_ITEMS) {
      await expect(page.getByRole('heading', { level: 2, name: item.question })).toBeVisible();
      await expect(page.getByText(item.answer, { exact: true }).first()).toBeVisible();
    }
  });

  test('GET /llms.txt y /robots.txt responden 200', async ({ request }) => {
    const llms = await request.get('/llms.txt');
    expect(llms.status()).toBe(200);
    expect(await llms.text()).toContain('# Diente Dientitos');

    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('User-agent: *');
    expect(await robots.text()).toContain('Allow: /');
  });

  test('en un formato: description F01, JSON-LD sin FAQPage y viewport', async ({ page }) => {
    await page.goto('/formatos/expedientes/');
    await page.locator('.sheet').waitFor();

    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      seoForFormat('ODO-F01'),
    );
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      'width=device-width, initial-scale=1',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/formatos\/expedientes\/$/,
    );

    const graph = jsonLdGraph(
      await page.locator('script[type="application/ld+json"]').textContent(),
    );
    const types = graph.map((node) => node['@type']);
    expect(types).toContain('WebSite');
    expect(types).not.toContain('FAQPage');
  });

  test('el catálogo se oculta al imprimir', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.catalog')).toBeVisible();

    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('.catalog')).toBeHidden();
  });
});
