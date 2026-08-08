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
const LABEL_GAP = 8;

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

const estimatedWidth = (text: string, availableWidth: number): number =>
  Math.min(availableWidth, Math.max(34, text.length * 6.5 + 18));

const rectAt = (
  candidate: SmartLabelCandidate,
  offset: { x: number; y: number },
  bounds: CanvasSafeRect,
): SmartLabelRect => {
  const width = estimatedWidth(candidate.text, bounds.width);
  const height = Math.min(LABEL_HEIGHT, bounds.height);
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

  for (const candidate of ordered) {
    const preferred = candidate.preferredOffset ?? { x: 18, y: -18 };
    const preferredCenter = {
      x: candidate.anchor.x + preferred.x,
      y: candidate.anchor.y + preferred.y,
    };
    let selectedRect: SmartLabelRect | null = null;
    for (const offset of candidateOffsets(preferred)) {
      const rect = rectAt(candidate, offset, bounds);
      if (!placed.some((label) => smartLabelRectsOverlap(rect, label.rect))) {
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
  }

  return placed;
};
