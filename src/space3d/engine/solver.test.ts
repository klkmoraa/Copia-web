import { describe, expect, it } from 'vitest';
import { analyzeSpace3DProject } from './solver';
import { axialCantilever, bendingCantilever, freeFloatingMember, torsionCantilever } from './fixtures';
import { createSpace3DPortalExample } from '../model/defaultProject';
import type { Space3DAnalysisResult } from '../model/types';

const node = (result: Space3DAnalysisResult, id: string) => result.nodeResults.find((item) => item.nodeId === id)!;
const memberOf = (result: Space3DAnalysisResult, id: string) => result.memberResults.find((item) => item.memberId === id)!;

describe('Space3D static solver', () => {
  it('resuelve barra axial espacial con PL/EA', () => {
    const project = axialCantilever({ L: 2, E: 200_000_000, A: 0.01, P: 100 });
    const result = analyzeSpace3DProject(project, 'LC1');
    expect(result.success).toBe(true);
    expect(node(result, 'J').displacement.ux).toBeCloseTo(100 * 2 / (200_000_000 * 0.01), 12);
    expect(node(result, 'I').reaction.ux).toBeCloseTo(-100, 10);
  });

  it('resuelve torsión con TL/GJ', () => {
    const project = torsionCantilever({ L: 2, G: 80_000_000, J: 2e-5, T: 10 });
    const result = analyzeSpace3DProject(project, 'LC1');
    expect(node(result, 'J').displacement.rx).toBeCloseTo(10 * 2 / (80_000_000 * 2e-5), 12);
    expect(node(result, 'I').reaction.rx).toBeCloseTo(-10, 10);
  });

  it('flexiona en el plano x-y con Iz: PL³/(3EIz) y PL²/(2EIz)', () => {
    const L = 2;
    const E = 200_000_000;
    const Iz = 8e-5;
    const P = 10;
    const result = analyzeSpace3DProject(bendingCantilever({ axis: 'y', L, E, Iz, Iy: 3e-5, P }), 'LC1');
    expect(result.success).toBe(true);
    expect(node(result, 'J').displacement.uy).toBeCloseTo(P * L ** 3 / (3 * E * Iz), 12);
    expect(node(result, 'J').displacement.rz).toBeCloseTo(P * L ** 2 / (2 * E * Iz), 12);
    expect(node(result, 'J').displacement.uz).toBeCloseTo(0, 15);
    expect(node(result, 'I').reaction.uy).toBeCloseTo(-P, 9);
    expect(node(result, 'I').reaction.rz).toBeCloseTo(-P * L, 9);
  });

  it('flexiona en el plano x-z con Iy: PL³/(3EIy) y -PL²/(2EIy)', () => {
    const L = 2;
    const E = 200_000_000;
    const Iy = 3e-5;
    const P = 10;
    const result = analyzeSpace3DProject(bendingCantilever({ axis: 'z', L, E, Iy, Iz: 8e-5, P }), 'LC1');
    expect(result.success).toBe(true);
    expect(node(result, 'J').displacement.uz).toBeCloseTo(P * L ** 3 / (3 * E * Iy), 12);
    expect(node(result, 'J').displacement.ry).toBeCloseTo(-P * L ** 2 / (2 * E * Iy), 12);
    expect(node(result, 'J').displacement.uy).toBeCloseTo(0, 15);
    expect(node(result, 'I').reaction.uz).toBeCloseTo(-P, 9);
    expect(node(result, 'I').reaction.ry).toBeCloseTo(P * L, 9);
  });

  it('publica acciones de extremo en ejes locales coherentes con el axil aplicado', () => {
    const result = analyzeSpace3DProject(axialCantilever({ P: 100 }), 'LC1');
    const member = memberOf(result, 'M1');
    expect(member.length).toBeCloseTo(2, 12);
    expect(member.start.N).toBeCloseTo(-100, 9);
    expect(member.end.N).toBeCloseTo(100, 9);
    expect(member.basis.x).toEqual([1, 0, 0]);
  });

  it('audita equilibrio 6D en el marco espacial de ejemplo', () => {
    const result = analyzeSpace3DProject(createSpace3DPortalExample(), 'LC1');
    expect(result.success).toBe(true);
    expect(result.diagnostics.freeDofCount).toBe(6);
    expect(result.diagnostics.dofCount).toBe(24);
    expect(result.diagnostics.equilibrium.normalized).toBeLessThan(1e-9);
    expect(result.diagnostics.relativeResidual).toBeLessThan(1e-9);
    result.nodeResults.forEach((item) => {
      Object.values(item.displacement).forEach((value) => expect(Number.isFinite(value)).toBe(true));
      Object.values(item.reaction).forEach((value) => expect(Number.isFinite(value)).toBe(true));
    });
  });

  it('resuelve combinaciones lineales como superposición exacta', () => {
    const project = createSpace3DPortalExample();
    const single = analyzeSpace3DProject(project, 'LC1');
    const doubled = analyzeSpace3DProject(
      { ...project, loadCombinations: [{ id: 'CO2', name: 'CO2', terms: [{ caseId: 'LC1', factor: 2 }] }] },
      'CO2',
    );
    expect(doubled.targetKind).toBe('combination');
    expect(doubled.success).toBe(true);
    expect(doubled.nodeResults[3].displacement.uy).toBeCloseTo(2 * single.nodeResults[3].displacement.uy, 12);
    expect(doubled.nodeResults[3].displacement.uz).toBeCloseTo(2 * single.nodeResults[3].displacement.uz, 12);
    expect(doubled.nodeResults[0].reaction.uy).toBeCloseTo(2 * single.nodeResults[0].reaction.uy, 9);
    // El nudo libre no acumula reacción en ningún GDL.
    expect(Object.values(doubled.nodeResults[3].reaction).every((value) => value === 0)).toBe(true);
  });

  it('no publica resultados utilizables para un mecanismo', () => {
    const result = analyzeSpace3DProject(freeFloatingMember(), 'LC1');
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'mechanism')).toBe(true);
    expect(result.nodeResults).toEqual([]);
    expect(result.memberResults).toEqual([]);
  });

  it('falla cerrado ante un objetivo inexistente, un modelo vacío y un modelo inválido', () => {
    const unknown = analyzeSpace3DProject(axialCantilever(), 'LC-ghost');
    expect(unknown.success).toBe(false);
    expect(unknown.issues.map((issue) => issue.code)).toContain('unknown-target');

    const empty = analyzeSpace3DProject({ ...axialCantilever(), nodes: [], members: [], nodalLoads: [] }, 'LC1');
    expect(empty.success).toBe(false);
    expect(empty.issues.map((issue) => issue.code)).toContain('empty-model');

    const invalid = axialCantilever();
    const broken = { ...invalid, members: [{ ...invalid.members[0], A: 0 }] };
    const result = analyzeSpace3DProject(broken, 'LC1');
    expect(result.success).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('invalid-property');
    expect(result.nodeResults).toEqual([]);
  });

  it('no muta el proyecto de entrada', () => {
    const project = createSpace3DPortalExample();
    const before = structuredClone(project);
    analyzeSpace3DProject(project, 'LC1');
    expect(project).toEqual(before);
  });
});
