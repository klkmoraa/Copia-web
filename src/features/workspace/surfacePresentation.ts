import type { ShellClass } from './shellComposition';

export const SURFACE_PRESENTATIONS = [
  'band',
  'dock',
  'inset',
  'sheet',
  'drawer',
  'fullscreen',
  'overlay',
  'floating',
] as const;

export type SurfacePresentation = (typeof SURFACE_PRESENTATIONS)[number];

export const BROKER_SURFACE_IDS = [
  /**
   * El panel derecho. Es **uno**: sus tres segmentos —detalle, cargas y
   * vista— viven dentro de `Inspector`, no son tres superficies. Hasta aqui
   * habia tres ids que montaban tres copias del mismo componente con su
   * tablist apagado; la unica consecuencia real de tenerlos separados era que
   * Compact los trataba como tres capas contextuales que se desbancaban entre
   * si.
   */
  'detail',
  /**
   * Todo lo denso, en una sola superficie con tres pestañas: Resultados ·
   * Tabla · Revisión.
   *
   * Antes eran cuatro ids —`results`, `dense`, `datasheet` y `doctor`— con
   * cuatro cromos y cuatro lanzadores. Este mismo resolutor ya las obligaba a
   * ser mutuamente excluyentes (`validateSurfaceCombination`: «drawer y
   * fullscreen son mutuamente exclusivos»), así que en pantalla nunca hubo más
   * de una a la vez. Unificarlas no cambia lo que el usuario puede tener
   * abierto: le da a esa restricción, que ya existía, una sola forma.
   *
   * Es invocada, nunca residente: se abre a petición y se cierra devolviendo el
   * foco, por eso su presentación es modal en las tres clases y admite `peek`.
   */
  'data',
  'palette',
  'candidatePicker',
  'contextualActions',
] as const;

export type SurfaceId = (typeof BROKER_SURFACE_IDS)[number];
export type SurfaceExtent = 'default' | 'peek';
export type SurfaceStatus = 'closed' | 'active' | 'suspended';

export const SURFACE_PRESENTATION_TABLE: Readonly<Record<ShellClass, Readonly<Record<SurfaceId, SurfacePresentation>>>> = {
  X2: {
    detail: 'dock',
    data: 'drawer',
    palette: 'overlay',
    candidatePicker: 'floating',
    contextualActions: 'inset',
  },
  M1: {
    detail: 'inset',
    data: 'drawer',
    palette: 'overlay',
    candidatePicker: 'floating',
    contextualActions: 'inset',
  },
  K0: {
    detail: 'sheet',
    data: 'fullscreen',
    palette: 'sheet',
    candidatePicker: 'sheet',
    contextualActions: 'inset',
  },
};

/**
 * Clase de actividad por **rol** de superficie (CRI-108).
 *
 * La tabla de arriba dice *dónde* aparece una superficie; ésta dice *cómo
 * compite por estar activa*. Son dos preguntas distintas y hasta ahora sólo
 * estaba contestada la primera: en Compact ganaba siempre la última
 * activación, tratando a las diez superficies como competidoras equivalentes.
 *
 * * `tool` — herramienta invocada que el usuario conduce (`drawer`/`fullscreen`).
 * * `layer` — capa contextual que ocupa la ranura Compact (`sheet`, `overlay`,
 *   `floating`, o los carriles residentes de X2/M1).
 * * `derived` — no la abre el usuario: se deriva enteramente de la selección y
 *   viaja pegada al lienzo (CRI-97). **Nunca** reclama la ranura contextual y
 *   **nunca** suspende a nadie; está activa exactamente mientras el lienzo sea
 *   alcanzable.
 *
 * `tool` y `layer` siguen resolviéndose entre sí por última activación —abrir
 * el Picker o una hoja encima de una herramienta es un acto del usuario y debe
 * ganar—. Lo único que cambia es que una apertura *derivada* ya no puede
 * desbancar a lo que el usuario está usando.
 */
export const SURFACE_ACTIVITY_CLASSES = ['tool', 'layer', 'derived'] as const;

export type SurfaceActivityClass = (typeof SURFACE_ACTIVITY_CLASSES)[number];

export const SURFACE_ACTIVITY_CLASS: Readonly<Record<SurfaceId, SurfaceActivityClass>> = {
  detail: 'layer',
  data: 'tool',
  palette: 'layer',
  candidatePicker: 'layer',
  contextualActions: 'derived',
};

export const surfaceActivityClass = (surface: SurfaceId): SurfaceActivityClass => SURFACE_ACTIVITY_CLASS[surface];

/** Las que compiten por la única ranura contextual de Compact (R-1). */
const occupiesContextualSlot = (surface: SurfaceId): boolean => surfaceActivityClass(surface) !== 'derived';

export interface SurfaceIntent {
  open: boolean;
  extent: SurfaceExtent;
  activation: number;
  requestVersion: number;
}

export interface SurfaceBrokerState {
  sequence: number;
  surfaces: Record<SurfaceId, SurfaceIntent>;
}

export interface SurfaceActivity extends SurfaceIntent {
  presentation: SurfacePresentation;
  status: SurfaceStatus;
}

export type SurfaceActivityMap = Record<SurfaceId, SurfaceActivity>;

const emptyIntent = (): SurfaceIntent => ({
  open: false,
  extent: 'default',
  activation: 0,
  requestVersion: 0,
});

export const createSurfaceBrokerState = (initialOpen: readonly SurfaceId[] = []): SurfaceBrokerState => {
  const surfaces = Object.fromEntries(BROKER_SURFACE_IDS.map((surface) => [surface, emptyIntent()])) as Record<SurfaceId, SurfaceIntent>;
  initialOpen.forEach((surface, index) => {
    surfaces[surface] = { ...surfaces[surface], open: true, activation: index + 1 };
  });
  return { sequence: initialOpen.length, surfaces };
};

export const openSurfaceIntent = (state: SurfaceBrokerState, surface: SurfaceId): SurfaceBrokerState => {
  const sequence = state.sequence + 1;
  const current = state.surfaces[surface];
  return {
    sequence,
    surfaces: {
      ...state.surfaces,
      [surface]: {
        ...current,
        open: true,
        activation: sequence,
        requestVersion: current.requestVersion + 1,
      },
    },
  };
};

export const activateSurfaceIntent = (state: SurfaceBrokerState, surface: SurfaceId): SurfaceBrokerState => {
  if (!state.surfaces[surface].open) return state;
  const sequence = state.sequence + 1;
  return {
    sequence,
    surfaces: {
      ...state.surfaces,
      [surface]: {
        ...state.surfaces[surface],
        activation: sequence,
      },
    },
  };
};

export const closeSurfaceIntent = (state: SurfaceBrokerState, surface: SurfaceId): SurfaceBrokerState => ({
  ...state,
  surfaces: {
    ...state.surfaces,
    [surface]: {
      ...state.surfaces[surface],
      open: false,
      extent: 'default',
    },
  },
});

export const resolveSurfacePresentation = (
  shellClass: ShellClass,
  surface: SurfaceId,
): SurfacePresentation => SURFACE_PRESENTATION_TABLE[shellClass][surface];

export const isModalPresentation = (presentation: SurfacePresentation): boolean => (
  presentation === 'drawer' || presentation === 'fullscreen'
);

const latest = (surfaces: readonly SurfaceId[], state: SurfaceBrokerState): SurfaceId | undefined => (
  [...surfaces].sort((left, right) => state.surfaces[left].activation - state.surfaces[right].activation).at(-1)
);

/**
 * Resolución de actividad (CRI-108).
 *
 * En Compact hay **una** ranura contextual (R-1) y la disputan sólo las
 * superficies que la ocupan —`tool` y `layer`—, por última activación, como
 * hasta ahora. Una superficie `derived` no entra en esa disputa: no la abre el
 * usuario, así que no puede desbancar a lo que el usuario está usando. A
 * cambio cede ella: está activa mientras el lienzo sea alcanzable, y se
 * suspende —retenida, nunca destruida— cuando algo lo tapa.
 *
 * Una superficie en `peek` sigue ocupando la ranura —sigue siendo la única
 * `drawer`/`fullscreen` retenida— pero ya no tapa el lienzo, así que el zócalo
 * derivado vuelve con él. Es el mismo criterio con el que el proveedor levanta
 * el `inert` del fondo en `peek`, no un segundo concepto.
 *
 * X2 y M1 no tienen ranura única: allí `derived` sigue activa siempre que esté
 * abierta, exactamente como antes.
 */
export const resolveSurfaceActivity = (
  shellClass: ShellClass,
  state: SurfaceBrokerState,
): SurfaceActivityMap => {
  const open = BROKER_SURFACE_IDS.filter((surface) => state.surfaces[surface].open);
  const compactWinner = shellClass === 'K0'
    ? latest(open.filter(occupiesContextualSlot), state)
    : undefined;
  const canvasReachable = !compactWinner || state.surfaces[compactWinner].extent === 'peek';
  const modalWinner = latest(open.filter((surface) => (
    isModalPresentation(resolveSurfacePresentation(shellClass, surface))
  )), state);

  return Object.fromEntries(BROKER_SURFACE_IDS.map((surface) => {
    const intent = state.surfaces[surface];
    const presentation = resolveSurfacePresentation(shellClass, surface);
    let status: SurfaceStatus = 'active';
    if (!intent.open) status = 'closed';
    else if (!occupiesContextualSlot(surface)) status = canvasReachable ? 'active' : 'suspended';
    else if (compactWinner && compactWinner !== surface) status = 'suspended';
    else if (isModalPresentation(presentation) && modalWinner !== surface) status = 'suspended';
    return [surface, { ...intent, presentation, status }];
  })) as SurfaceActivityMap;
};

export const setSurfaceExtent = (
  state: SurfaceBrokerState,
  shellClass: ShellClass,
  surface: SurfaceId,
  extent: SurfaceExtent,
): SurfaceBrokerState => {
  const presentation = resolveSurfacePresentation(shellClass, surface);
  if (extent === 'peek' && !isModalPresentation(presentation)) {
    throw new Error('peek sólo es válido para una superficie drawer o fullscreen.');
  }
  return {
    ...state,
    surfaces: {
      ...state.surfaces,
      [surface]: { ...state.surfaces[surface], extent },
    },
  };
};

export const validateSurfaceCombination = (
  shellClass: ShellClass,
  activity: SurfaceActivityMap,
): string[] => {
  const errors: string[] = [];
  const active = BROKER_SURFACE_IDS.filter((surface) => activity[surface].status === 'active');
  // R-1 cuenta **capas contextuales**, no superficies activas. El zócalo
  // derivado de la selección no ocupa la ranura —igual que las excepciones
  // declaradas `status` y `transient` de CRI-94—, así que contarlo daba por
  // buena la sustitución que este validador debía denunciar.
  const activeSlot = active.filter(occupiesContextualSlot);
  if (shellClass === 'K0' && activeSlot.length > 1) errors.push('Compact admite una sola capa contextual activa.');
  // Y, por lo mismo, el zócalo no puede estar activo detrás de algo que tapa
  // el lienzo: quedaría enfocable bajo un fondo `inert`.
  const occluding = activeSlot.find((surface) => activity[surface].extent !== 'peek');
  if (shellClass === 'K0' && occluding && activeSlot.length !== active.length) {
    errors.push(`Una superficie derivada no puede estar activa mientras ${occluding} ocupa el lienzo.`);
  }
  const modal = active.filter((surface) => isModalPresentation(activity[surface].presentation));
  if (modal.length > 1) errors.push('drawer y fullscreen son mutuamente exclusivos.');
  for (const surface of BROKER_SURFACE_IDS) {
    const current = activity[surface];
    if (current.extent === 'peek' && !isModalPresentation(current.presentation)) {
      errors.push(`${surface}: peek requiere drawer o fullscreen.`);
    }
  }
  return errors;
};
