/**
 * Comandos reversibles sobre el proyecto espacial.
 *
 * `applySpace3DCommand` es una función pura: recibe un snapshot y devuelve otro.
 * El historial de deshacer/rehacer guarda snapshots, no comandos inversos, que
 * es la forma barata de garantizar que deshacer nunca reconstruye un estado que
 * el validador no aceptaría.
 *
 * Todo comando termina comparando los problemas del modelo antes y después: se
 * rechaza el que introduce uno nuevo (mover un nudo encima de otro anula la
 * longitud de una barra), y se acepta el que convive con los que ya había —de
 * lo contrario un modelo derivado de 2D, que nace incompleto a propósito, no
 * podría completarse nunca.
 */
import { validateSpace3DProject } from '../model/validation';
import {
  SPACE3D_LIMITS,
  type Space3DFrameMember,
  type Space3DNodalLoad,
  type Space3DNode,
  type Space3DProjectV1,
  type Space3DRestraints,
} from '../model/types';

export type Space3DCommand =
  | { readonly kind: 'add-node'; readonly node: Space3DNode }
  | { readonly kind: 'update-node'; readonly nodeId: string; readonly changes: Partial<Omit<Space3DNode, 'id'>> }
  | { readonly kind: 'delete-node'; readonly nodeId: string }
  | { readonly kind: 'add-member'; readonly member: Space3DFrameMember }
  | { readonly kind: 'update-member'; readonly memberId: string; readonly changes: Partial<Omit<Space3DFrameMember, 'id'>> }
  | { readonly kind: 'delete-member'; readonly memberId: string }
  | { readonly kind: 'set-restraints'; readonly nodeId: string; readonly restraints: Space3DRestraints }
  | { readonly kind: 'add-nodal-load'; readonly load: Space3DNodalLoad }
  | { readonly kind: 'update-nodal-load'; readonly loadId: string; readonly changes: Partial<Omit<Space3DNodalLoad, 'id'>> }
  | { readonly kind: 'delete-nodal-load'; readonly loadId: string };

export type Space3DCommandErrorCode =
  | 'empty-id'
  | 'duplicate-id'
  | 'missing-entity'
  | 'node-in-use'
  | 'self-referential'
  | 'invalid-value'
  | 'limit-exceeded'
  | 'invalid-result';

export class Space3DCommandError extends Error {
  readonly code: Space3DCommandErrorCode;

  constructor(code: Space3DCommandErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'Space3DCommandError';
    this.code = code;
  }
}

const fail = (code: Space3DCommandErrorCode, detail: string): never => { throw new Space3DCommandError(code, detail); };

const requireId = (id: string, kind: string) => {
  if (typeof id !== 'string' || id.trim() === '') fail('empty-id', `${kind} sin identificador`);
};

const requireUnique = (ids: readonly string[], id: string, kind: string) => {
  if (ids.includes(id)) fail('duplicate-id', `ya existe ${kind} «${id}»`);
};

const requireExisting = <T extends { id: string }>(items: readonly T[], id: string, kind: string): T => {
  const found = items.find((item) => item.id === id);
  if (!found) fail('missing-entity', `no existe ${kind} «${id}»`);
  return found as T;
};

const POSITIVE_MEMBER_FIELDS = ['E', 'G', 'A', 'Iy', 'Iz', 'J'] as const;
const LOAD_COMPONENTS = ['fx', 'fy', 'fz', 'mx', 'my', 'mz'] as const;

const requireFinite = (value: unknown, label: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('invalid-value', `${label} debe ser un número finito`);
};

const requirePositive = (value: unknown, label: string) => {
  requireFinite(value, label);
  if ((value as number) <= 0) fail('invalid-value', `${label} debe ser mayor que cero`);
};

const checkNodeShape = (node: Space3DNode) => {
  requireId(node.id, 'el nudo');
  for (const axis of ['x', 'y', 'z'] as const) {
    requireFinite(node[axis], `nudo ${node.id}.${axis}`);
    if (Math.abs(node[axis]) > SPACE3D_LIMITS.maxCoordinateMagnitude) {
      fail('invalid-value', `nudo ${node.id}.${axis} fuera del rango admitido`);
    }
  }
};

const checkMemberShape = (member: Space3DFrameMember) => {
  requireId(member.id, 'la barra');
  for (const field of POSITIVE_MEMBER_FIELDS) requirePositive(member[field], `barra ${member.id}.${field}`);
  requireFinite(member.orientation?.rollRadians, `barra ${member.id}.rollRadians`);
  const reference = member.orientation?.localYReferenceGlobal;
  if (!Array.isArray(reference) || reference.length !== 3) fail('invalid-value', `barra ${member.id}: referencia de orientación inválida`);
  reference.forEach((component, index) => requireFinite(component, `barra ${member.id}.localYReferenceGlobal[${index}]`));
};

const checkLoadShape = (load: Space3DNodalLoad) => {
  requireId(load.id, 'la carga');
  for (const component of LOAD_COMPONENTS) requireFinite(load[component], `carga ${load.id}.${component}`);
};

const issueKey = (issue: { entityKind: string; entityId: string; code: string; field: string }) =>
  `${issue.entityKind}:${issue.entityId}:${issue.code}:${issue.field}`;

/**
 * Un comando se rechaza si **empeora** el modelo, no si el modelo ya estaba mal.
 *
 * Exigir un modelo íntegro después de cada comando parece más seguro y es justo
 * lo contrario: un proyecto derivado de 2D nace con la inercia del eje débil sin
 * definir, y una regla así impediría precisamente las ediciones que sirven para
 * completarlo. Se comparan los problemas antes y después, y sólo los nuevos
 * bloquean.
 */
const finish = (before: Space3DProjectV1, project: Space3DProjectV1): Space3DProjectV1 => {
  const previous = new Set(validateSpace3DProject(before).map(issueKey));
  const introduced = validateSpace3DProject(project).filter((issue) => !previous.has(issueKey(issue)));
  if (introduced.length > 0) {
    const detail = introduced.slice(0, 3).map((item) => `${item.entityKind}:${item.entityId}:${item.code}`).join(', ');
    fail('invalid-result', detail);
  }
  return project;
};

export const applySpace3DCommand = (project: Space3DProjectV1, command: Space3DCommand): Space3DProjectV1 => {
  switch (command.kind) {
    case 'add-node': {
      checkNodeShape(command.node);
      requireUnique(project.nodes.map((node) => node.id), command.node.id, 'el nudo');
      if (project.nodes.length + 1 > SPACE3D_LIMITS.maxNodes) {
        fail('limit-exceeded', `el modelo admite ${SPACE3D_LIMITS.maxNodes} nudos`);
      }
      return finish(project, { ...project, nodes: [...project.nodes, command.node] });
    }

    case 'update-node': {
      const current = requireExisting(project.nodes, command.nodeId, 'el nudo');
      const next = { ...current, ...command.changes, id: current.id };
      checkNodeShape(next);
      return finish(project, { ...project, nodes: project.nodes.map((node) => (node.id === current.id ? next : node)) });
    }

    case 'delete-node': {
      requireExisting(project.nodes, command.nodeId, 'el nudo');
      const members = project.members.filter((member) => member.i === command.nodeId || member.j === command.nodeId);
      const loads = project.nodalLoads.filter((load) => load.nodeId === command.nodeId);
      if (members.length > 0 || loads.length > 0) {
        const consumers = [...members.map((item) => item.id), ...loads.map((item) => item.id)].join(', ');
        fail('node-in-use', `el nudo «${command.nodeId}» todavía es usado por: ${consumers}`);
      }
      return finish(project, { ...project, nodes: project.nodes.filter((node) => node.id !== command.nodeId) });
    }

    case 'add-member': {
      checkMemberShape(command.member);
      requireUnique(project.members.map((member) => member.id), command.member.id, 'la barra');
      requireExisting(project.nodes, command.member.i, 'el nudo');
      requireExisting(project.nodes, command.member.j, 'el nudo');
      if (command.member.i === command.member.j) fail('self-referential', 'una barra no puede unir un nudo consigo mismo');
      if (project.members.length + 1 > SPACE3D_LIMITS.maxMembers) {
        fail('limit-exceeded', `el modelo admite ${SPACE3D_LIMITS.maxMembers} barras`);
      }
      return finish(project, { ...project, members: [...project.members, command.member] });
    }

    case 'update-member': {
      const current = requireExisting(project.members, command.memberId, 'la barra');
      const next = { ...current, ...command.changes, id: current.id };
      checkMemberShape(next);
      requireExisting(project.nodes, next.i, 'el nudo');
      requireExisting(project.nodes, next.j, 'el nudo');
      if (next.i === next.j) fail('self-referential', 'una barra no puede unir un nudo consigo mismo');
      return finish(project, { ...project, members: project.members.map((member) => (member.id === current.id ? next : member)) });
    }

    case 'delete-member': {
      requireExisting(project.members, command.memberId, 'la barra');
      return finish(project, { ...project, members: project.members.filter((member) => member.id !== command.memberId) });
    }

    case 'set-restraints': {
      const current = requireExisting(project.nodes, command.nodeId, 'el nudo');
      for (const dof of ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const) {
        if (typeof command.restraints[dof] !== 'boolean') fail('invalid-value', `apoyo ${command.nodeId}.${dof}`);
      }
      const next = { ...current, restraints: { ...command.restraints } };
      return finish(project, { ...project, nodes: project.nodes.map((node) => (node.id === current.id ? next : node)) });
    }

    case 'add-nodal-load': {
      checkLoadShape(command.load);
      requireUnique(project.nodalLoads.map((load) => load.id), command.load.id, 'la carga');
      requireExisting(project.nodes, command.load.nodeId, 'el nudo');
      requireExisting(project.loadCases, command.load.caseId, 'el caso de carga');
      return finish(project, { ...project, nodalLoads: [...project.nodalLoads, command.load] });
    }

    case 'update-nodal-load': {
      const current = requireExisting(project.nodalLoads, command.loadId, 'la carga');
      const next = { ...current, ...command.changes, id: current.id };
      checkLoadShape(next);
      requireExisting(project.nodes, next.nodeId, 'el nudo');
      requireExisting(project.loadCases, next.caseId, 'el caso de carga');
      return finish(project, { ...project, nodalLoads: project.nodalLoads.map((load) => (load.id === current.id ? next : load)) });
    }

    case 'delete-nodal-load': {
      requireExisting(project.nodalLoads, command.loadId, 'la carga');
      return finish(project, { ...project, nodalLoads: project.nodalLoads.filter((load) => load.id !== command.loadId) });
    }
  }
};
