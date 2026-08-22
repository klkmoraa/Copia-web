import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { applyPreparedTopologyRepair, projectCommandSnapshot } from '../../commands/projectCommand';
import type { ProjectModel } from '../../types';
import { prepareTopologyRepair } from './topologyRepairPreview';

const topologyFixture = (): ProjectModel => {
  const project = createDefaultProject();
  project.nodes = [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'D', x: 10, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'S', x: 5, y: 0, support: { type: 'fixed' } },
    { id: 'A-DUP', x: 0, y: 0, support: { type: 'none' }, internalHinge: true },
  ];
  project.members = [{
    id: 'M', i: 'A', j: 'D', type: 'frame', materialOrigin: 'custom', sectionOrigin: 'custom',
    E: 200e6, A: 0.01, I: 8e-5,
    releases: { iMoment: true, jMoment: true },
    rotationalSpringI: 1200, rotationalSpringJ: 2400,
    rigidOffsetI: 0.4, rigidOffsetJ: 0.4,
  }];
  project.nodalLoads = [{ id: 'NL-DUP', nodeId: 'A-DUP', caseId: 'LC1', fx: 3, fy: -4, mz: 0 }];
  project.prescribedDisplacements = [{ id: 'PD-DUP', nodeId: 'A-DUP', caseId: 'LC1', component: 'ux', value: 0.002 }];
  project.memberLoads = [
    { id: 'ML-CUT', memberId: 'M', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -10, position: 0.5 },
    { id: 'ML-RIGHT', memberId: 'M', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 2, py: -5, position: 0.8 },
    { id: 'ML-DIST', memberId: 'M', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0.2, end: 0.8, qxStart: 1, qxEnd: 3, qyStart: -2, qyEnd: -6 },
  ];
  project.memberInitialEffects = [
    { id: 'IE-T', memberId: 'M', caseId: 'LC1', type: 'temperature', alpha: 1.2e-5, deltaT: 20, gradient: 2 },
    { id: 'IE-S', memberId: 'M', caseId: 'LC1', type: 'initial-strain', axialStrain: 0.001, curvature: 0.002 },
  ];
  return project;
};

describe('prepareTopologyRepair', () => {
  it('prepares the complete human preview without mutating the visible project', () => {
    const project = topologyFixture();
    const original = structuredClone(project);

    const preview = prepareTopologyRepair(project);

    expect(project).toEqual(original);
    expect(preview.hasChanges).toBe(true);
    expect(preview.prepared.report.mergedNodes).toEqual([{ keptNodeId: 'A', removedNodeId: 'A-DUP' }]);
    expect(preview.changes.mergedNodes).toEqual([expect.objectContaining({
      keptNodeId: 'A', removedNodeId: 'A-DUP',
      keptBefore: expect.objectContaining({ id: 'A' }),
      keptAfter: expect.objectContaining({ id: 'A', internalHinge: true }),
      removed: expect.objectContaining({ id: 'A-DUP' }),
    })]);

    const split = preview.changes.splitMembers[0];
    expect(split.originalMember).toEqual(original.members[0]);
    expect(split.splitNodeIds).toEqual(['S']);
    expect(split.resultingMembers).toHaveLength(2);
    expect(split.resultingMembers[0]).toMatchObject({ id: 'M', i: 'A', j: 'S', releases: { iMoment: true }, rotationalSpringI: 1200, rigidOffsetI: 0.4, rigidOffsetJ: 0 });
    expect(split.resultingMembers[1]).toMatchObject({ i: 'S', j: 'D', releases: { jMoment: true }, rotationalSpringJ: 2400, rigidOffsetI: 0, rigidOffsetJ: 0.4 });

    expect(preview.prepared.repairedProject.nodalLoads).toEqual([
      { id: 'NL-DUP', nodeId: 'A', caseId: 'LC1', fx: 3, fy: -4, mz: 0 },
      { id: 'NL1', nodeId: 'S', caseId: 'LC1', fx: 0, fy: -10, mz: 0 },
    ]);
    const distributedMidRatio = (0.5 - 0.2) / (0.8 - 0.2);
    const qxMid = 1 + (3 - 1) * distributedMidRatio;
    const qyMid = -2 + (-6 - -2) * distributedMidRatio;
    expect(preview.prepared.repairedProject.memberLoads).toEqual([
      { id: 'ML-RIGHT', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 2, py: -5, position: (0.8 - 0.5) / 0.5 },
      { id: 'ML-DIST', memberId: 'M', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0.4, end: 1, qxStart: 1, qxEnd: qxMid, qyStart: -2, qyEnd: qyMid },
      { id: 'ML1', memberId: 'M1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: (0.8 - 0.5) / 0.5, qxStart: qxMid, qxEnd: 3, qyStart: qyMid, qyEnd: -6 },
    ]);
    expect(preview.changes.memberLoads.map((change) => [change.id, change.disposition])).toEqual([
      ['ML-CUT', 'removed'], ['ML-RIGHT', 'remapped'], ['ML-DIST', 'remapped'], ['ML1', 'created'],
    ]);
    expect(preview.changes.prescribedDisplacements).toEqual([
      expect.objectContaining({ id: 'PD-DUP', before: expect.objectContaining({ nodeId: 'A-DUP' }), after: expect.objectContaining({ nodeId: 'A' }) }),
    ]);
    expect(preview.prepared.repairedProject.memberInitialEffects).toEqual([
      original.memberInitialEffects![0],
      original.memberInitialEffects![1],
      { ...original.memberInitialEffects![0], id: 'IE1', memberId: 'M1' },
      { ...original.memberInitialEffects![1], id: 'IE2', memberId: 'M1' },
    ]);
    expect(preview.changes.memberInitialEffects.map((change) => [change.id, change.disposition])).toEqual([
      ['IE-T', 'preserved'], ['IE-S', 'preserved'], ['IE1', 'created'], ['IE2', 'created'],
    ]);
    expect(preview.prepared.forward.operations.length).toBeGreaterThan(0);
    expect(preview.prepared.inverse.operations.length).toBe(preview.prepared.forward.operations.length);
  });

  it('applies exactly the prepared state and rejects any globally stale source atomically', () => {
    const project = topologyFixture();
    const preview = prepareTopologyRepair(project);

    const applied = applyPreparedTopologyRepair(project, preview.prepared);

    expect(applied).toEqual(preview.prepared.repairedProject);
    expect(projectCommandSnapshot(applied)).toBe(preview.prepared.repairedSnapshot);

    const stale = structuredClone(project);
    stale.name = `${stale.name} editado mientras el preview estaba abierto`;
    const staleBefore = structuredClone(stale);
    expect(() => applyPreparedTopologyRepair(stale, preview.prepared)).toThrow(/preview.*obsoleto/i);
    expect(stale).toEqual(staleBefore);

    const tampered = structuredClone(preview.prepared);
    tampered.repairedProject.members[0].A *= 2;
    const beforeTamperedApply = structuredClone(project);
    expect(() => applyPreparedTopologyRepair(project, tampered)).toThrow(/no coincide.*preview/i);
    expect(project).toEqual(beforeTamperedApply);
  });

  it('groups multiple deterministic splits under the original source member', () => {
    const project = topologyFixture();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'D', x: 10, y: 0, support: { type: 'roller', angleDeg: 90 } },
      { id: 'B', x: 3, y: 0, support: { type: 'fixed' } },
      { id: 'C', x: 7, y: 0, support: { type: 'fixed' } },
    ];
    project.nodalLoads = [];
    project.prescribedDisplacements = [];

    const preview = prepareTopologyRepair(project);

    expect(preview.prepared.report.splitMembers).toHaveLength(2);
    expect(preview.changes.splitMembers).toHaveLength(1);
    expect(preview.changes.splitMembers[0].originalMember.id).toBe('M');
    expect(preview.changes.splitMembers[0].splitNodeIds).toEqual(['B', 'C']);
    expect(preview.changes.splitMembers[0].resultingMembers).toHaveLength(3);
    expect(preview.changes.splitMembers[0].resultingMembers.map((member) => [member.i, member.j])).toEqual([
      ['A', 'B'], ['B', 'C'], ['C', 'D'],
    ]);
    expect(preview.prepared.repairedProject.members.map((member) => member.id)).toEqual(['M', 'M1', 'M2']);
    expect(preview.prepared.repairedProject.memberLoads.map((load) => load.id)).toEqual(['ML-CUT', 'ML-RIGHT', 'ML-DIST', 'ML1', 'ML2']);
    expect(preview.prepared.repairedProject.memberInitialEffects).toEqual([
      project.memberInitialEffects![0],
      project.memberInitialEffects![1],
      { ...project.memberInitialEffects![0], id: 'IE1', memberId: 'M1' },
      { ...project.memberInitialEffects![1], id: 'IE2', memberId: 'M1' },
      { ...project.memberInitialEffects![0], id: 'IE3', memberId: 'M2' },
      { ...project.memberInitialEffects![1], id: 'IE4', memberId: 'M2' },
    ]);
  });

  it('reports incompatible coincident topology as deliberately skipped with no repair mutation', () => {
    const project = topologyFixture();
    project.nodes = [
      { id: 'PIN', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'ROLLER', x: 0, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [];
    project.nodalLoads = [];
    project.memberLoads = [];
    project.prescribedDisplacements = [];
    project.memberInitialEffects = [];
    const original = structuredClone(project);

    const preview = prepareTopologyRepair(project);

    expect(preview.hasChanges).toBe(false);
    expect(preview.prepared.report.skippedCoincidentPairs).toEqual([{ firstNodeId: 'PIN', secondNodeId: 'ROLLER' }]);
    expect(preview.changes.skippedCoincidentPairs).toEqual([{ firstNodeId: 'PIN', secondNodeId: 'ROLLER' }]);
    expect(preview.prepared.forward.operations).toEqual([]);
    expect(preview.prepared.repairedProject).toEqual(original);
    expect(project).toEqual(original);
  });

  it('deduplicates repeated skipped pairs only in the human-readable preview', () => {
    const project = topologyFixture();
    project.nodes = [
      { id: 'PIN', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'ROLLER', x: 0, y: 0, support: { type: 'roller', angleDeg: 90 } },
      { id: 'NEUTRAL', x: 0, y: 0, support: { type: 'none' } },
    ];
    project.members = [];
    project.nodalLoads = [];
    project.memberLoads = [];
    project.prescribedDisplacements = [];
    project.memberInitialEffects = [];

    const preview = prepareTopologyRepair(project);
    const pairKeys = preview.changes.skippedCoincidentPairs.map((pair) => `${pair.firstNodeId}\0${pair.secondNodeId}`);

    expect(new Set(pairKeys).size).toBe(pairKeys.length);
    expect(preview.prepared.report.skippedCoincidentPairs.length).toBeGreaterThanOrEqual(preview.changes.skippedCoincidentPairs.length);
  });

  it('leaves directly connected coincident nodes and rigid-offset interior nodes untouched', () => {
    const connected = topologyFixture();
    connected.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'none' } },
      { id: 'B', x: 0, y: 0, support: { type: 'none' } },
    ];
    connected.members = [{ ...connected.members[0], id: 'AB', i: 'A', j: 'B' }];
    connected.nodalLoads = [];
    connected.memberLoads = [];
    connected.prescribedDisplacements = [];
    connected.memberInitialEffects = [];
    const connectedBefore = structuredClone(connected);
    const connectedPreview = prepareTopologyRepair(connected);
    expect(connectedPreview.hasChanges).toBe(false);
    expect(connectedPreview.changes.skippedCoincidentPairs).toEqual([{ firstNodeId: 'A', secondNodeId: 'B' }]);
    expect(connectedPreview.prepared.repairedProject).toEqual(connectedBefore);

    const offset = topologyFixture();
    offset.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'D', x: 10, y: 0, support: { type: 'roller', angleDeg: 90 } },
      { id: 'OFFSET', x: 0.2, y: 0, support: { type: 'fixed' } },
    ];
    offset.members[0].rigidOffsetI = 0.4;
    offset.nodalLoads = [];
    offset.memberLoads = [];
    offset.prescribedDisplacements = [];
    offset.memberInitialEffects = [];
    const offsetBefore = structuredClone(offset);
    const offsetPreview = prepareTopologyRepair(offset);
    expect(offsetPreview.hasChanges).toBe(false);
    expect(offsetPreview.prepared.report.splitMembers).toEqual([]);
    expect(offsetPreview.prepared.repairedProject).toEqual(offsetBefore);
  });

  it('exposes an unresolved rigid-offset connection when other safe changes can still be applied', () => {
    const project = topologyFixture();
    project.nodes.push({ id: 'OFFSET', x: 0.2, y: 0, support: { type: 'fixed' } });

    const preview = prepareTopologyRepair(project);

    expect(preview.hasChanges).toBe(true);
    expect(preview.changes.unresolvedTopology).toEqual([
      expect.objectContaining({
        sourceIssueId: 'node-on-member-OFFSET-M',
        affectedObjects: [
          { kind: 'node', id: 'OFFSET' },
          { kind: 'member', id: 'M' },
        ],
      }),
    ]);
  });

  it('exposes the exact node projection performed by a safe split within tolerance', () => {
    const project = topologyFixture();
    const splitNode = project.nodes.find((node) => node.id === 'S')!;
    splitNode.y = 5e-9;

    const preview = prepareTopologyRepair(project);

    expect(preview.changes.nodes).toContainEqual(expect.objectContaining({
      id: 'S',
      before: expect.objectContaining({ x: 5, y: 5e-9 }),
      after: expect.objectContaining({ x: 5, y: 0 }),
      disposition: 'remapped',
    }));
  });
});
