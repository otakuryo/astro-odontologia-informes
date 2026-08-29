import { test, expect } from "bun:test";
import {
  INNER_R,
  MIDLINE_STEP,
  OUTER_R,
  TOOTH_STEP,
  buildOdontogramLayout,
  toothGlyph,
  type ToothLayout,
} from "./odontogram";

const layout = buildOdontogramLayout();
const byFdi = new Map(layout.teeth.map((tooth) => [tooth.fdi, tooth]));

function tooth(fdi: string): ToothLayout {
  const found = byFdi.get(fdi);
  if (!found) {
    throw new Error(`diente ausente: ${fdi}`);
  }
  return found;
}

function quadrantOf(fdi: string): number {
  return Number.parseInt(fdi.split(".")[0] ?? "", 10);
}

function rayDeg(ray: { x1: number; y1: number; x2: number; y2: number }): number {
  const deg = (Math.atan2(ray.y2 - ray.y1, ray.x2 - ray.x1) * 180) / Math.PI;
  return (deg + 360) % 360;
}

test("tiene 52 dientes y 52 fdi únicos", () => {
  expect(layout.teeth).toHaveLength(52);
  expect(new Set(layout.teeth.map((item) => item.fdi)).size).toBe(52);
});

test("tiene 32 permanentes y 20 temporales", () => {
  const permanents = layout.teeth.filter((item) => quadrantOf(item.fdi) <= 4);
  const temporals = layout.teeth.filter((item) => quadrantOf(item.fdi) >= 5);

  expect(permanents).toHaveLength(32);
  expect(temporals).toHaveLength(20);
});

test("la fila 1 va de 1.8 a 1.1 y luego de 2.1 a 2.8", () => {
  expect(layout.teeth.slice(0, 16).map((item) => item.fdi)).toEqual([
    "1.8",
    "1.7",
    "1.6",
    "1.5",
    "1.4",
    "1.3",
    "1.2",
    "1.1",
    "2.1",
    "2.2",
    "2.3",
    "2.4",
    "2.5",
    "2.6",
    "2.7",
    "2.8",
  ]);
});

test("los temporales son homólogos, no centrados en el bloque", () => {
  expect(tooth("5.1").cx).toBe(tooth("1.1").cx);
  expect(tooth("5.5").cx).toBe(tooth("1.5").cx);
  expect(tooth("6.1").cx).toBe(tooth("2.1").cx);
  expect(tooth("8.1").cx).toBe(tooth("4.1").cx);
  expect(tooth("7.5").cx).toBe(tooth("3.5").cx);
});

test("el pasillo 1.1→2.1 es MIDLINE_STEP y mayor que TOOTH_STEP", () => {
  const gap = tooth("2.1").cx - tooth("1.1").cx;

  expect(gap).toBeCloseTo(MIDLINE_STEP);
  expect(gap).toBeGreaterThan(TOOTH_STEP);
});

test("el hueco oclusal entre temporales es menor que el hueco de arco", () => {
  const occlusal = tooth("8.1").cy - tooth("5.1").cy;
  const arch = tooth("5.1").cy - tooth("1.1").cy;

  expect(occlusal).toBeLessThan(arch);
});

test("labelSide es above en maxilar y below en mandibular", () => {
  const above = new Set([1, 2, 5, 6]);
  const below = new Set([3, 4, 7, 8]);

  for (const item of layout.teeth) {
    const quadrant = quadrantOf(item.fdi);

    if (above.has(quadrant)) {
      expect(item.labelSide).toBe("above");
    } else if (below.has(quadrant)) {
      expect(item.labelSide).toBe("below");
    } else {
      throw new Error(`cuadrante inesperado: ${item.fdi}`);
    }
  }
});

test("toothGlyph traza radios a 45/135/225/315", () => {
  const glyph = toothGlyph(100, 200);
  expect(glyph.rays).toHaveLength(4);

  const angles = glyph.rays.map(rayDeg);
  const expected = [45, 135, 225, 315];

  for (const target of expected) {
    const delta = Math.min(...angles.map((angle) => Math.abs(angle - target)));
    expect(delta).toBeLessThanOrEqual(0.5);
  }
});

test("INNER_R / OUTER_R está en [0.42, 0.44]", () => {
  const ratio = INNER_R / OUTER_R;

  expect(ratio).toBeGreaterThanOrEqual(0.42);
  expect(ratio).toBeLessThanOrEqual(0.44);
});
