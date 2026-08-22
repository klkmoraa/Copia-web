import type { ProjectModel, ProjectSettings } from '../types';
import { createId } from '../utils/id';

export const CURRENT_SCHEMA_VERSION = 6;

const CUSTOM_MEMBER_IDENTITY = { materialOrigin: 'custom', sectionOrigin: 'custom' } as const;

export const createDefaultSettings = (): ProjectSettings => ({
  units: 'kN-m',
  language: 'es',
  gridSize: 1,
  snap: true,
  snapTargets: { grid: true, nodes: true, midpoints: true, intersections: true, perpendicular: true },
  selectionFilter: { nodes: true, members: true, loads: true },
  showGrid: true,
  showNodeLabels: true,
  showMemberLabels: false,
  showLocalAxes: false,
  showLoads: true,
  showDimensions: true,
  showResultValues: true,
  diagramScale: 1,
  diagramScaleMode: 'common',
  showResultOverlay: true,
  deformedScale: 80,
  diagramSide: 'positive',
  calculationMode: 'complete',
});

/** Fresh work starts without structural objects; examples remain opt-in. */
export const createBlankProject = (): ProjectModel => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: createId(),
  name: 'Proyecto sin título',
  nodes: [],
  members: [],
  // Keep one active case so a load can be added as soon as the user draws a model.
  loadCases: [{ id: 'LC1', name: 'Caso 1', category: 'other', active: true, selfWeightFactor: 0 }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings: createDefaultSettings(),
});

export const createDefaultProject = (): ProjectModel => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: createId(),
  name: 'Pórtico de ejemplo',
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 6, y: 0, support: { type: 'pin' } },
    { id: 'N3', x: 0, y: 4, support: { type: 'none' } },
    { id: 'N4', x: 6, y: 4, support: { type: 'none' } },
  ],
  members: [
    { id: 'M1', i: 'N1', j: 'N3', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 },
    { id: 'M2', i: 'N3', j: 'N4', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 },
    { id: 'M3', i: 'N2', j: 'N4', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 },
  ],
  loadCases: [
    { id: 'LC1', name: 'Carga de servicio', category: 'variable', active: true, selfWeightFactor: 0 },
    { id: 'DL', name: 'Peso propio', category: 'permanent', active: false, selfWeightFactor: 1 },
  ],
  combinations: [
    { id: 'COMB1', name: 'Servicio', factors: { LC1: 1, DL: 1 } },
    {
      id: 'NTC-CDMX-2023-ORD',
      name: 'NTC CDMX 2023 · Ordinaria editable',
      factors: { DL: 1.3, LC1: 1.5 },
      source: 'Plantilla educativa editable. Verificar factores con la publicación oficial vigente antes de usar.',
      jurisdiction: 'Ciudad de México',
      edition: '2023',
      reviewedAt: '2026-07-10',
    },
  ],
  nodalLoads: [
    { id: 'NL1', nodeId: 'N3', caseId: 'LC1', fx: 0, fy: -20, mz: 0 },
    { id: 'NL2', nodeId: 'N4', caseId: 'LC1', fx: 0, fy: -20, mz: 0 },
  ],
  prescribedDisplacements: [],
  memberLoads: [
    {
      id: 'ML1',
      memberId: 'M2',
      caseId: 'LC1',
      type: 'distributed',
      coordinateSystem: 'global',
      lengthBasis: 'real',
      start: 0,
      end: 1,
      qxStart: 0,
      qxEnd: 0,
      qyStart: -15,
      qyEnd: -15,
    },
  ],
  memberInitialEffects: [],
  settings: createDefaultSettings(),
});

const HIBBELER_PEARSON_SAMPLE = 'https://www.pearsonhighered.com/assets/samplechapter/0/1/3/6/0136020607.pdf';
const HIBBELER_PEARSON_11E = 'https://www.pearson.com/en-us/pearsonplus/p/9780138026394';

/** Public Pearson sample, Fig. 2-11: 10 ft beam under 500 lb/ft tributary loading. */
export const createHibbelerTributaryBeam = (): ProjectModel => {
  const project = createDefaultProject();
  const length = 3.048; // 10 ft
  const distributedLoad = 7.29695146860337; // 0.500 kip/ft in kN/m
  return {
    ...project,
    id: createId(),
    name: 'Hibbeler · carga tributaria Fig. 2–11',
    nodes: [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: length, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ],
    members: [
      { id: 'AB', i: 'A', j: 'B', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.01, I: 8e-5, releases: { iMoment: true, jMoment: true } },
    ],
    loadCases: [{ id: 'LC1', name: 'Carga tributaria', category: 'variable', active: true }],
    combinations: [],
    nodalLoads: [],
    memberLoads: [{
      id: 'W', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
      start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -distributedLoad, qyEnd: -distributedLoad,
    }],
    settings: { ...createDefaultSettings(), units: 'kip-ft', gridSize: 0.3048 },
    educationalCase: {
      kind: 'attributed-example',
      sourceTitle: 'R. C. Hibbeler, Structural Analysis · muestra oficial Pearson, Fig. 2–11',
      sourceUrl: HIBBELER_PEARSON_SAMPLE,
      chapter: 'Capítulo 2 · Cargas tributarias y estructura idealizada',
      note: 'Adaptación digital del ejemplo público. E, A e I se asignan solo para permitir la deformada; las comprobaciones atribuidas son reacciones y momento.',
      expectedResults: ['RA = RB = 2.500 kip', 'Mmax = 6.250 kip·ft en x = 5.000 ft', 'ΣFy = 0 y ΣM = 0'],
      expectedAssertions: [
        { id: 'hibbeler-ra', label: 'Reacción vertical en A', target: { kind: 'node-result', nodeId: 'A', component: 'ry' }, expected: distributedLoad * length / 2, rtol: 2e-7 },
        { id: 'hibbeler-rb', label: 'Reacción vertical en B', target: { kind: 'node-result', nodeId: 'B', component: 'ry' }, expected: distributedLoad * length / 2, rtol: 2e-7 },
        { id: 'hibbeler-mmax', label: 'Momento flector máximo', target: { kind: 'member-extreme', memberId: 'AB', quantity: 'moment', extreme: 'maximum' }, expected: distributedLoad * length ** 2 / 8, rtol: 2e-7 },
      ],
    },
  };
};

export const createHibbelerStyleDiagramPractice = (): ProjectModel => ({
  ...createDefaultProject(),
  id: createId(),
  name: 'Práctica tipo Hibbeler · diagramas N-V-M',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.01, I: 8e-5, releases: { iMoment: true, jMoment: true } }],
  loadCases: [{ id: 'LC1', name: 'Servicio', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [
    { id: 'W', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -5, qyEnd: -5 },
    { id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 3 / 8, px: 0, py: -20 },
  ],
  educationalCase: {
    kind: 'original-practice',
    sourceTitle: 'Práctica original structureCo basada en la metodología de Hibbeler',
    sourceUrl: HIBBELER_PEARSON_11E,
    chapter: 'Tema equivalente al capítulo 4 · Cargas internas en miembros',
    note: 'Ejercicio original; no reproduce un enunciado ni una figura del libro.',
    expectedResults: ['RA = 32.500 kN', 'RB = 27.500 kN', 'Mmax = 75.000 kN·m en x = 3.000 m'],
    expectedAssertions: [
      { id: 'diagram-ra', label: 'Reacción vertical en A', target: { kind: 'node-result', nodeId: 'A', component: 'ry' }, expected: 32.5 },
      { id: 'diagram-rb', label: 'Reacción vertical en B', target: { kind: 'node-result', nodeId: 'B', component: 'ry' }, expected: 27.5 },
      { id: 'diagram-mmax', label: 'Momento flector máximo', target: { kind: 'member-extreme', memberId: 'AB', quantity: 'moment', extreme: 'maximum' }, expected: 75 },
    ],
  },
});

export const createHibbelerStyleTrussPractice = (): ProjectModel => ({
  ...createDefaultProject(),
  id: createId(),
  name: 'Práctica tipo Hibbeler · armadura triangular',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'C', x: 3, y: 4, support: { type: 'none' } },
  ],
  members: [
    { id: 'AB', i: 'A', j: 'B', type: 'truss', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.003, I: 0 },
    { id: 'AC', i: 'A', j: 'C', type: 'truss', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.003, I: 0 },
    { id: 'BC', i: 'B', j: 'C', type: 'truss', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.003, I: 0 },
  ],
  loadCases: [{ id: 'LC1', name: 'Carga vertical', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [{ id: 'P', nodeId: 'C', caseId: 'LC1', fx: 0, fy: -60, mz: 0 }],
  memberLoads: [],
  educationalCase: {
    kind: 'original-practice',
    sourceTitle: 'Práctica original structureCo basada en la metodología de Hibbeler',
    sourceUrl: HIBBELER_PEARSON_11E,
    chapter: 'Tema equivalente al capítulo 3 · Armaduras estáticamente determinadas',
    note: 'Ejercicio original con geometría 3–4–5; no reproduce un problema del libro.',
    expectedResults: ['RAy = RBy = 30.000 kN', 'FAB = +22.500 kN (tensión)', 'FAC = FBC = −37.500 kN (compresión)'],
    expectedAssertions: [
      { id: 'truss-ra', label: 'Reacción vertical en A', target: { kind: 'node-result', nodeId: 'A', component: 'ry' }, expected: 30 },
      { id: 'truss-rb', label: 'Reacción vertical en B', target: { kind: 'node-result', nodeId: 'B', component: 'ry' }, expected: 30 },
      { id: 'truss-ab', label: 'Fuerza axial máxima en AB', target: { kind: 'member-extreme', memberId: 'AB', quantity: 'axial', extreme: 'maximum' }, expected: 22.5 },
      { id: 'truss-ac', label: 'Fuerza axial mínima en AC', target: { kind: 'member-extreme', memberId: 'AC', quantity: 'axial', extreme: 'minimum' }, expected: -37.5 },
      { id: 'truss-bc', label: 'Fuerza axial mínima en BC', target: { kind: 'member-extreme', memberId: 'BC', quantity: 'axial', extreme: 'minimum' }, expected: -37.5 },
    ],
  },
});

export const exampleProjects: Array<{ name: string; description: string; build: () => ProjectModel }> = [
  {
    name: 'Hibbeler · carga tributaria Fig. 2–11',
    description: 'Ejemplo público Pearson: viga de 10 ft con 500 lb/ft.',
    build: createHibbelerTributaryBeam,
  },
  {
    name: 'Práctica tipo Hibbeler · diagramas',
    description: 'Ejercicio original con carga uniforme y puntual.',
    build: createHibbelerStyleDiagramPractice,
  },
  {
    name: 'Práctica tipo Hibbeler · armadura',
    description: 'Ejercicio original 3–4–5 con tensión y compresión.',
    build: createHibbelerStyleTrussPractice,
  },
  {
    name: 'Pórtico de ejemplo',
    description: 'Pórtico de 6 × 4 m con carga uniforme y cargas puntuales.',
    build: createDefaultProject,
  },
  {
    name: 'Viga simplemente apoyada',
    description: 'Viga de 8 m con carga puntual central.',
    build: () => ({
      ...createDefaultProject(),
      id: createId(),
      name: 'Viga simple · carga central',
      nodes: [
        { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'N2', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      members: [
        { id: 'M1', i: 'N1', j: 'N2', type: 'frame', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.01, I: 8e-5, density: 7850, releases: { iMoment: true, jMoment: true } },
      ],
      nodalLoads: [],
      memberLoads: [
        {
          id: 'ML1', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
          px: 0, py: -40, position: 0.5,
        },
      ],
    }),
  },
  {
    name: 'Armadura triangular',
    description: 'Armadura isostática con barras en tensión y compresión.',
    build: () => ({
      ...createDefaultProject(),
      id: createId(),
      name: 'Armadura triangular',
      nodes: [
        { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'N2', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'N3', x: 3, y: 4, support: { type: 'none' } },
      ],
      members: [
        { id: 'M1', i: 'N1', j: 'N2', type: 'truss', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.003, I: 0 },
        { id: 'M2', i: 'N1', j: 'N3', type: 'truss', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.003, I: 0 },
        { id: 'M3', i: 'N2', j: 'N3', type: 'truss', ...CUSTOM_MEMBER_IDENTITY, E: 200e6, A: 0.003, I: 0 },
      ],
      nodalLoads: [{ id: 'NL1', nodeId: 'N3', caseId: 'LC1', fx: 0, fy: -60, mz: 0 }],
      memberLoads: [],
    }),
  },
];
