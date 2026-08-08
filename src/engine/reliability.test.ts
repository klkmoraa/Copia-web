import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/defaultProject';
import type { AnalysisResult, ProjectModel } from '../types';
import { classifyAnalysisReliability, isTrustedForCombination, resolveReliability, worstLevel } from './reliability';
import { analyzeProject } from './solver';

const beam = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'reliability-beam',
  name: 'Viga de referencia',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }],
  loadCases: [{ id: 'Q', name: 'Q', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [{
    id: 'W', memberId: 'AB', caseId: 'Q', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
    start: 0, end: 1, qyStart: -12, qyEnd: -12,
  }],
  memberInitialEffects: [],
  settings: createDefaultSettings(),
});

const unsupportedBeam = (): ProjectModel => ({
  ...beam(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'none' } },
    { id: 'B', x: 8, y: 0, support: { type: 'none' } },
  ],
});

/** Minimal synthetic result used to exercise individual thresholds. */
const syntheticResult = (overrides: Partial<AnalysisResult> = {}): AnalysisResult => ({
  success: true,
  issues: [],
  nodeResults: [{ nodeId: 'A', ux: 0, uy: 0, rz: 0, rx: 0, ry: 0, rm: 0 }],
  memberResults: [],
  displacements: [0, 0, 0],
  residualNorm: 1e-16,
  constraintResidual: 1e-16,
  linearResidual: 1e-17,
  refinementIterations: 0,
  conditionEstimate: 1e4,
  forwardErrorBound: 1e-13,
  reliableDigits: 12,
  equilibrium: {
    sumFx: 0, sumFy: 0, sumM: 0,
    normalizedComponents: { fx: 0, fy: 0, mz: 0 },
    normalizedResidual: 0,
  },
  explanation: [],
  ...overrides,
});

describe('clasificación de confiabilidad numérica', () => {
  it('distingue cálculo terminado, resultado utilizable y resultado confiable', () => {
    const solved = analyzeProject(beam());
    expect(solved.success).toBe(true);
    expect(solved.reliability).toBeDefined();
    expect(solved.reliability!.completed).toBe(true);
    expect(solved.reliability!.usable).toBe(true);
    expect(solved.reliability!.level).toBe('reliable');
    expect(solved.reliability!.governing).toBeUndefined();
    expect(solved.reliability!.reasons).toHaveLength(0);
  });

  it('comprueba condición, residuo, error hacia atrás, refinamiento, equilibrio, restricciones y auditoría', () => {
    const solved = analyzeProject(beam());
    const ids = solved.reliability!.checks.map((check) => check.id).sort();
    expect(ids).toEqual([
      'backward-error',
      'compatibility',
      'condition',
      'constraints',
      'diagram-closure',
      'equilibrium',
      'forward-error',
      'load-audit',
      'p-delta-convergence',
      'refinement',
      'structural-residual',
    ]);
    expect(solved.reliability!.checks.every((check) => check.level === 'reliable')).toBe(true);
  });

  it('marca failed cuando el análisis no produce resultados utilizables', () => {
    const failed = analyzeProject(unsupportedBeam());
    expect(failed.success).toBe(false);
    expect(failed.reliability!.usable).toBe(false);
    expect(failed.reliability!.level).toBe('failed');
    expect(failed.reliability!.reasons.length).toBeGreaterThan(0);
  });

  it('no considera confiable un resultado solo porque success sea true', () => {
    // Every warning-level defect the solver tolerates keeps success === true.
    const degraded = classifyAnalysisReliability(syntheticResult({
      conditionEstimate: 5e10,
      linearResidual: 1e-11,
    }));
    expect(degraded.completed).toBe(true);
    expect(degraded.usable).toBe(true);
    expect(degraded.level).toBe('limited');
    expect(degraded.governing?.id).toBeDefined();
    expect(degraded.reasons.length).toBeGreaterThan(0);
  });

  it('clasifica como unreliable un residuo estructural o un equilibrio fuera de tolerancia', () => {
    expect(classifyAnalysisReliability(syntheticResult({ residualNorm: 1e-5 })).level).toBe('unreliable');
    expect(classifyAnalysisReliability(syntheticResult({
      equilibrium: {
        sumFx: 0, sumFy: 0, sumM: 0,
        normalizedComponents: { fx: 0, fy: 0, mz: 0 },
        normalizedResidual: 1e-4,
      },
    })).level).toBe('unreliable');
    expect(classifyAnalysisReliability(syntheticResult({ conditionEstimate: 1e14 })).level).toBe('unreliable');
    expect(classifyAnalysisReliability(syntheticResult({ forwardErrorBound: 1e-2 })).level).toBe('unreliable');
  });

  it('degrada el cierre N-V-M y la compatibilidad de la deformada', () => {
    const member = {
      memberId: 'AB', length: 8, localDisplacements: [], localEndForces: [],
      diagramSegments: [], diagramJumps: [], criticalPoints: [], diagram: [],
      deformation: [], deformationSegments: [], deformationCriticalPoints: [],
      maxAxial: 0, minAxial: 0, maxShear: 0, minShear: 0, maxMoment: 0, minMoment: 0,
    };
    expect(classifyAnalysisReliability(syntheticResult({
      memberResults: [{ ...member, endCompatibilityError: 1e-5 }],
    })).level).toBe('unreliable');
    expect(classifyAnalysisReliability(syntheticResult({
      memberResults: [{ ...member, compatibilityError: 1e-8 }],
    })).level).toBe('limited');
  });

  it('trata como unreliable un resultado con errores aunque conserve números', () => {
    const withError = classifyAnalysisReliability(syntheticResult({
      success: false,
      issues: [{ id: 'x', severity: 'error', title: 'Auditoría', message: 'Las cargas no coinciden.' }],
    }));
    expect(withError.usable).toBe(true);
    expect(withError.level).toBe('unreliable');
    expect(isTrustedForCombination(withError.level)).toBe(false);
  });

  it('trata un valor no finito requerido como unreliable, no como aprobado', () => {
    expect(classifyAnalysisReliability(syntheticResult({ conditionEstimate: Number.NaN })).level).toBe('unreliable');
    expect(classifyAnalysisReliability(syntheticResult({ linearResidual: undefined })).level).toBe('unreliable');
  });

  it('ordena los niveles y deriva la clasificación de resultados externos', () => {
    expect(worstLevel('reliable', 'limited', 'unreliable')).toBe('unreliable');
    expect(worstLevel('reliable', 'reliable')).toBe('reliable');
    expect(isTrustedForCombination('limited')).toBe(true);
    expect(isTrustedForCombination('unreliable')).toBe(false);
    expect(isTrustedForCombination('failed')).toBe(false);
    const external = syntheticResult();
    delete external.reliability;
    expect(resolveReliability(external).level).toBe('reliable');
  });
});
