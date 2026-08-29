import { FORMATS } from '../lib/print-export/formats';
import { availableLayouts, resolveOrientation } from '../lib/print-export/paper';
import { normalizeExportSettings, readExportSettings, writeExportSettings } from '../lib/print-export/settings';
import {
  isDesignSizeId,
  isFormatId,
  isOrientationId,
  isPaperSizeId,
  isPrintLayoutId,
  type DesignSizeId,
  type ExportSettings,
  type FormatId,
  type OrientationId,
} from '../lib/print-export/types';
import { yieldForPaint } from './capture-sheet';
import { applyPaperSize, getPaperSizeFromDocument, normalizePaperSize } from './paper-size';

const COMBO_ALERT =
  'Esta combinación de diseño y papel no se puede imponer sin escalar. Elige el mismo tamaño (1-up) o un anidamiento ISO de un escalón: A5 sobre A4, o A6 sobre A5.';

let draft: ExportSettings | null = null;
let preferredOrientation: OrientationId = 'portrait';
let captureError: string | null = null;
let busy = false;
let paperObserver: MutationObserver | null = null;

function currentFormat(): FormatId {
  const pathname = window.location.pathname;
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  for (const format of FORMATS) {
    if (normalized === format.path || normalized.startsWith(format.path)) {
      return format.id;
    }
  }
  return 'expedientes';
}

function currentDesign(): DesignSizeId {
  const fromDom = getPaperSizeFromDocument();
  return isDesignSizeId(fromDom) ? fromDom : 'letter';
}

function panel(): HTMLDialogElement | null {
  const dialog = document.querySelector('[data-testid="export-panel"]');
  return dialog instanceof HTMLDialogElement ? dialog : null;
}

function alertBox(): HTMLElement | null {
  return document.querySelector('[data-testid="export-alert"]');
}

function downloadButtons(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-testid="download-pdf"], [data-testid="download-pdf-panel"]',
    ),
  ];
}

function selectedFormatsFromDom(): FormatId[] {
  const inputs = document.querySelectorAll<HTMLInputElement>('[data-testid="export-format"]');
  const selected: FormatId[] = [];
  for (const input of inputs) {
    if (!input.checked || !isFormatId(input.dataset.formatId)) {
      continue;
    }
    selected.push(input.dataset.formatId);
  }
  return selected;
}

function canExport(settings: ExportSettings): boolean {
  return availableLayouts(settings.design, settings.paper).length > 0 && settings.formats.length > 0;
}

function reconcileLayout(settings: ExportSettings): ExportSettings {
  const layouts = availableLayouts(settings.design, settings.paper);
  if (layouts.length === 0) {
    return settings;
  }

  const layout = layouts.includes(settings.layout) ? settings.layout : layouts[0]!;
  const preferred = layout === '1up' ? preferredOrientation : settings.orientation;
  return {
    ...settings,
    layout,
    orientation: resolveOrientation(layout, preferred),
  };
}

function loadDraft(): ExportSettings {
  const formatId = currentFormat();
  const stored = readExportSettings(formatId);
  const merged = normalizeExportSettings({ ...stored, design: currentDesign() }, formatId);
  preferredOrientation = merged.layout === '1up' ? merged.orientation : preferredOrientation;
  return merged;
}

function persistIfValid(settings: ExportSettings): void {
  if (!canExport(settings)) {
    return;
  }
  writeExportSettings(normalizeExportSettings(settings, currentFormat()));
}

function orderFormatRows(selected: readonly FormatId[]): void {
  const list = document.querySelector('[data-export-format-list]');
  if (!(list instanceof HTMLElement)) {
    return;
  }

  const rows = new Map<string, HTMLElement>();
  for (const child of [...list.children]) {
    if (child instanceof HTMLElement && child.dataset.formatId) {
      rows.set(child.dataset.formatId, child);
    }
  }

  const seen = new Set<string>(selected);
  for (const id of selected) {
    const row = rows.get(id);
    if (row) {
      list.appendChild(row);
    }
  }
  for (const format of FORMATS) {
    if (seen.has(format.id)) {
      continue;
    }
    const row = rows.get(format.id);
    if (row) {
      list.appendChild(row);
    }
  }
}

function paintAlert(settings: ExportSettings): void {
  const box = alertBox();
  const text = box?.querySelector('[data-export-alert-text]');
  if (!(box instanceof HTMLElement) || !(text instanceof HTMLElement)) {
    return;
  }

  const impossible = availableLayouts(settings.design, settings.paper).length === 0;
  const message = impossible ? COMBO_ALERT : captureError;
  if (!message) {
    box.classList.add('hidden');
    text.textContent = '';
    return;
  }

  text.textContent = message;
  box.classList.remove('hidden');
}

function paintMoveButtons(): void {
  const list = document.querySelector('[data-export-format-list]');
  if (!(list instanceof HTMLElement)) {
    return;
  }

  const rows = [...list.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
  rows.forEach((row, index) => {
    const up = row.querySelector<HTMLButtonElement>('[data-testid="export-format-up"]');
    const down = row.querySelector<HTMLButtonElement>('[data-testid="export-format-down"]');
    if (up) {
      up.disabled = busy || index === 0;
    }
    if (down) {
      down.disabled = busy || index === rows.length - 1;
    }
  });
}

function paintDownload(settings: ExportSettings): void {
  const allowed = canExport(settings);
  for (const button of downloadButtons()) {
    // No usar `disabled` durante la generación: daisyUI lo apaga y el texto
    // «Descargando…» no llega a pintarse antes de bloquear el hilo.
    button.disabled = !busy && !allowed;
    button.setAttribute('aria-busy', String(busy));
    button.classList.toggle('is-exporting', busy);
    const label = button.querySelector('[data-download-label]');
    if (label instanceof HTMLElement) {
      label.textContent = busy ? 'Descargando…' : 'Descargar PDF';
    }
  }
}

function paint(settings: ExportSettings): void {
  const dialog = panel();
  if (!dialog) {
    paintDownload(settings);
    return;
  }

  for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-export-design]')) {
    const active = button.dataset.exportDesign === settings.design;
    button.classList.toggle('btn-active', active);
    button.classList.toggle('btn-primary', active);
    button.setAttribute('aria-pressed', String(active));
  }

  for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-export-paper]')) {
    const active = button.dataset.exportPaper === settings.paper;
    button.classList.toggle('btn-active', active);
    button.classList.toggle('btn-primary', active);
    button.setAttribute('aria-pressed', String(active));
  }

  const layouts = availableLayouts(settings.design, settings.paper);
  for (const input of dialog.querySelectorAll<HTMLInputElement>('[data-export-layout]')) {
    const layoutId = input.dataset.exportLayout;
    if (!isPrintLayoutId(layoutId)) {
      continue;
    }
    const allowed = layouts.includes(layoutId);
    input.disabled = !allowed;
    input.checked = allowed && settings.layout === layoutId;
    const hint = dialog.querySelector(`[data-layout-unavailable="${layoutId}"]`);
    if (hint instanceof HTMLElement) {
      hint.classList.toggle('hidden', allowed);
    }
  }

  const orientationLocked = settings.layout === 'duplicate' || settings.layout === 'booklet';
  const orientationInputs = dialog.querySelectorAll<HTMLInputElement>('[data-testid="export-orientation"] input[type="radio"]');
  for (const input of orientationInputs) {
    input.disabled = orientationLocked;
    if (isOrientationId(input.value)) {
      input.checked = settings.orientation === input.value;
    }
  }
  const autoHint = dialog.querySelector('[data-orientation-auto]');
  if (autoHint instanceof HTMLElement) {
    autoHint.classList.toggle('hidden', !orientationLocked);
  }

  const selected = new Set(settings.formats);
  for (const input of dialog.querySelectorAll<HTMLInputElement>('[data-testid="export-format"]')) {
    if (!isFormatId(input.dataset.formatId)) {
      continue;
    }
    input.checked = selected.has(input.dataset.formatId);
  }

  paintMoveButtons();
  paintAlert(settings);
  paintDownload(settings);
}

function setDraft(next: ExportSettings): void {
  draft = next;
  paint(next);
  persistIfValid(next);
}

function onDesignFromToolbar(): void {
  if (!draft) {
    return;
  }
  const design = currentDesign();
  if (design === draft.design) {
    return;
  }
  setDraft(reconcileLayout({ ...draft, design }));
}

export function showExportError(detail: string): boolean {
  captureError = detail;
  if (!draft) {
    draft = loadDraft();
  }
  paintAlert(draft);
  const dialog = panel();
  if (!dialog) {
    return false;
  }
  if (!dialog.open) {
    dialog.showModal();
  }
  return true;
}

export function bindExportPanel(download: () => Promise<unknown>): void {
  draft = loadDraft();
  orderFormatRows(draft.formats);
  paint(draft);
  persistIfValid(draft);

  const dialog = panel();
  const options = document.querySelector<HTMLButtonElement>('[data-testid="export-options"]');
  if (options && dialog) {
    options.addEventListener('click', () => {
      if (!dialog.open) {
        dialog.showModal();
      }
    });
  }

  if (dialog) {
    dialog.addEventListener('click', (event) => {
      if (!draft || busy) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const designButton = target.closest<HTMLButtonElement>('[data-export-design]');
      if (designButton) {
        const design = designButton.dataset.exportDesign;
        if (isDesignSizeId(design)) {
          applyPaperSize(normalizePaperSize(design));
          setDraft(reconcileLayout({ ...draft, design }));
        }
        return;
      }

      const paperButton = target.closest<HTMLButtonElement>('[data-export-paper]');
      if (paperButton) {
        const paper = paperButton.dataset.exportPaper;
        if (isPaperSizeId(paper)) {
          setDraft(reconcileLayout({ ...draft, paper }));
        }
        return;
      }

      const up = target.closest<HTMLButtonElement>('[data-testid="export-format-up"]');
      const down = target.closest<HTMLButtonElement>('[data-testid="export-format-down"]');
      const mover = up ?? down;
      if (mover) {
        const row = mover.closest<HTMLElement>('[data-format-id]');
        const id = row?.dataset.formatId;
        if (isFormatId(id)) {
          moveFormat(id, up ? -1 : 1);
        }
      }
    });

    dialog.addEventListener('change', (event) => {
      if (!draft || busy) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (target.matches('[data-export-layout]')) {
        const layout = target.dataset.exportLayout;
        if (isPrintLayoutId(layout) && availableLayouts(draft.design, draft.paper).includes(layout)) {
          setDraft(reconcileLayout({ ...draft, layout }));
        }
        return;
      }

      if (target.matches('[data-testid="export-orientation"] input[type="radio"]')) {
        if (draft.layout !== '1up' || !isOrientationId(target.value)) {
          return;
        }
        preferredOrientation = target.value;
        setDraft({ ...draft, orientation: target.value });
        return;
      }

      if (target.matches('[data-testid="export-format"]')) {
        let formats = selectedFormatsFromDom();
        if (formats.length === 0) {
          target.checked = true;
          formats = selectedFormatsFromDom();
        }
        setDraft({ ...draft, formats });
      }
    });

    dialog.addEventListener('close', () => {
      if (busy) {
        return;
      }
      captureError = null;
      draft = loadDraft();
      orderFormatRows(draft.formats);
      paint(draft);
    });
  }

  if (!paperObserver) {
    paperObserver = new MutationObserver(() => {
      onDesignFromToolbar();
    });
    paperObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-paper-size'],
    });
  }

  const runDownload = () => {
    if (!draft || busy || !canExport(draft)) {
      return;
    }
    busy = true;
    captureError = null;
    paint(draft);
    if (dialog?.open) {
      dialog.close();
    }
    void (async () => {
      await yieldForPaint();
      try {
        await download();
      } catch {
        /* el error ya se mostró en el panel o con alert */
      } finally {
        busy = false;
        if (draft) {
          paint(draft);
        }
      }
    })();
  };

  for (const button of downloadButtons()) {
    button.addEventListener('click', runDownload);
  }
}

function moveFormat(id: FormatId, direction: -1 | 1): void {
  if (!draft) {
    return;
  }
  const list = document.querySelector('[data-export-format-list]');
  if (!(list instanceof HTMLElement)) {
    return;
  }
  const rows = [...list.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
  const index = rows.findIndex((row) => row.dataset.formatId === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= rows.length) {
    return;
  }
  const row = rows[index]!;
  const pivot = rows[next]!;
  if (direction < 0) {
    list.insertBefore(row, pivot);
  } else {
    list.insertBefore(row, pivot.nextSibling);
  }
  setDraft({ ...draft, formats: selectedFormatsFromDom() });
}
