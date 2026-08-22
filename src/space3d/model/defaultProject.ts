/**
 * Proyectos iniciales de Space 3D.
 *
 * Las fábricas devuelven estructuras nuevas en cada llamada: el historial de
 * comandos y el `undo/redo` comparan snapshots por identidad, así que dos
 * proyectos recién creados nunca deben compartir arrays.
 */
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  fixedSpace3DRestraints,
  freeSpace3DRestraints,
  type Space3DFrameMember,
  type Space3DNode,
  type Space3DNodalLoad,
  type Space3DProjectV1,
} from './types';

/** Acero estructural en unidades internas kN-m. */
const STEEL = Object.freeze({
  E: 200_000_000,
  G: 77_000_000,
  A: 0.0076,
  Iy: 4.5e-5,
  Iz: 1.36e-4,
  J: 4.0e-7,
});

const defaultOrientation = () => ({
  localYReferenceGlobal: [0, 1, 0] as const,
  rollRadians: 0,
});

const node = (
  id: string,
  x: number,
  y: number,
  z: number,
  restraints = freeSpace3DRestraints(),
): Space3DNode => ({ id, x, y, z, restraints });

const member = (id: string, i: string, j: string): Space3DFrameMember => ({
  id,
  i,
  j,
  E: STEEL.E,
  G: STEEL.G,
  A: STEEL.A,
  Iy: STEEL.Iy,
  Iz: STEEL.Iz,
  J: STEEL.J,
  orientation: defaultOrientation(),
});

const load = (
  id: string,
  nodeId: string,
  components: Partial<Omit<Space3DNodalLoad, 'id' | 'nodeId' | 'caseId'>>,
): Space3DNodalLoad => ({
  id,
  caseId: 'LC1',
  nodeId,
  fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0,
  ...components,
});

export const createBlankSpace3DProject = (): Space3DProjectV1 => ({
  analysisSpace: SPACE3D_ANALYSIS_SPACE,
  schemaVersion: SPACE3D_SCHEMA_VERSION,
  id: 'space3d-project',
  name: 'Space 3D',
  units: 'kN-m',
  nodes: [],
  members: [],
  nodalLoads: [],
  loadCases: [{ id: 'LC1', name: 'LC1' }],
  loadCombinations: [],
});

/**
 * Marco espacial verificable: tres patas empotradas en el plano de suelo
 * `y = 0` que convergen en un vértice libre elevado y desplazado en Z. Los
 * cuatro nudos no son coplanares, así que la solución ejercita los seis GDL y
 * la carga `fz` actúa fuera del plano que forman dos patas cualesquiera.
 */
export const createSpace3DPortalExample = (): Space3DProjectV1 => ({
  analysisSpace: SPACE3D_ANALYSIS_SPACE,
  schemaVersion: SPACE3D_SCHEMA_VERSION,
  id: 'space3d-portal',
  name: 'Pórtico espacial',
  units: 'kN-m',
  nodes: [
    node('N1', 0, 0, 0, fixedSpace3DRestraints()),
    node('N2', 5, 0, 0, fixedSpace3DRestraints()),
    node('N3', 0, 0, 4, fixedSpace3DRestraints()),
    node('N4', 2.5, 3.2, 2),
  ],
  members: [
    member('M1', 'N1', 'N4'),
    member('M2', 'N2', 'N4'),
    member('M3', 'N3', 'N4'),
  ],
  nodalLoads: [load('L1', 'N4', { fy: -40, fz: -15 })],
  loadCases: [{ id: 'LC1', name: 'LC1' }],
  loadCombinations: [{ id: 'CO1', name: 'CO1', terms: [{ caseId: 'LC1', factor: 1 }] }],
});
