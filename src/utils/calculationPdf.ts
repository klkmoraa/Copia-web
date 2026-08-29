/**
 * Calculation report — orchestrator.
 *
 * This module decides *which* parts the document has and in *what* order; the layout lives in
 * `utils/pdf/`. Since the 0.8.3 redesign there is one sequence of numbered parts rather than
 * a set of "visual pages" followed by an unnumbered annex with its own internal numbering, so
 * this list is literally the table of contents.
 *
 * `pdf-lib` stays behind a dynamic `import()` — that is what keeps it out of the entry chunk —
 * so the modules under `utils/pdf/` import it as types only and receive `rgb`, the fonts, and
 * the handful of operator functions `mathVector.ts` needs (`concatTransformationMatrix`,
 * `pushGraphicsState`, `popGraphicsState`) through the `ReportContext`/`PdfLayout`.
 */
import { createPortablePayload } from './portablePayload';
import { PdfLayout } from './pdf/pdfBuilder';
import { createPalette } from './pdf/pdfTheme';
import { safeFilename } from './pdf/pdfFormat';
import { drawSummaryPart } from './pdf/pdfSummarySection';
import { drawQuantityPart } from './pdf/pdfQuantitySection';
import { drawScopePart } from './pdf/pdfScopeSection';
import { drawProcedurePart } from './pdf/pdfProcedureSection';
import { drawModelPart } from './pdf/pdfModelSection';
import { drawMaterialsPart } from './pdf/pdfMaterialsSection';
import { drawResultsPart } from './pdf/pdfResultsSection';
import { drawTracePart } from './pdf/pdfTraceSection';
import { attachPortablePayload } from './pdf/pdfPayloadSection';
import { drawCoverPage, drawContentsPage } from './pdf/pdfFrontMatter';
import { attachOutline } from './pdf/pdfOutline';
import {
  createModelIndex,
  type CalculationReportArtifact,
  type CalculationReportOptions,
  type ReportContext,
} from './pdf/reportContext';
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

export const createCalculationReport = async (
  project: ProjectModel,
  analysis: AnalysisResult,
  options: CalculationReportOptions = {},
): Promise<CalculationReportArtifact> => {
  const [
    {
      PDFDocument, StandardFonts, rgb, PDFName, PDFArray, PDFNumber, PDFHexString,
      concatTransformationMatrix, pushGraphicsState, popGraphicsState,
    },
    payload,
  ] = await Promise.all([
    import('pdf-lib'),
    createPortablePayload(project, analysis, options),
  ]);
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    mathRegular: await pdf.embedFont(StandardFonts.TimesRoman),
    mathItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    mathSymbol: await pdf.embedFont(StandardFonts.Symbol),
  };
  const context: ReportContext = {
    layout: new PdfLayout(pdf, fonts, createPalette(rgb), rgb, { concatTransformationMatrix, pushGraphicsState, popGraphicsState }),
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

  // The first two sheets are front matter and are written last: the cover needs nothing from
  // the body, but the contents page cannot be set until every part knows the page it landed
  // on — the same reason `stampChrome` waits for the final page to exist.
  const coverIndex = layout.pages.indexOf(layout.page);
  layout.newPage();
  const contentsIndex = layout.pages.indexOf(layout.page);

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

  drawCoverPage(context, coverIndex, PROFESSIONAL_NOTE);
  drawContentsPage(layout, contentsIndex);
  attachOutline(pdf, { PDFName, PDFArray, PDFNumber, PDFHexString }, layout.sections);
  layout.stampChrome(project.name, DOCUMENT_TITLE);

  const bytes = await attachPortablePayload(context);
  return { bytes, filename: `${safeFilename(project.name)}-memoria-calculo.pdf`, payload };
};
