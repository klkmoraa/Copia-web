import type { MemberLoad, MemberModel, NodalLoad, ProjectModel, Selection, Tool } from '../../types';

type RepeatTool = Extract<Tool, 'node' | 'member' | 'pointLoad' | 'distributedLoad' | 'moment'>;

export type RepeatRecipe =
  | { kind: 'node'; tool: 'node' }
  | { kind: 'member'; tool: 'member'; template: Omit<MemberModel, 'id' | 'i' | 'j'> }
  | { kind: 'nodalLoad'; tool: Extract<RepeatTool, 'pointLoad' | 'moment'>; template: Omit<NodalLoad, 'id' | 'nodeId'> }
  | { kind: 'memberLoad'; tool: Extract<RepeatTool, 'pointLoad' | 'distributedLoad' | 'moment'>; template: Omit<MemberLoad, 'id' | 'memberId'> };

export const resolveRepeatRecipe = (project: ProjectModel, selection: Selection): RepeatRecipe | null => {
  if (!selection || selection.kind === 'multi') return null;
  if (selection.kind === 'node') {
    return project.nodes.some((node) => node.id === selection.id) ? { kind: 'node', tool: 'node' } : null;
  }
  if (selection.kind === 'member') {
    const member = project.members.find((candidate) => candidate.id === selection.id);
    if (!member || member.type === 'rigid') return null;
    const { id: _id, i: _i, j: _j, ...template } = member;
    return { kind: 'member', tool: 'member', template };
  }
  if (selection.kind === 'nodalLoad') {
    const load = project.nodalLoads.find((candidate) => candidate.id === selection.id);
    if (!load) return null;
    const { id: _id, nodeId: _nodeId, ...template } = load;
    const tool = Math.abs(load.mz) > 0 && Math.abs(load.fx) === 0 && Math.abs(load.fy) === 0 ? 'moment' : 'pointLoad';
    return { kind: 'nodalLoad', tool, template };
  }
  const load = project.memberLoads.find((candidate) => candidate.id === selection.id);
  if (!load) return null;
  const { id: _id, memberId: _memberId, ...template } = load;
  const tool = load.type === 'distributed' ? 'distributedLoad' : load.type === 'moment' ? 'moment' : 'pointLoad';
  return { kind: 'memberLoad', tool, template };
};
