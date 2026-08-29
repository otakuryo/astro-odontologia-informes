/**
 * Captura de `.sheet` a PNG a 300 dpi con html-to-image.
 * La ruta actual se toma del DOM vivo; otras rutas, de un iframe del mismo origen.
 */
import { toPng } from 'html-to-image';
import type { DesignSizeId } from '../lib/print-export/types';

/** 1 CSS px = 1/96 in; pixelRatio = dpi de captura / 96. */
export const PRINT_CAPTURE_DPI = 300;
export const CSS_DPI = 96;
export const CAPTURE_PIXEL_RATIO = PRINT_CAPTURE_DPI / CSS_DPI;

const IFRAME_WAIT_MS = 20_000;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Cede un frame para que el cromo pinte «Descargando…» antes de bloquear con html-to-image. */
export function yieldForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });
}

function isHiddenFromPrint(node: Node): boolean {
  if (node.nodeType !== 1) {
    return false;
  }
  const el = node as Element;
  return el.hasAttribute('data-print-hide') || el.classList.contains('web-chrome');
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function waitForFonts(doc: Document): Promise<void> {
  if (doc.fonts?.ready) {
    await doc.fonts.ready;
  }
}

async function waitForImages(root: ParentNode): Promise<void> {
  const images = [...root.querySelectorAll('img')];
  await Promise.all(
    images.map((img) => {
      if (img.complete) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
}

function isPaintNone(value: string): boolean {
  const paint = value.trim().toLowerCase();
  return paint === '' || paint === 'none' || paint === 'transparent' || paint === 'rgba(0, 0, 0, 0)';
}

type RestoreFn = () => void;

function snapshotInline(el: Element): RestoreFn {
  const prevStyle = el.getAttribute('style');
  const prevAttrs = ['fill', 'stroke', 'stroke-width', 'vector-effect'].map((name) => ({
    name,
    value: el.getAttribute(name),
  }));

  return () => {
    if (prevStyle === null) {
      el.removeAttribute('style');
    } else {
      el.setAttribute('style', prevStyle);
    }
    for (const { name, value } of prevAttrs) {
      if (value === null) {
        el.removeAttribute(name);
      } else {
        el.setAttribute(name, value);
      }
    }
  };
}

/**
 * html-to-image hace `cloneNode(true)` del `<svg>` y no copia CSS a círculos/líneas.
 * El relleno `--paper` queda blanco y el trazo (solo en CSS) desaparece; los `<text>`
 * sí se ven porque el fill por defecto del SVG es negro. Inlinamos pintura calculada
 * para que el clon conserve odontograma y leyenda.
 */
function prepareSheetForCapture(root: HTMLElement): RestoreFn {
  const view = root.ownerDocument?.defaultView;
  if (!view) {
    return () => {};
  }

  const restores: RestoreFn[] = [];

  root.querySelectorAll('svg').forEach((svg) => {
    const svgCs = view.getComputedStyle(svg);
    restores.push(snapshotInline(svg));
    svg.style.color = svgCs.color;

    svg.querySelectorAll('*').forEach((el) => {
      if (el.namespaceURI !== SVG_NS) {
        return;
      }

      const cs = view.getComputedStyle(el);
      restores.push(snapshotInline(el));

      const style = (el as SVGElement).style;
      const fill = cs.fill;
      const stroke = cs.stroke;

      style.vectorEffect = 'none';

      if (isPaintNone(fill)) {
        style.fill = 'none';
        el.setAttribute('fill', 'none');
      } else {
        style.fill = fill;
        el.setAttribute('fill', fill);
      }

      if (isPaintNone(stroke)) {
        style.stroke = 'none';
        el.setAttribute('stroke', 'none');
      } else {
        style.stroke = stroke;
        el.setAttribute('stroke', stroke);
        style.strokeWidth = cs.strokeWidth;
        el.setAttribute('stroke-width', cs.strokeWidth);
      }
    });
  });

  root.querySelectorAll('.legend-marker__swatch').forEach((el) => {
    const cs = view.getComputedStyle(el);
    restores.push(snapshotInline(el));
    const style = (el as HTMLElement).style;
    style.backgroundColor = cs.backgroundColor;
    style.backgroundImage = cs.backgroundImage;
    style.backgroundSize = cs.backgroundSize;
    style.backgroundPosition = cs.backgroundPosition;
    style.backgroundRepeat = cs.backgroundRepeat;
    style.borderColor = cs.borderColor;
    style.borderStyle = cs.borderStyle;
    style.borderWidth = cs.borderWidth;
    style.color = cs.color;
    style.printColorAdjust = 'exact';
  });

  return () => {
    for (let index = restores.length - 1; index >= 0; index -= 1) {
      restores[index]?.();
    }
  };
}

function waitForSheet(doc: Document): Promise<HTMLElement> {
  const existing = doc.querySelector('.sheet');
  // No `instanceof HTMLElement`: el nodo del iframe es de otro reino.
  if (existing) {
    return Promise.resolve(existing as HTMLElement);
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error('Tiempo de espera agotado al cargar el formato.'));
    }, IFRAME_WAIT_MS);

    const observer = new MutationObserver(() => {
      const el = doc.querySelector('.sheet');
      if (el) {
        window.clearTimeout(timer);
        observer.disconnect();
        resolve(el as HTMLElement);
      }
    });

    observer.observe(doc.documentElement, { childList: true, subtree: true });
  });
}

/** PNG de un `.sheet` vivo. No incluye la barra (`.web-chrome` / `[data-print-hide]`). */
export async function captureSheet(el: HTMLElement): Promise<Uint8Array> {
  const doc = el.ownerDocument ?? document;
  await waitForFonts(doc);
  await waitForImages(el);

  await yieldForPaint();
  const restore = prepareSheetForCapture(el);
  try {
    const dataUrl = await toPng(el, {
      pixelRatio: CAPTURE_PIXEL_RATIO,
      backgroundColor: '#ffffff',
      skipAutoScale: true,
      style: {
        boxShadow: 'none',
        margin: '0',
        /* La preview de pantalla puede llevar scale; el PDF debe salir al 100 %. */
        transform: 'none',
        zoom: '1',
      },
      filter: (node) => !isHiddenFromPrint(node as Node),
    });
    return dataUrlToUint8Array(dataUrl);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No se pudo capturar la hoja. Usa «Imprimir hoja» como alternativa. ${detail}`,
    );
  } finally {
    restore();
  }
}

function waitForIframeDocument(iframe: HTMLIFrameElement): Promise<Document> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (doc: Document | null, error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      iframe.removeEventListener('load', inspect);
      iframe.removeEventListener('error', onError);
      if (error) {
        reject(error);
        return;
      }
      if (doc) {
        resolve(doc);
      }
    };

    const inspect = () => {
      const doc = iframe.contentDocument;
      if (doc?.querySelector('.sheet')) {
        finish(doc);
      }
    };

    const onError = () => {
      finish(null, new Error('No se pudo cargar el formato para capturar.'));
    };

    const timer = window.setTimeout(() => {
      const doc = iframe.contentDocument;
      finish(
        null,
        new Error(
          `Tiempo de espera agotado al cargar el formato. src=${iframe.src} href=${doc?.location?.href ?? 'n/a'}`,
        ),
      );
    }, IFRAME_WAIT_MS);

    iframe.addEventListener('load', inspect);
    iframe.addEventListener('error', onError);
    const poll = window.setInterval(inspect, 32);
    inspect();
  });
}

function iframeHost(): HTMLElement {
  const dialog = document.querySelector('[data-testid="export-panel"]');
  if (dialog instanceof HTMLDialogElement && dialog.open) {
    return dialog;
  }
  return document.body;
}

/**
 * Carga `url?papel=<diseño>` en un iframe del mismo origen, captura su `.sheet` y destruye el iframe.
 */
export async function captureFormatByUrl(url: string, design: DesignSizeId): Promise<Uint8Array> {
  const frameUrl = new URL(url, window.location.origin);
  frameUrl.searchParams.set('papel', design);

  const iframe = document.createElement('iframe');
  iframe.title = 'Captura de formato';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('loading', 'eager');
  iframe.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 240mm',
    'height: 360mm',
    'opacity: 0.01',
    'border: 0',
    'pointer-events: none',
    'z-index: 2147483646',
  ].join(';');

  const frameDocPromise = waitForIframeDocument(iframe);
  iframeHost().appendChild(iframe);
  iframe.src = frameUrl.href;

  try {
    const frameDoc = await frameDocPromise;
    const sheet = await waitForSheet(frameDoc);
    await waitForFonts(frameDoc);
    await waitForImages(sheet);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    return await captureSheet(sheet);
  } finally {
    iframe.remove();
  }
}
