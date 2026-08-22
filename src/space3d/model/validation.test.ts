import { describe, expect, it } from 'vitest';
import { createBlankSpace3DProject, createSpace3DPortalExample } from './defaultProject';
import { validateSpace3DProject } from './validation';
import { SPACE3D_LIMITS, fixedSpace3DRestraints, freeSpace3DRestraints, type Space3DFrameMember, type Space3DNode, type Space3DProjectV1 } from './types';

const codesOf = (project: Space3DProjectV1) => validateSpace3DProject(project).map((issue) => issue.code);

const clone = (project: Space3DProjectV1) => structuredClone(project) as {
  -readonly [K in keyof Space3DProjectV1]: Space3DProjectV1[K] extends readonly (infer T)[] ? T[] : Space3DProjectV1[K]
};

describe('Space3D project validation', () => {
  it('acepta el ejemplo canónico y el proyecto vacío sin issues', () => {
    expect(validateSpace3DProject(createSpace3DPortalExample())).toEqual([]);
    expect(validateSpace3DProject(createBlankSpace3DProject())).toEqual([]);
  });

  it('informa todas las referencias y propiedades inválidas sin mutar', () => {
    const project = createSpace3DPortalExample();
    const broken = structuredClone(project) as Space3DProjectV1 & {
      members: (Space3DFrameMember & { j: string; J: number })[];
    };
    broken.members[0].j = 'missing';
    broken.members[1].J = 0;
    const before = structuredClone(broken);
    const issues = validateSpace3DProject(broken);
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['missing-reference', 'invalid-property']));
    expect(broken).toEqual(before);
  });

  it('detecta identificadores duplicados y vacíos', () => {
    const broken = clone(createSpace3DPortalExample());
    broken.nodes.push({ ...broken.nodes[0], id: 'N1' } as Space3DNode);
    broken.members.push({ ...broken.members[0], id: '' } as Space3DFrameMember);
    const codes = codesOf(broken as unknown as Space3DProjectV1);
    expect(codes).toContain('duplicate-id');
    expect(codes).toContain('empty-id');
  });

  it('detecta coordenadas no finitas y fuera de rango', () => {
    const broken = clone(createSpace3DPortalExample());
    broken.nodes[0] = { ...broken.nodes[0], x: Number.NaN };
    broken.nodes[1] = { ...broken.nodes[1], z: SPACE3D_LIMITS.maxCoordinateMagnitude * 10 };
    const issues = validateSpace3DProject(broken as unknown as Space3DProjectV1);
    expect(issues.filter((issue) => issue.code === 'invalid-coordinate')).toHaveLength(2);
  });

  it('detecta propiedades no positivas en todos los campos físicos', () => {
    const broken = clone(createSpace3DPortalExample());
    broken.members[0] = { ...broken.members[0], E: 0, G: -1, A: Number.NaN, Iy: -2, Iz: 0, J: Number.POSITIVE_INFINITY };
    const fields = validateSpace3DProject(broken as unknown as Space3DProjectV1)
      .filter((issue) => issue.code === 'invalid-property')
      .map((issue) => issue.field);
    expect(fields).toEqual(['A', 'E', 'G', 'Iy', 'Iz', 'J']);
  });

  it('rechaza miembros degenerados y autorreferenciales', () => {
    const broken = clone(createSpace3DPortalExample());
    broken.nodes[3] = { ...broken.nodes[3], x: broken.nodes[0].x, y: broken.nodes[0].y, z: broken.nodes[0].z };
    broken.members.push({ ...broken.members[0], id: 'M9', i: 'N2', j: 'N2' } as Space3DFrameMember);
    const codes = codesOf(broken as unknown as Space3DProjectV1);
    expect(codes).toContain('degenerate-length');
    expect(codes).toContain('self-referential-member');
  });

  it('rechaza una referencia de orientación degenerada', () => {
    const broken = clone(createSpace3DPortalExample());
    broken.nodes[0] = { ...broken.nodes[0], x: 0, y: 0, z: 0 };
    broken.nodes[3] = { ...broken.nodes[3], x: 0, y: 4, z: 0 };
    broken.members[0] = { ...broken.members[0], orientation: { localYReferenceGlobal: [0, 3, 0], rollRadians: 0 } };
    expect(codesOf(broken as unknown as Space3DProjectV1)).toContain('degenerate-orientation');
  });

  it('rechaza cargas cuyo caso o nudo no existe', () => {
    const broken = clone(createSpace3DPortalExample());
    broken.nodalLoads[0] = { ...broken.nodalLoads[0], caseId: 'LC-ghost' };
    broken.nodalLoads.push({ ...broken.nodalLoads[0], id: 'L2', nodeId: 'N-ghost', caseId: 'LC1' });
    const issues = validateSpace3DProject(broken as unknown as Space3DProjectV1);
    expect(issues.map((issue) => issue.code)).toContain('missing-case');
    expect(issues.filter((issue) => issue.code === 'missing-reference').map((issue) => issue.entityId)).toContain('L2');
  });

  it('rechaza combinaciones que citan casos inexistentes o factores no finitos', () => {
    const broken = clone(createSpace3DPortalExample());
    broken.loadCombinations = [{ id: 'CO1', name: 'CO1', terms: [{ caseId: 'LC-ghost', factor: 1 }, { caseId: 'LC1', factor: Number.NaN }] }];
    const codes = codesOf(broken as unknown as Space3DProjectV1);
    expect(codes).toContain('missing-case');
    expect(codes).toContain('invalid-property');
  });

  it('rechaza campos desconocidos a nivel de proyecto y de entidad', () => {
    const broken = clone(createSpace3DPortalExample()) as unknown as Record<string, unknown>;
    broken.surprise = true;
    (broken.nodes as Record<string, unknown>[])[0].extra = 1;
    const issues = validateSpace3DProject(broken as unknown as Space3DProjectV1);
    expect(issues.filter((issue) => issue.code === 'unknown-field').map((issue) => issue.field)).toEqual(['extra', 'surprise']);
  });

  it('rechaza modelos por encima de los límites 150/300', () => {
    const nodes: Space3DNode[] = Array.from({ length: SPACE3D_LIMITS.maxNodes + 1 }, (_, index) => ({
      id: `N${index}`, x: index, y: 0, z: 0, restraints: index === 0 ? fixedSpace3DRestraints() : freeSpace3DRestraints(),
    }));
    const template = createSpace3DPortalExample().members[0];
    const members: Space3DFrameMember[] = Array.from({ length: SPACE3D_LIMITS.maxMembers + 1 }, (_, index) => ({
      ...template, id: `M${index}`, i: 'N0', j: 'N1',
    }));
    const project = { ...createBlankSpace3DProject(), nodes, members } as unknown as Space3DProjectV1;
    const limits = validateSpace3DProject(project).filter((issue) => issue.code === 'limit-exceeded');
    expect(limits.map((issue) => issue.field)).toEqual(['members', 'nodes']);
  });

  it('ordena los issues por entidad, id y código de forma determinista', () => {
    const broken = clone(createSpace3DPortalExample());
    broken.members[2] = { ...broken.members[2], A: 0 };
    broken.members[0] = { ...broken.members[0], E: 0 };
    const issues = validateSpace3DProject(broken as unknown as Space3DProjectV1);
    expect(issues.map((issue) => `${issue.entityKind}:${issue.entityId}:${issue.field}`))
      .toEqual(['member:M1:E', 'member:M3:A']);
  });
});
