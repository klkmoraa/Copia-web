/**
 * Performance budgets.
 *
 * Timings vary with the machine, so every ceiling here is deliberately generous: these
 * exist to catch an order-of-magnitude regression — an accidental O(n^3) in assembly, a
 * quadratic diagram walk — not to police a few milliseconds. A failure means something
 * changed shape, not that the machine was busy.
 *
 * The measured baseline on the development machine is recorded in
 * `docs/releases/0.8.1/PERFORMANCE.md`; these numbers are roughly 10x that.
 */
import { describe, expect, it } from 'vitest';
import { analyzeProject } from './solver';
import { buildDiagramEnvelope, type AnalysisScenario } from './envelope';
import type { MemberModel, NodeModel, ProjectModel } from '../types';

const settings: ProjectModel['settings'] = {
  units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
  showNodeLabels: true, showMemberLabels: false, showLocalAxes: false,
  showLoads: true, showDimensions: true, showResultValues: true,
  diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
};

/** A continuous beam of `spans` members: the cheapest way to grow degrees of freedom. */
const continuousBeam = (spans: number): ProjectModel => {
  const nodes: NodeModel[] = [];
  const members: MemberModel[] = [];
  for (let index = 0; index <= spans; index += 1) {
    nodes.push({
      id: `N${index}`,
      x: index * 4,
      y: 0,
      support: index === 0
        ? { type: 'pin' }
        : index % 4 === 0 ? { type: 'roller' } : { type: 'none' },
    });
  }
  for (let index = 0; index < spans; index += 1) {
    members.push({ id: `M${index}`, i: `N${index}`, j: `N${index + 1}`, type: 'frame', E: 200e6, A: 0.02, I: 8e-5 });
  }
  return {
    schemaVersion: 2,
    id: `perf-${spans}`,
    name: `perf-${spans}`,
    nodes,
    members,
    loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
    combinations: [],
    nodalLoads: [],
    memberLoads: members.map((member) => ({
      id: `w${member.id}`, memberId: member.id, caseId: 'LC1', type: 'distributed' as const,
      coordinateSystem: 'global' as const, lengthBasis: 'real' as const,
      start: 0, end: 1, qyStart: -10, qyEnd: -10,
    })),
    settings: { ...settings },
  };
};

const timed = <T>(work: () => T): { value: T; ms: number } => {
  const start = performance.now();
  const value = work();
  return { value, ms: performance.now() - start };
};

describe('presupuestos de rendimiento', () => {
  it('resuelve un modelo pequeno de forma inmediata', () => {
    const { value, ms } = timed(() => analyzeProject(continuousBeam(10)));
    expect(value.success).toBe(true);
    expect(ms).toBeLessThan(500);
  });

  it('resuelve un modelo mediano dentro del presupuesto', () => {
    const { value, ms } = timed(() => analyzeProject(continuousBeam(100)));
    expect(value.success).toBe(true);
    expect(value.memberResults).toHaveLength(100);
    expect(ms).toBeLessThan(3_000);
  });

  it('resuelve el modelo maximo declarado dentro del presupuesto', () => {
    const { value, ms } = timed(() => analyzeProject(continuousBeam(300)));
    expect(value.success).toBe(true);
    expect(value.memberResults).toHaveLength(300);
    expect(ms).toBeLessThan(20_000);
  }, 60_000);

  it('escala mejor que cuadraticamente con el numero de miembros', () => {
    // A dense O(n^3) solve would make the 200-span model ~8x the 100-span one. Banded
    // assembly should stay far below that; the ceiling catches a change of complexity
    // class without pinning an exact ratio.
    const small = timed(() => analyzeProject(continuousBeam(100)));
    const large = timed(() => analyzeProject(continuousBeam(200)));
    expect(small.value.success && large.value.success).toBe(true);
    const ratio = large.ms / Math.max(small.ms, 1);
    expect(ratio).toBeLessThan(8);
  }, 60_000);

  it('construye la envolvente de un modelo mediano sin coste desproporcionado', () => {
    const project = continuousBeam(100);
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const scenarios: AnalysisScenario[] = [
      { id: 'a', name: 'a', kind: 'case', result: analysis, status: 'reliable', usable: true },
      { id: 'b', name: 'b', kind: 'case', result: analyzeProject(project), status: 'reliable', usable: true },
    ];
    const { value, ms } = timed(() => buildDiagramEnvelope(scenarios, 'M50', 'moment'));
    expect(value).not.toBeNull();
    expect(ms).toBeLessThan(2_000);
  }, 60_000);

  it('produce diagramas de tamano acotado, no una muestra por pixel', () => {
    // Result size drives every downstream cost: table rendering, CSV, PDF and the
    // portable payload. It must stay proportional to the model, not to the viewport.
    const analysis = analyzeProject(continuousBeam(100));
    expect(analysis.success).toBe(true);
    const samples = analysis.memberResults.reduce((sum, member) => sum + member.diagram.length, 0);
    expect(samples / analysis.memberResults.length).toBeLessThan(200);
  }, 60_000);
});
