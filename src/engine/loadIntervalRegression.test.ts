import { describe, expect, it } from 'vitest';
import type { ProjectModel } from '../types';
import { evaluateDeformationAt, evaluateDiagramAt } from './diagram';
import { analyzeProject } from './solver';

const settings: ProjectModel['settings'] = {
  units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
  showNodeLabels: true, showMemberLabels: true, showLocalAxes: false,
  showLoads: true, showDimensions: true, showResultValues: true,
  diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
};

const close = (actual: number, expected: number, context: string, rtol = 3e-8, atol = 1e-9) => {
  expect(
    Math.abs(actual - expected),
    `${context}: actual=${actual}, esperado=${expected}`,
  ).toBeLessThanOrEqual(atol + rtol * Math.max(1, Math.abs(actual), Math.abs(expected)));
};

const reportedPortal = (loadEnd: number): ProjectModel => ({
  schemaVersion: 5,
  id: `reported-portal-${loadEnd}`,
  name: 'Marco de la memoria recibida',
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 0, y: 10, support: { type: 'none' } },
    { id: 'N3', x: 10, y: 10, support: { type: 'none' } },
    { id: 'N4', x: 10, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [
    { id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.005, I: 8.333e-6 },
    { id: 'M2', i: 'N2', j: 'N3', type: 'frame', E: 200e6, A: 0.005, I: 8.333e-6 },
    { id: 'M3', i: 'N3', j: 'N4', type: 'frame', E: 200e6, A: 0.005, I: 8.333e-6 },
  ],
  loadCases: [{ id: 'LC1', name: 'Caso 1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [
    { id: 'ML1', memberId: 'M2', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: loadEnd, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10 },
    { id: 'ML2', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 10, py: 0 },
  ],
  settings: { ...settings },
});

const node = (result: ReturnType<typeof analyzeProject>, id: string) =>
  result.nodeResults.find((candidate) => candidate.nodeId === id)!;

const member = (result: ReturnType<typeof analyzeProject>, id: string) =>
  result.memberResults.find((candidate) => candidate.memberId === id)!;

const maximumMoment = (result: ReturnType<typeof analyzeProject>, memberId = 'M2') => member(result, memberId).criticalPoints
  .filter((point) => point.quantity === 'moment' && point.kind === 'maximum')
  .reduce((best, point) => point.value > best.value ? point : best);

const integrateTransverseDeformation = (
  result: ReturnType<typeof analyzeProject>,
  memberId: string,
  from: number,
  to: number,
) => member(result, memberId).deformationSegments.reduce((integral, segment) => {
  const x0 = Math.max(from, segment.x0);
  const x1 = Math.min(to, segment.x1);
  if (!(x1 > x0)) return integral;
  const primitive = (x: number) => segment.v.reduce(
    (sum, coefficient, degree) => sum + coefficient * (x - segment.x0) ** (degree + 1) / (degree + 1),
    0,
  );
  return integral + primitive(x1) - primitive(x0);
}, 0);

describe('regresion del intervalo de la memoria recibida', () => {
  it.each([
    {
      label: 'carga parcial 0-0.70', end: 0.7, ay: 40.5, by: 29.5,
      maximum: 132.0125, maximumX: 4.05, shear7: -29.5, shear10: -29.5,
      sourceFy: -70, sourceMoment: -295,
      n2: [4.44531781709, -0.000405, -0.30702628149],
      n4: [6.79527181084, 0, 0.234995399375],
    },
    {
      label: 'carga completa 0-1.00', end: 1, ay: 45, by: 55,
      maximum: 151.25, maximumX: 4.5, shear7: -25, shear10: -55,
      sourceFy: -100, sourceMoment: -550,
      n2: [4.87529500777, -0.00045, -0.350024000559],
      n4: [7.87531501257, 0, 0.300002000479],
    },
  ])('distingue $label sin truncar ni extender la carga', (expected) => {
    const result = analyzeProject(reportedPortal(expected.end));
    expect(result.success).toBe(true);
    close(node(result, 'N1').rx, -10, `${expected.label}: Ax`);
    close(node(result, 'N1').ry, expected.ay, `${expected.label}: Ay`);
    close(node(result, 'N4').ry, expected.by, `${expected.label}: By`);

    const peak = maximumMoment(result);
    close(peak.value, expected.maximum, `${expected.label}: Mmax`);
    close(peak.x, expected.maximumX, `${expected.label}: x(Mmax)`);
    const beam = member(result, 'M2');
    close(evaluateDiagramAt(beam.diagramSegments, beam.diagramJumps, 7)!.shear, expected.shear7, `${expected.label}: V(7)`);
    close(evaluateDiagramAt(beam.diagramSegments, beam.diagramJumps, 10)!.shear, expected.shear10, `${expected.label}: V(10)`);

    const audit = result.loadAudit!;
    close(audit.source.fx, 10, `${expected.label}: fuente Fx`);
    close(audit.source.fy, expected.sourceFy, `${expected.label}: fuente Fy`);
    const reference = audit.referencePoint!;
    const sourceMomentAtReference = expected.sourceMoment - reference.x * expected.sourceFy + reference.y * 10;
    close(audit.source.mz, sourceMomentAtReference, `${expected.label}: fuente M en el origen de auditoria`);
    expect(audit.normalizedResidual).toBeLessThan(1e-12);
    expect(audit.memberAudits.find((item) => item.memberId === 'M2')!.mechanical.normalizedResidual).toBeLessThan(1e-12);
    expect(result.equilibrium.normalizedResidual).toBeLessThan(1e-12);

    const n2 = node(result, 'N2');
    const n4 = node(result, 'N4');
    [n2.ux, n2.uy, n2.rz].forEach((value, index) => close(value, expected.n2[index], `${expected.label}: N2 dof ${index}`, 5e-8));
    [n4.ux, n4.uy, n4.rz].forEach((value, index) => close(value, expected.n4[index], `${expected.label}: N4 dof ${index}`, 5e-8));
    // Clapeyron: for this linear elastic model the exact internal strain
    // energy is one half of the work of the two member loads.  Both actions
    // are -10 in their respective local transverse directions.
    const distributedWork = -10 * integrateTransverseDeformation(result, 'M2', 0, 10 * expected.end);
    const pointWork = -10 * evaluateDeformationAt(member(result, 'M1').deformationSegments, 5)!.v;
    close(
      result.educationTrace!.assembly.strainEnergy,
      0.5 * (distributedWork + pointWork),
      `${expected.label}: energia interna = trabajo externo / 2`,
      5e-8,
    );
    expect(result.issues.some((issue) => issue.id === 'small-displacement-assumption')).toBe(true);
  });
});

const blankBeam = (length: number): ProjectModel => ({
  schemaVersion: 5,
  id: 'seeded-load-properties',
  name: 'Seeded load properties',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: length, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 210e6, A: 0.1, I: 0.01, releases: { iMoment: true, jMoment: true } }],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [],
  settings: { ...settings },
});

it('conserva un intervalo valido menor que la antigua tolerancia grafica', () => {
  const length = 1;
  const epsilon = 5e-11;
  const resultant = 50;
  const intensity = resultant / (epsilon * length);
  const model = blankBeam(length);
  model.memberLoads = [{
    id: 'tiny', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real',
    start: 0, end: epsilon, qyStart: -intensity, qyEnd: -intensity,
  }];

  const result = analyzeProject(model);
  expect(result.success).toBe(true);
  expect(result.issues.some((issue) => issue.id === 'diagram-equilibrium-AB')).toBe(false);
  const expectedA = resultant * (1 - epsilon / 2);
  const expectedB = resultant * epsilon / 2;
  close(node(result, 'A').ry, expectedA, 'intervalo corto: RA', 2e-8);
  close(node(result, 'B').ry, expectedB, 'intervalo corto: RB', 2e-8, 1e-12);
  const peak = maximumMoment(result, 'AB');
  const expectedX = epsilon * length * (1 - epsilon / 2);
  const expectedMoment = resultant * epsilon * length * (1 - epsilon / 2) ** 2 / 2;
  close(peak.x, expectedX, 'intervalo corto: x(Mmax)', 2e-8, 1e-18);
  close(peak.value, expectedMoment, 'intervalo corto: Mmax', 2e-8, 1e-15);
});

const mulberry32 = (seed: number) => () => {
  let value = seed += 0x6D2B79F5;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
};

describe('propiedades deterministas de cargas lineales parciales', () => {
  it('repite 300 casos contra estatica cerrada y contra la misma carga dividida', () => {
    const seed = 0x5EED1234;
    const random = mulberry32(seed);
    for (let caseIndex = 0; caseIndex < 300; caseIndex += 1) {
      const context = `seed=0x${seed.toString(16)}, caso=${caseIndex}`;
      const length = 2 + 18 * random();
      const start = 0.8 * random();
      const end = start + (1 - start) * (0.08 + 0.92 * random());
      const qA = 1 + 49 * random();
      const qB = 1 + 49 * random();
      const model = blankBeam(length);
      model.memberLoads = [{
        id: 'q', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real',
        start, end, qxStart: 0, qxEnd: 0, qyStart: -qA, qyEnd: -qB,
      }];

      const span = (end - start) * length;
      const a = start * length;
      const slope = (qB - qA) / span;
      const resultant = qA * span + slope * span ** 2 / 2;
      const firstMoment = qA * (a * span + span ** 2 / 2)
        + slope * (a * span ** 2 / 2 + span ** 3 / 3);
      const expectedB = firstMoment / length;
      const expectedA = resultant - expectedB;
      const solved = analyzeProject(model);
      expect(solved.success, context).toBe(true);
      close(node(solved, 'A').ry, expectedA, `${context}: RA`, 2e-9);
      close(node(solved, 'B').ry, expectedB, `${context}: RB`, 2e-9);
      close(solved.loadAudit!.source.fy, -resultant, `${context}: resultante fuente`, 2e-10);
      const referenceX = solved.loadAudit!.referencePoint!.x;
      close(solved.loadAudit!.source.mz, -firstMoment + referenceX * resultant, `${context}: momento fuente`, 2e-10);
      expect(solved.loadAudit!.normalizedResidual, context).toBeLessThan(2e-12);

      const split = start + (end - start) * (0.1 + 0.8 * random());
      const splitFraction = (split - start) / (end - start);
      const qSplit = qA + (qB - qA) * splitFraction;
      const splitModel = blankBeam(length);
      splitModel.memberLoads = [
        { id: 'q1', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start, end: split, qxStart: 0, qxEnd: 0, qyStart: -qA, qyEnd: -qSplit },
        { id: 'q2', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: split, end, qxStart: 0, qxEnd: 0, qyStart: -qSplit, qyEnd: -qB },
      ];
      const splitSolved = analyzeProject(splitModel);
      expect(splitSolved.success, `${context}: modelo dividido`).toBe(true);
      expect(splitSolved.loadAudit!.memberAudits[0].mechanical.normalizedResidual, `${context}: auditoria del vector local`).toBeLessThan(2e-12);
      close(node(splitSolved, 'A').ry, node(solved, 'A').ry, `${context}: split RA`, 2e-9);
      close(node(splitSolved, 'B').ry, node(solved, 'B').ry, `${context}: split RB`, 2e-9);
      const wholeBeam = member(solved, 'AB');
      const dividedBeam = member(splitSolved, 'AB');
      for (const ratio of [0.03, 0.27, 0.53, 0.79, 0.97]) {
        const x = ratio * length;
        const whole = evaluateDiagramAt(wholeBeam.diagramSegments, wholeBeam.diagramJumps, x)!;
        const divided = evaluateDiagramAt(dividedBeam.diagramSegments, dividedBeam.diagramJumps, x)!;
        close(divided.shear, whole.shear, `${context}: split V(${ratio})`, 3e-9);
        close(divided.moment, whole.moment, `${context}: split M(${ratio})`, 3e-9);
      }
    }
  });
});
