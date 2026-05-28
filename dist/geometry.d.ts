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
import type { PdfTextItem, PdfRect, ClusterRowsOptions, DetectColumnAnchorsOptions, GetItemsInRectOptions } from "./types";
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
export declare function clusterItemsIntoRows(items: PdfTextItem[], opts?: ClusterRowsOptions): PdfTextItem[][];
/**
 * Build a histogram of x-coordinates across all items; bins whose count
 * crosses both a relative threshold (fraction of the max bin) and an absolute
 * floor are treated as column anchors. Cells in a clustered row align to the
 * nearest returned anchor.
 *
 * Returns x-anchors sorted ascending.
 */
export declare function detectColumnAnchors(items: PdfTextItem[], opts?: DetectColumnAnchorsOptions): number[];
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
export declare function getItemsInRect(items: PdfTextItem[], rect: PdfRect, opts?: GetItemsInRectOptions): PdfTextItem[];
/**
 * Snap a single x-coordinate to the nearest column anchor. Returns the
 * anchor's index in the sorted anchors array (or `null` when anchors is
 * empty). Tie-break: lower index wins on equal distance.
 */
export declare function nearestColumnAnchor(x: number, anchors: number[]): {
    index: number;
    anchor: number;
} | null;
/**
 * Join all `str` fields of a row's items left-to-right with a single space.
 * Tiny convenience for callers that just want the row's text content.
 */
export declare function rowText(row: PdfTextItem[]): string;
//# sourceMappingURL=geometry.d.ts.map