import { describe, expect, it } from 'vitest';
import type { ProjectModel, Selection } from '../types';
import {
  applyPreparedStructuralEdit,
  createStructuralEditGeometryPreview,
  prepareStructuralEdit,
  reflectPointAcrossLine,
  resolveStructuralSelection,
  rotatePoint,
  translatePoint,
  validateStructuralEditBoundary,
} from './structuralEditing';

const fixture = (): ProjectModel => ({
  schemaVersion: 6,
  id: 'advanced-editing-fixture',
  name: 'Edición avanzada',
  nodes: [
    { id: 'A', x: -4, y: 0, support: { type: 'pin' }, internalHinge: true },
    { id: 'B', x: 2, y: 1, support: { type: 'roller', angleDeg: 90 } },
    { id: 'C', x: 10, y: 4, support: { type: 'none' } },
    { id: 'D', x: -2, y: -3, support: { type: 'fixed' } },
  ],
  members: [
    {
      id: 'AB', i: 'A', j: 'B', type: 'frame', label: 'Viga AB',
      materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'ipe-300', sectionOrigin: 'catalog',
      E: 200e6, A: 0.01, I: 8e-5, G: 76.9e6, shearArea: 0.008,
      releases: { iMoment: true }, rotationalSpringJ: 2400, rigidOffsetI: 0.1,
    },
    {
      id: 'BC', i: 'B', j: 'C', type: 'truss', label: 'Diagonal compartida',
      materialOrigin: 'custom', sectionOrigin: 'custom', E: 180e6, A: 0.006, I: 2e-5,
    },
    {
      id: 'DA', i: 'D', j: 'A', type: 'rigid', label: 'No seleccionado',
      materialOrigin: 'imported', sectionOrigin: 'imported', E: 210e6, A: 0.02, I: 1e-4,
    },
  ],
  loadCases: [{ id: 'LC1', name: 'Carga', category: 'permanent', active: true }],
  combinations: [{ id: 'COMB1', name: '1.0 LC1', factors: { LC1: 1 }, source: 'fixture' }],
  nodalLoads: [{ id: 'NL-B', nodeId: 'B', caseId: 'LC1', fx: 3, fy: -8, mz: 2 }],
  prescribedDisplacements: [{ id: 'PD-A', nodeId: 'A', caseId: 'LC1', component: 'ux', value: 0.002 }],
  memberLoads: [{
    id: 'ML-AB', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global',
    lengthBasis: 'real', start: 0, end: 1, px: 4, py: -12, position: 0.4,
  }],
  memberInitialEffects: [{
    id: 'IE-AB', memberId: 'AB', caseId: 'LC1', type: 'temperature', alpha: 1.2e-5,
    deltaT: 20, gradient: 4,
  }],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true,
    snapTargets: { grid: true, nodes: true, midpoints: true, intersections: true, perpendicular: true },
    selectionFilter: { nodes: true, members: true, loads: true },
    showGrid: true, showNodeLabels: true, showMemberLabels: true, showLocalAxes: false,
    showLoads: true, showDimensions: true, showResultValues: true, diagramScale: 1,
    showResultOverlay: true, deformedScale: 1, diagramSide: 'positive',
  },
});

const structuralCollectionsExceptCoordinates = (project: ProjectModel) => ({
  nodes: project.nodes.map(({ x: _x, y: _y, ...node }) => node),
  members: project.members,
  loadCases: project.loadCases,
  combinations: project.combinations,
  nodalLoads: project.nodalLoads,
  prescribedDisplacements: project.prescribedDisplacements,
  memberLoads: project.memberLoads,
  memberInitialEffects: project.memberInitialEffects,
  settings: project.settings,
});

const expectValidReferences = (project: ProjectModel) => {
  const unique = (ids: string[]) => expect(new Set(ids).size).toBe(ids.length);
  unique(project.nodes.map((item) => item.id));
  unique(project.members.map((item) => item.id));
  unique(project.nodalLoads.map((item) => item.id));
  unique(project.memberLoads.map((item) => item.id));
  unique((project.prescribedDisplacements ?? []).map((item) => item.id));
  unique((project.memberInitialEffects ?? []).map((item) => item.id));
  const nodeIds = new Set(project.nodes.map((item) => item.id));
  const memberIds = new Set(project.members.map((item) => item.id));
  const caseIds = new Set(project.loadCases.map((item) => item.id));
  for (const member of project.members) {
    expect(nodeIds.has(member.i)).toBe(true);
    expect(nodeIds.has(member.j)).toBe(true);
    expect(member.i).not.toBe(member.j);
    const i = project.nodes.find((node) => node.id === member.i)!;
    const j = project.nodes.find((node) => node.id === member.j)!;
    expect(Math.hypot(j.x - i.x, j.y - i.y)).toBeGreaterThan(1e-10);
  }
  for (const load of project.nodalLoads) {
    expect(nodeIds.has(load.nodeId)).toBe(true);
    expect(caseIds.has(load.caseId)).toBe(true);
  }
  for (const load of project.memberLoads) {
    expect(memberIds.has(load.memberId)).toBe(true);
    expect(caseIds.has(load.caseId)).toBe(true);
  }
  for (const item of project.prescribedDisplacements ?? []) {
    expect(nodeIds.has(item.nodeId)).toBe(true);
    expect(caseIds.has(item.caseId)).toBe(true);
  }
  for (const effect of project.memberInitialEffects ?? []) {
    expect(memberIds.has(effect.memberId)).toBe(true);
    expect(caseIds.has(effect.caseId)).toBe(true);
  }
};

describe('pure 2D structural editing math', () => {
  it('translates and rotates 0°, 90°, negative angles and a non-origin center', () => {
    expect(translatePoint({ x: -2, y: 5 }, { x: 3, y: -7 })).toEqual({ x: 1, y: -2 });
    expect(rotatePoint({ x: 2, y: 1 }, { x: 2, y: 1 }, 90)).toEqual({ x: 2, y: 1 });
    expect(rotatePoint({ x: 3, y: 1 }, { x: 2, y: 1 }, 0)).toEqual({ x: 3, y: 1 });
    expect(rotatePoint({ x: 3, y: 1 }, { x: 2, y: 1 }, 90)).toEqual({ x: 2, y: 2 });
    expect(rotatePoint({ x: 2, y: 2 }, { x: 2, y: 1 }, -90)).toEqual({ x: 3, y: 1 });
  });

  it('reflects across horizontal, vertical and arbitrary axes while fixing points on the axis', () => {
    expect(reflectPointAcrossLine({ x: 3, y: 5 }, { x: 0, y: 2 }, { x: 1, y: 2 })).toEqual({ x: 3, y: -1 });
    expect(reflectPointAcrossLine({ x: 3, y: 5 }, { x: -1, y: 0 }, { x: -1, y: 1 })).toEqual({ x: -5, y: 5 });
    expect(reflectPointAcrossLine({ x: 3, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 3 });
    expect(reflectPointAcrossLine({ x: 4, y: 4 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual({ x: 4, y: 4 });
    expect(() => reflectPointAcrossLine({ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 2 })).toThrow(/eje/i);
  });
});

describe('prepared structural edits', () => {
  it('uses the shared pure plan for lightweight gesture geometry without producing a ProjectModel clone', () => {
    const source = fixture();
    const before = structuredClone(source);
    const request = {
      kind: 'linear-array' as const,
      selection: { kind: 'member' as const, id: 'AB' },
      direction: { x: 3, y: 4 },
      spacing: 5,
      count: 3,
    };
    const geometry = createStructuralEditGeometryPreview(source, request);
    const prepared = prepareStructuralEdit(source, request);

    expect(source).toEqual(before);
    expect(geometry.createdNodeCount).toBe(4);
    expect(geometry.createdMemberCount).toBe(2);
    expect(geometry.nodes.map(({ sourceNodeId, x, y }) => ({ sourceNodeId, x, y }))).toEqual([
      { sourceNodeId: 'A', x: -1, y: 4 }, { sourceNodeId: 'B', x: 5, y: 5 },
      { sourceNodeId: 'A', x: 2, y: 8 }, { sourceNodeId: 'B', x: 8, y: 9 },
    ]);
    const committedCoordinates = prepared.createdNodeIds.map((id) => {
      const node = prepared.previewProject.nodes.find((candidate) => candidate.id === id)!;
      return { x: node.x, y: node.y };
    });
    expect(geometry.nodes.map(({ x, y }) => ({ x, y }))).toEqual(committedCoordinates);
    expect(geometry.members).toHaveLength(prepared.createdMemberIds.length);
  });

  it('resolves node, member and multi closures once and exposes every incident member', () => {
    const project = fixture();
    expect(resolveStructuralSelection(project, { kind: 'node', id: 'B' })).toEqual({
      nodeIds: ['B'], selectedMemberIds: [], affectedMemberIds: ['AB', 'BC'],
    });
    expect(resolveStructuralSelection(project, { kind: 'member', id: 'AB' })).toEqual({
      nodeIds: ['A', 'B'], selectedMemberIds: ['AB'], affectedMemberIds: ['AB', 'BC', 'DA'],
    });
    expect(resolveStructuralSelection(project, { kind: 'multi', nodeIds: ['B', 'A', 'B'], memberIds: ['BC', 'AB'] })).toEqual({
      nodeIds: ['A', 'B', 'C'], selectedMemberIds: ['AB', 'BC'], affectedMemberIds: ['AB', 'BC', 'DA'],
    });
    expect(() => resolveStructuralSelection(project, { kind: 'nodalLoad', id: 'NL-B' })).toThrow(/estructural/i);
    expect(() => resolveStructuralSelection(project, { kind: 'node', id: 'missing' })).toThrow(/missing/i);
  });

  it('moves a selected member through shared nodes without changing IDs, references or structural identity', () => {
    const source = fixture();
    const before = structuredClone(source);
    const prepared = prepareStructuralEdit(source, {
      kind: 'move', selection: { kind: 'member', id: 'AB' }, delta: { x: 3, y: -2 },
    });

    expect(source).toEqual(before);
    expect(prepared.affectedNodeIds).toEqual(['A', 'B']);
    expect(prepared.affectedMemberIds).toEqual(['AB', 'BC', 'DA']);
    expect(prepared.createdNodeIds).toEqual([]);
    expect(prepared.previewProject.nodes.find((node) => node.id === 'A')).toMatchObject({ x: -1, y: -2 });
    expect(prepared.previewProject.nodes.find((node) => node.id === 'B')).toMatchObject({ x: 5, y: -1 });
    expect(prepared.previewProject.nodes.find((node) => node.id === 'C')).toMatchObject({ x: 10, y: 4 });
    expect(structuralCollectionsExceptCoordinates(prepared.previewProject)).toEqual(structuralCollectionsExceptCoordinates(before));
    expectValidReferences(prepared.previewProject);
  });

  it('applies the exact frozen preview and rejects stale or tampered preparations atomically', () => {
    const source = fixture();
    const prepared = prepareStructuralEdit(source, {
      kind: 'rotate', selection: { kind: 'multi', nodeIds: ['A', 'B'], memberIds: ['AB'] },
      center: { x: 1, y: -1 }, angleDeg: 90,
    });
    const applied = applyPreparedStructuralEdit(source, prepared);
    expect(applied).toEqual(prepared.previewProject);
    expect(applied).not.toBe(prepared.previewProject);

    const stale = structuredClone(source);
    stale.name = 'Cambio concurrente';
    expect(() => applyPreparedStructuralEdit(stale, prepared)).toThrow(/obsolet/i);
    expect(stale.name).toBe('Cambio concurrente');

    expect(() => {
      (prepared.previewProject.nodes[0] as { x: number }).x = 999;
    }).toThrow();
  });

  it('keeps transform and copy mirror semantics separate and remaps all copied dependencies', () => {
    const source = fixture();
    const selection: Selection = { kind: 'member', id: 'AB' };
    const axis = { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } };
    const transformed = prepareStructuralEdit(source, { kind: 'mirror', mode: 'transform', selection, axis });
    expect(transformed.previewProject.nodes).toHaveLength(source.nodes.length);
    expect(transformed.previewProject.members).toHaveLength(source.members.length);
    expect(transformed.previewProject.nodes.find((node) => node.id === 'A')?.x).toBe(4);

    const copied = prepareStructuralEdit(source, { kind: 'mirror', mode: 'copy', selection, axis });
    expect(copied.previewProject.nodes).toHaveLength(source.nodes.length + 2);
    expect(copied.previewProject.members).toHaveLength(source.members.length + 1);
    expect(copied.previewProject.nodalLoads).toHaveLength(source.nodalLoads.length + 1);
    expect(copied.previewProject.prescribedDisplacements).toHaveLength((source.prescribedDisplacements?.length ?? 0) + 1);
    expect(copied.previewProject.memberLoads).toHaveLength(source.memberLoads.length + 1);
    expect(copied.previewProject.memberInitialEffects).toHaveLength((source.memberInitialEffects?.length ?? 0) + 1);
    expect(copied.createdNodeIds).toHaveLength(2);
    expect(copied.createdMemberIds).toHaveLength(1);
    const member = copied.previewProject.members.find((item) => copied.createdMemberIds.includes(item.id))!;
    expect(copied.createdNodeIds).toContain(member.i);
    expect(copied.createdNodeIds).toContain(member.j);
    expect(member).toMatchObject({
      type: 'frame', materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'ipe-300', sectionOrigin: 'catalog', releases: { iMoment: true },
      rotationalSpringJ: 2400, rigidOffsetI: 0.1, label: 'Viga AB',
    });
    expect(copied.previewProject.nodalLoads.at(-1)?.nodeId).toBe(copied.createdNodeIds[1]);
    expect(copied.previewProject.memberLoads.at(-1)?.memberId).toBe(member.id);
    expect(copied.previewProject.memberInitialEffects?.at(-1)?.memberId).toBe(member.id);
    expectValidReferences(copied.previewProject);
    expect(source).toEqual(fixture());
  });

  it('creates a linear array from the original snapshot with total count, unique IDs and one shared node per instance', () => {
    const source = fixture();
    const prepared = prepareStructuralEdit(source, {
      kind: 'linear-array',
      selection: { kind: 'multi', nodeIds: ['A', 'B', 'C'], memberIds: ['AB', 'BC'] },
      direction: { x: 3, y: 4 }, spacing: 5, count: 3,
    });
    expect(prepared.createdNodeIds).toHaveLength(6);
    expect(prepared.createdMemberIds).toHaveLength(4);
    const created = prepared.createdNodeIds.map((id) => prepared.previewProject.nodes.find((node) => node.id === id)!);
    expect(created.slice(0, 3).map(({ x, y }) => ({ x, y }))).toEqual([
      { x: -1, y: 4 }, { x: 5, y: 5 }, { x: 13, y: 8 },
    ]);
    expect(created.slice(3).map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 2, y: 8 }, { x: 8, y: 9 }, { x: 16, y: 12 },
    ]);
    expect(new Set(prepared.createdNodeIds).size).toBe(6);
    expect(new Set(prepared.createdMemberIds).size).toBe(4);
    expectValidReferences(prepared.previewProject);
  });

  it.each([
    [{ x: 0, y: 0 }, 5, 3],
    [{ x: 1, y: 0 }, 0, 3],
    [{ x: 1, y: 0 }, -1, 3],
    [{ x: 1, y: 0 }, 1, 1],
    [{ x: 1, y: 0 }, 1, 2.5],
  ] as const)('rejects invalid linear array direction=%j spacing=%s count=%s', (direction, spacing, count) => {
    expect(() => prepareStructuralEdit(fixture(), {
      kind: 'linear-array', selection: { kind: 'node', id: 'A' }, direction, spacing, count,
    })).toThrow();
  });

  it('bounds the complete linear-array copy closure before materializing a preview', () => {
    const source = fixture();
    const request = {
      kind: 'linear-array' as const,
      selection: { kind: 'member' as const, id: 'AB' },
      direction: { x: 1, y: 0 },
      spacing: 1,
      count: 500,
    };
    expect(() => createStructuralEditGeometryPreview(source, request)).toThrow(/entidades/i);
    expect(() => prepareStructuralEdit(source, request)).toThrow(/entidades/i);
  });

  it.each([
    ['min-x', -4], ['max-x', 10], ['center-x', 3],
    ['min-y', -3], ['max-y', 4], ['center-y', 0.5],
  ] as const)('aligns node-only targets by model %s independent of selection order', (alignment, expected) => {
    const first = prepareStructuralEdit(fixture(), {
      kind: 'align', selection: { kind: 'multi', nodeIds: ['C', 'A', 'D'], memberIds: [] }, alignment,
    });
    const reversed = prepareStructuralEdit(fixture(), {
      kind: 'align', selection: { kind: 'multi', nodeIds: ['D', 'A', 'C'], memberIds: [] }, alignment,
    });
    const axis = alignment.endsWith('x') ? 'x' : 'y';
    expect(['A', 'C', 'D'].map((id) => first.previewProject.nodes.find((node) => node.id === id)![axis])).toEqual([expected, expected, expected]);
    expect(reversed.previewProject).toEqual(first.previewProject);
  });

  it('distributes nodes deterministically, preserves endpoints and rejects incompatible or degenerate targets', () => {
    const project = fixture();
    project.nodes.find((node) => node.id === 'A')!.x = -4;
    project.nodes.find((node) => node.id === 'B')!.x = 2;
    project.nodes.find((node) => node.id === 'C')!.x = 10;
    const distributed = prepareStructuralEdit(project, {
      kind: 'distribute', selection: { kind: 'multi', nodeIds: ['C', 'A', 'B'], memberIds: [] }, axis: 'x',
    });
    expect(distributed.previewProject.nodes.find((node) => node.id === 'A')?.x).toBe(-4);
    expect(distributed.previewProject.nodes.find((node) => node.id === 'B')?.x).toBe(3);
    expect(distributed.previewProject.nodes.find((node) => node.id === 'C')?.x).toBe(10);
    expect(distributed.previewProject.nodes.find((node) => node.id === 'B')?.y).toBe(1);

    expect(() => prepareStructuralEdit(project, {
      kind: 'align', selection: { kind: 'multi', nodeIds: ['A'], memberIds: ['AB'] }, alignment: 'min-x',
    })).toThrow(/nodos/i);
    expect(() => prepareStructuralEdit(project, {
      kind: 'distribute', selection: { kind: 'multi', nodeIds: ['A', 'B'], memberIds: [] }, axis: 'x',
    })).toThrow(/tres/i);
    const degenerate = fixture();
    for (const id of ['A', 'B', 'C']) degenerate.nodes.find((node) => node.id === id)!.y = 7;
    expect(() => prepareStructuralEdit(degenerate, {
      kind: 'distribute', selection: { kind: 'multi', nodeIds: ['A', 'B', 'C'], memberIds: [] }, axis: 'y',
    })).toThrow(/rango/i);
  });

  it('rejects non-finite transforms and edits that collapse a member', () => {
    expect(() => prepareStructuralEdit(fixture(), {
      kind: 'move', selection: { kind: 'node', id: 'A' }, delta: { x: Number.NaN, y: 0 },
    })).toThrow(/finit/i);
    const project = fixture();
    const a = project.nodes.find((node) => node.id === 'A')!;
    const b = project.nodes.find((node) => node.id === 'B')!;
    const collapse = {
      kind: 'move', selection: { kind: 'node', id: 'A' }, delta: { x: b.x - a.x, y: b.y - a.y },
    } as const;
    expect(() => prepareStructuralEdit(project, collapse)).toThrow(/longitud/i);
    expect(() => createStructuralEditGeometryPreview(project, collapse)).toThrow(/longitud/i);
  });
});

describe('structural edit mutation boundary', () => {
  it('rejects duplicate IDs and every dangling structural reference independently of the solver', () => {
    const duplicate = fixture();
    duplicate.nodalLoads.push({ ...duplicate.nodalLoads[0] });
    expect(() => validateStructuralEditBoundary(duplicate)).toThrow(/duplicado/i);

    const danglingNode = fixture();
    danglingNode.nodalLoads[0].nodeId = 'missing';
    expect(() => validateStructuralEditBoundary(danglingNode)).toThrow(/missing/i);

    const danglingPrescribed = fixture();
    danglingPrescribed.prescribedDisplacements![0].nodeId = 'missing';
    expect(() => validateStructuralEditBoundary(danglingPrescribed)).toThrow(/missing/i);

    const danglingMember = fixture();
    danglingMember.memberLoads[0].memberId = 'missing';
    expect(() => validateStructuralEditBoundary(danglingMember)).toThrow(/missing/i);

    const danglingCase = fixture();
    danglingCase.memberInitialEffects![0].caseId = 'missing';
    expect(() => validateStructuralEditBoundary(danglingCase)).toThrow(/missing/i);
  });

  it('rejects catalog provenance without its durable material or section identity', () => {
    const missingMaterialId = fixture();
    delete missingMaterialId.members[0].materialId;
    expect(() => validateStructuralEditBoundary(missingMaterialId)).toThrow(/material.*catálogo/i);

    const missingSectionId = fixture();
    delete missingSectionId.members[0].sectionId;
    expect(() => validateStructuralEditBoundary(missingSectionId)).toThrow(/sección.*catálogo/i);
  });
});
