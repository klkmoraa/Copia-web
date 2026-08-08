import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import { analyzeProjectScenarios, buildDiagramEnvelope, selectEnvelopeScenarios } from './envelope';
import { buildDeformationEnvelope, buildReactionEnvelope } from './resultSummary';

/**
 * The self-weight of an inclined or horizontal truss bar has a transverse
 * component that a two-force element cannot carry, so the solver rejects that
 * single load case while every other scenario of the same project solves.
 */
const trussWithFailingSelfWeightCase = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'scenario-coverage',
  name: 'Armadura con peso propio inválido',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'C', x: 3, y: 3, support: { type: 'none' } },
  ],
  members: [
    { id: 'AB', i: 'A', j: 'B', type: 'truss', E: 200e6, A: 0.01, I: 0, density: 7850 },
    { id: 'AC', i: 'A', j: 'C', type: 'truss', E: 200e6, A: 0.01, I: 0, density: 7850 },
    { id: 'CB', i: 'C', j: 'B', type: 'truss', E: 200e6, A: 0.01, I: 0, density: 7850 },
  ],
  loadCases: [
    { id: 'Q', name: 'Viva', category: 'variable', active: true },
    { id: 'PP', name: 'Peso propio', category: 'permanent', active: true, selfWeightFactor: 1 },
  ],
  combinations: [{ id: 'C1', name: 'Combinación mayorada', factors: { Q: 1.5, PP: 1.2 } }],
  nodalLoads: [{ id: 'N1', nodeId: 'C', caseId: 'Q', fx: 0, fy: -20, mz: 0 }],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings: createDefaultSettings(),
});

const healthyBeam = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'scenario-healthy',
  name: 'Viga sana',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }],
  loadCases: [
    { id: 'G', name: 'Permanente', category: 'permanent', active: true },
    { id: 'Q', name: 'Variable', category: 'variable', active: true },
  ],
  combinations: [{ id: 'C1', name: 'C1', factors: { G: 1.2, Q: 1.5 } }],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [
    { id: 'W', memberId: 'AB', caseId: 'G', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -10, qyEnd: -10 },
    { id: 'P', memberId: 'AB', caseId: 'Q', type: 'point', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, position: 0.4, px: 0, py: -25 },
  ],
  memberInitialEffects: [],
  settings: createDefaultSettings(),
});

describe('cobertura de casos, combinaciones y envolventes', () => {
  it('conserva todos los escenarios solicitados con su estado y su causa', () => {
    const scenarios = analyzeProjectScenarios(trussWithFailingSelfWeightCase());
    expect(scenarios.map((scenario) => scenario.id)).toEqual(['case:Q', 'case:PP', 'combination:C1']);
    const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
    expect(byId.get('case:Q')!.status).toBe('reliable');
    expect(byId.get('case:PP')!.status).toBe('failed');
    expect(byId.get('case:PP')!.usable).toBe(false);
    expect(byId.get('case:PP')!.failureReason).toMatch(/./);
    expect(byId.get('combination:C1')!.status).toBe('failed');
  });

  it('separa los escenarios utilizables de los que no pueden alimentar una envolvente', () => {
    const scenarios = analyzeProjectScenarios(trussWithFailingSelfWeightCase());
    const selection = selectEnvelopeScenarios(scenarios);
    expect(selection.included.map((scenario) => scenario.id)).toEqual(['case:Q']);
    expect(selection.excluded.map((item) => item.scenarioId).sort()).toEqual(['case:PP', 'combination:C1']);
    expect(selection.excluded.every((item) => item.reason.length > 0)).toBe(true);
  });

  it('marca la envolvente como incompleta cuando falta un escenario', () => {
    const scenarios = analyzeProjectScenarios(trussWithFailingSelfWeightCase());
    const envelope = buildDiagramEnvelope(scenarios, 'AB', 'axial');
    expect(envelope).not.toBeNull();
    expect(envelope!.complete).toBe(false);
    expect(envelope!.includedScenarioIds).toEqual(['case:Q']);
    expect(envelope!.excludedScenarios.map((item) => item.scenarioId).sort()).toEqual(['case:PP', 'combination:C1']);
  });

  it('marca como completas las envolventes de reacciones y deformaciones solo si nada falta', () => {
    const failing = analyzeProjectScenarios(trussWithFailingSelfWeightCase());
    expect(buildReactionEnvelope(failing).complete).toBe(false);
    expect(buildReactionEnvelope(failing).excludedScenarios).toHaveLength(2);

    const healthy = analyzeProjectScenarios(healthyBeam());
    expect(healthy).toHaveLength(3);
    expect(healthy.every((scenario) => scenario.status === 'reliable')).toBe(true);
    expect(buildReactionEnvelope(healthy).complete).toBe(true);
    expect(buildDiagramEnvelope(healthy, 'AB', 'moment')!.complete).toBe(true);
    expect(buildDeformationEnvelope(healthy, 'AB', 'v')!.complete).toBe(true);
  });

  it('no deja que un escenario fallido aporte valores a la envolvente', () => {
    const scenarios = analyzeProjectScenarios(trussWithFailingSelfWeightCase());
    const envelope = buildDiagramEnvelope(scenarios, 'AB', 'axial')!;
    const contributing = new Set(envelope.segments.flatMap((segment) => [segment.minimum.scenarioId, segment.maximum.scenarioId]));
    expect([...contributing]).toEqual(['case:Q']);
    expect(envelope.minimum.scenarioId).toBe('case:Q');
    expect(envelope.maximum.scenarioId).toBe('case:Q');
  });

  it('devuelve null en lugar de una envolvente vacía cuando ningún escenario es utilizable', () => {
    const scenarios = analyzeProjectScenarios(trussWithFailingSelfWeightCase())
      .filter((scenario) => scenario.status === 'failed');
    expect(buildDiagramEnvelope(scenarios, 'AB', 'axial')).toBeNull();
    const reactions = buildReactionEnvelope(scenarios);
    expect(reactions.complete).toBe(false);
    expect(reactions.nodes).toHaveLength(0);
  });
});
