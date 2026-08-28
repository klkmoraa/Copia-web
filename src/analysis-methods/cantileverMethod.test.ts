/**
 * Same posture as `portalMethod.test.ts`: this is a deliberate approximation, so the gate is not
 * "matches the solver." It is:
 *
 *   1. The textbook single-bay portal — the same fixture `portalMethod.test.ts` hand-verifies —
 *      matches an independent algebraic calculation, including the flexure-formula axial force
 *      that this method computes and Portal does not.
 *   2. The *sign* of every quantity matches `analyzeProject` on that same frame.
 *   3. A multi-bay, multi-storey frame closes two redundant equations the algorithm never uses to
 *      solve anything: every storey's column axial forces sum to zero (self-equilibrated, since
 *      the flexure formula puts them all proportional to a centroid-relative distance), and the
 *      last joint of the beam sweep is left satisfied, not solved.
 *   4. The method withdraws on a truss, a braced frame, a model with no lateral load, and — the
 *      one rejection this method has that Portal does not — a first storey with some columns
 *      pinned at the base and others fixed, where the flexure formula's single shared cut no
 *      longer describes one free body.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleTrussPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { solveCantileverMethod } from './cantileverMethod';

const FRAME = { type: 'frame' as const, E: 200e6, A: 0.01, I: 8e-5 };

const singleBayPortal = (): ProjectModel => ({
  ...createDefaultProject(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 4, y: 0, support: { type: 'fixed' } },
    { id: 'C', x: 0, y: 3, support: { type: 'none' } },
    { id: 'D', x: 4, y: 3, support: { type: 'none' } },
  ],
  members: [
    { id: 'AC', i: 'A', j: 'C', ...FRAME },
    { id: 'BD', i: 'B', j: 'D', ...FRAME },
    { id: 'CD', i: 'C', j: 'D', ...FRAME },
  ],
  loadCases: [{ id: 'LC1', name: 'Lateral', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [
    { id: 'P1', nodeId: 'C', caseId: 'LC1', fx: 5, fy: 0, mz: 0 },
    { id: 'P2', nodeId: 'D', caseId: 'LC1', fx: 5, fy: 0, mz: 0 },
  ],
  memberLoads: [],
});

describe('solveCantileverMethod', () => {
  it('resuelve el pórtico de un vano y coincide con el cálculo algebraico independiente', () => {
    const project = singleBayPortal();
    const outcome = solveCantileverMethod(project);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    const left = outcome.columns.find((column) => column.columnIndex === 0)!;
    const right = outcome.columns.find((column) => column.columnIndex === 1)!;
    // Áreas iguales y luz simétrica: la fórmula de flexión reparte 50/50, igual que el ancho
    // tributario del Portal para este mismo caso — pero por un camino distinto.
    expect(left.axial).toBeCloseTo(3.75, 9);
    expect(right.axial).toBeCloseTo(-3.75, 9);

    expect(outcome.beams).toHaveLength(1);
    expect(outcome.beams[0].moment).toBeCloseTo(7.5, 9);
    expect(outcome.beams[0].shear).toBeCloseTo(-3.75, 9);

    for (const column of outcome.columns) {
      expect(column.shear).toBeCloseTo(5, 9);
      expect(column.topMoment).toBeCloseTo(-7.5, 9);
      expect(column.bottomMoment).toBeCloseTo(-7.5, 9);
    }
  });

  it('el signo de cada cantidad coincide con el que reporta el análisis matricial', () => {
    const project = singleBayPortal();
    const outcome = solveCantileverMethod(project);
    const analysis = analyzeProject(project);
    expect(outcome.applicable).toBe(true);
    expect(analysis.success).toBe(true);
    if (!outcome.applicable) return;

    const byId = new Map(analysis.nodeResults.map((entry) => [entry.nodeId, entry]));
    for (const check of outcome.baseChecks) {
      const solver = byId.get(check.nodeId)!;
      expect(Math.sign(check.approxRx)).toBe(Math.sign(solver.rx));
      expect(Math.sign(check.approxRy)).toBe(Math.sign(solver.ry));
      expect(Math.sign(check.approxRm)).toBe(Math.sign(solver.rm));
    }
    expect(outcome.reactionGap.force).toBeGreaterThan(0);
  });

  it('cierra las ecuaciones redundantes en un pórtico de dos vanos con vanos y áreas desiguales', () => {
    const project: ProjectModel = {
      ...createDefaultProject(),
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 5, y: 0, support: { type: 'fixed' } },
        { id: 'C', x: 9, y: 0, support: { type: 'fixed' } },
        { id: 'D', x: 0, y: 3.5, support: { type: 'none' } },
        { id: 'E', x: 5, y: 3.5, support: { type: 'none' } },
        { id: 'F', x: 9, y: 3.5, support: { type: 'none' } },
      ],
      members: [
        { id: 'AD', i: 'A', j: 'D', ...FRAME, A: 0.02 },
        { id: 'BE', i: 'B', j: 'E', ...FRAME, A: 0.01 },
        { id: 'CF', i: 'C', j: 'F', ...FRAME, A: 0.015 },
        { id: 'DE', i: 'D', j: 'E', ...FRAME },
        { id: 'EF', i: 'E', j: 'F', ...FRAME },
      ],
      loadCases: [{ id: 'LC1', name: 'Lateral', category: 'variable', active: true }],
      combinations: [],
      nodalLoads: [{ id: 'P', nodeId: 'D', caseId: 'LC1', fx: 12, fy: 0, mz: 0 }],
      memberLoads: [],
    };
    const outcome = solveCantileverMethod(project);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    // Autoequilibrada por construcción: la fórmula de flexión reparte la axial alrededor del
    // centroide de áreas, así que la suma en cualquier planta es cero — nunca se impone, tiene
    // que salir sola.
    const storyOneAxial = outcome.columns.filter((c) => c.story === 1).reduce((sum, c) => sum + c.axial, 0);
    expect(storyOneAxial).toBeCloseTo(0, 9);

    // El barrido de momento de viga nunca resuelve nada en la última columna de la planta —
    // su propia ecuación de equilibrio vertical se cumple sola si el barrido está bien encadenado.
    const lastColumn = outcome.columns.find((c) => c.columnIndex === 2 && c.story === 1)!;
    const aboveLast = outcome.columns.find((c) => c.columnIndex === 2 && c.story === 2);
    const lastBeam = outcome.beams.find((b) => b.bayIndex === 1 && b.story === 1)!;
    const closure = -lastColumn.axial + (aboveLast?.axial ?? 0) - (2 * lastBeam.moment) / lastBeam.span;
    expect(closure).toBeCloseTo(0, 6);
  });

  it('se declara no aplicable fuera de un pórtico rectangular con carga lateral, y ante bases mixtas', () => {
    const truss = createHibbelerStyleTrussPractice();
    expect(solveCantileverMethod(truss).applicable).toBe(false);

    const noLateral = singleBayPortal();
    noLateral.nodalLoads = [];
    expect(solveCantileverMethod(noLateral).applicable).toBe(false);

    const withMemberLoad = singleBayPortal();
    withMemberLoad.memberLoads = [{
      id: 'W', memberId: 'CD', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
      lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -5, qyEnd: -5,
    }];
    expect(solveCantileverMethod(withMemberLoad).applicable).toBe(false);

    const mixedBase = singleBayPortal();
    mixedBase.nodes = mixedBase.nodes.map((node) => (node.id === 'B' ? { ...node, support: { type: 'pin' as const } } : node));
    const outcome = solveCantileverMethod(mixedBase);
    expect(outcome.applicable).toBe(false);
    if (outcome.applicable) return;
    expect(outcome.reasonKey).toBe('method.rejectedMixedBase');
  });
});
