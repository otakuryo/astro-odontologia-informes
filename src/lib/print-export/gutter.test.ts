import { describe, expect, test } from "bun:test";
import {
  buildCapturePlan,
  captureJobKey,
  gutterQuery,
  gutterSideForBookletSlot,
  gutterSideForPage,
  normalizeGutterMm,
  normalizeGutterSide,
  oppositeSide,
  parseGutterQuery,
} from "./gutter";
import { imposeBooklet } from "./impose";
import { normalizeExportSettings } from "./settings";
import { FORMAT_IDS, type FormatId } from "./types";

describe("normalizeGutterMm", () => {
  test("recorta al rango [10, 15]; no numéricos y negativos → 0", () => {
    expect(normalizeGutterMm(9)).toBe(10);
    expect(normalizeGutterMm(20)).toBe(15);
    expect(normalizeGutterMm("12")).toBe(12);
    expect(normalizeGutterMm(12.4)).toBe(12);
    expect(normalizeGutterMm("abc")).toBe(0);
    expect(normalizeGutterMm(null)).toBe(0);
    expect(normalizeGutterMm(-3)).toBe(0);
  });
});

describe("normalizeGutterSide", () => {
  test("alias derecha → right; default left", () => {
    expect(normalizeGutterSide("derecha")).toBe("right");
    expect(normalizeGutterSide("right")).toBe("right");
    expect(normalizeGutterSide("izquierda")).toBe("left");
    expect(normalizeGutterSide("left")).toBe("left");
    expect(normalizeGutterSide(undefined)).toBe("left");
    expect(normalizeGutterSide("arriba")).toBe("left");
  });
});

describe("gutterSideForPage", () => {
  test("1up con left: L, R, L, R", () => {
    expect(gutterSideForPage("1up", 0, "left")).toBe("left");
    expect(gutterSideForPage("1up", 1, "left")).toBe("right");
    expect(gutterSideForPage("1up", 2, "left")).toBe("left");
    expect(gutterSideForPage("1up", 3, "left")).toBe("right");
  });

  test("1up con right: R, L, R, L", () => {
    expect(gutterSideForPage("1up", 0, "right")).toBe("right");
    expect(gutterSideForPage("1up", 1, "right")).toBe("left");
    expect(gutterSideForPage("1up", 2, "right")).toBe("right");
    expect(gutterSideForPage("1up", 3, "right")).toBe("left");
  });

  test("duplicate siempre el lado configurado", () => {
    expect(gutterSideForPage("duplicate", 0, "left")).toBe("left");
    expect(gutterSideForPage("duplicate", 1, "left")).toBe("left");
    expect(gutterSideForPage("duplicate", 0, "right")).toBe("right");
    expect(gutterSideForPage("duplicate", 1, "right")).toBe("right");
  });
});

describe("gutterSideForBookletSlot", () => {
  test("hacia el pliegue", () => {
    expect(gutterSideForBookletSlot("left")).toBe("right");
    expect(gutterSideForBookletSlot("right")).toBe("left");
    expect(oppositeSide("left")).toBe("right");
  });
});

describe("buildCapturePlan", () => {
  test("cuadernillo de 4 formatos: lados hacia el pliegue según imposeBooklet(4)", () => {
    const sheets = imposeBooklet(4);
    expect(sheets).toHaveLength(2);

    const settings = normalizeExportSettings(
      {
        design: "a5",
        paper: "a4",
        layout: "booklet",
        formats: [...FORMAT_IDS],
        gutterMm: 12,
        gutterSide: "left",
      },
      "expedientes",
    );

    const jobs = buildCapturePlan(settings);
    expect(jobs).toHaveLength(4);
    expect(jobs.map((job) => job.format)).toEqual([...FORMAT_IDS]);
    expect(jobs.map((job) => job.gutterSide)).toEqual(["left", "right", "left", "right"]);
    expect(jobs.every((job) => job.gutterMm === 12)).toBe(true);

    const sideByFormat = Object.fromEntries(jobs.map((job) => [job.format, job.gutterSide]));
    const expectedByPage: Record<number, "left" | "right"> = {
      1: "left",
      2: "right",
      3: "left",
      4: "right",
    };

    for (const sheet of sheets) {
      for (const position of ["left", "right"] as const) {
        const slot = sheet[position];
        if (slot.kind === "blank") {
          continue;
        }
        const format = FORMAT_IDS[slot.index] as FormatId;
        const page = slot.index + 1;
        expect(sideByFormat[format]).toBe(expectedByPage[page]);
        expect(sideByFormat[format]).toBe(gutterSideForBookletSlot(position));
      }
    }
  });

  test("cuadernillo de 1 formato produce 1 job", () => {
    const settings = normalizeExportSettings(
      {
        design: "a5",
        paper: "a4",
        layout: "booklet",
        formats: ["expedientes"],
        gutterMm: 12,
      },
      "expedientes",
    );

    const jobs = buildCapturePlan(settings);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual({
      format: "expedientes",
      gutterMm: 12,
      gutterSide: "left",
    });
    expect(captureJobKey(jobs[0]!)).toBe("expedientes:12:left");
  });

  test("1-up de 3 formatos produce L, R, L", () => {
    const settings = normalizeExportSettings(
      {
        design: "a5",
        paper: "a5",
        layout: "1up",
        formats: ["expedientes", "paciente-rx-tx", "eventos"],
        gutterMm: 12,
        gutterSide: "left",
      },
      "expedientes",
    );

    expect(buildCapturePlan(settings).map((job) => job.gutterSide)).toEqual(["left", "right", "left"]);
  });

  test("gutterMm 0: un job por formato, todos left y 0", () => {
    const settings = normalizeExportSettings(
      {
        design: "a5",
        paper: "a5",
        layout: "1up",
        formats: ["expedientes", "paciente-rx-tx", "eventos"],
        gutterMm: 0,
        gutterSide: "right",
      },
      "expedientes",
    );

    const jobs = buildCapturePlan(settings);
    expect(jobs).toHaveLength(3);
    expect(jobs.every((job) => job.gutterMm === 0 && job.gutterSide === "left")).toBe(true);
  });
});

describe("gutterQuery y parseGutterQuery", () => {
  test("ida y vuelta; omisión con 0", () => {
    const left = gutterQuery(12, "left");
    expect(left).toEqual({ anillado: "12", lomo: "izquierda" });
    expect(parseGutterQuery(new URLSearchParams(left))).toEqual({
      gutterMm: 12,
      gutterSide: "left",
    });

    const right = gutterQuery(15, "right");
    expect(right).toEqual({ anillado: "15", lomo: "derecha" });
    expect(parseGutterQuery(new URLSearchParams(right))).toEqual({
      gutterMm: 15,
      gutterSide: "right",
    });

    expect(gutterQuery(0, "right")).toEqual({});
    expect(parseGutterQuery(new URLSearchParams())).toEqual({
      gutterMm: 0,
      gutterSide: "left",
    });
  });
});
