/**
 * Unlike the Portal and Cantilever methods, the Three-Moment Theorem is exact — like Double
 * Integration, it has to land on the solver's own answer, not merely agree in sign. So the gate
 * here is the same shape as `doubleIntegration.test.ts`'s: an independent closed-form check where
 * one exists (the classic equal-span case, `M = −wL²/8`, worked out by hand rather than by running
 * this module against itself), and a residual against `analyzeProject` everywhere else.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleDiagramPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { evaluate } from './polynomialAlgebra';
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

describe('solveThreeMoment', () => {
  it('el tramo de dos vanos iguales bajo carga uniforme da M = −wL²/8 en el apoyo central', () => {
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
    expect(analysis.success).toBe(true);
    const outcome = solveThreeMoment(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.classification.indeterminacy).toBe(1);
    const center = outcome.supportMoments.find((entry) => entry.nodeId === 'B')!;
    expect(center.value).toBeCloseTo((w * L * L) / 8, 6);
    expect(outcome.momentResidual).toBeLessThan(1e-6);
  });

  it('coincide con el solver en un tramo de tres vanos con luces y cargas distintas', () => {
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
    const outcome = solveThreeMoment(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.classification.indeterminacy).toBe(2);
    for (const support of outcome.supportMoments) {
      expect(support.value).toBeCloseTo(support.solverMoment, 5);
    }
    expect(outcome.momentResidual).toBeLessThan(1e-5);

    // El diagrama final —M_simple + la corrección lineal de los momentos de apoyo— tiene que
    // reproducir el diagrama del solver en todo el tramo, no sólo en los apoyos.
    const positionOf = new Map(outcome.axis.stations.map((station) => [station.nodeId, station.x]));
    for (const result of analysis.memberResults) {
      const member = project.members.find((entry) => entry.id === result.memberId)!;
      const start = positionOf.get(member.i)!;
      for (const point of result.diagram) {
        const x = start + point.x;
        const segment = outcome.segments.find((entry) => x >= entry.x0 - 1e-9 && x <= entry.x1 + 1e-9);
        expect(segment).toBeDefined();
        if (!segment) continue;
        expect(evaluate(segment.moment, x)).toBeCloseTo(point.moment, 4);
      }
    }
  });

  it('se declara no aplicable fuera de su alcance', () => {
    const frame = createDefaultProject();
    expect(solveThreeMoment(frame, analyzeProject(frame)).applicable).toBe(false);

    // Viga simple, isostática: no hay apoyo interior que narrar.
    const simple = createHibbelerStyleDiagramPractice();
    expect(solveThreeMoment(simple, analyzeProject(simple)).applicable).toBe(false);

    // Extremo empotrado: fuera del alcance de esta entrega (apoyos simples únicamente).
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
    const fixedOutcome = solveThreeMoment(fixedEnd, analyzeProject(fixedEnd));
    expect(fixedOutcome.applicable).toBe(false);
    if (fixedOutcome.applicable) return;
    expect(fixedOutcome.reasonKey).toBe('method.rejectedFixedEnd');

    // Rótula interna: se pide continuidad completa. Con dos apoyos interiores y la rótula en
    // sólo uno de ellos, todavía queda un grado de hiperestaticidad que narrar (para no confundir
    // este rechazo con «no queda apoyo interior alguno»).
    const hinged = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 }, internalHinge: true },
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
    const hingedOutcome = solveThreeMoment(hinged, analyzeProject(hinged));
    expect(hingedOutcome.applicable).toBe(false);
    if (hingedOutcome.applicable) return;
    expect(hingedOutcome.reasonKey).toBe('method.rejectedContinuityRequired');

    // Rigidez distinta dentro del mismo vano: dos miembros entre los mismos dos apoyos.
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
    const nonUniformOutcome = solveThreeMoment(nonUniform, analyzeProject(nonUniform));
    expect(nonUniformOutcome.applicable).toBe(false);
    if (nonUniformOutcome.applicable) return;
    expect(nonUniformOutcome.reasonKey).toBe('method.rejectedNonUniformSpanEI');
  });
});
