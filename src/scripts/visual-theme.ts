import {
  VISUAL_THEME_QUERY_PARAM,
  VISUAL_THEME_STORAGE_KEY,
  normalizeVisualTheme,
  type VisualThemeId,
} from '../lib/visual-theme';

export function getVisualThemeFromDocument(): VisualThemeId {
  return normalizeVisualTheme(document.documentElement.dataset.visualTheme);
}

function syncToolbar(theme: VisualThemeId) {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-visual-theme-option]');

  for (const button of buttons) {
    const active = button.dataset.visualThemeOption === theme;
    button.setAttribute('aria-checked', String(active));
    button.classList.toggle('btn-active', active);
    button.classList.toggle('btn-primary', active);
  }
}

function syncUrl(theme: VisualThemeId) {
  const url = new URL(location.href);

  if (theme === 'normal') {
    url.searchParams.delete(VISUAL_THEME_QUERY_PARAM);
  } else {
    url.searchParams.set(VISUAL_THEME_QUERY_PARAM, theme);
  }

  history.replaceState(null, '', url);
}

export function applyVisualTheme(
  theme: VisualThemeId,
  options?: { persist?: boolean; updateUrl?: boolean },
) {
  const persist = options?.persist ?? true;
  const updateUrl = options?.updateUrl ?? true;

  document.documentElement.dataset.visualTheme = theme;
  syncToolbar(theme);

  if (persist) {
    try {
      localStorage.setItem(VISUAL_THEME_STORAGE_KEY, theme);
    } catch {
      /* modo privado o almacenamiento bloqueado */
    }
  }

  if (updateUrl) {
    syncUrl(theme);
  }
}

export function bindVisualThemeToolbar() {
  applyVisualTheme(getVisualThemeFromDocument(), { persist: true, updateUrl: false });

  document.querySelectorAll<HTMLButtonElement>('[data-visual-theme-option]').forEach((button) => {
    button.addEventListener('click', () => {
      applyVisualTheme(normalizeVisualTheme(button.dataset.visualThemeOption));
    });
  });

  window.addEventListener('beforeprint', () => {
    applyVisualTheme(getVisualThemeFromDocument(), { persist: false, updateUrl: false });
  });
}
