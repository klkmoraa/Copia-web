/**
 * Forma de un modo propio, interpolada por barra.
 *
 * Un modo **no** se dibuja como la deformada. `CanvasResultLayer` pinta la
 * deformada a partir de `result.deformation`, que son puntos que el solver
 * produce a lo largo de cada miembro; un modo de pandeo o de vibración sólo
 * tiene tres números por nudo —`ux`, `uy`, `rz`—. Unir nudos con rectas daría un
 * dibujo que miente sobre la curvatura, que es justo lo que distingue un primer
 * modo de un segundo.
 *
 * Así que se interpola con las **mismas funciones de forma cúbicas del elemento
 * de viga**: las que el propio solver usa para que la flecha entre nudos sea la
 * de una viga y no la de un cable. El desplazamiento axial se interpola lineal,
 * que es lo que corresponde a su formulación.
 *
 * No reutiliza `evaluateDeformationAt` a propósito: aquella consume salida del
 * solver, ésta consume grados de libertad nodales. Son entradas distintas al
 * mismo dibujo.
 */

export interface ModeShapeDof {
  ux: number;
  uy: number;
  rz: number;
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Funciones de forma de Hermite del elemento de viga, en coordenada normalizada.
 *
 * `N2` y `N4` van multiplicadas por la longitud porque su grado de libertad es
 * un giro: sin la longitud, un modo de una barra de 6 m y otro de una de 0.5 m
 * se dibujarían con la misma flecha para el mismo giro.
 */
export const hermiteShapeFunctions = (t: number) => ({
  N1: 1 - 3 * t * t + 2 * t * t * t,
  N2: t - 2 * t * t + t * t * t,
  N3: 3 * t * t - 2 * t * t * t,
  N4: -t * t + t * t * t,
});

export interface ModeShapeSample {
  /** Muestras por barra, contando los dos extremos. Mínimo 2. */
  samples?: number;
  /** Cuánto se amplifica el modo, que es adimensional. En unidades de modelo. */
  scale?: number;
}

/**
 * Puntos de la barra deformada según el modo, en coordenadas de modelo.
 *
 * Devuelve `samples` puntos entre los dos nudos, incluidos ambos. Con `scale`
 * en cero devuelve la barra sin deformar, que es la respuesta correcta y no un
 * caso a evitar.
 */
export const modeShapePoints = (
  start: Point2D,
  end: Point2D,
  startDof: ModeShapeDof,
  endDof: ModeShapeDof,
  options: ModeShapeSample = {},
): Point2D[] => {
  const samples = Math.max(2, Math.trunc(options.samples ?? 13));
  const scale = options.scale ?? 1;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return [start, end];
  const c = dx / length;
  const s = dy / length;

  // A ejes locales: `u` a lo largo de la barra, `v` perpendicular.
  const ui = c * startDof.ux + s * startDof.uy;
  const vi = -s * startDof.ux + c * startDof.uy;
  const uj = c * endDof.ux + s * endDof.uy;
  const vj = -s * endDof.ux + c * endDof.uy;

  const points: Point2D[] = [];
  for (let index = 0; index < samples; index += 1) {
    const t = index / (samples - 1);
    const { N1, N2, N3, N4 } = hermiteShapeFunctions(t);
    const u = (1 - t) * ui + t * uj;
    const v = N1 * vi + N2 * length * startDof.rz + N3 * vj + N4 * length * endDof.rz;
    points.push({
      x: start.x + t * dx + scale * (c * u - s * v),
      y: start.y + t * dy + scale * (s * u + c * v),
    });
  }
  return points;
};

/**
 * Cuánto amplificar un modo para que se vea.
 *
 * Un modo viene normalizado a traslación máxima unidad, así que es adimensional
 * y `deformedScale` —que amplifica metros— no le sirve. La amplitud se saca del
 * **tamaño del modelo**: una fracción de su diagonal. Así un pórtico de 6 m y
 * un puente de 60 se dibujan igual de legibles, y el zoom no cambia la forma.
 */
export const modeShapeScaleFor = (bounds: { minX: number; minY: number; maxX: number; maxY: number }): number => {
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  // 8 %: suficiente para ver la curvatura sin que el modo se solape consigo
  // mismo en una estructura de varios vanos.
  return diagonal > 0 ? diagonal * 0.08 : 1;
};
