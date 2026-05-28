/**
 * pdfjs-dist decode: PDF Buffer -> positioned text items.
 *
 * Server-only — pdfjs-dist pulls node:* shims, do NOT import from a browser
 * client component. The pdfjs import is deferred (dynamic) so consumers that
 * never invoke `pdfBufferToTextItems` don't pay the load cost.
 *
 * Promoted from PathfinderPro `src/lib/rate-sheets/grid-extract.ts`.
 */
import type { PdfTextItem } from "./types";
/**
 * PDF buffer → positioned text items. Throws on encrypted or corrupt input;
 * callers should catch and route to their own DLQ / failed-ingest record.
 */
export declare function pdfBufferToTextItems(buffer: Buffer): Promise<PdfTextItem[]>;
//# sourceMappingURL=pdf-text-items.d.ts.map