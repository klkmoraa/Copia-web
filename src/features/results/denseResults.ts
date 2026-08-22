/**
 * Contrato de la superficie `dense` de Results (CRI-101).
 *
 * `dense` es **invocada, nunca residente**: reacciones, influencia y
 * «Entender» dejan de ocupar el panel y se piden cuando hacen falta. Este
 * módulo es deliberadamente diminuto —un tipo y dos precargas— para que el
 * lanzador pueda anunciarla sin arrastrar el chunk que la dibuja.
 */
export const DENSE_RESULT_VIEWS = ['reactions', 'influence', 'learn'] as const;

export type DenseResultView = (typeof DENSE_RESULT_VIEWS)[number];

/**
 * La línea de influencia sigue siendo `lazy` y sigue precargándose por
 * hover/foco (CRI-101 conserva el comportamiento de la pestaña anterior): al
 * pasar de pestaña residente a superficie invocada, perder la precarga sería
 * cambiar latencia por arquitectura.
 */
export const preloadInfluenceLineView = () => import('./InfluenceLineView')
  .then((module) => ({ default: module.InfluenceLineView }));

/** Precarga el chunk de la propia superficie invocada, no sólo su contenido. */
export const preloadDenseResultsSurface = () => import('./DenseResultsSurface')
  .then((module) => ({ default: module.DenseResultsSurface }));
