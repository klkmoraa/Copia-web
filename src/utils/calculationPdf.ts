/**
 * Calculation report — orchestrator.
 *
 * This module decides *which* parts the document has and in *what* order; the layout lives in
 * `utils/pdf/`. Since the 0.8.3 redesign there is one sequence of numbered parts rather than
 * a set of "visual pages" followed by an unnumbered annex with its own internal numbering, so
 * this list is literally the table of contents.
 *
 * Since 0.8.4 the two halves of "producing a PDF" are separated by a JSON document. Everything
 * below composes a `ReportDocument` — parts, blocks, typeset equations, figures as vector marks
 * — and hands it to `python/structureco_report/`, which runs on ReportLab and does the drawing.
 * No page in this file, no font, no PDF library: `renderReportDocument` is the whole seam, and
 * it stays behind a dynamic `import()` so neither the renderer nor its Python runtime is in the
 * entry chunk.
 */
import { createPortablePayload } from './portablePayload';
import { PdfLayout } from './pdf/pdfBuilder';
import { safeFilename } from './pdf/pdfFormat';
import { pdfText } from './pdf/pdfGlyphs';
import { drawSummaryPart } from './pdf/pdfSummarySection';
import { drawQuantityPart } from './pdf/pdfQuantitySection';
import { drawScopePart } from './pdf/pdfScopeSection';
import { drawProcedurePart } from './pdf/pdfProcedureSection';
import { drawModelPart } from './pdf/pdfModelSection';
import { drawMaterialsPart } from './pdf/pdfMaterialsSection';
import { drawResultsPart } from './pdf/pdfResultsSection';
import { drawTracePart } from './pdf/pdfTraceSection';
import { buildDocumentMetadata, buildPortableAttachment } from './pdf/pdfPayloadSection';
import { buildCoverPage } from './pdf/pdfFrontMatter';
import {
  createModelIndex,
  type CalculationReportArtifact,
  type CalculationReportOptions,
  type ReportContext,
} from './pdf/reportContext';
import type { ReportDocument } from './pdf/reportDocument';
import type { AnalysisResult, ProjectModel } from '../types';

export type { CalculationReportOptions, CalculationReportArtifact } from './pdf/reportContext';

const DOCUMENT_TITLE = 'Memoria de cálculo estructural';

/**
 * Repeated on the cover because that is the one page of a signed document everybody reads.
 * The catalogue key `app.professionalNote` says the same thing in the product; this copy is
 * duplicated rather than imported so the report never depends on the UI's language state —
 * the document is written in Spanish regardless of the interface.
 */
const PROFESSIONAL_NOTE = 'structureCo es una ayuda de modelado y cálculo: no sustituye la revisión, '
  + 'el criterio ni la certificación de un profesional. Los resultados dependen enteramente del '
  + 'modelo introducido, y su idoneidad es responsabilidad del ingeniero que firma.';

/**
 * Composes the normalized document. Exported so a test — or the renderer's own fixtures — can
 * assert what the report *says* without paying for a PDF.
 */
export const createReportDocument = async (
  project: ProjectModel,
  analysis: AnalysisResult,
  options: CalculationReportOptions = {},
): Promise<{ document: ReportDocument; payload: Awaited<ReturnType<typeof createPortablePayload>> }> => {
  const payload = await createPortablePayload(project, analysis, options);
  const context: ReportContext = {
    layout: new PdfLayout(),
    project,
    analysis,
    payload,
    options,
    scenarioFactors: options.scenarioFactors ?? Object.fromEntries(
      project.loadCases.filter((loadCase) => loadCase.active).map((loadCase) => [loadCase.id, 1]),
    ),
    index: createModelIndex(project, analysis),
  };
  const { layout } = context;

  // Part one is the document: it is never dropped. Everything after it is a part the reader
  // may not need in this particular copy, and because the numbering is assigned by
  // `layout.part` as each one opens, a shortened report never shows a gap where a part used
  // to be.
  drawSummaryPart(context);
  if (options.includeDiagrams !== false) {
    drawQuantityPart(context, 'axial');
    drawQuantityPart(context, 'shear');
    drawQuantityPart(context, 'moment');
  }
  if (options.includeScope !== false) drawScopePart(context);
  if (options.includeProcedure !== false) drawProcedurePart(context);
  if (options.includeMaterials !== false) drawMaterialsPart(context);
  if (options.includeAnnex !== false) {
    drawModelPart(context);
    drawResultsPart(context);
    if (options.includeEducationTrace !== false && analysis.educationTrace) drawTracePart(context);
  }

  const { parts } = layout.build();
  const document: ReportDocument = {
    version: 1,
    page: { width: layout.width, height: layout.height, margin: layout.margin },
    cover: buildCoverPage(context, DOCUMENT_TITLE, PROFESSIONAL_NOTE),
    contentsTitle: pdfText('Contenido'),
    runningTitle: pdfText(project.name),
    documentTitle: pdfText(DOCUMENT_TITLE),
    parts,
    metadata: buildDocumentMetadata(context),
    attachment: buildPortableAttachment(context),
  };
  return { document, payload };
};

export const createCalculationReport = async (
  project: ProjectModel,
  analysis: AnalysisResult,
  options: CalculationReportOptions = {},
): Promise<CalculationReportArtifact> => {
  const [{ renderReportDocument }, composed] = await Promise.all([
    import('./pdf/reportlabRenderer'),
    createReportDocument(project, analysis, options),
  ]);
  const bytes = await renderReportDocument(composed.document);
  return {
    bytes,
    filename: `${safeFilename(project.name)}-memoria-calculo.pdf`,
    payload: composed.payload,
  };
};
