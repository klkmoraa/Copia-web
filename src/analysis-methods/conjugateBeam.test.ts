/**
 * The gate that makes the method trustworthy.
 *
 * The report will print these numbers as a procedure a person signs. So the test does not
 * check that the algebra runs — it checks that the method lands on the answer the solver
 * already computed, on beams the solver solved independently, and that it declines the beams
 * its conjugate-support table cannot honestly convert.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleDiagramPractice, createHibbelerStyleTrussPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { solveConjugateBeam } from './conjugateBeam';

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

describe('solveConjugateBeam', () => {
  it('resuelve una viga biapoyada: dos apoyos simples, conjugado simple en ambos extremos', () => {
    const project = createHibbelerStyleDiagramPractice();
    const analysis = analyzeProject(project);
    const outcome = solveConjugateBeam(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.classification.indeterminacy).toBe(0);
    for (const end of outcome.ends) {
      expect(end.realKind).toBe('simple');
      expect(end.conjugateKind).toBe('simple');
      expect(end.reactionForce).toBeDefined();
      expect(end.reactionMoment).toBeUndefined();
    }
    expect(outcome.deflectionResidual).toBeLessThan(1e-9);
    expect(outcome.slopeResidual).toBeLessThan(1e-9);
  });

  it('resuelve un voladizo: empotramiento real se convierte en extremo libre del conjugado', () => {
    const project = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 4, y: 0, support: { type: 'none' } },
      ],
      [{ id: 'AB', i: 'A', j: 'B', ...FRAME }],
      [uniform('AB', -10)],
    );
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const outcome = solveConjugateBeam(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    const [fixedEnd, freeEnd] = outcome.ends;
    expect(fixedEnd.realKind).toBe('fixed');
    expect(fixedEnd.conjugateKind).toBe('free');
    expect(fixedEnd.reactionForce).toBeUndefined();
    expect(fixedEnd.reactionMoment).toBeUndefined();

    expect(freeEnd.realKind).toBe('free');
    expect(freeEnd.conjugateKind).toBe('fixed');
    expect(freeEnd.reactionForce).toBeDefined();
    expect(freeEnd.reactionMoment).toBeDefined();

    // La reacción de momento del conjugado en la punta es la flecha real ahí: tiene que
    // coincidir con lo que el propio solver reporta en ese nudo.
    const tip = analysis.nodeResults.find((entry) => entry.nodeId === 'B');
    expect(tip).toBeDefined();
    expect(freeEnd.reactionMoment).toBeCloseTo(tip!.uy, 6);
    expect(Math.abs(freeEnd.reactionMoment ?? 0)).toBeGreaterThan(0);
    expect(outcome.deflectionResidual).toBeLessThan(1e-9);
    expect(outcome.slopeResidual).toBeLessThan(1e-9);
  });

  it('respeta la continuidad entre varios miembros sin apoyo interior', () => {
    const project = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: 3, y: 0, support: { type: 'none' } },
        { id: 'C', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      [
        { id: 'AB', i: 'A', j: 'B', ...FRAME },
        { id: 'BC', i: 'B', j: 'C', ...FRAME },
      ],
      [uniform('AB', -8), uniform('BC', -8)],
    );
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const outcome = solveConjugateBeam(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    expect(outcome.segments).toHaveLength(2);
    expect(outcome.conditions.some((condition) => condition.kind === 'continuity')).toBe(true);
    expect(outcome.deflectionResidual).toBeLessThan(1e-9);
    expect(outcome.slopeResidual).toBeLessThan(1e-9);
    expect(Math.abs(outcome.maxDeflection.value)).toBeGreaterThan(0);
  });

  it('se declara no aplicable en un marco y en una armadura', () => {
    const frame = createDefaultProject();
    expect(solveConjugateBeam(frame, analyzeProject(frame)).applicable).toBe(false);

    const truss = createHibbelerStyleTrussPractice();
    expect(solveConjugateBeam(truss, analyzeProject(truss)).applicable).toBe(false);
  });

  it('se declara no aplicable en una viga hiperestática', () => {
    const project = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      [{ id: 'AB', i: 'A', j: 'B', ...FRAME }],
      [uniform('AB', -10)],
    );
    const analysis = analyzeProject(project);
    const outcome = solveConjugateBeam(project, analysis);
    expect(outcome.applicable).toBe(false);
    if (outcome.applicable) return;
    expect(outcome.reasonKey).toBe('method.rejectedIndeterminateConjugate');
  });

  it('se declara no aplicable con un apoyo interior, aunque el conjunto sea isostático', () => {
    // A, B y C restringen la traslación (3 grados), pero la rótula en B lo devuelve a g = 0:
    // isostática en conjunto, y sin embargo hay un apoyo entre los dos extremos.
    const project = beam(
      [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: 5, y: 0, support: { type: 'roller', angleDeg: 90 }, internalHinge: true },
        { id: 'C', x: 10, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      [
        { id: 'AB', i: 'A', j: 'B', ...FRAME },
        { id: 'BC', i: 'B', j: 'C', ...FRAME },
      ],
      [uniform('AB', -6), uniform('BC', -6)],
    );
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const outcome = solveConjugateBeam(project, analysis);
    expect(outcome.applicable).toBe(false);
    if (outcome.applicable) return;
    expect(outcome.reasonKey).toBe('method.rejectedInteriorSupportConjugate');
  });
});
