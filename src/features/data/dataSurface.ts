/**
 * Contrato de la superficie «Datos».
 *
 * QUE UNIFICA. Hasta aqui el producto tenia CUATRO superficies densas —el dock
 * inferior de Resultados, la superficie invocada `dense`, la Hoja de datos y el
 * Model Doctor— con cuatro cromos, cuatro lanzadores y ninguna relacion entre
 * si. El broker ya las obligaba a ser mutuamente excluyentes
 * (`validateSurfaceCombination`: «drawer y fullscreen son mutuamente
 * exclusivos»), asi que en pantalla nunca hubo mas de una. Fundirlas no cambia
 * lo que el usuario puede tener abierto: formaliza una restriccion que el
 * resolutor ya imponia, y de paso deja un solo cromo y un solo lanzador.
 *
 * EL CASO MAS CLARO ERA RESULTADOS. Vivia partido en dos componentes:
 * `ResultsPanel` (Resumen · N·V·M · Deformada) y `DenseResultsSurface`
 * (Reacciones · Influencia · Entender). Los dos leian **el mismo campo**,
 * `resultTab`, cuyo tipo `ResultTab` ya contenia las nueve lecturas desde el
 * principio. El corte no estaba en el dominio: estaba en dos componentes que
 * decidieron cada uno cuales de esos valores eran suyos.
 *
 * POR QUE ES UN MODULO PURO. De datos a datos: las pestañas y las familias se
 * prueban sin montar la superficie.
 */
import type { ResultTab } from '../../store/WorkspaceUIContext';
import type { TranslationKey } from '../../i18n/catalogs';

export const DATA_SURFACE_TABS = ['results', 'table', 'review'] as const;

export type DataSurfaceTab = (typeof DATA_SURFACE_TABS)[number];

export const DATA_SURFACE_TAB_LABEL_KEY: Readonly<Record<DataSurfaceTab, TranslationKey>> = {
  results: 'results.outputs',
  table: 'data.tabTable',
  review: 'data.tabReview',
};

export interface ResultFamily {
  id: string;
  labelKey: TranslationKey;
  tabs: readonly ResultTab[];
}

/**
 * Las lecturas de resultado, agrupadas por lo que responden.
 *
 * Reacciones sube con Resumen porque las dos describen el modelo entero, no un
 * miembro; Influencia y «Entender» forman una familia propia porque no son una
 * lectura del analisis en curso, son herramientas de estudio sobre el.
 *
 * `issues` no aparece: no es una lectura que el usuario elija, la pone
 * `analyze()` cuando el analisis falla, y el cuerpo la resuelve cayendo a la
 * primera pestaña.
 */
export const RESULT_FAMILIES: readonly ResultFamily[] = [
  { id: 'state', labelKey: 'results.familyState', tabs: ['summary', 'reactions'] },
  { id: 'forces', labelKey: 'results.familyForces', tabs: ['axial', 'shear', 'moment'] },
  { id: 'shape', labelKey: 'results.familyShape', tabs: ['deformed'] },
  { id: 'study', labelKey: 'results.familyStudy', tabs: ['influence', 'learn'] },
];

/** Las pestañas de resultado en su orden de lectura, aplanadas. */
export const RESULT_TABS_IN_ORDER: readonly ResultTab[] = RESULT_FAMILIES.flatMap((family) => family.tabs);

export const RESULT_TAB_LABEL_KEY: Readonly<Record<Exclude<ResultTab, 'issues'>, TranslationKey>> = {
  summary: 'results.summary',
  reactions: 'results.reactions',
  axial: 'results.axial',
  shear: 'results.shear',
  moment: 'results.moment',
  deformed: 'results.deformed',
  influence: 'results.influence',
  learn: 'results.learn',
};

/** Codificacion tecnica del lienzo (§3 de `tokens.css`): N, V y M la conservan. */
export const RESULT_TAB_COLOR: Partial<Record<ResultTab, string>> = {
  axial: 'axial',
  shear: 'shear',
  moment: 'moment',
};

/**
 * La lectura efectiva. `issues` —y cualquier valor que deje de estar en la
 * tira— cae a la primera, que es Resumen.
 */
export const resolveResultTab = (tab: ResultTab): Exclude<ResultTab, 'issues'> => (
  RESULT_TABS_IN_ORDER.includes(tab) ? tab as Exclude<ResultTab, 'issues'> : 'summary'
);

/** En que pestaña de la superficie vive cada cosa que se puede pedir. */
export const dataTabForRequest = (request: 'results' | 'datasheet' | 'doctor'): DataSurfaceTab => (
  request === 'datasheet' ? 'table' : request === 'doctor' ? 'review' : 'results'
);
