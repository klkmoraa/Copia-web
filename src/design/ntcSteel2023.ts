import { findStandardMaterial } from '../data/standardMaterials';
import { findStandardSection } from '../data/standardSections';
import { resolveReliability } from '../engine/reliability';
import type { AnalysisResult, MemberModel, ProjectModel } from '../types';
import type { DesignResult } from './types';

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

export const NTC_STEEL_2023_TENSION_LIBRARY = deepFreeze({
  schemaVersion: 1,
  id: 'ntc-cdmx-2023-steel-tension-gross-yielding',
  revision: '2026-08-24.1',
  title: 'NTC Acero CDMX 2023 · tensión axial · fluencia de sección total',
  jurisdiction: 'Ciudad de México',
  edition: '2023',
  publicationDate: '2023-11-06',
  reviewedAt: '2026-08-24',
  units: 'kN-m',
  source: {
    title: 'Gaceta Oficial de la Ciudad de México · Normas Técnicas Complementarias 2023',
    url: 'https://www.obras.cdmx.gob.mx/storage/app/media/Normas%20tecnicas/NTC-2023.pdf',
    sha256: '293f22316a59ec2ec64d1f64f0749f49ba8849ded15b289cd88cc171c55ae62a',
    pdfPage: 325,
    printedPage: 84,
  },
  scope: {
    memberType: 'truss',
    materialId: 'steel-a992',
    sectionStandard: 'AISC',
    sectionShapeType: 'I',
    demand: 'positive-axial-envelope-of-traceable-ultimate-combination',
  },
  check: {
    id: 'gross-section-yielding',
    title: 'Fluencia en la sección total',
    clause: '5.3.1.a',
    equation: 'Rt,y = FR · Fy · A',
    inequality: 'Pu ≤ Rt,y',
    resistanceFactor: 0.9,
  },
  exclusions: [
    'Fractura en la sección neta efectiva (§5.3.1.b).',
    'Conexiones, agujeros, excentricidad, flexotensión y block shear.',
    'Compresión, pandeo, flexión, cortante e interacciones.',
    'Certificación o conclusión de cumplimiento del miembro.',
  ],
} as const);

export interface GrossSectionYieldingInput {
  readonly memberId: string;
  readonly materialId: string;
  readonly sectionId: string;
  readonly combinationId: string;
  /** Positive axial design action, kN. */
  readonly demand: number;
  /** Fy, kN/m². */
  readonly yieldStrength: number;
  /** Gross area, m². */
  readonly grossArea: number;
}

const finitePositive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} debe ser finito y mayor que cero.`);
  return value;
};

export const evaluateGrossSectionYielding = (input: GrossSectionYieldingInput): DesignResult => {
  const demand = finitePositive(input.demand, 'Pu');
  const yieldStrength = finitePositive(input.yieldStrength, 'Fy');
  const grossArea = finitePositive(input.grossArea, 'A');
  const resistanceFactor = NTC_STEEL_2023_TENSION_LIBRARY.check.resistanceFactor;
  const resistance = resistanceFactor * yieldStrength * grossArea;
  const ratio = demand / resistance;

  const demandVariable = {
    symbol: 'Pu', label: 'Demanda axial de diseño', value: demand, unit: 'kN',
    source: 'AnalysisResult.memberResults · envolvente axial positiva',
  } as const;
  const resistanceVariable = {
    symbol: 'Rt,y', label: 'Resistencia de diseño por fluencia de sección total', value: resistance, unit: 'kN',
    source: 'NTC Acero 2023 §5.3.1.a',
  } as const;

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: {
      id: NTC_STEEL_2023_TENSION_LIBRARY.id,
      version: NTC_STEEL_2023_TENSION_LIBRARY.revision,
    },
    standard: {
      title: NTC_STEEL_2023_TENSION_LIBRARY.title,
      jurisdiction: NTC_STEEL_2023_TENSION_LIBRARY.jurisdiction,
      edition: NTC_STEEL_2023_TENSION_LIBRARY.edition,
      publicationDate: NTC_STEEL_2023_TENSION_LIBRARY.publicationDate,
      reviewedAt: NTC_STEEL_2023_TENSION_LIBRARY.reviewedAt,
      sourceUrl: NTC_STEEL_2023_TENSION_LIBRARY.source.url,
      sourceSha256: NTC_STEEL_2023_TENSION_LIBRARY.source.sha256,
      pdfPage: NTC_STEEL_2023_TENSION_LIBRARY.source.pdfPage,
      printedPage: NTC_STEEL_2023_TENSION_LIBRARY.source.printedPage,
    },
    generatedFrom: {
      kind: 'analysis-result', combinationId: input.combinationId,
      memberResultId: input.memberId, demandSelector: 'positive-axial-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: NTC_STEEL_2023_TENSION_LIBRARY.check.id,
      title: NTC_STEEL_2023_TENSION_LIBRARY.check.title,
      clause: NTC_STEEL_2023_TENSION_LIBRARY.check.clause,
      equation: NTC_STEEL_2023_TENSION_LIBRARY.check.equation,
      inequality: NTC_STEEL_2023_TENSION_LIBRARY.check.inequality,
    },
    substitutions: [
      demandVariable,
      { symbol: 'FR', label: 'Factor de resistencia', value: resistanceFactor, unit: '1', source: 'NTC Acero 2023 §5.3.1.a' },
      { symbol: 'Fy', label: 'Esfuerzo de fluencia del material', value: yieldStrength, unit: 'kN/m²', source: `Catálogo material ${input.materialId}` },
      { symbol: 'A', label: 'Área total de la sección', value: grossArea, unit: 'm²', source: `Catálogo sección ${input.sectionId}` },
      resistanceVariable,
    ],
    demand: demandVariable,
    resistance: resistanceVariable,
    ratio: { symbol: 'Pu/Rt,y', value: ratio, unit: '1' },
    componentStatus: demand <= resistance ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: [
      'Miembro prismático sometido a tensión axial a lo largo de su eje centroidal.',
      'La combinación última y su aplicabilidad fueron revisadas por la persona responsable.',
      'El área total y Fy provienen de identidades de catálogo explícitas y sin divergencia.',
    ],
    limitations: [
      'Este componente aislado no concluye el diseño del miembro.',
      'No evalúa fractura neta, conexión, excentricidad, flexotensión ni otros estados límite.',
      'No constituye certificación ni declaración de seguridad estructural.',
    ],
    missingChecks: ['net-section-fracture', 'connection-and-eccentricity', 'remaining-member-limit-states'],
  } satisfies DesignResult) as DesignResult;
};

export type NtcSteelDesignBlocker =
  | 'reliable-analysis-required'
  | 'ntc-ultimate-combination-required'
  | 'member-result-required'
  | 'unsupported-member-family'
  | 'explicit-catalog-identity-required'
  | 'unsupported-material-section-family'
  | 'catalog-properties-drifted'
  | 'pure-axial-demand-required'
  | 'positive-tension-required';

export type NtcSteelDesignOutcome =
  | { readonly status: 'available'; readonly result: DesignResult }
  | { readonly status: 'unavailable'; readonly memberId: string; readonly blockers: readonly NtcSteelDesignBlocker[] };

export interface NtcSteelDesignRequest {
  readonly project: ProjectModel;
  readonly analysis: AnalysisResult | null | undefined;
  readonly combinationId: string;
  readonly memberId: string;
}

const unavailable = (memberId: string, blocker: NtcSteelDesignBlocker): NtcSteelDesignOutcome => ({
  status: 'unavailable', memberId, blockers: [blocker],
});

const isTraceableNtcUltimate = (project: ProjectModel, combinationId: string): boolean => {
  if (!combinationId) return false;
  const combination = project.combinations.find((candidate) => candidate.id === combinationId);
  return combination?.stateLimit === 'ultimate'
    && combination.edition === NTC_STEEL_2023_TENSION_LIBRARY.edition
    && combination.jurisdiction?.trim().toLocaleLowerCase('es-MX') === 'ciudad de méxico'
    && Boolean(combination.source?.trim())
    && Boolean(combination.sourceUrl?.trim());
};

const areaMatchesCatalog = (member: MemberModel, area: number): boolean => {
  if (!Number.isFinite(member.A) || member.A <= 0) return false;
  return Math.abs(member.A - area) <= Math.max(1e-12, area * 1e-9);
};

export const designNtcSteelTensionMember = (request: NtcSteelDesignRequest): NtcSteelDesignOutcome => {
  const { project, analysis, combinationId, memberId } = request;
  if (!analysis?.success) return unavailable(memberId, 'reliable-analysis-required');
  const reliability = resolveReliability(analysis);
  if (!reliability.usable || reliability.level !== 'reliable') {
    return unavailable(memberId, 'reliable-analysis-required');
  }
  if (!isTraceableNtcUltimate(project, combinationId)) {
    return unavailable(memberId, 'ntc-ultimate-combination-required');
  }

  const member = project.members.find((candidate) => candidate.id === memberId);
  const memberResult = analysis.memberResults.find((candidate) => candidate.memberId === memberId);
  if (!member || !memberResult) return unavailable(memberId, 'member-result-required');
  if (member.type !== NTC_STEEL_2023_TENSION_LIBRARY.scope.memberType) {
    return unavailable(memberId, 'unsupported-member-family');
  }
  if (member.materialOrigin !== 'catalog' || member.sectionOrigin !== 'catalog' || !member.materialId || !member.sectionId) {
    return unavailable(memberId, 'explicit-catalog-identity-required');
  }

  const material = findStandardMaterial(member.materialId);
  const section = findStandardSection(member.sectionId);
  if (!material || !section
    || material.id !== NTC_STEEL_2023_TENSION_LIBRARY.scope.materialId
    || section.standard !== NTC_STEEL_2023_TENSION_LIBRARY.scope.sectionStandard
    || section.shapeType !== NTC_STEEL_2023_TENSION_LIBRARY.scope.sectionShapeType) {
    return unavailable(memberId, 'unsupported-material-section-family');
  }
  if (!areaMatchesCatalog(member, section.area)) return unavailable(memberId, 'catalog-properties-drifted');

  const axialScale = Math.max(1, Math.abs(memberResult.maxAxial), Math.abs(memberResult.minAxial));
  const forceTolerance = axialScale * 1e-9;
  const momentTolerance = axialScale * Math.max(memberResult.length, 1) * 1e-9;
  if (Math.max(Math.abs(memberResult.maxShear), Math.abs(memberResult.minShear)) > forceTolerance
    || Math.max(Math.abs(memberResult.maxMoment), Math.abs(memberResult.minMoment)) > momentTolerance) {
    return unavailable(memberId, 'pure-axial-demand-required');
  }
  const demand = Math.max(0, memberResult.maxAxial, memberResult.minAxial);
  if (!(demand > forceTolerance)) return unavailable(memberId, 'positive-tension-required');

  return {
    status: 'available',
    result: evaluateGrossSectionYielding({
      memberId, materialId: material.id, sectionId: section.id, combinationId,
      demand, yieldStrength: material.yieldStrength, grossArea: section.area,
    }),
  };
};

export type NtcSteelDesignSummary =
  | {
    readonly status: 'available';
    readonly statusConclusion: 'incomplete';
    readonly coverage: 'complete' | 'partial';
    readonly highest: DesignResult;
    readonly results: readonly DesignResult[];
    readonly skipped: readonly Extract<NtcSteelDesignOutcome, { status: 'unavailable' }>[];
  }
  | {
    readonly status: 'unavailable';
    readonly statusConclusion: 'incomplete';
    readonly skipped: readonly Extract<NtcSteelDesignOutcome, { status: 'unavailable' }>[];
  };

export const summarizeNtcSteelTensionDesign = (
  request: Omit<NtcSteelDesignRequest, 'memberId'>,
): NtcSteelDesignSummary => {
  const outcomes = request.project.members.map((candidate) => designNtcSteelTensionMember({
    ...request,
    memberId: candidate.id,
  }));
  const results = outcomes.flatMap((outcome) => outcome.status === 'available' ? [outcome.result] : []);
  const skipped = outcomes.filter((outcome): outcome is Extract<NtcSteelDesignOutcome, { status: 'unavailable' }> => outcome.status === 'unavailable');
  results.sort((first, second) => second.ratio.value - first.ratio.value);
  if (!results.length) return { status: 'unavailable', statusConclusion: 'incomplete', skipped };
  return {
    status: 'available', statusConclusion: 'incomplete',
    coverage: skipped.length ? 'partial' : 'complete',
    highest: results[0], results, skipped,
  };
};
