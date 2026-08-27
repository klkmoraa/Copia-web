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

export const AISC_360_16_METADATA = deepFreeze({
  schemaVersion: 1,
  id: 'aisc-360-16',
  revision: '2026-08-27.1',
  title: 'AISC 360-16 · Specification for Structural Steel Buildings',
  jurisdiction: 'United States / International',
  edition: '2016',
  publicationDate: '2016-07-07',
  reviewedAt: '2026-08-27',
  units: 'kN-m',
  source: {
    title: 'ANSI/AISC 360-16 Specification for Structural Steel Buildings',
    url: 'https://www.aisc.org/publications/steel-standards/',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    pdfPage: 1,
    printedPage: 1,
  },
} as const);

const AISC_STANDARD_REF = deepFreeze({
  title: AISC_360_16_METADATA.title,
  jurisdiction: AISC_360_16_METADATA.jurisdiction,
  edition: AISC_360_16_METADATA.edition,
  publicationDate: AISC_360_16_METADATA.publicationDate,
  reviewedAt: AISC_360_16_METADATA.reviewedAt,
  sourceUrl: AISC_360_16_METADATA.source.url,
  sourceSha256: AISC_360_16_METADATA.source.sha256,
  pdfPage: AISC_360_16_METADATA.source.pdfPage,
  printedPage: AISC_360_16_METADATA.source.printedPage,
} as const);

export type AiscMethod = 'LRFD' | 'ASD';

export interface AiscCheckInput {
  memberId: string;
  materialId: string;
  sectionId: string;
  combinationId: string;
  method: AiscMethod;
  length: number; // m
  effectiveLengthFactorK?: number;
  axialDemand: number; // kN (+ tension, - compression)
  momentDemand: number; // kN-m
  shearDemand: number; // kN
  yieldStrength: number; // kN/m² (Fy)
  elasticModulus: number; // kN/m² (E)
  grossArea: number; // m² (Ag)
  inertiaX: number; // m⁴ (Ix)
  sectionModulusX: number; // m³ (Sx)
  plasticModulusX: number; // m³ (Zx)
  radiusOfGyrationX: number; // m (rx)
  depth?: number; // m (d)
  webThickness?: number; // m (tw)
}

/**
 * Capítulo D: Diseño de miembros en tracción (Tension - Gross Section Yielding)
 * Pn = Fy * Ag
 * LRFD: phi_t = 0.90, Pu <= phi_t * Pn
 * ASD: Omega_t = 1.67, Pa <= Pn / Omega_t
 */
export const evaluateAiscTension = (input: AiscCheckInput): DesignResult | null => {
  if (input.axialDemand <= 0) return null; // Not in tension
  const phi = 0.90;
  const omega = 1.67;
  const Pn = input.yieldStrength * input.grossArea;
  const resistance = input.method === 'LRFD' ? phi * Pn : Pn / omega;
  const demand = input.axialDemand;
  const ratio = demand / Math.max(1e-9, resistance);

  const demandVar: DesignVariable = {
    symbol: input.method === 'LRFD' ? 'Pu' : 'Pa',
    label: `Demanda axial de tracción (${input.method})`,
    value: demand,
    unit: 'kN',
    source: 'AnalysisResult.memberResults · Max Axial Tension',
  };
  const resVar: DesignVariable = {
    symbol: input.method === 'LRFD' ? 'φPn' : 'Pn/Ω',
    label: `Resistencia de diseño en tracción (${input.method})`,
    value: resistance,
    unit: 'kN',
    source: 'AISC 360-16 Eq. D2-1',
  };

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: { id: `${AISC_360_16_METADATA.id}-tension`, version: AISC_360_16_METADATA.revision },
    standard: AISC_STANDARD_REF,
    generatedFrom: {
      kind: 'analysis-result',
      combinationId: input.combinationId,
      memberResultId: input.memberId,
      demandSelector: 'axial-tension-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: 'aisc-tension-d2-1',
      title: `Tensión: Fluencia de la sección total (${input.method})`,
      clause: 'Chapter D §D2(a)',
      equation: input.method === 'LRFD' ? 'Pu ≤ φ_t · Fy · Ag (φ_t = 0.90)' : 'Pa ≤ (Fy · Ag) / Ω_t (Ω_t = 1.67)',
      inequality: `${demandVar.symbol} ≤ ${resVar.symbol}`,
      limitStateKind: 'tension-yielding',
    },
    substitutions: [
      demandVar,
      { symbol: input.method === 'LRFD' ? 'φ_t' : 'Ω_t', label: 'Factor de resistencia/seguridad', value: input.method === 'LRFD' ? phi : omega, unit: '1', source: 'AISC 360-16 §D2' },
      { symbol: 'Fy', label: 'Límite de fluencia', value: input.yieldStrength, unit: 'kN/m²', source: input.materialId },
      { symbol: 'Ag', label: 'Área bruta', value: input.grossArea, unit: 'm²', source: input.sectionId },
      resVar,
    ],
    demand: demandVar,
    resistance: resVar,
    ratio: { symbol: `${demandVar.symbol}/${resVar.symbol}`, value: ratio, unit: '1' },
    componentStatus: demand <= resistance ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: ['Miembro prismático con carga axial concéntrica.'],
    limitations: ['No evalúa fractura de sección neta ni conexiones empernadas.'],
    missingChecks: ['net-section-fracture', 'block-shear'],
  });
};

/**
 * Capítulo E: Diseño de miembros en compresión (Compression - Flexural Buckling)
 * Fe = pi^2 * E / (KL/r)^2
 * Fcr = [0.658^(Fy/Fe)] * Fy  (si KL/r <= 4.71 * sqrt(E/Fy) o Fy/Fe <= 2.25)
 * Fcr = 0.877 * Fe            (si KL/r > 4.71 * sqrt(E/Fy) o Fy/Fe > 2.25)
 * Pn = Fcr * Ag
 * LRFD: phi_c = 0.90, Pu <= phi_c * Pn
 * ASD: Omega_c = 1.67, Pa <= Pn / Omega_c
 */
export const evaluateAiscCompression = (input: AiscCheckInput): DesignResult | null => {
  const compressionDemand = Math.abs(Math.min(0, input.axialDemand));
  if (compressionDemand <= 0) return null; // No compression

  const K = input.effectiveLengthFactorK ?? 1.0;
  const r = input.radiusOfGyrationX > 0 ? input.radiusOfGyrationX : Math.sqrt(input.inertiaX / Math.max(1e-9, input.grossArea));
  const slenderness = (K * input.length) / Math.max(1e-6, r);
  const Fe = (Math.PI * Math.PI * input.elasticModulus) / (slenderness * slenderness);
  const inelasticLimit = 4.71 * Math.sqrt(input.elasticModulus / input.yieldStrength);

  let Fcr: number;
  let equationClause: string;
  if (slenderness <= inelasticLimit) {
    Fcr = Math.pow(0.658, input.yieldStrength / Fe) * input.yieldStrength;
    equationClause = 'AISC 360-16 Eq. E3-2 (Pandeo inelástico)';
  } else {
    Fcr = 0.877 * Fe;
    equationClause = 'AISC 360-16 Eq. E3-3 (Pandeo elástico de Euler)';
  }

  const Pn = Fcr * input.grossArea;
  const phi = 0.90;
  const omega = 1.67;
  const resistance = input.method === 'LRFD' ? phi * Pn : Pn / omega;
  const demand = compressionDemand;
  const ratio = demand / Math.max(1e-9, resistance);

  const demandVar: DesignVariable = {
    symbol: input.method === 'LRFD' ? 'Pu' : 'Pa',
    label: `Demanda axial de compresión (${input.method})`,
    value: demand,
    unit: 'kN',
    source: 'AnalysisResult.memberResults · Min Axial Compression',
  };
  const resVar: DesignVariable = {
    symbol: input.method === 'LRFD' ? 'φPn' : 'Pn/Ω',
    label: `Resistencia a compresión por pandeo flexionante (${input.method})`,
    value: resistance,
    unit: 'kN',
    source: equationClause,
  };

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: { id: `${AISC_360_16_METADATA.id}-compression`, version: AISC_360_16_METADATA.revision },
    standard: AISC_STANDARD_REF,
    generatedFrom: {
      kind: 'analysis-result',
      combinationId: input.combinationId,
      memberResultId: input.memberId,
      demandSelector: 'axial-compression-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: 'aisc-compression-e3',
      title: `Compresión: Pandeo flexionante por columna (${input.method})`,
      clause: 'Chapter E §E3',
      equation: input.method === 'LRFD' ? 'Pu ≤ φ_c · Fcr · Ag (φ_c = 0.90)' : 'Pa ≤ (Fcr · Ag) / Ω_c (Ω_c = 1.67)',
      inequality: `${demandVar.symbol} ≤ ${resVar.symbol}`,
      limitStateKind: 'compression-buckling',
    },
    substitutions: [
      demandVar,
      { symbol: 'KL/r', label: 'Relación de esbeltez de la columna', value: slenderness, unit: '1', source: `K=${K}, L=${input.length}m, r=${r.toFixed(4)}m` },
      { symbol: 'Fe', label: 'Tensión crítica elástica de Euler', value: Fe, unit: 'kN/m²', source: 'AISC 360-16 Eq. E3-4' },
      { symbol: 'Fcr', label: 'Tensión crítica de pandeo', value: Fcr, unit: 'kN/m²', source: equationClause },
      { symbol: 'Ag', label: 'Área bruta', value: input.grossArea, unit: 'm²', source: input.sectionId },
      resVar,
    ],
    demand: demandVar,
    resistance: resVar,
    ratio: { symbol: `${demandVar.symbol}/${resVar.symbol}`, value: ratio, unit: '1' },
    componentStatus: demand <= resistance ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: ['Columna homogénea prismática con apoyos en extremos según factor K.'],
    limitations: ['No evalúa pandeo local en almas/alas esbeltas (Capítulo E7) ni pandeo torsional.'],
    missingChecks: ['slender-element-buckling', 'torsional-buckling'],
  });
};

/**
 * Capítulo F: Diseño de miembros en flexión (Flexure - Yielding & Plastic Modulus)
 * Mp = Fy * Zx
 * Mn = Mp (para sección compacta)
 * LRFD: phi_b = 0.90, Mu <= phi_b * Mn
 * ASD: Omega_b = 1.67, Ma <= Mn / Omega_b
 */
export const evaluateAiscFlexure = (input: AiscCheckInput): DesignResult | null => {
  const momentDemand = Math.abs(input.momentDemand);
  if (momentDemand <= 0) return null;

  const Zx = input.plasticModulusX > 0 ? input.plasticModulusX : input.sectionModulusX * 1.12;
  const Mp = input.yieldStrength * Zx;
  const Mn = Mp;
  const phi = 0.90;
  const omega = 1.67;
  const resistance = input.method === 'LRFD' ? phi * Mn : Mn / omega;
  const demand = momentDemand;
  const ratio = demand / Math.max(1e-9, resistance);

  const demandVar: DesignVariable = {
    symbol: input.method === 'LRFD' ? 'Mu' : 'Ma',
    label: `Demanda de momento flector (${input.method})`,
    value: demand,
    unit: 'kN-m',
    source: 'AnalysisResult.memberResults · Max Bending Moment',
  };
  const resVar: DesignVariable = {
    symbol: input.method === 'LRFD' ? 'φMn' : 'Mn/Ω',
    label: `Momento resistente plástico (${input.method})`,
    value: resistance,
    unit: 'kN-m',
    source: 'AISC 360-16 Eq. F2-1 (Mp = Fy·Zx)',
  };

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: { id: `${AISC_360_16_METADATA.id}-flexure`, version: AISC_360_16_METADATA.revision },
    standard: AISC_STANDARD_REF,
    generatedFrom: {
      kind: 'analysis-result',
      combinationId: input.combinationId,
      memberResultId: input.memberId,
      demandSelector: 'bending-moment-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: 'aisc-flexure-f2',
      title: `Flexión: Plastificación / Fluencia de sección (${input.method})`,
      clause: 'Chapter F §F2.1',
      equation: input.method === 'LRFD' ? 'Mu ≤ φ_b · Fy · Zx (φ_b = 0.90)' : 'Ma ≤ (Fy · Zx) / Ω_b (Ω_b = 1.67)',
      inequality: `${demandVar.symbol} ≤ ${resVar.symbol}`,
      limitStateKind: 'flexure-yielding',
    },
    substitutions: [
      demandVar,
      { symbol: input.method === 'LRFD' ? 'φ_b' : 'Ω_b', label: 'Factor de resistencia en flexión', value: input.method === 'LRFD' ? phi : omega, unit: '1', source: 'AISC 360-16 §F1' },
      { symbol: 'Fy', label: 'Límite de fluencia', value: input.yieldStrength, unit: 'kN/m²', source: input.materialId },
      { symbol: 'Zx', label: 'Módulo de sección plástico', value: Zx, unit: 'm³', source: input.sectionId },
      resVar,
    ],
    demand: demandVar,
    resistance: resVar,
    ratio: { symbol: `${demandVar.symbol}/${resVar.symbol}`, value: ratio, unit: '1' },
    componentStatus: demand <= resistance ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: ['Viga continuamente arriostrada lateralmente (Lb <= Lp).'],
    limitations: ['No evalúa pandeo lateral-torsional (LTB) sin soporte lateral continuo.'],
    missingChecks: ['lateral-torsional-buckling', 'flange-local-buckling'],
  });
};

/**
 * Capítulo G: Diseño en cortante (Shear)
 * Vn = 0.6 * Fy * Aw * Cv
 * Aw = d * tw
 * LRFD: phi_v = 0.90, Vu <= phi_v * Vn
 * ASD: Omega_v = 1.67, Va <= Vn / Omega_v
 */
export const evaluateAiscShear = (input: AiscCheckInput): DesignResult | null => {
  const shearDemand = Math.abs(input.shearDemand);
  if (shearDemand <= 0) return null;

  const d = input.depth ?? 0.20;
  const tw = input.webThickness ?? 0.006;
  const Aw = Math.max(1e-6, d * tw);
  const Cv = 1.0; // Coeficiente de cortante de alma no esbelta
  const Vn = 0.6 * input.yieldStrength * Aw * Cv;
  const phi = 0.90;
  const omega = 1.67;
  const resistance = input.method === 'LRFD' ? phi * Vn : Vn / omega;
  const demand = shearDemand;
  const ratio = demand / Math.max(1e-9, resistance);

  const demandVar: DesignVariable = {
    symbol: input.method === 'LRFD' ? 'Vu' : 'Va',
    label: `Demanda de fuerza cortante (${input.method})`,
    value: demand,
    unit: 'kN',
    source: 'AnalysisResult.memberResults · Max Shear Force',
  };
  const resVar: DesignVariable = {
    symbol: input.method === 'LRFD' ? 'φVn' : 'Vn/Ω',
    label: `Resistencia nominal al cortante (${input.method})`,
    value: resistance,
    unit: 'kN',
    source: 'AISC 360-16 Eq. G2-1',
  };

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: { id: `${AISC_360_16_METADATA.id}-shear`, version: AISC_360_16_METADATA.revision },
    standard: AISC_STANDARD_REF,
    generatedFrom: {
      kind: 'analysis-result',
      combinationId: input.combinationId,
      memberResultId: input.memberId,
      demandSelector: 'shear-force-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: 'aisc-shear-g2',
      title: `Cortante: Fluencia del alma (${input.method})`,
      clause: 'Chapter G §G2.1',
      equation: input.method === 'LRFD' ? 'Vu ≤ φ_v · 0.6 · Fy · Aw · Cv' : 'Va ≤ (0.6 · Fy · Aw · Cv) / Ω_v',
      inequality: `${demandVar.symbol} ≤ ${resVar.symbol}`,
      limitStateKind: 'shear-yielding',
    },
    substitutions: [
      demandVar,
      { symbol: 'Aw', label: 'Área del alma', value: Aw, unit: 'm²', source: `d=${d}m, tw=${tw}m` },
      { symbol: 'Fy', label: 'Límite de fluencia', value: input.yieldStrength, unit: 'kN/m²', source: input.materialId },
      resVar,
    ],
    demand: demandVar,
    resistance: resVar,
    ratio: { symbol: `${demandVar.symbol}/${resVar.symbol}`, value: ratio, unit: '1' },
    componentStatus: demand <= resistance ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: ['Alma no esbelta sin atiesadores transversales.'],
    limitations: ['No evalúa acción de campo de tensiones (tension field action).'],
    missingChecks: ['web-post-buckling'],
  });
};

/**
 * Capítulo H: Interacción Flexocompresión / Flexotensión (Combined Forces)
 * Eq. H1-1a para Pr / Pc >= 0.2:  Pr/Pc + 8/9 * (Mr/Mc) <= 1.0
 * Eq. H1-1b para Pr / Pc < 0.2:   Pr/(2*Pc) + (Mr/Mc) <= 1.0
 */
export const evaluateAiscCombined = (
  input: AiscCheckInput,
  axialResult: DesignResult | null,
  flexureResult: DesignResult | null,
): DesignResult | null => {
  if (!axialResult || !flexureResult) return null;
  const axialRatio = axialResult.ratio.value;
  const flexRatio = flexureResult.ratio.value;

  let combinedRatio: number;
  let eqName: string;
  let formula: string;

  if (axialRatio >= 0.2) {
    combinedRatio = axialRatio + (8 / 9) * flexRatio;
    eqName = 'AISC 360-16 Eq. H1-1a';
    formula = 'Pr/Pc + 8/9 · (Mr/Mc) ≤ 1.0';
  } else {
    combinedRatio = axialRatio / 2 + flexRatio;
    eqName = 'AISC 360-16 Eq. H1-1b';
    formula = 'Pr/(2·Pc) + Mr/Mc ≤ 1.0';
  }

  const demandVar: DesignVariable = {
    symbol: 'Interaction Demand',
    label: `Índice de interacción (${input.method})`,
    value: combinedRatio,
    unit: '1',
    source: `${eqName} · Combinación de axial y flexión`,
  };
  const resVar: DesignVariable = {
    symbol: 'Limit',
    label: 'Límite reglamentario unitario',
    value: 1.0,
    unit: '1',
    source: 'AISC 360-16 Chapter H',
  };

  return deepFreeze({
    schemaVersion: 1,
    kind: 'design-result',
    module: { id: `${AISC_360_16_METADATA.id}-combined`, version: AISC_360_16_METADATA.revision },
    standard: AISC_STANDARD_REF,
    generatedFrom: {
      kind: 'analysis-result',
      combinationId: input.combinationId,
      memberResultId: input.memberId,
      demandSelector: 'combined-axial-flexure-envelope',
    },
    subject: { memberId: input.memberId, materialId: input.materialId, sectionId: input.sectionId },
    check: {
      id: 'aisc-combined-h1',
      title: `Interacción Flexocompresión (${input.method})`,
      clause: 'Chapter H §H1.1',
      equation: formula,
      inequality: 'Interaction ≤ 1.00',
      limitStateKind: 'combined-interaction',
    },
    substitutions: [
      { symbol: 'Pr/Pc', label: 'Ratio axial gobernante', value: axialRatio, unit: '1', source: axialResult.check.title },
      { symbol: 'Mr/Mc', label: 'Ratio de flexión', value: flexRatio, unit: '1', source: flexureResult.check.title },
      demandVar,
    ],
    demand: demandVar,
    resistance: resVar,
    ratio: { symbol: 'Interaction Ratio', value: combinedRatio, unit: '1' },
    componentStatus: combinedRatio <= 1.0 ? 'within-component' : 'outside-component',
    status: 'incomplete',
    assumptions: ['Efectos de segundo orden (P-delta) incluidos en el análisis estático.'],
    limitations: ['No evalúa torsión combinada ni alabeo.'],
    missingChecks: ['torsion-interaction', 'biaxial-bending'],
  });
};

/**
 * Evalúa todas las comprobaciones AISC aplicables a un miembro.
 */
export const evaluateAiscMember = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combinationId: string,
  memberId: string,
  method: AiscMethod = 'LRFD',
): readonly DesignResult[] => {
  const member = project.members.find((m) => m.id === memberId);
  const memberRes = analysis.memberResults.find((r) => r.memberId === memberId);
  if (!member || !memberRes) return [];

  const mat = member.materialId ? findStandardMaterial(member.materialId) : undefined;
  const sec = member.sectionId ? findStandardSection(member.sectionId) : undefined;

  const yieldStrength = mat?.yieldStrength ?? 250000;
  const elasticModulus = member.E > 0 ? member.E : (mat?.elasticModulus ?? 200000000);
  const grossArea = member.A > 0 ? member.A : (sec?.area ?? 0.005);
  const inertiaX = member.I > 0 ? member.I : (sec?.inertiaX ?? 0.00005);
  const sectionModulusX = sec?.sectionModulusX ?? (inertiaX / 0.10);
  const plasticModulusX = sec?.plasticModulusX ?? (sectionModulusX * 1.15);
  const radiusGyrationX = sec?.radiusOfGyrationX ?? Math.sqrt(inertiaX / grossArea);

  const maxAxial = memberRes.maxAxial;
  const minAxial = memberRes.minAxial;
  const maxShear = Math.max(Math.abs(memberRes.maxShear), Math.abs(memberRes.minShear));
  const maxMoment = Math.max(Math.abs(memberRes.maxMoment), Math.abs(memberRes.minMoment));

  const input: AiscCheckInput = {
    memberId,
    materialId: member.materialId ?? 'custom-material',
    sectionId: member.sectionId ?? 'custom-section',
    combinationId,
    method,
    length: memberRes.length,
    effectiveLengthFactorK: 1.0,
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

  const tensionRes = maxAxial > 0 ? evaluateAiscTension({ ...input, axialDemand: maxAxial }) : null;
  if (tensionRes) results.push(tensionRes);

  const compRes = minAxial < 0 ? evaluateAiscCompression({ ...input, axialDemand: minAxial }) : null;
  if (compRes) results.push(compRes);

  const flexRes = maxMoment > 0 ? evaluateAiscFlexure(input) : null;
  if (flexRes) results.push(flexRes);

  const shearRes = maxShear > 0 ? evaluateAiscShear(input) : null;
  if (shearRes) results.push(shearRes);

  const axialGoverning = compRes ?? tensionRes;
  if (axialGoverning && flexRes) {
    const combinedRes = evaluateAiscCombined(input, axialGoverning, flexRes);
    if (combinedRes) results.push(combinedRes);
  }

  return results;
};
