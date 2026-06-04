"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfBufferToTextItems = pdfBufferToTextItems;
/**
 * pdfjs-dist decode: PDF Buffer -> positioned text items.
 *
 * Server-only — pdfjs-dist pulls node:* shims, do NOT import from a browser
 * client component. The pdfjs import is deferred (dynamic) so consumers that
 * never invoke `pdfBufferToTextItems` don't pay the load cost.
 *
 * Promoted from PathfinderPro `src/lib/rate-sheets/grid-extract.ts`.
 */
const module_1 = require("module");
/**
 * PDF buffer → positioned text items. Throws on encrypted or corrupt input;
 * callers should catch and route to their own DLQ / failed-ingest record.
 */
async function pdfBufferToTextItems(buffer) {
    // Defer pdfjs import — heavy, only needed when extraction actually runs.
    const pdfjsLib = await Promise.resolve().then(() => __importStar(require("pdfjs-dist/legacy/build/pdf.mjs")));
    // Fix: pdfjs v5 on Node.js auto-sets #isWorkerDisabled=true but defaults
    // workerSrc to the RELATIVE path "./pdf.worker.mjs". In the Next.js prod
    // build the relative path resolves to a non-existent chunked path
    // (/app/.next/server/chunks/pdf.worker.mjs) → "Setting up fake worker
    // failed: Cannot find module". Setting workerSrc to the absolute resolved
    // path of the real worker (in node_modules) before getDocument() forces
    // _setupFakeWorkerGlobal to import the correct file.
    //
    // serverExternalPackages:["pdfjs-dist"] in next.config.ts keeps pdfjs out
    // of webpack chunks so require.resolve() below finds it in node_modules.
    // createRequire(__filename) gives us a resolver rooted at this compiled
    // dist file, which node hoists through the package tree to find pdfjs-dist.
    // INFERENCE: file:// prefix required because pdfjs uses dynamic import()
    // internally (ESM-style), and bare absolute paths are not valid import
    // specifiers on some Node.js versions — a file:// URL is always safe.
    const _require = (0, module_1.createRequire)(__filename);
    const workerPath = _require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const loadingTask = pdfjsLib.getDocument({
        data: uint8,
        useSystemFonts: false,
    });
    const pdf = await loadingTask.promise;
    const items = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        for (const raw of content.items) {
            const item = raw;
            if (!item.str || !item.transform)
                continue;
            const x = item.transform[4];
            const y = item.transform[5];
            if (typeof x !== "number" ||
                typeof y !== "number" ||
                !Number.isFinite(x) ||
                !Number.isFinite(y)) {
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
//# sourceMappingURL=pdf-text-items.js.map