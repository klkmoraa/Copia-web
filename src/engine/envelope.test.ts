import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import { evaluateDiagramAt } from './diagram';
import { analyzeProjectScenarios, buildDiagramEnvelope, evaluateEnvelopeAt } from './envelope';

const beam = (): ProjectModel => ({
  schemaVersion: 4,
  id: 'envelope',
  name: 'envelope',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5, releases: { iMoment: true, jMoment: true } }],
  loadCases: [
    { id: 'L', name: 'Carga izquierda', category: 'variable', active: true },
    { id: 'R', name: 'Carga derecha', category: 'variable', active: true },
  ],
  combinations: [{ id: 'NEG', name: 'Inversión izquierda', factors: { L: -1, R: 0 } }],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [
    { id: 'PL', memberId: 'AB', caseId: 'L', type: 'point', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, position: 0.25, px: 0, py: -20 },
    { id: 'PR', memberId: 'AB', caseId: 'R', type: 'point', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, position: 0.75, px: 0, py: -30 },
  ],
  memberInitialEffects: [],
  settings: createDefaultSettings(),
});

describe('envolventes exactas por escenarios', () => {
  it('encierra todos los diagramas y conserva el caso gobernante', () => {
    const scenarios = analyzeProjectScenarios(beam());
    const envelope = buildDiagramEnvelope(scenarios, 'AB', 'moment');
    expect(envelope).not.toBeNull();
    expect(envelope!.segments.length).toBeGreaterThan(2);
    for (const x of Array.from({ length: 33 }, (_, index) => index * 8 / 32)) {
      const value = evaluateEnvelopeAt(envelope!, x)!;
      for (const scenario of scenarios) {
        const member = scenario.result.memberResults[0];
        const actual = evaluateDiagramAt(member.diagramSegments, member.diagramJumps, x, 'right')!.moment;
        expect(actual).toBeGreaterThanOrEqual(value.minimum - 1e-7);
        expect(actual).toBeLessThanOrEqual(value.maximum + 1e-7);
      }
      expect(value.minimumScenario.length).toBeGreaterThan(0);
      expect(value.maximumScenario.length).toBeGreaterThan(0);
    }
  });

  it('incluye factores negativos y extremos interiores exactos', () => {
    const scenarios = analyzeProjectScenarios(beam());
    const envelope = buildDiagramEnvelope(scenarios, 'AB', 'moment')!;
    expect(scenarios.some((scenario) => scenario.name === 'Inversión izquierda')).toBe(true);
    expect(envelope.maximum.value).toBeGreaterThan(0);
    expect(envelope.minimum.value).toBeLessThan(0);
    expect(envelope.minimum.x).toBeGreaterThanOrEqual(0);
    expect(envelope.maximum.x).toBeLessThanOrEqual(8);
  });
});
