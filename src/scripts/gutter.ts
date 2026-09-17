import { normalizeGutterMm, normalizeGutterSide } from '../lib/print-export/gutter';
import { GUTTER_MM_STORAGE_KEY, GUTTER_SIDE_STORAGE_KEY } from '../lib/print-export/settings';
import type { GutterSideId } from '../lib/print-export/types';

export const GUTTER_MM_QUERY_PARAM = 'anillado';
export const GUTTER_SIDE_QUERY_PARAM = 'lomo';

let transientApply = 0;

export function beginTransientGutter(): void {
  transientApply += 1;
}

export function endTransientGutter(): void {
  transientApply = Math.max(0, transientApply - 1);
}

export function isTransientGutterApply(): boolean {
  return transientApply > 0;
}

export function getGutterFromDocument(): { mm: number; side: GutterSideId } {
  return {
    mm: normalizeGutterMm(document.documentElement.dataset.gutterMm),
    side: normalizeGutterSide(document.documentElement.dataset.gutterSide),
  };
}

function syncUrl(mm: number, side: GutterSideId) {
  const url = new URL(location.href);

  if (mm <= 0) {
    url.searchParams.delete(GUTTER_MM_QUERY_PARAM);
    url.searchParams.delete(GUTTER_SIDE_QUERY_PARAM);
  } else {
    url.searchParams.set(GUTTER_MM_QUERY_PARAM, String(mm));
    if (side === 'left') {
      url.searchParams.delete(GUTTER_SIDE_QUERY_PARAM);
    } else {
      url.searchParams.set(GUTTER_SIDE_QUERY_PARAM, 'derecha');
    }
  }

  history.replaceState(null, '', url);
}

export function applyGutter(
  mm: number,
  side: GutterSideId,
  options?: { persist?: boolean; updateUrl?: boolean },
) {
  const persist = options?.persist ?? true;
  const updateUrl = options?.updateUrl ?? true;
  const gutterMm = normalizeGutterMm(mm);
  const gutterSide = normalizeGutterSide(side);
  const html = document.documentElement;

  if (gutterMm > 0) {
    html.setAttribute('data-gutter-mm', String(gutterMm));
  } else {
    html.removeAttribute('data-gutter-mm');
  }
  html.setAttribute('data-gutter-side', gutterSide);

  if (persist) {
    try {
      localStorage.setItem(GUTTER_MM_STORAGE_KEY, String(gutterMm));
      localStorage.setItem(GUTTER_SIDE_STORAGE_KEY, gutterSide);
    } catch {
      /* modo privado o almacenamiento bloqueado */
    }
  }

  if (updateUrl) {
    syncUrl(gutterMm, gutterSide);
  }
}

export function bindGutter() {
  const current = getGutterFromDocument();
  applyGutter(current.mm, current.side, { persist: true, updateUrl: false });

  window.addEventListener('beforeprint', () => {
    const live = getGutterFromDocument();
    applyGutter(live.mm, live.side, { persist: false, updateUrl: false });
  });
}
