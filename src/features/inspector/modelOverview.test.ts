import { describe, expect, it } from 'vitest';
import { createBlankProject, createDefaultProject } from '../../data/defaultProject';
import { buildModelOverview, modelExtent } from './modelOverview';

describe('censo del modelo', () => {
  it('cuenta nudos, barras, apoyos y cargas del pórtico de ejemplo', () => {
    const overview = buildModelOverview(createDefaultProject(), '');

    expect(overview.empty).toBe(false);
    expect(overview.census.nodes).toBe(4);
    expect(overview.census.members).toBe(3);
    // Dos apoyos articulados; N3 y N4 son libres y NO cuentan.
    expect(overview.census.supports).toBe(2);
    expect(overview.census.loads).toBe(
      createDefaultProject().nodalLoads.length + createDefaultProject().memberLoads.length,
    );
  });

  it('marca vacío un modelo sin un solo nudo', () => {
    const overview = buildModelOverview(createBlankProject(), '');
    expect(overview.empty).toBe(true);
    expect(overview.census).toEqual({ nodes: 0, members: 0, supports: 0, loads: 0 });
    expect(overview.extent).toBeNull();
  });
});

describe('extensión del modelo', () => {
  it('mide la caja de los nudos en unidades base', () => {
    expect(modelExtent(createDefaultProject())).toEqual({ width: 6, height: 4 });
  });

  it('no devuelve extensión cuando no hay nudos', () => {
    expect(modelExtent(createBlankProject())).toBeNull();
  });

  /**
   * Un solo nudo —o varios superpuestos— da una caja de 0 × 0. Enseñar
   * «0 × 0 m» no informa de nada y ocupa un renglón, así que en ese caso no hay
   * extensión que enseñar.
   */
  it('no devuelve extensión cuando todos los nudos caen en el mismo punto', () => {
    const project = createBlankProject();
    project.nodes = [
      { id: 'N1', x: 2, y: 3, support: { type: 'none' } },
      { id: 'N2', x: 2, y: 3, support: { type: 'none' } },
    ];
    expect(modelExtent(project)).toBeNull();
  });

  it('sí devuelve extensión cuando el modelo sólo se extiende en un eje', () => {
    const project = createBlankProject();
    project.nodes = [
      { id: 'N1', x: 0, y: 1, support: { type: 'none' } },
      { id: 'N2', x: 8, y: 1, support: { type: 'none' } },
    ];
    expect(modelExtent(project)).toEqual({ width: 8, height: 0 });
  });
});

describe('resumen de casos y combinación', () => {
  it('cuenta los casos activos sobre el total', () => {
    // El pórtico de ejemplo trae «Carga de servicio» activa y «Peso propio» no.
    expect(buildModelOverview(createDefaultProject(), '').loadCases).toMatchObject({ active: 1, total: 2 });
  });

  it('nombra la combinación elegida, y no inventa una cuando no hay ninguna', () => {
    const project = createDefaultProject();
    expect(buildModelOverview(project, 'COMB1').loadCases.combinationName).toBe('Servicio');
    expect(buildModelOverview(project, '').loadCases.combinationName).toBeNull();
    // Un id que ya no existe se trata como ausencia, no como error.
    expect(buildModelOverview(project, 'COMB-BORRADA').loadCases.combinationName).toBeNull();
  });
});
