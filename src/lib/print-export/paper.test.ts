import { describe, expect, test } from "bun:test";
import {
  availableLayouts,
  designDimensionsMm,
  mmToPt,
  nestingFactor,
  paperDimensionsMm,
  resolveOrientation,
} from "./paper";

function expectPt(mm: number, pt: number) {
  expect(Math.abs(mmToPt(mm) - pt)).toBeLessThanOrEqual(0.02);
}

describe("mmToPt y dimensiones", () => {
  test("Carta, A5, A6 y A4 en puntos (±0,02 pt)", () => {
    const letter = designDimensionsMm("letter");
    expect(letter).toEqual({ width: 215.9, height: 279.4 });
    expectPt(letter.width, 612);
    expectPt(letter.height, 792);

    const a5 = designDimensionsMm("a5");
    expect(a5).toEqual({ width: 148, height: 210 });
    expectPt(a5.width, 419.5275590551181);
    expectPt(a5.height, 595.2755905511811);

    const a6 = designDimensionsMm("a6");
    expect(a6).toEqual({ width: 105, height: 148 });
    expectPt(a6.width, 297.6377952755905);
    expectPt(a6.height, 419.5275590551181);

    const a4 = paperDimensionsMm("a4");
    expect(a4).toEqual({ width: 210, height: 297 });
    expectPt(a4.width, 595.2755905511811);
    expectPt(a4.height, 841.8897637795276);
  });
});

describe("nestingFactor", () => {
  test("un escalón ISO vale 2; el resto es null", () => {
    expect(nestingFactor("a5", "a4")).toBe(2);
    expect(nestingFactor("a6", "a5")).toBe(2);
    expect(nestingFactor("a6", "a4")).toBeNull();
    expect(nestingFactor("letter", "a4")).toBeNull();
  });
});

describe("availableLayouts", () => {
  test("A5 sobre A4 solo duplicate y booklet", () => {
    expect(availableLayouts("a5", "a4")).toEqual(["duplicate", "booklet"]);
  });

  test("A5 sobre A5 es 1up", () => {
    expect(availableLayouts("a5", "a5")).toEqual(["1up"]);
  });
});

describe("resolveOrientation", () => {
  test("1up respeta la elección; duplicate y booklet son apaisados", () => {
    expect(resolveOrientation("1up")).toBe("portrait");
    expect(resolveOrientation("1up", "landscape")).toBe("landscape");
    expect(resolveOrientation("duplicate", "portrait")).toBe("landscape");
    expect(resolveOrientation("booklet", "portrait")).toBe("landscape");
  });
});
