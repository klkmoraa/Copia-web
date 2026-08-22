import { createBlankProject } from '../data/defaultProject';
import type { ProjectModel } from '../types';

const CUSTOM_MEMBER_IDENTITY = { materialOrigin: 'custom', sectionOrigin: 'custom' } as const;

export type ClassroomExerciseTemplateId = 'blank' | 'simple-beam' | 'cantilever' | 'portal-frame' | 'triangular-truss';
export type ClassroomDifficulty = 'basic' | 'intermediate' | 'advanced';
export type ClassroomTopic = 'inicio' | 'vigas' | 'diagramas' | 'pórticos' | 'armaduras' | 'hiperestática';
export type ClassroomExerciseParameterKey = 'length' | 'height' | 'loadMagnitude' | 'distributedLoadMagnitude' | 'loadPosition';

export interface ClassroomExerciseParameters {
  length: number;
  height: number;
  loadMagnitude: number;
  distributedLoadMagnitude: number;
  loadPosition: number;
}

export interface ClassroomExerciseField {
  key: ClassroomExerciseParameterKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

export interface ClassroomExerciseTemplate {
  id: ClassroomExerciseTemplateId;
  name: string;
  description: string;
  difficulty: ClassroomDifficulty;
  topics: ClassroomTopic[];
  durationMinutes: number;
  defaults: Partial<ClassroomExerciseParameters>;
  fields: ClassroomExerciseField[];
  build: (parameters?: Partial<ClassroomExerciseParameters>) => ProjectModel;
}

const finitePositive = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) && (value ?? 0) > 0 ? value as number : fallback;

const normalizedPosition = (value: number | undefined, fallback = 0.5) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value as number)) : fallback;

const classroomBase = (name: string): ProjectModel => {
  const project = createBlankProject();
  return {
    ...project,
    name,
    settings: { ...project.settings, calculationMode: 'classroom' },
  };
};

export const createBlankClassroomExercise = (): ProjectModel => classroomBase('Ejercicio sin título');

export const createSimpleBeamExercise = (parameters: Partial<ClassroomExerciseParameters> = {}): ProjectModel => {
  const length = finitePositive(parameters.length, 8);
  const loadMagnitude = finitePositive(parameters.loadMagnitude, 40);
  const loadPosition = normalizedPosition(parameters.loadPosition);
  return {
    ...classroomBase('Viga simplemente apoyada'),
    nodes: [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: length, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ],
    members: [
      { id: 'M1', i: 'N1', j: 'N2', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.01, I: 8e-5, density: 0, releases: { iMoment: true, jMoment: true } },
    ],
    memberLoads: [
      {
        id: 'ML1', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real',
        start: 0, end: 1, px: 0, py: -loadMagnitude, position: loadPosition,
      },
    ],
  };
};

export const createCantileverExercise = (parameters: Partial<ClassroomExerciseParameters> = {}): ProjectModel => {
  const length = finitePositive(parameters.length, 5);
  const loadMagnitude = finitePositive(parameters.loadMagnitude, 30);
  return {
    ...classroomBase('Voladizo con carga puntual'),
    nodes: [
      { id: 'N1', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'N2', x: length, y: 0, support: { type: 'none' } },
    ],
    members: [
      { id: 'M1', i: 'N1', j: 'N2', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.01, I: 8e-5, density: 0 },
    ],
    nodalLoads: [
      { id: 'NL1', nodeId: 'N2', caseId: 'LC1', fx: 0, fy: -loadMagnitude, mz: 0 },
    ],
  };
};

export const createPortalFrameExercise = (parameters: Partial<ClassroomExerciseParameters> = {}): ProjectModel => {
  const length = finitePositive(parameters.length, 6);
  const height = finitePositive(parameters.height, 4);
  const distributedLoadMagnitude = finitePositive(parameters.distributedLoadMagnitude, 15);
  return {
    ...classroomBase('Pórtico de un claro'),
    nodes: [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: length, y: 0, support: { type: 'pin' } },
      { id: 'N3', x: 0, y: height, support: { type: 'none' } },
      { id: 'N4', x: length, y: height, support: { type: 'none' } },
    ],
    members: [
      { id: 'M1', i: 'N1', j: 'N3', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.005, I: 8.333e-5, density: 0 },
      { id: 'M2', i: 'N3', j: 'N4', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.005, I: 8.333e-5, density: 0 },
      { id: 'M3', i: 'N2', j: 'N4', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.005, I: 8.333e-5, density: 0 },
    ],
    memberLoads: [
      {
        id: 'ML1', memberId: 'M2', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
        start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -distributedLoadMagnitude, qyEnd: -distributedLoadMagnitude,
      },
    ],
  };
};

export const createTriangularTrussExercise = (parameters: Partial<ClassroomExerciseParameters> = {}): ProjectModel => {
  const length = finitePositive(parameters.length, 6);
  const height = finitePositive(parameters.height, 4);
  const loadMagnitude = finitePositive(parameters.loadMagnitude, 60);
  return {
    ...classroomBase('Armadura triangular'),
    nodes: [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: length, y: 0, support: { type: 'roller', angleDeg: 90 } },
      { id: 'N3', x: length / 2, y: height, support: { type: 'none' } },
    ],
    members: [
      { id: 'M1', i: 'N1', j: 'N2', type: 'truss', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.003, I: 0, density: 0 },
      { id: 'M2', i: 'N1', j: 'N3', type: 'truss', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.003, I: 0, density: 0 },
      { id: 'M3', i: 'N2', j: 'N3', type: 'truss', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.003, I: 0, density: 0 },
    ],
    nodalLoads: [
      { id: 'NL1', nodeId: 'N3', caseId: 'LC1', fx: 0, fy: -loadMagnitude, mz: 0 },
    ],
  };
};

const lengthField: ClassroomExerciseField = { key: 'length', label: 'Longitud o claro', unit: 'm', min: 0.1, max: 1_000, step: 0.1 };
const heightField: ClassroomExerciseField = { key: 'height', label: 'Altura', unit: 'm', min: 0.1, max: 1_000, step: 0.1 };
const loadField: ClassroomExerciseField = { key: 'loadMagnitude', label: 'Carga hacia abajo', unit: 'kN', min: 0.001, max: 1e9, step: 1 };
const distributedLoadField: ClassroomExerciseField = { key: 'distributedLoadMagnitude', label: 'Carga distribuida hacia abajo', unit: 'kN/m', min: 0.001, max: 1e9, step: 1 };
const loadPositionField: ClassroomExerciseField = { key: 'loadPosition', label: 'Posición de la carga', unit: 'x/L', min: 0, max: 1, step: 0.05 };

export const classroomExerciseTemplates: ClassroomExerciseTemplate[] = [
  {
    id: 'blank',
    name: 'Desde cero',
    description: 'Lienzo vacío con un caso de carga listo para usar.',
    difficulty: 'basic',
    topics: ['inicio'],
    durationMinutes: 5,
    defaults: {},
    fields: [],
    build: createBlankClassroomExercise,
  },
  {
    id: 'simple-beam',
    name: 'Viga simplemente apoyada',
    description: 'Carga puntual editable sobre una viga isostática.',
    difficulty: 'basic',
    topics: ['vigas', 'diagramas'],
    durationMinutes: 10,
    defaults: { length: 8, loadMagnitude: 40, loadPosition: 0.5 },
    fields: [lengthField, loadField, loadPositionField],
    build: createSimpleBeamExercise,
  },
  {
    id: 'cantilever',
    name: 'Voladizo',
    description: 'Viga empotrada con una carga puntual en el extremo libre.',
    difficulty: 'basic',
    topics: ['vigas', 'diagramas'],
    durationMinutes: 10,
    defaults: { length: 5, loadMagnitude: 30 },
    fields: [lengthField, loadField],
    build: createCantileverExercise,
  },
  {
    id: 'triangular-truss',
    name: 'Armadura triangular',
    description: 'Tres barras para estudiar tensión, compresión y reacciones.',
    difficulty: 'intermediate',
    topics: ['armaduras'],
    durationMinutes: 15,
    defaults: { length: 6, height: 4, loadMagnitude: 60 },
    fields: [lengthField, heightField, loadField],
    build: createTriangularTrussExercise,
  },
  {
    id: 'portal-frame',
    name: 'Pórtico de un claro',
    description: 'Pórtico hiperestático para observar el efecto de la rigidez relativa.',
    difficulty: 'advanced',
    topics: ['pórticos', 'diagramas', 'hiperestática'],
    durationMinutes: 20,
    defaults: { length: 6, height: 4, distributedLoadMagnitude: 15 },
    fields: [lengthField, heightField, distributedLoadField],
    build: createPortalFrameExercise,
  },
];

export const getClassroomExerciseTemplate = (id: ClassroomExerciseTemplateId) => {
  const template = classroomExerciseTemplates.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`No existe la plantilla educativa ${id}.`);
  return template;
};
