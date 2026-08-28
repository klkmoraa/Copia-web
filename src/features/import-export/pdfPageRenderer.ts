/**
 * Rasterises an in-memory PDF for the export preview.
 *
 * The report never reaches the disk before someone has looked at it, so the preview reads the
 * very bytes that will be downloaded — not a re-render from the model. PDF.js arrives through
 * the shared `loadPdfjs`, which also owns the worker wiring.
 */
import { loadPdfjs } from '../../utils/pdfjsRuntime';

export interface PreviewDocument {
  readonly pageCount: number;
  /** Paints page `number` (1-based) into `canvas`, fitted to `cssWidth` device-independent px. */
  renderPage(number: number, canvas: HTMLCanvasElement, cssWidth: number): Promise<void>;
  /** Aspect ratio (height / width) of page `number`, for sizing before anything is painted. */
  aspectRatio(number: number): Promise<number>;
  destroy(): void;
}

/** Beyond this the canvas costs more memory than the extra sharpness is worth. */
const MAX_PIXEL_RATIO = 2;

export const openPreviewDocument = async (bytes: Uint8Array): Promise<PreviewDocument> => {
  const pdfjs = await loadPdfjs();
  // PDF.js takes ownership of the buffer it is given, and the same bytes are handed to the
  // download button afterwards; the copy keeps the caller's array intact.
  const task = pdfjs.getDocument({ data: bytes.slice(), useWorkerFetch: false });
  const document_ = await task.promise;
  let disposed = false;

  return {
    pageCount: document_.numPages,

    async aspectRatio(number) {
      const page = await document_.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      return viewport.height / viewport.width;
    },

    async renderPage(number, canvas, cssWidth) {
      const page = await document_.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const ratio = Math.min(globalThis.devicePixelRatio ?? 1, MAX_PIXEL_RATIO);
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
      const context = canvas.getContext('2d');
      if (!context || disposed) return;
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${Math.round(cssWidth * (base.height / base.width))}px`;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      page.cleanup();
    },

    destroy() {
      disposed = true;
      // `destroy` lives on the loading task — it is what tears the worker down; the proxy
      // only offers `cleanup`, which frees page resources but keeps the document open.
      void task.destroy();
    },
  };
};
