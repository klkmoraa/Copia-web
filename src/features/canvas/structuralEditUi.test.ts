import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import {
  buildStructuralEditRequest,
  createStructuralEditDraft,
  structuralEditCapabilities,
  structuralEditSelectionAnchor,
  updateDraftFromPointer,
} from './structuralEditUi';

describe('structural edit UI parameters', () => {
  it('derives a stable selection anchor and selection-aware capabilities', () => {
    const project = createDefaultProject();
    const member = project.members[0];
    const anchor = project.nodes.find((node) => node.id === member.i)!;
    expect(structuralEditSelectionAnchor(project, { kind: 'member', id: member.id })).toEqual({ x: anchor.x, y: anchor.y });
    expect(structuralEditCapabilities(project, { kind: 'member', id: member.id })).toEqual({
      structural: true, align: false, distribute: false,
    });
    expect(structuralEditCapabilities(project, {
      kind: 'multi', nodeIds: project.nodes.slice(0, 3).map((node) => node.id), memberIds: [],
    })).toEqual({ structural: true, align: true, distribute: true });
    expect(structuralEditCapabilities(project, { kind: 'nodalLoad', id: 'missing' })).toEqual({
      structural: false, align: false, distribute: false,
    });
  });

  it('converts visible length fields to internal Move and Rotate requests', () => {
    const project = createDefaultProject();
    project.settings.units = 'N-mm';
    const selection = { kind: 'node' as const, id: project.nodes[0].id };
    const move = createStructuralEditDraft(project, selection, 'move');
    move.fields.deltaX = '2500';
    move.fields.deltaY = '-500';
    expect(buildStructuralEditRequest(project, move)).toEqual({
      kind: 'move', selection, delta: { x: 2.5, y: -0.5 },
    });

    const rotate = createStructuralEditDraft(project, selection, 'rotate');
    rotate.fields.centerX = '1000';
    rotate.fields.centerY = '2000';
    rotate.fields.angleDeg = '-90';
    expect(buildStructuralEditRequest(project, rotate)).toEqual({
      kind: 'rotate', selection, center: { x: 1, y: 2 }, angleDeg: -90,
    });
  });

  it('keeps Mirror transform/copy and axis variants explicit', () => {
    const project = createDefaultProject();
    const selection = { kind: 'node' as const, id: project.nodes[0].id };
    const mirror = createStructuralEditDraft(project, selection, 'mirror');
    mirror.fields.mirrorMode = 'copy';
    mirror.fields.mirrorAxis = 'vertical';
    mirror.fields.axisCoordinate = '3';
    expect(buildStructuralEditRequest(project, mirror)).toEqual({
      kind: 'mirror', mode: 'copy', selection,
      axis: { start: { x: 3, y: 0 }, end: { x: 3, y: 1 } },
    });
    mirror.fields.mirrorAxis = 'arbitrary';
    mirror.fields.axisStartX = '-2';
    mirror.fields.axisStartY = '1';
    mirror.fields.axisEndX = '4';
    mirror.fields.axisEndY = '5';
    expect(buildStructuralEditRequest(project, mirror)).toMatchObject({
      kind: 'mirror', mode: 'copy',
      axis: { start: { x: -2, y: 1 }, end: { x: 4, y: 5 } },
    });
  });

  it('builds total-count linear arrays and rejects incomplete numeric input before domain preparation', () => {
    const project = createDefaultProject();
    const selection = { kind: 'member' as const, id: project.members[0].id };
    const draft = createStructuralEditDraft(project, selection, 'linear-array');
    draft.fields.directionX = '3';
    draft.fields.directionY = '4';
    draft.fields.spacing = '5';
    draft.fields.count = '3';
    expect(buildStructuralEditRequest(project, draft)).toEqual({
      kind: 'linear-array', selection, direction: { x: 3, y: 4 }, spacing: 5, count: 3,
    });
    draft.fields.spacing = '';
    expect(() => buildStructuralEditRequest(project, draft)).toThrow(/espaciamiento/i);
  });

  it('maps pointer gestures to the same numeric request fields', () => {
    const project = createDefaultProject();
    const selection = { kind: 'node' as const, id: project.nodes[0].id };
    const move = updateDraftFromPointer(
      createStructuralEditDraft(project, selection, 'move'),
      project,
      { start: { x: 1, y: 2 }, current: { x: 4, y: -3 } },
    );
    expect(buildStructuralEditRequest(project, move)).toMatchObject({ delta: { x: 3, y: -5 } });

    const rotate = createStructuralEditDraft(project, selection, 'rotate');
    rotate.fields.centerX = '0';
    rotate.fields.centerY = '0';
    const rotated = updateDraftFromPointer(rotate, project, {
      start: { x: 2, y: 0 }, current: { x: 0, y: 2 },
    });
    expect(buildStructuralEditRequest(project, rotated)).toMatchObject({ angleDeg: 90 });

    const crossingBranchCut = updateDraftFromPointer(rotate, project, {
      start: {
        x: Math.cos(170 * Math.PI / 180),
        y: Math.sin(170 * Math.PI / 180),
      },
      current: {
        x: Math.cos(-170 * Math.PI / 180),
        y: Math.sin(-170 * Math.PI / 180),
      },
    });
    const crossingRequest = buildStructuralEditRequest(project, crossingBranchCut);
    expect(crossingRequest.kind).toBe('rotate');
    if (crossingRequest.kind !== 'rotate') throw new Error('Expected the rotation request.');
    expect(crossingRequest.angleDeg).toBeCloseTo(20, 10);

    const array = updateDraftFromPointer(
      createStructuralEditDraft(project, selection, 'linear-array'),
      project,
      { start: { x: 0, y: 0 }, current: { x: 3, y: 4 } },
    );
    expect(buildStructuralEditRequest(project, array)).toMatchObject({
      direction: { x: 0.6, y: 0.8 }, spacing: 5,
    });
  });
});
