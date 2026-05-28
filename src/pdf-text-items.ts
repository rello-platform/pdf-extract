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
export async function pdfBufferToTextItems(
  buffer: Buffer,
): Promise<PdfTextItem[]> {
  // Defer pdfjs import — heavy, only needed when extraction actually runs.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8 = new Uint8Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;

  const items: PdfTextItem[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    for (const raw of content.items) {
      const item = raw as {
        str?: string;
        transform?: number[];
        width?: number;
      };
      if (!item.str || !item.transform) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        continue;
      }
      items.push({
        str: item.str,
        x,
        y,
        page: pageNum,
        ...(typeof item.width === "number" ? { width: item.width } : {}),
      });
    }
  }
  return items;
}
