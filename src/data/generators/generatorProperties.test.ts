import { describe, expect, it } from 'vitest';
import { findStandardMaterial } from '../standardMaterials';
import { findStandardSection } from '../standardSections';
import { resolveGeneratorMemberProperties } from './generatorProperties';

describe('resolveGeneratorMemberProperties', () => {
  it('reads every catalog number from the catalog itself', () => {
    const material = findStandardMaterial('steel-a992')!;
    const section = findStandardSection('ipe-300')!;

    expect(resolveGeneratorMemberProperties({ kind: 'catalog', materialId: 'steel-a992', sectionId: 'ipe-300' }))
      .toEqual({
        materialId: 'steel-a992',
        materialOrigin: 'catalog',
        sectionId: 'ipe-300',
        sectionOrigin: 'catalog',
        E: material.elasticModulus,
        G: material.shearModulus,
        density: material.density,
        A: section.area,
        I: section.inertiaX,
      });
  });

  it('rejects a material the catalog does not know', () => {
    expect(() => resolveGeneratorMemberProperties({ kind: 'catalog', materialId: 'steel-inventado', sectionId: 'ipe-300' }))
      .toThrow('El material de catálogo steel-inventado no existe.');
  });

  it('rejects a section the catalog does not know', () => {
    expect(() => resolveGeneratorMemberProperties({ kind: 'catalog', materialId: 'steel-a992', sectionId: 'ipe-inventada' }))
      .toThrow('La sección de catálogo ipe-inventada no existe.');
  });

  it('keeps explicit numbers as custom properties without inventing a catalog identity', () => {
    expect(resolveGeneratorMemberProperties({ kind: 'explicit', E: 200e6, A: 0.01, I: 8e-5 }))
      .toEqual({ materialOrigin: 'custom', sectionOrigin: 'custom', E: 200e6, A: 0.01, I: 8e-5 });
  });

  it('carries the optional explicit properties only when they were provided', () => {
    expect(resolveGeneratorMemberProperties({ kind: 'explicit', E: 200e6, A: 0.01, I: 8e-5, G: 76.9e6, density: 7850 }))
      .toEqual({
        materialOrigin: 'custom',
        sectionOrigin: 'custom',
        E: 200e6,
        A: 0.01,
        I: 8e-5,
        G: 76.9e6,
        density: 7850,
      });
  });

  it('rejects a non-positive elastic modulus', () => {
    expect(() => resolveGeneratorMemberProperties({ kind: 'explicit', E: 0, A: 0.01, I: 8e-5 }))
      .toThrow('El módulo de elasticidad E debe ser un número finito mayor que cero.');
  });

  it('rejects a non-finite area', () => {
    expect(() => resolveGeneratorMemberProperties({ kind: 'explicit', E: 200e6, A: Number.POSITIVE_INFINITY, I: 8e-5 }))
      .toThrow('El área A debe ser un número finito mayor que cero.');
  });

  it('rejects a non-positive inertia', () => {
    expect(() => resolveGeneratorMemberProperties({ kind: 'explicit', E: 200e6, A: 0.01, I: -1 }))
      .toThrow('La inercia I debe ser un número finito mayor que cero.');
  });

  it('rejects an invalid optional shear modulus', () => {
    expect(() => resolveGeneratorMemberProperties({ kind: 'explicit', E: 200e6, A: 0.01, I: 8e-5, G: 0 }))
      .toThrow('El módulo de cortante G debe ser un número finito mayor que cero.');
  });

  it('rejects an invalid optional density', () => {
    expect(() => resolveGeneratorMemberProperties({ kind: 'explicit', E: 200e6, A: 0.01, I: 8e-5, density: -1 }))
      .toThrow('La densidad debe ser un número finito mayor que cero.');
  });

  it('rejects an unknown property source', () => {
    expect(() => resolveGeneratorMemberProperties({ kind: 'presunto' } as never))
      .toThrow('El origen de las propiedades del miembro no es válido.');
  });

  it('returns an independent object on every call', () => {
    const request = { kind: 'catalog', materialId: 'steel-a992', sectionId: 'ipe-300' } as const;
    expect(resolveGeneratorMemberProperties(request)).not.toBe(resolveGeneratorMemberProperties(request));
  });
});
