import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import { buildExactDiagrams, evaluateDiagramAt } from './diagram';
import { analyzeProjectScenarios, buildDiagramEnvelope, evaluateEnvelopeAt } from './envelope';
import { summarizeAnalysisResults } from './resultSummary';
import { analyzeProject } from './solver';

const close = (actual: number, expected: number, tolerance = 1e-9) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));
};

const beamWithConcentratedActions = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'discontinuity',
  name: 'Viga con acciones concentradas',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }],
  loadCases: [
    { id: 'P', name: 'Puntual', category: 'variable', active: true },
    { id: 'M', name: 'Momento', category: 'variable', active: true },
  ],
  combinations: [{ id: 'C', name: 'Combinada', factors: { P: 1, M: 1 } }],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [
    { id: 'PL', memberId: 'AB', caseId: 'P', type: 'point', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: -20 },
    { id: 'MC', memberId: 'AB', caseId: 'M', type: 'moment', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, position: 0.5, moment: 40 },
  ],
  memberInitialEffects: [],
  settings: createDefaultSettings(),
});

describe('discontinuidades exactas en cargas puntuales y momentos concentrados', () => {
  it('no aplica dos veces un salto cuando otro tramo termina dentro de su tolerancia', () => {
    // Simply supported beam L=8 with q=-1 kN/m over [0, 4+8e-11] and P=-10 kN at
    // x=4: R_A=8, R_B=6. The distributed edge lands 8e-11 m past the point load,
    // so both produce a breakpoint, but the jump must be applied exactly once.
    const result = buildExactDiagrams(
      [0, 8, 0, 0, 6, 0],
      [
        { kind: 'distributed', a: 0, b: 4.00000000008, qxA: 0, qxB: 0, qyA: -1, qyB: -1 },
        { kind: 'point', x: 4, px: 0, py: -10 },
      ],
      8,
    );
    close(evaluateDiagramAt(result.segments, result.jumps, 4, 'left')!.shear, 4, 1e-8);
    close(evaluateDiagramAt(result.segments, result.jumps, 4, 'right')!.shear, -6, 1e-8);
    close(result.segments.at(-1)!.shear[0], -6, 1e-8);
    close(result.endCompatibility.shear, 0, 1e-8);
    close(result.endCompatibility.moment, 0, 1e-8);
  });

  it('funde dos acciones concentradas más cercanas que la tolerancia de coordenada, pero las mantiene distintas si están más separadas', () => {
    // buildExactDiagrams assigns each concentrated action to the nearest segment
    // breakpoint (see the fix above); this is the deliberate boundary of that
    // assignment, not an accident. coordinateTolerance(8) = max(8*1e-10, eps*8*64)
    // = 8e-10 m, so 3e-10 sits inside it and 5e-9 sits well outside it.
    const merged = buildExactDiagrams(
      [0, 5, 0, 0, 5, 0],
      [
        { kind: 'point', x: 4, px: 0, py: -6 },
        { kind: 'point', x: 4 + 3e-10, px: 0, py: -4 },
      ],
      8,
    );
    expect(merged.jumps).toHaveLength(1);
    close(merged.jumps[0].x, 4, 1e-9);
    close(merged.jumps[0].shearDelta, -10, 1e-8);
    close(merged.endCompatibility.shear, 0, 1e-8);

    const separate = buildExactDiagrams(
      [0, 5, 0, 0, 5, 0],
      [
        { kind: 'point', x: 4, px: 0, py: -6 },
        { kind: 'point', x: 4 + 5e-9, px: 0, py: -4 },
      ],
      8,
    );
    expect(separate.jumps).toHaveLength(2);
    close(separate.jumps[0].shearDelta, -6, 1e-6);
    close(separate.jumps[1].shearDelta, -4, 1e-6);
    close(separate.endCompatibility.shear, 0, 1e-8);
  });

  it('conserva los límites izquierdo y derecho de un momento concentrado', () => {
    const result = analyzeProject(beamWithConcentratedActions());
    const member = result.memberResults[0];
    // Only the concentrated moment case is a jump in M; both loads are active.
    const left = evaluateDiagramAt(member.diagramSegments, member.diagramJumps, 4, 'left')!;
    const right = evaluateDiagramAt(member.diagramSegments, member.diagramJumps, 4, 'right')!;
    expect(left.side).toBe('left');
    expect(right.side).toBe('right');
    close(right.moment - left.moment, -40, 1e-8);
    expect(member.maxMoment).toBeGreaterThanOrEqual(Math.max(left.moment, right.moment) - 1e-8);
    expect(member.minMoment).toBeLessThanOrEqual(Math.min(left.moment, right.moment) + 1e-8);
  });

  it('marca el lado del extremo gobernante en el resumen exacto', () => {
    const result = analyzeProject(beamWithConcentratedActions());
    const summary = summarizeAnalysisResults(result);
    const moment = summary.members[0].diagrams.moment;
    expect(moment.maximum.side).toBeDefined();
    expect(moment.minimum.side).toBeDefined();
    const jumpSides = [moment.maximum, moment.minimum]
      .filter((extremum) => Math.abs(extremum.x - 4) < 1e-8)
      .map((extremum) => extremum.side);
    expect(jumpSides.length).toBeGreaterThan(0);
    expect(jumpSides.every((side) => side === 'left' || side === 'right')).toBe(true);
  });

  it('permite evaluar explícitamente los dos lados de una envolvente', () => {
    const scenarios = analyzeProjectScenarios(beamWithConcentratedActions());
    const envelope = buildDiagramEnvelope(scenarios, 'AB', 'moment')!;
    const left = evaluateEnvelopeAt(envelope, 4, 'left')!;
    const right = evaluateEnvelopeAt(envelope, 4, 'right')!;
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    // The concentrated-moment scenario drops M by 40 kN·m across the cut, so the
    // two lateral limits of the envelope cannot coincide.
    expect(Math.abs(right.minimum - left.minimum) + Math.abs(right.maximum - left.maximum)).toBeGreaterThan(1);
    // Both sides must be enclosed by the envelope for every scenario.
    for (const scenario of scenarios.filter((item) => item.result.success)) {
      const member = scenario.result.memberResults[0];
      for (const [side, limit] of [['left', left], ['right', right]] as const) {
        const actual = evaluateDiagramAt(member.diagramSegments, member.diagramJumps, 4, side)!.moment;
        expect(actual).toBeGreaterThanOrEqual(limit.minimum - 1e-7);
        expect(actual).toBeLessThanOrEqual(limit.maximum + 1e-7);
      }
    }
  });

  it('incluye ambos lados del salto en el mínimo y el máximo de la envolvente', () => {
    const scenarios = analyzeProjectScenarios(beamWithConcentratedActions());
    const envelope = buildDiagramEnvelope(scenarios, 'AB', 'moment')!;
    const sideValues = scenarios
      .filter((scenario) => scenario.result.success)
      .flatMap((scenario) => (['left', 'right'] as const).map((side) =>
        evaluateDiagramAt(scenario.result.memberResults[0].diagramSegments, scenario.result.memberResults[0].diagramJumps, 4, side)!.moment));
    expect(envelope.maximum.value).toBeGreaterThanOrEqual(Math.max(...sideValues) - 1e-7);
    expect(envelope.minimum.value).toBeLessThanOrEqual(Math.min(...sideValues) + 1e-7);
  });
});
