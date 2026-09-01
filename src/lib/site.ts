export const SITE_NAME = 'Diente Dientitos';
export const SITE_DESCRIPTOR = 'Ficheros odontológicos';
export const SITE_ALTERNATE_NAME = 'Diente Dientitos - Ficheros odontológicos';
export const SITE_TITLE = 'Diente Dientitos | Ficheros odontológicos imprimibles';
export const SITE_DESCRIPTION =
  'Diente Dientitos ofrece ficheros odontológicos imprimibles: expedientes, Rx/Tx, eventos y diagrama dental. Elige Carta, A5 o A6, descarga PDF o rellena a mano.';
export const SITE_H1 = 'Diente Dientitos — Ficheros odontológicos';
export const SITE_DEFINITION =
  'Diente Dientitos es un sitio de ficheros odontológicos imprimibles para consulta: expedientes, Rx/Tx, eventos y diagrama dental. Cada formato es una hoja en blanco (Carta, A5 o A6) para rellenar a mano o descargar en PDF. El catálogo no se imprime ni sustituye un historial digital.';

export const CATALOG_FORMATS = [
  {
    href: '/formatos/expedientes/',
    code: 'ODO-F01',
    title: 'Expedientes',
    lead: 'Cinco espacios de folio en un documento independiente.',
  },
  {
    href: '/formatos/paciente-rx-tx/',
    code: 'ODO-F02',
    title: 'Paciente · Rx / Tx',
    lead: 'Secciones Rx, Tx y Notas para registro clínico manuscrito.',
  },
  {
    href: '/formatos/eventos/',
    code: 'ODO-F03',
    title: 'Eventos',
    lead: 'Cuatro recuadros equivalentes en cuadrícula 2 × 2.',
  },
  {
    href: '/formatos/paciente-imagen/',
    code: 'ODO-F04',
    title: 'Paciente · Imagen',
    lead: 'Diagrama dental, leyenda Rojo, Azul, Verde y Otro, y recuadro de notas.',
  },
] as const;

export type CatalogFormat = (typeof CATALOG_FORMATS)[number];
export type FormatCode = CatalogFormat['code'];

const FORMAT_DESCRIPTIONS: Record<FormatCode, string> = {
  'ODO-F01':
    'Hoja de expedientes odontológicos (ODO-F01) con cinco folios. Imprime en Carta, A5 o A6 o descarga el PDF en Diente Dientitos.',
  'ODO-F02':
    'Fichero de paciente con secciones Rx, Tx y notas (ODO-F02). Formato imprimible o PDF en Diente Dientitos.',
  'ODO-F03':
    'Hoja de eventos clínicos en cuadrícula 2×2 (ODO-F03). Imprime o descarga el PDF en Diente Dientitos.',
  'ODO-F04':
    'Fichero de paciente con diagrama dental, leyenda Rojo, Azul, Verde y Otro, y notas (ODO-F04). Imprimible o PDF.',
};

export const FAQ_ITEMS = [
  {
    question: '¿Qué es Diente Dientitos?',
    answer: SITE_DEFINITION,
  },
  {
    question: '¿Para qué sirve cada formato?',
    answer:
      'ODO-F01 expedientes/folios; ODO-F02 paciente Rx/Tx/notas; ODO-F03 eventos 2×2; ODO-F04 diagrama dental, leyenda y notas. Una hoja por ruta.',
  },
  {
    question: '¿Cómo se imprime o descarga un fichero?',
    answer:
      'Abrir el formato, elegir Carta/A5/A6, Descargar PDF u Imprimir hoja. En Opciones, PNG para editar baja un ZIP de PNG sin fondo de hoja. No imprimir el catálogo.',
  },
] as const;

export function seoForFormat(code: FormatCode): string {
  return FORMAT_DESCRIPTIONS[code];
}

function jsonLdWebSite() {
  return {
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAME,
    inLanguage: 'es-ES',
  };
}

function jsonLdWebApplication() {
  return {
    '@type': 'WebApplication',
    name: SITE_NAME,
    applicationCategory: 'HealthApplication',
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'EUR',
    },
  };
}

function jsonLdFaqPage() {
  return {
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function jsonLdCatalog() {
  return {
    '@context': 'https://schema.org',
    '@graph': [jsonLdWebSite(), jsonLdWebApplication(), jsonLdFaqPage()],
  };
}

export function jsonLdFormat() {
  return {
    '@context': 'https://schema.org',
    '@graph': [jsonLdWebSite(), jsonLdWebApplication()],
  };
}

function catalogLinkList(): string {
  const home = `- [${SITE_H1}](/): catálogo de ficheros odontológicos imprimibles. No se imprime.`;
  const formats = CATALOG_FORMATS.map(
    (format) => `- [${format.title}](${format.href}): ${format.lead}`,
  );

  return [home, ...formats].join('\n');
}

export function buildLlmsTxt(): string {
  return [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_DEFINITION}`,
    '',
    SITE_DESCRIPTION,
    '',
    '## Ficheros',
    '',
    catalogLinkList(),
    '',
  ].join('\n');
}

export function buildLlmsFullTxt(): string {
  const formatLines = CATALOG_FORMATS.map(
    (format) => `- [${format.title}](${format.href}): ${seoForFormat(format.code)}`,
  ).join('\n');

  return [buildLlmsTxt().trimEnd(), '', '## Formatos', '', formatLines, ''].join('\n');
}
