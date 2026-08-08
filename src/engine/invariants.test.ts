/**
 * Structural invariants that must hold whatever the model happens to be.
 *
 * These complement the closed benchmarks and the FTool comparison matrix: those check
 * that one specific answer is right, while these check that the *relations between*
 * answers are right. A solver can pass a benchmark by luck; it cannot pass homogeneity,
 * superposition, subdivision and rigid-body invariance by luck.
 *
 * Everything here is deterministic — no random input, no property-testing dependency.
 */
import { describe, expect, it } from 'vitest';
import { analyzeProject } from './solver';
import { normalizeProject } from '../data/migrate';
import type { AnalysisResult, ProjectModel } from '../types';

const settings: ProjectModel['settings'] = {
  units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
  showNodeLabels: true, showMemberLabels: false, showLocalAxes: false,
  showLoads: true, showDimensions: true, showResultValues: true,
  diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
};

/** A portal frame: hyperstatic, inclined nothing, both nodal and member loads. */
const portalFrame = (): ProjectModel => ({
  schemaVersion: 2,
  id: 'invariants',
  name: 'Portico de invariantes',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 0, y: 4, support: { type: 'none' } },
    { id: 'C', x: 6, y: 4, support: { type: 'none' } },
    { id: 'D', x: 6, y: 0, support: { type: 'pin' } },
  ],
  members: [
    { id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
    { id: 'BC', i: 'B', j: 'C', type: 'frame', E: 200e6, A: 0.03, I: 1.2e-4 },
    { id: 'CD', i: 'C', j: 'D', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
  ],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [{ id: 'H', nodeId: 'B', caseId: 'LC1', fx: 14, fy: 0, mz: 5 }],
  memberLoads: [{
    id: 'w', memberId: 'BC', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
    lengthBasis: 'real', start: 0, end: 1, qyStart: -9, qyEnd: -9,
  }],
  settings: { ...settings },
});

/** A simply supported beam, for the subdivision invariant. */
const simpleBeam = (): ProjectModel => ({
  ...portalFrame(),
  id: 'beam',
  name: 'Viga simple',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 8, y: 0, support: { type: 'roller' } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }],
  nodalLoads: [],
  memberLoads: [{
    id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
    lengthBasis: 'real', start: 0, end: 1, qyStart: -12, qyEnd: -12,
  }],
});

const close = (actual: number, expected: number, scale = 1, rtol = 1e-8) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(rtol * Math.max(Math.abs(scale), 1));
};

const solved = (model: ProjectModel): AnalysisResult => {
  const result = analyzeProject(model);
  expect(result.success).toBe(true);
  return result;
};

const reactionScale = (result: AnalysisResult): number =>
  Math.max(1, ...result.nodeResults.flatMap((node) => [Math.abs(node.rx), Math.abs(node.ry), Math.abs(node.rm)]));

const memberScale = (result: AnalysisResult): number =>
  Math.max(1, ...result.memberResults.flatMap((member) => [
    Math.abs(member.maxAxial), Math.abs(member.minAxial),
    Math.abs(member.maxShear), Math.abs(member.minShear),
    Math.abs(member.maxMoment), Math.abs(member.minMoment),
  ]));

const scaleLoads = (model: ProjectModel, factor: number): ProjectModel => ({
  ...model,
  nodalLoads: model.nodalLoads.map((load) => ({ ...load, fx: load.fx * factor, fy: load.fy * factor, mz: load.mz * factor })),
  memberLoads: model.memberLoads.map((load) => ({
    ...load,
    ...(load.qxStart === undefined ? {} : { qxStart: load.qxStart * factor }),
    ...(load.qxEnd === undefined ? {} : { qxEnd: load.qxEnd * factor }),
    ...(load.qyStart === undefined ? {} : { qyStart: load.qyStart * factor }),
    ...(load.qyEnd === undefined ? {} : { qyEnd: load.qyEnd * factor }),
    ...(load.px === undefined ? {} : { px: load.px * factor }),
    ...(load.py === undefined ? {} : { py: load.py * factor }),
    ...(load.moment === undefined ? {} : { moment: load.moment * factor }),
  })),
});

const translate = (model: ProjectModel, dx: number, dy: number): ProjectModel => ({
  ...model,
  nodes: model.nodes.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy })),
});

/** Rotates geometry and any global-axis load by the same angle. */
const rotate = (model: ProjectModel, radians: number): ProjectModel => {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return {
    ...model,
    nodes: model.nodes.map((node) => ({ ...node, x: node.x * c - node.y * s, y: node.x * s + node.y * c })),
    nodalLoads: model.nodalLoads.map((load) => ({
      ...load,
      fx: load.fx * c - load.fy * s,
      fy: load.fx * s + load.fy * c,
    })),
    memberLoads: model.memberLoads.map((load) => {
      if (load.coordinateSystem !== 'global') return load;
      const qxStart = load.qxStart ?? 0;
      const qyStart = load.qyStart ?? 0;
      const qxEnd = load.qxEnd ?? 0;
      const qyEnd = load.qyEnd ?? 0;
      const px = load.px ?? 0;
      const py = load.py ?? 0;
      return {
        ...load,
        qxStart: qxStart * c - qyStart * s,
        qyStart: qxStart * s + qyStart * c,
        qxEnd: qxEnd * c - qyEnd * s,
        qyEnd: qxEnd * s + qyEnd * c,
        ...(load.px === undefined && load.py === undefined ? {} : {
          px: px * c - py * s,
          py: px * s + py * c,
        }),
      };
    }),
  };
};

const nodeResult = (result: AnalysisResult, nodeId: string) =>
  result.nodeResults.find((node) => node.nodeId === nodeId)!;

describe('invariantes estructurales', () => {
  it('el fixture es no trivial, para que los invariantes no se cumplan por vacuidad', () => {
    const base = solved(portalFrame());
    // Hyperstatic frame: every support carries force, and every member is stressed.
    expect(Math.abs(nodeResult(base, 'A').rm)).toBeGreaterThan(1);
    expect(Math.abs(nodeResult(base, 'A').rx)).toBeGreaterThan(1);
    expect(Math.abs(nodeResult(base, 'D').ry)).toBeGreaterThan(1);
    for (const member of base.memberResults) {
      expect(Math.abs(member.maxMoment) + Math.abs(member.minMoment)).toBeGreaterThan(1);
    }
    // A rotation must genuinely move the model, or the rotation invariant proves nothing.
    const turned = solved(rotate(portalFrame(), Math.PI / 5));
    expect(Math.abs(nodeResult(turned, 'A').rx - nodeResult(base, 'A').rx)).toBeGreaterThan(1);
  });

  it('duplicar las cargas duplica exactamente la respuesta', () => {
    const base = solved(portalFrame());
    const doubled = solved(scaleLoads(portalFrame(), 2));
    const scale = reactionScale(doubled);

    for (const node of base.nodeResults) {
      const twin = nodeResult(doubled, node.nodeId);
      close(twin.rx, 2 * node.rx, scale);
      close(twin.ry, 2 * node.ry, scale);
      close(twin.rm, 2 * node.rm, scale);
      close(twin.ux, 2 * node.ux, Math.max(1e-6, Math.abs(node.ux)));
      close(twin.uy, 2 * node.uy, Math.max(1e-6, Math.abs(node.uy)));
    }
    for (const member of base.memberResults) {
      const twin = doubled.memberResults.find((item) => item.memberId === member.memberId)!;
      close(twin.maxMoment, 2 * member.maxMoment, memberScale(doubled));
      close(twin.minShear, 2 * member.minShear, memberScale(doubled));
    }
  });

  it('un factor arbitrario escala la respuesta de forma homogenea', () => {
    const base = solved(portalFrame());
    for (const factor of [0.25, 3.5, 100]) {
      const scaled = solved(scaleLoads(portalFrame(), factor));
      const scale = reactionScale(scaled);
      for (const node of base.nodeResults) {
        const twin = nodeResult(scaled, node.nodeId);
        close(twin.rx, factor * node.rx, scale);
        close(twin.ry, factor * node.ry, scale);
        close(twin.rm, factor * node.rm, scale);
      }
    }
  });

  it('invertir las cargas invierte la respuesta', () => {
    const base = solved(portalFrame());
    const inverted = solved(scaleLoads(portalFrame(), -1));
    const scale = reactionScale(base);

    for (const node of base.nodeResults) {
      const twin = nodeResult(inverted, node.nodeId);
      close(twin.rx, -node.rx, scale);
      close(twin.ry, -node.ry, scale);
      close(twin.rm, -node.rm, scale);
    }
    for (const member of base.memberResults) {
      const twin = inverted.memberResults.find((item) => item.memberId === member.memberId)!;
      // Max and min swap sign and role under inversion.
      close(twin.maxMoment, -member.minMoment, memberScale(base));
      close(twin.minMoment, -member.maxMoment, memberScale(base));
    }
  });

  it('anular las cargas anula la respuesta sin dejar residuo espurio', () => {
    const zero = solved(scaleLoads(portalFrame(), 0));
    for (const node of zero.nodeResults) {
      close(node.rx, 0);
      close(node.ry, 0);
      close(node.rm, 0);
    }
  });

  it('dividir un miembro en dos colineales conserva la solucion fisica', () => {
    const whole = solved(simpleBeam());

    const split = simpleBeam();
    split.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'M', x: 3, y: 0, support: { type: 'none' } },
      { id: 'B', x: 8, y: 0, support: { type: 'roller' } },
    ];
    split.members = [
      { id: 'AM', i: 'A', j: 'M', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
      { id: 'MB', i: 'M', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
    ];
    // The same total load, expressed as two abutting spans.
    split.memberLoads = [
      { id: 'w1', memberId: 'AM', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -12, qyEnd: -12 },
      { id: 'w2', memberId: 'MB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -12, qyEnd: -12 },
    ];
    const divided = solved(split);
    const scale = reactionScale(whole);

    for (const id of ['A', 'B']) {
      close(nodeResult(divided, id).ry, nodeResult(whole, id).ry, scale, 1e-7);
      close(nodeResult(divided, id).rx, nodeResult(whole, id).rx, scale, 1e-7);
    }
    // The introduced node is free: it must carry no reaction at all.
    close(nodeResult(divided, 'M').ry, 0, scale);
    close(nodeResult(divided, 'M').rm, 0, scale);

    // Midspan moment of a simply supported uniform beam: wL^2/8.
    const wholeMax = Math.max(...whole.memberResults.map((member) => member.maxMoment));
    const dividedMax = Math.max(...divided.memberResults.map((member) => member.maxMoment));
    close(dividedMax, wholeMax, memberScale(whole), 1e-7);
    close(wholeMax, 12 * 8 ** 2 / 8, memberScale(whole), 1e-7);
  });

  it('trasladar el modelo no cambia reacciones ni esfuerzos internos', () => {
    const base = solved(portalFrame());
    for (const [dx, dy] of [[1000, -750], [-1e5, 1e5]] as const) {
      const moved = solved(translate(portalFrame(), dx, dy));
      const scale = reactionScale(base);
      for (const node of base.nodeResults) {
        const twin = nodeResult(moved, node.nodeId);
        close(twin.rx, node.rx, scale, 1e-6);
        close(twin.ry, node.ry, scale, 1e-6);
        // A moment reaction is taken about the node itself, so translation cannot alter it.
        close(twin.rm, node.rm, scale, 1e-6);
      }
      for (const member of base.memberResults) {
        const twin = moved.memberResults.find((item) => item.memberId === member.memberId)!;
        close(twin.maxMoment, member.maxMoment, memberScale(base), 1e-6);
        close(twin.minShear, member.minShear, memberScale(base), 1e-6);
      }
    }
  });

  it('rotar el modelo completo transforma las reacciones y conserva los esfuerzos locales', () => {
    const base = solved(portalFrame());
    const angle = Math.PI / 5;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const turned = solved(rotate(portalFrame(), angle));
    const scale = reactionScale(base);

    for (const node of base.nodeResults) {
      const twin = nodeResult(turned, node.nodeId);
      // Reactions live in global axes, so they rotate with the model.
      close(twin.rx, node.rx * c - node.ry * s, scale, 1e-6);
      close(twin.ry, node.rx * s + node.ry * c, scale, 1e-6);
      // A moment about the out-of-plane axis is invariant under an in-plane rotation.
      close(twin.rm, node.rm, scale, 1e-6);
    }
    for (const member of base.memberResults) {
      const twin = turned.memberResults.find((item) => item.memberId === member.memberId)!;
      // N, V and M are expressed in member-local axes, which rotated with the member.
      close(twin.maxAxial, member.maxAxial, memberScale(base), 1e-6);
      close(twin.maxShear, member.maxShear, memberScale(base), 1e-6);
      close(twin.maxMoment, member.maxMoment, memberScale(base), 1e-6);
      close(twin.minMoment, member.minMoment, memberScale(base), 1e-6);
    }
  });

  it('un giro completo de 2 pi devuelve exactamente el mismo modelo resuelto', () => {
    const base = solved(portalFrame());
    const turned = solved(rotate(portalFrame(), 2 * Math.PI));
    const scale = reactionScale(base);
    for (const node of base.nodeResults) {
      const twin = nodeResult(turned, node.nodeId);
      close(twin.rx, node.rx, scale, 1e-6);
      close(twin.ry, node.ry, scale, 1e-6);
    }
  });

  it('guardar y volver a abrir el proyecto reproduce el mismo analisis', () => {
    const original = portalFrame();
    const base = solved(original);

    // The exact path an exported .structureco.json takes back into the app.
    const restored = normalizeProject(JSON.parse(JSON.stringify(original)) as unknown);
    const again = solved(restored);

    expect(again.nodeResults).toHaveLength(base.nodeResults.length);
    const scale = reactionScale(base);
    for (const node of base.nodeResults) {
      const twin = nodeResult(again, node.nodeId);
      close(twin.rx, node.rx, scale, 1e-12);
      close(twin.ry, node.ry, scale, 1e-12);
      close(twin.rm, node.rm, scale, 1e-12);
      close(twin.ux, node.ux, Math.max(1e-9, Math.abs(node.ux)), 1e-12);
    }
    for (const member of base.memberResults) {
      const twin = again.memberResults.find((item) => item.memberId === member.memberId)!;
      expect(twin.maxMoment).toBe(member.maxMoment);
      expect(twin.minShear).toBe(member.minShear);
    }
  });

  it('reordenar nodos, miembros y cargas no cambia el resultado', () => {
    const base = solved(portalFrame());
    const shuffled = portalFrame();
    shuffled.nodes = [...shuffled.nodes].reverse();
    shuffled.members = [...shuffled.members].reverse();
    shuffled.memberLoads = [...shuffled.memberLoads].reverse();
    const again = solved(shuffled);
    const scale = reactionScale(base);

    for (const node of base.nodeResults) {
      const twin = nodeResult(again, node.nodeId);
      close(twin.rx, node.rx, scale, 1e-7);
      close(twin.ry, node.ry, scale, 1e-7);
      close(twin.rm, node.rm, scale, 1e-7);
    }
  });

  it('el analisis es reproducible: dos ejecuciones dan bits identicos', () => {
    const first = solved(portalFrame());
    const second = solved(portalFrame());
    expect(second.nodeResults).toEqual(first.nodeResults);
    expect(second.memberResults.map((member) => member.maxMoment))
      .toEqual(first.memberResults.map((member) => member.maxMoment));
  });
});
