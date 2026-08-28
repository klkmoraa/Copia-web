/**
 * Calculation report — orchestrator.
 *
 * Until 0.8.2 this file was a single 1.058-line closure: every drawing routine captured the
 * same mutable `page`/`y` cursor, so no section could be read, tested or changed on its own.
 * The layout now lives in `utils/pdf/`, and this module only decides *which* sections the
 * document has and in *what* order.
 *
 * `pdf-lib` stays behind a dynamic `import()` — that is what keeps it out of the entry chunk —
 * so the modules under `utils/pdf/` import it as types only and receive `rgb`, the fonts, and
 * the handful of operator functions `mathVector.ts` needs (`concatTransformationMatrix`,
 * `pushGraphicsState`, `popGraphicsState`) through the `ReportContext`/`PdfLayout`.
 */
import { createPortablePayload } from './portablePayload';
import { PdfLayout } from './pdf/pdfBuilder';
import { safeFilename } from './pdf/pdfFormat';
import { drawExecutivePage } from './pdf/pdfCover';
import { drawQuantityPage } from './pdf/pdfQuantitySection';
import { drawScopePage } from './pdf/pdfScopeSection';
import { drawProcedureSummary } from './pdf/pdfProcedureSection';
import { drawTechnicalAnnex } from './pdf/pdfAnnexSection';
import { attachPortablePayload } from './pdf/pdfPayloadSection';
import { drawCoverPage, drawTableOfContents } from './pdf/pdfFrontMatter';
import { attachOutline } from './pdf/pdfOutline';
import {
  createModelIndex,
  type CalculationReportArtifact,
  type CalculationReportOptions,
  type ReportContext,
  type ReportPalette,
} from './pdf/reportContext';
import type { AnalysisResult, ProjectModel } from '../types';

export type { CalculationReportOptions, CalculationReportArtifact } from './pdf/reportContext';

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
    { PDFDocument, StandardFonts, rgb, PDFName, PDFArray, PDFNumber, PDFHexString, concatTransformationMatrix },
    { pushGraphicsState, popGraphicsState },
    payload,
  ] = await Promise.all([
    import('pdf-lib'),
    import('pdf-lib/cjs/api/operators.js'),
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
  const palette: ReportPalette = {
    forest: rgb(0.07, 0.38, 0.21),
    forestDeep: rgb(0.04, 0.24, 0.14),
    forestSoft: rgb(0.86, 0.95, 0.89),
    ink: rgb(0.12, 0.16, 0.22),
    rule: rgb(0.73, 0.78, 0.84),
    white: rgb(1, 1, 1),
    quantity: {
      axial: rgb(0.03, 0.40, 0.75),
      shear: rgb(0.05, 0.51, 0.27),
      moment: rgb(0.86, 0.20, 0.18),
    },
  };
  const context: ReportContext = {
    layout: new PdfLayout(pdf, fonts, palette, rgb, { concatTransformationMatrix, pushGraphicsState, popGraphicsState }),
    project,
    analysis,
    payload,
    options,
    scenarioFactors: options.scenarioFactors ?? Object.fromEntries(
      project.loadCases.filter((loadCase) => loadCase.active).map((loadCase) => [loadCase.id, 1]),
    ),
    index: createModelIndex(project, analysis),
  };

  // Page one is reserved for the cover before anything is drawn on it. Its contents list
  // can only be written once every section knows where it landed, so it is stamped at the
  // end — the same reason `stampFooters` waits for the last page to exist.
  const coverIndex = context.layout.pages.indexOf(context.layout.page);
  context.layout.newPage();

  // The executive page is the document: it is never dropped. Everything after it is a
  // section the reader may not need in this particular copy, and the numbered bands stay
  // consecutive so a shortened report never shows a gap where a section used to be.
  drawExecutivePage(context);
  let band = 2;
  const nextBand = (): string => String(band++).padStart(2, '0');
  if (options.includeDiagrams !== false) {
    drawQuantityPage(context, 'axial', nextBand());
    drawQuantityPage(context, 'shear', nextBand());
    drawQuantityPage(context, 'moment', nextBand());
  }
  if (options.includeScope !== false) drawScopePage(context, nextBand());
  if (options.includeProcedure !== false) drawProcedureSummary(context, nextBand());
  if (options.includeAnnex !== false) drawTechnicalAnnex(context);

  drawCoverPage(context, coverIndex, PROFESSIONAL_NOTE);
  drawTableOfContents(context.layout, coverIndex);
  attachOutline(pdf, { PDFName, PDFArray, PDFNumber, PDFHexString }, context.layout.sections);
  context.layout.stampFooters();

  const bytes = await attachPortablePayload(context);
  return { bytes, filename: `${safeFilename(project.name)}-memoria-calculo.pdf`, payload };
};
