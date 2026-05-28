/**
 * @rello-platform/pdf-extract — public surface.
 *
 * Deterministic PDF coordinate primitives. Pure geometry; no model calls; no
 * Anthropic key holder (Kelly lock 2026-05-21: Anthropic keys live only in
 * Milo Engine — model-backed extraction routes through Milo's
 * `/api/extract-pdf-structured` chokepoint).
 *
 * Consumer apps:
 *   - PathfinderPro — `src/lib/rate-sheets/grid-extract.ts` (rate-sheet
 *     deterministic-first pass; the package's grandparent)
 *   - Rello — `src/trigger/closing-doc-review.ts` (Wave Milo-CD Phase 1
 *     Closing Disclosure deterministic-first pass)
 */
export type {
  PdfTextItem,
  PdfRect,
  ClusterRowsOptions,
  DetectColumnAnchorsOptions,
  GetItemsInRectOptions,
} from "./types";

export {
  clusterItemsIntoRows,
  detectColumnAnchors,
  getItemsInRect,
  nearestColumnAnchor,
  rowText,
} from "./geometry";

export { pdfBufferToTextItems } from "./pdf-text-items";
