import type { DesignSizeId } from './print-export/types';

export const VISUAL_THEME_STORAGE_KEY = 'odo-visual-theme';
export const VISUAL_THEME_QUERY_PARAM = 'estilo';

export const VISUAL_THEMES = [
  { id: 'normal', label: 'Normal' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'glass', label: 'Glassmorfismo' },
] as const;

export type VisualThemeId = (typeof VISUAL_THEMES)[number]['id'];

const VISUAL_THEME_ID_SET = new Set<string>(VISUAL_THEMES.map((theme) => theme.id));

const VISUAL_THEME_ALIASES: Record<string, VisualThemeId> = {
  normal: 'normal',
  rounded: 'rounded',
  glass: 'glass',
  glassmorfismo: 'glass',
  redondeado: 'rounded',
};

export function isVisualThemeId(value: unknown): value is VisualThemeId {
  return typeof value === 'string' && VISUAL_THEME_ID_SET.has(value);
}

export function normalizeVisualTheme(value: string | null | undefined): VisualThemeId {
  if (!value) {
    return 'normal';
  }

  const normalized = value.trim().toLowerCase();
  return VISUAL_THEME_ALIASES[normalized] ?? 'normal';
}

/** URL relativa de captura: siempre lleva `papel` (diseño) y `estilo`. */
export function sheetCaptureUrl(path: string, design: DesignSizeId, theme: VisualThemeId): string {
  const url = new URL(path, 'https://libro.local');
  url.searchParams.set('papel', design);
  url.searchParams.set('estilo', theme);
  return `${url.pathname}${url.search}`;
}
