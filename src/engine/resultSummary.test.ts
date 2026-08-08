import { describe, expect, it } from 'vitest';
import type { AnalysisResult, DeformationSegment, DiagramSegment, MemberResult, NodeResult } from '../types';
import type { AnalysisScenario } from './envelope';
import {
  buildDeformationEnvelope,
  buildReactionEnvelope,
  evaluateDeformationEnvelopeAt,
  summarizeAnalysisResults,
} from './resultSummary';

const diagramSegment = (overrides: Partial<DiagramSegment> = {}): DiagramSegment => ({
  x0: 0,
  x1: 4,
  axial: [0, 4, -1],
  shear: [-3, 2, 0],
  moment: [0, 0, 3, -1],
  distributedAxial: [0, 0],
  distributedTransverse: [0, 0],
  ...overrides,
});

const deformationSegment = (v: DeformationSegment['v'], length = 4): DeformationSegment => ({
  x0: 0,
  x1: length,
  u: [0, 4, -1, 0],
  theta: [0, 0, 0, 0, 0],
  v,
});

const memberResult = (id = 'M1', deformationSegments = [deformationSegment([0, 2, -1, 0, 0, 0])]): MemberResult => ({
  memberId: id,
  length: deformationSegments[0]?.x1 ?? 4,
  localDisplacements: [],
  localEndForces: [],
  diagramSegments: [diagramSegment({ x1: deformationSegments[0]?.x1 ?? 4 })],
  diagramJumps: [],
  criticalPoints: [],
  diagram: [],
  deformation: [],
  deformationSegments,
  deformationCriticalPoints: [],
  maxAxial: 0,
  minAxial: 0,
  maxShear: 0,
  minShear: 0,
  maxMoment: 0,
  minMoment: 0,
});

const nodeResult = (nodeId: string, values: Partial<NodeResult> = {}): NodeResult => ({
  nodeId,
  ux: 0,
  uy: 0,
  rz: 0,
  rx: 0,
  ry: 0,
  rm: 0,
  ...values,
});

const analysis = (members: MemberResult[], nodes: NodeResult[] = []): AnalysisResult => ({
  success: true,
  issues: [],
  nodeResults: nodes,
  memberResults: members,
  displacements: [],
  residualNorm: 0,
  conditionEstimate: 1,
  equilibrium: { sumFx: 0, sumFy: 0, sumM: 0, normalizedComponents: { fx: 0, fy: 0, mz: 0 }, normalizedResidual: 0 },
  explanation: [],
});

const scenario = (id: string, name: string, member: MemberResult, nodes: NodeResult[] = []): AnalysisScenario => ({
  id,
  name,
  kind: 'case',
  result: analysis([member], nodes),
  status: 'reliable',
  usable: true,
});

describe('resumen exacto global', () => {
  it('obtiene extremos interiores directamente de los polinomios aunque no haya muestras ni puntos críticos', () => {
    const summary = summarizeAnalysisResults(analysis([memberResult()]));
    expect(summary.members).toHaveLength(1);
    expect(summary.diagrams.axial?.maximum.x).toBeCloseTo(2, 10);
    expect(summary.diagrams.axial?.maximum.value).toBeCloseTo(4, 10);
    expect(summary.diagrams.moment?.maximum.x).toBeCloseTo(2, 10);
    expect(summary.diagrams.moment?.maximum.value).toBeCloseTo(4, 10);
    expect(summary.diagrams.moment?.minimum.x).toBeCloseTo(4, 10);
    expect(summary.diagrams.moment?.minimum.value).toBeCloseTo(-16, 10);
    expect(summary.deformations.v?.maximum.x).toBeCloseTo(1, 10);
    expect(summary.deformations.v?.maximum.value).toBeCloseTo(1, 10);
  });

  it('elige el miembro gobernante y conserva signo y estación', () => {
    const second = memberResult('M2');
    second.diagramSegments = [diagramSegment({ axial: [-20, 0, 0] })];
    const summary = summarizeAnalysisResults(analysis([memberResult('M1'), second]));
    expect(summary.diagrams.axial?.minimum.memberId).toBe('M2');
    expect(summary.diagrams.axial?.minimum.value).toBe(-20);
    expect(summary.diagrams.axial?.absolute).toBe(summary.diagrams.axial?.minimum);
  });
});

describe('envolvente de reacciones', () => {
  it('reduce componentes ordinarios y de apoyo inclinado preservando casos gobernantes', () => {
    const scenarios = [
      scenario('A', 'Servicio', memberResult(), [nodeResult('N1', { rx: -4, ry: 8, rm: 1, supportNormalReaction: 9 })]),
      scenario('B', 'Viento', memberResult(), [nodeResult('N1', { rx: 6, ry: -2, rm: 3, supportNormalReaction: -5 })]),
    ];
    const envelope = buildReactionEnvelope(scenarios);
    const node = envelope.nodes[0];
    expect(node.nodeId).toBe('N1');
    expect(node.components.rx?.minimum).toMatchObject({ value: -4, scenarioId: 'A' });
    expect(node.components.rx?.maximum).toMatchObject({ value: 6, scenarioName: 'Viento' });
    expect(node.components.supportNormalReaction?.minimum.value).toBe(-5);
    expect(node.components.supportTangentialReaction).toBeUndefined();
  });

  it('tolera escenarios sin el mismo conjunto de nodos, pero señala la cobertura parcial', () => {
    // Two included scenarios that disagree on topology should never happen for
    // scenarios of the same project (analyzeProjectScenarios always reports every
    // project.nodes entry), but buildReactionEnvelope accepts any AnalysisScenario[]
    // a caller assembles by hand, so the guarantee has to hold defensively too.
    const scenarios = [
      scenario('A', 'A', memberResult(), [nodeResult('N1', { rx: 1 })]),
      scenario('B', 'B', memberResult(), [nodeResult('N2', { rx: 2 })]),
    ];
    const envelope = buildReactionEnvelope(scenarios);
    expect(envelope.nodes.map((node) => node.nodeId)).toEqual(['N1', 'N2']);
    // Neither node was reported by both included scenarios, so neither is complete.
    expect(envelope.nodes.every((node) => node.complete)).toBe(false);
    expect(envelope.nodes.find((node) => node.nodeId === 'N1')!.complete).toBe(false);
    expect(envelope.nodes.find((node) => node.nodeId === 'N2')!.complete).toBe(false);
    // A per-node gap must also be visible at the top level, not just buried per node.
    expect(envelope.complete).toBe(false);
  });

  it('marca los nodos y la envolvente como completos cuando todos los escenarios incluidos coinciden en topología', () => {
    const scenarios = [
      scenario('A', 'A', memberResult(), [nodeResult('N1', { rx: 1 }), nodeResult('N2', { rx: 3 })]),
      scenario('B', 'B', memberResult(), [nodeResult('N1', { rx: 2 }), nodeResult('N2', { rx: 4 })]),
    ];
    const envelope = buildReactionEnvelope(scenarios);
    expect(envelope.nodes.every((node) => node.complete)).toBe(true);
    expect(envelope.complete).toBe(true);
  });
});

describe('envolvente exacta de deformaciones', () => {
  it('divide la envolvente en el cruce y cambia el escenario gobernante', () => {
    const linearA = memberResult('M1', [deformationSegment([0, 1, 0, 0, 0, 0], 2)]);
    const linearB = memberResult('M1', [deformationSegment([2, -1, 0, 0, 0, 0], 2)]);
    const envelope = buildDeformationEnvelope([
      scenario('A', 'Ascendente', linearA),
      scenario('B', 'Descendente', linearB),
    ], 'M1', 'v');
    expect(envelope).not.toBeNull();
    expect(envelope!.segments.some((segment) => Math.abs(segment.x1 - 1) < 1e-8)).toBe(true);
    expect(evaluateDeformationEnvelopeAt(envelope!, 0.5)).toMatchObject({
      minimum: 0.5,
      maximum: 1.5,
      minimumScenarioId: 'A',
      maximumScenarioId: 'B',
    });
    expect(evaluateDeformationEnvelopeAt(envelope!, 1.5)).toMatchObject({
      minimum: 0.5,
      maximum: 1.5,
      minimumScenarioId: 'B',
      maximumScenarioId: 'A',
    });
  });

  it('encuentra un máximo interior de grado superior y admite consulta fuera de rango por clamp', () => {
    const arch = memberResult('M1', [deformationSegment([0, 2, -1, 0, 0, 0], 2)]);
    const zero = memberResult('M1', [deformationSegment([0, 0, 0, 0, 0, 0], 2)]);
    const envelope = buildDeformationEnvelope([scenario('A', 'Arco', arch), scenario('Z', 'Cero', zero)], 'M1', 'v')!;
    expect(envelope.maximum.x).toBeCloseTo(1, 9);
    expect(envelope.maximum.value).toBeCloseTo(1, 9);
    expect(envelope.maximum.scenarioId).toBe('A');
    expect(evaluateDeformationEnvelopeAt(envelope, 99)?.x).toBeCloseTo(2, 10);
  });

  it('devuelve null si el miembro no existe en ningún escenario', () => {
    expect(buildDeformationEnvelope([scenario('A', 'A', memberResult())], 'missing', 'v')).toBeNull();
  });
});
