import type { MemberModel } from '../../types';
import { findStandardMaterial } from '../standardMaterials';
import { findStandardSection } from '../standardSections';

/**
 * Origen de las propiedades de los miembros generados.
 *
 * El generador nunca inventa material ni sección: o el usuario elige una
 * identidad de catálogo —y entonces los números salen del catálogo, igual que en
 * la edición múltiple— o entrega números explícitos que quedan marcados como
 * `custom`. No hay una tercera vía ni un valor por defecto silencioso.
 */
export type GeneratorMemberProperties =
  | { readonly kind: 'catalog'; readonly materialId: string; readonly sectionId: string }
  | {
    readonly kind: 'explicit';
    readonly E: number;
    readonly A: number;
    readonly I: number;
    readonly G?: number;
    readonly density?: number;
  };

/** Propiedades listas para copiarse a un `MemberModel`, sin identidad ni topología. */
export type ResolvedGeneratorMemberProperties =
  Pick<MemberModel, 'materialOrigin' | 'sectionOrigin' | 'E' | 'A' | 'I'>
  & Partial<Pick<MemberModel, 'materialId' | 'sectionId' | 'G' | 'density'>>;

const assertPositive = (value: number, message: string): void => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(message);
};

export const resolveGeneratorMemberProperties = (
  properties: GeneratorMemberProperties,
): ResolvedGeneratorMemberProperties => {
  if (properties.kind === 'catalog') {
    const material = findStandardMaterial(properties.materialId);
    if (!material) throw new Error(`El material de catálogo ${properties.materialId} no existe.`);
    const section = findStandardSection(properties.sectionId);
    if (!section) throw new Error(`La sección de catálogo ${properties.sectionId} no existe.`);
    return {
      materialId: material.id,
      materialOrigin: 'catalog',
      sectionId: section.id,
      sectionOrigin: 'catalog',
      E: material.elasticModulus,
      G: material.shearModulus,
      density: material.density,
      A: section.area,
      I: section.inertiaX,
    };
  }

  if (properties.kind === 'explicit') {
    assertPositive(properties.E, 'El módulo de elasticidad E debe ser un número finito mayor que cero.');
    assertPositive(properties.A, 'El área A debe ser un número finito mayor que cero.');
    assertPositive(properties.I, 'La inercia I debe ser un número finito mayor que cero.');
    if (properties.G !== undefined) {
      assertPositive(properties.G, 'El módulo de cortante G debe ser un número finito mayor que cero.');
    }
    if (properties.density !== undefined) {
      assertPositive(properties.density, 'La densidad debe ser un número finito mayor que cero.');
    }
    return {
      materialOrigin: 'custom',
      sectionOrigin: 'custom',
      E: properties.E,
      A: properties.A,
      I: properties.I,
      ...(properties.G === undefined ? {} : { G: properties.G }),
      ...(properties.density === undefined ? {} : { density: properties.density }),
    };
  }

  throw new Error('El origen de las propiedades del miembro no es válido.');
};
