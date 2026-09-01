import { describe, expect, test } from "bun:test";
import { exportFileName, exportPngEntryName, exportPngZipFileName } from "./formats";
import { normalizeExportSettings, PAPER_SIZE_STORAGE_KEY, PRINT_EXPORT_STORAGE_KEY, readExportSettings, writeExportSettings, type StorageLike } from "./settings";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

describe("normalizeExportSettings", () => {
  test("letter diseño + a4 papel + booklet → papel letter y layout 1up", () => {
    const settings = normalizeExportSettings(
      { design: "letter", paper: "a4", layout: "booklet" },
      "expedientes",
    );

    expect(settings.design).toBe("letter");
    expect(settings.paper).toBe("letter");
    expect(settings.layout).toBe("1up");
    expect(settings.orientation).toBe("portrait");
  });

  test("selección vacía rellena el formato actual", () => {
    expect(normalizeExportSettings({ formats: [] }, "eventos").formats).toEqual(["eventos"]);
    expect(normalizeExportSettings({}, "paciente-imagen").formats).toEqual(["paciente-imagen"]);
  });

  test("formatos desconocidos se descartan y no se duplican", () => {
    const settings = normalizeExportSettings(
      { formats: ["eventos", "desconocido", "expedientes", "eventos", "n/a"] },
      "paciente-rx-tx",
    );

    expect(settings.formats).toEqual(["eventos", "expedientes"]);
  });
});

describe("persistencia", () => {
  test("escribe odo-print-export y el espejo odo-paper-size", () => {
    const storage = memoryStorage();
    const settings = normalizeExportSettings(
      { design: "a5", paper: "a4", layout: "booklet", formats: ["paciente-rx-tx"] },
      "expedientes",
    );

    writeExportSettings(settings, storage);

    const stored = JSON.parse(storage.getItem(PRINT_EXPORT_STORAGE_KEY) ?? "null");
    expect(stored).toMatchObject({
      design: "a5",
      paper: "a4",
      layout: "booklet",
      orientation: "landscape",
      formats: ["paciente-rx-tx"],
    });
    expect(storage.getItem(PAPER_SIZE_STORAGE_KEY)).toBe("a5");
    expect(readExportSettings("expedientes", storage)).toEqual(settings);
  });

  test("si el almacenamiento falla, no crashea y conserva el valor en memoria", () => {
    const throwing: StorageLike = {
      getItem() {
        throw new Error("private");
      },
      setItem() {
        throw new Error("private");
      },
    };

    const settings = normalizeExportSettings(
      { design: "a6", paper: "a6", layout: "1up", formats: ["eventos"] },
      "expedientes",
    );

    expect(() => writeExportSettings(settings, throwing)).not.toThrow();
    expect(() => readExportSettings("expedientes", throwing)).not.toThrow();
    expect(readExportSettings("expedientes", throwing)).toEqual(settings);
  });
});

describe("exportFileName", () => {
  test("un formato usa el código; varios usan el prefijo de libro", () => {
    expect(
      exportFileName({
        formats: ["paciente-rx-tx"],
        design: "a5",
        paper: "a4",
        layout: "booklet",
      }),
    ).toBe("ODO-F02-a5-sobre-a4-cuadernillo.pdf");

    expect(
      exportFileName({
        formats: ["expedientes", "eventos"],
        design: "letter",
        paper: "letter",
        layout: "1up",
      }),
    ).toBe("libro-odontologico-letter-sobre-letter-1up.pdf");
  });
});

describe("exportPngZipFileName y exportPngEntryName", () => {
  test("un formato A5: zip y entrada con código y sin-fondo", () => {
    expect(
      exportPngZipFileName({
        formats: ["expedientes"],
        design: "a5",
      }),
    ).toBe("ODO-F01-a5-sin-fondo.zip");

    expect(
      exportPngEntryName({
        index: 1,
        format: "expedientes",
        design: "a5",
      }),
    ).toBe("01-ODO-F01-a5-sin-fondo.png");
  });

  test("dos formatos letter: zip de libro y entradas 01 / 02", () => {
    expect(
      exportPngZipFileName({
        formats: ["expedientes", "paciente-rx-tx"],
        design: "letter",
      }),
    ).toBe("libro-odontologico-letter-sin-fondo.zip");

    expect(
      exportPngEntryName({
        index: 1,
        format: "expedientes",
        design: "letter",
      }),
    ).toBe("01-ODO-F01-letter-sin-fondo.png");

    expect(
      exportPngEntryName({
        index: 2,
        format: "paciente-rx-tx",
        design: "letter",
      }),
    ).toBe("02-ODO-F02-letter-sin-fondo.png");
  });
});
