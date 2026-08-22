/**
 * CRI-89 · Resolutor de composición del shell adaptativo.
 *
 * QUÉ ES: la ÚNICA fuente de la clase de composición `X2` | `M1` | `K0`. Es una
 * función pura de datos a datos — sin React, sin DOM, sin `matchMedia` — para
 * que sus fronteras y su histéresis se prueben con `vitest` sin navegador.
 *
 * POR QUÉ ES CREÍBLE: las constantes de chrome y las reglas CB-1..CB-6 son un
 * port literal de `reports/evidence/2026-08-15-cri-9-adaptive-architecture/
 * canvas-budget-model.mjs`, cuyo modelo reproduce las once mediciones reales de
 * CRI-7 §2 con un error máximo de 0.24 puntos porcentuales. La frontera
 * Expanded↔Medium NO está escrita en ninguna parte: sale de CB, y este módulo
 * la recalcula (1042–1130 px según altura, ver `expandedBoundaryWidth`).
 *
 * CONTRATOS QUE SOSTIENE:
 * - **T-INV-4**: el resolutor lee el viewport de layout (`innerWidth`/
 *   `innerHeight`), nunca `visualViewport`. El teclado virtual encoge
 *   `visualViewport` y NO puede cambiar la clase.
 * - **T-INV-5**: histéresis en las fronteras (`SHELL_HYSTERESIS_BAND_PX`) y
 *   commit sólo sobre tamaño estable (el commit temporal lo hace el proveedor).
 * - **R-3**: ninguna superficie pide su composición; sólo se lee de aquí.
 */

export type ShellClass = 'X2' | 'M1' | 'K0';

export interface ShellViewport {
  width: number;
  height: number;
}

/**
 * Lo único que el shell publica y que las superficies pueden leer.
 *
 * `phone` no es una segunda clase: es el sub-umbral de Compact que styles.css
 * ya expresa con `@media (max-width:700px)` y del que dependen ResultsPanel y
 * Model Doctor. Vive aquí para que no vuelva a haber un `matchMedia` suelto;
 * fuera de `K0` siempre es `false`.
 */
export interface ShellComposition {
  shellClass: ShellClass;
  phone: boolean;
}

// ---------------------------------------------------------------------------
// 1. Constantes de chrome — despejadas de las mediciones de CRI-7 §2
// ---------------------------------------------------------------------------

/** Ver `canvas-budget-model.mjs` §1: cada número trae su despeje documentado. */
export const CHROME = {
  /** 8.9% de 1024×768 = 69 985 px² / 1024 = 68.3 px · 7.6% de 1440×900 → 68.4 px */
  topBarWide: 68,
  /** 2.9% de 1024×768 = 22 806 px² / 1024 = 22.3 px */
  footerWide: 22,
  /** 14.1% de 1024×768 = 110 887 px² / (768−68−22) = 163.6 px */
  railLabels: 164,
  /** Declarado por styles.css para 1024–1439 (el tier que F-01 dejó muerto). */
  railIcons: 76,
  /** DEFAULT_INSPECTOR_WIDTH · useWorkspaceLayoutPreferences.ts */
  detailDock: 320,
  /** Ancho del detalle superpuesto en Medium, sobre MIN_INSPECTOR_WIDTH = 280. */
  detailOverlayMedium: 300,
} as const;

/** Suelos de canvas-budget. Ver CRI-9 §12 para su justificación. */
export const CB = {
  /** CB-1 · coexistencia: docks e insets que conviven con el trabajo. */
  coexistenceFloor: 0.5,
  /** CB-2 · reposo: sin ninguna superficie auxiliar invocada. */
  restFloor: 0.7,
} as const;

// ---------------------------------------------------------------------------
// 2. Las dos composiciones anchas que el presupuesto puede pagar
// ---------------------------------------------------------------------------

interface WideComposition {
  id: Extract<ShellClass, 'X2' | 'M1'>;
  railWidth: number;
  detailWidth: number;
  /** `true` → el detalle resta ancho de forma permanente (CB-4 aplica). */
  detailPersistent: boolean;
}

const WIDE_COMPOSITIONS: readonly WideComposition[] = [
  // Expanded · dos docks laterales: rail con etiquetas + detalle acoplado.
  { id: 'X2', railWidth: CHROME.railLabels, detailWidth: CHROME.detailDock, detailPersistent: true },
  // Medium · un dock lateral + detalle superpuesto sin reflow.
  { id: 'M1', railWidth: CHROME.railIcons, detailWidth: CHROME.detailOverlayMedium, detailPersistent: false },
];

/** Altura del escenario: viewport menos las bandas fijas de la composición ancha. */
const wideStageHeight = (viewport: ShellViewport) =>
  Math.max(0, viewport.height - CHROME.topBarWide - CHROME.footerWide);

/**
 * ¿Paga el presupuesto esta composición ancha en este viewport?
 *
 * CB-1 se exige porque en `X2`/`M1` el detalle COEXISTE con el trabajo sobre el
 * lienzo. CB-4 sólo se exige a superficies persistentes: el detalle superpuesto
 * de Medium no lo es. CB-6 no aplica a composiciones anchas (gobierna el detent
 * de la hoja en Compact) y CB-3/CB-5 son reglas de chrome flotante y de
 * rectángulo seguro, no de elección de clase.
 */
const wideCompositionFits = (composition: WideComposition, viewport: ShellViewport): boolean => {
  if (viewport.width <= 0 || viewport.height <= 0) return false;
  const stage = wideStageHeight(viewport);
  const viewportArea = viewport.width * viewport.height;
  if (stage <= 0 || viewportArea <= 0) return false;

  const restWidth = Math.max(0, viewport.width - composition.railWidth);
  const detailWidth = Math.max(0, restWidth - composition.detailWidth);
  const restArea = restWidth * stage;
  const withDetailArea = detailWidth * stage;

  const cb1 = withDetailArea / viewportArea >= CB.coexistenceFloor;
  const cb2 = restArea / viewportArea >= CB.restFloor;
  const cb4 = composition.detailPersistent ? composition.detailWidth * stage <= withDetailArea : true;
  return cb1 && cb2 && cb4;
};

// ---------------------------------------------------------------------------
// 3. Fronteras
// ---------------------------------------------------------------------------

/**
 * Techo de Compact. La composición Compact que hoy se RENDERIZA no es la `K0`
 * del modelo de CRI-9 (banda de herramientas + hoja con detents): es la que
 * `src/styles.css` describe bajo `@media (max-width:1023px)` — grid de una
 * columna, dock de herramientas absoluto, Results como hoja inferior.
 *
 * Mientras esos bloques sigan siendo los dueños de esa composición, la frontera
 * M1↔K0 la fija el CSS y el resolutor la respeta. Si el resolutor la moviera
 * por su cuenta (el presupuesto la pondría entre ~810 y ~1075 px según altura),
 * JS y CSS discreparían: una superficie se renderizaría en una composición y se
 * comportaría en otra. Levantar este techo es migrar esos bloques a selectores
 * por clase — trabajo del broker de presentación, no de CRI-89.
 *
 * La frontera que CRI-89 exige calculada es la de Medium (X2↔M1), y ésa sí sale
 * entera de CB: ver `expandedBoundaryWidth`.
 *
 * Por ser un puente y no una frontera calculada, cruzarlo es EXACTO: no lleva
 * histéresis en ningún sentido. Ver `commitShellComposition`.
 */
export const COMPACT_CEILING_PX = 1023;

/**
 * Sub-umbral de teléfono dentro de Compact, propiedad de los mismos bloques
 * `@media (max-width:700px)` de `src/styles.css`. Se declara aquí para que sea
 * el resolutor —y no cuatro componentes— quien lo lea. Como el techo de
 * Compact, es un puente con el CSS y se cruza exacto, sin banda.
 */
export const PHONE_CEILING_PX = 700;

/**
 * Banda de histéresis TOTAL, centrada en la frontera. Decisión CRI-12B #6.
 * Se aplica ÚNICAMENTE a la frontera calculada `X2↔M1`; los puentes con el CSS
 * (`COMPACT_CEILING_PX`, `PHONE_CEILING_PX`) se cruzan sin banda.
 */
export const SHELL_HYSTERESIS_BAND_PX = 24;

/**
 * Clase que el presupuesto de lienzo permite, sin ningún techo de compatibilidad.
 * Se exporta para poder auditar el modelo por separado del puente con el CSS.
 */
export const canvasBudgetClass = (viewport: ShellViewport): ShellClass => {
  for (const composition of WIDE_COMPOSITIONS) {
    if (wideCompositionFits(composition, viewport)) return composition.id;
  }
  return 'K0';
};

/** La clase efectiva del shell: presupuesto de lienzo bajo el techo de Compact. */
export const resolveShellClass = (viewport: ShellViewport): ShellClass => {
  if (viewport.width <= COMPACT_CEILING_PX) return 'K0';
  return canvasBudgetClass(viewport) === 'X2' ? 'X2' : 'M1';
};

export const resolveShellComposition = (viewport: ShellViewport): ShellComposition => {
  const shellClass = resolveShellClass(viewport);
  return { shellClass, phone: shellClass === 'K0' && viewport.width <= PHONE_CEILING_PX };
};

/**
 * El riel sólo muestra etiquetas donde el presupuesto paga un dock con
 * etiquetas, es decir en `X2`. Deja de ser una preferencia persistida y pasa a
 * ser esta derivación: una regla, un sitio, dos lectores (el atributo del shell
 * y la prop del riel).
 */
export const isToolRailCompact = (shellClass: ShellClass): boolean => shellClass !== 'X2';

/**
 * Ancho mínimo al que `X2` pasa a caber, para una altura dada. Nadie escribe
 * este número: se barre sobre CB. Reproduce la tabla de CRI-9 §12 —
 * 1130 px a 720 de alto, 1117 a 768, 1089 a 900, 1042 a 1366.
 */
export const expandedBoundaryWidth = (height: number): number | null => {
  for (let width = COMPACT_CEILING_PX + 1; width <= 3840; width += 1) {
    if (resolveShellClass({ width, height }) === 'X2') return width;
  }
  return null;
};

// ---------------------------------------------------------------------------
// 4. Histéresis (T-INV-5)
// ---------------------------------------------------------------------------

const sameComposition = (first: ShellComposition, second: ShellComposition) =>
  first.shellClass === second.shellClass && first.phone === second.phone;

/**
 * Commitea la composición: la frontera CALCULADA lleva banda, el puente con el
 * CSS no.
 *
 * **`M1↔K0` y el sub-umbral de teléfono no llevan histéresis.** No son
 * fronteras del presupuesto: son `COMPACT_CEILING_PX` y `PHONE_CEILING_PX`, dos
 * puentes de compatibilidad con los `@media` que hoy siguen siendo los dueños
 * de la composición Compact. Una banda sobre un puente lo rompe — el CSS conmuta
 * exactamente en 1023/1024 y la clase se quedaría hasta 24 px por detrás, así
 * que dentro de esa banda una superficie se renderizaría en una composición y
 * se comportaría en otra: justo la doble fuente de verdad que este slice
 * elimina. Mientras el techo exista, cruzarlo es exacto en los dos sentidos.
 *
 * **`X2↔M1` sí lleva la banda de `bandPx`** (T-INV-5, decisión CRI-12B #6),
 * porque ésa sí es la frontera que sale de CB-1..CB-4 y la que un arrastre
 * continuo puede hacer parpadear. Se resuelve el viewport en los dos extremos
 * de la banda (±`bandPx / 2`) y la clase sólo cambia si los dos coinciden con
 * el valor crudo; dentro de la banda se conserva la anterior. El extremo
 * inferior se recorta al primer ancho no-Compact para que el puente exacto
 * nunca contamine esta decisión.
 *
 * Resultado: zona muerta de exactamente `bandPx` alrededor de la frontera
 * calculada, independiente de la dirección y de dónde esté esa frontera —cosa
 * que importa porque depende de la altura y se mueve al rotar— y cero zona
 * muerta sobre el techo de Compact.
 */
export const commitShellComposition = (
  previous: ShellComposition | null,
  viewport: ShellViewport,
  bandPx: number = SHELL_HYSTERESIS_BAND_PX,
): ShellComposition => {
  const raw = resolveShellComposition(viewport);
  if (!previous) return raw;
  if (sameComposition(previous, raw)) return previous;

  // Cualquier lado del puente con el CSS se commitea tal cual, sin banda. Eso
  // cubre entrar en Compact, salir de Compact y cruzar el umbral de teléfono.
  if (raw.shellClass === 'K0' || previous.shellClass === 'K0') return raw;

  // A partir de aquí `previous` y `raw` son ambos anchos (`X2` o `M1`), y
  // `phone` es falso en los dos: sólo queda la frontera calculada.
  const half = bandPx / 2;
  const lower = resolveShellClass({
    width: Math.max(viewport.width - half, COMPACT_CEILING_PX + 1),
    height: viewport.height,
  });
  const upper = resolveShellClass({ width: viewport.width + half, height: viewport.height });
  const shellClass = lower === raw.shellClass && upper === raw.shellClass ? raw.shellClass : previous.shellClass;

  // Identidad estable: sin cambio no hay emisión, y el contexto no re-renderiza.
  return shellClass === previous.shellClass ? previous : { shellClass, phone: false };
};
