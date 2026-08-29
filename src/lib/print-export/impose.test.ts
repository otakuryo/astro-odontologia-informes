import { describe, expect, test } from "bun:test";
import { imposeBooklet, imposeDuplicate, padPages, type PageSlot } from "./impose";

function pageNumber(slot: PageSlot): number | "blank" {
  return slot.kind === "blank" ? "blank" : slot.index + 1;
}

describe("padPages", () => {
  test("relleno 1→4 y 5→8", () => {
    const one = padPages(1);
    expect(one).toHaveLength(4);
    expect(one[0]).toEqual({ kind: "page", index: 0 });
    expect(one.slice(1)).toEqual([{ kind: "blank" }, { kind: "blank" }, { kind: "blank" }]);

    const five = padPages(5);
    expect(five).toHaveLength(8);
    expect(five.slice(0, 5).map((slot) => (slot.kind === "page" ? slot.index : null))).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(five.slice(5)).toEqual([{ kind: "blank" }, { kind: "blank" }, { kind: "blank" }]);
  });
});

describe("imposeBooklet", () => {
  test("4 páginas: cara 4|1 y dorso 2|3", () => {
    const sheets = imposeBooklet(4);

    expect(sheets).toHaveLength(2);
    expect(pageNumber(sheets[0]!.left)).toBe(4);
    expect(pageNumber(sheets[0]!.right)).toBe(1);
    expect(sheets[0]!.face).toBe("front");
    expect(pageNumber(sheets[1]!.left)).toBe(2);
    expect(pageNumber(sheets[1]!.right)).toBe(3);
    expect(sheets[1]!.face).toBe("back");
  });

  test("1 formato se rellena a 4: cara blanco|1, dorso blanco|blanco", () => {
    const sheets = imposeBooklet(1);

    expect(pageNumber(sheets[0]!.left)).toBe("blank");
    expect(pageNumber(sheets[0]!.right)).toBe(1);
    expect(pageNumber(sheets[1]!.left)).toBe("blank");
    expect(pageNumber(sheets[1]!.right)).toBe("blank");
  });
});

describe("imposeDuplicate", () => {
  test("2 formatos → 2 hojas con left=right=índice", () => {
    const sheets = imposeDuplicate(2);

    expect(sheets).toHaveLength(2);
    expect(sheets[0]).toEqual({
      face: "front",
      left: { kind: "page", index: 0 },
      right: { kind: "page", index: 0 },
    });
    expect(sheets[1]).toEqual({
      face: "front",
      left: { kind: "page", index: 1 },
      right: { kind: "page", index: 1 },
    });
  });
});
