// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  INSPECTOR_EXPANDED_STORAGE_KEY,
  readExpandedSections,
  writeExpandedSections,
} from './inspectorPreferences';

beforeEach(() => localStorage.clear());

describe('preferencias de secciones desplegadas del Inspector', () => {
  it('lee solo lo suyo y no toca los ids ajenos al escribir', () => {
    localStorage.setItem(INSPECTOR_EXPANDED_STORAGE_KEY, JSON.stringify([
      'advanced-member', 'analysis-load-cases', 'view-layers', 'future-plugin-section',
    ]));

    expect(readExpandedSections()).toEqual(['advanced-member']);

    writeExpandedSections(['advanced-node']);
    // Los tres ids ajenos siguen ahi: dos de un reparto por superficie que ya
    // no existe y uno de nadie conocido. Borrarlos al escribir seria decidir
    // por una version o una extension que este modulo no conoce.
    expect(JSON.parse(localStorage.getItem(INSPECTOR_EXPANDED_STORAGE_KEY) ?? '[]')).toEqual([
      'analysis-load-cases', 'view-layers', 'future-plugin-section', 'advanced-node',
    ]);
  });

  it('persiste el constructor de secciones, que no es una seccion avanzada pero si es suya', () => {
    writeExpandedSections(['section-builder']);
    expect(readExpandedSections()).toEqual(['section-builder']);
  });

  it('ignora un almacen malformado sin sobrescribirlo durante una lectura', () => {
    localStorage.setItem(INSPECTOR_EXPANDED_STORAGE_KEY, '{not json');
    expect(readExpandedSections()).toEqual([]);
    expect(localStorage.getItem(INSPECTOR_EXPANDED_STORAGE_KEY)).toBe('{not json');
  });
});
