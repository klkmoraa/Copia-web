/**
 * Panorama del modelo: lo que el panel derecho enseña cuando no hay nada
 * seleccionado.
 *
 * QUE PROBLEMA RESUELVE. El panel ocupa 320 px permanentes y, sin seleccion,
 * gastaba ese sitio en dos tarjetas que dicen lo mismo —«Nada seleccionado» y
 * «Selecciona un objeto para ver sus propiedades»—. Ninguna de las dos informa:
 * la primera repite lo que el usuario ya sabe y la segunda explica un
 * mecanismo que ya conoce en cuanto hace clic una vez.
 *
 * QUE ENSEÑA EN SU LUGAR, Y POR QUE ESO. Solo lo que hoy no enseña nadie mas.
 * El estado del analisis y la fiabilidad viven en la barra superior y no se
 * repiten aqui: duplicarlos seria cometer, en el hueco recien liberado, el
 * mismo defecto que este redisenio esta retirando. Lo que no tiene sitio en
 * ninguna parte del producto es el **censo del modelo** —cuantos nudos, cuantas
 * barras, cuantos apoyos, cuanta carga, y que tamanio ocupa— y el **recuento de
 * hallazgos del Model Doctor**, que hasta ahora solo llegaba como un aviso
 * pasajero que se va solo.
 *
 * POR QUE ES UN MODULO PURO. De datos a datos, sin React y sin DOM, para que el
 * censo se pruebe con `vitest` sin montar el panel. El componente solo lo pinta.
 */
import type { ProjectModel } from '../../types';

export interface ModelCensus {
  nodes: number;
  members: number;
  /** Nudos con apoyo de cualquier tipo; `none` no cuenta. */
  supports: number;
  /** Cargas nodales mas cargas en barra, del proyecto entero. */
  loads: number;
}

export interface ModelExtent {
  /** Anchura del modelo en unidades base (m). */
  width: number;
  /** Altura del modelo en unidades base (m). */
  height: number;
}

export interface LoadCaseSummary {
  active: number;
  total: number;
  /** Nombre de la combinacion elegida, o `null` si se analizan los casos activos. */
  combinationName: string | null;
}

export interface ModelOverview {
  /** Un modelo sin un solo nudo no tiene censo que enseñar: tiene un primer paso. */
  empty: boolean;
  census: ModelCensus;
  /** `null` cuando no hay nudos, o cuando todos caen en el mismo punto. */
  extent: ModelExtent | null;
  loadCases: LoadCaseSummary;
}

const isSupported = (support: ProjectModel['nodes'][number]['support']): boolean => support.type !== 'none';

/**
 * La extension se mide sobre los nudos, que son los unicos que llevan
 * coordenada. Un modelo de un solo nudo —o de varios superpuestos— tiene
 * extension cero, y una cota de 0 × 0 no informa de nada: en ese caso no hay
 * extension que enseñar y se devuelve `null` en vez de un par de ceros.
 */
export const modelExtent = (project: ProjectModel): ModelExtent | null => {
  if (project.nodes.length === 0) return null;
  const xs = project.nodes.map((node) => node.x);
  const ys = project.nodes.map((node) => node.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return width === 0 && height === 0 ? null : { width, height };
};

export const buildModelOverview = (
  project: ProjectModel,
  selectedCombinationId: string,
): ModelOverview => {
  const combination = project.combinations.find((item) => item.id === selectedCombinationId);
  return {
    empty: project.nodes.length === 0,
    census: {
      nodes: project.nodes.length,
      members: project.members.length,
      supports: project.nodes.filter((node) => isSupported(node.support)).length,
      loads: project.nodalLoads.length + project.memberLoads.length,
    },
    extent: modelExtent(project),
    loadCases: {
      active: project.loadCases.filter((loadCase) => loadCase.active).length,
      total: project.loadCases.length,
      combinationName: combination?.name ?? null,
    },
  };
};
