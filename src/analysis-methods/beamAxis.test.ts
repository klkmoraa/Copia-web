/**
 * Everything the method derives sits on top of this translation, so it is checked against the
 * solver's own sampled diagram rather than against my algebra: if a member captured backwards
 * were mirrored here, every deflection downstream would be wrong and nothing else would notice.
 */
import { describe, expect, it } from 'vitest';
import { createHibbelerStyleDiagramPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { classifyStructure } from './structureClassification';
import { buildBeamAxis } from './beamAxis';
import { evaluate } from './polynomialAlgebra';

/** Moment at a global station, read from whichever segment covers it. */
const momentAt = (axis: NonNullable<ReturnType<typeof buildBeamAxis>>, x: number): number => {
  const segment = axis.segments.find((entry) => x >= entry.x0 - 1e-9 && x <= entry.x1 + 1e-9);
  return segment ? evaluate(segment.moment, x) : Number.NaN;
};

const continuousBeam = (reversed: boolean): ProjectModel => ({
  ...createHibbelerStyleDiagramPractice(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 4, y: 0, support: { type: 'none' } },
    { id: 'C', x: 9, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [
    { id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
    // El segundo miembro se declara al revés a propósito en una de las variantes.
    reversed
      ? { id: 'BC', i: 'C', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 }
      : { id: 'BC', i: 'B', j: 'C', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
  ],
  memberLoads: [
    { id: 'W', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -5, qyEnd: -5 },
  ],
  nodalLoads: [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -20, mz: 0 }],
});

describe('buildBeamAxis', () => {
  it.each([['declarada a favor del eje', false], ['con un miembro al revés', true]] as const)(
    'reproduce el momento muestreado del motor, %s',
    (_label, reversed) => {
      const project = continuousBeam(reversed);
      const analysis = analyzeProject(project);
      expect(analysis.success).toBe(true);
      const axis = buildBeamAxis(project, analysis, classifyStructure(project).axisNodeIds);
      expect(axis).toBeDefined();
      expect(axis!.length).toBeCloseTo(9, 9);

      // El motor publica su propio diagrama muestreado por miembro, en coordenada local desde
      // el nodo i. El eje global tiene que dar el mismo momento en la misma posición física —
      // con el signo del eje, que un miembro invertido no comparte.
      const position = new Map([['A', 0], ['B', 4], ['C', 9]]);
      for (const result of analysis.memberResults) {
        const member = project.members.find((entry) => entry.id === result.memberId)!;
        const start = position.get(member.i)!;
        const forward = position.get(member.j)! > start;
        for (const point of result.diagram) {
          const global = forward ? start + point.x : start - point.x;
          const expected = forward ? point.moment : -point.moment;
          expect(momentAt(axis!, global)).toBeCloseTo(expected, 6);
        }
      }
    },
  );

  it('no espeja un miembro declarado contra el eje', () => {
    const forward = continuousBeam(false);
    const backward = continuousBeam(true);
    const axisForward = buildBeamAxis(forward, analyzeProject(forward), classifyStructure(forward).axisNodeIds)!;
    const axisBackward = buildBeamAxis(backward, analyzeProject(backward), classifyStructure(backward).axisNodeIds)!;
    // Es la misma viga escrita de dos maneras: el momento en cada estación debe coincidir.
    for (const x of [0, 1, 2, 3.5, 4, 5, 6.5, 8, 9]) {
      expect(momentAt(axisBackward, x)).toBeCloseTo(momentAt(axisForward, x), 6);
    }
  });

  it('detecta rigidez uniforme y la distingue de una viga escalonada', () => {
    const project = continuousBeam(false);
    const axis = buildBeamAxis(project, analyzeProject(project), classifyStructure(project).axisNodeIds)!;
    expect(axis.uniformEI).toBe(true);

    const stepped: ProjectModel = {
      ...project,
      members: project.members.map((member, index) => (index === 1 ? { ...member, I: 2e-4 } : member)),
    };
    const steppedAxis = buildBeamAxis(stepped, analyzeProject(stepped), classifyStructure(stepped).axisNodeIds)!;
    expect(steppedAxis.uniformEI).toBe(false);
  });
});
