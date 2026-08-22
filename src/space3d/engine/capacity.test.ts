import { describe, expect, it } from 'vitest';
import { analyzeSpace3DProject } from './solver';
import { SPACE3D_LIMITS, fixedSpace3DRestraints, freeSpace3DRestraints, SPACE3D_ANALYSIS_SPACE, SPACE3D_SCHEMA_VERSION, type Space3DFrameMember, type Space3DNode, type Space3DProjectV1 } from '../model/types';

/**
 * Medición de capacidad de S3D-1.
 *
 * Los modelos son deterministas: una hélice de nudos encadenados y arriostrados,
 * empotrada en la base. Con elementos frame la cadena es estable en los seis
 * GDL, así que cada escalón resuelve de verdad y el tiempo medido es tiempo de
 * solver, no de un fallo temprano.
 *
 * Con `SPACE3D_CAPACITY_REPORT=1` se imprime una única línea con el marcador
 * que consume `scripts/check-space3d-capacity.mjs`.
 */

const STEPS: readonly { nodes: number; members: number }[] = [
  { nodes: 25, members: 50 },
  { nodes: 50, members: 100 },
  { nodes: 100, members: 200 },
  { nodes: 150, members: 300 },
];

const STEEL = { E: 200_000_000, G: 77_000_000, A: 0.0076, Iy: 4.5e-5, Iz: 1.36e-4, J: 4e-7 };

const buildLattice = (nodeCount: number, memberCount: number): Space3DProjectV1 => {
  const nodes: Space3DNode[] = Array.from({ length: nodeCount }, (_, index) => ({
    id: `N${index}`,
    x: 3 * Math.cos(index * 0.6),
    y: 0.5 * index,
    z: 3 * Math.sin(index * 0.6),
    restraints: index === 0 ? fixedSpace3DRestraints() : freeSpace3DRestraints(),
  }));

  const members: Space3DFrameMember[] = [];
  const template = (id: string, i: number, j: number): Space3DFrameMember => ({
    id, i: `N${i}`, j: `N${j}`, ...STEEL,
    orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 },
  });
  for (let stride = 1; stride <= 4 && members.length < memberCount; stride += 1) {
    for (let index = 0; index + stride < nodeCount && members.length < memberCount; index += 1) {
      members.push(template(`M${members.length}`, index, index + stride));
    }
  }

  return {
    analysisSpace: SPACE3D_ANALYSIS_SPACE,
    schemaVersion: SPACE3D_SCHEMA_VERSION,
    id: `capacity-${nodeCount}`,
    name: `capacity-${nodeCount}`,
    units: 'kN-m',
    nodes,
    members,
    nodalLoads: [{
      id: 'L1', caseId: 'LC1', nodeId: `N${nodeCount - 1}`,
      fx: 0, fy: -10, fz: -5, mx: 0, my: 0, mz: 0,
    }],
    loadCases: [{ id: 'LC1', name: 'LC1' }],
    loadCombinations: [],
  };
};

/**
 * Bytes de las estructuras densas que el solver reserva: la global `K`, el
 * bloque reducido `Kff` y la copia LU, más vectores. Es una cota analítica y
 * reproducible; `heapUsed` en un runtime con GC no lo es.
 */
const estimateBytes = (nodeCount: number, freeDofs: number): number => {
  const total = nodeCount * 6;
  const doubles = total * total + 2 * freeDofs * freeDofs + 6 * total;
  return doubles * 8;
};

describe('Space3D capacity', () => {
  const steps: Record<string, unknown>[] = [];

  it.each(STEPS)('resuelve un modelo de $nodes nudos y $members barras', ({ nodes, members }) => {
    const project = buildLattice(nodes, members);
    expect(project.nodes).toHaveLength(nodes);
    expect(project.members).toHaveLength(members);

    const started = performance.now();
    const result = analyzeSpace3DProject(project, 'LC1');
    const solveMilliseconds = performance.now() - started;

    expect(result.success, JSON.stringify(result.issues)).toBe(true);
    const finite = result.nodeResults.every((item) =>
      Object.values(item.displacement).every(Number.isFinite)
      && Object.values(item.reaction).every(Number.isFinite));
    expect(finite).toBe(true);
    expect(result.diagnostics.equilibrium.normalized).toBeLessThan(1e-6);

    steps.push({
      nodes,
      members,
      dofCount: result.diagnostics.dofCount,
      freeDofCount: result.diagnostics.freeDofCount,
      solveMilliseconds: Number(solveMilliseconds.toFixed(3)),
      estimatedBytes: estimateBytes(nodes, result.diagnostics.freeDofCount),
      relativeResidual: result.diagnostics.relativeResidual,
      equilibrium: result.diagnostics.equilibrium.normalized,
      finite,
    });
  }, 60_000);

  it('respeta los límites declarados y publica el informe cuando se pide', () => {
    expect(STEPS[STEPS.length - 1].nodes).toBe(SPACE3D_LIMITS.maxNodes);
    expect(STEPS[STEPS.length - 1].members).toBe(SPACE3D_LIMITS.maxMembers);
    expect(steps).toHaveLength(STEPS.length);

    if (process.env.SPACE3D_CAPACITY_REPORT === '1') {
      // Una sola línea, un solo marcador: el script la extrae sin adivinar.
      // oxlint-disable-next-line no-console
      console.log(`SPACE3D_CAPACITY_JSON=${JSON.stringify({ schemaVersion: 1, steps })}`);
    }
  });
});
