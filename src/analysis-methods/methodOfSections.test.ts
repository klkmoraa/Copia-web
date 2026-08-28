/**
 * Exact, like `virtualWork.ts` and `castiglianoTruss.ts`: every solved member force has to land
 * on the solver's own axial force for that member. The gate here also confirms the method is
 * doing what it claims to — cutting a genuine section through the truss, not just re-deriving
 * joint equilibrium one node at a time, which would be a legitimate special case but not what
 * "the Method of Sections" is supposed to demonstrate.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleTrussPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { solveMethodOfSections } from './methodOfSections';

const TRUSS = { type: 'truss' as const, E: 200e6, A: 0.003, I: 0 };

/** A two-panel Pratt-style truss: determinate (m = 2n − 3 = 7), wide enough for a real section. */
const twoPanelTruss = (): ProjectModel => ({
  ...createDefaultProject(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 4, y: 0, support: { type: 'none' } },
    { id: 'C', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'D', x: 2, y: 3, support: { type: 'none' } },
    { id: 'E', x: 6, y: 3, support: { type: 'none' } },
  ],
  members: [
    { id: 'AB', i: 'A', j: 'B', ...TRUSS },
    { id: 'BC', i: 'B', j: 'C', ...TRUSS },
    { id: 'DE', i: 'D', j: 'E', ...TRUSS },
    { id: 'AD', i: 'A', j: 'D', ...TRUSS },
    { id: 'BD', i: 'B', j: 'D', ...TRUSS },
    { id: 'BE', i: 'B', j: 'E', ...TRUSS },
    { id: 'CE', i: 'C', j: 'E', ...TRUSS },
  ],
  loadCases: [{ id: 'LC1', name: 'Carga vertical', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [{ id: 'P', nodeId: 'D', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }],
  memberLoads: [],
});

describe('solveMethodOfSections', () => {
  it('coincide con el solver en cada barra de una armadura de dos paneles', () => {
    const project = twoPanelTruss();
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const outcome = solveMethodOfSections(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.unresolvedMemberIds).toEqual([]);
    const resolvedIds = outcome.cuts.flatMap((cut) => cut.members.map((member) => member.memberId));
    expect(new Set(resolvedIds)).toEqual(new Set(project.members.map((member) => member.id)));

    for (const cut of outcome.cuts) {
      for (const member of cut.members) expect(member.value).toBeCloseTo(member.solverValue, 6);
    }
    expect(outcome.residual).toBeLessThan(1e-6);

    // Al menos un corte tiene que dejar más de un nudo en el lado conservado — si todos
    // isolaran un único nudo, esto sería en el fondo el método de los nudos, no el de cortes.
    expect(outcome.cuts.some((cut) => cut.keptNodeIds.length > 1)).toBe(true);
  });

  it('se declara no aplicable fuera de su alcance', () => {
    const frame = createDefaultProject();
    expect(solveMethodOfSections(frame, analyzeProject(frame)).applicable).toBe(false);

    // La misma armadura de dos paneles, con una barra de más (una diagonal redundante): sigue
    // siendo determinada por fuera pero hiperestática por dentro, y este método exige
    // determinación estática completa.
    const redundant: ProjectModel = {
      ...twoPanelTruss(),
      members: [...twoPanelTruss().members, { id: 'AE', i: 'A', j: 'E', ...TRUSS }],
    };
    const redundantAnalysis = analyzeProject(redundant);
    expect(redundantAnalysis.success).toBe(true);
    const redundantOutcome = solveMethodOfSections(redundant, redundantAnalysis);
    expect(redundantOutcome.applicable).toBe(false);
    if (redundantOutcome.applicable) return;
    expect(redundantOutcome.reasonKey).toBe('method.rejectedIndeterminateTruss');

    const withMemberLoad = createHibbelerStyleTrussPractice();
    withMemberLoad.memberLoads = [{
      id: 'W', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
      lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -2, qyEnd: -2,
    }];
    const memberLoadOutcome = solveMethodOfSections(withMemberLoad, analyzeProject(withMemberLoad));
    expect(memberLoadOutcome.applicable).toBe(false);
    if (memberLoadOutcome.applicable) return;
    expect(memberLoadOutcome.reasonKey).toBe('method.rejectedMemberLoadOnTruss');
  });
});
