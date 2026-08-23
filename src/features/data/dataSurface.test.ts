import { describe, expect, it } from 'vitest';
import type { ResultTab } from '../../store/WorkspaceUIContext';
import {
  DATA_SURFACE_TABS,
  RESULT_FAMILIES,
  RESULT_TABS_IN_ORDER,
  RESULT_TAB_LABEL_KEY,
  dataTabForRequest,
  resolveResultTab,
} from './dataSurface';

describe('las tres pestañas de «Datos»', () => {
  it('declara exactamente Resultados · Tabla · Revisión', () => {
    expect(DATA_SURFACE_TABS).toEqual(['results', 'table', 'review']);
  });

  /**
   * Los cuatro comandos que había —uno por superficie densa— son ahora uno con
   * la pestaña como carga útil. Este mapa es el que hace que ningún llamante
   * tenga que saber en qué pestaña cayó su destino.
   */
  it('lleva cada petición antigua a su pestaña', () => {
    expect(dataTabForRequest('results')).toBe('results');
    expect(dataTabForRequest('datasheet')).toBe('table');
    expect(dataTabForRequest('doctor')).toBe('review');
  });
});

describe('las lecturas de resultado son UNA sola tira', () => {
  /**
   * El defecto que esto cierra: `ResultsPanel` se quedaba con Resumen, N·V·M y
   * Deformada, y `DenseResultsSurface` con Reacciones, Influencia y «Entender».
   * Los dos leían el mismo campo `resultTab`, cuyo tipo contenía las nueve
   * desde el principio. El corte no estaba en el dominio.
   */
  it('reúne las ocho lecturas elegibles sin repetir ninguna', () => {
    expect(RESULT_TABS_IN_ORDER).toEqual([
      'summary', 'reactions', 'axial', 'shear', 'moment', 'deformed', 'influence', 'learn',
    ]);
    expect(new Set(RESULT_TABS_IN_ORDER).size).toBe(RESULT_TABS_IN_ORDER.length);
  });

  it('da rótulo a todas y a ninguna de más', () => {
    for (const tab of RESULT_TABS_IN_ORDER) {
      expect(RESULT_TAB_LABEL_KEY[tab as Exclude<ResultTab, 'issues'>]).toBeTruthy();
    }
    expect(Object.keys(RESULT_TAB_LABEL_KEY).sort()).toEqual([...RESULT_TABS_IN_ORDER].sort());
  });

  it('agrupa por lo que responde cada lectura, sin familias vacías ni solapadas', () => {
    expect(RESULT_FAMILIES.map((family) => family.id)).toEqual(['state', 'forces', 'shape', 'study']);
    for (const family of RESULT_FAMILIES) expect(family.tabs.length).toBeGreaterThan(0);
    // Reacciones va con Resumen porque describen el modelo entero, no un
    // miembro; Influencia y «Aprender» forman familia propia porque no son una
    // lectura del análisis, son herramientas de estudio sobre él.
    expect(RESULT_FAMILIES.find((family) => family.id === 'state')?.tabs).toEqual(['summary', 'reactions']);
    expect(RESULT_FAMILIES.find((family) => family.id === 'study')?.tabs).toEqual(['influence', 'learn']);
  });

  /**
   * `issues` no es una lectura que el usuario elija: la escribe `analyze()`
   * cuando el análisis falla. No puede tener pestaña, y pedirla tiene que caer
   * a algo que exista en vez de dejar la superficie en blanco.
   */
  it('resuelve a Resumen cualquier lectura que no esté en la tira', () => {
    expect(RESULT_TABS_IN_ORDER).not.toContain('issues');
    expect(resolveResultTab('issues')).toBe('summary');
    expect(resolveResultTab('influence')).toBe('influence');
    expect(resolveResultTab('moment')).toBe('moment');
  });
});
