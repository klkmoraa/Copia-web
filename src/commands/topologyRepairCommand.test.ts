import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import {
  applyPreparedTopologyRepair,
  compileProjectCommand,
  prepareTopologyRepairCommand,
  projectCommandSnapshot,
} from './projectCommand';

const repairableProject = () => {
  const project = createDefaultProject();
  project.nodes.push({ id: 'N-DUP', x: project.nodes[0].x, y: project.nodes[0].y, support: { type: 'none' } });
  project.nodalLoads.push({ id: 'NL-DUP', nodeId: 'N-DUP', caseId: 'LC1', fx: 2, fy: 0, mz: 0 });
  return project;
};

describe('topology.repair command', () => {
  it('compiles one explicit repair intent to inspectable forward and inverse patches', () => {
    const project = repairableProject();
    const prepared = prepareTopologyRepairCommand(project, 'Reparar topología segura');

    expect(prepared.command.kind).toBe('topology.repair');
    expect(prepared.result).toEqual({ kind: 'topology.repair', report: prepared.report });
    expect(prepared.report.mergedNodes).toHaveLength(1);
    expect(prepared.forward.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'nodes', id: 'N-DUP', before: expect.any(Object), after: null }),
      expect.objectContaining({ collection: 'nodalLoads', id: 'NL-DUP', before: expect.any(Object), after: expect.any(Object) }),
    ]));

    const compiledAgain = compileProjectCommand(project, prepared.command);
    expect(compiledAgain.forward).toEqual(prepared.forward);
    expect(compiledAgain.inverse).toEqual(prepared.inverse);
    expect(applyPreparedTopologyRepair(project, prepared)).toEqual(prepared.repairedProject);
  });

  it('rejects a stale or tampered exact command before publishing any state', () => {
    const project = repairableProject();
    const prepared = prepareTopologyRepairCommand(project, 'Reparar topología segura');
    const stale = structuredClone(project);
    stale.loadCases[0].name = 'Cambio ajeno al patch';
    const staleBefore = structuredClone(stale);

    expect(() => compileProjectCommand(stale, prepared.command)).toThrow(/preview.*obsoleto/i);
    expect(stale).toEqual(staleBefore);

    const tamperedCommand = { ...prepared.command, repairedSnapshot: JSON.stringify(project) };
    const beforeTamperedCompile = structuredClone(project);
    expect(() => compileProjectCommand(project, tamperedCommand)).toThrow(/no coincide.*preview/i);
    expect(project).toEqual(beforeTamperedCompile);
  });

  it.each([
    [Number.NaN, Number.POSITIVE_INFINITY],
    [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
  ])('detects non-finite stale changes exactly: %s to %s', (before, after) => {
    const project = repairableProject();
    project.members[0].E = before;
    const prepared = prepareTopologyRepairCommand(project);
    const stale = structuredClone(project);
    stale.members[0].E = after;
    const staleBefore = structuredClone(stale);

    expect(() => applyPreparedTopologyRepair(stale, prepared)).toThrow(/preview.*obsoleto/i);
    expect(Object.is(stale.members[0].E, after)).toBe(true);
    expect(stale).toEqual(staleBefore);
  });

  it('detects the presence or absence of optional properties exactly', () => {
    const project = repairableProject();
    project.members[0].label = undefined;
    const prepared = prepareTopologyRepairCommand(project);
    const stale = structuredClone(project);
    delete stale.members[0].label;

    expect(() => applyPreparedTopologyRepair(stale, prepared)).toThrow(/preview.*obsoleto/i);
  });

  it('rejects a self-consistent prepared patch that did not come from topology repair', () => {
    const project = createDefaultProject();
    const forged = structuredClone(prepareTopologyRepairCommand(project));
    const changedMember = { ...project.members[0], E: project.members[0].E * 2 };
    forged.repairedProject.members[0] = changedMember;
    forged.repairedSnapshot = projectCommandSnapshot(forged.repairedProject);
    forged.command.repairedSnapshot = forged.repairedSnapshot;
    forged.forward.operations = [{
      collection: 'members',
      id: project.members[0].id,
      index: 0,
      before: structuredClone(project.members[0]),
      after: structuredClone(changedMember),
    }];
    forged.inverse.operations = [{
      collection: 'members',
      id: project.members[0].id,
      index: 0,
      before: structuredClone(changedMember),
      after: structuredClone(project.members[0]),
    }];

    expect(() => applyPreparedTopologyRepair(project, forged)).toThrow(/reparaci.n.*preview|preview.*reparaci.n/i);
    expect(project.members[0].E).not.toBe(changedMember.E);
  });

  it('rejects a prepared object whose public report differs from the authoritative result', () => {
    const project = repairableProject();
    const before = structuredClone(project);
    const forged = structuredClone(prepareTopologyRepairCommand(project));
    forged.report.mergedNodes = [];

    expect(() => applyPreparedTopologyRepair(project, forged)).toThrow(/reparaci.n.*preview|preview.*reparaci.n/i);
    expect(project).toEqual(before);
  });
});
