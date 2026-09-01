/**
 * ZIP de PNG para editar: captura transparente → fflate → Blob application/zip.
 */
import { zip } from 'fflate';
import { exportPngEntryName, exportPngZipFileName } from '../lib/print-export/formats';
import { normalizeExportSettings, readExportSettings } from '../lib/print-export/settings';
import { captureFormats, currentDesignId, currentFormatId } from './export-pdf';
import { showExportError } from './export-panel';

function asPngBytes(input: Uint8Array | ArrayLike<number>): Uint8Array {
  return input instanceof Uint8Array ? input : Uint8Array.from(input);
}

function toArrayBuffer(bytes: Uint8Array | ArrayLike<number>): ArrayBuffer {
  const source = asPngBytes(bytes);
  const copy = new ArrayBuffer(source.byteLength);
  new Uint8Array(copy).set(source);
  return copy;
}

function triggerZipDownload(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([toArrayBuffer(bytes)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 2_000);
}

function zipPngEntries(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const tree: Record<string, [Uint8Array, { level: 0 }]> = {};
    for (const [name, data] of Object.entries(files)) {
      tree[name] = [data, { level: 0 }];
    }
    zip(tree, { level: 0 }, (err, data) => {
      if (err || !data) {
        reject(err ?? new Error('No se pudo empaquetar el ZIP.'));
        return;
      }
      resolve(data);
    });
  });
}

/** Descarga ZIP con los ajustes del panel (diseño + formatos). Fondo de hoja transparente. */
export async function downloadConfiguredPngZip(): Promise<Uint8Array> {
  const formatId = currentFormatId();
  const stored = readExportSettings(formatId);
  const settings = normalizeExportSettings({ ...stored, design: currentDesignId() }, formatId);

  try {
    const captures = await captureFormats(
      settings,
      document.querySelector<HTMLElement>('.sheet'),
      formatId,
      { background: 'transparent' },
    );

    const files: Record<string, Uint8Array> = {};
    for (const [offset, id] of settings.formats.entries()) {
      const bytes = captures[offset];
      if (!bytes) {
        throw new Error('Falta una captura para el ZIP de PNG.');
      }
      files[exportPngEntryName({ index: offset + 1, format: id, design: settings.design })] = asPngBytes(bytes);
    }

    if (Object.keys(files).length === 0) {
      throw new Error('No hay capturas para empaquetar el ZIP.');
    }

    const zipBytes = await zipPngEntries(files);
    triggerZipDownload(zipBytes, exportPngZipFileName({ formats: settings.formats, design: settings.design }));
    return zipBytes;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!showExportError(detail)) {
      window.alert(detail);
    }
    throw error;
  }
}
