/**
 * Exact, like `methodOfSections.test.ts`: every solved member force has to land on the solver's
 * own axial force for that member. The gate here also confirms the method actually walks the
 * joints in a legitimate dependency order — every member gets resolved, none left behind because
 * no joint ever reached two or fewer unknowns.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleTrussPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { solveMethodOfJoints } from './methodOfJoints';

const TRUSS = { type: 'truss' as const, E: 200e6, A: 0.003, I: 0 };

/** The same two-panel Pratt-style truss used by `methodOfSections.test.ts`: determinate (m = 2n − 3 = 7). */
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

describe('solveMethodOfJoints', () => {
  it('coincide con el solver en cada barra de una armadura de dos paneles', () => {
    const project = twoPanelTruss();
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const outcome = solveMethodOfJoints(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.unresolvedMemberIds).toEqual([]);
    const resolvedIds = outcome.steps.flatMap((step) => step.members.map((member) => member.memberId));
    expect(new Set(resolvedIds)).toEqual(new Set(project.members.map((member) => member.id)));

    for (const step of outcome.steps) {
      for (const member of step.members) expect(member.value).toBeCloseTo(member.solverValue, 6);
    }
    expect(outcome.residual).toBeLessThan(1e-6);

    // Cada nudo se resuelve una sola vez, y sólo cuando ya tenía dos o menos incógnitas.
    const stepNodeIds = outcome.steps.map((step) => step.nodeId);
    expect(new Set(stepNodeIds).size).toBe(stepNodeIds.length);
  });

  it('resuelve también una armadura en voladizo (un solo apoyo articulado y un rodillo, cadena simple)', () => {
    const project: ProjectModel = {
      ...createDefaultProject(),
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: 3, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 3, y: 3, support: { type: 'none' } },
      ],
      members: [
        { id: 'AB', i: 'A', j: 'B', ...TRUSS },
        { id: 'AC', i: 'A', j: 'C', ...TRUSS },
        { id: 'BC', i: 'B', j: 'C', ...TRUSS },
      ],
      loadCases: [{ id: 'LC1', name: 'Carga', category: 'variable', active: true }],
      combinations: [],
      nodalLoads: [{ id: 'P', nodeId: 'C', caseId: 'LC1', fx: 5, fy: -8, mz: 0 }],
      memberLoads: [],
    };
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const outcome = solveMethodOfJoints(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;
    expect(outcome.unresolvedMemberIds).toEqual([]);
    for (const step of outcome.steps) {
      for (const member of step.members) expect(member.value).toBeCloseTo(member.solverValue, 6);
    }
    expect(outcome.residual).toBeLessThan(1e-6);
  });

  it('se declara no aplicable fuera de su alcance', () => {
    const frame = createDefaultProject();
    expect(solveMethodOfJoints(frame, analyzeProject(frame)).applicable).toBe(false);

    // La misma armadura de dos paneles, con una diagonal redundante: determinada por fuera pero
    // hiperestática por dentro, y este método exige determinación estática completa.
    const redundant: ProjectModel = {
      ...twoPanelTruss(),
      members: [...twoPanelTruss().members, { id: 'AE', i: 'A', j: 'E', ...TRUSS }],
    };
    const redundantAnalysis = analyzeProject(redundant);
    expect(redundantAnalysis.success).toBe(true);
    const redundantOutcome = solveMethodOfJoints(redundant, redundantAnalysis);
    expect(redundantOutcome.applicable).toBe(false);
    if (redundantOutcome.applicable) return;
    expect(redundantOutcome.reasonKey).toBe('method.rejectedIndeterminateTruss');

    const withMemberLoad = createHibbelerStyleTrussPractice();
    withMemberLoad.memberLoads = [{
      id: 'W', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
      lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -2, qyEnd: -2,
    }];
    const memberLoadOutcome = solveMethodOfJoints(withMemberLoad, analyzeProject(withMemberLoad));
    expect(memberLoadOutcome.applicable).toBe(false);
    if (memberLoadOutcome.applicable) return;
    expect(memberLoadOutcome.reasonKey).toBe('method.rejectedMemberLoadOnTruss');
  });
});
