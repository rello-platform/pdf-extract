/**
 * Pure-geometry primitives for clustering positioned PDF text into rows,
 * detecting column anchors via x-histogram modes, and extracting items in a
 * specified rectangular sub-region of a page.
 *
 * Promoted from PathfinderPro `src/lib/rate-sheets/grid-extract.ts`. PFP's
 * rate-sheet domain logic stays in PFP; this module is the deterministic
 * structuring layer shared with Rello's Closing Disclosure reconciliation
 * (Wave Milo-CD Phase 1).
 *
 * No model calls. No platform-specific business logic. No Anthropic key
 * (Kelly lock 2026-05-21: Anthropic keys live only in Milo Engine).
 */
import type {
  PdfTextItem,
  PdfRect,
  ClusterRowsOptions,
  DetectColumnAnchorsOptions,
  GetItemsInRectOptions,
} from "./types";

const DEFAULT_ROW_TOLERANCE_PT = 3;
const DEFAULT_BIN_WIDTH_PT = 6;
const DEFAULT_THRESHOLD_RATIO = 0.1;
const DEFAULT_MIN_BIN_COUNT = 2;

/**
 * Cluster positioned text items into rows by y-coordinate within tolerance,
 * then sort each row left-to-right by x. Items are partitioned by page; rows
 * from page N appear before rows from page N+1.
 *
 * Algorithm: per-page, sort by descending y (PDF user space origin is
 * bottom-left, so the top of the page is the highest y), bin into rows that
 * share y within tolerance, then sort each row by ascending x.
 *
 * Default tolerance: 3 PDF points (~0.04in) — tight enough to keep distinct
 * rows apart, loose enough to absorb baseline jitter from PDF rasterizers.
 */
export function clusterItemsIntoRows(
  items: PdfTextItem[],
  opts: ClusterRowsOptions = {},
): PdfTextItem[][] {
  if (items.length === 0) return [];
  const rowTolerancePt = opts.rowTolerancePt ?? DEFAULT_ROW_TOLERANCE_PT;

  const byPage = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    const pageItems = byPage.get(item.page) ?? [];
    pageItems.push(item);
    byPage.set(item.page, pageItems);
  }

  const allRows: PdfTextItem[][] = [];
  const pages = Array.from(byPage.keys()).sort((a, b) => a - b);
  for (const page of pages) {
    const pageItems = byPage.get(page);
    if (!pageItems) continue;
    const sorted = [...pageItems].sort((a, b) => b.y - a.y);
    let currentRow: PdfTextItem[] = [];
    let currentY: number | null = null;

    for (const item of sorted) {
      if (currentY === null || Math.abs(item.y - currentY) <= rowTolerancePt) {
        currentRow.push(item);
        if (currentY === null) currentY = item.y;
      } else {
        allRows.push(currentRow.sort((a, b) => a.x - b.x));
        currentRow = [item];
        currentY = item.y;
      }
    }
    if (currentRow.length > 0) {
      allRows.push(currentRow.sort((a, b) => a.x - b.x));
    }
  }
  return allRows;
}

/**
 * Build a histogram of x-coordinates across all items; bins whose count
 * crosses both a relative threshold (fraction of the max bin) and an absolute
 * floor are treated as column anchors. Cells in a clustered row align to the
 * nearest returned anchor.
 *
 * Returns x-anchors sorted ascending.
 */
export function detectColumnAnchors(
  items: PdfTextItem[],
  opts: DetectColumnAnchorsOptions = {},
): number[] {
  if (items.length === 0) return [];
  const binWidthPt = opts.binWidthPt ?? DEFAULT_BIN_WIDTH_PT;
  const thresholdRatio = opts.thresholdRatio ?? DEFAULT_THRESHOLD_RATIO;
  const minBinCount = opts.minBinCount ?? DEFAULT_MIN_BIN_COUNT;

  const bins = new Map<number, number>();
  for (const item of items) {
    const bin = Math.round(item.x / binWidthPt) * binWidthPt;
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
  }
  if (bins.size === 0) return [];
  const max = Math.max(...bins.values());
  const threshold = Math.max(minBinCount, Math.floor(max * thresholdRatio));
  return Array.from(bins.entries())
    .filter(([, count]) => count >= threshold)
    .map(([x]) => x)
    .sort((a, b) => a - b);
}

/**
 * Return all items that fall inside a rectangular sub-region of a single page.
 *
 * Coordinate convention: PDF user space (origin bottom-left). `yMin` is the
 * BOTTOM of the rect, `yMax` is the TOP. Bounds omitted on any axis mean "no
 * bound on that side."
 *
 * Use case: targeting a known fixed section of a standardized form (e.g. the
 * TRID Closing Disclosure's Section H on page 2) so downstream parsing
 * doesn't have to filter through the whole page.
 */
export function getItemsInRect(
  items: PdfTextItem[],
  rect: PdfRect,
  opts: GetItemsInRectOptions = {},
): PdfTextItem[] {
  const inclusive = opts.inclusive ?? true;
  const cmpLo = inclusive
    ? (v: number, lo: number) => v >= lo
    : (v: number, lo: number) => v > lo;
  const cmpHi = inclusive
    ? (v: number, hi: number) => v <= hi
    : (v: number, hi: number) => v < hi;

  return items.filter((item) => {
    if (item.page !== rect.page) return false;
    if (rect.xMin !== undefined && !cmpLo(item.x, rect.xMin)) return false;
    if (rect.xMax !== undefined && !cmpHi(item.x, rect.xMax)) return false;
    if (rect.yMin !== undefined && !cmpLo(item.y, rect.yMin)) return false;
    if (rect.yMax !== undefined && !cmpHi(item.y, rect.yMax)) return false;
    return true;
  });
}

/**
 * Snap a single x-coordinate to the nearest column anchor. Returns the
 * anchor's index in the sorted anchors array (or `null` when anchors is
 * empty). Tie-break: lower index wins on equal distance.
 */
export function nearestColumnAnchor(
  x: number,
  anchors: number[],
): { index: number; anchor: number } | null {
  if (anchors.length === 0) return null;
  let bestIdx = 0;
  let bestAnchor = anchors[0]!;
  let bestDist = Math.abs(x - bestAnchor);
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i]!;
    const d = Math.abs(x - a);
    if (d < bestDist) {
      bestIdx = i;
      bestAnchor = a;
      bestDist = d;
    }
  }
  return { index: bestIdx, anchor: bestAnchor };
}

/**
 * Join all `str` fields of a row's items left-to-right with a single space.
 * Tiny convenience for callers that just want the row's text content.
 */
export function rowText(row: PdfTextItem[]): string {
  return row
    .map((r) => r.str)
    .join(" ")
    .trim();
}
