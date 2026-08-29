import {
  isFormatId,
  type DesignSizeId,
  type FormatId,
  type PaperSizeId,
  type PrintLayoutId,
} from './types';

export type FormatDefinition = {
  id: FormatId;
  code: string;
  path: string;
  title: string;
};

/** Orden del panel: el mismo que el índice y las páginas Astro. */
export const FORMATS: readonly FormatDefinition[] = [
  {
    id: 'expedientes',
    code: 'ODO-F01',
    path: '/formatos/expedientes/',
    title: 'Expedientes · ODO-F01',
  },
  {
    id: 'paciente-rx-tx',
    code: 'ODO-F02',
    path: '/formatos/paciente-rx-tx/',
    title: 'Paciente Rx Tx · ODO-F02',
  },
  {
    id: 'eventos',
    code: 'ODO-F03',
    path: '/formatos/eventos/',
    title: 'Eventos · ODO-F03',
  },
  {
    id: 'paciente-imagen',
    code: 'ODO-F04',
    path: '/formatos/paciente-imagen/',
    title: 'Paciente imagen · ODO-F04',
  },
];

const FORMAT_BY_ID = Object.fromEntries(FORMATS.map((format) => [format.id, format])) as Record<
  FormatId,
  FormatDefinition
>;

const LAYOUT_FILE_SLUG: Record<PrintLayoutId, string> = {
  '1up': '1up',
  duplicate: 'duplicado',
  booklet: 'cuadernillo',
};

export function getFormat(id: FormatId): FormatDefinition {
  return FORMAT_BY_ID[id];
}

export function selectKnownFormats(ids: unknown, fallback: FormatId): FormatId[] {
  const current = isFormatId(fallback) ? fallback : FORMATS[0].id;

  if (!Array.isArray(ids) || ids.length === 0) {
    return [current];
  }

  const seen = new Set<FormatId>();
  const selected: FormatId[] = [];

  for (const id of ids) {
    if (!isFormatId(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    selected.push(id);
  }

  return selected.length > 0 ? selected : [current];
}

/** Nombre del PDF de exportación. */
export function exportFileName(options: {
  formats: readonly FormatId[];
  design: DesignSizeId;
  paper: PaperSizeId;
  layout: PrintLayoutId;
}): string {
  const layoutSlug = LAYOUT_FILE_SLUG[options.layout];
  const suffix = `${options.design}-sobre-${options.paper}-${layoutSlug}.pdf`;

  if (options.formats.length === 1) {
    const format = getFormat(options.formats[0]!);
    return `${format.code}-${suffix}`;
  }

  return `libro-odontologico-${suffix}`;
}

export { isFormatId };
