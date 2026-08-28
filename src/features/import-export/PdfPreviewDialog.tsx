/**
 * The calculation report, shown before it is downloaded.
 *
 * Exporting used to be a leap of faith: the menu handed the bytes straight to the browser and
 * the reader met the document for the first time in their downloads folder. A report someone
 * is going to sign deserves to be looked at first — and, once it is on screen, the obvious
 * next question is whether every section belongs in this particular copy.
 *
 * So the dialog owns two things: the pages, rasterised from the very bytes that will be saved,
 * and the content switches that rebuild them. Rebuilding is debounced because composing the
 * PDF is real work and a reader ticking three boxes should pay for one rebuild, not three.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Dialog } from '../../design-system/components/overlays';
import { Button } from '../../design-system/components/controls';
import { Spinner } from '../../design-system/components/feedback';
import type { CalculationReportArtifact, CalculationReportOptions } from '../../utils/pdf/reportContext';
import type { PreviewDocument } from './pdfPageRenderer';

/** The sections the reader may drop. Order matches the document. */
export const PREVIEW_SECTIONS = [
  'includeDiagrams',
  'includeScope',
  'includeProcedure',
  'includeAnnex',
  'includeEducationTrace',
] as const;

export type PreviewSection = (typeof PREVIEW_SECTIONS)[number];

export type PreviewSelection = Record<PreviewSection, boolean>;

export const DEFAULT_PREVIEW_SELECTION: PreviewSelection = {
  includeDiagrams: true,
  includeScope: true,
  includeProcedure: true,
  includeAnnex: true,
  includeEducationTrace: true,
};

export interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Composes the report for a given selection. Called again whenever the selection changes. */
  buildReport: (options: CalculationReportOptions) => Promise<CalculationReportArtifact>;
  /** Hands the finished bytes to the platform. Runs from the footer, on a fresh user gesture. */
  onDownload: (artifact: CalculationReportArtifact) => Promise<void> | void;
  t: (key: string, values?: Record<string, string | number>) => string;
  /** Seam for tests; production passes the PDF.js-backed renderer. */
  openDocument?: (bytes: Uint8Array) => Promise<PreviewDocument>;
  /** Milliseconds to wait after the last toggle before recomposing. */
  rebuildDelay?: number;
}

const REBUILD_DELAY = 320;

export const PdfPreviewDialog = ({
  open,
  onOpenChange,
  buildReport,
  onDownload,
  t,
  openDocument,
  rebuildDelay = REBUILD_DELAY,
}: PdfPreviewDialogProps) => {
  const [selection, setSelection] = useState<PreviewSelection>(DEFAULT_PREVIEW_SELECTION);
  const [artifact, setArtifact] = useState<CalculationReportArtifact | null>(null);
  const [preview, setPreview] = useState<PreviewDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sharing, setSharing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Guards against a slow rebuild landing after a newer one, or after the dialog closed. */
  const generation = useRef(0);

  const options = useMemo<CalculationReportOptions>(() => ({ ...selection }), [selection]);

  useEffect(() => {
    if (!open) return undefined;
    const run = generation.current + 1;
    generation.current = run;
    let cancelled = false;
    setBusy(true);
    setError(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        const live = () => !cancelled && generation.current === run;
        let built: CalculationReportArtifact;
        // Composing and rasterising fail for different reasons and leave the reader in
        // different places: without a document there is nothing to download, whereas a
        // document that merely would not paint is still perfectly downloadable.
        try {
          built = await buildReport(options);
        } catch {
          if (live()) {
            setArtifact(null);
            setError(t('portable.exportFailed'));
            setBusy(false);
          }
          return;
        }
        if (!live()) return;
        setArtifact(built);
        try {
          if (openDocument) {
            const document_ = await openDocument(built.bytes);
            if (!live()) {
              document_.destroy();
              return;
            }
            setPreview((previous) => {
              previous?.destroy();
              return document_;
            });
            setCurrentPage(1);
          }
        } catch {
          if (live()) setError(t('pdfPreview.renderFailed'));
        } finally {
          if (live()) setBusy(false);
        }
      })();
    }, artifact ? rebuildDelay : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `artifact` only picks the delay for the *next* run; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options, buildReport, openDocument, rebuildDelay, t]);

  // Unmounting releases the worker and the rasterised pages; `close` does the same on the
  // way out, so a retained document never keeps a PDF.js worker alive past the dialog.
  useEffect(() => () => preview?.destroy(), [preview]);

  const toggle = useCallback((section: PreviewSection) => {
    setSelection((previous) => ({ ...previous, [section]: !previous[section] }));
  }, []);

  const close = useCallback((next: boolean) => {
    if (!next) {
      generation.current += 1;
      preview?.destroy();
      setPreview(null);
      setArtifact(null);
      setSelection(DEFAULT_PREVIEW_SELECTION);
      setError(null);
    }
    onOpenChange(next);
  }, [onOpenChange, preview]);

  const download = useCallback(async () => {
    if (!artifact) return;
    setSharing(true);
    try {
      await onDownload(artifact);
      close(false);
    } finally {
      setSharing(false);
    }
  }, [artifact, close, onDownload]);

  const pageCount = preview?.pageCount ?? 0;

  return <Dialog
    open={open}
    onOpenChange={close}
    title={t('pdfPreview.title')}
    description={t('pdfPreview.description')}
    closeLabel={t('pdfPreview.close')}
    className="pdf-preview-dialog"
    footer={<>
      <span className="pdf-preview-counter" aria-live="polite">
        {pageCount ? t('pdfPreview.pageCounter', { current: currentPage, total: pageCount }) : ''}
      </span>
      <Button variant="ghost" onClick={() => close(false)}>{t('pdfPreview.close')}</Button>
      <Button
        variant="primary"
        disabled={!artifact || busy}
        loading={sharing}
        onClick={() => void download()}
      ><Download size={16} /> {t('pdfPreview.download')}</Button>
    </>}
  >
    <div className="pdf-preview-body">
      <aside className="pdf-preview-options">
        <h3>{t('pdfPreview.contentTitle')}</h3>
        {PREVIEW_SECTIONS.map((section) => (
          <label key={section} className="pdf-preview-option">
            <input
              type="checkbox"
              checked={selection[section]}
              // The trace is drawn by the annex, so it cannot outlive it.
              disabled={section === 'includeEducationTrace' && !selection.includeAnnex}
              onChange={() => toggle(section)}
            />
            <span>{t(`pdfPreview.${section}`)}</span>
          </label>
        ))}
        <p className="pdf-preview-note">{t('pdfPreview.annexNote')}</p>
        <p className="pdf-preview-note">{t('pdfPreview.alwaysIncluded')}</p>
      </aside>

      <div className="pdf-preview-pages" ref={scrollRef}>
        {busy ? (
          <p className="pdf-preview-status" role="status">
            <Spinner /> {artifact ? t('pdfPreview.rendering') : t('pdfPreview.building')}
          </p>
        ) : null}
        {error ? <p className="pdf-preview-error" role="alert">{error}</p> : null}
        {preview ? <PreviewPages
          document={preview}
          container={scrollRef}
          onVisiblePage={setCurrentPage}
        /> : null}
      </div>
    </div>
  </Dialog>;
};

interface PreviewPagesProps {
  document: PreviewDocument;
  container: React.RefObject<HTMLDivElement | null>;
  onVisiblePage: (page: number) => void;
}

/**
 * Continuous scroll of canvases. Only what the reader can see is rasterised: a twelve-page
 * report painted eagerly costs a visible stall and most of it is never looked at.
 */
const PreviewPages = ({ document, container, onVisiblePage }: PreviewPagesProps) => {
  const numbers = useMemo(
    () => Array.from({ length: document.pageCount }, (_, index) => index + 1),
    [document],
  );
  const canvases = useRef(new Map<number, HTMLCanvasElement>());
  const painted = useRef(new Set<number>());

  const register = useCallback((canvas: HTMLCanvasElement | null, number: number) => {
    if (!canvas) return undefined;
    canvases.current.set(number, canvas);
    return () => { canvases.current.delete(number); };
  }, []);

  useEffect(() => {
    painted.current = new Set<number>();
    const root = container.current;
    const width = Math.max(160, (root?.clientWidth ?? 640) - 32);
    const entries = [...canvases.current.entries()];

    // Reserve each page's height before anything is painted. Until this lands every canvas
    // is zero-high, so they all overlap at the top of the scroller — which is how the
    // counter used to open on "page 12 of 16" while showing page one.
    for (const [number, canvas] of entries) {
      canvas.style.width = `${width}px`;
      void document.aspectRatio(number).then((ratio) => {
        canvas.style.height = `${Math.round(width * ratio)}px`;
      });
    }

    const paint = (number: number) => {
      const canvas = canvases.current.get(number);
      if (!canvas || painted.current.has(number)) return;
      painted.current.add(number);
      void document.renderPage(number, canvas, width).catch(() => painted.current.delete(number));
    };

    // Without an observer there is no way to tell what is on screen, so everything is
    // painted at once. Costlier, but a reader who cannot see the pages has nothing.
    if (typeof IntersectionObserver === 'undefined') {
      onVisiblePage(1);
      for (const [number] of entries) paint(number);
      return undefined;
    }

    // The counter names the *first* page on screen, not whichever one the observer
    // happened to report last: with a 200 px margin several pages are visible at once,
    // and the reader is looking at the topmost of them.
    const visible = new Set<number>();
    const observer = new IntersectionObserver((records) => {
      for (const record of records) {
        const number = Number((record.target as HTMLElement).dataset.page);
        if (!number) continue;
        if (record.isIntersecting) {
          visible.add(number);
          paint(number);
        } else visible.delete(number);
      }
      if (visible.size) onVisiblePage(Math.min(...visible));
    }, { root: root ?? null, rootMargin: '200px 0px', threshold: 0.01 });

    for (const [, canvas] of entries) observer.observe(canvas);
    return () => observer.disconnect();
  }, [container, document, onVisiblePage]);

  return <>
    {numbers.map((number) => (
      <canvas
        key={number}
        className="pdf-preview-page"
        data-page={number}
        aria-label={`${number}`}
        ref={(canvas) => register(canvas, number)}
      />
    ))}
  </>;
};
