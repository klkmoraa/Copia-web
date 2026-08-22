import type { ProjectModel } from '../../types';

/**
 * Proyecto de referencia del datasheet: un pórtico de tres nudos con un apoyo
 * de cada familia relevante, una barra de catálogo y otra personalizada, y una
 * carga de cada clase. Es el mínimo que cubre todas las columnas y todas las
 * tarjetas del panel contextual sin volverse ilegible en una prueba.
 */
export const createDatasheetProject = (overrides: Partial<ProjectModel> = {}): ProjectModel => ({
  schemaVersion: 1,
  id: 'datasheet-fixture',
  name: 'Pórtico de prueba',
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'N2', x: 0, y: 4, support: { type: 'none' }, internalHinge: true },
    { id: 'N3', x: 6, y: 4, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [
    {
      id: 'M1', i: 'N1', j: 'N2', type: 'frame',
      materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'w12x26', sectionOrigin: 'catalog',
      E: 200000000, A: 0.004935474, I: 0.0000849112108224,
    },
    {
      id: 'M2', i: 'N2', j: 'N3', type: 'truss',
      materialOrigin: 'custom', sectionOrigin: 'custom',
      E: 21000000, A: 0.03, I: 0.0002,
      releases: { iMoment: true },
    },
  ],
  loadCases: [
    { id: 'LC1', name: 'Permanente', category: 'permanent', active: true },
    { id: 'LC2', name: 'Variable', category: 'variable', active: false },
  ],
  combinations: [
    { id: 'CO1', name: 'ELU', factors: { LC1: 1.35, LC2: 1.5 } },
  ],
  nodalLoads: [
    { id: 'NL1', nodeId: 'N3', caseId: 'LC1', fx: 10, fy: -5, mz: 0 },
  ],
  memberLoads: [
    {
      id: 'ML1', memberId: 'M2', caseId: 'LC1', type: 'distributed',
      coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
      qyStart: -12, qyEnd: -12,
    },
  ],
  settings: {
    units: 'kN-m',
    language: 'es',
    gridSize: 1,
    snap: true,
    showGrid: true,
    showNodeLabels: true,
    showMemberLabels: true,
    showLocalAxes: false,
    showLoads: true,
    showDimensions: false,
    showResultValues: false,
    diagramScale: 1,
    deformedScale: 1,
    diagramSide: 'positive',
  },
  ...overrides,
});
