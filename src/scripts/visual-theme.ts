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
  let label = '';
  let details: HTMLDetailsElement | null = null;

  for (const button of buttons) {
    const active = button.dataset.visualThemeOption === theme;
    button.setAttribute('aria-selected', String(active));
    button.classList.toggle('menu-active', active);

    if (active) {
      label = button.textContent?.trim() ?? '';
      details = button.closest('details');
    }
  }

  if (!details || !label) {
    return;
  }

  const labelEl = details.querySelector('[data-toolbar-select-label]');
  if (labelEl) {
    labelEl.textContent = label;
  }

  const group = details.getAttribute('data-toolbar-select-group') ?? 'Estilo visual';
  details.querySelector('summary')?.setAttribute('aria-label', `${group}: ${label}`);
}

function bindSelectDismiss(details: HTMLDetailsElement | null) {
  if (!details) {
    return;
  }

  const summary = details.querySelector('summary');

  details.addEventListener('toggle', () => {
    summary?.setAttribute('aria-expanded', String(details.open));

    if (!details.open) {
      return;
    }

    document.querySelectorAll<HTMLDetailsElement>('details[data-toolbar-select-group]').forEach((other) => {
      if (other !== details) {
        other.open = false;
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !details.open) {
      return;
    }

    details.open = false;
    summary?.focus();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!details.open) {
      return;
    }

    if (event.target instanceof Node && details.contains(event.target)) {
      return;
    }

    details.open = false;
  });
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

  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-visual-theme-option]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      applyVisualTheme(normalizeVisualTheme(button.dataset.visualThemeOption));
      const details = button.closest('details');
      if (details) {
        details.open = false;
      }
    });
  });

  bindSelectDismiss(buttons[0]?.closest('details') ?? null);

  window.addEventListener('beforeprint', () => {
    applyVisualTheme(getVisualThemeFromDocument(), { persist: false, updateUrl: false });
  });
}
