/**
 * Single place where PDF.js is loaded and its worker wired.
 *
 * Both readers in the product need it — `inspectPdf` to pull text and attachments out of an
 * imported file, and the export preview to rasterise the report before anyone downloads it —
 * and `GlobalWorkerOptions.workerSrc` is process-wide state that must be set exactly once.
 *
 * The import stays dynamic: PDF.js is large and neither path runs on first paint, so it must
 * not reach the entry chunk (`npm run verify:entry`).
 */
type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pending: Promise<Pdfjs> | undefined;

const load = async (): Promise<Pdfjs> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // `document` is absent under Node (tests, tooling), where PDF.js runs without a worker.
  if (typeof document !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
};

/** Resolves the configured PDF.js module, loading it at most once per session. */
export const loadPdfjs = (): Promise<Pdfjs> => {
  pending ??= load().catch((error: unknown) => {
    // A failed load must not poison the cache: the next caller deserves a fresh attempt.
    pending = undefined;
    throw error;
  });
  return pending;
};
