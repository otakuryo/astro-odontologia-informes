export const PAPER_STORAGE_KEY = 'odo-paper-size';
export const PAPER_QUERY_PARAM = 'papel';

export const PAPER_PRESETS = {
  letter: { id: 'letter', label: 'Carta', pageSize: 'letter portrait' },
  a5: { id: 'a5', label: 'A5', pageSize: 'A5 portrait' },
  a6: { id: 'a6', label: 'A6', pageSize: 'A6 portrait' },
} as const;

export type PaperSizeId = keyof typeof PAPER_PRESETS;

export function normalizePaperSize(value: string | null | undefined): PaperSizeId {
  if (!value) {
    return 'letter';
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'carta' || normalized === 'letter') {
    return 'letter';
  }

  if (normalized === 'a5' || normalized === 'a6') {
    return normalized;
  }

  return 'letter';
}

export function getPaperSizeFromDocument(): PaperSizeId {
  return normalizePaperSize(document.documentElement.dataset.paperSize);
}

function syncPageRule(size: PaperSizeId) {
  const pageSize = PAPER_PRESETS[size].pageSize;
  let style = document.getElementById('print-page-size');

  if (!style) {
    style = document.createElement('style');
    style.id = 'print-page-size';
  }

  style.textContent = `@page { size: ${pageSize}; margin: 0; }`;
  document.head.appendChild(style);
}

function syncToolbar(size: PaperSizeId) {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-paper-size-option]');

  for (const button of buttons) {
    const active = button.dataset.paperSizeOption === size;
    button.setAttribute('aria-checked', String(active));
    button.classList.toggle('btn-active', active);
    button.classList.toggle('btn-primary', active);
  }
}

function syncUrl(size: PaperSizeId) {
  const url = new URL(location.href);

  if (size === 'letter') {
    url.searchParams.delete(PAPER_QUERY_PARAM);
  } else {
    url.searchParams.set(PAPER_QUERY_PARAM, size);
  }

  history.replaceState(null, '', url);
}

export function applyPaperSize(
  size: PaperSizeId,
  options?: { persist?: boolean; updateUrl?: boolean },
) {
  const persist = options?.persist ?? true;
  const updateUrl = options?.updateUrl ?? true;

  document.documentElement.dataset.paperSize = size;
  syncPageRule(size);
  syncToolbar(size);

  if (persist) {
    try {
      localStorage.setItem(PAPER_STORAGE_KEY, size);
    } catch {
      /* modo privado o almacenamiento bloqueado */
    }
  }

  if (updateUrl) {
    syncUrl(size);
  }
}

export function bindPaperToolbar() {
  applyPaperSize(getPaperSizeFromDocument(), { persist: true, updateUrl: false });

  document.querySelectorAll<HTMLButtonElement>('[data-paper-size-option]').forEach((button) => {
    button.addEventListener('click', () => {
      applyPaperSize(normalizePaperSize(button.dataset.paperSizeOption));
    });
  });

  window.addEventListener('beforeprint', () => {
    applyPaperSize(getPaperSizeFromDocument(), { persist: false, updateUrl: false });
  });
}
