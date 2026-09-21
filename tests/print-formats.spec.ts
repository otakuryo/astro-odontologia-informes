import { expect, test, type Page } from '@playwright/test';
import {
  OCCLUSION_CELLS,
  OCCLUSION_LABELS,
  OCCLUSION_TEMPORAL_CELLS,
  PERIO_LOWER_FDI,
  PERIO_TEMPORAL_LOWER_FDI,
  PERIO_TEMPORAL_UPPER_FDI,
  PERIO_UPPER_FDI,
} from '../src/lib/periodontogram';
import { SITE_TITLE } from '../src/lib/site';

const LETTER = { width: 816, height: 1056 };

const FORMATS = [
  {
    path: '/formatos/expedientes/',
    title: 'Expedientes · ODO-F01',
    code: 'ODO-F01',
  },
  {
    path: '/formatos/paciente-rx-tx/',
    title: 'Paciente Rx Tx · ODO-F02',
    code: 'ODO-F02',
  },
  {
    path: '/formatos/eventos/',
    title: 'Eventos · ODO-F03',
    code: 'ODO-F03',
  },
  {
    path: '/formatos/paciente-imagen/',
    title: 'Paciente imagen · ODO-F04',
    code: 'ODO-F04',
  },
  {
    path: '/formatos/periodontograma/',
    title: 'Periodontograma · ODO-F05',
    code: 'ODO-F05',
  },
  {
    path: '/formatos/periodontograma-temporal/',
    title: 'Periodontograma temporal · ODO-F06',
    code: 'ODO-F06',
  },
] as const;

const SHARED_FIELDS = [
  'Clínica / profesional',
  'Paciente',
  'Folio / expediente',
  'Fecha',
] as const;

const FORBIDDEN_COPY = [
  'elemento adicional',
  'elemento inferior',
  'círculos conectados',
  'circulos conectados',
  'pendiente de validación',
  'pendiente de validacion',
];

async function assertNoSheetOverflow(page: Page) {
  await page.setViewportSize(LETTER);

  const metrics = await page.locator('.sheet').evaluate((sheet) => {
    const inner = sheet.querySelector('.sheet__inner');
    const body = sheet.querySelector('.sheet__body');

    const measure = (el: Element | null) => {
      if (!el) {
        return null;
      }

      const rect = el.getBoundingClientRect();
      return {
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        rect: {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
        },
      };
    };

    const sheetBox = measure(sheet);
    const innerBox = measure(inner);
    const contained =
      sheetBox && innerBox
        ? innerBox.rect.left >= sheetBox.rect.left - 0.5 &&
          innerBox.rect.top >= sheetBox.rect.top - 0.5 &&
          innerBox.rect.right <= sheetBox.rect.right + 0.5 &&
          innerBox.rect.bottom <= sheetBox.rect.bottom + 0.5
        : false;

    return {
      sheet: sheetBox,
      inner: innerBox,
      body: measure(body),
      contained,
    };
  });

  expect(metrics.sheet, 'debe existir .sheet').not.toBeNull();
  expect(metrics.sheet!.scrollWidth).toBeLessThanOrEqual(metrics.sheet!.clientWidth + 1);
  expect(metrics.sheet!.scrollHeight).toBeLessThanOrEqual(metrics.sheet!.clientHeight + 1);
  expect(metrics.inner, 'debe existir .sheet__inner').not.toBeNull();
  expect(metrics.inner!.scrollWidth).toBeLessThanOrEqual(metrics.inner!.clientWidth + 1);
  expect(metrics.inner!.scrollHeight).toBeLessThanOrEqual(metrics.inner!.clientHeight + 1);
  expect(metrics.body, 'debe existir .sheet__body').not.toBeNull();
  expect(metrics.body!.scrollWidth).toBeLessThanOrEqual(metrics.body!.clientWidth + 1);
  expect(metrics.body!.scrollHeight).toBeLessThanOrEqual(metrics.body!.clientHeight + 1);
  expect(metrics.contained).toBe(true);
}

const OCCLUSION_PAPERS = [
  { id: 'letter', query: '' },
  { id: 'a5', query: '?papel=a5' },
  { id: 'a6', query: '?papel=a6' },
] as const;

type OcclusionMetrics = {
  groupCount: number;
  midCount: number;
  labels: string[];
  rowsPerGroup: number[];
  cellsPerRow: number[][];
  digits: string[][][];
  columns: number;
  rows: number;
  overlaps: Array<{ a: number; b: number }>;
  clipped: string[];
  mids: Array<{
    continuous: boolean;
    betweenOnes: boolean;
    height: number;
    rowsHeight: number;
  }>;
  layout: Array<{
    label: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  }>;
};

async function measureOcclusion(page: Page): Promise<OcclusionMetrics | null> {
  return page.evaluate(() => {
    const root = document.querySelector('.perio-occlusion');
    const sheet = document.querySelector('.sheet');
    const groups = [...document.querySelectorAll('[data-testid="perio-occlusion-group"]')];
    if (!(root instanceof HTMLElement) || !(sheet instanceof HTMLElement) || groups.length === 0) {
      return null;
    }

    const toBox = (rect: DOMRect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });

    const contained = (inner: DOMRect, outer: DOMRect, slop = 1.5) =>
      inner.left >= outer.left - slop &&
      inner.top >= outer.top - slop &&
      inner.right <= outer.right + slop &&
      inner.bottom <= outer.bottom + slop;

    const overlaps = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

    const textBox = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    };

    const styles = getComputedStyle(root);
    const clipped: string[] = [];
    const sheetBox = sheet.getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();

    if (!contained(rootBox, sheetBox)) {
      clipped.push('root');
    }

    const rowsPerGroup: number[] = [];
    const cellsPerRow: number[][] = [];
    const digits: string[][][] = [];
    const mids: Array<{
      continuous: boolean;
      betweenOnes: boolean;
      height: number;
      rowsHeight: number;
    }> = [];
    const layout: Array<ReturnType<typeof toBox> & { label: string }> = [];

    for (const [groupIndex, group] of groups.entries()) {
      if (!(group instanceof HTMLElement)) {
        continue;
      }

      const groupBox = group.getBoundingClientRect();
      const label = group.querySelector('.perio-occlusion__label');
      const block = group.querySelector('.perio-occlusion__block');
      const rowsRoot = group.querySelector('.perio-occlusion__rows');
      const mid = group.querySelector('[data-testid="perio-occlusion-mid"]');
      const rows = [...group.querySelectorAll('[data-testid="perio-occlusion-row"]')];
      const lines = [...group.querySelectorAll('.perio-occlusion__line')];

      layout.push({
        ...toBox(groupBox),
        label: group.getAttribute('data-label') ?? '',
      });

      if (!contained(groupBox, rootBox) || !contained(groupBox, sheetBox)) {
        clipped.push(`group-${groupIndex}`);
      }

      if (label instanceof HTMLElement) {
        const labelBox = label.getBoundingClientRect();
        const labelText = textBox(label);
        if (
          !contained(labelBox, groupBox) ||
          !contained(labelText, rootBox) ||
          !contained(labelText, sheetBox) ||
          label.scrollWidth > label.clientWidth + 1.5
        ) {
          clipped.push(`label-${groupIndex}`);
        }
        if (block instanceof HTMLElement && labelText.right > block.getBoundingClientRect().left + 1.5) {
          clipped.push(`label-overlap-${groupIndex}`);
        }
      }

      if (block instanceof HTMLElement && !contained(block.getBoundingClientRect(), groupBox)) {
        clipped.push(`block-${groupIndex}`);
      }

      rowsPerGroup.push(rows.length);
      const groupDigits: string[][] = [];
      const groupCells: number[] = [];

      for (const [rowIndex, row] of rows.entries()) {
        if (!(row instanceof HTMLElement)) {
          continue;
        }

        const cells = [...row.querySelectorAll('.perio-occlusion__cell')];
        groupCells.push(cells.length);
        groupDigits.push(cells.map((cell) => (cell.textContent ?? '').trim()));

        if (!contained(row.getBoundingClientRect(), groupBox)) {
          clipped.push(`row-${groupIndex}-${rowIndex}`);
        }

        for (const [cellIndex, cell] of cells.entries()) {
          if (!(cell instanceof HTMLElement)) {
            continue;
          }
          const cellBox = cell.getBoundingClientRect();
          const cellText = textBox(cell);
          if (
            !contained(cellBox, groupBox) ||
            !contained(cellText, rootBox) ||
            !contained(cellText, sheetBox) ||
            cell.scrollWidth > cell.clientWidth + 1.5
          ) {
            clipped.push(`cell-${groupIndex}-${rowIndex}-${cellIndex}`);
          }
        }
      }

      cellsPerRow.push(groupCells);
      digits.push(groupDigits);

      for (const [lineIndex, line] of lines.entries()) {
        if (!(line instanceof HTMLElement)) {
          continue;
        }
        const lineBox = line.getBoundingClientRect();
        if (lineBox.width < 2 || lineBox.height < 0.2 || !contained(lineBox, groupBox)) {
          clipped.push(`line-${groupIndex}-${lineIndex}`);
        }
      }

      if (mid instanceof HTMLElement && rowsRoot instanceof HTMLElement) {
        const midBox = mid.getBoundingClientRect();
        const rowsBox = rowsRoot.getBoundingClientRect();
        const firstRow = rows[0];
        const firstCells =
          firstRow instanceof HTMLElement ? [...firstRow.querySelectorAll('.perio-occlusion__cell')] : [];
        const oneCells = firstCells.filter((cell) => (cell.textContent ?? '').trim() === '1');
        const leftOne = oneCells[0]?.getBoundingClientRect();
        const rightOne = oneCells[1]?.getBoundingClientRect();
        const midCx = midBox.left + midBox.width / 2;

        if (!contained(midBox, groupBox) || midBox.height < 2) {
          clipped.push(`mid-${groupIndex}`);
        }

        mids.push({
          continuous:
            Math.abs(midBox.top - rowsBox.top) <= 1.5 &&
            Math.abs(midBox.bottom - rowsBox.bottom) <= 1.5 &&
            midBox.height >= rowsBox.height - 2,
          betweenOnes: Boolean(
            leftOne && rightOne && leftOne.right <= midCx + 2 && rightOne.left >= midCx - 2,
          ),
          height: midBox.height,
          rowsHeight: rowsBox.height,
        });
      }
    }

    const overlapPairs: Array<{ a: number; b: number }> = [];
    for (let i = 0; i < groups.length; i++) {
      const a = groups[i];
      if (!(a instanceof HTMLElement)) {
        continue;
      }
      const aBox = a.getBoundingClientRect();
      for (let j = i + 1; j < groups.length; j++) {
        const b = groups[j];
        if (!(b instanceof HTMLElement)) {
          continue;
        }
        if (overlaps(aBox, b.getBoundingClientRect())) {
          overlapPairs.push({ a: i, b: j });
        }
      }
    }

    return {
      groupCount: groups.length,
      midCount: document.querySelectorAll('[data-testid="perio-occlusion-mid"]').length,
      labels: groups.map((group) => group.getAttribute('data-label') ?? ''),
      rowsPerGroup,
      cellsPerRow,
      digits,
      columns: styles.gridTemplateColumns.split(' ').filter(Boolean).length,
      rows: styles.gridTemplateRows.split(' ').filter(Boolean).length,
      overlaps: overlapPairs,
      clipped,
      mids,
      layout,
    };
  });
}

async function assertPerioOcclusion(
  page: Page,
  paper: string,
  cells: readonly string[] = OCCLUSION_CELLS,
) {
  const metrics = await measureOcclusion(page);
  expect(metrics, `oclusión medible en ${paper}`).not.toBeNull();

  const occlusion = metrics!;
  const sequence = [...cells];

  expect(occlusion.groupCount, `cuatro grupos en ${paper}`).toBe(4);
  expect(occlusion.midCount, `cuatro ejes medios en ${paper}`).toBe(4);
  expect(occlusion.labels).toEqual([...OCCLUSION_LABELS]);
  expect(occlusion.columns, `retícula 2 columnas en ${paper}`).toBe(2);
  expect(occlusion.rows, `retícula 2 filas en ${paper}`).toBe(2);
  expect(occlusion.overlaps, `sin solapes en ${paper}`).toEqual([]);
  expect(occlusion.clipped, `sin recortes en ${paper}`).toEqual([]);

  expect(occlusion.rowsPerGroup).toEqual([2, 2, 2, 2]);
  expect(occlusion.mids).toHaveLength(4);

  for (const [groupIndex, groupDigits] of occlusion.digits.entries()) {
    expect(
      occlusion.cellsPerRow[groupIndex],
      `${sequence.length} cifras por fila en ${paper} #${groupIndex}`,
    ).toEqual([sequence.length, sequence.length]);
    expect(groupDigits, `secuencias de oclusión en ${paper} #${groupIndex}`).toEqual([
      sequence,
      sequence,
    ]);
  }

  for (const mid of occlusion.mids) {
    expect(mid.continuous, `eje continuo en ${paper}`).toBe(true);
    expect(mid.betweenOnes, `eje entre 1 | 1 en ${paper}`).toBe(true);
  }

  const [topLeft, topRight, bottomLeft, bottomRight] = occlusion.layout;
  expect(topLeft, `grupo superior izquierdo en ${paper}`).toBeTruthy();
  expect(topRight, `grupo superior derecho en ${paper}`).toBeTruthy();
  expect(bottomLeft, `grupo inferior izquierdo en ${paper}`).toBeTruthy();
  expect(bottomRight, `grupo inferior derecho en ${paper}`).toBeTruthy();

  expect(topLeft!.right).toBeLessThanOrEqual(topRight!.left + 0.5);
  expect(bottomLeft!.right).toBeLessThanOrEqual(bottomRight!.left + 0.5);
  expect(topLeft!.bottom).toBeLessThanOrEqual(bottomLeft!.top + 0.5);
  expect(topRight!.bottom).toBeLessThanOrEqual(bottomRight!.top + 0.5);
  expect(Math.abs(topLeft!.left - bottomLeft!.left)).toBeLessThanOrEqual(2);
  expect(Math.abs(topRight!.left - bottomRight!.left)).toBeLessThanOrEqual(2);
  expect(Math.abs(topLeft!.top - topRight!.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(bottomLeft!.top - bottomRight!.top)).toBeLessThanOrEqual(2);
}

type PerioNotesMetrics = {
  hallazgoCount: number;
  midCount: number;
  notesCounts: string[];
  labelTexts: string[];
  clipped: string[];
  mids: Array<{
    ownedByLine: boolean;
    centered: boolean;
    crossesRule: boolean;
    shorterThanPanel: boolean;
  }>;
};

const HALLAZGO_LABELS = [
  'P. ósea horizontal',
  'R. ósea vertical',
  'Ensanchamiento de espacio del lig. perio.',
  'Hallazgos Rx.',
] as const;

async function measurePerioNotes(page: Page): Promise<PerioNotesMetrics | null> {
  return page.evaluate(() => {
    const hallazgoRows = [...document.querySelectorAll('[data-testid="perio-hallazgo"]')];
    const hallazgoLines = [...document.querySelectorAll('[data-testid="perio-hallazgo-line"]')];
    const midNodes = [...document.querySelectorAll('[data-testid="perio-hallazgo-mid"]')];

    if (hallazgoLines.length === 0) {
      return null;
    }

    const notesCounts = [...document.querySelectorAll('.perio-notes')].map(
      (node) => node.getAttribute('data-count') ?? '',
    );

    const contained = (inner: DOMRect, outer: DOMRect, slop = 1.5) =>
      inner.left >= outer.left - slop &&
      inner.top >= outer.top - slop &&
      inner.right <= outer.right + slop &&
      inner.bottom <= outer.bottom + slop;

    const textBox = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    };

    const clipped: string[] = [];
    const labelTexts: string[] = [];
    const mids: Array<{
      ownedByLine: boolean;
      centered: boolean;
      crossesRule: boolean;
      shorterThanPanel: boolean;
    }> = [];

    const rows = hallazgoRows.length > 0 ? hallazgoRows : hallazgoLines.map((line) => line.closest('.perio-hallazgo') ?? line);

    for (const [index, row] of rows.entries()) {
      if (!(row instanceof HTMLElement)) {
        clipped.push(`row-${index}`);
        continue;
      }

      const line = row.querySelector('[data-testid="perio-hallazgo-line"]') ?? hallazgoLines[index];
      const mid = row.querySelector('[data-testid="perio-hallazgo-mid"]') ?? midNodes[index];
      const label = row.querySelector('.perio-hallazgo__label');
      const panel = row.closest('[data-testid="perio-panel"]');
      const frame = row.closest('.outlined-panel');
      const body = row.closest('.outlined-panel__body');

      if (
        !(line instanceof HTMLElement) ||
        !(mid instanceof HTMLElement) ||
        !(label instanceof HTMLElement) ||
        !(panel instanceof HTMLElement) ||
        !(frame instanceof HTMLElement) ||
        !(body instanceof HTMLElement)
      ) {
        clipped.push(`row-missing-${index}`);
        continue;
      }

      const rowBox = row.getBoundingClientRect();
      const lineBox = line.getBoundingClientRect();
      const midBox = mid.getBoundingClientRect();
      const labelBox = label.getBoundingClientRect();
      const labelText = textBox(label);
      const panelBox = panel.getBoundingClientRect();
      const frameBox = frame.getBoundingClientRect();
      const bodyBox = body.getBoundingClientRect();
      const border = Number.parseFloat(getComputedStyle(line).borderBottomWidth);
      const ruleY = lineBox.bottom - border / 2;
      const midCx = midBox.left + midBox.width / 2;
      const midCy = midBox.top + midBox.height / 2;
      const lineCx = lineBox.left + lineBox.width / 2;

      labelTexts.push((label.textContent ?? '').trim());

      const shells = [
        ['body', bodyBox],
        ['frame', frameBox],
        ['panel', panelBox],
      ] as const;

      for (const [shellName, shellBox] of shells) {
        if (!contained(rowBox, shellBox)) {
          clipped.push(`row-${index}-${shellName}`);
        }
        if (!contained(labelBox, shellBox) || !contained(labelText, shellBox) || labelText.height < 1) {
          clipped.push(`label-${index}-${shellName}`);
        }
        if (lineBox.width < 2 || lineBox.height < 0.15 || !contained(lineBox, shellBox)) {
          clipped.push(`line-${index}-${shellName}`);
        }
        if (midBox.height < 1 || !contained(midBox, shellBox)) {
          clipped.push(`mid-${index}-${shellName}`);
        }
      }

        if (label.scrollHeight > label.clientHeight + 1.5) {
          clipped.push(`label-${index}-overflow`);
        }

      mids.push({
        ownedByLine: line.contains(mid),
        centered: Math.abs(midCx - lineCx) <= 1.5,
        crossesRule: midBox.top < ruleY - 0.4 && midBox.bottom > ruleY + 0.4 && Math.abs(midCy - ruleY) <= 2,
        shorterThanPanel: midBox.height > 1 && midBox.height < panelBox.height * 0.35,
      });
    }

    return {
      hallazgoCount: hallazgoLines.length,
      midCount: midNodes.length,
      notesCounts,
      labelTexts,
      clipped,
      mids,
    };
  });
}

async function assertPerioNotes(page: Page, paper: string) {
  await page.locator('.sheet').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const metrics = await measurePerioNotes(page);
  expect(metrics, `renglones de paneles medibles en ${paper}`).not.toBeNull();

  const notes = metrics!;
  expect(notes.hallazgoCount, `cuatro hallazgos en ${paper}`).toBe(4);
  expect(notes.midCount, `cuatro divisores en ${paper}`).toBe(4);
  expect(notes.notesCounts).toEqual(['4']);
  expect(notes.labelTexts, `cuatro etiquetas de hallazgos en ${paper}`).toEqual([...HALLAZGO_LABELS]);
  expect(notes.mids).toHaveLength(4);
  expect(notes.clipped, `hallazgos contenidos en el cuerpo en ${paper}`).toEqual([]);

  for (const mid of notes.mids) {
    expect(mid.ownedByLine, `el divisor pertenece al renglón en ${paper}`).toBe(true);
    expect(mid.centered, `el divisor está centrado en ${paper}`).toBe(true);
    expect(mid.crossesRule, `el divisor cruza la regla en ${paper}`).toBe(true);
    expect(mid.shorterThanPanel, `el divisor no recorre el panel en ${paper}`).toBe(true);
  }
}

async function assertPerioSymbology(page: Page, paper: string, expectedColumns: number) {
  const metrics = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="perio-symbology"]');
    const items = [...document.querySelectorAll('[data-testid="perio-symbology-item"]')];
    const body = root?.closest('.outlined-panel__body');
    if (!(root instanceof HTMLElement) || !(body instanceof HTMLElement) || items.length === 0) {
      return null;
    }

    const bodyBox = body.getBoundingClientRect();
    const boxes = items.map((item) => item.getBoundingClientRect());
    const labels = items.map((item) => item.querySelector('.perio-symbology__label'));
    const labelBoxes = labels.map((label) => {
      if (!(label instanceof HTMLElement)) {
        return null;
      }
      const range = document.createRange();
      range.selectNodeContents(label);
      return range.getBoundingClientRect();
    });
    const contained = (box: DOMRect, outer: DOMRect, slop = 1.5) =>
      box.left >= outer.left - slop &&
      box.top >= outer.top - slop &&
      box.right <= outer.right + slop &&
      box.bottom <= outer.bottom + slop;

    const hasOverlaps = (rects: DOMRect[]) =>
      rects.some((box, index) =>
        rects.slice(index + 1).some((other) => {
          const width = Math.min(box.right, other.right) - Math.max(box.left, other.left);
          const height = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top);
          return width > 0.5 && height > 0.5;
        }),
      );

    const overlaps =
      hasOverlaps(boxes) ||
      hasOverlaps(labelBoxes.filter((box): box is DOMRect => box !== null));

    return {
      columns: getComputedStyle(root).gridTemplateColumns.split(' ').filter(Boolean).length,
      itemCount: items.length,
      contained: boxes.every((box) => contained(box, bodyBox)),
      labelsContained: labelBoxes.every(
        (box) => box !== null && box.width > 1 && box.height > 1 && contained(box, bodyBox),
      ),
      overlaps,
    };
  });

  expect(metrics, `simbología medible en ${paper}`).not.toBeNull();
  expect(metrics!.columns, `columnas de simbología en ${paper}`).toBe(expectedColumns);
  expect(metrics!.itemCount).toBe(9);
  expect(metrics!.contained, `ítems contenidos en ${paper}`).toBe(true);
  expect(metrics!.labelsContained, `etiquetas contenidas en ${paper}`).toBe(true);
  if (paper === 'a5') {
    expect(metrics!.overlaps, `ítems sin solaparse en ${paper}`).toBe(false);
  }
}

const PERIO_SPRITE_ID = /^(permanent|temporal)_(\d{2})_(profile|occlusal)(-solid)?$/;
const TEMPORAL_SPRITE_ID = /^temporal_(\d{2})_(profile|occlusal)(-solid)?$/;
const POTRACE_ATLAS_TRANSFORM = 'translate(0,887) scale(0.1,-0.1)';

type PerioSpriteArchMetrics = {
  arch: string;
  fdis: string[];
  profileIds: string[];
  occlusalIds: string[];
  lingualIds: string[];
  missingSolid: string[];
  missingOutline: string[];
  glyphTransforms: string[];
  flippedRows: string[];
  useTransforms: string[];
  midlineCount: number;
};

type PerioSpriteMetrics = {
  arches: PerioSpriteArchMetrics[];
  outlineIds: string[];
  solidIds: string[];
  forbiddenSymbolIds: string[];
  forbiddenHrefs: string[];
  forbiddenMarkup: string[];
  atlasTransforms: string[];
  solidUseCount: number;
  outlineUseCount: number;
  solidTooDark: string[];
  outlineTooLight: string[];
};

function compactFdi(fdi: string): string {
  return fdi.replaceAll('.', '');
}

function expectedRowIds(
  fdis: readonly string[],
  row: 'profile' | 'occlusal',
  prefix: 'permanent' | 'temporal' = 'permanent',
): string[] {
  return fdis.map((fdi) => `${prefix}_${compactFdi(fdi)}_${row}`);
}

async function measurePerioSprite(page: Page, formatCode?: string): Promise<PerioSpriteMetrics | null> {
  return page.evaluate((code) => {
    const format = code
      ? document.querySelector(`[data-format="${code}"]`)
      : document.querySelector('[data-format]');
    const arches = [...document.querySelectorAll('[data-testid="perio-arch"]')];
    if (!(format instanceof HTMLElement) || arches.length === 0) {
      return null;
    }

    const hrefId = (node: Element): string => {
      const raw =
        node.getAttribute('href') ??
        node.getAttribute('xlink:href') ??
        (node instanceof SVGUseElement ? node.href.baseVal : '') ??
        '';
      const hash = raw.includes('#') ? raw.slice(raw.lastIndexOf('#') + 1) : raw;
      return hash.trim();
    };

    const isForbiddenId = (id: string) =>
      id.startsWith('upper_') ||
      id.startsWith('lower_') ||
      /(^|[_-])m3(?=$|[_-]|-solid)/i.test(id) ||
      id.includes('_m3');

    const symbols = [...format.querySelectorAll('symbol[id]')];
    const outlineIds: string[] = [];
    const solidIds: string[] = [];
    const forbiddenSymbolIds: string[] = [];
    const atlasTransforms: string[] = [];

    for (const symbol of symbols) {
      const id = symbol.getAttribute('id') ?? '';
      if (id.endsWith('-solid')) {
        solidIds.push(id);
      } else {
        outlineIds.push(id);
      }
      if (isForbiddenId(id)) {
        forbiddenSymbolIds.push(id);
      }
      const inner = symbol.querySelector('g[transform]');
      atlasTransforms.push(inner?.getAttribute('transform') ?? '');
    }

    const uses = [...format.querySelectorAll('use')];
    const forbiddenHrefs = uses.map(hrefId).filter((id) => id.length > 0 && isForbiddenId(id));

    const parseCssRgb = (value: string) => {
      const comma = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
      if (comma) {
        return { r: Number(comma[1]), g: Number(comma[2]), b: Number(comma[3]) };
      }
      const space = value.match(/rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
      if (space) {
        return { r: Number(space[1]), g: Number(space[2]), b: Number(space[3]) };
      }
      return null;
    };
    const lumaOf = (color: { r: number; g: number; b: number }) => (color.r + color.g + color.b) / 3;
    const paintLabel = (useNode: Element, fill: string, value: number) => {
      const glyph = useNode.closest('[data-row]');
      const fdi = glyph?.getAttribute('data-fdi') ?? '?';
      const row = glyph?.getAttribute('data-row') ?? '?';
      const lumaText = Number.isFinite(value) ? value.toFixed(1) : 'n/d';
      return `${fdi}:${row}:${hrefId(useNode)} fill=${fill} luma=${lumaText}`;
    };

    const solidTooDark: string[] = [];
    const outlineTooLight: string[] = [];
    let solidUseCount = 0;
    let outlineUseCount = 0;
    for (const useNode of uses) {
      const fill = getComputedStyle(useNode).fill;
      const parsed = parseCssRgb(fill);
      const value = parsed ? lumaOf(parsed) : Number.NaN;
      if (useNode.classList.contains('perio-arch__solid')) {
        solidUseCount += 1;
        if (!(value > 230)) {
          solidTooDark.push(paintLabel(useNode, fill, value));
        }
      } else if (useNode.classList.contains('perio-arch__outline')) {
        outlineUseCount += 1;
        if (!(value < 140)) {
          outlineTooLight.push(paintLabel(useNode, fill, value));
        }
      }
    }

    const markup = format.innerHTML.replaceAll(/\s+/g, '');
    const forbiddenMarkup: string[] = [];
    for (const token of ['scale(-1,1)', 'scale(-1,-1)', 'scale(-1)']) {
      if (markup.includes(token)) {
        forbiddenMarkup.push(token);
      }
    }

    const archMetrics = arches.map((archNode) => {
      const glyphs = [...archNode.querySelectorAll('g[data-row]')];
      const profile: string[] = [];
      const occlusal: string[] = [];
      const lingual: string[] = [];
      const fdis: string[] = [];
      const missingSolid: string[] = [];
      const missingOutline: string[] = [];
      const glyphTransforms: string[] = [];
      const flippedRows: string[] = [];
      const useTransforms: string[] = [];

      for (const glyph of glyphs) {
        const row = glyph.getAttribute('data-row') ?? '';
        const fdi = glyph.getAttribute('data-fdi') ?? '';
        const usesInGlyph = [...glyph.querySelectorAll('use')];
        const ids = usesInGlyph.map(hrefId);
        const outline = ids.find((id) => !id.endsWith('-solid')) ?? '';
        const solid = ids.find((id) => id.endsWith('-solid')) ?? '';

        if (row === 'profile' || row === 'occlusal') {
          fdis.push(fdi);
        }

        if (!outline) {
          missingOutline.push(`${fdi}:${row}`);
        }
        if (!solid || (outline && solid !== `${outline}-solid`)) {
          missingSolid.push(`${fdi}:${row}:${solid || '(vacío)'}`);
        }

        const glyphTransform = glyph.getAttribute('transform');
        if (glyphTransform) {
          glyphTransforms.push(`${fdi}:${row}:${glyphTransform}`);
        }
        if (glyph.getAttribute('data-flip-y') === 'true') {
          flippedRows.push(`${fdi}:${row}`);
        }

        for (const useNode of usesInGlyph) {
          const useTransform = useNode.getAttribute('transform');
          if (useTransform) {
            useTransforms.push(`${fdi}:${row}:${useTransform}`);
          }
        }

        if (row === 'profile') {
          profile.push(outline);
        } else if (row === 'occlusal') {
          occlusal.push(outline);
        } else if (row === 'lingual') {
          lingual.push(outline);
        }
      }

      const uniqueFdis: string[] = [];
      for (const fdi of fdis) {
        if (!uniqueFdis.includes(fdi)) {
          uniqueFdis.push(fdi);
        }
      }

      return {
        arch: archNode.getAttribute('data-arch') ?? '',
        fdis: uniqueFdis,
        profileIds: profile,
        occlusalIds: occlusal,
        lingualIds: lingual,
        missingSolid,
        missingOutline,
        glyphTransforms,
        flippedRows,
        useTransforms,
        midlineCount: archNode.querySelectorAll('.perio-arch__grid.is-rule line').length,
      };
    });

    return {
      arches: archMetrics,
      outlineIds,
      solidIds,
      forbiddenSymbolIds,
      forbiddenHrefs,
      forbiddenMarkup,
      atlasTransforms,
      solidUseCount,
      outlineUseCount,
      solidTooDark,
      outlineTooLight,
    };
  }, formatCode ?? null);
}

async function assertPerioSpriteContract(page: Page, paper: string) {
  const metrics = await measurePerioSprite(page);
  expect(metrics, `sprite v003 medible en ${paper}`).not.toBeNull();

  const sprite = metrics!;
  const upperExpected = [...PERIO_UPPER_FDI];
  const lowerExpected = [...PERIO_LOWER_FDI];
  const upperProfile = expectedRowIds(upperExpected, 'profile');
  const upperOcclusal = expectedRowIds(upperExpected, 'occlusal');
  const lowerProfile = expectedRowIds(lowerExpected, 'profile');
  const lowerOcclusal = expectedRowIds(lowerExpected, 'occlusal');

  expect(sprite.arches, `dos arcadas en ${paper}`).toHaveLength(2);

  const [upper, lower] = sprite.arches;
  expect(upper?.arch, `arcada superior primero en ${paper}`).toBe('upper');
  expect(lower?.arch, `arcada inferior después en ${paper}`).toBe('lower');

  expect(upper!.fdis, `16 FDI superiores en ${paper}`).toEqual(upperExpected);
  expect(lower!.fdis, `16 FDI inferiores en ${paper}`).toEqual(lowerExpected);
  expect(lower!.fdis.slice(8, 12), `23 entre 32 y 33 en inferior ${paper}`).toEqual([
    '3.1',
    '3.2',
    '2.3',
    '3.3',
  ]);
  expect(lower!.fdis, `FDI 35 ausente en inferior ${paper}`).not.toContain('3.5');
  expect(new Set(upper!.fdis).size).toBe(upperExpected.length);
  expect(new Set(lower!.fdis).size).toBe(lowerExpected.length);

  expect(upper!.profileIds, `16 perfiles superiores distintos en ${paper}`).toEqual(upperProfile);
  expect(upper!.occlusalIds, `16 oclusales superiores distintos en ${paper}`).toEqual(upperOcclusal);
  expect(lower!.profileIds, `16 perfiles inferiores distintos en ${paper}`).toEqual(lowerProfile);
  expect(lower!.occlusalIds, `16 oclusales inferiores distintos en ${paper}`).toEqual(lowerOcclusal);

  expect(new Set(upper!.profileIds).size, `perfiles únicos en superior ${paper}`).toBe(upperExpected.length);
  expect(new Set(upper!.occlusalIds).size, `oclusales únicos en superior ${paper}`).toBe(upperExpected.length);
  expect(new Set(lower!.profileIds).size, `perfiles únicos en inferior ${paper}`).toBe(lowerExpected.length);
  expect(new Set(lower!.occlusalIds).size, `oclusales únicos en inferior ${paper}`).toBe(lowerExpected.length);
  expect(upper!.profileIds).toContain('permanent_23_profile');
  expect(lower!.profileIds).toContain('permanent_23_profile');
  expect(new Set([...upper!.profileIds, ...lower!.profileIds]).size).toBe(31);
  expect(new Set([...upper!.occlusalIds, ...lower!.occlusalIds]).size).toBe(31);

  expect(upper!.lingualIds, `lingual superior reutiliza perfil en ${paper}`).toEqual(upperProfile);
  expect(lower!.lingualIds, `lingual inferior reutiliza perfil en ${paper}`).toEqual(lowerProfile);

  expect(upper!.missingOutline, `contorno completo en superior ${paper}`).toEqual([]);
  expect(lower!.missingOutline, `contorno completo en inferior ${paper}`).toEqual([]);
  expect(upper!.missingSolid, `capa -solid en superior ${paper}`).toEqual([]);
  expect(lower!.missingSolid, `capa -solid en inferior ${paper}`).toEqual([]);
  expect(upper!.glyphTransforms, `sin transform en glifos superiores ${paper}`).toEqual([]);
  expect(upper!.flippedRows, `sin inversión vertical en superior ${paper}`).toEqual([]);
  expect(lower!.flippedRows, `perfiles inferiores orientados hacia arriba en ${paper}`).toEqual(
    lowerExpected.flatMap((fdi) => [`${fdi}:profile`, `${fdi}:lingual`]),
  );
  expect(lower!.glyphTransforms, `inversión vertical solo en perfiles inferiores ${paper}`).toHaveLength(32);
  expect(
    lower!.glyphTransforms.every(
      (entry) =>
        (entry.includes(':profile:') || entry.includes(':lingual:')) &&
        entry.includes('scale(1 -1)'),
    ),
  ).toBe(true);
  expect(upper!.useTransforms, `sin transform de espejo en <use> superiores ${paper}`).toEqual([]);
  expect(lower!.useTransforms, `sin transform de espejo en <use> inferiores ${paper}`).toEqual([]);
  expect(upper!.midlineCount, `línea media superior en ${paper}`).toBe(1);
  expect(lower!.midlineCount, `línea media inferior en ${paper}`).toBe(1);

  for (const id of [
    ...upper!.profileIds,
    ...upper!.occlusalIds,
    ...lower!.profileIds,
    ...lower!.occlusalIds,
  ]) {
    expect(id, `id v003 en ${paper}`).toMatch(PERIO_SPRITE_ID);
  }

  expect(sprite.outlineIds, `64 contornos ToothSprite en ${paper}`).toHaveLength(64);
  expect(sprite.solidIds, `64 capas -solid ToothSprite en ${paper}`).toHaveLength(64);
  expect(sprite.outlineIds.every((id) => PERIO_SPRITE_ID.test(id) && !id.endsWith('-solid'))).toBe(true);
  expect(sprite.solidIds.every((id) => id.endsWith('-solid') && PERIO_SPRITE_ID.test(id))).toBe(true);
  expect(
    sprite.solidIds.slice().sort(),
    `cada contorno tiene -solid en ${paper}`,
  ).toEqual(sprite.outlineIds.map((id) => `${id}-solid`).sort());
  expect(sprite.solidUseCount, `un <use> sólido por glifo visible en ${paper}`).toBe(96);
  expect(sprite.outlineUseCount, `un <use> de contorno por glifo visible en ${paper}`).toBe(96);
  expect(
    sprite.solidTooDark,
    `el <use> sólido resuelve a papel claro (luminancia > 230) en ${paper}`,
  ).toEqual([]);
  expect(
    sprite.outlineTooLight,
    `el <use> de contorno resuelve a tinta oscura (luminancia < 140) en ${paper}`,
  ).toEqual([]);

  expect(sprite.forbiddenSymbolIds, `sin IDs legacy/M3 en symbols ${paper}`).toEqual([]);
  expect(sprite.forbiddenHrefs, `sin href legacy/M3 en ${paper}`).toEqual([]);
  expect(sprite.forbiddenMarkup, `sin scale de espejo/inversión en ${paper}`).toEqual([]);
  expect(sprite.atlasTransforms.every((value) => value === POTRACE_ATLAS_TRANSFORM)).toBe(true);

  for (const fdi of ['18', '28', '38', '48'] as const) {
    expect(sprite.outlineIds).toContain(`permanent_${fdi}_profile`);
    expect(sprite.outlineIds).toContain(`permanent_${fdi}_occlusal`);
    expect(sprite.solidIds).toContain(`permanent_${fdi}_profile-solid`);
    expect(sprite.solidIds).toContain(`permanent_${fdi}_occlusal-solid`);
  }
}

async function assertTemporalPerioSpriteContract(page: Page, paper: string) {
  const metrics = await measurePerioSprite(page, 'ODO-F06');
  expect(metrics, `sprite temporal medible en ${paper}`).not.toBeNull();

  const sprite = metrics!;
  const upperExpected = [...PERIO_TEMPORAL_UPPER_FDI];
  const lowerExpected = [...PERIO_TEMPORAL_LOWER_FDI];
  const upperProfile = expectedRowIds(upperExpected, 'profile', 'temporal');
  const upperOcclusal = expectedRowIds(upperExpected, 'occlusal', 'temporal');
  const lowerProfile = expectedRowIds(lowerExpected, 'profile', 'temporal');
  const lowerOcclusal = expectedRowIds(lowerExpected, 'occlusal', 'temporal');

  expect(sprite.arches, `dos arcadas en ${paper}`).toHaveLength(2);

  const [upper, lower] = sprite.arches;
  expect(upper?.arch, `arcada superior primero en ${paper}`).toBe('upper');
  expect(lower?.arch, `arcada inferior después en ${paper}`).toBe('lower');

  expect(upper!.fdis, `10 FDI superiores en ${paper}`).toEqual(upperExpected);
  expect(lower!.fdis, `10 FDI inferiores en ${paper}`).toEqual(lowerExpected);
  expect(lower!.fdis[0], `columna izquierda inferior es 8.5 en ${paper}`).toBe('8.5');
  expect(lower!.profileIds[0], `glifo de 8.5 sin remap invertido en ${paper}`).toBe(
    'temporal_85_profile',
  );
  expect(lower!.fdis.slice(0, 5), `85…81 a la izquierda en ${paper}`).toEqual([
    '8.5',
    '8.4',
    '8.3',
    '8.2',
    '8.1',
  ]);
  expect(lower!.fdis.slice(5), `71…75 a la derecha en ${paper}`).toEqual([
    '7.1',
    '7.2',
    '7.3',
    '7.4',
    '7.5',
  ]);
  expect(new Set(upper!.fdis).size).toBe(10);
  expect(new Set(lower!.fdis).size).toBe(10);
  expect(new Set([...upper!.fdis, ...lower!.fdis]).size).toBe(20);

  expect(upper!.profileIds, `10 perfiles superiores distintos en ${paper}`).toEqual(upperProfile);
  expect(upper!.occlusalIds, `10 oclusales superiores distintos en ${paper}`).toEqual(upperOcclusal);
  expect(lower!.profileIds, `10 perfiles inferiores distintos en ${paper}`).toEqual(lowerProfile);
  expect(lower!.occlusalIds, `10 oclusales inferiores distintos en ${paper}`).toEqual(lowerOcclusal);

  expect(new Set(upper!.profileIds).size).toBe(10);
  expect(new Set(lower!.profileIds).size).toBe(10);
  expect(new Set([...upper!.profileIds, ...lower!.profileIds]).size).toBe(20);
  expect(new Set([...upper!.occlusalIds, ...lower!.occlusalIds]).size).toBe(20);

  expect(upper!.lingualIds, `lingual superior reutiliza perfil en ${paper}`).toEqual(upperProfile);
  expect(lower!.lingualIds, `lingual inferior reutiliza perfil en ${paper}`).toEqual(lowerProfile);

  expect(upper!.missingOutline, `contorno completo en superior ${paper}`).toEqual([]);
  expect(lower!.missingOutline, `contorno completo en inferior ${paper}`).toEqual([]);
  expect(upper!.missingSolid, `capa -solid en superior ${paper}`).toEqual([]);
  expect(lower!.missingSolid, `capa -solid en inferior ${paper}`).toEqual([]);
  expect(upper!.glyphTransforms, `sin transform en glifos superiores ${paper}`).toEqual([]);
  expect(upper!.flippedRows, `sin inversión vertical en superior ${paper}`).toEqual([]);
  expect(lower!.flippedRows, `perfiles inferiores orientados hacia arriba en ${paper}`).toEqual(
    lowerExpected.flatMap((fdi) => [`${fdi}:profile`, `${fdi}:lingual`]),
  );
  expect(lower!.glyphTransforms, `inversión vertical solo en perfiles inferiores ${paper}`).toHaveLength(
    20,
  );
  expect(
    lower!.glyphTransforms.every(
      (entry) =>
        (entry.includes(':profile:') || entry.includes(':lingual:')) &&
        entry.includes('scale(1 -1)'),
    ),
  ).toBe(true);
  expect(upper!.useTransforms, `sin transform de espejo en <use> superiores ${paper}`).toEqual([]);
  expect(lower!.useTransforms, `sin transform de espejo en <use> inferiores ${paper}`).toEqual([]);
  expect(upper!.midlineCount, `línea media superior en ${paper}`).toBe(1);
  expect(lower!.midlineCount, `línea media inferior en ${paper}`).toBe(1);

  for (const id of [
    ...upper!.profileIds,
    ...upper!.occlusalIds,
    ...lower!.profileIds,
    ...lower!.occlusalIds,
  ]) {
    expect(id, `id temporal en ${paper}`).toMatch(TEMPORAL_SPRITE_ID);
  }

  expect(sprite.outlineIds, `40 contornos ToothSprite en ${paper}`).toHaveLength(40);
  expect(sprite.solidIds, `40 capas -solid ToothSprite en ${paper}`).toHaveLength(40);
  expect(sprite.outlineIds.every((id) => TEMPORAL_SPRITE_ID.test(id) && !id.endsWith('-solid'))).toBe(
    true,
  );
  expect(sprite.solidIds.every((id) => id.endsWith('-solid') && TEMPORAL_SPRITE_ID.test(id))).toBe(true);
  expect(sprite.outlineIds.every((id) => id.startsWith('temporal_'))).toBe(true);
  expect(sprite.outlineIds.some((id) => id.startsWith('permanent_'))).toBe(false);
  expect(
    sprite.solidIds.slice().sort(),
    `cada contorno tiene -solid en ${paper}`,
  ).toEqual(sprite.outlineIds.map((id) => `${id}-solid`).sort());
  expect(sprite.solidUseCount, `un <use> sólido por glifo visible en ${paper}`).toBe(60);
  expect(sprite.outlineUseCount, `un <use> de contorno por glifo visible en ${paper}`).toBe(60);
  expect(
    sprite.solidTooDark,
    `el <use> sólido resuelve a papel claro (luminancia > 230) en ${paper}`,
  ).toEqual([]);
  expect(
    sprite.outlineTooLight,
    `el <use> de contorno resuelve a tinta oscura (luminancia < 140) en ${paper}`,
  ).toEqual([]);

  expect(sprite.forbiddenSymbolIds, `sin IDs legacy/M3 en symbols ${paper}`).toEqual([]);
  expect(sprite.forbiddenHrefs, `sin href legacy/M3 en ${paper}`).toEqual([]);
  expect(sprite.forbiddenMarkup, `sin scale de espejo/inversión en ${paper}`).toEqual([]);
  expect(sprite.atlasTransforms.every((value) => value === POTRACE_ATLAS_TRANSFORM)).toBe(true);
}

async function assertHeaderTitleFits(page: Page, title: string) {
  const heading = page.getByRole('heading', { level: 1, name: title });
  await expect(heading).toBeVisible();
  const metrics = await heading.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const sheet = el.closest('.sheet');
    const sheetRect = sheet?.getBoundingClientRect();
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      right: rect.right,
      sheetRight: sheetRect?.right ?? 0,
      height: rect.height,
    };
  });
  expect(metrics.height, `título «${title}» con altura`).toBeGreaterThan(0);
  expect(metrics.right).toBeLessThanOrEqual(metrics.sheetRight + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertPerioArchGeometry(page: Page, formatCode: string) {
  const geometry = await page.evaluate((code) => {
    const format = document.querySelector(`[data-format="${code}"]`);
    const arches = [...document.querySelectorAll('[data-testid="perio-arch"]')];
    if (!(format instanceof HTMLElement) || arches.length !== 2) {
      return null;
    }
    const formatBox = format.getBoundingClientRect();
    return arches.map((node) => {
      const box = node.getBoundingClientRect();
      return {
        widthRatio: box.width / formatBox.width,
        aspect: box.width / box.height,
      };
    });
  }, formatCode);

  expect(geometry, `geometría de arcadas medible en ${formatCode}`).not.toBeNull();
  for (const arch of geometry!) {
    expect(arch.widthRatio).toBeGreaterThan(0.85);
    expect(arch.aspect).toBeGreaterThan(2.3);
    expect(arch.aspect).toBeLessThan(2.6);
  }
}

test.describe('Rutas HTTP y títulos', () => {
  test('el catálogo responde 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(SITE_TITLE);
  });

  for (const format of FORMATS) {
    test(`${format.code} responde 200 y usa el título del layout`, async ({ page }) => {
      const response = await page.goto(format.path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(format.title);
    });
  }
});

test.describe('Documentos de formato', () => {
  for (const format of FORMATS) {
    test(`${format.code} tiene una sola hoja, identificación y campos compartidos`, async ({
      page,
    }) => {
      await page.goto(format.path);

      await expect(page.locator('.sheet')).toHaveCount(1);
      await expect(page.getByText(format.code, { exact: true })).toBeVisible();
      await expect(page.getByText('REV. 01', { exact: true })).toBeVisible();
      await expect(page.getByText('1/1', { exact: true })).toBeVisible();

      for (const field of SHARED_FIELDS) {
        await expect(page.getByText(field, { exact: true })).toBeVisible();
      }
    });

    test(`${format.code} no presenta el diagrama adicional ni overflow en Carta`, async ({
      page,
    }) => {
      await page.goto(format.path);

      const bodyText = (await page.locator('body').innerText()).toLowerCase();
      for (const phrase of FORBIDDEN_COPY) {
        expect(bodyText, `no debe aparecer «${phrase}»`).not.toContain(phrase);
      }
      expect(bodyText, 'no debe aparecer «odontograma» como palabra').not.toMatch(/\bodontograma\b/);

      await assertNoSheetOverflow(page);
    });
  }

  test('ODO-F01 conserva EXPEDIENTES, FOLIOS y cinco filas', async ({ page }) => {
    await page.goto('/formatos/expedientes/');

    await expect(page.getByText('EXPEDIENTES', { exact: true })).toBeVisible();
    await expect(page.getByText('FOLIOS', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="folio-row"]')).toHaveCount(5);
    await expect(page.locator('[data-testid="rx-cell"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="evento-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="legend-marker"]')).toHaveCount(0);
  });

  test('ODO-F02 conserva PACIENTE, Rx, Tx, NOTAS y recuentos', async ({ page }) => {
    await page.goto('/formatos/paciente-rx-tx/');

    await expect(page.getByRole('heading', { name: 'PACIENTE', exact: true })).toBeVisible();
    await expect(page.getByText('Rx', { exact: true })).toBeVisible();
    await expect(page.getByText('Tx', { exact: true })).toBeVisible();
    await expect(page.getByText('NOTAS', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="rx-cell"]')).toHaveCount(6);
    await expect(page.locator('[data-testid="nota-line"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="superior"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="inferior"]')).toHaveCount(1);
    await expect(page.locator('[data-slot^="lat-"]')).toHaveCount(4);
  });

  test('ODO-F02 dispone las casillas Rx en cruz (superior, laterales, inferior)', async ({
    page,
  }) => {
    await page.goto('/formatos/paciente-rx-tx/');

    const layout = await page.locator('.rx-grid').evaluate((grid) => {
      const styles = getComputedStyle(grid);
      const cell = (slot: string) => {
        const el = grid.querySelector(`[data-slot="${slot}"]`);
        if (!(el instanceof HTMLElement)) {
          return null;
        }
        const rect = el.getBoundingClientRect();
        return {
          cx: rect.x + rect.width / 2,
          cy: rect.y + rect.height / 2,
          left: rect.left,
          right: rect.right,
        };
      };

      return {
        columns: styles.gridTemplateColumns.split(' ').filter(Boolean).length,
        rows: styles.gridTemplateRows.split(' ').filter(Boolean).length,
        superior: cell('superior'),
        inferior: cell('inferior'),
        l1: cell('lat-izq-1'),
        l2: cell('lat-izq-2'),
        r1: cell('lat-der-1'),
        r2: cell('lat-der-2'),
      };
    });

    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(3);
    expect(layout.superior).not.toBeNull();
    expect(layout.inferior).not.toBeNull();
    expect(layout.l1).not.toBeNull();
    expect(layout.r2).not.toBeNull();

    expect(layout.superior!.cy).toBeLessThan(layout.l1!.cy);
    expect(layout.inferior!.cy).toBeGreaterThan(layout.l1!.cy);
    expect(Math.abs(layout.superior!.cx - layout.inferior!.cx)).toBeLessThan(2);

    expect(layout.l1!.right).toBeLessThan(layout.superior!.cx);
    expect(layout.l2!.right).toBeLessThan(layout.superior!.cx);
    expect(layout.r1!.left).toBeGreaterThan(layout.superior!.cx);
    expect(layout.r2!.left).toBeGreaterThan(layout.superior!.cx);
    expect(layout.l1!.left).toBeLessThan(layout.l2!.left);
    expect(layout.r1!.left).toBeLessThan(layout.r2!.left);
  });

  test('ODO-F03 conserva EVENTOS y cuatro paneles 01–04', async ({ page }) => {
    await page.goto('/formatos/eventos/');

    await expect(page.getByText('EVENTOS', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="evento-panel"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="evento-panel"]')).toHaveText(['01', '02', '03', '04']);
  });

  test('ODO-F04 conserva PACIENTE, NOTAS y las cuatro leyendas', async ({ page }) => {
    await page.goto('/formatos/paciente-imagen/');

    await expect(page.getByRole('heading', { name: 'PACIENTE', exact: true })).toBeVisible();
    await expect(page.getByText('NOTAS', { exact: true })).toBeVisible();
    await expect(page.getByText('Rojo', { exact: true })).toBeVisible();
    await expect(page.getByText('Azul', { exact: true })).toBeVisible();
    await expect(page.getByText('Verde', { exact: true })).toBeVisible();
    await expect(page.getByText('Otro', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="legend-marker"]')).toHaveCount(4);
    await expect(page.locator('svg[data-testid="odontogram"]')).toBeVisible();
    await expect(page.locator('[data-testid="tooth"]')).toHaveCount(52);
    await expect(page.locator('[data-testid="imagen-notas"]')).toHaveCount(1);
  });

  test('ODO-F05 periodontograma: arcos, oclusión, paneles y textos', async ({ page }) => {
    await page.goto('/formatos/periodontograma/');

    await expect(page.locator('[data-testid="perio-arch"]')).toHaveCount(2);

    const arches = page.locator('[data-testid="perio-arch"]');
    await expect(arches.nth(0).locator('[data-testid="perio-tooth"]')).toHaveCount(32);
    await expect(arches.nth(1).locator('[data-testid="perio-tooth"]')).toHaveCount(32);

    await expect(page.locator('[data-testid="perio-occlusion-group"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="perio-occlusion-mid"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="perio-panel"]')).toHaveCount(2);

    await expect(page.getByText('SIMBOLOGÍA', { exact: true })).toBeVisible();
    await expect(page.getByText('EXAMEN RADIOGRÁFICO', { exact: true })).toBeVisible();
    await expect(page.getByText('HIGIENE ORAL / NOTAS', { exact: true })).toHaveCount(0);
    await expect(page.getByText('OTROS / OBSERVACIONES', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Facial', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Lingual', { exact: true })).toHaveCount(2);

    await expect(page.locator('[data-testid="odontogram"]')).toHaveCount(0);

    await expect(page.locator('[data-testid="perio-hallazgo-line"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="perio-hallazgo-mid"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="perio-hallazgo"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="perio-higiene-line"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="perio-otros-line"]')).toHaveCount(0);

    const notes = page.locator('.perio-notes');
    await expect(notes).toHaveCount(1);
    await expect(notes).toHaveAttribute('data-count', '4');

    const panelWidths = await page.locator('[data-testid="perio-panel"]').evaluateAll((panels) =>
      panels.map((panel) => panel.getBoundingClientRect().width),
    );
    expect(panelWidths).toHaveLength(2);
    expect(panelWidths[1]).toBeGreaterThan(panelWidths[0] * 3.5);

    await assertPerioNotes(page, 'letter');

    const geometry = await page.evaluate(() => {
      const format = document.querySelector('[data-format="ODO-F05"]');
      const arches = [...document.querySelectorAll('[data-testid="perio-arch"]')];
      if (!(format instanceof HTMLElement) || arches.length !== 2) {
        return null;
      }
      const formatBox = format.getBoundingClientRect();
      return arches.map((node) => {
        const box = node.getBoundingClientRect();
        return {
          widthRatio: box.width / formatBox.width,
          aspect: box.width / box.height,
        };
      });
    });

    expect(geometry, 'geometría de arcadas medible').not.toBeNull();
    for (const arch of geometry!) {
      expect(arch.widthRatio).toBeGreaterThan(0.85);
      expect(arch.aspect).toBeGreaterThan(2.3);
      expect(arch.aspect).toBeLessThan(2.6);
    }

    for (const paper of OCCLUSION_PAPERS) {
      await page.goto(`/formatos/periodontograma/${paper.query}`);
      await expect(page.locator('html')).toHaveAttribute('data-paper-size', paper.id);
      await expect(page.locator('[data-testid="perio-occlusion-group"]')).toHaveCount(4);

      const panelTitles = page.locator('[data-testid="perio-panel"] .outlined-panel__title');
      await expect(panelTitles).toHaveCount(2);
      const titleMetrics = await panelTitles.evaluateAll((titles) =>
        titles.map((title) => {
          const box = title.getBoundingClientRect();
          const styles = getComputedStyle(title);
          return {
            height: box.height,
            fontSize: styles.fontSize,
            paddingTop: styles.paddingTop,
            paddingBottom: styles.paddingBottom,
          };
        }),
      );
      expect(
        Math.abs(titleMetrics[0].height - titleMetrics[1].height),
        `títulos de panel con la misma altura en ${paper.id}`,
      ).toBeLessThanOrEqual(0.5);
      expect(titleMetrics[1]).toMatchObject({
        fontSize: titleMetrics[0].fontSize,
        paddingTop: titleMetrics[0].paddingTop,
        paddingBottom: titleMetrics[0].paddingBottom,
      });

      await assertPerioOcclusion(page, paper.id);
      await assertPerioNotes(page, paper.id);
      await assertPerioSymbology(page, paper.id, paper.id === 'letter' ? 1 : 2);
      await assertPerioSpriteContract(page, paper.id);
    }
  });

  test('ODO-F05 periodontograma: 16 dientes superiores, 16 inferiores y perfiles inferiores hacia arriba', async ({
    page,
  }) => {
    for (const paper of OCCLUSION_PAPERS) {
      await page.goto(`/formatos/periodontograma/${paper.query}`);
      await expect(page.locator('html')).toHaveAttribute('data-paper-size', paper.id);
      await expect(page.locator('[data-testid="perio-arch"]')).toHaveCount(2);
      await assertPerioSpriteContract(page, paper.id);
    }
  });

  test('ODO-F05 periodontograma: el sólido resuelve a papel claro y el contorno a tinta oscura en pantalla y en print', async ({
    page,
  }) => {
    await page.goto('/formatos/periodontograma/');
    await expect(page.locator('[data-testid="perio-arch"]')).toHaveCount(2);

    await assertPerioSpriteContract(page, 'pantalla');

    await page.emulateMedia({ media: 'print' });
    await assertPerioSpriteContract(page, 'print');
  });

  test('ODO-F06 periodontograma temporal: arcos, oclusión, paneles y geometría', async ({ page }) => {
    await page.goto('/formatos/periodontograma-temporal/');

    await expect(page.locator('[data-format="ODO-F06"][data-dentition="temporal"]')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'PERIODONTOGRAMA TEMPORAL' })).toBeVisible();
    await expect(page.locator('[data-testid="perio-arch"]')).toHaveCount(2);

    const arches = page.locator('[data-testid="perio-arch"]');
    await expect(arches.nth(0).locator('[data-testid="perio-tooth"]')).toHaveCount(20);
    await expect(arches.nth(1).locator('[data-testid="perio-tooth"]')).toHaveCount(20);

    await expect(page.locator('[data-testid="perio-occlusion-group"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="perio-occlusion-mid"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="perio-panel"]')).toHaveCount(2);

    await expect(page.getByText('SIMBOLOGÍA', { exact: true })).toBeVisible();
    await expect(page.getByText('EXAMEN RADIOGRÁFICO', { exact: true })).toBeVisible();
    await expect(page.getByText('Facial', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Lingual', { exact: true })).toHaveCount(2);
    await expect(page.locator('[data-testid="odontogram"]')).toHaveCount(0);

    await assertPerioNotes(page, 'letter');
    await assertPerioArchGeometry(page, 'ODO-F06');
    await assertHeaderTitleFits(page, 'PERIODONTOGRAMA TEMPORAL');

    const molarVsIncisor = await page.evaluate(() => {
      const hrefId = (node: Element | null): string => {
        if (!node) {
          return '';
        }
        const raw =
          node.getAttribute('href') ??
          node.getAttribute('xlink:href') ??
          (node instanceof SVGUseElement ? node.href.baseVal : '') ??
          '';
        const hash = raw.includes('#') ? raw.slice(raw.lastIndexOf('#') + 1) : raw;
        return hash.trim();
      };
      const lower = document.querySelector('[data-arch="lower"]');
      const molar = lower?.querySelector('[data-testid="perio-tooth"][data-fdi="8.5"][data-row="profile"]');
      const incisor = lower?.querySelector(
        '[data-testid="perio-tooth"][data-fdi="8.1"][data-row="profile"]',
      );
      if (!(molar instanceof SVGGraphicsElement) || !(incisor instanceof SVGGraphicsElement)) {
        return null;
      }
      return {
        molarWidth: molar.getBBox().width,
        incisorWidth: incisor.getBBox().width,
        molarId: hrefId(molar.querySelector('use.perio-arch__outline')),
      };
    });
    expect(molarVsIncisor, 'molar 8.5 medible').not.toBeNull();
    expect(molarVsIncisor!.molarId).toBe('temporal_85_profile');
    expect(molarVsIncisor!.molarWidth).toBeGreaterThan(molarVsIncisor!.incisorWidth);

    for (const paper of OCCLUSION_PAPERS) {
      await page.goto(`/formatos/periodontograma-temporal/${paper.query}`);
      await expect(page.locator('html')).toHaveAttribute('data-paper-size', paper.id);
      await expect(page.locator('[data-testid="perio-occlusion-group"]')).toHaveCount(4);
      await assertHeaderTitleFits(page, 'PERIODONTOGRAMA TEMPORAL');
      await assertPerioOcclusion(page, paper.id, OCCLUSION_TEMPORAL_CELLS);
      await assertPerioNotes(page, paper.id);
      await assertPerioSymbology(page, paper.id, paper.id === 'letter' ? 1 : 2);
      await assertTemporalPerioSpriteContract(page, paper.id);
      await assertPerioArchGeometry(page, 'ODO-F06');
    }
  });

  test('ODO-F06 periodontograma temporal: 10 dientes por arcada y perfiles inferiores hacia arriba', async ({
    page,
  }) => {
    for (const paper of OCCLUSION_PAPERS) {
      await page.goto(`/formatos/periodontograma-temporal/${paper.query}`);
      await expect(page.locator('html')).toHaveAttribute('data-paper-size', paper.id);
      await expect(page.locator('[data-testid="perio-arch"]')).toHaveCount(2);
      const arches = page.locator('[data-testid="perio-arch"]');
      await expect(arches.nth(0).locator('[data-testid="perio-tooth"]')).toHaveCount(20);
      await expect(arches.nth(1).locator('[data-testid="perio-tooth"]')).toHaveCount(20);
      await assertTemporalPerioSpriteContract(page, paper.id);
    }
  });

  test('ODO-F06 periodontograma temporal: el sólido resuelve a papel claro y el contorno a tinta oscura', async ({
    page,
  }) => {
    await page.goto('/formatos/periodontograma-temporal/');
    await expect(page.locator('[data-testid="perio-arch"]')).toHaveCount(2);

    await assertTemporalPerioSpriteContract(page, 'pantalla');

    await page.emulateMedia({ media: 'print' });
    await assertTemporalPerioSpriteContract(page, 'print');
  });

  test('ODO-F04 dispone el diagrama dental (pasillo, homólogos, labels)', async ({
    page,
  }) => {
    await page.goto('/formatos/paciente-imagen/');

    await expect(page.locator('svg[data-testid="odontogram"]')).toBeVisible();
    await expect(page.locator('[data-testid="tooth"]')).toHaveCount(52);

    const cornerFdis = [
      '1.8',
      '1.1',
      '2.1',
      '2.8',
      '5.5',
      '5.1',
      '6.1',
      '6.5',
      '8.5',
      '8.1',
      '7.1',
      '7.5',
      '4.8',
      '4.1',
      '3.1',
      '3.8',
    ] as const;

    for (const fdi of cornerFdis) {
      await expect(page.getByText(fdi, { exact: true })).toBeVisible();
    }

    const layout = await page.locator('svg[data-testid="odontogram"]').evaluate((root) => {
      const measure = (fdi: string) => {
        const group = root.querySelector(`[data-testid="tooth"][data-fdi="${fdi}"]`);
        if (!(group instanceof SVGGElement)) {
          return null;
        }

        const circles = [...group.querySelectorAll('circle')];
        const outer = circles.reduce<SVGCircleElement | null>((best, circle) => {
          const radius = Number(circle.getAttribute('r') ?? 0);
          const bestRadius = best ? Number(best.getAttribute('r') ?? 0) : -1;
          return radius > bestRadius ? circle : best;
        }, null);
        const label = group.querySelector('text');

        if (!outer || !label) {
          return null;
        }

        const circleRect = outer.getBoundingClientRect();
        const textRect = label.getBoundingClientRect();

        return {
          circle: {
            left: circleRect.left,
            right: circleRect.right,
            cx: circleRect.x + circleRect.width / 2,
            cy: circleRect.y + circleRect.height / 2,
          },
          text: {
            cy: textRect.y + textRect.height / 2,
          },
        };
      };

      return {
        t11: measure('1.1'),
        t21: measure('2.1'),
        t51: measure('5.1'),
        t18: measure('1.8'),
        t48: measure('4.8'),
      };
    });

    expect(layout.t11).not.toBeNull();
    expect(layout.t21).not.toBeNull();
    expect(layout.t51).not.toBeNull();
    expect(layout.t18).not.toBeNull();
    expect(layout.t48).not.toBeNull();

    expect(layout.t11!.circle.right).toBeLessThan(layout.t21!.circle.left);
    expect(Math.abs(layout.t51!.circle.cx - layout.t11!.circle.cx)).toBeLessThanOrEqual(2);
    expect(layout.t18!.text.cy).toBeLessThan(layout.t18!.circle.cy);
    expect(layout.t48!.text.cy).toBeGreaterThan(layout.t48!.circle.cy);
  });
});
