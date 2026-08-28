/**
 * Like Three Moments, this is exact — it has to land on the solver's own displacement, not just
 * agree with it approximately. The gate is the direct comparison the module builds itself:
 * `virtualWork.test.ts` checks the predicted displacement at every free joint of a hand-verified
 * truss against `analyzeProject`'s own answer for the same joint.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleTrussPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { solveVirtualWork } from './virtualWork';

describe('solveVirtualWork', () => {
  it('coincide con el solver en todos los grados de libertad de la armadura 3-4-5', () => {
    const project = createHibbelerStyleTrussPractice();
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const outcome = solveVirtualWork(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    // A y B son apoyos (pasador y rodillo): sólo el ux de B y el ux/uy de C son grados libres.
    expect(outcome.displacements.map((entry) => `${entry.nodeId}.${entry.component}`).sort())
      .toEqual(['B.ux', 'C.ux', 'C.uy']);

    for (const displacement of outcome.displacements) {
      expect(displacement.value).toBeCloseTo(displacement.solverValue, 9);
    }
    expect(outcome.residual).toBeLessThan(1e-9);

    // El desplazamiento narrado con detalle es el de mayor magnitud: uy en C, hacia abajo bajo
    // la carga vertical del ejemplo.
    expect(outcome.narrated.nodeId).toBe('C');
    expect(outcome.narrated.component).toBe('uy');
    expect(outcome.narrated.total).toBeLessThan(0);
    const summed = outcome.narrated.contributions.reduce((sum, entry) => sum + entry.contribution, 0);
    expect(summed).toBeCloseTo(outcome.narrated.total, 9);
  });

  it('se declara no aplicable fuera de su alcance', () => {
    const frame = createDefaultProject();
    expect(solveVirtualWork(frame, analyzeProject(frame)).applicable).toBe(false);

    // Carga de miembro activa: rompe la axial constante que la suma Σ nNL/AE necesita.
    const withMemberLoad = createHibbelerStyleTrussPractice();
    withMemberLoad.memberLoads = [{
      id: 'W', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
      lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -2, qyEnd: -2,
    }];
    const memberLoadOutcome = solveVirtualWork(withMemberLoad, analyzeProject(withMemberLoad));
    expect(memberLoadOutcome.applicable).toBe(false);
    if (memberLoadOutcome.applicable) return;
    expect(memberLoadOutcome.reasonKey).toBe('method.rejectedMemberLoadOnTruss');

    // Sin ningún grado de libertad realmente libre: los dos nudos están totalmente empotrados
    // por su apoyo (dos pasadores), así que no hay desplazamiento que narrar.
    const rigid: ProjectModel = {
      ...createDefaultProject(),
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: 4, y: 0, support: { type: 'pin' } },
      ],
      members: [{ id: 'AB', i: 'A', j: 'B', type: 'truss', E: 200e6, A: 0.003, I: 0 }],
      nodalLoads: [],
      memberLoads: [],
    };
    const rigidAnalysis = analyzeProject(rigid);
    expect(rigidAnalysis.success).toBe(true);
    const rigidOutcome = solveVirtualWork(rigid, rigidAnalysis);
    expect(rigidOutcome.applicable).toBe(false);
    if (rigidOutcome.applicable) return;
    expect(rigidOutcome.reasonKey).toBe('method.rejectedNoFreeJoint');
  });
});
