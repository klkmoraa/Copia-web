import { describe, expect, it } from 'vitest';
import { standardMaterials } from '../../data/standardMaterials';
import { standardSections } from '../../data/standardSections';
import type {
  AnalysisResult,
  MemberModel,
  MemberResult,
  ProjectModel,
  ReliabilityLevel,
  ResultReliability,
} from '../../types';
import * as elasticDemand from './elasticDemand';
import {
  ELASTIC_REFERENCE_RATIO,
  ELASTIC_SATURATION_RATIO,
  elasticDemandGate,
  elasticDemandView,
  elasticIndexPaint,
  memberElasticIndex,
  memberElasticIndexView,
  memberSectionModulus,
  memberYieldStrength,
  sectionElasticIndex,
} from './elasticDemand';

const ipe300 = standardSections.find((section) => section.id === 'ipe-300')!;
const a36 = standardMaterials.find((material) => material.id === 'steel-a36')!;
const a992 = standardMaterials.find((material) => material.id === 'steel-a992')!;

const identity = (values: Record<string, unknown>): Partial<MemberModel> =>
  values as unknown as Partial<MemberModel>;

/** Identidad explícita completa: es la única forma de que η se pueda publicar. */
const identified = identity({
  materialId: a36.id, materialOrigin: 'catalog',
  sectionId: ipe300.id, sectionOrigin: 'catalog',
});

const member = (overrides: Partial<MemberModel> = {}): MemberModel => ({
  id: 'B1', i: 'N1', j: 'N2', type: 'frame',
  E: a36.elasticModulus, A: ipe300.area, I: ipe300.inertiaX,
  ...identified,
  ...overrides,
});

const result = (overrides: Partial<MemberResult> = {}): MemberResult => ({
  memberId: 'B1', length: 4,
  localDisplacements: [], localEndForces: [], diagramSegments: [], diagramJumps: [],
  criticalPoints: [], diagram: [], deformation: [], deformationSegments: [], deformationCriticalPoints: [],
  maxAxial: 0, minAxial: 0, maxShear: 0, minShear: 0, maxMoment: 0, minMoment: 0,
  ...overrides,
} as MemberResult);

/** El check que gobierna un nivel `limited`: es lo que la interfaz debe citar. */
const governingCheck = {
  id: 'condition' as const,
  label: 'Condición κ₁ del sistema equilibrado',
  value: 4.2e10,
  limitedAbove: 1e10,
  unreliableAbove: 1e12,
  level: 'limited' as const,
  message: 'Condición κ₁ del sistema equilibrado: 4.200e+10 supera 1e+10.',
};

const reliability = (level: ReliabilityLevel): ResultReliability => ({
  completed: true,
  usable: level !== 'failed',
  level,
  checks: level === 'reliable' ? [] : [governingCheck],
  governing: level === 'reliable' ? undefined : governingCheck,
  reasons: level === 'reliable' ? [] : [governingCheck.message],
});

const projectOf = (...members: MemberModel[]): ProjectModel => ({
  id: 'p', name: 'p', nodes: [], members, nodalLoads: [], memberLoads: [],
  settings: { units: 'kN-m' },
} as unknown as ProjectModel);

const analysisOf = (
  results: MemberResult[],
  level: ReliabilityLevel = 'reliable',
): AnalysisResult => ({
  success: level !== 'failed',
  memberResults: results,
  nodeResults: [],
  issues: [],
  displacements: [0],
  reliability: reliability(level),
} as unknown as AnalysisResult);

describe('elastic index — data contract', () => {
  it('never publishes a silent fallback yield strength', () => {
    // El valor de reserva de 250 MPa desaparece del módulo: no hay forma de
    // publicar η sin un material verificable por identidad explícita.
    expect(elasticDemand).not.toHaveProperty('FALLBACK_YIELD_STRENGTH');
    expect(memberYieldStrength(member(identity({ materialOrigin: 'legacy', materialId: undefined }))))
      .toBeNull();
  });

  it('takes yield strength from materialId and never from matching E floats', () => {
    expect(memberYieldStrength(member({
      E: 12_345,
      ...identity({ materialId: a992.id, materialOrigin: 'catalog' }),
    }))).toEqual({ yieldStrength: a992.yieldStrength, id: a992.id, name: a992.name });
    // Mismo E exacto que A36, pero sin identidad: no se infiere por coincidencia.
    expect(memberYieldStrength(member({
      E: a36.elasticModulus,
      ...identity({ materialOrigin: 'legacy', materialId: undefined }),
    }))).toBeNull();
  });

  it('uses the catalogue section modulus only when section identity names it', () => {
    expect(memberSectionModulus(member({
      A: 0.01, I: 3e-4,
      ...identity({ sectionId: ipe300.id, sectionOrigin: 'catalog' }),
    }))).toEqual({
      sectionModulus: ipe300.sectionModulusX,
      id: ipe300.id,
      name: ipe300.name,
    });
  });

  it('never derives W from A and I for the published index', () => {
    // La sección rectangular equivalente h = √(12·I/A) desaparece: un W inventado
    // publicaba un η que el usuario no podía auditar.
    const exactFloatsWithoutIdentity = member({
      A: ipe300.area, I: ipe300.inertiaX,
      ...identity({ sectionOrigin: 'legacy', sectionId: undefined }),
    });
    expect(memberSectionModulus(exactFloatsWithoutIdentity)).toBeNull();
    expect(memberSectionModulus(member({
      A: 0.01, I: 3e-4,
      ...identity({ sectionOrigin: 'custom', sectionId: undefined }),
    }))).toBeNull();
  });
});

describe('elastic index — per member', () => {
  it('combines the axial and bending extremes as a conservative envelope', () => {
    const index = memberElasticIndex(member(), result({
      maxAxial: 100, minAxial: -40, maxMoment: 20, minMoment: -55,
    }));
    if (index.status !== 'available') throw new Error('esperaba un índice disponible');
    expect(index.maxAxial).toBe(100);
    expect(index.maxMoment).toBe(55);
    expect(index.sigmaAxial).toBeCloseTo(100 / ipe300.area, 6);
    expect(index.sigmaBending).toBeCloseTo(55 / ipe300.sectionModulusX, 6);
    expect(index.sigmaTotal).toBeCloseTo(index.sigmaAxial + index.sigmaBending, 6);
    expect(index.ratio).toBeCloseTo(index.sigmaTotal / a36.yieldStrength, 9);
    expect(index.axialShare).toBeCloseTo(index.sigmaAxial / index.sigmaTotal, 9);
  });

  it('carries the provenance of every published input', () => {
    const index = memberElasticIndex(member(), result({ maxMoment: 30 }));
    if (index.status !== 'available') throw new Error('esperaba un índice disponible');
    expect(index.material).toEqual({ id: a36.id, name: a36.name, yieldStrength: a36.yieldStrength });
    expect(index.section).toEqual({ id: ipe300.id, name: ipe300.name, sectionModulus: ipe300.sectionModulusX });
    expect(index.area).toBe(ipe300.area);
  });

  it('reports exactly which datum is missing instead of estimating it', () => {
    const noYield = memberElasticIndex(
      member(identity({ materialOrigin: 'legacy', materialId: undefined })),
      result({ maxAxial: 100, maxMoment: 12 }),
    );
    expect(noYield).toEqual({ status: 'unavailable', memberId: 'B1', gaps: ['yield-strength'] });

    const noModulus = memberElasticIndex(
      member(identity({ sectionOrigin: 'custom', sectionId: undefined })),
      result({ maxAxial: 100, maxMoment: 12 }),
    );
    expect(noModulus).toEqual({ status: 'unavailable', memberId: 'B1', gaps: ['section-modulus'] });

    const nothing = memberElasticIndex(
      member(identity({
        materialOrigin: 'legacy', materialId: undefined,
        sectionOrigin: 'legacy', sectionId: undefined,
      })),
      result({ maxAxial: 100, maxMoment: 12 }),
    );
    expect(nothing).toEqual({ status: 'unavailable', memberId: 'B1', gaps: ['yield-strength', 'section-modulus'] });
  });

  it('needs only A and Fy when the demand is purely axial', () => {
    // σ* = |N*|/A y nada más: exigir W ahí dejaba «No disponible» una lectura
    // que sí era completa, y empujaba a inventar una sección para verla.
    const index = memberElasticIndex(
      member(identity({ sectionOrigin: 'custom', sectionId: undefined })),
      result({ maxAxial: 100, minAxial: -40 }),
    );
    if (index.status !== 'available') throw new Error('esperaba un índice disponible sin W');
    expect(index.section).toBeNull();
    expect(index.sigmaBending).toBe(0);
    expect(index.sigmaAxial).toBeCloseTo(100 / ipe300.area, 6);
    expect(index.ratio).toBeCloseTo(index.sigmaAxial / a36.yieldStrength, 9);
    expect(index.axialShare).toBe(1);
  });

  it('treats a truss bar as bending-free by formulation', () => {
    // Un elemento de dos fuerzas no tiene rigidez a flexión: su envolvente de
    // momento es cero por construcción, no por casualidad numérica.
    const index = memberElasticIndex(
      member({ type: 'truss', ...identity({ sectionOrigin: 'legacy', sectionId: undefined }) }),
      result({ maxAxial: 80 }),
    );
    if (index.status !== 'available') throw new Error('esperaba un índice disponible sin W');
    expect(index.maxMoment).toBe(0);
    expect(index.section).toBeNull();
  });

  it('still demands W as soon as there is any bending to evaluate', () => {
    expect(memberElasticIndex(
      member(identity({ sectionOrigin: 'custom', sectionId: undefined })),
      result({ maxAxial: 100, maxMoment: 1e-6 }),
    )).toEqual({ status: 'unavailable', memberId: 'B1', gaps: ['section-modulus'] });
  });

  it('declines members with no usable section geometry', () => {
    expect(memberElasticIndex(member({ type: 'rigid' }), result()))
      .toEqual({ status: 'unavailable', memberId: 'B1', gaps: ['section-geometry'] });
    expect(memberElasticIndex(member({ A: 0 }), result()))
      .toEqual({ status: 'unavailable', memberId: 'B1', gaps: ['section-geometry'] });
  });

  it('reads a single section with the same rule as the whole member', () => {
    const atCut = sectionElasticIndex(member(), 100, -55);
    const overMember = memberElasticIndex(member(), result({ maxAxial: 100, minMoment: -55 }));
    if (atCut.status !== 'available' || overMember.status !== 'available') throw new Error('esperaba índices disponibles');
    expect(atCut.ratio).toBeCloseTo(overMember.ratio, 12);
    expect(sectionElasticIndex(member(identity({ materialOrigin: 'legacy', materialId: undefined })), 100, 0).status)
      .toBe('unavailable');
  });

  it('reads a purely axial section without W too', () => {
    expect(sectionElasticIndex(member(identity({ sectionOrigin: 'custom', sectionId: undefined })), 100, 0).status)
      .toBe('available');
    expect(sectionElasticIndex(member(identity({ sectionOrigin: 'custom', sectionId: undefined })), 100, 5).status)
      .toBe('unavailable');
  });
});

describe('elastic index — reliability gate', () => {
  it('publishes an ordinary reading only for a reliable analysis', () => {
    expect(elasticDemandGate(analysisOf([result()], 'reliable')))
      .toEqual({ blocker: null, confidence: 'reliable', governingCheck: null });
  });

  it('names the check that governs a limited analysis', () => {
    // «Confiabilidad limitada» sin causa es una etiqueta que el usuario no puede
    // accionar: se publica el check gobernante.
    const gate = elasticDemandGate(analysisOf([result()], 'limited'));
    expect(gate.blocker).toBeNull();
    expect(gate.confidence).toBe('limited');
    expect(gate.governingCheck?.id).toBe('condition');
  });

  it('never reports an unreliable analysis as merely limited', () => {
    // `limited` es una lectura que sí se publica, marcada. `unreliable` es una
    // que no se publica: llamarla «limitada» la presentaba como algo intermedio
    // y utilizable que no es.
    for (const level of ['unreliable', 'failed'] as const) {
      const gate = elasticDemandGate(analysisOf([result()], level));
      expect(gate.blocker, level).toBe('unreliable');
      expect(gate.confidence, level).toBeNull();
      // Pero la causa sigue disponible para citarla como motivo del bloqueo.
      expect(gate.governingCheck?.id, level).toBe('condition');
    }
  });

  it('reports no confidence and no cause when there is nothing to classify', () => {
    expect(elasticDemandGate(null)).toEqual({ blocker: 'no-analysis', confidence: null, governingCheck: null });
  });
});

describe('elastic index — structure view model', () => {
  it('publishes the highest evaluable index with full coverage when nothing is missing', () => {
    const view = elasticDemandView(
      projectOf(member({ id: 'B1' }), member({ id: 'B2' })),
      analysisOf([
        result({ memberId: 'B1', maxMoment: 30 }),
        result({ memberId: 'B2', maxMoment: 90 }),
      ]),
    );
    if (view.status !== 'available') throw new Error('esperaba una vista disponible');
    expect(view.coverage).toBe('complete');
    expect(view.confidence).toBe('reliable');
    expect(view.evaluated).toBe(2);
    expect(view.total).toBe(2);
    expect(view.highest.memberId).toBe('B2');
    expect(view.readings.map((reading) => reading.memberId)).toEqual(['B2', 'B1']);
    expect(view.ratios.get('B2')).toBeCloseTo(view.highest.ratio, 12);
    expect(view.gaps).toEqual([]);
    expect(view.unevaluated.size).toBe(0);
  });

  it('never calls the highest evaluable member governing when coverage is partial', () => {
    // B2 es el miembro más exigido del modelo, pero no puede leerse. Llamar
    // «gobernante» a B1 afirmaba sobre toda la estructura algo que la lectura no
    // sabe: sólo es el mayor entre los evaluables, y así debe declararse.
    const view = elasticDemandView(
      projectOf(
        member({ id: 'B1' }),
        member({ id: 'B2', ...identity({ materialOrigin: 'legacy', materialId: undefined }) }),
      ),
      analysisOf([
        result({ memberId: 'B1', maxMoment: 30 }),
        result({ memberId: 'B2', maxMoment: 900 }),
      ]),
    );
    if (view.status !== 'available') throw new Error('esperaba una vista disponible');
    expect(view).not.toHaveProperty('governing');
    expect(view.coverage).toBe('partial');
    expect(view.evaluated).toBe(1);
    expect(view.total).toBe(2);
    expect(view.highest.memberId).toBe('B1');
    expect(view.ratios.has('B2')).toBe(false);
    expect(view.gaps).toEqual([{ status: 'unavailable', memberId: 'B2', gaps: ['yield-strength'] }]);
    expect([...view.unevaluated]).toEqual(['B2']);
  });

  it('reports unavailable — with what is missing — when no member can be read', () => {
    const view = elasticDemandView(
      projectOf(member({ id: 'B1', ...identity({ sectionOrigin: 'custom', sectionId: undefined }) })),
      analysisOf([result({ memberId: 'B1', maxMoment: 30 })]),
    );
    expect(view.status).toBe('unavailable');
    if (view.status !== 'unavailable') return;
    expect(view.coverage).toBe('unavailable');
    expect(view.blocker).toBe('no-evaluable-member');
    expect(view.missing).toEqual(['section-modulus']);
    expect(view.evaluated).toBe(0);
    expect(view.total).toBe(1);
    expect(view.ratios.size).toBe(0);
    expect([...view.unevaluated]).toEqual(['B1']);
  });

  it('never publishes eta for an unreliable analysis, however complete the data is', () => {
    const view = elasticDemandView(
      projectOf(member({ id: 'B1' })),
      analysisOf([result({ memberId: 'B1', maxMoment: 30 })], 'unreliable'),
    );
    expect(view.status).toBe('unavailable');
    if (view.status !== 'unavailable') return;
    expect(view.blocker).toBe('unreliable');
    expect(view.coverage).toBe('unavailable');
    expect(view.ratios.size).toBe(0);
    // Ni «limitada» ni ninguna otra calificación: la lectura no se publica.
    expect(view.confidence).toBeNull();
    expect(view.governingCheck?.id).toBe('condition');
  });

  it('publishes a limited analysis marked as limited and names its governing check', () => {
    const view = elasticDemandView(
      projectOf(member({ id: 'B1' })),
      analysisOf([result({ memberId: 'B1', maxMoment: 30 })], 'limited'),
    );
    if (view.status !== 'available') throw new Error('esperaba una vista disponible marcada como limitada');
    expect(view.confidence).toBe('limited');
    expect(view.governingCheck?.id).toBe('condition');
  });

  it('gives the inspector the same reading the summary publishes', () => {
    const b1 = member({ id: 'B1' });
    const b1Result = result({ memberId: 'B1', maxAxial: 40, maxMoment: 30 });
    const analysis = analysisOf([b1Result]);
    const view = elasticDemandView(projectOf(b1), analysis);
    const perMember = memberElasticIndexView(b1, b1Result, analysis);
    if (view.status !== 'available' || perMember.status !== 'available') throw new Error('esperaba lecturas disponibles');
    expect(perMember.index.ratio).toBeCloseTo(view.highest.ratio, 12);
    expect(perMember.confidence).toBe(view.confidence);
  });

  it('hands the inspector the governing check of a limited analysis too', () => {
    const b1 = member({ id: 'B1' });
    const perMember = memberElasticIndexView(b1, result({ memberId: 'B1', maxMoment: 30 }), analysisOf([result()], 'limited'));
    if (perMember.status !== 'available') throw new Error('esperaba una lectura disponible');
    expect(perMember.governingCheck?.id).toBe('condition');
  });

  it('blocks the inspector reading on the same reliability gate as the summary', () => {
    const b1 = member({ id: 'B1' });
    const perMember = memberElasticIndexView(b1, result({ memberId: 'B1', maxMoment: 30 }), analysisOf([result()], 'unreliable'));
    expect(perMember.status).toBe('unavailable');
    if (perMember.status !== 'unavailable') return;
    expect(perMember.blocker).toBe('unreliable');
    expect(perMember.governingCheck?.id).toBe('condition');
    expect(perMember.gaps).toEqual([]);
  });
});

describe('elastic index — continuous magnitude scale', () => {
  it('has no bands and no safety semantics left in its vocabulary', () => {
    // eta es continua. Los tercios 1/3–2/3 eran cortes inventados igual que el
    // 0,85 al que sustituyeron: nombraban tramos que la física no distingue.
    for (const removed of ['DEMAND_WARNING_RATIO', 'demandTone', 'elasticIndexBand', 'elasticIndexColor']) {
      expect(elasticDemand, removed).not.toHaveProperty(removed);
    }
  });

  it('keeps the paint strictly monotonic below the reference', () => {
    const colors = [0, 0.1, 0.25, 0.5, 0.75, 0.99].map((ratio) => elasticIndexPaint(ratio).color);
    expect(new Set(colors).size).toBe(colors.length);
    expect(elasticIndexPaint(0.5).color)
      .toBe('color-mix(in oklab, var(--sc-color-demand-peak) 50%, var(--sc-color-demand-base))');
    expect(elasticIndexPaint(0).color)
      .toBe('color-mix(in oklab, var(--sc-color-demand-peak) 0%, var(--sc-color-demand-base))');
    for (const ratio of [0, 0.5, 0.99]) {
      expect(elasticIndexPaint(ratio).atReference, String(ratio)).toBe(false);
      expect(elasticIndexPaint(ratio).saturated, String(ratio)).toBe(false);
    }
  });

  it('keeps communicating magnitude above the reference instead of flattening it', () => {
    // Antes, todo eta >= 1 recibía el mismo color: 1,01 y 4,00 se veían igual y
    // el mapa dejaba de decir cuánto justo donde más importa.
    const above = [1, 1.25, 1.5, 1.75, ELASTIC_SATURATION_RATIO].map((ratio) => elasticIndexPaint(ratio).color);
    expect(new Set(above).size).toBe(above.length);
    expect(elasticIndexPaint(ELASTIC_REFERENCE_RATIO).color)
      .toBe('color-mix(in oklab, var(--sc-color-demand-reference-peak) 0%, var(--sc-color-demand-reference))');
    expect(elasticIndexPaint(1.5).color)
      .toBe('color-mix(in oklab, var(--sc-color-demand-reference-peak) 50%, var(--sc-color-demand-reference))');
    for (const ratio of [ELASTIC_REFERENCE_RATIO, 1.5, 9]) {
      expect(elasticIndexPaint(ratio).atReference, String(ratio)).toBe(true);
    }
  });

  it('declares saturation explicitly rather than pretending the ramp still grows', () => {
    expect(elasticIndexPaint(ELASTIC_SATURATION_RATIO).saturated).toBe(false);
    expect(elasticIndexPaint(ELASTIC_SATURATION_RATIO + 1e-9).saturated).toBe(true);
    expect(elasticIndexPaint(50).saturated).toBe(true);
    // Y saturado significa saturado: el color deja de moverse, y se declara.
    expect(elasticIndexPaint(50).color).toBe(elasticIndexPaint(ELASTIC_SATURATION_RATIO).color);
  });

  it('marks the reference at exactly eta = 1 and nowhere else', () => {
    expect(elasticIndexPaint(ELASTIC_REFERENCE_RATIO - 1e-9).atReference).toBe(false);
    expect(elasticIndexPaint(ELASTIC_REFERENCE_RATIO).atReference).toBe(true);
  });
});

describe('elastic index — unit invariance', () => {
  it('does not depend on the displayed unit system', () => {
    // η se calcula en unidades base internas. La vista no recibe `units`, así que
    // cambiar el sistema visible no puede moverla: se comprueba sobre el modelo.
    const metric = elasticDemandView(projectOf(member()), analysisOf([result({ maxAxial: 120, maxMoment: 45 })]));
    const imperialProject = projectOf(member());
    (imperialProject.settings as { units: string }).units = 'kip-ft';
    const imperial = elasticDemandView(imperialProject, analysisOf([result({ maxAxial: 120, maxMoment: 45 })]));
    if (metric.status !== 'available' || imperial.status !== 'available') throw new Error('esperaba vistas disponibles');
    expect(imperial.highest.ratio).toBe(metric.highest.ratio);
  });
});
