import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import { hibbeler439, hibbeler440, hibbeler441, hibbeler442 } from './hibbelerFrames.test';
import { classifyAnalysisReliability } from './reliability';
import { analyzeProject } from './solver';

/**
 * Evidence for the thresholds chosen in `reliability.ts`.
 *
 * The thresholds were calibrated against the warning/error limits the solver
 * already applied, not against a battery of real models. This suite is that
 * battery: every model here is a legitimate, previously verified structure —
 * closed-form textbook problems and representative uses of every non-trivial
 * engine feature (semi-rigid connections, rigid offsets, Timoshenko shear,
 * inclined springs, self-weight, truss action). None of them should classify
 * below `reliable`. A failure here is not a broken threshold by itself, but it
 * is exactly the evidence §11.2/riesgo #2 of the Codex context document asks
 * for before touching a threshold.
 */
const settings = createDefaultSettings();

const simplySupportedBeam = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'calibration-beam',
  name: 'Viga simple',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }],
  loadCases: [{ id: 'Q', name: 'Q', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [{
    id: 'W', memberId: 'AB', caseId: 'Q', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
    start: 0, end: 1, qyStart: -15, qyEnd: -15,
  }],
  memberInitialEffects: [],
  settings,
});

const portalFrame = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'calibration-portal',
  name: 'Pórtico simple',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 0, y: 4, support: { type: 'none' } },
    { id: 'C', x: 6, y: 4, support: { type: 'none' } },
    { id: 'D', x: 6, y: 0, support: { type: 'fixed' } },
  ],
  members: [
    { id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
    { id: 'BC', i: 'B', j: 'C', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
    { id: 'CD', i: 'C', j: 'D', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
  ],
  loadCases: [{ id: 'W', name: 'Viento', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [{ id: 'N1', nodeId: 'B', caseId: 'W', fx: 20, fy: 0, mz: 0 }],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings,
});

const triangularTrussUnderNodalLoad = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'calibration-truss',
  name: 'Armadura triangular',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'C', x: 3, y: 3, support: { type: 'none' } },
  ],
  members: [
    { id: 'AC', i: 'A', j: 'C', type: 'truss', E: 200e6, A: 0.01, I: 0 },
    { id: 'CB', i: 'C', j: 'B', type: 'truss', E: 200e6, A: 0.01, I: 0 },
    { id: 'AB', i: 'A', j: 'B', type: 'truss', E: 200e6, A: 0.01, I: 0 },
  ],
  loadCases: [{ id: 'Q', name: 'Q', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [{ id: 'N1', nodeId: 'C', caseId: 'Q', fx: 0, fy: -10, mz: 0 }],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings,
});

const cantileverWithSelfWeight = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'calibration-selfweight',
  name: 'Voladizo con peso propio',
  // Self-weight on a truss bar is only ever purely axial when the bar is
  // exactly vertical; any other orientation carries a transverse component a
  // two-force element cannot represent, so this fixture exercises the feature
  // on a frame member instead, where it is unconditionally valid.
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 4, y: 0, support: { type: 'none' } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.03, I: 6e-4, density: 7850 }],
  loadCases: [{ id: 'PP', name: 'Peso propio', category: 'permanent', active: true, selfWeightFactor: 1 }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings,
});

const semiRigidWithRigidOffsets = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'calibration-semirigid',
  name: 'Conexión semirrígida y zonas rígidas',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 6, y: 0, support: { type: 'pin' } },
  ],
  members: [{
    id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5,
    rotationalSpringJ: 4000, rigidOffsetI: 0.3, rigidOffsetJ: 0.2,
  }],
  loadCases: [{ id: 'Q', name: 'Q', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [{
    id: 'W', memberId: 'AB', caseId: 'Q', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
    start: 0, end: 1, qyStart: -12, qyEnd: -12,
  }],
  memberInitialEffects: [],
  settings,
});

const timoshenkoDeepBeam = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'calibration-timoshenko',
  name: 'Viga profunda Timoshenko',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 2, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{
    id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.05, I: 4e-4,
    beamTheory: 'timoshenko', G: 77e6, shearArea: 0.04,
  }],
  loadCases: [{ id: 'Q', name: 'Q', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [{
    id: 'P', memberId: 'AB', caseId: 'Q', type: 'point', coordinateSystem: 'local', lengthBasis: 'real',
    start: 0, end: 1, position: 0.5, px: 0, py: -80,
  }],
  memberInitialEffects: [],
  settings,
});

const inclinedSpringSupport = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'calibration-spring',
  name: 'Apoyo elástico inclinado',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 5, y: 0, support: { type: 'custom', spring: { kNormal: 15000, angleDeg: 60 } } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }],
  loadCases: [{ id: 'Q', name: 'Q', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [{ id: 'N1', nodeId: 'B', caseId: 'Q', fx: 0, fy: -20, mz: 0 }],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings,
});

const referenceModels: Array<{ name: string; build: () => ProjectModel }> = [
  { name: 'Viga simplemente apoyada', build: simplySupportedBeam },
  { name: 'Pórtico con nudos rígidos', build: portalFrame },
  { name: 'Armadura triangular bajo carga nodal', build: triangularTrussUnderNodalLoad },
  { name: 'Voladizo con peso propio', build: cantileverWithSelfWeight },
  { name: 'Conexión semirrígida con zonas rígidas colineales', build: semiRigidWithRigidOffsets },
  { name: 'Viga profunda con teoría de Timoshenko', build: timoshenkoDeepBeam },
  { name: 'Apoyo elástico normal inclinado', build: inclinedSpringSupport },
  { name: 'Hibbeler 4-39', build: hibbeler439 },
  { name: 'Hibbeler 4-40', build: hibbeler440 },
  { name: 'Hibbeler 4-41', build: hibbeler441 },
  { name: 'Hibbeler 4-42', build: hibbeler442 },
];

describe('calibración de umbrales de confiabilidad contra modelos de referencia', () => {
  it.each(referenceModels)('$name se clasifica reliable, sin comprobación degradada', ({ build }) => {
    const result = analyzeProject(build());
    expect(result.success).toBe(true);
    const reliability = classifyAnalysisReliability(result);
    expect(reliability.completed).toBe(true);
    expect(reliability.usable).toBe(true);
    expect(reliability.level).toBe('reliable');
    expect(reliability.governing).toBeUndefined();
    expect(reliability.checks.every((check) => check.level === 'reliable')).toBe(true);
  });

  it('deja un margen amplio entre los modelos de referencia y los umbrales limited', () => {
    // Real evidence for the note in the Codex context document: how far below
    // the `limited` threshold do legitimate models actually sit. A model that
    // approaches the threshold here would be the trigger to revisit it.
    const margins = referenceModels.map(({ name, build }) => {
      const reliability = classifyAnalysisReliability(analyzeProject(build()));
      const condition = reliability.checks.find((check) => check.id === 'condition')!;
      const backwardError = reliability.checks.find((check) => check.id === 'backward-error')!;
      return { name, conditionRatio: condition.value / condition.limitedAbove, backwardErrorRatio: backwardError.value / backwardError.limitedAbove };
    });
    for (const margin of margins) {
      expect(margin.conditionRatio).toBeLessThan(1e-3);
      expect(margin.backwardErrorRatio).toBeLessThan(1e-2);
    }
  });
});
