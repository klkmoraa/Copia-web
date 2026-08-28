/**
 * The gate that makes the method trustworthy.
 *
 * The report will print these numbers as a procedure a person signs. So the test does not
 * check that the algebra runs — it checks that the method lands on the answer the solver
 * already computed, on beams the solver solved independently. If the two ever diverge, the
 * method is wrong, and this is where that shows up.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleDiagramPractice, createHibbelerStyleTrussPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { solveDoubleIntegration } from './doubleIntegration';
import { evaluate } from './polynomialAlgebra';

const beam = (nodes: ProjectModel['nodes'], members: ProjectModel['members'], loads: ProjectModel['memberLoads']): ProjectModel => ({
  ...createHibbelerStyleDiagramPractice(),
  nodes,
  members,
  memberLoads: loads,
  nodalLoads: [],
});

const uniform = (memberId: string, q: number): ProjectModel['memberLoads'][number] => ({
  id: `W-${memberId}`, memberId, caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
  lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: q, qyEnd: q,
});

const FRAME = { type: 'frame' as const, E: 200e6, A: 0.01, I: 8e-5 };

describe('solveDoubleIntegration', () => {
  it('resuelve una viga biapoyada y coincide con el solver', () => {
    const project = createHibbelerStyleDiagramPractice();
    const analysis = analyzeProject(project);
    const outcome = solveDoubleIntegration(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.classification.indeterminacy).toBe(0);
    expect(outcome.redundants).toHaveLength(0);
    // Isostática: no hay redundantes, pero la flecha integrada tiene que reproducir la del
    // motor, que la obtuvo por un camino completamente distinto.
    expect(outcome.deflectionResidual).toBeLessThan(1e-9);
  });

  it('resuelve una viga empotrada-apoyada: una redundante, y da la reacción del solver', () => {
    const project = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      [{ id: 'AB', i: 'A', j: 'B', ...FRAME }],
      [uniform('AB', -10)],
    );
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const outcome = solveDoubleIntegration(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.classification.indeterminacy).toBe(1);
    expect(outcome.redundants).toHaveLength(1);
    // La solución clásica de la viga empotrada-apoyada con carga uniforme es 3qL/8.
    expect(outcome.redundants[0].value).toBeCloseTo((3 * 10 * 6) / 8, 6);
    expect(outcome.reactionResidual).toBeLessThan(1e-6);
    expect(outcome.deflectionResidual).toBeLessThan(1e-9);
  });

  it('resuelve la viga del ejemplo: empotramiento, dos rodillos y voladizo', () => {
    const project = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 9, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'D', x: 10.5, y: 0, support: { type: 'none' } },
      ],
      [
        { id: 'AB', i: 'A', j: 'B', ...FRAME },
        { id: 'BC', i: 'B', j: 'C', ...FRAME },
        { id: 'CD', i: 'C', j: 'D', ...FRAME },
      ],
      [uniform('AB', -20), uniform('BC', -20)],
    );
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const outcome = solveDoubleIntegration(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.classification.indeterminacy).toBe(2);
    expect(outcome.redundants).toHaveLength(2);
    // Dos redundantes elegidas y resueltas: cada una tiene que ser la reacción que el solver
    // reporta en ese mismo apoyo del modelo original.
    for (const redundant of outcome.redundants) {
      expect(redundant.value).toBeCloseTo(redundant.solverReaction, 6);
    }
    expect(outcome.reactionResidual).toBeLessThan(1e-6);
    expect(outcome.deflectionResidual).toBeLessThan(1e-9);
    expect(Math.abs(outcome.maxDeflection.value)).toBeGreaterThan(0);
  });

  it('respeta las condiciones que declara: cero flecha en cada apoyo, cero giro en el empotramiento', () => {
    const project = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 5, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 9, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      [
        { id: 'AB', i: 'A', j: 'B', ...FRAME },
        { id: 'BC', i: 'B', j: 'C', ...FRAME },
      ],
      [uniform('AB', -12), uniform('BC', -12)],
    );
    const analysis = analyzeProject(project);
    const outcome = solveDoubleIntegration(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    const deflectionAt = (x: number): number => {
      const segment = outcome.segments.find((entry) => x >= entry.x0 - 1e-9 && x <= entry.x1 + 1e-9)!;
      return evaluate(segment.deflection, x) / (outcome.uniformEI ? outcome.EI : 1);
    };
    for (const x of [0, 5, 9]) expect(deflectionAt(x)).toBeCloseTo(0, 9);

    const first = outcome.segments[0];
    expect(evaluate(first.slope, 0) / (outcome.uniformEI ? outcome.EI : 1)).toBeCloseTo(0, 9);
    expect(outcome.conditions.some((condition) => condition.kind === 'slope')).toBe(true);
  });

  it('se declara no aplicable en un marco y en una armadura, en vez de inventar una viga', () => {
    const frame = createDefaultProject();
    expect(solveDoubleIntegration(frame, analyzeProject(frame)).applicable).toBe(false);

    const truss = createHibbelerStyleTrussPractice();
    expect(solveDoubleIntegration(truss, analyzeProject(truss)).applicable).toBe(false);
  });
});
