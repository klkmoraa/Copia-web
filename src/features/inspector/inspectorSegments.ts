/**
 * Los tres segmentos del panel derecho.
 *
 * Hasta aqui eran tres superficies del broker —`detail`, `analysisSetup` y
 * `view`— que montaban tres copias del mismo componente y apagaban su tablist
 * con `forcedTab`. El marcado del tablist llevaba escrito desde el principio lo
 * que de verdad son: tres segmentos de un panel.
 *
 * Viven en su propio modulo, y no dentro de `Inspector.tsx`, porque los lee
 * gente que no monta el panel: el bus de comandos del workspace tipa con ellos
 * la carga util de `open-detail`.
 */
export const INSPECTOR_SEGMENTS = ['detail', 'loads', 'view'] as const;

export type InspectorSegment = (typeof INSPECTOR_SEGMENTS)[number];

/** Rotulo i18n de cada segmento. Un segmento, una clave, un sitio. */
export const INSPECTOR_SEGMENT_LABEL_KEY = {
  detail: 'inspector.tab',
  loads: 'inspector.loadsTab',
  view: 'inspector.viewTab',
} as const;
