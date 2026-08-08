import { describe, expect, it } from 'vitest';
import { analyzeProject } from './solver';
import { evaluateDiagramAt } from './diagram';
import { beginProfiling, endProfiling, type PhaseTimings } from './performanceProfiler';
import type { MemberModel, NodeModel, ProjectModel } from '../types';

const settings: ProjectModel['settings'] = {
  units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
  showNodeLabels: true, showMemberLabels: false, showLocalAxes: false,
  showLoads: true, showDimensions: true, showResultValues: true,
  diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
};

const project = (): ProjectModel => ({
  schemaVersion: 2,
  id: 'benchmark',
  name: 'benchmark',
  nodes: [],
  members: [],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [],
  settings: { ...settings },
});

const frame = (id: string, i: string, j: string, E = 200e6, A = 0.02, I = 8e-5): MemberModel => ({
  id, i, j, type: 'frame', E, A, I,
});

const close = (actual: number, expected: number, rtol = 1e-7, atol = 1e-9) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(atol + rtol * Math.max(Math.abs(actual), Math.abs(expected), 1));
};

const criticalValue = (result: ReturnType<typeof analyzeProject>, memberId: string, quantity: 'axial' | 'shear' | 'moment', kind: 'maximum' | 'minimum') => {
  const member = result.memberResults.find((item) => item.memberId === memberId)!;
  const candidates = member.criticalPoints.filter((point) => point.quantity === quantity && point.kind === kind);
  return candidates.at(-1)?.value ?? (kind === 'maximum' ? Math.max(...member.diagram.map((point) => point[quantity])) : Math.min(...member.diagram.map((point) => point[quantity])));
};

describe('benchmarks cerrados de vigas y marcos', () => {
  it('voladizo con carga puntual: reacciones, giro y flecha', () => {
    const model = project();
    const L = 4;
    const P = 25;
    const E = 210e6;
    const I = 7.5e-5;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'none' } },
    ];
    model.members = [frame('AB', 'A', 'B', E, 0.02, I)];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -P, mz: 0 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, P);
    close(result.nodeResults[0].rm, P * L);
    close(result.nodeResults[1].uy, -(P * L ** 3) / (3 * E * I), 2e-7);
    close(result.nodeResults[1].rz, -(P * L ** 2) / (2 * E * I), 2e-7);
    close(criticalValue(result, 'AB', 'moment', 'minimum'), -P * L, 2e-7);
  });

  it('voladizo con carga uniforme: reacciones, giro y flecha', () => {
    const model = project();
    const L = 5;
    const w = 8;
    const E = 200e6;
    const I = 9e-5;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'none' } },
    ];
    model.members = [frame('AB', 'A', 'B', E, 0.02, I)];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, w * L, 2e-7);
    close(result.nodeResults[0].rm, w * L ** 2 / 2, 2e-7);
    close(result.nodeResults[1].uy, -(w * L ** 4) / (8 * E * I), 3e-7);
    close(result.nodeResults[1].rz, -(w * L ** 3) / (6 * E * I), 3e-7);
  });

  it('viga empotrada-empotrada con carga uniforme: momentos exactos', () => {
    const model = project();
    const L = 6;
    const w = 10;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'fixed' } },
    ];
    model.members = [frame('AB', 'A', 'B')];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, w * L / 2);
    close(result.nodeResults[1].ry, w * L / 2);
    close(result.nodeResults[0].rm, w * L ** 2 / 12);
    close(result.nodeResults[1].rm, -w * L ** 2 / 12);
    close(criticalValue(result, 'AB', 'moment', 'minimum'), -w * L ** 2 / 12);
    close(criticalValue(result, 'AB', 'moment', 'maximum'), w * L ** 2 / 24);
  });

  it('viga simple con carga triangular creciente: reacciones y máximo', () => {
    const model = project();
    const L = 9;
    const w = 12;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'tri', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: 0, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, w * L / 6, 3e-7);
    close(result.nodeResults[1].ry, w * L / 3, 3e-7);
    close(criticalValue(result, 'AB', 'moment', 'maximum'), w * L ** 2 / (9 * Math.sqrt(3)), 3e-7);
  });

  it('viga simple con carga uniforme parcial simétrica', () => {
    const model = project();
    const L = 8;
    const w = 10;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'partial', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0.25, end: 0.75, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, w * L / 4);
    close(result.nodeResults[1].ry, w * L / 4);
    close(criticalValue(result, 'AB', 'moment', 'maximum'), 3 * w * L ** 2 / 32, 3e-7);
  });

  it('momento concentrado central produce salto exacto en M', () => {
    const model = project();
    const L = 8;
    const M = 40;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'M', memberId: 'AB', caseId: 'LC1', type: 'moment', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, position: 0.5, moment: M }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, M / L);
    close(result.nodeResults[1].ry, -M / L);
    const jump = result.memberResults[0].diagramJumps.find((item) => Math.abs(item.x - L / 2) < 1e-9)!;
    close(jump.momentDelta, -M);
    close(criticalValue(result, 'AB', 'moment', 'maximum'), M / 2);
    close(criticalValue(result, 'AB', 'moment', 'minimum'), -M / 2);
  });

  it('carga vertical sobre miembro inclinado conserva resultante y equilibrio', () => {
    const model = project();
    const w = 10;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 3, y: 4, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, 25, 3e-7);
    close(result.nodeResults[1].ry, 25, 3e-7);
    close(result.equilibrium.sumFx, 0, 1e-8);
    close(result.equilibrium.sumFy, 0, 1e-8);
    close(result.equilibrium.sumM, 0, 1e-8);
  });

  it('carga trapezoidal completa reproduce resultante y centroide analíticos', () => {
    const model = project();
    const L = 10;
    const q0 = 4;
    const q1 = 16;
    const resultant = L * (q0 + q1) / 2;
    const centroid = L * (q0 + 2 * q1) / (3 * (q0 + q1));
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'trap', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: -q0, qyEnd: -q1 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[1].ry, resultant * centroid / L, 3e-7);
    close(result.nodeResults[0].ry, resultant * (L - centroid) / L, 3e-7);
    close(result.nodeResults[0].ry + result.nodeResults[1].ry, resultant, 3e-7);
  });

  it('carga por proyección vertical usa w por DeltaY y no por longitud real', () => {
    const model = project();
    const w = 12;
    const deltaY = 4;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 3, y: deltaY, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'vertical-projection', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'vertical', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry + result.nodeResults[1].ry, w * deltaY, 3e-7);
    close(result.nodeResults[0].ry, w * deltaY / 2, 3e-7);
    close(result.nodeResults[1].ry, w * deltaY / 2, 3e-7);
  });

  it('carga puntual global sobre miembro inclinado conserva posición y resultante', () => {
    const model = project();
    const P = 35;
    const ratio = 0.3;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 6, y: 2, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: ratio, px: 0, py: -P }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, P * (1 - ratio), 3e-7);
    close(result.nodeResults[1].ry, P * ratio, 3e-7);
    close(result.equilibrium.sumFx, 0, 1e-8);
    close(result.equilibrium.sumFy, 0, 1e-8);
    close(result.equilibrium.sumM, 0, 1e-8);
  });

  it('resorte axial trabaja en paralelo con la barra', () => {
    const model = project();
    const L = 2;
    const E = 200e6;
    const A = 0.005;
    const k = 10000;
    const P = 50;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90, spring: { kx: k } } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'truss', E, A, I: 0 }];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: P, fy: 0, mz: 0 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    const expected = P / (E * A / L + k);
    close(result.nodeResults[1].ux, expected, 2e-7);
    close(result.nodeResults[1].rx, -k * expected, 2e-7);
    close(result.nodeResults[0].rx + result.nodeResults[1].rx + P, 0, 2e-7);
  });

  it('vínculo rígido transfiere fuerzas con compatibilidad exacta', () => {
    const model = project();
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 2, y: 1, support: { type: 'none' } },
    ];
    model.members = [{ id: 'R', i: 'A', j: 'B', type: 'rigid', E: 0, A: 0, I: 0 }];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[1].ux, 0);
    close(result.nodeResults[1].uy, 0);
    close(result.nodeResults[1].rz, 0);
    close(result.nodeResults[0].ry, 10);
    close(result.nodeResults[0].rm, 20);
  });

  it('liberación de extremo recupera momento exactamente nulo', () => {
    const model = project();
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 5, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { jMoment: true } }];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: -7, qyEnd: -7 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.memberResults[0].localEndForces[5], 0, 1e-9);
    close(result.memberResults[0].diagram.at(-1)!.moment, 0, 1e-7);
  });

  it('superposición de casos coincide con la combinación lineal', () => {
    const model = project();
    model.loadCases = [
      { id: 'A', name: 'A', category: 'variable', active: false },
      { id: 'B', name: 'B', category: 'variable', active: false },
    ];
    model.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('M1', 'N1', 'N2'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [
      { id: 'PA', memberId: 'M1', caseId: 'A', type: 'point', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, position: 0.25, py: -10 },
      { id: 'PB', memberId: 'M1', caseId: 'B', type: 'point', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, position: 0.75, py: -20 },
    ];
    const a = analyzeProject(model, { id: 'a', name: 'a', factors: { A: 1, B: 0 } });
    const b = analyzeProject(model, { id: 'b', name: 'b', factors: { A: 0, B: 1 } });
    const c = analyzeProject(model, { id: 'c', name: 'c', factors: { A: 1, B: 1 } });
    expect(a.success && b.success && c.success).toBe(true);
    c.nodeResults.forEach((node, index) => {
      close(node.rx, a.nodeResults[index].rx + b.nodeResults[index].rx);
      close(node.ry, a.nodeResults[index].ry + b.nodeResults[index].ry);
      close(node.rm, a.nodeResults[index].rm + b.nodeResults[index].rm);
    });
    const sampleXs = [0.1, 1.5, 3, 4.5, 5.9];
    for (const x of sampleXs) {
      const ma = a.memberResults[0];
      const mb = b.memberResults[0];
      const mc = c.memberResults[0];
      const ca = evaluateDiagramAt(ma.diagramSegments, ma.diagramJumps, x)!;
      const cb = evaluateDiagramAt(mb.diagramSegments, mb.diagramJumps, x)!;
      const cc = evaluateDiagramAt(mc.diagramSegments, mc.diagramJumps, x)!;
      close(cc.moment, ca.moment + cb.moment, 2e-7);
    }
  });

  it('peso propio usa densidad, área y factor del caso de carga', () => {
    const model = project();
    const L = 4;
    const density = 7850;
    const A = 0.01;
    const g = 9.80665;
    const w = density * g * A / 1000;
    model.loadCases = [{ id: 'SW', name: 'Peso propio', category: 'permanent', active: true, selfWeightFactor: 1 }];
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B', 200e6, A, 8e-5), density, releases: { iMoment: true, jMoment: true } }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, w * L / 2, 3e-7);
    close(result.nodeResults[1].ry, w * L / 2, 3e-7);
    close(criticalValue(result, 'AB', 'moment', 'maximum'), w * L ** 2 / 8, 3e-7);
  });

  it('rodillo inclinado restringe solo la dirección normal', () => {
    const model = project();
    const angle = Math.PI / 4;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 45 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 10 * nx, fy: 10 * ny, mz: 0 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    const b = result.nodeResults.find((node) => node.nodeId === 'B')!;
    close(nx * b.ux + ny * b.uy, 0, 1e-8);
    close(b.supportTangentialReaction ?? 0, 0, 1e-8);
    close(result.equilibrium.sumFx, 0, 1e-8);
    close(result.equilibrium.sumFy, 0, 1e-8);
  });

  it('cambiar la unidad de visualización no cambia la solución interna', () => {
    const model = project();
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 3, y: 0, support: { type: 'none' } },
    ];
    model.members = [frame('AB', 'A', 'B')];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 12, fy: -18, mz: 0 }];
    const base = analyzeProject(model);
    model.settings.units = 'N-mm';
    const converted = analyzeProject(model);
    expect(base.success && converted.success).toBe(true);
    base.displacements.forEach((value, index) => close(converted.displacements[index], value, 1e-11, 1e-12));
    base.nodeResults.forEach((node, index) => {
      close(converted.nodeResults[index].rx, node.rx, 1e-11, 1e-12);
      close(converted.nodeResults[index].ry, node.ry, 1e-11, 1e-12);
      close(converted.nodeResults[index].rm, node.rm, 1e-11, 1e-12);
    });
  });

  it('la deformada integrada cierra con los desplazamientos nodales', () => {
    const model = project();
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 5, y: 0, support: { type: 'none' } },
    ];
    model.members = [frame('AB', 'A', 'B', 210e6, 0.015, 6e-5)];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: -9, qyEnd: -9 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    expect(result.memberResults[0].compatibilityError).toBeLessThan(1e-9);
  });

  it.each([0, 1])('excluye de los extremos N-V-M exteriores para una carga en x/L=%s', (position) => {
    const model = project();
    const L = 4;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'fixed' } },
    ];
    model.members = [frame('AB', 'A', 'B')];
    model.memberLoads = [
      {
        id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'local', lengthBasis: 'real',
        start: 0, end: 1, position, px: 7, py: -10,
      },
      {
        id: 'M', memberId: 'AB', caseId: 'LC1', type: 'moment', coordinateSystem: 'local', lengthBasis: 'real',
        start: 0, end: 1, position, moment: 5,
      },
    ];

    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    const member = result.memberResults[0];
    close(member.minAxial, 0);
    close(member.maxAxial, 0);
    close(member.minShear, 0);
    close(member.maxShear, 0);
    close(member.minMoment, 0);
    close(member.maxMoment, 0);
    const exteriorSide = position === 0 ? 'left' : 'right';
    expect(member.criticalPoints.some((point) => point.x === position * L
      && point.side === exteriorSide && Math.abs(point.value) > 0)).toBe(true);
  });

  it('cumple reciprocidad de Maxwell-Betti en un voladizo discretizado', () => {
    const model = project();
    model.loadCases = [
      { id: 'A', name: 'Unidad en B', category: 'variable', active: false },
      { id: 'B', name: 'Unidad en C', category: 'variable', active: false },
    ];
    model.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'N2', x: 2, y: 0, support: { type: 'none' } },
      { id: 'N3', x: 4, y: 0, support: { type: 'none' } },
    ];
    model.members = [frame('M1', 'N1', 'N2'), frame('M2', 'N2', 'N3')];
    model.nodalLoads = [
      { id: 'PA', nodeId: 'N2', caseId: 'A', fx: 0, fy: -1, mz: 0 },
      { id: 'PB', nodeId: 'N3', caseId: 'B', fx: 0, fy: -1, mz: 0 },
    ];
    const dueA = analyzeProject(model, { id: 'ca', name: 'A', factors: { A: 1, B: 0 } });
    const dueB = analyzeProject(model, { id: 'cb', name: 'B', factors: { A: 0, B: 1 } });
    expect(dueA.success && dueB.success).toBe(true);
    const displacementAtCFromB = dueA.nodeResults.find((node) => node.nodeId === 'N3')!.uy;
    const displacementAtBFromC = dueB.nodeResults.find((node) => node.nodeId === 'N2')!.uy;
    close(displacementAtCFromB, displacementAtBFromC, 3e-7, 1e-12);
  });

});

// AG-011: perfilado de fases del análisis completo. `beginProfiling`/`endProfiling` son
// opt-in (ver performanceProfiler.ts) y no afectan las pruebas de arriba, que nunca los llaman.
describe('perfilado de fases del analisis completo (AG-011)', () => {
  /** Cadena de vanos: el modelo mas barato para crecer grados de libertad (igual que performance.test.ts). */
  const continuousBeamModel = (spans: number): ProjectModel => {
    const nodes: NodeModel[] = [];
    const members: MemberModel[] = [];
    for (let index = 0; index <= spans; index += 1) {
      nodes.push({
        id: `N${index}`, x: index * 4, y: 0,
        support: index === 0 ? { type: 'pin' } : index % 4 === 0 ? { type: 'roller' } : { type: 'none' },
      });
    }
    for (let index = 0; index < spans; index += 1) {
      members.push({ id: `M${index}`, i: `N${index}`, j: `N${index + 1}`, type: 'frame', E: 200e6, A: 0.02, I: 8e-5 });
    }
    return {
      ...project(),
      id: `beam-${spans}`, name: `beam-${spans}`,
      nodes, members,
      memberLoads: members.map((member) => ({
        id: `w${member.id}`, memberId: member.id, caseId: 'LC1', type: 'distributed' as const,
        coordinateSystem: 'global' as const, lengthBasis: 'real' as const,
        start: 0, end: 1, qyStart: -10, qyEnd: -10,
      })),
    };
  };

  /** Portico multi-piso, empotrado en la base: nodos en malla, columnas + vigas. */
  const portalFrameModel = (bays: number, stories: number): ProjectModel => {
    const bayWidth = 5;
    const storyHeight = 3.5;
    const nodeId = (bay: number, story: number) => `B${bay}S${story}`;
    const nodes: NodeModel[] = [];
    for (let story = 0; story <= stories; story += 1) {
      for (let bay = 0; bay <= bays; bay += 1) {
        nodes.push({
          id: nodeId(bay, story), x: bay * bayWidth, y: story * storyHeight,
          support: story === 0 ? { type: 'fixed' } : { type: 'none' },
        });
      }
    }
    const members: MemberModel[] = [];
    for (let story = 0; story < stories; story += 1) {
      for (let bay = 0; bay <= bays; bay += 1) {
        members.push({ id: `C${bay}-${story}`, i: nodeId(bay, story), j: nodeId(bay, story + 1), type: 'frame', E: 200e6, A: 0.03, I: 1.2e-4 });
      }
    }
    for (let story = 1; story <= stories; story += 1) {
      for (let bay = 0; bay < bays; bay += 1) {
        members.push({ id: `G${bay}-${story}`, i: nodeId(bay, story), j: nodeId(bay + 1, story), type: 'frame', E: 200e6, A: 0.02, I: 8e-5 });
      }
    }
    const nodalLoads = nodes
      .filter((node) => node.y > 0 && node.x === 0)
      .map((node, index) => ({ id: `H${index}`, nodeId: node.id, caseId: 'LC1', fx: 5, fy: 0, mz: 0 }));
    const memberLoads = members
      .filter((member) => member.id.startsWith('G'))
      .map((member) => ({
        id: `w${member.id}`, memberId: member.id, caseId: 'LC1', type: 'distributed' as const,
        coordinateSystem: 'global' as const, lengthBasis: 'real' as const,
        start: 0, end: 1, qyStart: -8, qyEnd: -8,
      }));
    return { ...project(), id: `frame-${bays}x${stories}`, name: `frame-${bays}x${stories}`, nodes, members, nodalLoads, memberLoads };
  };

  /**
   * Cercha Pratt de cordones paralelos: `panels` paneles cuadrados totalmente triangulados
   * (cordon inferior/superior + vertical + diagonal en cada panel), estaticamente
   * determinada exacta (m + r = 2n) para cualquier `panels >= 1`.
   */
  const trussModel = (panels: number): ProjectModel => {
    const panelWidth = 3;
    const height = 3;
    const truss = (id: string, i: string, j: string): MemberModel => ({ id, i, j, type: 'truss', E: 200e6, A: 0.005, I: 0 });
    const nodes: NodeModel[] = [];
    for (let index = 0; index <= panels; index += 1) {
      nodes.push({
        id: `L${index}`, x: index * panelWidth, y: 0,
        support: index === 0 ? { type: 'pin' } : index === panels ? { type: 'roller', angleDeg: 90 } : { type: 'none' },
      });
      nodes.push({ id: `U${index}`, x: index * panelWidth, y: height, support: { type: 'none' } });
    }
    const members: MemberModel[] = [];
    for (let index = 0; index < panels; index += 1) {
      members.push(truss(`BC${index}`, `L${index}`, `L${index + 1}`));
      members.push(truss(`TC${index}`, `U${index}`, `U${index + 1}`));
      members.push(truss(`D${index}`, `L${index}`, `U${index + 1}`));
    }
    for (let index = 0; index <= panels; index += 1) {
      members.push(truss(`V${index}`, `L${index}`, `U${index}`));
    }
    const nodalLoads = nodes
      .filter((node) => node.id.startsWith('L') && node.id !== 'L0' && node.id !== `L${panels}`)
      .map((node, index) => ({ id: `P${index}`, nodeId: node.id, caseId: 'LC1', fx: 0, fy: -15, mz: 0 }));
    return { ...project(), id: `truss-${panels}`, name: `truss-${panels}`, nodes, members, nodalLoads };
  };

  const NAMED_PHASES = ['assembly', 'linearSolve', 'diagrams', 'deformations', 'auditAndReliability', 'explanation', 'educationTrace'] as const;

  const printPhaseTable = (label: string, memberCount: number, timings: PhaseTimings) => {
    const accounted = NAMED_PHASES.reduce((sum, phase) => sum + timings[phase], 0);
    const other = Math.max(0, timings.total - accounted);
    const rows = [
      ...NAMED_PHASES.map((phase) => ({
        fase: phase, ms: Number(timings[phase].toFixed(2)), '%': Number(((timings[phase] / timings.total) * 100).toFixed(1)),
      })),
      { fase: 'sin instrumentar', ms: Number(other.toFixed(2)), '%': Number(((other / timings.total) * 100).toFixed(1)) },
    ];
    // eslint-disable-next-line no-console
    console.log(`\n[AG-011] ${label} — ${memberCount} miembros — total ${timings.total.toFixed(1)} ms`);
    // eslint-disable-next-line no-console
    console.table(rows);
  };

  const profiled = (model: ProjectModel) => {
    beginProfiling();
    const result = analyzeProject(model);
    const timings = endProfiling();
    return { result, timings };
  };

  it('registra tiempos por fase con suma coherente con el total', () => {
    const { result, timings } = profiled(continuousBeamModel(20));
    expect(result.success).toBe(true);
    NAMED_PHASES.forEach((phase) => expect(timings[phase]).toBeGreaterThanOrEqual(0));
    const accounted = NAMED_PHASES.reduce((sum, phase) => sum + timings[phase], 0);
    expect(accounted).toBeLessThanOrEqual(timings.total + 1);
    expect(timings.assembly).toBeGreaterThan(0);
    expect(timings.linearSolve).toBeGreaterThan(0);
    expect(timings.diagrams).toBeGreaterThan(0);
  });

  // Fase 2 de AG-011: medicion real en vigas continuas, porticos y cerchas de ~50/150/300
  // miembros. Deliberadamente gateada por variable de entorno para no alargar `npm test`/
  // `npm run verify` con nueve analisis pesados en cada corrida; ejecutar con
  // `STRUCTURECO_PROFILE_ANALYSIS=1 npx vitest run src/engine/benchmarks.test.ts` para ver la
  // tabla completa por consola.
  it('mide la distribucion de tiempos en vigas, porticos y cerchas de 50/150/300 miembros', () => {
    if (process.env.STRUCTURECO_PROFILE_ANALYSIS !== '1') return;
    const scenarios: Array<{ label: string; model: ProjectModel }> = [
      { label: 'viga continua (50 vanos)', model: continuousBeamModel(50) },
      { label: 'viga continua (150 vanos)', model: continuousBeamModel(150) },
      { label: 'viga continua (300 vanos)', model: continuousBeamModel(300) },
      { label: 'portico 4x6 (~50 miembros)', model: portalFrameModel(4, 6) },
      { label: 'portico 7x10 (~150 miembros)', model: portalFrameModel(7, 10) },
      { label: 'portico 9x16 (~300 miembros)', model: portalFrameModel(9, 16) },
      { label: 'cercha Pratt 12 paneles (~50 miembros)', model: trussModel(12) },
      { label: 'cercha Pratt 37 paneles (~150 miembros)', model: trussModel(37) },
      { label: 'cercha Pratt 75 paneles (~300 miembros)', model: trussModel(75) },
    ];
    for (const scenario of scenarios) {
      const { result, timings } = profiled(scenario.model);
      expect(result.success).toBe(true);
      printPhaseTable(scenario.label, result.memberResults.length, timings);
    }
  }, 120_000);

  // AG-013: `educationTrace` (elementos + K/C) ahora es opt-out via
  // `includeEducationTrace: false`, para que el lienzo interactivo no pague el
  // costo medido arriba en cada edicion. Verifica en un modelo barato que
  // desactivar la traza no cambia ningun resultado numerico (paridad exigida
  // por la propuesta) y mide el speedup real en el caso de 300 miembros.
  it('includeEducationTrace: false omite la traza sin alterar ningun resultado numerico', () => {
    const model = continuousBeamModel(20);
    const withTrace = analyzeProject(model);
    const withoutTrace = analyzeProject(model, undefined, { includeEducationTrace: false });
    expect(withTrace.success && withoutTrace.success).toBe(true);
    expect(withTrace.educationTrace).toBeDefined();
    expect(withoutTrace.educationTrace).toBeUndefined();
    expect(withoutTrace.displacements).toEqual(withTrace.displacements);
    expect(withoutTrace.residualNorm).toBe(withTrace.residualNorm);
    withoutTrace.nodeResults.forEach((node, index) => {
      expect(node).toEqual(withTrace.nodeResults[index]);
    });
    withoutTrace.memberResults.forEach((member, index) => {
      expect(member).toEqual(withTrace.memberResults[index]);
    });
  });

  it('mide el speedup de includeEducationTrace:false en un modelo de 300 miembros', () => {
    if (process.env.STRUCTURECO_PROFILE_ANALYSIS !== '1') return;
    const model = continuousBeamModel(300);
    const runs = 3;
    const timeOf = (includeEducationTrace: boolean) => {
      const samples: number[] = [];
      for (let i = 0; i < runs; i += 1) {
        const start = performance.now();
        const result = analyzeProject(model, undefined, { includeEducationTrace });
        samples.push(performance.now() - start);
        expect(result.success).toBe(true);
      }
      return Math.min(...samples);
    };
    const before = timeOf(true);
    const after = timeOf(false);
    // eslint-disable-next-line no-console
    console.log(`\n[AG-013] viga continua (300 vanos) — antes (con traza) ${before.toFixed(1)} ms · despues (sin traza) ${after.toFixed(1)} ms · speedup ${(before / after).toFixed(2)}x`);
    expect(after).toBeLessThan(before);
  }, 60_000);
});
