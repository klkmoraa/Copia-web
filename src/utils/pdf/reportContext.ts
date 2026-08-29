/**
 * Shared vocabulary of the calculation report composer.
 *
 * Every module under `utils/pdf/` receives one `ReportContext` and writes through it. It no
 * longer carries a PDF library's factories: since 0.8.4 the composer produces a
 * `ReportDocument` and `python/structureco_report/` renders it, so the only renderer-shaped
 * thing left in this context is `layout`, and even that draws into a `Surface`.
 */
import type { AnalysisResult, MemberModel, MemberResult, NodeModel, ProjectModel } from '../../types';
import type { StructureCoPortablePayload } from '../portableTypes';
import type { PortablePayloadOptions } from '../portablePayload';
import type { PdfLayout } from './pdfBuilder';

export interface CalculationReportOptions extends PortablePayloadOptions {
  includeEducationTrace?: boolean;
  /** Exact load-case multipliers used to produce the supplied analysis. */
  scenarioFactors?: Record<string, number>;
  /**
   * Sections the reader can drop from the export. All default to `true`, so every existing
   * caller keeps the complete document; the preview dialog is what makes them adjustable.
   * The portable payload is attached regardless — a shorter report is still re-importable.
   */
  includeDiagrams?: boolean;
  includeScope?: boolean;
  includeProcedure?: boolean;
  includeAnnex?: boolean;
  /** The material and section specification part. */
  includeMaterials?: boolean;
  /**
   * The free-body diagram of every step of the chosen method — one per cut, per joint, per
   * storey, per span. Complete by default; a reader who only wants the arithmetic can drop
   * the drawings without losing the procedure they belong to.
   */
  includeMethodFreeBodies?: boolean;
}

export interface CalculationReportArtifact {
  bytes: Uint8Array;
  filename: string;
  payload: StructureCoPortablePayload;
}

export type { ReportPalette } from './pdfTheme';
export type { ReportFont, ReportFonts } from './pdfSurface';
export type { Tone } from './reportDocument';

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
