import type { ProjectModel } from '../types';

export type ClassroomStructureKind = 'beam' | 'truss' | 'frame';
export type ClassroomPedagogyLevelId = 'fundamentals' | 'procedure' | 'verification';

export interface ClassroomPedagogyLevel {
  id: ClassroomPedagogyLevelId;
  topics: string[];
}

export interface ClassroomPedagogy {
  kind: ClassroomStructureKind;
  levels: ClassroomPedagogyLevel[];
}

const topics: Record<ClassroomStructureKind, Record<ClassroomPedagogyLevelId, string[]>> = {
  beam: {
    fundamentals: ['equilibrium', 'supports', 'load-shear-moment'],
    procedure: ['reactions', 'shear-diagram', 'moment-diagram', 'displacement'],
    verification: ['global-equilibrium', 'diagram-closure', 'units-and-signs'],
  },
  truss: {
    fundamentals: ['two-force-members', 'joints', 'tension-and-compression'],
    procedure: ['support-reactions', 'joint-equilibrium', 'axial-forces', 'displacement'],
    verification: ['joint-equilibrium', 'zero-force-members', 'compatibility'],
  },
  frame: {
    fundamentals: ['degrees-of-freedom', 'continuity', 'axial-shear-moment'],
    procedure: ['element-stiffness', 'assembly', 'constraints', 'member-actions'],
    verification: ['equilibrium', 'compatibility', 'diagram-closure'],
  },
};

export const classifyClassroomStructure = (project: ProjectModel): ClassroomStructureKind => {
  const physicalMembers = project.members.filter((member) => member.type !== 'rigid');
  if (physicalMembers.length > 0 && physicalMembers.every((member) => member.type === 'truss')) return 'truss';
  const ordinates = project.nodes.map((node) => node.y);
  const verticalSpread = ordinates.length ? Math.max(...ordinates) - Math.min(...ordinates) : 0;
  return physicalMembers.some((member) => member.type === 'frame') && verticalSpread > 1e-9 ? 'frame' : 'beam';
};

export const buildClassroomPedagogy = (project: ProjectModel): ClassroomPedagogy => {
  const kind = classifyClassroomStructure(project);
  return {
    kind,
    levels: (['fundamentals', 'procedure', 'verification'] as const).map((id) => ({ id, topics: topics[kind][id] })),
  };
};
