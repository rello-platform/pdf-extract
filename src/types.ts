/**
 * Shared PDF coordinate-extraction types. Pure data shapes — no model calls,
 * no platform-specific business logic. Promoted from PathfinderPro's
 * `src/lib/rate-sheets/grid-extract.ts` for cross-app reuse (PFP rate sheets +
 * Rello Closing Disclosure reconciliation).
 */

/**
 * A single positioned text run from a PDF page, as emitted by pdfjs-dist's
 * `TextItem` after coordinate normalization. The fields mirror pdfjs's
 * `transform` matrix conventions (x = transform[4], y = transform[5], PDF
 * user space — origin at the page's bottom-left).
 */
export interface PdfTextItem {
  /** Text content of a single glyph run (pdf.js TextItem.str). */
  str: string;
  /** x-coordinate in PDF user space (transform[4]). */
  x: number;
  /** y-coordinate in PDF user space (transform[5]). PDF origin is bottom-left, so higher y = closer to page top. */
  y: number;
  /** 1-indexed page the item came from. */
  page: number;
  /** Width of the run in PDF user space units (optional — column-anchor heuristics). */
  width?: number;
}

/**
 * Inclusive bounding box in PDF user space, scoped to one 1-indexed page.
 * Any axis bound may be omitted to mean "no bound on that side."
 *
 * Coordinate convention: PDF user space (origin bottom-left). So `yMin` is the
 * BOTTOM of the rect and `yMax` is the TOP. A reader who thinks in
 * screen-coordinates (origin top-left) should swap mental Y.
 */
export interface PdfRect {
  /** 1-indexed page. Required — a rect is always scoped to one page. */
  page: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}

/**
 * Options for `clusterItemsIntoRows`. The default y-tolerance (3 PDF points,
 * ~0.04in) is tight enough to keep distinct rows apart and loose enough to
 * absorb baseline jitter from PDF rasterizers — calibrated on PFP rate sheets
 * (CMG, Mega Capital) and standardized TRID closing disclosures.
 */
export interface ClusterRowsOptions {
  /** y-tolerance in PDF user-space points for "same row." Default 3. */
  rowTolerancePt?: number;
}

/**
 * Options for `detectColumnAnchors`. `binWidthPt` controls the histogram bin
 * width; `thresholdRatio` controls the minimum bin count (as a fraction of
 * the max bin count) for a bin to be considered an anchor.
 */
export interface DetectColumnAnchorsOptions {
  /** Histogram bin width in points. Default 6 (typical US-Letter column gap). */
  binWidthPt?: number;
  /** Bin counts >= max * thresholdRatio are anchors. Default 0.1. */
  thresholdRatio?: number;
  /** Minimum absolute bin count. Default 2. */
  minBinCount?: number;
}

/**
 * Options for `getItemsInRect`. The `clip` mode is inclusive by default — an
 * item with x exactly equal to xMin counts as inside.
 */
export interface GetItemsInRectOptions {
  /** Include items whose coordinates lie exactly on the rect edges. Default true. */
  inclusive?: boolean;
}
