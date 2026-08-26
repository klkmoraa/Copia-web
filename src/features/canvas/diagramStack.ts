import { evaluateDiagramAt, segmentBezierControls } from '../../engine/diagram';
import type { DiagramCriticalPoint, MemberResult, ProjectModel, Selection } from '../../types';

/**
 * ACM: axial, cortante y momento desplegados **a la vez** bajo el modelo, cada
 * uno en su propio carril, en vez de uno cada vez sobre la barra.
 *
 * Es presentación pura: lee el mismo `MemberResult` que ya resolvió el motor y
 * devuelve rutas en píxeles de pantalla. No evalúa nada por su cuenta —los
 * tramos siguen siendo las Bézier exactas de `segmentBezierControls`—, no toca
 * el modelo y no pide un análisis nuevo.
 */
export type StackQuantity = 'axial' | 'shear' | 'moment';

/** Orden canónico del ACM: la A, la C y la M, siempre en ese orden. */
export const STACK_QUANTITIES: readonly StackQuantity[] = ['axial', 'shear', 'moment'];

export const STACK_SYMBOLS: Readonly<Record<StackQuantity, string>> = {
  axial: 'N',
  shear: 'V',
  moment: 'M',
};

/**
 * Elegir qué carriles entran en el ACM es un conmutador por cantidad, pero el
 * despliegue nunca se queda vacío: apagar el último carril dejaría un botón
 * encendido que no dibuja nada, así que ese clic no hace nada.
 */
export const toggleStackQuantity = (
  current: readonly StackQuantity[],
  quantity: StackQuantity,
): StackQuantity[] => {
  const active = current.includes(quantity);
  if (active && current.length === 1) return [...current];
  const next = active ? current.filter((item) => item !== quantity) : [...current, quantity];
  return STACK_QUANTITIES.filter((item) => next.includes(item));
};

/**
 * De qué barra habla el despliegue. La selección manda —es lo que el usuario
 * está mirando—; sin selección se toma la barra más larga con resultado, que
 * en el caso de una sola viga es la viga, y en un pórtico es una elección
 * estable entre revisiones en vez de una arbitraria.
 */
export const resolveStackMemberId = (
  project: ProjectModel,
  selection: Selection,
  resultMap: ReadonlyMap<string, MemberResult>,
): string | null => {
  const usable = (id: string | undefined): id is string =>
    Boolean(id && (resultMap.get(id)?.diagramSegments.length ?? 0) > 0);
  if (selection?.kind === 'member' && usable(selection.id)) return selection.id;
  if (selection?.kind === 'multi') {
    const picked = selection.memberIds.find(usable);
    if (picked) return picked;
  }
  let best: { id: string; length: number } | null = null;
  for (const member of project.members) {
    if (!usable(member.id)) continue;
    const length = resultMap.get(member.id)?.length ?? 0;
    if (!best || length > best.length) best = { id: member.id, length };
  }
  return best?.id ?? null;
};

export interface DiagramStackRect {
  /** Borde izquierdo del despliegue, en píxeles de pantalla. */
  x: number;
  /** Borde superior del primer carril. */
  y: number;
  width: number;
  laneHeight: number;
  laneGap: number;
}

export interface DiagramStackExtreme {
  kind: 'max' | 'min';
  x: number;
  value: number;
  screen: { x: number; y: number };
}

export interface DiagramStackLane {
  quantity: StackQuantity;
  symbol: string;
  top: number;
  height: number;
  baselineY: number;
  left: number;
  right: number;
  fillPath: string;
  linePath: string;
  /** Máximo absoluto del carril: el divisor de su escala propia. */
  maxAbs: number;
  /** Píxeles que separan la línea base del máximo del carril. */
  amplitude: number;
  /** Píxeles por unidad de longitud del miembro. */
  pixelsPerLength: number;
  /** Píxeles por unidad de la magnitud dibujada. */
  pixelsPerValue: number;
  extremes: DiagramStackExtreme[];
}

/** Estación del miembro → x de pantalla dentro del carril. */
export const laneScreenX = (lane: Pick<DiagramStackLane, 'left' | 'pixelsPerLength'>, x: number): number =>
  lane.left + x * lane.pixelsPerLength;

/** Valor de la magnitud → y de pantalla dentro del carril. */
export const laneScreenY = (lane: Pick<DiagramStackLane, 'baselineY' | 'pixelsPerValue'>, value: number): number =>
  lane.baselineY - value * lane.pixelsPerValue;

/** x de pantalla → estación del miembro, acotada a la barra. */
export const stationFromScreenX = (
  lane: Pick<DiagramStackLane, 'left' | 'pixelsPerLength'>,
  length: number,
  screenX: number,
): number => {
  if (lane.pixelsPerLength <= 0) return 0;
  return Math.min(length, Math.max(0, (screenX - lane.left) / lane.pixelsPerLength));
};

/**
 * Las estaciones que de verdad importan: extremos, bordes de tramo y saltos.
 * Son los números que el motor ya calculó exactos; el resto del dominio es
 * interpolación.
 */
export const notableStations = (result: MemberResult): number[] => Array.from(new Set([
  0,
  result.length,
  ...result.diagramSegments.flatMap((segment) => [segment.x0, segment.x1]),
  ...result.diagramJumps.map((jump) => jump.x),
  ...result.criticalPoints.map((point) => point.x),
])).sort((a, b) => a - b);

/**
 * Imanta la lectura a la estación notable más cercana.
 *
 * Sin esto, cazar el Mmáx con el puntero es un juego de puntería que termina
 * mostrando 118,17 donde el modelo dice 118,18. La tolerancia es la misma que
 * usa el cursor de los diagramas del panel de resultados: 1,2 % de la barra.
 */
export const snapStation = (result: MemberResult, x: number): number => {
  const stations = notableStations(result);
  if (!stations.length) return x;
  const nearest = stations.reduce((best, station) => (Math.abs(station - x) < Math.abs(best - x) ? station : best), stations[0]);
  return Math.abs(nearest - x) <= Math.max(result.length * 0.012, 1e-8) ? nearest : x;
};

export interface StationReading {
  quantity: StackQuantity;
  value: number;
  /** Límites laterales cuando la estación cae en un salto; `null` si la curva es continua ahí. */
  jump: { left: number; right: number } | null;
}

/**
 * Las tres lecturas de una misma estación, de una sola evaluación por lado.
 *
 * En un salto los dos límites laterales son números distintos, así que se piden
 * ambos y se informan los dos en vez de elegir uno en silencio.
 */
export const stationReadings = (result: MemberResult, x: number): StationReading[] => {
  const left = evaluateDiagramAt(result.diagramSegments, result.diagramJumps, x, 'left');
  const right = evaluateDiagramAt(result.diagramSegments, result.diagramJumps, x, 'right');
  if (!right && !left) return [];
  return STACK_QUANTITIES.map((quantity) => {
    const leftValue = left?.[quantity] ?? right?.[quantity] ?? 0;
    const rightValue = right?.[quantity] ?? leftValue;
    const scale = Math.max(Math.abs(leftValue), Math.abs(rightValue), 1e-12);
    const discontinuous = Math.abs(rightValue - leftValue) > scale * 1e-9;
    return {
      quantity,
      value: rightValue,
      jump: discontinuous ? { left: leftValue, right: rightValue } : null,
    };
  });
};

/** Aire entre la línea del diagrama y el borde del carril. */
const LANE_PADDING = 14;

const extremesOf = (points: readonly DiagramCriticalPoint[], quantity: StackQuantity) => {
  const candidates = points.filter((point) => point.quantity === quantity);
  if (!candidates.length) return [] as Array<{ kind: 'max' | 'min'; x: number; value: number }>;
  const highest = candidates.reduce((best, point) => (point.value > best.value ? point : best));
  const lowest = candidates.reduce((best, point) => (point.value < best.value ? point : best));
  const marks: Array<{ kind: 'max' | 'min'; x: number; value: number }> = [
    { kind: 'max', x: highest.x, value: highest.value },
  ];
  // Un diagrama de signo constante tiene un solo extremo interesante: sellarlo
  // dos veces apilaría dos etiquetas idénticas sobre el mismo punto.
  if (Math.abs(lowest.value - highest.value) > 1e-9) marks.push({ kind: 'min', x: lowest.x, value: lowest.value });
  return marks;
};

const maxAbsOf = (result: MemberResult, quantity: StackQuantity): number => {
  const min = quantity === 'axial' ? result.minAxial : quantity === 'shear' ? result.minShear : result.minMoment;
  const max = quantity === 'axial' ? result.maxAxial : quantity === 'shear' ? result.maxShear : result.maxMoment;
  return Math.max(Math.abs(min), Math.abs(max), 1e-9);
};

/**
 * Un carril por cantidad, apilados de arriba abajo en el orden canónico. Cada
 * carril lleva su propia escala: el axial de una viga puede ser mil veces menor
 * que su momento, y una escala común dejaría dos de los tres diagramas planos.
 */
export const buildDiagramStack = (
  result: MemberResult,
  quantities: readonly StackQuantity[],
  rect: DiagramStackRect,
): DiagramStackLane[] => {
  const length = result.length;
  if (!result.diagramSegments.length || length <= 0 || rect.width <= 0) return [];
  const ordered = STACK_QUANTITIES.filter((quantity) => quantities.includes(quantity));

  return ordered.map((quantity, index) => {
    const top = rect.y + index * (rect.laneHeight + rect.laneGap);
    const baselineY = top + rect.laneHeight / 2;
    const amplitude = Math.max(6, rect.laneHeight / 2 - LANE_PADDING);
    const maxAbs = maxAbsOf(result, quantity);
    const sx = (x: number) => rect.x + (x / length) * rect.width;
    const sy = (value: number) => baselineY - (value / maxAbs) * amplitude;

    const first = segmentBezierControls(result.diagramSegments[0], quantity);
    const lineCommands = [`M ${sx(first.x0)} ${sy(first.y0)}`];
    const fillCommands = [`M ${sx(0)} ${baselineY}`, `L ${sx(first.x0)} ${sy(first.y0)}`];
    result.diagramSegments.forEach((segment, position) => {
      const control = segmentBezierControls(segment, quantity);
      const curve = `C ${sx(control.c1x)} ${sy(control.c1y)} ${sx(control.c2x)} ${sy(control.c2y)} ${sx(control.x1)} ${sy(control.y1)}`;
      lineCommands.push(curve);
      fillCommands.push(curve);
      const next = result.diagramSegments[position + 1];
      if (!next) return;
      const nextControl = segmentBezierControls(next, quantity);
      // El salto de una carga puntual es vertical y real: se dibuja donde está,
      // no se suaviza uniendo los dos tramos con una curva que nadie calculó.
      if (Math.abs(nextControl.y0 - control.y1) > 1e-10) {
        const jump = `L ${sx(nextControl.x0)} ${sy(nextControl.y0)}`;
        lineCommands.push(jump);
        fillCommands.push(jump);
      }
    });
    fillCommands.push(`L ${sx(length)} ${baselineY}`, 'Z');

    return {
      quantity,
      symbol: STACK_SYMBOLS[quantity],
      top,
      height: rect.laneHeight,
      baselineY,
      left: sx(0),
      right: sx(length),
      fillPath: fillCommands.join(' '),
      linePath: lineCommands.join(' '),
      maxAbs,
      amplitude,
      pixelsPerLength: rect.width / length,
      pixelsPerValue: amplitude / maxAbs,
      extremes: extremesOf(result.criticalPoints, quantity).map((extreme) => ({
        ...extreme,
        screen: { x: sx(extreme.x), y: sy(extreme.value) },
      })),
    };
  });
};
