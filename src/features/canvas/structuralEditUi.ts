import type { ProjectModel, Selection } from '../../types';
import { fromDisplay, toDisplay } from '../../engine/units';
import { formatNumber } from '../../utils/numberFormat';
import {
  resolveStructuralSelection,
  structuralEditSnapshot,
  type Point2D,
  type StructuralAlignment,
  type StructuralEditRequest,
} from '../../data/structuralEditing';

export type StructuralEditKind = StructuralEditRequest['kind'];
export type MirrorAxisKind = 'horizontal' | 'vertical' | 'arbitrary';

export interface StructuralEditFields {
  deltaX: string;
  deltaY: string;
  centerX: string;
  centerY: string;
  angleDeg: string;
  mirrorMode: 'transform' | 'copy';
  mirrorAxis: MirrorAxisKind;
  axisCoordinate: string;
  axisStartX: string;
  axisStartY: string;
  axisEndX: string;
  axisEndY: string;
  directionX: string;
  directionY: string;
  spacing: string;
  count: string;
  alignment: StructuralAlignment;
  distributeAxis: 'x' | 'y';
}

export interface StructuralEditDraft {
  kind: StructuralEditKind;
  selection: Selection;
  sourceSnapshot: string;
  fields: StructuralEditFields;
}

export interface PointerEditGesture {
  start: Point2D;
  current: Point2D;
}

const displayNumber = (value: number): string => {
  const normalized = Math.abs(value) < 1e-12 ? 0 : value;
  return formatNumber(normalized, 'tooltip', {
    significantDigits: 15,
    scientificBelow: 0,
    scientificAtOrAbove: Number.MAX_VALUE,
    maximumFractionDigits: 8,
  });
};

const internalLength = (project: ProjectModel, text: string, label: string): number => {
  if (!text.trim()) throw new Error(`${label} requiere un valor.`);
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`${label} debe ser numérico y finito.`);
  return fromDisplay(value, project.settings.units, 'length');
};

const finiteNumber = (text: string, label: string): number => {
  if (!text.trim()) throw new Error(`${label} requiere un valor.`);
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`${label} debe ser numérico y finito.`);
  return value;
};

const displayLength = (project: ProjectModel, value: number) => displayNumber(toDisplay(value, project.settings.units, 'length'));

export const structuralEditCapabilities = (project: ProjectModel, selection: Selection) => {
  if (!selection || selection.kind === 'nodalLoad' || selection.kind === 'memberLoad') {
    return { structural: false, align: false, distribute: false };
  }
  try {
    resolveStructuralSelection(project, selection);
  } catch {
    return { structural: false, align: false, distribute: false };
  }
  const nodeOnlyCount = selection.kind === 'multi' && selection.memberIds.length === 0
    ? new Set(selection.nodeIds).size
    : 0;
  return {
    structural: true,
    align: nodeOnlyCount >= 2,
    distribute: nodeOnlyCount >= 3,
  };
};

export const structuralEditSelectionAnchor = (project: ProjectModel, selection: Selection): Point2D => {
  const resolved = resolveStructuralSelection(project, selection);
  const node = project.nodes.find((candidate) => candidate.id === resolved.nodeIds[0]);
  if (!node) throw new Error('La selección no tiene un punto de referencia válido.');
  return { x: node.x, y: node.y };
};

const selectionCenter = (project: ProjectModel, selection: Selection): Point2D => {
  const resolved = resolveStructuralSelection(project, selection);
  const selected = new Set(resolved.nodeIds);
  const nodes = project.nodes.filter((node) => selected.has(node.id));
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
};

export const createStructuralEditDraft = (
  project: ProjectModel,
  selection: Selection,
  kind: StructuralEditKind,
): StructuralEditDraft => {
  if (!structuralEditCapabilities(project, selection).structural) {
    throw new Error('La selección no admite edición estructural avanzada.');
  }
  const center = selectionCenter(project, selection);
  const spacing = Math.max(project.settings.gridSize || 1, 0.25);
  return {
    kind,
    selection: structuredClone(selection),
    sourceSnapshot: structuralEditSnapshot(project),
    fields: {
      deltaX: '0', deltaY: '0',
      centerX: displayLength(project, center.x), centerY: displayLength(project, center.y), angleDeg: '0',
      mirrorMode: 'transform', mirrorAxis: 'horizontal', axisCoordinate: displayLength(project, center.y),
      axisStartX: displayLength(project, center.x - 1), axisStartY: displayLength(project, center.y),
      axisEndX: displayLength(project, center.x + 1), axisEndY: displayLength(project, center.y),
      directionX: '1', directionY: '0', spacing: displayLength(project, spacing), count: '3',
      alignment: 'min-x', distributeAxis: 'x',
    },
  };
};

export const changeStructuralEditKind = (
  project: ProjectModel,
  current: StructuralEditDraft,
  kind: StructuralEditKind,
): StructuralEditDraft => {
  const next = createStructuralEditDraft(project, current.selection, kind);
  return { ...next, fields: { ...next.fields, mirrorMode: current.fields.mirrorMode } };
};

export const buildStructuralEditRequest = (
  project: ProjectModel,
  draft: StructuralEditDraft,
): StructuralEditRequest => {
  const selection = structuredClone(draft.selection);
  const fields = draft.fields;
  if (draft.kind === 'move') return {
    kind: 'move', selection,
    delta: {
      x: internalLength(project, fields.deltaX, 'ΔX'),
      y: internalLength(project, fields.deltaY, 'ΔY'),
    },
  };
  if (draft.kind === 'rotate') return {
    kind: 'rotate', selection,
    center: {
      x: internalLength(project, fields.centerX, 'Centro X'),
      y: internalLength(project, fields.centerY, 'Centro Y'),
    },
    angleDeg: finiteNumber(fields.angleDeg, 'El ángulo'),
  };
  if (draft.kind === 'mirror') {
    const axis = fields.mirrorAxis === 'horizontal'
      ? {
        start: { x: 0, y: internalLength(project, fields.axisCoordinate, 'La coordenada del eje') },
        end: { x: 1, y: internalLength(project, fields.axisCoordinate, 'La coordenada del eje') },
      }
      : fields.mirrorAxis === 'vertical'
        ? {
          start: { x: internalLength(project, fields.axisCoordinate, 'La coordenada del eje'), y: 0 },
          end: { x: internalLength(project, fields.axisCoordinate, 'La coordenada del eje'), y: 1 },
        }
        : {
          start: {
            x: internalLength(project, fields.axisStartX, 'Inicio X del eje'),
            y: internalLength(project, fields.axisStartY, 'Inicio Y del eje'),
          },
          end: {
            x: internalLength(project, fields.axisEndX, 'Final X del eje'),
            y: internalLength(project, fields.axisEndY, 'Final Y del eje'),
          },
        };
    return { kind: 'mirror', selection, mode: fields.mirrorMode, axis };
  }
  if (draft.kind === 'linear-array') return {
    kind: 'linear-array', selection,
    direction: {
      x: finiteNumber(fields.directionX, 'Dirección X'),
      y: finiteNumber(fields.directionY, 'Dirección Y'),
    },
    spacing: internalLength(project, fields.spacing, 'El espaciamiento'),
    count: finiteNumber(fields.count, 'La cantidad'),
  };
  if (draft.kind === 'align') return { kind: 'align', selection, alignment: fields.alignment };
  return { kind: 'distribute', selection, axis: fields.distributeAxis };
};

export const updateDraftFromPointer = (
  draft: StructuralEditDraft,
  project: ProjectModel,
  gesture: PointerEditGesture,
): StructuralEditDraft => {
  const fields = { ...draft.fields };
  const dx = gesture.current.x - gesture.start.x;
  const dy = gesture.current.y - gesture.start.y;
  if (draft.kind === 'move') {
    fields.deltaX = displayLength(project, dx);
    fields.deltaY = displayLength(project, dy);
  } else if (draft.kind === 'rotate') {
    const center = {
      x: internalLength(project, fields.centerX, 'Centro X'),
      y: internalLength(project, fields.centerY, 'Centro Y'),
    };
    const startVector = { x: gesture.start.x - center.x, y: gesture.start.y - center.y };
    const currentVector = { x: gesture.current.x - center.x, y: gesture.current.y - center.y };
    if (Math.hypot(startVector.x, startVector.y) <= 1e-12 || Math.hypot(currentVector.x, currentVector.y) <= 1e-12) {
      throw new Error('El gesto de rotación debe estar separado del centro.');
    }
    // atan2(cross, dot) produces the shortest signed angular difference in
    // [-π, π]. A simple subtraction of two atan2 angles jumps by 360° when a
    // gesture crosses the negative-X branch cut, while this draft has no
    // incremental gesture history with which to represent a deliberate full turn.
    const angularDelta = Math.atan2(
      startVector.x * currentVector.y - startVector.y * currentVector.x,
      startVector.x * currentVector.x + startVector.y * currentVector.y,
    );
    fields.angleDeg = displayNumber(angularDelta * 180 / Math.PI);
  } else if (draft.kind === 'mirror') {
    if (draft.fields.mirrorAxis === 'horizontal') fields.axisCoordinate = displayLength(project, gesture.current.y);
    else if (draft.fields.mirrorAxis === 'vertical') fields.axisCoordinate = displayLength(project, gesture.current.x);
    else {
      fields.axisStartX = displayLength(project, gesture.start.x);
      fields.axisStartY = displayLength(project, gesture.start.y);
      fields.axisEndX = displayLength(project, gesture.current.x);
      fields.axisEndY = displayLength(project, gesture.current.y);
    }
  } else if (draft.kind === 'linear-array') {
    const spacing = Math.hypot(dx, dy);
    if (!(spacing > 1e-12)) throw new Error('El vector de la matriz debe tener longitud positiva.');
    fields.directionX = displayNumber(dx / spacing);
    fields.directionY = displayNumber(dy / spacing);
    fields.spacing = displayLength(project, spacing);
  }
  return { ...draft, fields };
};
