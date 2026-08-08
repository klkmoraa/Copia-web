/**
 * Shared vocabulary of the calculation report renderer.
 *
 * Every module under `utils/pdf/` receives one `ReportContext` and draws through it. Nothing
 * here imports `pdf-lib` as a value: the library is loaded with a dynamic `import()` inside
 * `createCalculationReport`, and its factories travel through this context. A static value
 * import anywhere in this folder would drag `pdf-lib` back into the entry chunk.
 */
import type { AnalysisResult, MemberModel, MemberResult, NodeModel, ProjectModel } from '../../types';
import type { StructureCoPortablePayload } from '../portableTypes';
import type { PortablePayloadOptions } from '../portablePayload';
import type { PdfLayout } from './pdfBuilder';

export interface CalculationReportOptions extends PortablePayloadOptions {
  includeEducationTrace?: boolean;
  /** Exact load-case multipliers used to produce the supplied analysis. */
  scenarioFactors?: Record<string, number>;
}

export interface CalculationReportArtifact {
  bytes: Uint8Array;
  filename: string;
  payload: StructureCoPortablePayload;
}

/** A colour produced by `rgb()`; named so the signature does not repeat the inference. */
export type PdfColor = ReturnType<typeof import('pdf-lib').rgb>;

/** The `rgb` factory itself, handed to the renderer by the dynamic import. */
export type RgbFactory = typeof import('pdf-lib').rgb;

export interface ReportFonts {
  readonly regular: import('pdf-lib').PDFFont;
  readonly bold: import('pdf-lib').PDFFont;
  readonly mathRegular: import('pdf-lib').PDFFont;
  readonly mathItalic: import('pdf-lib').PDFFont;
}

export interface ReportPalette {
  readonly forest: PdfColor;
  readonly forestDeep: PdfColor;
  readonly forestSoft: PdfColor;
  /** Default body text. */
  readonly ink: PdfColor;
  readonly rule: PdfColor;
  readonly white: PdfColor;
  readonly quantity: Readonly<Record<'axial' | 'shear' | 'moment', PdfColor>>;
}

/**
 * Identity lookups for the model.
 *
 * The renderer used to resolve every node, member and member result with `Array.find` inside
 * loops that themselves walk members or loads, so a page cost O(n·m) scans. The maps keep the
 * *first* entry for a repeated id, which is exactly what `find` returned.
 */
export interface ModelIndex {
  node(id: string): NodeModel | undefined;
  member(id: string): MemberModel | undefined;
  memberResult(memberId: string): MemberResult | undefined;
}

const firstById = <T>(items: readonly T[], key: (item: T) => string): Map<string, T> => {
  const map = new Map<string, T>();
  for (const item of items) {
    const id = key(item);
    if (!map.has(id)) map.set(id, item);
  }
  return map;
};

export const createModelIndex = (project: ProjectModel, analysis: AnalysisResult): ModelIndex => {
  const nodes = firstById(project.nodes, (node) => node.id);
  const members = firstById(project.members, (member) => member.id);
  const memberResults = firstById(analysis.memberResults, (result) => result.memberId);
  return {
    node: (id) => nodes.get(id),
    member: (id) => members.get(id),
    memberResult: (memberId) => memberResults.get(memberId),
  };
};

export interface ReportContext {
  readonly layout: PdfLayout;
  readonly project: ProjectModel;
  readonly analysis: AnalysisResult;
  readonly payload: StructureCoPortablePayload;
  readonly options: CalculationReportOptions;
  /** Load-case multipliers behind the supplied analysis, resolved once. */
  readonly scenarioFactors: Record<string, number>;
  readonly index: ModelIndex;
}
