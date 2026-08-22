import type { GeneratorParams, GeneratorWarningCode } from './generatorTypes';

/**
 * Fixtures manuales del núcleo de generación.
 *
 * Cada geometría está escrita a mano, nodo por nodo y miembro por miembro, a
 * partir de los parámetros: son la referencia independiente contra la que se
 * contrasta el generador. Si alguien cambia el orden de creación, el reparto de
 * IDs o la topología de una familia, estas tablas fallan antes que nada más.
 *
 * Las propiedades de miembro se dejan explícitas y constantes para que la tabla
 * hable sólo de geometría y conectividad.
 */

const PROPERTIES = { kind: 'explicit', E: 200e6, A: 0.01, I: 8e-5 } as const;

export interface GeneratorFixture {
  readonly id: string;
  readonly description: string;
  readonly params: GeneratorParams;
  /** `[id, x, y]` en el orden exacto de creación. */
  readonly nodes: readonly (readonly [string, number, number])[];
  /** `[id, nodoI, nodoJ]` en el orden exacto de creación. */
  readonly members: readonly (readonly [string, string, string])[];
  readonly supportedNodeIds: readonly string[];
  readonly warningCodes: readonly GeneratorWarningCode[];
}

export const generatorFixtures: readonly GeneratorFixture[] = [
  {
    id: 'continuous-beam-non-uniform',
    description: 'Viga continua de tres claros desiguales sin apoyos',
    params: { kind: 'continuous-beam', spans: { kind: 'list', values: [5, 4, 6] }, properties: PROPERTIES },
    nodes: [['N1', 0, 0], ['N2', 5, 0], ['N3', 9, 0], ['N4', 15, 0]],
    members: [['M1', 'N1', 'N2'], ['M2', 'N2', 'N3'], ['M3', 'N3', 'N4']],
    supportedNodeIds: [],
    warningCodes: ['no-supports'],
  },
  {
    id: 'continuous-beam-uniform-pinned',
    description: 'Viga continua uniforme apoyada, insertada fuera del origen',
    params: {
      kind: 'continuous-beam',
      spans: { kind: 'uniform', count: 4, spacing: 3 },
      origin: { x: 2, y: 1.5 },
      baseSupport: { type: 'pin' },
      properties: PROPERTIES,
    },
    nodes: [['N1', 2, 1.5], ['N2', 5, 1.5], ['N3', 8, 1.5], ['N4', 11, 1.5], ['N5', 14, 1.5]],
    members: [['M1', 'N1', 'N2'], ['M2', 'N2', 'N3'], ['M3', 'N3', 'N4'], ['M4', 'N4', 'N5']],
    supportedNodeIds: ['N1', 'N2', 'N3', 'N4', 'N5'],
    warningCodes: [],
  },
  {
    id: 'portal-frame-two-bays',
    description: 'Pórtico de dos crujías desiguales empotrado en la base',
    params: {
      kind: 'portal-frame',
      bays: { kind: 'list', values: [6, 4] },
      height: 3.5,
      baseSupport: { type: 'fixed' },
      properties: PROPERTIES,
    },
    nodes: [
      ['N1', 0, 0], ['N2', 6, 0], ['N3', 10, 0],
      ['N4', 0, 3.5], ['N5', 6, 3.5], ['N6', 10, 3.5],
    ],
    members: [
      ['M1', 'N1', 'N4'], ['M2', 'N2', 'N5'], ['M3', 'N3', 'N6'],
      ['M4', 'N4', 'N5'], ['M5', 'N5', 'N6'],
    ],
    supportedNodeIds: ['N1', 'N2', 'N3'],
    warningCodes: [],
  },
  {
    id: 'multi-story-frame-two-levels',
    description: 'Marco de dos crujías y dos niveles de alturas distintas',
    params: {
      kind: 'multi-story-frame',
      bays: { kind: 'uniform', count: 2, spacing: 5 },
      stories: { kind: 'list', values: [3, 2.8] },
      baseSupport: { type: 'pin' },
      properties: PROPERTIES,
    },
    nodes: [
      ['N1', 0, 0], ['N2', 5, 0], ['N3', 10, 0],
      ['N4', 0, 3], ['N5', 5, 3], ['N6', 10, 3],
      ['N7', 0, 5.8], ['N8', 5, 5.8], ['N9', 10, 5.8],
    ],
    members: [
      ['M1', 'N1', 'N4'], ['M2', 'N2', 'N5'], ['M3', 'N3', 'N6'],
      ['M4', 'N4', 'N5'], ['M5', 'N5', 'N6'],
      ['M6', 'N4', 'N7'], ['M7', 'N5', 'N8'], ['M8', 'N6', 'N9'],
      ['M9', 'N7', 'N8'], ['M10', 'N8', 'N9'],
    ],
    supportedNodeIds: ['N1', 'N2', 'N3'],
    warningCodes: [],
  },
  {
    id: 'truss-pratt-four-panels',
    description: 'Cercha Pratt de cuatro paneles iguales con montantes en todos los nudos',
    params: {
      kind: 'truss',
      topology: 'pratt',
      panels: { kind: 'uniform', count: 4, spacing: 3 },
      depth: 2,
      baseSupport: { type: 'pin' },
      properties: PROPERTIES,
    },
    nodes: [
      ['N1', 0, 0], ['N2', 3, 0], ['N3', 6, 0], ['N4', 9, 0], ['N5', 12, 0],
      ['N6', 0, 2], ['N7', 3, 2], ['N8', 6, 2], ['N9', 9, 2], ['N10', 12, 2],
    ],
    members: [
      ['M1', 'N1', 'N2'], ['M2', 'N2', 'N3'], ['M3', 'N3', 'N4'], ['M4', 'N4', 'N5'],
      ['M5', 'N6', 'N7'], ['M6', 'N7', 'N8'], ['M7', 'N8', 'N9'], ['M8', 'N9', 'N10'],
      ['M9', 'N1', 'N6'], ['M10', 'N2', 'N7'], ['M11', 'N3', 'N8'], ['M12', 'N4', 'N9'], ['M13', 'N5', 'N10'],
      ['M14', 'N6', 'N2'], ['M15', 'N7', 'N3'], ['M16', 'N3', 'N9'], ['M17', 'N4', 'N10'],
    ],
    supportedNodeIds: ['N1', 'N5'],
    warningCodes: [],
  },
  {
    id: 'truss-howe-four-panels',
    description: 'Cercha Howe: diagonales espejo de la Pratt sobre la misma retícula',
    params: {
      kind: 'truss',
      topology: 'howe',
      panels: { kind: 'uniform', count: 4, spacing: 3 },
      depth: 2,
      properties: PROPERTIES,
    },
    nodes: [
      ['N1', 0, 0], ['N2', 3, 0], ['N3', 6, 0], ['N4', 9, 0], ['N5', 12, 0],
      ['N6', 0, 2], ['N7', 3, 2], ['N8', 6, 2], ['N9', 9, 2], ['N10', 12, 2],
    ],
    members: [
      ['M1', 'N1', 'N2'], ['M2', 'N2', 'N3'], ['M3', 'N3', 'N4'], ['M4', 'N4', 'N5'],
      ['M5', 'N6', 'N7'], ['M6', 'N7', 'N8'], ['M7', 'N8', 'N9'], ['M8', 'N9', 'N10'],
      ['M9', 'N1', 'N6'], ['M10', 'N2', 'N7'], ['M11', 'N3', 'N8'], ['M12', 'N4', 'N9'], ['M13', 'N5', 'N10'],
      ['M14', 'N1', 'N7'], ['M15', 'N2', 'N8'], ['M16', 'N8', 'N4'], ['M17', 'N9', 'N5'],
    ],
    supportedNodeIds: [],
    warningCodes: ['no-supports'],
  },
  {
    id: 'truss-warren-four-panels',
    description: 'Cercha Warren sin montantes intermedios: el cordón superior sólo tiene nudos con diagonal',
    params: {
      kind: 'truss',
      topology: 'warren',
      panels: { kind: 'uniform', count: 4, spacing: 3 },
      depth: 2,
      baseSupport: { type: 'pin' },
      properties: PROPERTIES,
    },
    nodes: [
      ['N1', 0, 0], ['N2', 3, 0], ['N3', 6, 0], ['N4', 9, 0], ['N5', 12, 0],
      ['N6', 0, 2], ['N7', 3, 2], ['N8', 9, 2], ['N9', 12, 2],
    ],
    members: [
      ['M1', 'N1', 'N2'], ['M2', 'N2', 'N3'], ['M3', 'N3', 'N4'], ['M4', 'N4', 'N5'],
      ['M5', 'N6', 'N7'], ['M6', 'N7', 'N8'], ['M7', 'N8', 'N9'],
      ['M8', 'N1', 'N6'], ['M9', 'N5', 'N9'],
      ['M10', 'N1', 'N7'], ['M11', 'N7', 'N3'], ['M12', 'N3', 'N8'], ['M13', 'N8', 'N5'],
    ],
    supportedNodeIds: ['N1', 'N5'],
    warningCodes: [],
  },
  {
    id: 'truss-warren-non-uniform-odd',
    description: 'Cercha Warren de tres paneles desiguales: geometría irregular y asimétrica',
    params: {
      kind: 'truss',
      topology: 'warren',
      panels: { kind: 'list', values: [3, 4, 3] },
      depth: 1.5,
      includeVerticals: true,
      properties: PROPERTIES,
    },
    nodes: [
      ['N1', 0, 0], ['N2', 3, 0], ['N3', 7, 0], ['N4', 10, 0],
      ['N5', 0, 1.5], ['N6', 3, 1.5], ['N7', 7, 1.5], ['N8', 10, 1.5],
    ],
    members: [
      ['M1', 'N1', 'N2'], ['M2', 'N2', 'N3'], ['M3', 'N3', 'N4'],
      ['M4', 'N5', 'N6'], ['M5', 'N6', 'N7'], ['M6', 'N7', 'N8'],
      ['M7', 'N1', 'N5'], ['M8', 'N2', 'N6'], ['M9', 'N3', 'N7'], ['M10', 'N4', 'N8'],
      ['M11', 'N1', 'N6'], ['M12', 'N6', 'N3'], ['M13', 'N3', 'N8'],
    ],
    supportedNodeIds: [],
    warningCodes: ['no-supports', 'non-uniform-truss-panels', 'asymmetric-truss-diagonals'],
  },
  {
    id: 'grid-two-by-two',
    description: 'Retícula estructural de 2 x 2 módulos con miembros en ambas direcciones',
    params: {
      kind: 'grid',
      columns: { kind: 'uniform', count: 2, spacing: 4 },
      rows: { kind: 'list', values: [3, 3] },
      properties: PROPERTIES,
    },
    nodes: [
      ['N1', 0, 0], ['N2', 4, 0], ['N3', 8, 0],
      ['N4', 0, 3], ['N5', 4, 3], ['N6', 8, 3],
      ['N7', 0, 6], ['N8', 4, 6], ['N9', 8, 6],
    ],
    members: [
      ['M1', 'N1', 'N2'], ['M2', 'N2', 'N3'],
      ['M3', 'N4', 'N5'], ['M4', 'N5', 'N6'],
      ['M5', 'N7', 'N8'], ['M6', 'N8', 'N9'],
      ['M7', 'N1', 'N4'], ['M8', 'N4', 'N7'],
      ['M9', 'N2', 'N5'], ['M10', 'N5', 'N8'],
      ['M11', 'N3', 'N6'], ['M12', 'N6', 'N9'],
    ],
    supportedNodeIds: [],
    warningCodes: ['no-supports'],
  },
  {
    id: 'grid-vertical-only',
    description: 'Retícula sólo con miembros verticales: los nodos de una columna quedan enlazados',
    params: {
      kind: 'grid',
      columns: { kind: 'uniform', count: 1, spacing: 4 },
      rows: { kind: 'uniform', count: 2, spacing: 3 },
      members: 'vertical',
      baseSupport: { type: 'fixed' },
      properties: PROPERTIES,
    },
    nodes: [
      ['N1', 0, 0], ['N2', 4, 0],
      ['N3', 0, 3], ['N4', 4, 3],
      ['N5', 0, 6], ['N6', 4, 6],
    ],
    members: [
      ['M1', 'N1', 'N3'], ['M2', 'N3', 'N5'],
      ['M3', 'N2', 'N4'], ['M4', 'N4', 'N6'],
    ],
    supportedNodeIds: ['N1', 'N2'],
    warningCodes: [],
  },
];

export const findGeneratorFixture = (id: string): GeneratorFixture => {
  const fixture = generatorFixtures.find((item) => item.id === id);
  if (!fixture) throw new Error(`No existe el fixture de generación ${id}.`);
  return fixture;
};
