/**
 * Calculation report — orchestrator.
 *
 * Until 0.8.2 this file was a single 1.058-line closure: every drawing routine captured the
 * same mutable `page`/`y` cursor, so no section could be read, tested or changed on its own.
 * The layout now lives in `utils/pdf/`, and this module only decides *which* sections the
 * document has and in *what* order.
 *
 * `pdf-lib` stays behind a dynamic `import()` — that is what keeps it out of the entry chunk —
 * so the modules under `utils/pdf/` import it as types only and receive `rgb` and the fonts
 * through the `ReportContext`.
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
import {
  createModelIndex,
  type CalculationReportArtifact,
  type CalculationReportOptions,
  type ReportContext,
  type ReportPalette,
} from './pdf/reportContext';
import type { AnalysisResult, ProjectModel } from '../types';

export type { CalculationReportOptions, CalculationReportArtifact } from './pdf/reportContext';

export const createCalculationReport = async (
  project: ProjectModel,
  analysis: AnalysisResult,
  options: CalculationReportOptions = {},
): Promise<CalculationReportArtifact> => {
  const [{ PDFDocument, StandardFonts, rgb }, payload] = await Promise.all([
    import('pdf-lib'),
    createPortablePayload(project, analysis, options),
  ]);
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    mathRegular: await pdf.embedFont(StandardFonts.TimesRoman),
    mathItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
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
    layout: new PdfLayout(pdf, fonts, palette, rgb),
    project,
    analysis,
    payload,
    options,
    scenarioFactors: options.scenarioFactors ?? Object.fromEntries(
      project.loadCases.filter((loadCase) => loadCase.active).map((loadCase) => [loadCase.id, 1]),
    ),
    index: createModelIndex(project, analysis),
  };

  drawExecutivePage(context);
  drawQuantityPage(context, 'axial', '02');
  drawQuantityPage(context, 'shear', '03');
  drawQuantityPage(context, 'moment', '04');
  drawScopePage(context);
  drawProcedureSummary(context);
  drawTechnicalAnnex(context);
  context.layout.stampFooters();

  const bytes = await attachPortablePayload(context);
  return { bytes, filename: `${safeFilename(project.name)}-memoria-calculo.pdf`, payload };
};

export const createCalculationReportBlob = async (
  project: ProjectModel,
  analysis: AnalysisResult,
  options?: CalculationReportOptions,
): Promise<Blob> => {
  const report = await createCalculationReport(project, analysis, options);
  return new Blob([report.bytes as BlobPart], { type: 'application/pdf' });
};
