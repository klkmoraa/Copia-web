/**
 * Exact, like Three Moments and Virtual Work: this has to land on the solver's own reactions and
 * member forces for a statically indeterminate truss, not merely agree with them approximately.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleTrussPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { solveCastiglianoTruss } from './castiglianoTruss';

const TRUSS = { type: 'truss' as const, E: 200e6, A: 0.003, I: 0 };

/** The 3-4-5 practice triangle, but with a fourth reaction component at C: one redundant. */
const redundantTriangle = (angleDeg = 90): ProjectModel => ({
  ...createHibbelerStyleTrussPractice(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'C', x: 3, y: 4, support: { type: 'roller', angleDeg } },
  ],
});

describe('solveCastiglianoTruss', () => {
  it('coincide con el solver en reacciones redundantes y fuerzas de barra de una armadura externamente indeterminada', () => {
    const project = redundantTriangle();
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const outcome = solveCastiglianoTruss(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.classification.indeterminacy).toBe(1);
    expect(outcome.redundants).toHaveLength(1);
    for (const redundant of outcome.redundants) {
      expect(redundant.value).toBeCloseTo(redundant.solverReaction, 6);
    }
    expect(outcome.reactionResidual).toBeLessThan(1e-6);

    for (const member of outcome.members) {
      expect(member.force).toBeCloseTo(member.solverForce, 6);
    }
    expect(outcome.forceResidual).toBeLessThan(1e-6);
  });

  it('se declara no aplicable fuera de su alcance', () => {
    const frame = createDefaultProject();
    expect(solveCastiglianoTruss(frame, analyzeProject(frame)).applicable).toBe(false);

    // La misma armadura, sin el apoyo extra: es determinada, no hay redundante que narrar.
    const determinate = createHibbelerStyleTrussPractice();
    const determinateOutcome = solveCastiglianoTruss(determinate, analyzeProject(determinate));
    expect(determinateOutcome.applicable).toBe(false);
    if (determinateOutcome.applicable) return;
    expect(determinateOutcome.reasonKey).toBe('method.rejectedDeterminateTruss');

    // Rodillo oblicuo en el apoyo redundante: ni ux ni uy son el grado libre real.
    const oblique = redundantTriangle(45);
    const obliqueOutcome = solveCastiglianoTruss(oblique, analyzeProject(oblique));
    expect(obliqueOutcome.applicable).toBe(false);
    if (obliqueOutcome.applicable) return;
    expect(obliqueOutcome.reasonKey).toBe('method.rejectedObliqueSupport');

    // Cuadrado arriostrado con las dos diagonales: exactamente 3 reacciones (determinado por
    // fuera), pero un miembro de más para la rigidez interna — la indeterminación es de barra,
    // no de reacción, y esta entrega no elige qué barra cortar.
    const bracedSquare: ProjectModel = {
      ...createDefaultProject(),
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 4, y: 3, support: { type: 'none' } },
        { id: 'D', x: 0, y: 3, support: { type: 'none' } },
      ],
      members: [
        { id: 'AB', i: 'A', j: 'B', ...TRUSS },
        { id: 'BC', i: 'B', j: 'C', ...TRUSS },
        { id: 'CD', i: 'C', j: 'D', ...TRUSS },
        { id: 'DA', i: 'D', j: 'A', ...TRUSS },
        { id: 'AC', i: 'A', j: 'C', ...TRUSS },
        { id: 'BD', i: 'B', j: 'D', ...TRUSS },
      ],
      loadCases: [{ id: 'LC1', name: 'Lateral', category: 'variable', active: true }],
      combinations: [],
      nodalLoads: [{ id: 'P', nodeId: 'D', caseId: 'LC1', fx: 10, fy: 0, mz: 0 }],
      memberLoads: [],
    };
    const bracedAnalysis = analyzeProject(bracedSquare);
    expect(bracedAnalysis.success).toBe(true);
    const bracedOutcome = solveCastiglianoTruss(bracedSquare, bracedAnalysis);
    expect(bracedOutcome.applicable).toBe(false);
    if (bracedOutcome.applicable) return;
    expect(bracedOutcome.reasonKey).toBe('method.rejectedInternalRedundancy');
  });
});
