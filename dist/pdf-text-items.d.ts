import type { PdfTextItem } from "./types";
/**
 * PDF buffer → positioned text items. Throws on encrypted or corrupt input;
 * callers should catch and route to their own DLQ / failed-ingest record.
 */
export declare function pdfBufferToTextItems(buffer: Buffer): Promise<PdfTextItem[]>;
//# sourceMappingURL=pdf-text-items.d.ts.map