import { describe, expect, it } from 'vitest';
import type { MemberModel, NodeModel } from '../../types';
import { validateGeneratedStructure } from './generatorValidation';
import type { GeneratedStructure } from './generatorTypes';

const member = (id: string, i: string, j: string): MemberModel => ({
  id, i, j, type: 'frame', materialOrigin: 'custom', sectionOrigin: 'custom', E: 200e6, A: 0.01, I: 8e-5,
});

const node = (id: string, x: number, y: number, supported = false): NodeModel => ({
  id, x, y, support: supported ? { type: 'pin' } : { type: 'none' },
});

/** Viga de dos claros apoyada en el primer nodo, escrita a mano. */
const valid = (): GeneratedStructure => ({
  kind: 'continuous-beam',
  description: 'Viga continua',
  nodes: [node('N1', 0, 0, true), node('N2', 5, 0), node('N3', 10, 0)],
  members: [member('M1', 'N1', 'N2'), member('M2', 'N2', 'N3')],
  nodeRoles: { N1: 'joint', N2: 'joint', N3: 'joint' },
  memberRoles: { M1: 'beam', M2: 'beam' },
  supportedNodeIds: ['N1'],
  summary: {
    nodeCount: 3,
    memberCount: 2,
    supportedNodeCount: 1,
    memberCountsByRole: { beam: 2 },
    totalMemberLength: 10,
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 0 },
    properties: { E: 200e6, A: 0.01, I: 8e-5 },
  },
  warnings: [],
});

const mutate = (change: (draft: {
  nodes: NodeModel[];
  members: MemberModel[];
  nodeRoles: Record<string, GeneratedStructure['nodeRoles'][string]>;
  memberRoles: Record<string, GeneratedStructure['memberRoles'][string]>;
  supportedNodeIds: string[];
  summary: GeneratedStructure['summary'];
}) => void): GeneratedStructure => {
  const draft = structuredClone(valid()) as unknown as GeneratedStructure & {
    nodes: NodeModel[];
    members: MemberModel[];
    nodeRoles: Record<string, GeneratedStructure['nodeRoles'][string]>;
    memberRoles: Record<string, GeneratedStructure['memberRoles'][string]>;
    supportedNodeIds: string[];
    summary: GeneratedStructure['summary'];
  };
  change(draft);
  return draft;
};

describe('validateGeneratedStructure', () => {
  it('acepta una geometría bien formada', () => {
    expect(() => validateGeneratedStructure(valid())).not.toThrow();
  });

  it('rechaza IDs de nodo duplicados', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.nodes[2] = node('N2', 10, 0);
      draft.nodeRoles = { N1: 'joint', N2: 'joint' };
      draft.summary = { ...draft.summary, nodeCount: 3 };
    }))).toThrow('Nodos: ID duplicado N2.');
  });

  it('rechaza IDs de miembro duplicados', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.members[1] = member('M1', 'N2', 'N3');
      draft.memberRoles = { M1: 'beam' };
      draft.summary = { ...draft.summary, memberCount: 2 };
    }))).toThrow('Miembros: ID duplicado M1.');
  });

  it('rechaza una referencia a un nodo inexistente', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.members[1] = member('M2', 'N2', 'N9');
    }))).toThrow('El miembro M2 referencia el nodo inexistente N9.');
  });

  it('rechaza un miembro con el mismo nodo en ambos extremos', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.members[1] = member('M2', 'N2', 'N2');
    }))).toThrow('El miembro M2 no puede usar el mismo nodo en ambos extremos.');
  });

  it('rechaza un miembro de longitud cero', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.nodes[2] = node('N3', 5, 0);
      draft.summary = { ...draft.summary, bounds: { minX: 0, minY: 0, maxX: 5, maxY: 0 }, totalMemberLength: 5 };
    }))).toThrow('El miembro M2 quedaría con longitud cero.');
  });

  it('rechaza dos nodos coincidentes aunque ningún miembro los una', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.nodes.push(node('N4', 5, 0));
      draft.nodeRoles.N4 = 'joint';
      draft.summary = { ...draft.summary, nodeCount: 4 };
    }))).toThrow('Los nodos generados N2 y N4 son coincidentes.');
  });

  it('rechaza una coordenada no finita', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.nodes[2] = node('N3', Number.NaN, 0);
    }))).toThrow('El nodo N3 X debe ser finito.');
  });

  it('rechaza una identidad de catálogo sin su clave', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.members[0] = { ...draft.members[0], sectionOrigin: 'catalog' };
    }))).toThrow('El miembro M1 declara sección de catálogo sin sectionId.');
  });

  it('rechaza un nodo sin rol declarado', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      delete draft.nodeRoles.N3;
    }))).toThrow('El nodo generado N3 no declara su rol.');
  });

  it('rechaza un rol que no corresponde a ningún nodo', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.nodeRoles.N9 = 'joint';
    }))).toThrow('El rol N9 no corresponde a ningún nodo generado.');
  });

  it('rechaza un miembro sin rol declarado', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      delete draft.memberRoles.M2;
    }))).toThrow('El miembro generado M2 no declara su rol.');
  });

  it('rechaza un rol que no corresponde a ningún miembro', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.memberRoles.M9 = 'beam';
    }))).toThrow('El rol M9 no corresponde a ningún miembro generado.');
  });

  it('rechaza un apoyo declarado sobre un nodo inexistente', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.supportedNodeIds = ['N9'];
      draft.summary = { ...draft.summary, supportedNodeCount: 1 };
    }))).toThrow('El apoyo declarado apunta al nodo inexistente N9.');
  });

  it('rechaza un nodo apoyado que no aparece en la lista de apoyos', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.supportedNodeIds = [];
      draft.summary = { ...draft.summary, supportedNodeCount: 0 };
    }))).toThrow('El nodo N1 tiene apoyo pero no está declarado como apoyado.');
  });

  it('rechaza un nodo declarado como apoyado que no tiene apoyo', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.supportedNodeIds = ['N1', 'N2'];
      draft.summary = { ...draft.summary, supportedNodeCount: 2 };
    }))).toThrow('El nodo N2 está declarado como apoyado pero no tiene apoyo.');
  });

  it('rechaza un resumen que no cuenta lo que existe', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.summary = { ...draft.summary, memberCount: 7 };
    }))).toThrow('El resumen declara 7 miembros pero la geometría tiene 2.');
  });

  it('rechaza un resumen con un conteo de apoyos incorrecto', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.summary = { ...draft.summary, supportedNodeCount: 3 };
    }))).toThrow('El resumen declara 3 nodos apoyados pero la geometría tiene 1.');
  });

  it('rechaza un resumen que no cuenta los nodos que existen', () => {
    expect(() => validateGeneratedStructure(mutate((draft) => {
      draft.summary = { ...draft.summary, nodeCount: 9 };
    }))).toThrow('El resumen declara 9 nodos pero la geometría tiene 3.');
  });
});
