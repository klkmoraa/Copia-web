/**
 * Índice elástico estimado (η) — capa de presentación sobre la salida del solver.
 *
 * η compara una tensión normal de Navier construida con los extremos ya
 * resueltos por el motor, σ* = |N*|/A + |M*|/W, contra el límite elástico del
 * material declarado, Fy. **No es una verificación normativa**: no hay φ, Ω,
 * pandeo, LTB ni interacción P-M de código. Nada de esto entra al solver ni al
 * modelo, y ninguna de sus constantes vive fuera de este archivo.
 *
 * El contrato tiene una sola regla dura: **η sólo se publica cuando cada dato
 * que lo forma es verificable**. La versión anterior rellenaba los huecos —
 * Fy = 250 MPa cuando el material no se reconocía, W de un rectángulo
 * equivalente h = √(12·I/A) cuando la sección no era de catálogo — y el
 * resultado era un número con apariencia de medida que el usuario no podía
 * auditar. Ahora un dato ausente produce `unavailable` y el nombre exacto de lo
 * que falta; nunca un ratio fabricado.
 *
 * Tres decisiones sostienen la lectura, y las tres se declaran al usuario:
 *
 *  · **W elástico.** Sólo desde `sectionId` con `sectionOrigin === 'catalog'`.
 *    Sin esa identidad explícita no hay `sectionModulusX` auditable.
 *  · **Fy.** Sólo desde `materialId` con `materialOrigin === 'catalog'`.
 *    Coincidir en E con un material del catálogo no es identidad.
 *  · **Combinación.** N* y M* son los máximos absolutos de sus envolventes y
 *    pueden proceder de secciones distintas de la barra: se suman como
 *    **envolvente conservadora**, y así se etiqueta en toda la interfaz.
 *
 * Todas las magnitudes viajan en las unidades base internas (kN, m ⇒ kN/m²), de
 * modo que el sistema de unidades visible no puede alterar η.
 */
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import { resolveReliability, type ReliabilityCheck } from '../../engine/reliability';
import type { AnalysisResult, MemberModel, MemberResult, ProjectModel } from '../../types';

/**
 * η = 1 sólo dice que la estimación alcanza el Fy de referencia del material.
 * No dice «pasa» ni «falla»: eso pertenece a una comprobación por norma, que
 * este módulo no hace (ver CRI-45).
 */
export const ELASTIC_REFERENCE_RATIO = 1;

/**
 * Techo de la rampa del mapa de demanda.
 *
 * El color no puede seguir creciendo indefinidamente, pero aplanar todo η ≥ 1 en
 * un mismo tono borraba la magnitud justo donde más importa: 1,01 y 4,00 se
 * veían idénticos. La rampa sigue subiendo hasta aquí y, a partir de este valor,
 * **se declara saturada** en lugar de fingir que aún distingue.
 */
export const ELASTIC_SATURATION_RATIO = 2;

/** El dato concreto que impide publicar η en una barra. */
export type ElasticIndexGap = 'section-geometry' | 'yield-strength' | 'section-modulus';

/** Lo que impide publicar η en toda la estructura, antes de mirar barra a barra. */
export type ElasticDemandBlocker = 'no-analysis' | 'unreliable' | 'no-evaluable-member';

/**
 * Cuánto del modelo entra realmente en la lectura.
 *
 * `partial` es la distinción que faltaba: con miembros no evaluables, el mayor η
 * entre los evaluables **no gobierna la estructura** —el miembro más exigido
 * puede ser justo uno de los que no se pudo leer— y llamarlo «gobernante»
 * afirmaba algo que la lectura no sabe.
 */
export type ElasticCoverage = 'complete' | 'partial' | 'unavailable';

/**
 * `limited` no es un resultado ordinario: el análisis pasó los controles
 * mínimos pero alguno quedó fuera de su margen cómodo, así que la lectura se
 * publica marcada, con la causa a la vista, y nunca como una medida corriente.
 */
export type ElasticDemandConfidence = 'reliable' | 'limited';

/** Procedencia del Fy publicado: siempre un material del catálogo, por id. */
export interface ElasticYieldSource {
  id: string;
  name: string;
  /** kN/m² */
  yieldStrength: number;
}

/** Procedencia del W publicado: siempre un perfil del catálogo, por id. */
export interface ElasticSectionSource {
  id: string;
  name: string;
  /** m³ */
  sectionModulus: number;
}

export interface MemberElasticIndex {
  status: 'available';
  memberId: string;
  /** kN, máximo absoluto de la envolvente axial. */
  maxAxial: number;
  /** kN·m, máximo absoluto de la envolvente de momento. */
  maxMoment: number;
  /** m² */
  area: number;
  /** kN/m² */
  sigmaAxial: number;
  sigmaBending: number;
  sigmaTotal: number;
  /** η = σ* / Fy */
  ratio: number;
  /** Fracción de σ* aportada por el axil, en [0, 1]. */
  axialShare: number;
  material: ElasticYieldSource;
  /** `null` en demanda puramente axial: sin flexión no hay W que declarar. */
  section: ElasticSectionSource | null;
}

export interface MemberElasticIndexGap {
  status: 'unavailable';
  memberId: string;
  /** En orden estable: geometría, Fy, W. */
  gaps: ElasticIndexGap[];
}

export type MemberElasticIndexReading = MemberElasticIndex | MemberElasticIndexGap;

export interface ElasticDemandAvailable {
  status: 'available';
  coverage: 'complete' | 'partial';
  confidence: ElasticDemandConfidence;
  /** Check que degradó el análisis a `limited`; `null` si es `reliable`. */
  governingCheck: ReliabilityCheck | null;
  /**
   * El mayor η **entre los miembros evaluables**. Con `coverage === 'partial'`
   * no es el gobernante de la estructura y la interfaz debe decir sobre cuántos
   * miembros se midió.
   */
  highest: MemberElasticIndex;
  /** Ordenadas de mayor a menor η. */
  readings: MemberElasticIndex[];
  /** Miembros excluidos de la lectura, con el dato que les falta. */
  gaps: MemberElasticIndexGap[];
  evaluated: number;
  total: number;
  /** id → η, sólo de los miembros publicables. Es lo que tiñe el lienzo. */
  ratios: ReadonlyMap<string, number>;
  /** ids que el lienzo debe dibujar como **no evaluados**, no como normales. */
  unevaluated: ReadonlySet<string>;
}

export interface ElasticDemandUnavailable {
  status: 'unavailable';
  coverage: 'unavailable';
  blocker: ElasticDemandBlocker;
  /**
   * `null` siempre que hay bloqueo por confiabilidad: un análisis no confiable
   * no es una lectura «limitada», es una que no se publica.
   */
  confidence: ElasticDemandConfidence | null;
  /** El check que impide o degrada la lectura, para citarlo como causa. */
  governingCheck: ReliabilityCheck | null;
  gaps: MemberElasticIndexGap[];
  /** Unión sin repetir de los datos que faltan, en orden estable. */
  missing: ElasticIndexGap[];
  evaluated: 0;
  total: number;
  /** Siempre vacío: sin lectura publicable no se tiñe el lienzo. */
  ratios: ReadonlyMap<string, number>;
  unevaluated: ReadonlySet<string>;
}

export type ElasticDemandView = ElasticDemandAvailable | ElasticDemandUnavailable;

/** Vista por miembro, la que consume el Inspector. Misma puerta que el Resumen. */
export type MemberElasticIndexView =
  | {
    status: 'available';
    confidence: ElasticDemandConfidence;
    governingCheck: ReliabilityCheck | null;
    index: MemberElasticIndex;
  }
  | {
    status: 'unavailable';
    blocker: ElasticDemandBlocker | null;
    governingCheck: ReliabilityCheck | null;
    gaps: ElasticIndexGap[];
  };

const EMPTY_RATIOS: ReadonlyMap<string, number> = new Map();
const EMPTY_IDS: ReadonlySet<string> = new Set();

const GAP_ORDER: ElasticIndexGap[] = ['section-geometry', 'yield-strength', 'section-modulus'];

/**
 * Módulo elástico W (m³) con su procedencia, o `null` si la sección no es
 * identificable. No se deduce de A e I: un W inventado publica un η que el
 * usuario no puede rastrear hasta un perfil concreto.
 */
export const memberSectionModulus = (member: MemberModel): ElasticSectionSource | null => {
  if (member.sectionOrigin !== 'catalog' || !member.sectionId) return null;
  const section = findStandardSection(member.sectionId);
  if (!section || !(section.sectionModulusX > 0)) return null;
  return { id: section.id, name: section.name, sectionModulus: section.sectionModulusX };
};

/**
 * Límite elástico de referencia (kN/m²) con su procedencia, o `null` si el
 * material no es identificable. Sin valor de reserva: coincidir en E con un
 * material del catálogo no es identidad.
 */
export const memberYieldStrength = (member: MemberModel): ElasticYieldSource | null => {
  if (member.materialOrigin !== 'catalog' || !member.materialId) return null;
  const material = findStandardMaterial(member.materialId);
  if (!material || !(material.yieldStrength > 0)) return null;
  return { id: material.id, name: material.name, yieldStrength: material.yieldStrength };
};

/**
 * η en una sección concreta a partir de N y M ya resueltos allí.
 *
 * Es la misma regla que la lectura de barra completa; sólo cambian los esfuerzos
 * que entran. Que el corte del lienzo y los paneles compartan esta función es lo
 * que impide que la misma barra se lea distinto según dónde se la mire.
 */
export const sectionElasticIndex = (
  member: MemberModel,
  axial: number,
  moment: number,
): MemberElasticIndexReading => {
  if (member.type === 'rigid' || !(member.A > 0)) {
    return { status: 'unavailable', memberId: member.id, gaps: ['section-geometry'] };
  }

  const maxAxial = Math.abs(axial);
  /* Un elemento de dos fuerzas no tiene rigidez a flexión: su momento es cero
     por formulación, no por casualidad numérica. */
  const maxMoment = member.type === 'truss' ? 0 : Math.abs(moment);
  /* W sólo hace falta si hay flexión que evaluar. Exigirlo siempre dejaba «No
     disponible» una lectura puramente axial que estaba completa —σ* = |N*|/A y
     nada más— y empujaba a asignar una sección cualquiera para poder verla. */
  const needsSectionModulus = maxMoment > 0;

  const gaps: ElasticIndexGap[] = [];
  const material = memberYieldStrength(member);
  if (!material) gaps.push('yield-strength');
  const section = memberSectionModulus(member);
  if (needsSectionModulus && !section) gaps.push('section-modulus');
  if (!material || (needsSectionModulus && !section)) {
    return { status: 'unavailable', memberId: member.id, gaps };
  }

  const sigmaAxial = maxAxial / member.A;
  const sigmaBending = needsSectionModulus && section ? maxMoment / section.sectionModulus : 0;
  const sigmaTotal = sigmaAxial + sigmaBending;
  if (!Number.isFinite(sigmaTotal)) {
    return { status: 'unavailable', memberId: member.id, gaps: ['section-geometry'] };
  }

  return {
    status: 'available',
    memberId: member.id,
    maxAxial,
    maxMoment,
    area: member.A,
    sigmaAxial,
    sigmaBending,
    sigmaTotal,
    ratio: sigmaTotal / material.yieldStrength,
    axialShare: sigmaTotal > 0 ? sigmaAxial / sigmaTotal : 0,
    material,
    /* Sin flexión no se publica un W que no participó en el cálculo, aunque el
       miembro tenga sección de catálogo: la procedencia describe lo que entró. */
    section: needsSectionModulus ? section : null,
  };
};

/**
 * η de la barra completa, con la envolvente conservadora |N|max + |M|max.
 *
 * Los dos extremos pueden ocurrir en secciones distintas; sumarlos es el caso
 * más desfavorable posible y así se etiqueta en la interfaz, nunca como la
 * tensión real de un punto.
 */
export const memberElasticIndex = (
  member: MemberModel,
  result: MemberResult,
): MemberElasticIndexReading => sectionElasticIndex(
  member,
  Math.max(Math.abs(result.maxAxial ?? 0), Math.abs(result.minAxial ?? 0)),
  Math.max(Math.abs(result.maxMoment ?? 0), Math.abs(result.minMoment ?? 0)),
);

/**
 * Puerta de confiabilidad, común a todas las superficies.
 *
 * `success` no basta y nunca bastó: un análisis puede terminar y aun así tener
 * un residuo o un condicionamiento que invalida la lectura. `unreliable` y
 * `failed` bloquean η; `limited` la deja pasar marcada.
 */
export const elasticDemandGate = (
  analysis: AnalysisResult | null | undefined,
): {
  blocker: 'no-analysis' | 'unreliable' | null;
  /** `null` cuando el análisis está bloqueado: no hay lectura que calificar. */
  confidence: ElasticDemandConfidence | null;
  /** El check que gobierna el nivel actual, sea `limited` o `unreliable`. */
  governingCheck: ReliabilityCheck | null;
} => {
  if (!analysis || !analysis.memberResults?.length) {
    return { blocker: 'no-analysis', confidence: null, governingCheck: null };
  }
  const reliability = resolveReliability(analysis);
  if (!reliability.usable || reliability.level === 'unreliable' || reliability.level === 'failed') {
    /* `confidence: null`, no `'limited'`. Un análisis no confiable no es una
       lectura limitada: es una lectura que no se publica, y decir «limitada»
       la presentaba como algo intermedio y utilizable que no es. */
    return { blocker: 'unreliable', confidence: null, governingCheck: reliability.governing ?? null };
  }
  /* «Confiabilidad limitada» a secas es una etiqueta sobre la que el usuario no
     puede actuar: viaja con el check que la gobierna. */
  return reliability.level === 'limited'
    ? { blocker: null, confidence: 'limited', governingCheck: reliability.governing ?? null }
    : { blocker: null, confidence: 'reliable', governingCheck: null };
};

/** Vista de una barra para el Inspector: misma puerta y mismo clasificador. */
export const memberElasticIndexView = (
  member: MemberModel,
  result: MemberResult,
  analysis: AnalysisResult | null | undefined,
): MemberElasticIndexView => {
  const gate = elasticDemandGate(analysis);
  if (gate.blocker) {
    return { status: 'unavailable', blocker: gate.blocker, governingCheck: gate.governingCheck, gaps: [] };
  }
  const index = memberElasticIndex(member, result);
  return index.status === 'available'
    ? { status: 'available', confidence: gate.confidence ?? 'reliable', governingCheck: gate.governingCheck, index }
    : { status: 'unavailable', blocker: null, governingCheck: null, gaps: index.gaps };
};

/** Vista de toda la estructura: la consumen el Resumen y el mapa del lienzo. */
export const elasticDemandView = (
  project: ProjectModel,
  analysis: AnalysisResult | null | undefined,
): ElasticDemandView => {
  const gate = elasticDemandGate(analysis);
  if (gate.blocker) {
    return {
      status: 'unavailable',
      coverage: 'unavailable',
      blocker: gate.blocker,
      confidence: null,
      governingCheck: gate.governingCheck,
      gaps: [],
      missing: [],
      evaluated: 0,
      total: 0,
      ratios: EMPTY_RATIOS,
      unevaluated: EMPTY_IDS,
    };
  }

  const members = new Map(project.members.map((member) => [member.id, member]));
  const readings: MemberElasticIndex[] = [];
  const gaps: MemberElasticIndexGap[] = [];
  for (const result of analysis!.memberResults) {
    const member = members.get(result.memberId);
    if (!member) continue;
    const index = memberElasticIndex(member, result);
    if (index.status === 'available') readings.push(index);
    else gaps.push(index);
  }

  const total = readings.length + gaps.length;
  const unevaluated = new Set(gaps.map((gap) => gap.memberId));

  if (readings.length === 0) {
    const seen = new Set(gaps.flatMap((gap) => gap.gaps));
    return {
      status: 'unavailable',
      coverage: 'unavailable',
      blocker: 'no-evaluable-member',
      confidence: gate.confidence,
      governingCheck: gate.governingCheck,
      gaps,
      missing: GAP_ORDER.filter((gap) => seen.has(gap)),
      evaluated: 0,
      total,
      ratios: EMPTY_RATIOS,
      unevaluated,
    };
  }

  readings.sort((first, second) => second.ratio - first.ratio);
  return {
    status: 'available',
    coverage: gaps.length === 0 ? 'complete' : 'partial',
    confidence: gate.confidence ?? 'reliable',
    governingCheck: gate.governingCheck,
    highest: readings[0],
    readings,
    gaps,
    evaluated: readings.length,
    total,
    ratios: new Map(readings.map((reading) => [reading.memberId, reading.ratio])),
    unevaluated,
  };
};

/**
 * Pintura del mapa de demanda: una rampa **continua**, no un conjunto de bandas.
 *
 * η es una magnitud continua y el único punto con significado físico propio es
 * η = 1 —la estimación alcanza el Fy declarado—. Las bandas por tercios que hubo
 * aquí eran cortes inventados, exactamente igual que el 0,85 al que sustituyeron:
 * nombraban tramos que la física no distingue.
 *
 * Por encima de la referencia la rampa **sigue creciendo** en una segunda
 * familia hasta `ELASTIC_SATURATION_RATIO`; más allá el color ya no puede
 * distinguir y `saturated` lo declara para que la leyenda lo diga en palabras.
 */
export interface ElasticIndexPaint {
  color: string;
  /** η ≥ 1: la estimación alcanza el Fy declarado. Nada más. */
  atReference: boolean;
  /** El color ya no distingue magnitud; hay que leer el número. */
  saturated: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const elasticIndexPaint = (ratio: number): ElasticIndexPaint => {
  if (ratio >= ELASTIC_REFERENCE_RATIO) {
    const above = clamp01((ratio - ELASTIC_REFERENCE_RATIO) / (ELASTIC_SATURATION_RATIO - ELASTIC_REFERENCE_RATIO));
    return {
      color: `color-mix(in oklab, var(--sc-color-demand-reference-peak) ${Math.round(above * 100)}%, var(--sc-color-demand-reference))`,
      atReference: true,
      saturated: ratio > ELASTIC_SATURATION_RATIO,
    };
  }
  return {
    color: `color-mix(in oklab, var(--sc-color-demand-peak) ${Math.round(clamp01(ratio) * 100)}%, var(--sc-color-demand-base))`,
    atReference: false,
    saturated: false,
  };
};
