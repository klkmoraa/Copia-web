/**
 * Casos canónicos compartidos por pruebas, invariantes, oráculos y capacidad.
 *
 * Todos son voladizos sobre el eje global X con referencia de orientación
 * `[0, 1, 0]`, de modo que la triada local coincide con la global: `fy` flexiona
 * usando `Iz` y `fz` usando `Iy`. Así las soluciones cerradas del manual son
 * comparables sin transformar ejes.
 */
import {
  fixedSpace3DRestraints,
  freeSpace3DRestraints,
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  type Space3DFrameMember,
  type Space3DNodalLoad,
  type Space3DProjectV1,
} from '../model/types';

export interface Space3DCantileverOptions {
  /** Longitud del voladizo, m. */
  readonly L?: number;
  readonly E?: number;
  readonly G?: number;
  readonly A?: number;
  readonly Iy?: number;
  readonly Iz?: number;
  readonly J?: number;
  /** Fuerza aplicada en el extremo libre, kN. */
  readonly P?: number;
  /** Momento torsor aplicado en el extremo libre, kN·m. */
  readonly T?: number;
}

const DEFAULTS = Object.freeze({
  L: 2,
  E: 200_000_000,
  G: 80_000_000,
  A: 0.01,
  Iy: 3e-5,
  Iz: 8e-5,
  J: 2e-5,
  P: 10,
  T: 10,
});

const resolve = (overrides: Space3DCantileverOptions) => ({ ...DEFAULTS, ...overrides });

const cantileverMember = (options: ReturnType<typeof resolve>): Space3DFrameMember => ({
  id: 'M1',
  i: 'I',
  j: 'J',
  E: options.E,
  G: options.G,
  A: options.A,
  Iy: options.Iy,
  Iz: options.Iz,
  J: options.J,
  orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 },
});

const zeroLoad = (components: Partial<Space3DNodalLoad>): Space3DNodalLoad => ({
  id: 'L1', caseId: 'LC1', nodeId: 'J',
  fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0,
  ...components,
});

const cantilever = (
  id: string,
  options: ReturnType<typeof resolve>,
  load: Space3DNodalLoad,
): Space3DProjectV1 => ({
  analysisSpace: SPACE3D_ANALYSIS_SPACE,
  schemaVersion: SPACE3D_SCHEMA_VERSION,
  id,
  name: id,
  units: 'kN-m',
  nodes: [
    { id: 'I', x: 0, y: 0, z: 0, restraints: fixedSpace3DRestraints() },
    { id: 'J', x: options.L, y: 0, z: 0, restraints: freeSpace3DRestraints() },
  ],
  members: [cantileverMember(options)],
  nodalLoads: [load],
  loadCases: [{ id: 'LC1', name: 'LC1' }],
  loadCombinations: [{ id: 'CO1', name: 'CO1', terms: [{ caseId: 'LC1', factor: 1 }] }],
});

/** Barra traccionada: `ux(J) = P·L / (E·A)`. */
export const axialCantilever = (overrides: Space3DCantileverOptions = {}): Space3DProjectV1 => {
  const options = resolve(overrides);
  return cantilever('space3d-axial', options, zeroLoad({ fx: options.P }));
};

/** Barra torsionada: `rx(J) = T·L / (G·J)`. */
export const torsionCantilever = (overrides: Space3DCantileverOptions = {}): Space3DProjectV1 => {
  const options = resolve(overrides);
  return cantilever('space3d-torsion', options, zeroLoad({ mx: options.T }));
};

/**
 * Voladizo a flexión. `axis: 'y'` carga `fy` y trabaja con `Iz`; `axis: 'z'`
 * carga `fz` y trabaja con `Iy`.
 */
export const bendingCantilever = (
  overrides: Space3DCantileverOptions & { readonly axis?: 'y' | 'z' } = {},
): Space3DProjectV1 => {
  const options = resolve(overrides);
  const axis = overrides.axis ?? 'y';
  return cantilever(
    `space3d-bending-${axis}`,
    options,
    zeroLoad(axis === 'y' ? { fy: options.P } : { fz: options.P }),
  );
};

/** Miembro sin ninguna restricción: mecanismo con seis modos de sólido rígido. */
export const freeFloatingMember = (overrides: Space3DCantileverOptions = {}): Space3DProjectV1 => {
  const options = resolve(overrides);
  const project = cantilever('space3d-free', options, zeroLoad({ fy: options.P }));
  return {
    ...project,
    nodes: project.nodes.map((node) => ({ ...node, restraints: freeSpace3DRestraints() })),
  };
};
