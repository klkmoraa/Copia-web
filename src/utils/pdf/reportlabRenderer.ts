/**
 * The seam: a normalized report document in, PDF bytes out.
 *
 * Everything upstream of this module composes; everything downstream renders. Keeping the two
 * apart behind one function is what lets the renderer be a Python package running on ReportLab
 * while the composer stays TypeScript beside the solver — and what lets a test drive the
 * renderer through a plain CPython interpreter instead of a browser.
 *
 * The default backend is Pyodide, booted from the app's own assets (`pythonRuntime.ts`).
 * `setReportRenderer` swaps it for a harness that already has a Python on the machine — that is
 * how `scripts/render-report.mjs` and the report's own tests avoid paying for WebAssembly to
 * assert what the document says.
 */
import type { ReportDocument } from './reportDocument';

export type ReportRenderer = (documentJson: string) => Promise<Uint8Array>;

let renderer: ReportRenderer | undefined;

/**
 * Replaces the backend that turns a serialised document into bytes.
 *
 * Passing `undefined` restores the in-app Pyodide runtime, which is what a test that installed
 * a harness should do when it tears one down.
 */
export const setReportRenderer = (next: ReportRenderer | undefined): void => {
  renderer = next;
};

export const renderReportDocument = async (document: ReportDocument): Promise<Uint8Array> => {
  const json = JSON.stringify(document);
  if (renderer) return renderer(json);
  const { renderWithPython } = await import('./pythonRuntime');
  return renderWithPython(json);
};
