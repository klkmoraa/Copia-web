/**
 * Un solo dueño del `inert` del shell.
 *
 * Había dos, y cada uno creía ser el único. El broker de superficies guardaba
 * el valor anterior de `.app-shell` y lo restauraba al cerrar; `ToolRail`
 * escribía el mismo atributo sin condición para su hoja táctil de K0. Si la
 * hoja del riel estaba abierta cuando el broker montaba su capa, el broker
 * capturaba `previousInert = true` como si ése fuera el estado de reposo y lo
 * volvía a poner al cerrar: el shell entero quedaba inerte, sin ningún modal
 * abierto y sin nada que lo devolviera. La app se quedaba muerta al tacto y al
 * teclado hasta recargar.
 *
 * Guardar-y-restaurar no arregla eso, porque el valor guardado puede ser de
 * otro dueño. Lo que lo arregla es contar: el fondo está inerte mientras
 * ALGUIEN lo reclame, y vuelve a estar vivo cuando lo suelta el último. Cada
 * reclamante recibe una función que suelta su reclamación una sola vez, así que
 * un `release` repetido —un efecto que limpia dos veces— no descuenta de más.
 */

const claims = new Map<HTMLElement, Set<symbol>>();

const apply = (element: HTMLElement): void => {
  const held = claims.get(element);
  if (held && held.size > 0) {
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
    return;
  }
  claims.delete(element);
  element.inert = false;
  element.removeAttribute('aria-hidden');
};

/**
 * Reclama la inercia del fondo. Devuelve la función que la suelta; llamarla más
 * de una vez no hace nada.
 */
export const claimShellInert = (element: HTMLElement | null, label: string): (() => void) => {
  if (!element) return () => {};
  const token = Symbol(label);
  const held = claims.get(element) ?? new Set<symbol>();
  held.add(token);
  claims.set(element, held);
  apply(element);
  return () => {
    const current = claims.get(element);
    if (!current?.delete(token)) return;
    apply(element);
  };
};

/** Cuántas reclamaciones vivas hay. Existe para que las pruebas puedan verlo. */
export const shellInertClaimCount = (element: HTMLElement | null): number => (
  element ? claims.get(element)?.size ?? 0 : 0
);
