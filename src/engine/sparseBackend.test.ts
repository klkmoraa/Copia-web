import { describe, expect, it } from 'vitest';
import type { ProjectModel } from '../types';
import { analyzeProject } from './solver';

const independentCantilevers = (count: number): ProjectModel => {
  const project: ProjectModel = {
    schemaVersion: 1,
    id: `sparse-${count}`,
    name: `sparse-${count}`,
    nodes: [],
    members: [],
    loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
    combinations: [],
    nodalLoads: [],
    memberLoads: [],
    settings: {
      units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
      showNodeLabels: true, showMemberLabels: false, showLocalAxes: false, showLoads: true,
      showDimensions: true, showResultValues: true, diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
    },
  };
  for (let index = 0; index < count; index += 1) {
    const base = `B${index}`;
    const tip = `T${index}`;
    project.nodes.push(
      { id: base, x: index * 2, y: 0, support: { type: 'fixed' } },
      { id: tip, x: index * 2, y: 3, support: { type: 'none' } },
    );
    project.members.push({ id: `M${index}`, i: base, j: tip, type: 'frame', E: 200e6, A: 0.02, I: 8e-5 });
    project.nodalLoads.push({ id: `P${index}`, nodeId: tip, caseId: 'LC1', fx: 5 + index / 10, fy: -2, mz: 0 });
  }
  return project;
};

const closeArray = (actual: number[], expected: number[], tolerance = 2e-10) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => {
    const scale = Math.max(1, Math.abs(expected[index]));
    expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(tolerance * scale);
  });
};

describe('backend sparse híbrido experimental', () => {
  it('mantiene paridad estructural, residual y determinismo respecto a LU denso', () => {
    const project = independentCantilevers(25);
    const hybrid = analyzeProject(project, undefined, { includeEducationTrace: false });
    const dense = analyzeProject(project, undefined, { includeEducationTrace: false, linearBackend: 'dense' });
    const repeated = analyzeProject(project, undefined, { includeEducationTrace: false });

    expect(hybrid.success && dense.success && repeated.success).toBe(true);
    expect(hybrid.linearSolver).toMatchObject({ policy: 'auto', backend: 'sparse-ldlt' });
    expect(dense.linearSolver).toMatchObject({ policy: 'dense', backend: 'dense-lu', fallbackReason: 'forced-dense' });
    expect(repeated.linearSolver).toEqual(hybrid.linearSolver);
    expect(repeated.displacements).toEqual(hybrid.displacements);

    closeArray(hybrid.displacements, dense.displacements);
    hybrid.nodeResults.forEach((node, index) => {
      const reference = dense.nodeResults[index];
      closeArray([node.ux, node.uy, node.rz, node.rx, node.ry, node.rm], [reference.ux, reference.uy, reference.rz, reference.rx, reference.ry, reference.rm]);
    });
    hybrid.memberResults.forEach((member, index) => {
      const reference = dense.memberResults[index];
      closeArray(member.localEndForces, reference.localEndForces);
      closeArray(
        member.diagram.flatMap((point) => [point.axial, point.shear, point.moment]),
        reference.diagram.flatMap((point) => [point.axial, point.shear, point.moment]),
      );
    });

    expect(hybrid.loadAudit?.normalizedResidual).toBeLessThanOrEqual(1e-10);
    expect(hybrid.equilibrium.normalizedResidual).toBeLessThanOrEqual(1e-8);
    expect(hybrid.linearResidual).toBeLessThanOrEqual(Math.max(1e-14, (dense.linearResidual ?? 0) * 10));
  });
});
