# @rello-platform/pdf-extract

Deterministic PDF coordinate primitives for the Rello platform — promoted from PathfinderPro's `grid-extract` so PFP (rate sheets) and Rello (Closing Disclosure reconciliation, Wave Milo-CD Phase 1) share one bulletproof deterministic core.

**Pure geometry. No model calls. No Anthropic key holder.** Model-backed PDF extraction routes through Milo Engine's `/api/extract-pdf-structured` chokepoint (Kelly lock 2026-05-21: Anthropic keys live only in Milo Engine).

## What this package is for

The PFP rate-sheet ingestion pattern is:

1. **Deterministic-first** — extract structure from positioned PDF text (x/y coordinate clustering) for the cheap, predictable cases.
2. **Milo `extract-pdf-structured` cross-check / fallback** — for scanned, blurry, or non-standard documents.
3. **Strict Zod + DLQ + operator dashboard** — never silently drop a failed ingest.

This package owns layer (1) — the pure-geometry primitives. The rate-sheet domain (program inference, FICO/LTV bands, lock columns, DSCR docs) stays in PFP. The CD domain (TRID Section H commission cells, salesPrice, payment-side resolution) stays in Rello.

## Public API

```ts
import {
  // Types
  PdfTextItem,
  PdfRect,
  // Pure geometry
  clusterItemsIntoRows,
  detectColumnAnchors,
  getItemsInRect,
  nearestColumnAnchor,
  rowText,
  // pdfjs-dist decode (Node-only)
  pdfBufferToTextItems,
} from "@rello-platform/pdf-extract";
```

### `pdfBufferToTextItems(buffer: Buffer): Promise<PdfTextItem[]>`

Server-only. Wraps pdfjs-dist's `getDocument` + `getTextContent`, returns positioned text runs (PDF user-space coordinates, origin bottom-left). Throws on encrypted/corrupt input — callers route to their own DLQ.

### `clusterItemsIntoRows(items, opts?)`

Groups items by y-coordinate within `rowTolerancePt` (default 3pt), sorts each row left-to-right by x, partitions by page. Page-1 rows come before Page-2 rows.

### `detectColumnAnchors(items, opts?)`

Histograms x-coordinates; bins whose count crosses both a relative threshold (default 10% of max) and an absolute floor (default 2) are returned as column anchors, sorted ascending.

### `getItemsInRect(items, rect, opts?)`

Filters items to those falling inside a rectangular sub-region of one page. Coordinate convention is PDF user-space (origin bottom-left), so `yMin` is the bottom edge and `yMax` is the top. Use for targeting a known fixed section of a standardized form (e.g. TRID Closing Disclosure page 2 Section H).

### `nearestColumnAnchor(x, anchors)`

Snaps a single x-coordinate to the nearest entry in a sorted anchors array. Tie-break: lower index wins.

### `rowText(row)`

Joins a row's `str` fields left-to-right with a single space.

## Package convention

Per `~PLATFORM-PACKAGE-PIN-CONVENTION-README.md`:

- **No `prepare` / `postinstall`.** Their presence forces npm into the git clone-and-build path on consumer installs, which breaks Railway nixpacks (no ssh client).
- **`dist/` is committed.** Consumers install the built output directly.
- **Tag = publish.** Cutting and pushing `vX.Y.Z` IS the publish.
- **Public repo.** Railway clones git deps unauthenticated.

Pin convention (`§3` of the README above):

```jsonc
"@rello-platform/pdf-extract": "github:rello-platform/pdf-extract#v0.1.0"
```

## Change log

- **2026-05-27 — v0.1.0** — Initial release. Primitives promoted from PathfinderPro `src/lib/rate-sheets/grid-extract.ts` (the `PdfTextItem` shape, `clusterItemsIntoRows`, `detectColumnAnchors`, `pdfBufferToTextItems`); `getItemsInRect` + `nearestColumnAnchor` + `rowText` added for the Rello CD path (Wave Milo-CD Phase 1).
