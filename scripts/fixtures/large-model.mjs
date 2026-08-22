#!/usr/bin/env node
/**
 * CRI-93 · Modelo grande determinista para la medición de rendimiento.
 *
 * QUÉ ES: un `ProjectModel` de ~2000 entidades generado por función pura, sin
 * dependencias del producto, para poder inyectarlo en `localStorage` desde un
 * script de Node y medir el Datasheet y la Command Palette REALES sobre él.
 *
 * POR QUÉ ASÍ: el repositorio no tiene ningún fixture grande versionado
 * (`grande.structureco` / `enorme.structureco` son nombres citados en CRI-93,
 * no archivos existentes en `main`), y los generadores de `src/data/generators`
 * son TypeScript y viven bajo ruta protegida. Generarlo aquí, en JavaScript
 * puro y determinista, deja la medición reproducible sin tocar producto.
 *
 * LO QUE NO ES: no es una versión simplificada del producto. Es sólo el dato de
 * entrada; todo lo que se mide después es la aplicación construida tal cual.
 *
 * La malla por defecto (23x29) se elige para que la tabla mayor del Datasheet
 * —miembros, 1282 filas— quede al lado de las 1292 filas del dato EXPERIMENTAL
 * de CRI-11 y la comparación sea directa.
 */

/** Esquema vigente en `src/data/defaultProject.ts` al medir (CURRENT_SCHEMA_VERSION). */
export const SCHEMA_VERSION = 6;

export const DEFAULT_GRID = { columns: 23, rows: 29, dx: 2, dy: 1.5 };

/** Cargas puntuales y repartidas sembradas: pocas y deterministas, sólo para poblar la pestaña de cargas. */
const NODAL_LOAD_COUNT = 40;
const MEMBER_LOAD_COUNT = 20;

const nodeId = (column, row) => `N${column * 1000 + row}`;

/**
 * Malla rectangular de pórticos: nudos en rejilla, barras horizontales y
 * verticales, apoyos en la fila base y dos casos de carga con una combinación.
 */
export const createLargeProject = (grid = DEFAULT_GRID) => {
  const { columns, rows, dx, dy } = { ...DEFAULT_GRID, ...grid };
  if (!Number.isInteger(columns) || columns < 2) throw new Error('columns debe ser un entero >= 2');
  if (!Number.isInteger(rows) || rows < 2) throw new Error('rows debe ser un entero >= 2');

  const nodes = [];
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      nodes.push({
        id: nodeId(column, row),
        x: Number((column * dx).toFixed(3)),
        y: Number((row * dy).toFixed(3)),
        // La fila base va empotrada o articulada alternando, para que la faceta
        // de apoyo del Datasheet tenga más de un valor y filtre de verdad.
        support: row === 0
          ? { type: column % 2 === 0 ? 'pin' : 'fixed' }
          : { type: 'none' },
      });
    }
  }

  const members = [];
  const pushMember = (i, j, index) => {
    members.push({
      id: `M${index}`,
      i,
      j,
      // Alternar frame/truss puebla la faceta de tipo sin inventar propiedades.
      type: index % 7 === 0 ? 'truss' : 'frame',
      materialOrigin: 'custom',
      sectionOrigin: 'custom',
      E: 200e6,
      A: 0.005,
      I: 8.333e-6,
      density: 7850,
    });
  };
  let index = 1;
  for (let column = 0; column < columns - 1; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      pushMember(nodeId(column, row), nodeId(column + 1, row), index);
      index += 1;
    }
  }
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows - 1; row += 1) {
      pushMember(nodeId(column, row), nodeId(column, row + 1), index);
      index += 1;
    }
  }

  const loadCases = [
    { id: 'LC1', name: 'Permanente', category: 'permanent', active: true, selfWeightFactor: 0 },
    { id: 'LC2', name: 'Variable', category: 'variable', active: true, selfWeightFactor: 0 },
  ];
  const combinations = [
    { id: 'CO1', name: 'ELU', factors: { LC1: 1.35, LC2: 1.5 } },
  ];

  const nodalLoads = [];
  const loadableNodes = nodes.filter((node) => node.y > 0);
  const nodalStride = Math.max(1, Math.floor(loadableNodes.length / NODAL_LOAD_COUNT));
  for (let i = 0; i < NODAL_LOAD_COUNT; i += 1) {
    const node = loadableNodes[(i * nodalStride) % loadableNodes.length];
    nodalLoads.push({
      id: `NL${i + 1}`,
      nodeId: node.id,
      caseId: i % 2 === 0 ? 'LC1' : 'LC2',
      fx: i % 3 === 0 ? 4 : 0,
      fy: -10 - (i % 5),
      mz: 0,
    });
  }

  const memberLoads = [];
  const memberStride = Math.max(1, Math.floor(members.length / MEMBER_LOAD_COUNT));
  for (let i = 0; i < MEMBER_LOAD_COUNT; i += 1) {
    const member = members[(i * memberStride) % members.length];
    memberLoads.push({
      id: `ML${i + 1}`,
      memberId: member.id,
      caseId: i % 2 === 0 ? 'LC1' : 'LC2',
      type: 'distributed',
      coordinateSystem: 'global',
      lengthBasis: 'real',
      start: 0,
      end: 1,
      qyStart: -8 - (i % 4),
      qyEnd: -8 - (i % 4),
    });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'cri-93-large-model',
    name: `Modelo grande CRI-93 (${columns}x${rows})`,
    nodes,
    members,
    loadCases,
    combinations,
    nodalLoads,
    prescribedDisplacements: [],
    memberLoads,
    memberInitialEffects: [],
    settings: {
      units: 'kN-m',
      language: 'es',
      gridSize: 1,
      snap: true,
      showGrid: true,
      showNodeLabels: false,
      showMemberLabels: false,
      showLocalAxes: false,
      showLoads: true,
      showDimensions: false,
      showResultValues: false,
      diagramScale: 1,
      deformedScale: 80,
      diagramSide: 'positive',
    },
  };
};

/**
 * Cuenta de entidades declarada en el informe: todo lo que el usuario ve como
 * un objeto del modelo. No incluye `settings`, que no es una entidad.
 */
export const countEntities = (project) => ({
  nodes: project.nodes.length,
  members: project.members.length,
  nodalLoads: project.nodalLoads.length,
  memberLoads: project.memberLoads.length,
  loadCases: project.loadCases.length,
  combinations: project.combinations.length,
  total: project.nodes.length
    + project.members.length
    + project.nodalLoads.length
    + project.memberLoads.length
    + project.loadCases.length
    + project.combinations.length,
});

/** Filas que cada pestaña del Datasheet enseña para este proyecto. */
export const datasheetRowCounts = (project) => ({
  nodes: project.nodes.length,
  members: project.members.length,
  loads: project.nodalLoads.length + project.memberLoads.length,
});
