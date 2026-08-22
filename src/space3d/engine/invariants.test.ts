import { describe, expect, it } from 'vitest';
import { analyzeSpace3DProject } from './solver';
import { spaceFrameLocalStiffness } from './element';
import { buildMemberOrientation } from './orientation';
import { axialCantilever, bendingCantilever, torsionCantilever } from './fixtures';
import { createSpace3DPortalExample } from '../model/defaultProject';
import type { Space3DAnalysisResult, Space3DProjectV1, Space3DVector } from '../model/types';

const node = (result: Space3DAnalysisResult, id: string) => result.nodeResults.find((item) => item.nodeId === id)!;

const expectRelClose = (actual: number, expected: number, rtol = 1e-9, atol = 1e-14) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(atol + rtol * Math.abs(expected));
};

/** Rotación de Rodrigues alrededor de un eje unitario arbitrario. */
const rotationMatrix = (axis: Space3DVector, angle: number): number[][] => {
  const length = Math.hypot(...axis);
  const [x, y, z] = axis.map((value) => value / length);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
};

const apply = (R: number[][], v: Space3DVector): Space3DVector => [
  R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
  R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
  R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2],
];

const rotateProject = (project: Space3DProjectV1, R: number[][]): Space3DProjectV1 => ({
  ...project,
  nodes: project.nodes.map((item) => {
    const [x, y, z] = apply(R, [item.x, item.y, item.z]);
    return { ...item, x, y, z };
  }),
  members: project.members.map((item) => ({
    ...item,
    orientation: { ...item.orientation, localYReferenceGlobal: apply(R, item.orientation.localYReferenceGlobal) },
  })),
  nodalLoads: project.nodalLoads.map((item) => {
    const [fx, fy, fz] = apply(R, [item.fx, item.fy, item.fz]);
    const [mx, my, mz] = apply(R, [item.mx, item.my, item.mz]);
    return { ...item, fx, fy, fz, mx, my, mz };
  }),
});

const scaleLoads = (project: Space3DProjectV1, factor: number): Space3DProjectV1 => ({
  ...project,
  nodalLoads: project.nodalLoads.map((item) => ({
    ...item,
    fx: item.fx * factor, fy: item.fy * factor, fz: item.fz * factor,
    mx: item.mx * factor, my: item.my * factor, mz: item.mz * factor,
  })),
});

describe('Space3D physical invariants', () => {
  it('es lineal en las cargas', () => {
    const project = createSpace3DPortalExample();
    const single = analyzeSpace3DProject(project, 'LC1');
    const tripled = analyzeSpace3DProject(scaleLoads(project, 3), 'LC1');
    expect(tripled.success).toBe(true);
    for (const key of ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const) {
      expectRelClose(node(tripled, 'N4').displacement[key], 3 * node(single, 'N4').displacement[key], 1e-9);
      expectRelClose(node(tripled, 'N1').reaction[key], 3 * node(single, 'N1').reaction[key], 1e-8);
    }
  });

  it('es covariante ante una rotación rígida global del modelo y sus cargas', () => {
    const project = createSpace3DPortalExample();
    const R = rotationMatrix([1, 2, 3], 0.7);
    const original = analyzeSpace3DProject(project, 'LC1');
    const rotated = analyzeSpace3DProject(rotateProject(project, R), 'LC1');
    expect(rotated.success).toBe(true);

    const displacement = node(original, 'N4').displacement;
    const expectedTranslation = apply(R, [displacement.ux, displacement.uy, displacement.uz]);
    const expectedRotation = apply(R, [displacement.rx, displacement.ry, displacement.rz]);
    const actual = node(rotated, 'N4').displacement;
    [actual.ux, actual.uy, actual.uz].forEach((value, index) => expectRelClose(value, expectedTranslation[index], 1e-8, 1e-15));
    [actual.rx, actual.ry, actual.rz].forEach((value, index) => expectRelClose(value, expectedRotation[index], 1e-8, 1e-15));
  });

  it('trata un roll de 2π como un roll nulo', () => {
    const base = bendingCantilever({ axis: 'y' });
    const rolled: Space3DProjectV1 = {
      ...base,
      members: base.members.map((item) => ({ ...item, orientation: { ...item.orientation, rollRadians: 2 * Math.PI } })),
    };
    const a = analyzeSpace3DProject(base, 'LC1');
    const b = analyzeSpace3DProject(rolled, 'LC1');
    expectRelClose(node(b, 'J').displacement.uy, node(a, 'J').displacement.uy, 1e-8);
    expectRelClose(node(b, 'J').displacement.rz, node(a, 'J').displacement.rz, 1e-8);
  });

  it('es invariante ante la renumeración de nudos y miembros', () => {
    const project = createSpace3DPortalExample();
    const shuffled: Space3DProjectV1 = {
      ...project,
      nodes: [...project.nodes].reverse(),
      members: [...project.members].reverse(),
    };
    const original = analyzeSpace3DProject(project, 'LC1');
    const reordered = analyzeSpace3DProject(shuffled, 'LC1');
    expect(reordered.success).toBe(true);
    for (const item of original.nodeResults) {
      const twin = node(reordered, item.nodeId);
      for (const key of ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const) {
        expectRelClose(twin.displacement[key], item.displacement[key], 1e-8, 1e-16);
        expectRelClose(twin.reaction[key], item.reaction[key], 1e-8, 1e-9);
      }
    }
  });

  it('con Iy = Iz responde igual a fy y a fz', () => {
    const I = 5e-5;
    const inPlane = analyzeSpace3DProject(bendingCantilever({ axis: 'y', Iy: I, Iz: I }), 'LC1');
    const outOfPlane = analyzeSpace3DProject(bendingCantilever({ axis: 'z', Iy: I, Iz: I }), 'LC1');
    expectRelClose(node(outOfPlane, 'J').displacement.uz, node(inPlane, 'J').displacement.uy, 1e-12);
    expectRelClose(node(outOfPlane, 'J').displacement.ry, -node(inPlane, 'J').displacement.rz, 1e-12);
  });

  it('disipa energía de deformación no negativa', () => {
    const project = createSpace3DPortalExample();
    const result = analyzeSpace3DProject(project, 'LC1');
    const work = project.nodalLoads.reduce((sum, load) => {
      const u = node(result, load.nodeId).displacement;
      return sum + load.fx * u.ux + load.fy * u.uy + load.fz * u.uz
        + load.mx * u.rx + load.my * u.ry + load.mz * u.rz;
    }, 0);
    expect(work).toBeGreaterThan(0);
  });
});

describe('Space3D mutation guards', () => {
  it('falla si se intercambian Iy e Iz', () => {
    const straight = analyzeSpace3DProject(bendingCantilever({ axis: 'y', Iy: 3e-5, Iz: 8e-5 }), 'LC1');
    const swapped = analyzeSpace3DProject(bendingCantilever({ axis: 'y', Iy: 8e-5, Iz: 3e-5 }), 'LC1');
    const ratio = node(swapped, 'J').displacement.uy / node(straight, 'J').displacement.uy;
    expect(ratio).toBeCloseTo(8e-5 / 3e-5, 9);
    // El plano x–z no participa cuando la carga es fy.
    expect(node(straight, 'J').displacement.uz).toBeCloseTo(0, 18);
  });

  it('falla si desaparece el término GJ', () => {
    const k = spaceFrameLocalStiffness({ E: 1, G: 7, A: 1, Iy: 1, Iz: 1, J: 3 }, 2);
    expect(k[3][3]).toBe(7 * 3 / 2);
    const result = analyzeSpace3DProject(torsionCantilever({ T: 10, G: 80_000_000, J: 2e-5, L: 2 }), 'LC1');
    expect(node(result, 'J').displacement.rx).toBeGreaterThan(0);
    expect(Number.isFinite(node(result, 'J').displacement.rx)).toBe(true);
  });

  it('falla si la terna local se construye como cross(y, x)', () => {
    const basis = buildMemberOrientation([0, 0, 0], [3, 0, 0], { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 });
    expect(basis.z[2]).toBeCloseTo(1, 15);
    expect(basis.z[2]).not.toBeCloseTo(-1, 1);
  });

  it('falla si el roll se interpreta en grados', () => {
    const basis = buildMemberOrientation([0, 0, 0], [1, 0, 0], { localYReferenceGlobal: [0, 1, 0], rollRadians: 90 });
    expect(basis.y[1]).toBeCloseTo(Math.cos(90), 12);
    expect(basis.y[1]).not.toBeCloseTo(0, 6);
  });

  it('falla si cambia el orden rx/ry/rz de los grados de libertad', () => {
    const project = torsionCantilever({ T: 10 });
    const result = analyzeSpace3DProject(project, 'LC1');
    const free = node(result, 'J').displacement;
    expect(Math.abs(free.rx)).toBeGreaterThan(0);
    expect(free.ry).toBeCloseTo(0, 18);
    expect(free.rz).toBeCloseTo(0, 18);

    const aboutY = analyzeSpace3DProject(
      { ...project, nodalLoads: project.nodalLoads.map((load) => ({ ...load, mx: 0, my: 10 })) },
      'LC1',
    );
    expect(Math.abs(node(aboutY, 'J').displacement.ry)).toBeGreaterThan(0);
    expect(node(aboutY, 'J').displacement.rx).toBeCloseTo(0, 18);
  });

  it('falla si el axil deja de escalar con EA/L', () => {
    const a = analyzeSpace3DProject(axialCantilever({ P: 100, A: 0.01, L: 2 }), 'LC1');
    const b = analyzeSpace3DProject(axialCantilever({ P: 100, A: 0.02, L: 2 }), 'LC1');
    expectRelClose(node(b, 'J').displacement.ux, node(a, 'J').displacement.ux / 2, 1e-10);
  });
});
