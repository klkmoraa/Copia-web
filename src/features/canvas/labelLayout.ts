import type { CanvasSafeRect } from './canvasChromeGeometry';

export type SmartLabelPriority = 0 | 1 | 2 | 3;
export type SmartLabelTone = 'neutral' | 'selection' | 'force' | 'shear' | 'moment' | 'dimension' | 'axial';

export interface SmartLabelCandidate {
  id: string;
  text: string;
  anchor: { x: number; y: number };
  priority: SmartLabelPriority;
  tone?: SmartLabelTone;
  preferredOffset?: { x: number; y: number };
  minScale?: number;
  forceVisible?: boolean;
  /**
   * Segundo renglón y siguientes (p. ej. valor + estación de un extremo de
   * diagrama). `text` sigue siendo el primer renglón y el resumen de una
   * línea para quien sólo lea `text`; `lines`, si está, sustituye la
   * representación visual completa.
   */
  lines?: readonly string[];
}

export interface SmartLabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacedSmartLabel extends SmartLabelCandidate {
  rect: SmartLabelRect;
  leader: boolean;
}

export type SmartLabelDetail = 'essential' | 'standard' | 'detailed';

const LABEL_HEIGHT = 22;
const LABEL_LINE_HEIGHT = 12;
const LABEL_GAP = 8;
/** Área nominal que reserva una etiqueta típica, gap incluido. */
const NOMINAL_LABEL_FOOTPRINT = 1800;
/** Techo mínimo aunque el área segura sea muy pequeña (K0, teléfono). */
const MIN_LABEL_CAPACITY = 24;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const smartLabelDetailForScale = (scale: number): SmartLabelDetail => {
  if (scale < 52) return 'essential';
  if (scale < 90) return 'standard';
  return 'detailed';
};

const defaultMinimumScale = (priority: SmartLabelPriority): number => {
  if (priority <= 1) return 0;
  if (priority === 2) return 52;
  return 90;
};

/**
 * Ancho estimado a partir del renglón más largo. Una sola regla para toda
 * etiqueta del lienzo — antes `CanvasResultLayer` medía sus sellos con su
 * propia aritmética (5.1px/carácter) y este módulo con otra (6.5px/carácter):
 * dos medidas para el mismo tipo de texto.
 */
const estimatedWidth = (candidate: SmartLabelCandidate, availableWidth: number): number => {
  const lines = candidate.lines ?? [candidate.text];
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return Math.min(availableWidth, Math.max(34, longest * 6.5 + 18));
};

const estimatedHeight = (candidate: SmartLabelCandidate, availableHeight: number): number => {
  const lineCount = candidate.lines?.length ?? 1;
  const height = lineCount <= 1 ? LABEL_HEIGHT : LABEL_HEIGHT + (lineCount - 1) * LABEL_LINE_HEIGHT;
  return Math.min(height, availableHeight);
};

const rectAt = (
  candidate: SmartLabelCandidate,
  offset: { x: number; y: number },
  bounds: CanvasSafeRect,
): SmartLabelRect => {
  const width = estimatedWidth(candidate, bounds.width);
  const height = estimatedHeight(candidate, bounds.height);
  const desiredX = candidate.anchor.x + offset.x - width / 2;
  const desiredY = candidate.anchor.y + offset.y - height / 2;
  return {
    x: clamp(desiredX, bounds.x, bounds.x + bounds.width - width),
    y: clamp(desiredY, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
};

export const smartLabelRectsOverlap = (
  first: SmartLabelRect,
  second: SmartLabelRect,
  gap = LABEL_GAP,
): boolean => !(
  first.x + first.width + gap <= second.x
  || second.x + second.width + gap <= first.x
  || first.y + first.height + gap <= second.y
  || second.y + second.height + gap <= first.y
);

const candidateOffsets = (preferred: { x: number; y: number }): Array<{ x: number; y: number }> => {
  const offsets = [
    preferred,
    { x: -preferred.x, y: preferred.y },
    { x: preferred.x, y: -preferred.y },
    { x: -preferred.x, y: -preferred.y },
  ];
  for (const radius of [28, 46, 66, 90, 120, 156, 198, 246]) {
    offsets.push(
      { x: 0, y: -radius },
      { x: radius, y: -radius },
      { x: radius, y: 0 },
      { x: radius, y: radius },
      { x: 0, y: radius },
      { x: -radius, y: radius },
      { x: -radius, y: 0 },
      { x: -radius, y: -radius },
    );
  }
  return offsets;
};

const rectCenter = (rect: SmartLabelRect) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/**
 * Índice espacial por celdas para la prueba de colisión. Sin él, cada uno de
 * los hasta 68 desplazamientos candidatos de una etiqueta se comparaba contra
 * *todas* las ya colocadas (O(n²×68)); aquí sólo se comparan las que caen en
 * celdas cercanas. El tamaño de celda es mayor que una etiqueta típica para
 * que un rectángulo toque pocas celdas.
 */
const SPATIAL_CELL_SIZE = 128;

class SmartLabelSpatialIndex {
  private readonly cells = new Map<string, number[]>();

  private cellRange(rect: SmartLabelRect, gap: number) {
    return {
      minCx: Math.floor((rect.x - gap) / SPATIAL_CELL_SIZE),
      maxCx: Math.floor((rect.x + rect.width + gap) / SPATIAL_CELL_SIZE),
      minCy: Math.floor((rect.y - gap) / SPATIAL_CELL_SIZE),
      maxCy: Math.floor((rect.y + rect.height + gap) / SPATIAL_CELL_SIZE),
    };
  }

  insert(rect: SmartLabelRect, index: number): void {
    const { minCx, maxCx, minCy, maxCy } = this.cellRange(rect, 0);
    for (let cx = minCx; cx <= maxCx; cx += 1) {
      for (let cy = minCy; cy <= maxCy; cy += 1) {
        const key = `${cx},${cy}`;
        const bucket = this.cells.get(key);
        if (bucket) bucket.push(index);
        else this.cells.set(key, [index]);
      }
    }
  }

  overlapsAny(rect: SmartLabelRect, placed: readonly PlacedSmartLabel[], gap: number): boolean {
    const { minCx, maxCx, minCy, maxCy } = this.cellRange(rect, gap);
    const checked = new Set<number>();
    for (let cx = minCx; cx <= maxCx; cx += 1) {
      for (let cy = minCy; cy <= maxCy; cy += 1) {
        const bucket = this.cells.get(`${cx},${cy}`);
        if (!bucket) continue;
        for (const index of bucket) {
          if (checked.has(index)) continue;
          checked.add(index);
          if (smartLabelRectsOverlap(rect, placed[index].rect, gap)) return true;
        }
      }
    }
    return false;
  }
}

/**
 * Deterministic, presentation-only label placement. P0/P1 labels are mandatory;
 * P2/P3 labels yield when the safe canvas area is already occupied.
 */
export const layoutSmartLabels = (
  candidates: SmartLabelCandidate[],
  bounds: CanvasSafeRect,
  scale: number,
): PlacedSmartLabel[] => {
  const ordered = [...candidates]
    .filter((candidate) => candidate.text.trim().length > 0)
    .filter((candidate) => candidate.forceVisible || scale >= (candidate.minScale ?? defaultMinimumScale(candidate.priority)))
    .sort((first, second) => first.priority - second.priority || first.id.localeCompare(second.id));
  const placed: PlacedSmartLabel[] = [];
  const index = new SmartLabelSpatialIndex();
  // Techo global derivado del área segura real: sin él, una escena grande en
  // vista de resultados pide cientos de candidatos y el reparto se vuelve
  // denso hasta ilegible antes de que la colisión por pares lo note. Las
  // etiquetas obligatorias (`forceVisible`, típicamente selección y extremos
  // del diagrama activo) no cuentan contra el techo.
  const capacity = Math.max(MIN_LABEL_CAPACITY, Math.floor((bounds.width * bounds.height) / NOMINAL_LABEL_FOOTPRINT));
  let visibleBudget = capacity;

  for (const candidate of ordered) {
    if (!candidate.forceVisible && visibleBudget <= 0) continue;
    const preferred = candidate.preferredOffset ?? { x: 18, y: -18 };
    const preferredCenter = {
      x: candidate.anchor.x + preferred.x,
      y: candidate.anchor.y + preferred.y,
    };
    let selectedRect: SmartLabelRect | null = null;
    for (const offset of candidateOffsets(preferred)) {
      const rect = rectAt(candidate, offset, bounds);
      if (!index.overlapsAny(rect, placed, LABEL_GAP)) {
        selectedRect = rect;
        break;
      }
    }

    if (!selectedRect) {
      if (candidate.priority >= 2 && !candidate.forceVisible) continue;
      selectedRect = rectAt(candidate, preferred, bounds);
    }

    const center = rectCenter(selectedRect);
    const leader = Math.hypot(center.x - preferredCenter.x, center.y - preferredCenter.y) > 12;
    placed.push({ ...candidate, rect: selectedRect, leader });
    index.insert(selectedRect, placed.length - 1);
    if (!candidate.forceVisible) visibleBudget -= 1;
  }

  return placed;
};
