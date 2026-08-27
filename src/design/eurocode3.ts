import { findStandardMaterial } from '../data/standardMaterials';
import { findStandardSection } from '../data/standardSections';
import type { AnalysisResult, ProjectModel } from '../types';
import type { DesignResult, DesignVariable } from './types';

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

export const EUROCODE_3_METADATA = deepFreeze({
  schemaVersion: 1,
  id: 'en-1993-1-1',
  revision: '2026-08-27.1',
  title: 'Eurocode 3 · Design of steel structures · Part 1-1: General rules and rules for buildings',
  jurisdiction: 'European Union / CEN',
  edition: '2005 (EN 1993-1-1:2005+A1:2014)',
  publicationDate: '2005-05-01',
  reviewedAt: '2026-08-27',
  units: 'kN-m',
  source: {
    title: 'EN 1993-1-1: Eurocode 3: Design of steel structures - Part 1-1',
    url: 'https://www.cen.eu/',
    sha256: 'a9b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123',
    pdfPage: 1,
    printedPage: 1,
  },
} as const);

const EUROCODE_STANDARD_REF = deepFreeze({
  title: EUROCODE_3_METADATA.title,
  jurisdiction: EUROCODE_3_METADATA.jurisdiction,
  edition: EUROCODE_3_METADATA.edition,
  publicationDate: EUROCODE_3_METADATA.publicationDate,
  reviewedAt: EUROCODE_3_METADATA.reviewedAt,
  sourceUrl: EUROCODE_3_METADATA.source.url,
  sourceSha256: EUROCODE_3_METADATA.source.sha256,
  pdfPage: EUROCODE_3_METADATA.source.pdfPage,
  printedPage: EUROCODE_3_METADATA.source.printedPage,
} as const);

export interface EurocodeCheckInput {
  memberId: string;
  materialId: string;
  sectionId: string;
  combinationId: string;
  length: number; // m
  axialDemand: number; // kN (+ tension, - compression)
  momentDemand: number; // kN-m
  shearDemand: number; // kN
  yieldStrength: number; // kN/m² (fy)
  elasticModulus: number; // kN/m² (E)
  grossArea: number; // m² (A)
  inertiaX: number; // m⁴ (Iy / Iz)
  sectionModulusX: number; // m³ (Wel)
  plasticModulusX: number; // m³ (Wpl)
  radiusOfGyrationX: number; // m (i)
  depth?: number; // m (h)
  webThickness?: number; // m (tw)
  gammaM0?: number;
  gammaM1?: number;
}

/**
 * EN 1993-1-1 §6.2.3: Tensión axial (Tension - Section Resistance)
 * Npl,Rd = (A * fy) / gamma_M0
 */
export const evaluateEurocodeTension = (input: EurocodeCheckInput): DesignResult | null => {
  if (input.axialDemand <= 0) return null;
  const gammaM0 = input.gammaM0 ?? 1.0;
  const resistance = (input.grossArea * input.yieldStrength) / gammaM0;
  const demand = input.axialDemand;
  const ratio = demand / Math.max(1e-9, resistance);

  const demandVar: DesignVariable = {
    symbol: 'NEd',
    label: 'Esfuerzo axil de tracción de cálculo',
    value: demand,
    unit: 'kN',
    source: 'AnalysisResult.memberResults · Max Axial Tension',
  };
  const resVar: DesignVariable = {
    symbol: 'Nt,Rd',
    label: 'Resistencia plástica de cálculo a tracción',
    value: resistance,
    unit: 'kN',
    source: 'EN 1993-1-1 §6.2.3 Eq. 6.6',
  };

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: { id: `${EUROCODE_3_METADATA.id}-tension`, version: EUROCODE_3_METADATA.revision },
    standard: EUROCODE_STANDARD_REF,
    generatedFrom: {
      kind: 'analysis-result',
      combinationId: input.combinationId,
      memberResultId: input.memberId,
      demandSelector: 'axial-tension-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: 'ec3-tension-6-6',
      title: 'Tracción: Resistencia plástica de la sección bruta',
      clause: 'EN 1993-1-1 §6.2.3',
      equation: 'NEd ≤ Nt,Rd = (A · fy) / γ_M0 (γ_M0 = 1.00)',
      inequality: 'NEd ≤ Nt,Rd',
      limitStateKind: 'tension-yielding',
    },
    substitutions: [
      demandVar,
      { symbol: 'γ_M0', label: 'Coeficiente parcial de seguridad', value: gammaM0, unit: '1', source: 'EN 1993-1-1 §6.1' },
      { symbol: 'fy', label: 'Límite elástico nominal', value: input.yieldStrength, unit: 'kN/m²', source: input.materialId },
      { symbol: 'A', label: 'Área de la sección bruta', value: input.grossArea, unit: 'm²', source: input.sectionId },
      resVar,
    ],
    demand: demandVar,
    resistance: resVar,
    ratio: { symbol: 'NEd/Nt,Rd', value: ratio, unit: '1' },
    componentStatus: demand <= resistance ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: ['Pieza sin agujeros de tornillos significativos.'],
    limitations: ['No evalúa sección neta última Nu,Rd ni desgarro de bloque.'],
    missingChecks: ['net-section-resistance'],
  });
};

/**
 * EN 1993-1-1 §6.3.1: Compresión con Pandeo por Flexión (Buckling Resistance)
 * Ncr = pi^2 * E * I / L^2
 * lambda_bar = sqrt(A * fy / Ncr)
 * alpha = 0.21 (curva a de pandeo para perfiles laminados en I)
 * Phi = 0.5 * [1 + alpha * (lambda_bar - 0.2) + lambda_bar^2]
 * chi = 1 / [Phi + sqrt(Phi^2 - lambda_bar^2)] <= 1.0
 * Nb,Rd = (chi * A * fy) / gamma_M1
 */
export const evaluateEurocodeCompression = (input: EurocodeCheckInput): DesignResult | null => {
  const compDemand = Math.abs(Math.min(0, input.axialDemand));
  if (compDemand <= 0) return null;

  const gammaM1 = input.gammaM1 ?? 1.0;
  const Ncr = (Math.PI * Math.PI * input.elasticModulus * input.inertiaX) / Math.max(1e-6, input.length * input.length);
  const lambdaBar = Math.sqrt((input.grossArea * input.yieldStrength) / Math.max(1e-6, Ncr));
  const alpha = 0.21; // Curva de pandeo 'a'
  const phi = 0.5 * (1 + alpha * Math.max(0, lambdaBar - 0.2) + lambdaBar * lambdaBar);
  const term = Math.max(0, phi * phi - lambdaBar * lambdaBar);
  const chi = Math.min(1.0, 1.0 / (phi + Math.sqrt(term)));

  const NbRd = (chi * input.grossArea * input.yieldStrength) / gammaM1;
  const demand = compDemand;
  const ratio = demand / Math.max(1e-9, NbRd);

  const demandVar: DesignVariable = {
    symbol: 'NEd',
    label: 'Esfuerzo axil de compresión de cálculo',
    value: demand,
    unit: 'kN',
    source: 'AnalysisResult.memberResults · Min Axial Compression',
  };
  const resVar: DesignVariable = {
    symbol: 'Nb,Rd',
    label: 'Resistencia de cálculo frente al pandeo por compresión',
    value: NbRd,
    unit: 'kN',
    source: 'EN 1993-1-1 §6.3.1.1 Eq. 6.47',
  };

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: { id: `${EUROCODE_3_METADATA.id}-buckling`, version: EUROCODE_3_METADATA.revision },
    standard: EUROCODE_STANDARD_REF,
    generatedFrom: {
      kind: 'analysis-result',
      combinationId: input.combinationId,
      memberResultId: input.memberId,
      demandSelector: 'axial-compression-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: 'ec3-buckling-6-47',
      title: 'Compresión: Pandeo por flexión de barras aisladas',
      clause: 'EN 1993-1-1 §6.3.1.1',
      equation: 'NEd ≤ Nb,Rd = (χ · A · fy) / γ_M1 (γ_M1 = 1.00)',
      inequality: 'NEd ≤ Nb,Rd',
      limitStateKind: 'compression-buckling',
    },
    substitutions: [
      demandVar,
      { symbol: 'λ̄', label: 'Esbeltez relativa de la barra', value: lambdaBar, unit: '1', source: 'EN 1993-1-1 Eq. 6.50' },
      { symbol: 'χ', label: 'Coeficiente de reducción por pandeo', value: chi, unit: '1', source: 'EN 1993-1-1 Eq. 6.49 (curva a)' },
      { symbol: 'γ_M1', label: 'Coeficiente de seguridad de pandeo', value: gammaM1, unit: '1', source: 'EN 1993-1-1 §6.1' },
      resVar,
    ],
    demand: demandVar,
    resistance: resVar,
    ratio: { symbol: 'NEd/Nb,Rd', value: ratio, unit: '1' },
    componentStatus: demand <= NbRd ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: ['Sección de clase 1, 2 o 3 con pandeo en plano fuerte.'],
    limitations: ['No evalúa pandeo torsional ni distorsional (clase 4).'],
    missingChecks: ['torsional-buckling', 'class-4-effective-area'],
  });
};

/**
 * EN 1993-1-1 §6.2.5: Flexión simple (Bending - Plastic Moment Resistance)
 * Mc,Rd = Mpl,Rd = (Wpl * fy) / gamma_M0
 */
export const evaluateEurocodeFlexure = (input: EurocodeCheckInput): DesignResult | null => {
  const momentDemand = Math.abs(input.momentDemand);
  if (momentDemand <= 0) return null;

  const gammaM0 = input.gammaM0 ?? 1.0;
  const Wpl = input.plasticModulusX > 0 ? input.plasticModulusX : input.sectionModulusX * 1.14;
  const resistance = (Wpl * input.yieldStrength) / gammaM0;
  const demand = momentDemand;
  const ratio = demand / Math.max(1e-9, resistance);

  const demandVar: DesignVariable = {
    symbol: 'MEd',
    label: 'Momento flector de cálculo',
    value: demand,
    unit: 'kN-m',
    source: 'AnalysisResult.memberResults · Max Bending Moment',
  };
  const resVar: DesignVariable = {
    symbol: 'Mpl,Rd',
    label: 'Momento flector resistente plástico de cálculo',
    value: resistance,
    unit: 'kN-m',
    source: 'EN 1993-1-1 §6.2.5 Eq. 6.13',
  };

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: { id: `${EUROCODE_3_METADATA.id}-flexure`, version: EUROCODE_3_METADATA.revision },
    standard: EUROCODE_STANDARD_REF,
    generatedFrom: {
      kind: 'analysis-result',
      combinationId: input.combinationId,
      memberResultId: input.memberId,
      demandSelector: 'bending-moment-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: 'ec3-flexure-6-13',
      title: 'Flexión: Momento resistente plástico de la sección',
      clause: 'EN 1993-1-1 §6.2.5',
      equation: 'MEd ≤ Mpl,Rd = (Wpl · fy) / γ_M0 (γ_M0 = 1.00)',
      inequality: 'MEd ≤ Mpl,Rd',
      limitStateKind: 'flexure-yielding',
    },
    substitutions: [
      demandVar,
      { symbol: 'Wpl', label: 'Módulo resistente plástico', value: Wpl, unit: 'm³', source: input.sectionId },
      { symbol: 'fy', label: 'Límite elástico nominal', value: input.yieldStrength, unit: 'kN/m²', source: input.materialId },
      resVar,
    ],
    demand: demandVar,
    resistance: resVar,
    ratio: { symbol: 'MEd/Mpl,Rd', value: ratio, unit: '1' },
    componentStatus: demand <= resistance ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: ['Arriostramiento lateral continuo suficiente para evitar pandeo lateral.'],
    limitations: ['No evalúa pandeo lateral-torsional LTB (§6.3.2).'],
    missingChecks: ['lateral-torsional-buckling'],
  });
};

/**
 * EN 1993-1-1 §6.2.6: Cortante plástico (Shear Resistance)
 * Vpl,Rd = (Av * (fy / sqrt(3))) / gamma_M0
 */
export const evaluateEurocodeShear = (input: EurocodeCheckInput): DesignResult | null => {
  const shearDemand = Math.abs(input.shearDemand);
  if (shearDemand <= 0) return null;

  const gammaM0 = input.gammaM0 ?? 1.0;
  const d = input.depth ?? 0.20;
  const tw = input.webThickness ?? 0.006;
  const Av = Math.max(1e-6, d * tw);
  const resistance = (Av * (input.yieldStrength / Math.sqrt(3))) / gammaM0;
  const demand = shearDemand;
  const ratio = demand / Math.max(1e-9, resistance);

  const demandVar: DesignVariable = {
    symbol: 'VEd',
    label: 'Esfuerzo cortante de cálculo',
    value: demand,
    unit: 'kN',
    source: 'AnalysisResult.memberResults · Max Shear Force',
  };
  const resVar: DesignVariable = {
    symbol: 'Vpl,Rd',
    label: 'Resistencia plástica al cortante de cálculo',
    value: resistance,
    unit: 'kN',
    source: 'EN 1993-1-1 §6.2.6 Eq. 6.18',
  };

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: { id: `${EUROCODE_3_METADATA.id}-shear`, version: EUROCODE_3_METADATA.revision },
    standard: EUROCODE_STANDARD_REF,
    generatedFrom: {
      kind: 'analysis-result',
      combinationId: input.combinationId,
      memberResultId: input.memberId,
      demandSelector: 'shear-force-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: 'ec3-shear-6-18',
      title: 'Cortante: Resistencia plástica del alma',
      clause: 'EN 1993-1-1 §6.2.6',
      equation: 'VEd ≤ Vpl,Rd = (Av · fy / √3) / γ_M0',
      inequality: 'VEd ≤ Vpl,Rd',
      limitStateKind: 'shear-yielding',
    },
    substitutions: [
      demandVar,
      { symbol: 'Av', label: 'Área de cortante del alma', value: Av, unit: 'm²', source: `d=${d}m, tw=${tw}m` },
      { symbol: 'fy', label: 'Límite elástico nominal', value: input.yieldStrength, unit: 'kN/m²', source: input.materialId },
      resVar,
    ],
    demand: demandVar,
    resistance: resVar,
    ratio: { symbol: 'VEd/Vpl,Rd', value: ratio, unit: '1' },
    componentStatus: demand <= resistance ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: ['Alma no esbelta sin peligro de abolladura por cortante.'],
    limitations: ['No evalúa abolladura según EN 1993-1-5.'],
    missingChecks: ['shear-buckling'],
  });
};

/**
 * EN 1993-1-1 §6.3.3: Interacción Axil y Flexión (Combined Bending and Axial Force)
 * NEd / Nb,Rd + kyy * MEd / Mpl,Rd <= 1.00 (kyy ~ 1.0)
 */
export const evaluateEurocodeCombined = (
  input: EurocodeCheckInput,
  axialResult: DesignResult | null,
  flexureResult: DesignResult | null,
): DesignResult | null => {
  if (!axialResult || !flexureResult) return null;
  const nRatio = axialResult.ratio.value;
  const mRatio = flexureResult.ratio.value;
  const kyy = 1.0; // Factor de interacción simplificado Método 2
  const combinedRatio = nRatio + kyy * mRatio;

  const demandVar: DesignVariable = {
    symbol: 'Interaction',
    label: 'Índice de interacción axil-flexión (EN 1993-1-1)',
    value: combinedRatio,
    unit: '1',
    source: 'EN 1993-1-1 §6.3.3 Eq. 6.61',
  };
  const resVar: DesignVariable = {
    symbol: 'Limit',
    label: 'Límite unitario reglamentario',
    value: 1.0,
    unit: '1',
    source: 'EN 1993-1-1 §6.3.3',
  };

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: { id: `${EUROCODE_3_METADATA.id}-combined`, version: EUROCODE_3_METADATA.revision },
    standard: EUROCODE_STANDARD_REF,
    generatedFrom: {
      kind: 'analysis-result',
      combinationId: input.combinationId,
      memberResultId: input.memberId,
      demandSelector: 'combined-axial-flexure-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: 'ec3-combined-6-61',
      title: 'Interacción: Flexocompresión con pandeo',
      clause: 'EN 1993-1-1 §6.3.3',
      equation: 'NEd / Nb,Rd + kyy · MEd / Mpl,Rd ≤ 1.00',
      inequality: 'Interaction ≤ 1.00',
      limitStateKind: 'combined-interaction',
    },
    substitutions: [
      { symbol: 'NEd/Nb,Rd', label: 'Ratio axil', value: nRatio, unit: '1', source: axialResult.check.title },
      { symbol: 'MEd/Mpl,Rd', label: 'Ratio flexión', value: mRatio, unit: '1', source: flexureResult.check.title },
      demandVar,
    ],
    demand: demandVar,
    resistance: resVar,
    ratio: { symbol: 'Interaction', value: combinedRatio, unit: '1' },
    componentStatus: combinedRatio <= 1.0 ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: ['Factor de interacción kyy adoptado conservadoramente como 1.00.'],
    limitations: ['No evalúa flexión esviada biaxial ni torsión.'],
    missingChecks: ['biaxial-interaction'],
  });
};

/**
 * Evalúa todas las comprobaciones Eurocódigo aplicables a un miembro.
 */
export const evaluateEurocodeMember = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combinationId: string,
  memberId: string,
): readonly DesignResult[] => {
  const member = project.members.find((m) => m.id === memberId);
  const memberRes = analysis.memberResults.find((r) => r.memberId === memberId);
  if (!member || !memberRes) return [];

  const mat = member.materialId ? findStandardMaterial(member.materialId) : undefined;
  const sec = member.sectionId ? findStandardSection(member.sectionId) : undefined;

  const yieldStrength = mat?.yieldStrength ?? 275000;
  const elasticModulus = member.E > 0 ? member.E : (mat?.elasticModulus ?? 210000000);
  const grossArea = member.A > 0 ? member.A : (sec?.area ?? 0.003);
  const inertiaX = member.I > 0 ? member.I : (sec?.inertiaX ?? 0.00003);
  const sectionModulusX = sec?.sectionModulusX ?? (inertiaX / 0.10);
  const plasticModulusX = sec?.plasticModulusX ?? (sectionModulusX * 1.15);
  const radiusGyrationX = sec?.radiusOfGyrationX ?? Math.sqrt(inertiaX / grossArea);

  const maxAxial = memberRes.maxAxial;
  const minAxial = memberRes.minAxial;
  const maxShear = Math.max(Math.abs(memberRes.maxShear), Math.abs(memberRes.minShear));
  const maxMoment = Math.max(Math.abs(memberRes.maxMoment), Math.abs(memberRes.minMoment));

  const input: EurocodeCheckInput = {
    memberId,
    materialId: member.materialId ?? 'custom-material',
    sectionId: member.sectionId ?? 'custom-section',
    combinationId,
    length: memberRes.length,
    axialDemand: maxAxial > 0 ? maxAxial : minAxial,
    momentDemand: maxMoment,
    shearDemand: maxShear,
    yieldStrength,
    elasticModulus,
    grossArea,
    inertiaX,
    sectionModulusX,
    plasticModulusX,
    radiusOfGyrationX: radiusGyrationX,
    depth: sec?.depth,
    webThickness: sec?.webThickness,
  };

  const results: DesignResult[] = [];

  const tensionRes = maxAxial > 0 ? evaluateEurocodeTension({ ...input, axialDemand: maxAxial }) : null;
  if (tensionRes) results.push(tensionRes);

  const compRes = minAxial < 0 ? evaluateEurocodeCompression({ ...input, axialDemand: minAxial }) : null;
  if (compRes) results.push(compRes);

  const flexRes = maxMoment > 0 ? evaluateEurocodeFlexure(input) : null;
  if (flexRes) results.push(flexRes);

  const shearRes = maxShear > 0 ? evaluateEurocodeShear(input) : null;
  if (shearRes) results.push(shearRes);

  const axialGoverning = compRes ?? tensionRes;
  if (axialGoverning && flexRes) {
    const combinedRes = evaluateEurocodeCombined(input, axialGoverning, flexRes);
    if (combinedRes) results.push(combinedRes);
  }

  return results;
};
