/**
 * pdfjs-dist decode: PDF Buffer -> positioned text items.
 *
 * Server-only — pdfjs-dist pulls node:* shims, do NOT import from a browser
 * client component. The pdfjs import is deferred (dynamic) so consumers that
 * never invoke `pdfBufferToTextItems` don't pay the load cost.
 *
 * Promoted from PathfinderPro `src/lib/rate-sheets/grid-extract.ts`.
 */
import { createRequire } from "module";
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

  // Fix: pdfjs v5 on Node.js auto-sets #isWorkerDisabled=true but defaults
  // workerSrc to the RELATIVE path "./pdf.worker.mjs". In a Next.js prod build
  // that relative path resolves to a non-existent chunked path
  // (/app/.next/server/chunks/pdf.worker.mjs) → "Setting up fake worker
  // failed: Cannot find module". Setting workerSrc to an absolute resolved
  // path of the real worker (in node_modules) before getDocument() forces
  // _setupFakeWorkerGlobal to import the correct file instead.
  //
  // Resolve strategy (try in order, take first hit):
  // 1. createRequire(__filename) — works when __filename is the real on-disk
  //    path of this compiled dist file (the normal case: node_modules/…/dist/).
  // 2. createRequire(process.cwd()) — fallback for bundled runtimes where
  //    __filename is a virtual path; process.cwd() is typically the app root
  //    which contains node_modules/pdfjs-dist.
  // Either way, pdfjs-dist must exist in node_modules at deploy time (it is
  // declared as a dependency, so Railway/Nixpacks keeps it).
  //
  // INFERENCE: file:// prefix is required because pdfjs uses dynamic import()
  // internally; bare absolute paths are not valid import specifiers on all
  // Node.js versions, but a file:// URL is always safe.
  let workerPath: string | null = null;
  for (const anchor of [__filename, process.cwd()]) {
    try {
      const _require = createRequire(anchor);
      workerPath = _require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
      break;
    } catch {
      // try next anchor
    }
  }
  if (workerPath) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
  }
  // If neither anchor resolved (should not happen in Railway deployment), pdfjs
  // falls through to its default "./pdf.worker.mjs" which may fail — let it
  // throw so the error surfaces rather than silently returning 0 items.

  // GRID-COLUMN-SEGMENTATION-260605 fix: pdfjs v5 transfers (detaches) the
  // underlying ArrayBuffer when `data:` is passed as a shared Uint8Array.
  // Any subsequent Node.js or R2 operation on the same `buffer` then throws
  // "Cannot perform Construct on a detached ArrayBuffer" — date extraction
  // and R2 upload both failed in prod for this reason.
  //
  // Fix: copy the bytes into a fresh standalone ArrayBuffer that pdfjs may
  // detach without affecting the caller's original buffer.  The copy is ~0
  // overhead vs the multi-page text parse that follows.
  const freshCopy = Buffer.from(buffer);
  const uint8 = new Uint8Array(
    freshCopy.buffer,
    freshCopy.byteOffset,
    freshCopy.byteLength,
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
