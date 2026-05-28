import { describe, it, expect } from "vitest";
import {
  clusterItemsIntoRows,
  detectColumnAnchors,
  getItemsInRect,
  nearestColumnAnchor,
  rowText,
} from "../geometry";
import type { PdfTextItem } from "../types";

function mk(
  str: string,
  x: number,
  y: number,
  page = 1,
  width?: number,
): PdfTextItem {
  return width !== undefined ? { str, x, y, page, width } : { str, x, y, page };
}

describe("clusterItemsIntoRows", () => {
  it("returns empty array for no items", () => {
    expect(clusterItemsIntoRows([])).toEqual([]);
  });

  it("clusters items with same y into one row, sorted left-to-right by x", () => {
    const items: PdfTextItem[] = [
      mk("B", 50, 700),
      mk("C", 100, 700),
      mk("A", 10, 700),
    ];
    const rows = clusterItemsIntoRows(items);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.map((r) => r.str)).toEqual(["A", "B", "C"]);
  });

  it("splits distinct y values into separate rows (top of page first per PDF bottom-left origin)", () => {
    const items: PdfTextItem[] = [
      mk("bottom-left", 10, 100),
      mk("top-left", 10, 700),
      mk("middle-left", 10, 400),
    ];
    const rows = clusterItemsIntoRows(items);
    expect(rows).toHaveLength(3);
    expect(rows[0]![0]!.str).toBe("top-left");
    expect(rows[1]![0]!.str).toBe("middle-left");
    expect(rows[2]![0]!.str).toBe("bottom-left");
  });

  it("absorbs baseline jitter within rowTolerancePt", () => {
    const items: PdfTextItem[] = [
      mk("A", 10, 700),
      mk("B", 50, 701.5),
      mk("C", 100, 698.7),
    ];
    expect(clusterItemsIntoRows(items)).toHaveLength(1);
  });

  it("custom rowTolerancePt is honored", () => {
    const items: PdfTextItem[] = [
      mk("A", 10, 700),
      mk("B", 50, 705),
    ];
    expect(clusterItemsIntoRows(items)).toHaveLength(2);
    expect(clusterItemsIntoRows(items, { rowTolerancePt: 10 })).toHaveLength(1);
  });

  it("partitions by page — page 1 rows before page 2 rows", () => {
    const items: PdfTextItem[] = [
      mk("P2-A", 10, 700, 2),
      mk("P1-A", 10, 700, 1),
    ];
    const rows = clusterItemsIntoRows(items);
    expect(rows).toHaveLength(2);
    expect(rows[0]![0]!.str).toBe("P1-A");
    expect(rows[1]![0]!.str).toBe("P2-A");
  });
});

describe("detectColumnAnchors", () => {
  it("returns empty for no items", () => {
    expect(detectColumnAnchors([])).toEqual([]);
  });

  it("identifies modes of the x-distribution as anchors", () => {
    const items: PdfTextItem[] = [];
    // Three column-like x-positions: 50, 200, 350 — each populated by 5 items.
    for (let row = 0; row < 5; row++) {
      items.push(mk("a", 50, 700 - row * 20));
      items.push(mk("b", 200, 700 - row * 20));
      items.push(mk("c", 350, 700 - row * 20));
    }
    const anchors = detectColumnAnchors(items);
    expect(anchors).toContain(48);
    expect(anchors).toContain(198);
    expect(anchors).toContain(348);
    expect(anchors).toEqual([...anchors].sort((a, b) => a - b));
  });

  it("respects custom binWidthPt + thresholdRatio", () => {
    const items: PdfTextItem[] = [];
    for (let i = 0; i < 10; i++) items.push(mk("x", 100, 700 - i));
    items.push(mk("y", 102, 690));
    items.push(mk("y", 103, 689));
    const anchorsTight = detectColumnAnchors(items, {
      binWidthPt: 2,
      thresholdRatio: 0.5,
    });
    expect(anchorsTight).toEqual([100]);
  });
});

describe("getItemsInRect", () => {
  const items: PdfTextItem[] = [
    mk("P1-in", 100, 500, 1),
    mk("P1-too-low", 100, 200, 1),
    mk("P1-too-right", 600, 500, 1),
    mk("P2-in", 100, 500, 2),
  ];

  it("filters by page first", () => {
    const got = getItemsInRect(items, { page: 1, xMin: 50, xMax: 500, yMin: 400, yMax: 600 });
    expect(got.map((i) => i.str)).toEqual(["P1-in"]);
  });

  it("inclusive bounds (default) — items exactly on edges count as inside", () => {
    const got = getItemsInRect(items, { page: 1, xMin: 100, xMax: 100, yMin: 500, yMax: 500 });
    expect(got.map((i) => i.str)).toEqual(["P1-in"]);
  });

  it("inclusive=false — edges are excluded", () => {
    const got = getItemsInRect(
      items,
      { page: 1, xMin: 100, xMax: 100, yMin: 500, yMax: 500 },
      { inclusive: false },
    );
    expect(got).toEqual([]);
  });

  it("omitted bound = no constraint on that side", () => {
    const got = getItemsInRect(items, { page: 1, yMin: 100 });
    expect(got.map((i) => i.str).sort()).toEqual(
      ["P1-in", "P1-too-low", "P1-too-right"].sort(),
    );
  });

  it("never crosses pages", () => {
    const got = getItemsInRect(items, { page: 2 });
    expect(got.map((i) => i.str)).toEqual(["P2-in"]);
  });
});

describe("nearestColumnAnchor", () => {
  it("returns null when anchors empty", () => {
    expect(nearestColumnAnchor(100, [])).toBeNull();
  });

  it("picks the closest anchor", () => {
    expect(nearestColumnAnchor(105, [50, 100, 200])).toEqual({
      index: 1,
      anchor: 100,
    });
    expect(nearestColumnAnchor(40, [50, 100, 200])).toEqual({
      index: 0,
      anchor: 50,
    });
  });

  it("ties go to the lower index (deterministic)", () => {
    expect(nearestColumnAnchor(75, [50, 100])).toEqual({
      index: 0,
      anchor: 50,
    });
  });
});

describe("rowText", () => {
  it("joins str fields left-to-right with single spaces", () => {
    const row: PdfTextItem[] = [
      mk("Hello", 10, 700),
      mk("world", 50, 700),
    ];
    expect(rowText(row)).toBe("Hello world");
  });

  it("returns empty string for empty row", () => {
    expect(rowText([])).toBe("");
  });
});
