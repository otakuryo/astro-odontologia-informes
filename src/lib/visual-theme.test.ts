import { describe, expect, test } from 'bun:test';
import {
  VISUAL_THEME_QUERY_PARAM,
  VISUAL_THEME_STORAGE_KEY,
  VISUAL_THEMES,
  isVisualThemeId,
  normalizeVisualTheme,
  sheetCaptureUrl,
} from './visual-theme';

describe('normalizeVisualTheme', () => {
  test('desconocido o ausente → normal', () => {
    expect(normalizeVisualTheme(undefined)).toBe('normal');
    expect(normalizeVisualTheme(null)).toBe('normal');
    expect(normalizeVisualTheme('')).toBe('normal');
    expect(normalizeVisualTheme('  ')).toBe('normal');
    expect(normalizeVisualTheme('desconocido')).toBe('normal');
    expect(normalizeVisualTheme('carta')).toBe('normal');
  });

  test('alias glassmorfismo → glass y redondeado → rounded', () => {
    expect(normalizeVisualTheme('glassmorfismo')).toBe('glass');
    expect(normalizeVisualTheme('Glassmorfismo')).toBe('glass');
    expect(normalizeVisualTheme('redondeado')).toBe('rounded');
    expect(normalizeVisualTheme('  REDONDEADO  ')).toBe('rounded');
  });

  test('ids canónicos se conservan', () => {
    expect(normalizeVisualTheme('normal')).toBe('normal');
    expect(normalizeVisualTheme('rounded')).toBe('rounded');
    expect(normalizeVisualTheme('glass')).toBe('glass');
  });
});

describe('isVisualThemeId', () => {
  test('acepta solo los ids del registro', () => {
    expect(isVisualThemeId('normal')).toBe(true);
    expect(isVisualThemeId('rounded')).toBe(true);
    expect(isVisualThemeId('glass')).toBe(true);
    expect(isVisualThemeId('glassmorfismo')).toBe(false);
    expect(isVisualThemeId('redondeado')).toBe(false);
    expect(isVisualThemeId('desconocido')).toBe(false);
  });
});

describe('registro y captura', () => {
  test('VISUAL_THEMES expone etiquetas visibles y claves de persistencia', () => {
    expect(VISUAL_THEMES.map((theme) => theme.id)).toEqual(['normal', 'rounded', 'glass']);
    expect(VISUAL_THEMES.map((theme) => theme.label)).toEqual(['Normal', 'Rounded', 'Glassmorfismo']);
    expect(VISUAL_THEME_STORAGE_KEY).toBe('odo-visual-theme');
    expect(VISUAL_THEME_QUERY_PARAM).toBe('estilo');
  });

  test('sheetCaptureUrl incluye papel y estilo', () => {
    expect(sheetCaptureUrl('/formatos/expedientes/', 'a5', 'glass')).toBe(
      '/formatos/expedientes/?papel=a5&estilo=glass',
    );
    expect(sheetCaptureUrl('/formatos/eventos/', 'letter', 'rounded')).toBe(
      '/formatos/eventos/?papel=letter&estilo=rounded',
    );
  });
});
