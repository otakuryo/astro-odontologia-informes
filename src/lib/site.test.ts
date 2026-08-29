import { expect, test } from "bun:test";
import {
  CATALOG_FORMATS,
  SITE_DESCRIPTION,
  SITE_TITLE,
  buildLlmsTxt,
  seoForFormat,
} from "./site";

test("SITE_TITLE tiene entre 50 y 60 caracteres", () => {
  expect(SITE_TITLE.length).toBeGreaterThanOrEqual(50);
  expect(SITE_TITLE.length).toBeLessThanOrEqual(60);
});

test("SITE_DESCRIPTION tiene entre 150 y 160 caracteres", () => {
  expect(SITE_DESCRIPTION.length).toBeGreaterThanOrEqual(150);
  expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
});

test("buildLlmsTxt empieza por # Diente Dientitos, incluye blockquote y los cuatro paths", () => {
  const markdown = buildLlmsTxt();

  expect(markdown.startsWith("# Diente Dientitos")).toBe(true);
  expect(markdown).toContain("> ");
  expect(markdown).toContain("/formatos/expedientes/");
  expect(markdown).toContain("/formatos/paciente-rx-tx/");
  expect(markdown).toContain("/formatos/eventos/");
  expect(markdown).toContain("/formatos/paciente-imagen/");
});

test("seoForFormat cubre F01–F04 y ninguna descripción contiene odontograma", () => {
  expect(CATALOG_FORMATS.map((format) => format.code)).toEqual([
    "ODO-F01",
    "ODO-F02",
    "ODO-F03",
    "ODO-F04",
  ]);

  for (const format of CATALOG_FORMATS) {
    const description = seoForFormat(format.code);

    expect(description.length).toBeGreaterThan(0);
    expect(description.toLowerCase()).not.toContain("odontograma");
  }
});
