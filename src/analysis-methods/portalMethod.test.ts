/**
 * The Portal Method is a deliberate approximation, so this gate is not "does it match the
 * solver" the way `doubleIntegration.test.ts` is. It is:
 *
 *   1. Every hand-computed number for the textbook single-bay portal matches a value worked out
 *      independently by algebra (not by running this module against itself).
 *   2. The *sign* of every quantity — which column goes into tension, which way each beam and
 *      column moment points — matches `analyzeProject` on the same frame, because a method that
 *      got the direction wrong would mislead a reader even though it is only approximate on
 *      magnitude.
 *   3. Multi-bay joint equilibrium actually closes: the redundant equation at the last joint of
 *      a storey is satisfied, which is the thing that would break first if an index were wrong.
 *   4. The method withdraws — rather than narrates nonsense — on a truss, a frame with a brace,
 *      a setback, or a model with no lateral load to speak of.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleTrussPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { solvePortalMethod } from './portalMethod';

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

describe('solvePortalMethod', () => {
  it('resuelve el pórtico de un vano y coincide con el cálculo algebraico independiente', () => {
    const project = singleBayPortal();
    const outcome = solvePortalMethod(project);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.storyShear).toEqual([10]);
    for (const column of outcome.columns) {
      expect(column.shear).toBeCloseTo(5, 9);
      expect(column.inflectionFraction).toBeCloseTo(0.5, 9);
      expect(column.bottomMoment).toBeCloseTo(-7.5, 9);
      expect(column.topMoment).toBeCloseTo(-7.5, 9);
    }
    expect(outcome.beams).toHaveLength(1);
    expect(outcome.beams[0].moment).toBeCloseTo(7.5, 9);
    expect(outcome.beams[0].shear).toBeCloseTo(-3.75, 9);

    const left = outcome.columns.find((column) => column.columnIndex === 0)!;
    const right = outcome.columns.find((column) => column.columnIndex === 1)!;
    expect(left.axial).toBeCloseTo(3.75, 9);
    expect(right.axial).toBeCloseTo(-3.75, 9);
  });

  it('el signo de cada cantidad coincide con el que reporta el análisis matricial', () => {
    const project = singleBayPortal();
    const outcome = solvePortalMethod(project);
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
    // La carga se repartió simétricamente entre ambos nudos de cubierta, así que el corte por
    // columna del método es exacto para este caso particular: sin aproximación de por medio.
    expect(outcome.baseChecks[0].approxRx).toBeCloseTo(byId.get('A')!.rx, 9);
    // La axial y el momento sí son aproximados por diseño: se declara la brecha, no se exige que desaparezca.
    expect(outcome.reactionGap.force).toBeGreaterThan(0);
    expect(outcome.reactionGap.moment).toBeGreaterThan(0);
  });

  it('cierra el equilibrio de nudo en un pórtico de dos vanos con vanos desiguales', () => {
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
        { id: 'AD', i: 'A', j: 'D', ...FRAME },
        { id: 'BE', i: 'B', j: 'E', ...FRAME },
        { id: 'CF', i: 'C', j: 'F', ...FRAME },
        { id: 'DE', i: 'D', j: 'E', ...FRAME },
        { id: 'EF', i: 'E', j: 'F', ...FRAME },
      ],
      loadCases: [{ id: 'LC1', name: 'Lateral', category: 'variable', active: true }],
      combinations: [],
      nodalLoads: [{ id: 'P', nodeId: 'D', caseId: 'LC1', fx: 12, fy: 0, mz: 0 }],
      memberLoads: [],
    };
    const outcome = solvePortalMethod(project);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    // El corte de piso se reparte entre las tres columnas por ancho tributario y tiene que sumar
    // exactamente la carga aplicada.
    const totalShear = outcome.columns.filter((c) => c.story === 1).reduce((sum, c) => sum + c.shear, 0);
    expect(totalShear).toBeCloseTo(12, 9);

    // La ecuación de equilibrio del último nudo de la planta no se resuelve para nada — se
    // cumple sola si los índices de vano/columna están bien encadenados.
    const last = outcome.columns.find((c) => c.columnIndex === 2 && c.story === 1)!;
    const lastBeam = outcome.beams.find((b) => b.bayIndex === 1 && b.story === 1)!;
    expect(last.topMoment + lastBeam.moment).toBeCloseTo(0, 9);
  });

  it('se declara no aplicable fuera de un pórtico rectangular con carga lateral', () => {
    const truss = createHibbelerStyleTrussPractice();
    expect(solvePortalMethod(truss).applicable).toBe(false);

    const braced: ProjectModel = {
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
        { id: 'BRACE', i: 'A', j: 'D', ...FRAME },
      ],
      nodalLoads: [{ id: 'P', nodeId: 'C', caseId: 'LC1', fx: 10, fy: 0, mz: 0 }],
    };
    expect(solvePortalMethod(braced).applicable).toBe(false);

    const noLateral = singleBayPortal();
    noLateral.nodalLoads = [];
    expect(solvePortalMethod(noLateral).applicable).toBe(false);

    const withMemberLoad = singleBayPortal();
    withMemberLoad.memberLoads = [{
      id: 'W', memberId: 'CD', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
      lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -5, qyEnd: -5,
    }];
    expect(solvePortalMethod(withMemberLoad).applicable).toBe(false);
  });
});
