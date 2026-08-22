import { applyProjectPatch, compileProjectCommand, type CompiledProjectCommand, type ProjectCommand } from '../../commands/projectCommand';
import type { MemberModel, NodeModel, ProjectModel, Selection } from '../../types';

export interface PreparedDuplicatePreview {
  command: ProjectCommand;
  compiled: CompiledProjectCommand;
  addedNodes: NodeModel[];
  addedMembers: MemberModel[];
}

export const prepareDuplicatePreview = (
  project: ProjectModel,
  selection: Selection,
  offset: { x: number; y: number },
): PreparedDuplicatePreview => {
  if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) throw new Error('El desplazamiento debe ser finito.');
  const command: ProjectCommand = { kind: 'selection.duplicate', description: 'Duplicar selección', selection, offset };
  const compiled = compileProjectCommand(project, command);
  const preview = applyProjectPatch(project, compiled.forward);
  const nodeIds = new Set(project.nodes.map((node) => node.id));
  const memberIds = new Set(project.members.map((member) => member.id));
  return {
    command,
    compiled,
    addedNodes: preview.nodes.filter((node) => !nodeIds.has(node.id)),
    addedMembers: preview.members.filter((member) => !memberIds.has(member.id)),
  };
};
