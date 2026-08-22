import type { ProjectModel, ValidationIssue } from '../../types';
import type { FocusableSelection } from './workspaceCommands';

const memberIsLocatable = (project: ProjectModel, memberId: string): boolean => {
  const members = project.members.filter((candidate) => candidate.id === memberId);
  if (members.length !== 1) return false;
  const member = members[0];
  return project.nodes.filter((node) => node.id === member.i).length === 1
    && project.nodes.filter((node) => node.id === member.j).length === 1;
};

const targetForKind = (
  project: ProjectModel,
  kind: NonNullable<ValidationIssue['objectKind']>,
  id: string,
): FocusableSelection | null => {
  if (kind === 'node') return project.nodes.filter((node) => node.id === id).length === 1 ? { kind, id } : null;
  if (kind === 'member') return memberIsLocatable(project, id) ? { kind, id } : null;
  if (kind === 'nodalLoad') {
    const loads = project.nodalLoads.filter((candidate) => candidate.id === id);
    const load = loads.length === 1 ? loads[0] : null;
    return load && project.nodes.filter((node) => node.id === load.nodeId).length === 1 ? { kind, id } : null;
  }
  const loads = project.memberLoads.filter((candidate) => candidate.id === id);
  const load = loads.length === 1 ? loads[0] : null;
  return load && memberIsLocatable(project, load.memberId) ? { kind, id } : null;
};

const inferredKinds = (issueId: string): ReadonlyArray<NonNullable<ValidationIssue['objectKind']>> => {
  if (/^(node-coordinate|near-node|support|spring|hinge-connectivity|hinge-no-frame|duplicate-node-id)-/.test(issueId)
    || /^prescribed-(?!node-|case-|value-|component-)/.test(issueId)) return ['node'];
  if (/^(missing|zero|E|A|I|EA|EI|G|As|GAs|density|timoshenko|release-type|rotational-spring|rigid-offset|dup|duplicate-member-id)-/.test(issueId)) return ['member'];
  if (/^(nodal|free-rotation-moment|hinge-moment|duplicate-nodal-load-id)-/.test(issueId)) return ['nodalLoad'];
  if (/^(member-load|rigid-load|truss-member-load|distributed|horizontal-basis|vertical-basis|point|duplicate-member-load-id)-/.test(issueId)) return ['memberLoad'];
  return [];
};

/** Resolves only objects the existing Canvas focus protocol can physically reveal. */
export const resolveValidationIssueTarget = (
  project: ProjectModel,
  issue: Pick<ValidationIssue, 'id' | 'objectId' | 'objectKind'>,
): FocusableSelection | null => {
  if (!issue.objectId) return null;
  if (issue.objectKind) return targetForKind(project, issue.objectKind, issue.objectId);
  const candidates = inferredKinds(issue.id)
    .map((kind) => targetForKind(project, kind, issue.objectId!))
    .filter((target): target is FocusableSelection => target !== null);
  return candidates.length === 1 ? candidates[0] : null;
};
