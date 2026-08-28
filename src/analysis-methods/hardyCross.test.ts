/**
 * Exact, like Three Moments — and reaching the same equations by a completely different route
 * (iterative balancing instead of a linear system), so the strongest check available is that the
 * two methods agree with *each other*, not only with the solver.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleDiagramPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { solveHardyCross } from './hardyCross';
import { solveThreeMoment } from './threeMoment';

const FRAME = { type: 'frame' as const, E: 200e6, A: 0.01, I: 8e-5 };

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

describe('solveHardyCross', () => {
  it('el tramo de dos vanos iguales bajo carga uniforme converge a M = −wL²/8 en el apoyo central', () => {
    const L = 6;
    const w = -10;
    const project = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 2 * L, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      [
        { id: 'AB', i: 'A', j: 'B', ...FRAME },
        { id: 'BC', i: 'B', j: 'C', ...FRAME },
      ],
      [uniform('AB', w), uniform('BC', w)],
    );
    const analysis = analyzeProject(project);
    const outcome = solveHardyCross(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    const center = outcome.joints.find((entry) => entry.nodeId === 'B')!;
    expect(center.value).toBeCloseTo((w * L * L) / 8, 6);
    expect(outcome.momentResidual).toBeLessThan(1e-6);
    // Simétrico: los momentos de empotramiento perfecto de los dos vanos ya se cancelan al
    // liberar los extremos, así que converge sin necesitar ninguna pasada de reparto.
    expect(outcome.iterationCount).toBeGreaterThanOrEqual(0);
  });

  it('converge a los mismos momentos de apoyo que el Teorema de los Tres Momentos, por un camino distinto', () => {
    const project = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 9, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'D', x: 15, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      [
        { id: 'AB', i: 'A', j: 'B', ...FRAME },
        { id: 'BC', i: 'B', j: 'C', ...FRAME },
        { id: 'CD', i: 'C', j: 'D', ...FRAME },
      ],
      [uniform('AB', -15), uniform('BC', -8), uniform('CD', -20)],
    );
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const hardyCross = solveHardyCross(project, analysis);
    const threeMoment = solveThreeMoment(project, analysis);
    expect(hardyCross.applicable).toBe(true);
    expect(threeMoment.applicable).toBe(true);
    if (!hardyCross.applicable || !threeMoment.applicable) return;

    for (const joint of hardyCross.joints) {
      expect(joint.value).toBeCloseTo(joint.solverMoment, 5);
      const same = threeMoment.supportMoments.find((entry) => entry.nodeId === joint.nodeId)!;
      expect(joint.value).toBeCloseTo(same.value, 5);
    }
    expect(hardyCross.momentResidual).toBeLessThan(1e-5);
    // Vanos y cargas desiguales: aquí sí hace falta reparto y acarreo genuinos.
    expect(hardyCross.iterationCount).toBeGreaterThan(0);

    // El diagrama final reconstruido reproduce el del solver en todo el tramo, no sólo en los
    // apoyos — la misma comprobación punto a punto que hace threeMoment.test.ts.
    const positionOf = new Map(hardyCross.axis.stations.map((station) => [station.nodeId, station.x]));
    for (const result of analysis.memberResults) {
      const member = project.members.find((entry) => entry.id === result.memberId)!;
      const start = positionOf.get(member.i)!;
      for (const point of result.diagram) {
        const x = start + point.x;
        const segment = hardyCross.segments.find((entry) => x >= entry.x0 - 1e-9 && x <= entry.x1 + 1e-9);
        expect(segment).toBeDefined();
        if (!segment) continue;
        const value = segment.moment.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0);
        expect(value).toBeCloseTo(point.moment, 4);
      }
    }
  });

  it('se declara no aplicable fuera de su alcance', () => {
    const frame = createDefaultProject();
    expect(solveHardyCross(frame, analyzeProject(frame)).applicable).toBe(false);

    const simple = createHibbelerStyleDiagramPractice();
    expect(solveHardyCross(simple, analyzeProject(simple)).applicable).toBe(false);

    const fixedEnd = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 5, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 10, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      [
        { id: 'AB', i: 'A', j: 'B', ...FRAME },
        { id: 'BC', i: 'B', j: 'C', ...FRAME },
      ],
      [uniform('AB', -10), uniform('BC', -10)],
    );
    const fixedOutcome = solveHardyCross(fixedEnd, analyzeProject(fixedEnd));
    expect(fixedOutcome.applicable).toBe(false);
    if (fixedOutcome.applicable) return;
    expect(fixedOutcome.reasonKey).toBe('method.rejectedFixedEnd');

    const nonUniform = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'M', x: 2.5, y: 0, support: { type: 'none' } },
        { id: 'B', x: 5, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 10, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      [
        { id: 'AM', i: 'A', j: 'M', ...FRAME },
        { id: 'MB', i: 'M', j: 'B', ...FRAME, I: FRAME.I * 3 },
        { id: 'BC', i: 'B', j: 'C', ...FRAME },
      ],
      [uniform('AM', -10), uniform('MB', -10), uniform('BC', -10)],
    );
    const nonUniformOutcome = solveHardyCross(nonUniform, analyzeProject(nonUniform));
    expect(nonUniformOutcome.applicable).toBe(false);
    if (nonUniformOutcome.applicable) return;
    expect(nonUniformOutcome.reasonKey).toBe('method.rejectedNonUniformSpanEI');
  });
});
