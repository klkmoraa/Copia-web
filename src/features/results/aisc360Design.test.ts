import { describe, expect, it } from 'vitest';
import { standardMaterials } from '../../data/standardMaterials';
import { standardSections } from '../../data/standardSections';
import type { AnalysisResult, MemberModel, MemberResult, ProjectModel, ReliabilityLevel, ResultReliability } from '../../types';
import {
  aisc360DemandView,
  memberAisc360Check,
  memberAisc360View,
  type Aisc360AxialCheck,
  type Aisc360FlexureCheck,
} from './aisc360Design';

const w12x26 = standardSections.find((section) => section.id === 'w12x26')!;
const hss6x6 = standardSections.find((section) => section.id === 'hss6x6x3-8')!;
const a992 = standardMaterials.find((material) => material.id === 'steel-a992')!;

const identity = (values: Record<string, unknown>): Partial<MemberModel> => values as unknown as Partial<MemberModel>;

const catalogIdentity = identity({
  materialId: a992.id, materialOrigin: 'catalog',
  sectionId: w12x26.id, sectionOrigin: 'catalog',
});

const member = (overrides: Partial<MemberModel> = {}): MemberModel => ({
  id: 'M1', i: 'N1', j: 'N2', type: 'frame',
  E: a992.elasticModulus, A: w12x26.area, I: w12x26.inertiaX,
  ...catalogIdentity,
  ...overrides,
});

const result = (overrides: Partial<MemberResult> = {}): MemberResult => ({
  memberId: 'M1', length: 3,
  localDisplacements: [], localEndForces: [], diagramSegments: [], diagramJumps: [],
  criticalPoints: [], diagram: [], deformation: [], deformationSegments: [], deformationCriticalPoints: [],
  maxAxial: 0, minAxial: 0, maxShear: 0, minShear: 0, maxMoment: 0, minMoment: 0,
  ...overrides,
} as MemberResult);

const reliability = (level: ReliabilityLevel): ResultReliability => ({
  completed: true,
  usable: level !== 'failed',
  level,
  checks: [],
  governing: undefined,
  reasons: [],
});

const analysisOf = (results: MemberResult[], level: ReliabilityLevel = 'reliable'): AnalysisResult => ({
  success: level !== 'failed',
  memberResults: results,
  nodeResults: [],
  issues: [],
  displacements: [0],
  reliability: reliability(level),
} as unknown as AnalysisResult);

const projectOf = (...members: MemberModel[]): ProjectModel => ({
  id: 'p', name: 'p', nodes: [], members, nodalLoads: [], memberLoads: [],
  settings: { units: 'kN-m' },
} as unknown as ProjectModel);

describe('AISC 360 — compresión (E3)', () => {
  it('governs by the axis with the lower Fcr, and matches a hand-derived W12x26 column', () => {
    // K = 1 en las dos direcciones, L = 3 m, columna W12x26 en A992.
    // Valores de referencia obtenidos con una implementación independiente de
    // las mismas fórmulas (E3-2/E3-3), no del propio módulo bajo prueba.
    const reading = memberAisc360Check(member(), result({ minAxial: -500, maxAxial: 0 }));
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    const axial = reading.axial as Aisc360AxialCheck;
    expect(axial.status).toBe('available');
    expect(axial.mode).toBe('compression');
    expect(axial.governingAxis).toBe('minor');
    expect(axial.slendernessMinor).toBeCloseTo(78.5408, 3);
    expect(axial.slendernessMajor).toBeCloseTo(22.8453, 3);
    expect(axial.capacity).toBeCloseTo(975.91, 1);
    expect(axial.ratio).toBeCloseTo(500 / 975.91, 3);
  });

  it('reads the effective length factors and the out-of-plane unbraced length when declared', () => {
    const withBracing = member({
      designEffectiveLengthFactorMinor: 0.5,
      designUnbracedLengthMinor: 1.5,
    });
    const reading = memberAisc360Check(withBracing, result({ minAxial: -500 }));
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    const axial = reading.axial as Aisc360AxialCheck;
    // K·L/r con K=0.5 y L=1.5 m es un cuarto de la esbeltez sin arriostrar: la
    // capacidad sube de forma visible, exactamente lo que un arriostramiento
    // intermedio real debe hacer.
    expect(axial.slendernessMinor).toBeCloseTo((0.5 * 1.5) / Math.sqrt(w12x26.inertiaY / w12x26.area), 3);
    expect(axial.capacity).toBeGreaterThan(975.91);
  });

  it('declares a gap instead of guessing r when the section is not a catalogue I-shape', () => {
    const customSection = member({
      ...identity({ sectionId: undefined, sectionOrigin: 'custom' }),
    });
    const reading = memberAisc360Check(customSection, result({ minAxial: -500 }));
    expect(reading.status).toBe('unavailable');
    if (reading.status !== 'unavailable') return;
    expect(reading.gaps).toContain('section-not-supported');
  });

  it('does not extend E3 flexural buckling to a non-I catalogue shape (HSS)', () => {
    const tube = member(identity({ sectionId: hss6x6.id, sectionOrigin: 'catalog' }));
    const reading = memberAisc360Check(tube, result({ minAxial: -200 }));
    expect(reading.status).toBe('unavailable');
    if (reading.status !== 'unavailable') return;
    expect(reading.gaps).toEqual(['section-not-supported']);
  });
});

describe('AISC 360 — tracción (D2-a)', () => {
  it('checks yielding only, from A and Fy, and flags rupture as not evaluated', () => {
    const reading = memberAisc360Check(member(), result({ maxAxial: 300, minAxial: 0 }));
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    const axial = reading.axial as Aisc360AxialCheck;
    expect(axial.mode).toBe('tension');
    expect(axial.tensionRuptureNotEvaluated).toBe(true);
    expect(axial.capacity).toBeCloseTo(0.9 * a992.yieldStrength * w12x26.area, 6);
    expect(axial.ratio).toBeCloseTo(300 / axial.capacity, 6);
  });

  it('publishes tension yielding even without a catalogue section, and declares it', () => {
    const noSection = member(identity({ sectionId: undefined, sectionOrigin: 'custom' }));
    const reading = memberAisc360Check(noSection, result({ maxAxial: 100 }));
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    expect(reading.section).toBeNull();
    expect(reading.governingCheck).toBe('axial');
  });

  it('governs by whichever demand is larger in magnitude when a member sees both signs', () => {
    // Tracción pequeña, compresión grande: debe gobernar la compresión.
    const reading = memberAisc360Check(member(), result({ maxAxial: 10, minAxial: -500 }));
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    expect((reading.axial as Aisc360AxialCheck).mode).toBe('compression');
  });

  it('reports a trivial available reading with zero ratio when there is no demand at all', () => {
    // Sin axil, ni flexión ni cortante: el axil trivial (tracción, demanda 0)
    // es la única lectura, con razón 0 — no se esconde el miembro, se declara
    // sin exigencia.
    const reading = memberAisc360Check(member(), result());
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    expect(reading.governingRatio).toBe(0);
    expect(reading.flexure).toEqual({ status: 'not-applicable' });
    expect(reading.shear).toEqual({ status: 'not-applicable' });
  });
});

describe('AISC 360 — flexión mayor (F2, meseta plástica)', () => {
  it('publishes Mn = Mp when the section is compact and Lb ≤ Lp', () => {
    const reading = memberAisc360Check(
      member({ designUnbracedLengthLateralTorsional: 1 }),
      result({ maxMoment: 100, minMoment: -20 }),
    );
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    const flexure = reading.flexure as Aisc360FlexureCheck;
    expect(flexure.status).toBe('available');
    expect(flexure.mp).toBeCloseTo(a992.yieldStrength * w12x26.plasticModulusX, 6);
    expect(flexure.lp).toBeCloseTo(1.6186, 3);
    expect(flexure.capacity).toBeCloseTo(189.28, 1);
    expect(flexure.ratio).toBeCloseTo(100 / 189.28, 3);
  });

  it('declares ltb-inelastic instead of fabricating Mn beyond Lp, using the member length as Lb by default', () => {
    // Longitud del miembro = 3 m > Lp ≈ 1.62 m, y no se declaró Lb: el
    // arriostramiento intermedio se asume ausente, la lectura conservadora.
    const reading = memberAisc360Check(member(), result({ maxMoment: 100 }));
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    expect(reading.flexure).toEqual({ status: 'unavailable', gap: 'ltb-inelastic' });
    expect(reading.gaps).toContain('ltb-inelastic');
  });

  it('is not-applicable on a truss member, and never blocks its axial reading', () => {
    const truss = member({ type: 'truss', I: 0 });
    const reading = memberAisc360Check(truss, result({ maxAxial: 200, maxMoment: 999 }));
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    expect(reading.flexure).toEqual({ status: 'not-applicable' });
    expect(reading.shear).toEqual({ status: 'not-applicable' });
    expect(reading.governingCheck).toBe('axial');
  });
});

describe('AISC 360 — cortante (G2.1, alma compacta)', () => {
  it('publishes Vn = 0.6·Fy·Aw when the web is compact for shear', () => {
    const reading = memberAisc360Check(member(), result({ maxShear: 100 }));
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    expect(reading.shear).toEqual(expect.objectContaining({ status: 'available' }));
    if (reading.shear.status === 'available') {
      expect(reading.shear.capacity).toBeCloseTo(374.74, 1);
      expect(reading.shear.ratio).toBeCloseTo(100 / 374.74, 3);
    }
  });
});

describe('AISC 360 — interacción (H1)', () => {
  it('uses H1-1a when Pr/Pc ≥ 0.2 and H1-1b below that, and always includes axial and flexure', () => {
    const highAxial = memberAisc360Check(
      member({ designUnbracedLengthLateralTorsional: 1 }),
      result({ minAxial: -500, maxMoment: 50 }),
    );
    expect(highAxial.status).toBe('available');
    if (highAxial.status === 'available') expect(highAxial.interaction).toEqual(expect.objectContaining({ status: 'available', formula: 'H1-1a' }));

    const lowAxial = memberAisc360Check(
      member({ designUnbracedLengthLateralTorsional: 1 }),
      result({ minAxial: -10, maxMoment: 50 }),
    );
    expect(lowAxial.status).toBe('available');
    if (lowAxial.status === 'available') expect(lowAxial.interaction).toEqual(expect.objectContaining({ status: 'available', formula: 'H1-1b' }));
  });

  it('stays unavailable when either axial or flexure is a gap, never guessing the missing half', () => {
    // Lb por defecto (3 m) supera Lp: la flexión es un gap, y H1 no se inventa
    // la mitad que falta.
    const reading = memberAisc360Check(member(), result({ minAxial: -500, maxMoment: 50 }));
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    expect(reading.interaction).toEqual({ status: 'unavailable' });
  });

  it('never lets the combined ratio hide a higher standalone ratio', () => {
    const reading = memberAisc360Check(
      member({ designUnbracedLengthLateralTorsional: 1 }),
      result({ minAxial: -50, maxMoment: 500 }),
    );
    expect(reading.status).toBe('available');
    if (reading.status !== 'available') return;
    const flexureRatio = (reading.flexure as Aisc360FlexureCheck).ratio;
    expect(reading.governingRatio).toBeGreaterThanOrEqual(flexureRatio);
  });
});

describe('AISC 360 — puerta de entrada', () => {
  it('is unavailable without a catalogue material, regardless of section', () => {
    const noMaterial = member(identity({ materialId: undefined, materialOrigin: 'custom' }));
    const reading = memberAisc360Check(noMaterial, result({ minAxial: -100 }));
    expect(reading).toEqual({ status: 'unavailable', memberId: 'M1', gaps: ['material-catalog'] });
  });

  it('is unavailable for rigid links, the same gap as elasticDemand uses', () => {
    const rigid = member({ type: 'rigid', I: 0 });
    const reading = memberAisc360Check(rigid, result({ minAxial: -100 }));
    expect(reading).toEqual({ status: 'unavailable', memberId: 'M1', gaps: ['section-not-supported'] });
  });

  it('shares the reliability gate with elasticDemand: unreliable blocks, limited passes marked', () => {
    const blocked = memberAisc360View(member(), result({ minAxial: -500 }), analysisOf([result({ minAxial: -500 })], 'unreliable'));
    expect(blocked.status).toBe('unavailable');
    if (blocked.status === 'unavailable') expect(blocked.blocker).toBe('unreliable');

    const limited = memberAisc360View(member(), result({ minAxial: -500 }), analysisOf([result({ minAxial: -500 })], 'limited'));
    expect(limited.status).toBe('available');
    if (limited.status === 'available') expect(limited.confidence).toBe('limited');
  });

  it('reports no-analysis when there is nothing to read yet', () => {
    const view = memberAisc360View(member(), result(), undefined);
    expect(view).toEqual(expect.objectContaining({ status: 'unavailable', blocker: 'no-analysis' }));
  });
});

describe('AISC 360 — vista de estructura', () => {
  it('separates evaluable members from gaps and sorts by the governing ratio', () => {
    const weak = member({ id: 'M2', ...identity({ sectionId: undefined, sectionOrigin: 'custom' }) });
    const strong = member({ id: 'M1' });
    const project = projectOf(strong, weak);
    const analysis = analysisOf([
      result({ memberId: 'M1', minAxial: -500 }),
      result({ memberId: 'M2', minAxial: -100 }),
    ]);
    const view = aisc360DemandView(project, analysis);
    expect(view.status).toBe('available');
    if (view.status !== 'available') return;
    expect(view.coverage).toBe('partial');
    expect(view.evaluated).toBe(1);
    expect(view.highest.memberId).toBe('M1');
    expect(view.gaps.map((gap) => gap.memberId)).toEqual(['M2']);
    expect(view.unevaluated.has('M2')).toBe(true);
  });

  it('is unavailable with no-analysis when there is nothing to read', () => {
    const view = aisc360DemandView(projectOf(member()), undefined);
    expect(view).toEqual(expect.objectContaining({ status: 'unavailable', blocker: 'no-analysis' }));
  });
});
