export type PageSlot = { kind: 'page'; index: number } | { kind: 'blank' };

export type ImposedSheet = {
  left: PageSlot;
  right: PageSlot;
  face: 'front' | 'back';
};

function asPageCount(pageCount: number): number {
  if (!Number.isFinite(pageCount) || pageCount <= 0) {
    return 0;
  }
  return Math.floor(pageCount);
}

function pageSlot(index: number): PageSlot {
  return { kind: 'page', index };
}

const BLANK: PageSlot = { kind: 'blank' };

function slotAt(padded: readonly PageSlot[], page1Indexed: number): PageSlot {
  const slot = padded[page1Indexed - 1];
  if (!slot || slot.kind === 'blank') {
    return BLANK;
  }
  return slot;
}

/** Rellena con blancos al final hasta un múltiplo de 4. Índices 0-based. */
export function padPages(pageCount: number): PageSlot[] {
  const count = asPageCount(pageCount);
  const slots: PageSlot[] = [];

  for (let index = 0; index < count; index++) {
    slots.push(pageSlot(index));
  }

  const remainder = slots.length % 4;
  if (remainder !== 0) {
    for (let i = 0; i < 4 - remainder; i++) {
      slots.push(BLANK);
    }
  }

  return slots;
}

/**
 * Cuadernillo: n múltiplo de 4 (tras padPages), i = índice de pliego.
 * Cara: izquierda n−2i, derecha 2i+1. Dorso: izquierda 2i+2, derecha n−2i−1.
 * Páginas 1-indexadas; el relleno es `blank`.
 */
export function imposeBooklet(pageCount: number): ImposedSheet[] {
  const padded = padPages(pageCount);
  const n = padded.length;
  if (n === 0) {
    return [];
  }

  const sheets: ImposedSheet[] = [];
  const signatures = n / 4;

  for (let i = 0; i < signatures; i++) {
    sheets.push({
      face: 'front',
      left: slotAt(padded, n - 2 * i),
      right: slotAt(padded, 2 * i + 1),
    });
    sheets.push({
      face: 'back',
      left: slotAt(padded, 2 * i + 2),
      right: slotAt(padded, n - 2 * i - 1),
    });
  }

  return sheets;
}

/**
 * Una hoja apaisada por formato: la misma captura a izquierda y derecha.
 */
export function imposeDuplicate(pageCount: number): ImposedSheet[] {
  const count = asPageCount(pageCount);
  const sheets: ImposedSheet[] = [];

  for (let index = 0; index < count; index++) {
    sheets.push({
      face: 'front',
      left: pageSlot(index),
      right: pageSlot(index),
    });
  }

  return sheets;
}
