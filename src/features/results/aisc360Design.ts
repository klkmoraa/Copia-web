/**
 * Verificación por norma real: AISC 360-16, método LRFD — CRI-45.
 *
 * `elasticDemand.ts` publica η, una estimación elástica orientativa que el
 * propio contrato del proyecto declara que **no es** una verificación
 * normativa: sin φ, sin pandeo, sin interacción P-M de código
 * (`docs/architecture/structureco-elastic-index.md`, «Qué falta»). Este módulo
 * es esa pieza que faltaba, y vive separado de η a propósito: comparten el
 * mismo esfuerzo de entrada (N, M, V de la envolvente) pero no comparten
 * fórmula, ni φ, ni significado. Ninguno de los dos altera el Analysis Engine:
 * ambos son lectura pura sobre resultados ya resueltos.
 *
 * ## Alcance de esta fase, dicho sin adornos
 *
 * - **Sólo perfiles I doblemente simétricos de catálogo** (`shapeType === 'I'`,
 *   AISC o Eurocódigo — la sección es la misma forma física en ambos catálogos
 *   y las ecuaciones de AISC 360 no distinguen de qué catálogo salió un ala y
 *   un alma). Cualquier otra forma, o una sección sin identidad de catálogo,
 *   es `section-not-supported`.
 * - **Sólo material de catálogo** (`materialOrigin === 'catalog'`). Fy y E
 *   salen los dos de ahí, nunca de `member.E`: una vez establecida la
 *   identidad, mezclar el E declarado del miembro con el Fy del catálogo
 *   publicaría un número que no se puede rastrear a una sola fuente.
 * - **Flexión mayor únicamente.** El motor de análisis es plano: no hay
 *   momento fuera del plano que verificar, así que H1 aquí nunca tiene término
 *   Mry.
 * - **Compresión (E3): las dos direcciones**, con K y longitud no arriostrada
 *   por eje — el plano del pórtico usa la propia longitud del miembro (un
 *   arriostramiento intermedio real exigiría un nudo ahí); fuera de plano exige
 *   que el usuario declare `designUnbracedLengthMinor`, porque el modelo 2D no
 *   sabe nada de lo que pasa fuera de su plano.
 * - **Tracción (D2): sólo fluencia**, `φPn = 0,90·Fy·Ag`. La rotura en sección
 *   neta (D2-b) exige Fu y área neta —agujeros de pernos— que este modelo no
 *   tiene: se declara `tensionRuptureNotEvaluated`, nunca se fabrica un Fu.
 * - **Flexión (F2): sólo la meseta plástica**, `Mn = Mp = Fy·Zx`, y sólo si el
 *   perfil es compacto (B4) y `Lb ≤ Lp`. Más allá de Lp, F2 exige `Lr` y éste
 *   exige la constante torsional J y el radio efectivo `rts` —que dependen de
 *   Cw/J, ausentes del catálogo—: se declara `ltb-inelastic`, nunca un Mn
 *   fabricado con un J supuesto.
 * - **Cortante (G2.1): sólo alma compacta** (`h/tw ≤ 2,24·√(E/Fy)`, Cv1 = 1,
 *   φv = 1). Con alma esbelta hace falta `kv` con o sin rigidizadores, que este
 *   módulo no modela: se declara `shear-slender-web`.
 * - **h del alma se aproxima como `d − 2·tf`.** El catálogo no tabula el radio
 *   de acuerdo `k` de cada perfil, así que no hay una distancia libre exacta
 *   que leer. Es una aproximación estándar cuando falta `k`, ligeramente del
 *   lado seguro, y se declara aquí en vez de fingir una `h` exacta.
 * - **La envolvente es la del análisis activo**, no la de todas las
 *   combinaciones LRFD a la vez: mismo alcance que η, mismo motivo — no hay
 *   una superficie que agregue resultados de más de un análisis a la vez.
 *   Verificar todas las combinaciones exige correrlas todas y quedarse con el
 *   peor de cada miembro; queda fuera de esta fase.
 *
 * Un dato o una condición ausente produce un `gap` con su nombre exacto y
 * **nunca** un ratio fabricado. La regla es la misma que en η, palabra por
 * palabra.
 */
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection, type StandardSection } from '../../data/standardSections';
import type { AnalysisResult, MemberModel, MemberResult, ProjectModel } from '../../types';
import { elasticDemandGate, type ElasticDemandConfidence } from './elasticDemand';
import type { ReliabilityCheck } from '../../engine/reliability';

/** LRFD: mismo φ para tracción, compresión y flexión de perfiles I. */
const PHI = 0.9;

/** Lo que impide verificar un sub-estado límite concreto, con su causa exacta. */
export type Aisc360Gap =
  | 'section-not-supported'
  | 'material-catalog'
  | 'non-compact-section'
  | 'ltb-inelastic'
  | 'shear-slender-web';

export interface Aisc360MaterialSource {
  id: string;
  name: string;
  /** kN/m² */
  yieldStrength: number;
  /** kN/m² */
  elasticModulus: number;
}

export interface Aisc360SectionSource {
  id: string;
  name: string;
}

export interface Aisc360AxialCheck {
  status: 'available';
  mode: 'tension' | 'compression';
  /** kN */
  demand: number;
  /** kN, φPn */
  capacity: number;
  ratio: number;
  governingAxis?: 'major' | 'minor';
  slendernessMajor?: number;
  slendernessMinor?: number;
  /** `true` en modo tracción: sólo se comprobó fluencia (D2-a), nunca rotura. */
  tensionRuptureNotEvaluated?: boolean;
}
export interface Aisc360AxialGap { status: 'unavailable'; gap: Aisc360Gap }
export type Aisc360AxialResult = Aisc360AxialCheck | Aisc360AxialGap;

export interface Aisc360FlexureCheck {
  status: 'available';
  /** kN·m */
  demand: number;
  /** kN·m, φMn */
  capacity: number;
  ratio: number;
  mp: number;
  lp: number;
  lb: number;
}
export interface Aisc360FlexureNotApplicable { status: 'not-applicable' }
export interface Aisc360FlexureGap { status: 'unavailable'; gap: Aisc360Gap }
export type Aisc360FlexureResult = Aisc360FlexureCheck | Aisc360FlexureNotApplicable | Aisc360FlexureGap;

export interface Aisc360ShearCheck {
  status: 'available';
  /** kN */
  demand: number;
  /** kN, φVn */
  capacity: number;
  ratio: number;
}
export interface Aisc360ShearNotApplicable { status: 'not-applicable' }
export interface Aisc360ShearGap { status: 'unavailable'; gap: Aisc360Gap }
export type Aisc360ShearResult = Aisc360ShearCheck | Aisc360ShearNotApplicable | Aisc360ShearGap;

export interface Aisc360Interaction { status: 'available'; ratio: number; formula: 'H1-1a' | 'H1-1b' }
export interface Aisc360InteractionUnavailable { status: 'unavailable' }
export type Aisc360InteractionResult = Aisc360Interaction | Aisc360InteractionUnavailable;

export type Aisc360GoverningCheck = 'axial' | 'flexure' | 'shear' | 'interaction';

export interface MemberAisc360Reading {
  status: 'available';
  memberId: string;
  material: Aisc360MaterialSource;
  /** `null` cuando el axil se resolvió en modo tracción sin sección de catálogo (D2-a sólo pide A y Fy). */
  section: Aisc360SectionSource | null;
  axial: Aisc360AxialResult;
  flexure: Aisc360FlexureResult;
  shear: Aisc360ShearResult;
  interaction: Aisc360InteractionResult;
  /** El mayor ratio entre las lecturas disponibles: nunca infravalora la demanda. */
  governingRatio: number;
  governingCheck: Aisc360GoverningCheck;
  /** Causas declaradas de los sub-estados que no se pudieron verificar. */
  gaps: Aisc360Gap[];
}

export interface MemberAisc360Unavailable {
  status: 'unavailable';
  memberId: string;
  gaps: Aisc360Gap[];
}

export type MemberAisc360Result = MemberAisc360Reading | MemberAisc360Unavailable;

/** Sección de catálogo utilizable: perfil I, con geometría positiva. */
const memberSection = (member: MemberModel): StandardSection | null => {
  if (member.sectionOrigin !== 'catalog' || !member.sectionId) return null;
  const section = findStandardSection(member.sectionId);
  if (!section || section.shapeType !== 'I') return null;
  if (!(section.area > 0) || !(section.flangeThickness > 0) || !(section.webThickness > 0)) return null;
  if (!(section.depth > section.flangeThickness * 2)) return null;
  return section;
};

const memberMaterial = (member: MemberModel): Aisc360MaterialSource | null => {
  if (member.materialOrigin !== 'catalog' || !member.materialId) return null;
  const material = findStandardMaterial(member.materialId);
  if (!material || !(material.yieldStrength > 0) || !(material.elasticModulus > 0)) return null;
  return { id: material.id, name: material.name, yieldStrength: material.yieldStrength, elasticModulus: material.elasticModulus };
};

/** Radio de giro del eje débil: derivado, no tabulado — `ry = √(Iy / A)`. */
const weakAxisRadiusOfGyration = (section: StandardSection): number => Math.sqrt(section.inertiaY / section.area);

/** Aproximación estándar de la altura libre del alma cuando el catálogo no tabula `k`. */
const clearWebHeight = (section: StandardSection): number => section.depth - 2 * section.flangeThickness;

/** AISC E3-2 / E3-3: Fcr de pandeo por flexión, a partir de KL/r. */
const flexuralBucklingFcr = (elasticModulus: number, yieldStrength: number, slenderness: number): number => {
  const elasticCriticalStress = (Math.PI ** 2 * elasticModulus) / (slenderness ** 2);
  const ratio = yieldStrength / elasticCriticalStress;
  return ratio <= 2.25 ? 0.658 ** ratio * yieldStrength : 0.877 * elasticCriticalStress;
};

const isCompactIShape = (section: StandardSection, elasticModulus: number, yieldStrength: number): boolean => {
  const flangeSlenderness = section.width / (2 * section.flangeThickness);
  const flangeLimit = 0.38 * Math.sqrt(elasticModulus / yieldStrength);
  const webSlenderness = clearWebHeight(section) / section.webThickness;
  const webLimit = 3.76 * Math.sqrt(elasticModulus / yieldStrength);
  return flangeSlenderness <= flangeLimit && webSlenderness <= webLimit;
};

/**
 * Axil: tracción (D2-a, sólo fluencia) o compresión (E3, las dos direcciones),
 * según cuál de las dos demandas de la envolvente es mayor en magnitud.
 *
 * Con demanda nula en las dos direcciones no hay nada que comprobar: se
 * publica en modo tracción con razón 0, sin activar ningún gap.
 */
const computeAxial = (
  member: MemberModel,
  section: StandardSection | null,
  material: Aisc360MaterialSource,
  length: number,
  maxAxial: number,
  minAxial: number,
): Aisc360AxialResult => {
  const tensionDemand = Math.max(0, maxAxial);
  const compressionDemand = Math.max(0, -minAxial);

  if (compressionDemand >= tensionDemand && compressionDemand > 0) {
    if (!section) return { status: 'unavailable', gap: 'section-not-supported' };
    const kMajor = member.designEffectiveLengthFactorMajor ?? 1;
    const kMinor = member.designEffectiveLengthFactorMinor ?? 1;
    const lengthMinor = member.designUnbracedLengthMinor ?? length;
    const slendernessMajor = (kMajor * length) / section.radiusOfGyrationX;
    const slendernessMinor = (kMinor * lengthMinor) / weakAxisRadiusOfGyration(section);
    const fcrMajor = flexuralBucklingFcr(material.elasticModulus, material.yieldStrength, slendernessMajor);
    const fcrMinor = flexuralBucklingFcr(material.elasticModulus, material.yieldStrength, slendernessMinor);
    const governingAxis: 'major' | 'minor' = fcrMajor <= fcrMinor ? 'major' : 'minor';
    const fcr = Math.min(fcrMajor, fcrMinor);
    const capacity = PHI * fcr * section.area;
    return {
      status: 'available',
      mode: 'compression',
      demand: compressionDemand,
      capacity,
      ratio: compressionDemand / capacity,
      governingAxis,
      slendernessMajor,
      slendernessMinor,
    };
  }

  const capacity = PHI * material.yieldStrength * member.A;
  return {
    status: 'available',
    mode: 'tension',
    demand: tensionDemand,
    capacity,
    ratio: tensionDemand > 0 ? tensionDemand / capacity : 0,
    tensionRuptureNotEvaluated: tensionDemand > 0,
  };
};

/** Flexión mayor (F2): meseta plástica únicamente. `not-applicable` en barras de armadura. */
const computeFlexure = (
  member: MemberModel,
  section: StandardSection | null,
  material: Aisc360MaterialSource,
  length: number,
  demand: number,
): Aisc360FlexureResult => {
  if (member.type === 'truss' || demand === 0) return { status: 'not-applicable' };
  if (!section) return { status: 'unavailable', gap: 'section-not-supported' };
  if (!isCompactIShape(section, material.elasticModulus, material.yieldStrength)) {
    return { status: 'unavailable', gap: 'non-compact-section' };
  }
  const lp = 1.76 * weakAxisRadiusOfGyration(section) * Math.sqrt(material.elasticModulus / material.yieldStrength);
  const lb = member.designUnbracedLengthLateralTorsional ?? length;
  if (lb > lp) return { status: 'unavailable', gap: 'ltb-inelastic' };
  const mp = material.yieldStrength * section.plasticModulusX;
  const capacity = PHI * mp;
  return { status: 'available', demand, capacity, ratio: demand / capacity, mp, lp, lb };
};

/** Cortante (G2.1): alma compacta únicamente. `not-applicable` en barras de armadura. */
const computeShear = (
  member: MemberModel,
  section: StandardSection | null,
  material: Aisc360MaterialSource,
  demand: number,
): Aisc360ShearResult => {
  if (member.type === 'truss' || demand === 0) return { status: 'not-applicable' };
  if (!section) return { status: 'unavailable', gap: 'section-not-supported' };
  const webSlenderness = clearWebHeight(section) / section.webThickness;
  const limit = 2.24 * Math.sqrt(material.elasticModulus / material.yieldStrength);
  if (webSlenderness > limit) return { status: 'unavailable', gap: 'shear-slender-web' };
  const webArea = section.depth * section.webThickness;
  const vn = 0.6 * material.yieldStrength * webArea;
  const capacity = 1.0 * vn;
  return { status: 'available', demand, capacity, ratio: demand / capacity };
};

/** H1-1: sólo cuando axil y flexión mayor están los dos disponibles. Sin término Mry: el motor es plano. */
const computeInteraction = (axial: Aisc360AxialResult, flexure: Aisc360FlexureResult): Aisc360InteractionResult => {
  if (axial.status !== 'available' || flexure.status !== 'available') return { status: 'unavailable' };
  const axialRatio = axial.demand > 0 ? axial.demand / axial.capacity : 0;
  const flexureRatio = flexure.demand / flexure.capacity;
  return axialRatio >= 0.2
    ? { status: 'available', ratio: axialRatio + (8 / 9) * flexureRatio, formula: 'H1-1a' }
    : { status: 'available', ratio: axialRatio / 2 + flexureRatio, formula: 'H1-1b' };
};

/**
 * Lectura AISC 360 de una barra, a partir del axil, momento y cortante ya
 * resueltos por el solver. Es la función pura que consumen tanto la vista de
 * barra como la de estructura completa: ninguna repite la mecánica.
 */
export const memberAisc360Check = (
  member: MemberModel,
  result: MemberResult,
): MemberAisc360Result => {
  if (member.type === 'rigid' || !(member.A > 0)) {
    return { status: 'unavailable', memberId: member.id, gaps: ['section-not-supported'] };
  }
  const material = memberMaterial(member);
  if (!material) return { status: 'unavailable', memberId: member.id, gaps: ['material-catalog'] };

  const section = memberSection(member);
  const maxAxial = result.maxAxial ?? 0;
  const minAxial = result.minAxial ?? 0;
  const maxMoment = member.type === 'truss' ? 0 : Math.max(Math.abs(result.maxMoment ?? 0), Math.abs(result.minMoment ?? 0));
  const maxShear = member.type === 'truss' ? 0 : Math.max(Math.abs(result.maxShear ?? 0), Math.abs(result.minShear ?? 0));

  const axial = computeAxial(member, section, material, result.length, maxAxial, minAxial);
  const flexure = computeFlexure(member, section, material, result.length, maxMoment);
  const shear = computeShear(member, section, material, maxShear);
  const interaction = computeInteraction(axial, flexure);

  /* Las causas declaradas de lo que no se pudo verificar, sea cual sea el
     motivo de que falte sección: `not-applicable` (armadura) no cuenta como
     gap, sólo `unavailable` con su causa exacta. */
  const gaps = [...new Set(
    [axial, flexure, shear]
      .filter((check): check is Aisc360AxialGap | Aisc360FlexureGap | Aisc360ShearGap => check.status === 'unavailable')
      .map((check) => check.gap),
  )];

  const candidates: Array<{ ratio: number; check: Aisc360GoverningCheck }> = [];
  if (axial.status === 'available') candidates.push({ ratio: axial.ratio, check: 'axial' });
  if (flexure.status === 'available') candidates.push({ ratio: flexure.ratio, check: 'flexure' });
  if (shear.status === 'available') candidates.push({ ratio: shear.ratio, check: 'shear' });
  if (interaction.status === 'available') candidates.push({ ratio: interaction.ratio, check: 'interaction' });

  /* Sin ningún sub-estado verificable no hay lectura que publicar: sólo las
     causas, nunca un ratio a medias. Esto cubre tanto el caso sin material de
     sección (compresión y flexión bloqueadas) como una barra de armadura sin
     axil ni sección — nada que decir. */
  if (candidates.length === 0) return { status: 'unavailable', memberId: member.id, gaps };

  candidates.sort((first, second) => second.ratio - first.ratio);
  const governing = candidates[0];

  return {
    status: 'available',
    memberId: member.id,
    material,
    /* `null` es la única forma honesta de declarar que el axil se resolvió en
       modo tracción (D2-a: sólo A y Fy) sin que el miembro tuviera una sección
       de catálogo identificable. */
    section: section ? { id: section.id, name: section.name } : null,
    axial,
    flexure,
    shear,
    interaction,
    governingRatio: governing.ratio,
    governingCheck: governing.check,
    gaps,
  };
};

/** Vista de una barra para el Inspector: misma puerta de confiabilidad que η. */
export type MemberAisc360View =
  | { status: 'available'; confidence: ElasticDemandConfidence; governingCheckReliability: ReliabilityCheck | null; reading: MemberAisc360Reading }
  | { status: 'unavailable'; blocker: 'no-analysis' | 'unreliable' | null; governingCheckReliability: ReliabilityCheck | null; gaps: Aisc360Gap[] };

export const memberAisc360View = (
  member: MemberModel,
  result: MemberResult,
  analysis: AnalysisResult | null | undefined,
): MemberAisc360View => {
  const gate = elasticDemandGate(analysis);
  if (gate.blocker) {
    return { status: 'unavailable', blocker: gate.blocker, governingCheckReliability: gate.governingCheck, gaps: [] };
  }
  const reading = memberAisc360Check(member, result);
  return reading.status === 'available'
    ? { status: 'available', confidence: gate.confidence ?? 'reliable', governingCheckReliability: gate.governingCheck, reading }
    : { status: 'unavailable', blocker: null, governingCheckReliability: null, gaps: reading.gaps };
};

export interface Aisc360DemandAvailable {
  status: 'available';
  coverage: 'complete' | 'partial';
  confidence: ElasticDemandConfidence;
  governingCheckReliability: ReliabilityCheck | null;
  /** La mayor razón demanda/capacidad **entre los miembros evaluables**. */
  highest: MemberAisc360Reading;
  readings: MemberAisc360Reading[];
  gaps: MemberAisc360Unavailable[];
  evaluated: number;
  total: number;
  ratios: ReadonlyMap<string, number>;
  unevaluated: ReadonlySet<string>;
}
export interface Aisc360DemandUnavailable {
  status: 'unavailable';
  coverage: 'unavailable';
  blocker: 'no-analysis' | 'unreliable' | 'no-evaluable-member';
  confidence: ElasticDemandConfidence | null;
  governingCheckReliability: ReliabilityCheck | null;
  gaps: MemberAisc360Unavailable[];
  evaluated: 0;
  total: number;
  ratios: ReadonlyMap<string, number>;
  unevaluated: ReadonlySet<string>;
}
export type Aisc360DemandView = Aisc360DemandAvailable | Aisc360DemandUnavailable;

const EMPTY_RATIOS: ReadonlyMap<string, number> = new Map();
const EMPTY_IDS: ReadonlySet<string> = new Set();

/** Vista de toda la estructura: mismo patrón que `elasticDemandView`, ratio en vez de η. */
export const aisc360DemandView = (
  project: ProjectModel,
  analysis: AnalysisResult | null | undefined,
): Aisc360DemandView => {
  const gate = elasticDemandGate(analysis);
  if (gate.blocker) {
    return {
      status: 'unavailable',
      coverage: 'unavailable',
      blocker: gate.blocker,
      confidence: null,
      governingCheckReliability: gate.governingCheck,
      gaps: [],
      evaluated: 0,
      total: 0,
      ratios: EMPTY_RATIOS,
      unevaluated: EMPTY_IDS,
    };
  }

  const members = new Map(project.members.map((member) => [member.id, member]));
  const readings: MemberAisc360Reading[] = [];
  const gaps: MemberAisc360Unavailable[] = [];
  for (const result of analysis!.memberResults) {
    const member = members.get(result.memberId);
    if (!member) continue;
    const reading = memberAisc360Check(member, result);
    if (reading.status === 'available') readings.push(reading);
    else gaps.push(reading);
  }

  const total = readings.length + gaps.length;
  const unevaluated = new Set(gaps.map((gap) => gap.memberId));

  if (readings.length === 0) {
    return {
      status: 'unavailable',
      coverage: 'unavailable',
      blocker: 'no-evaluable-member',
      confidence: gate.confidence,
      governingCheckReliability: gate.governingCheck,
      gaps,
      evaluated: 0,
      total,
      ratios: EMPTY_RATIOS,
      unevaluated,
    };
  }

  readings.sort((first, second) => second.governingRatio - first.governingRatio);
  return {
    status: 'available',
    coverage: gaps.length === 0 ? 'complete' : 'partial',
    confidence: gate.confidence ?? 'reliable',
    governingCheckReliability: gate.governingCheck,
    highest: readings[0],
    readings,
    gaps,
    evaluated: readings.length,
    total,
    ratios: new Map(readings.map((reading) => [reading.memberId, reading.governingRatio])),
    unevaluated,
  };
};
