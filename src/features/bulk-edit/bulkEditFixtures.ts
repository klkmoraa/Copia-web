import type { MemberModel, NodeModel } from '../../types';

/**
 * Fixtures compartidas por las pruebas de la edición múltiple.
 *
 * Viven fuera de los ficheros de prueba porque la UI aislada todavía no está
 * conectada a `ProjectModel`: los componentes se renderizan y se revisan con
 * estas mismas fixtures, no con un proyecto real.
 */

let memberCounter = 0;
let nodeCounter = 0;

/** Miembro de referencia: pórtico de acero A992 con perfil W12x26 del catálogo. */
export const createBulkMember = (overrides: Partial<MemberModel> = {}): MemberModel => {
  memberCounter += 1;
  return {
    id: `M${memberCounter}`,
    i: 'N1',
    j: 'N2',
    type: 'frame',
    materialId: 'steel-a992',
    materialOrigin: 'catalog',
    sectionId: 'w12x26',
    sectionOrigin: 'catalog',
    E: 200000000,
    A: 0.004935474,
    I: 0.0000849112108224,
    ...overrides,
  };
};

export const createBulkNode = (overrides: Partial<NodeModel> = {}): NodeModel => {
  nodeCounter += 1;
  return {
    id: `N${nodeCounter}`,
    x: 0,
    y: 0,
    support: { type: 'none' },
    ...overrides,
  };
};

/** Reinicia los contadores para que una prueba pueda razonar sobre ids estables. */
export const resetBulkFixtureIds = () => {
  memberCounter = 0;
  nodeCounter = 0;
};
