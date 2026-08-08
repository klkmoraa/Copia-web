import { memo } from 'react';
import type { NodeModel, ProjectModel } from '../../types';
import type { SelectionEnvelope } from './selectionVisuals';
import { selectionEnvelopeHandles } from './selectionVisuals';
import type { SnapKind } from '../../utils/snapping';
import { toDisplay } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
import type { TranslationKey } from '../../i18n/catalogs';

type Units = ProjectModel['settings']['units'];
type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

export interface CanvasMarqueeBox {
  start: { x: number; y: number };
  current: { x: number; y: number };
}

const snapLabelKeys: Record<SnapKind, TranslationKey> = {
  node: 'canvas.snapNode',
  midpoint: 'canvas.snapMidpoint',
  intersection: 'canvas.snapIntersection',
  perpendicular: 'canvas.snapPerpendicular',
  target: 'canvas.snapTarget',
  grid: 'canvas.snapGrid',
};

/** Presentation-only, ephemeral interaction feedback: snap glyph, marquee box, member draft, multi-selection badge. */
export interface CanvasInteractionLayerProps {
  /** `preview` paints under the geometry (snap/marquee/draft); `overlay` paints over it (multi-selection badge). */
  slot: 'preview' | 'overlay';
  snapPreview: { x: number; y: number; kind: SnapKind } | null;
  selectionBox: CanvasMarqueeBox | null;
  memberStartId: string | null;
  nodeMap: Map<string, NodeModel>;
  toScreen: (x: number, y: number) => { x: number; y: number };
  units: Units;
  lengthLabel: string;
  multiSelectionEnvelope: SelectionEnvelope | null;
  selectionCount: number;
  size: { width: number; height: number };
  t: Translate;
}

const CanvasInteractionLayerImpl = ({
  slot, snapPreview, selectionBox, memberStartId, nodeMap, toScreen, units, lengthLabel,
  multiSelectionEnvelope, selectionCount, size, t,
}: CanvasInteractionLayerProps) => {
  if (slot === 'preview') {
    return <>
      {snapPreview ? (() => {
        const point = toScreen(snapPreview.x, snapPreview.y);
        const label = t(snapLabelKeys[snapPreview.kind]);
        return <g className={`snap-glyph ${snapPreview.kind}`} transform={`translate(${point.x} ${point.y})`} pointerEvents="none"><circle r="8" /><path d="M-12 0H12M0-12V12" /><text x="12" y="-11">{label}</text></g>;
      })() : null}
      {selectionBox ? (() => {
        const start = toScreen(selectionBox.start.x, selectionBox.start.y);
        const current = toScreen(selectionBox.current.x, selectionBox.current.y);
        const crossing = selectionBox.current.x < selectionBox.start.x;
        const x = Math.min(start.x, current.x);
        const y = Math.min(start.y, current.y);
        return <g className={`selection-marquee-group ${crossing ? 'crossing' : 'window'}`}><rect className="selection-marquee" x={x} y={y} width={Math.abs(current.x - start.x)} height={Math.abs(current.y - start.y)} /><g className="selection-marquee-label" transform={`translate(${x + 8} ${y + 8})`}><rect width={crossing ? 54 : 58} height="20" rx="6" /><text x="7" y="14">{t(crossing ? 'canvas.crossingSelection' : 'canvas.windowSelection')}</text></g></g>;
      })() : null}
      {memberStartId && snapPreview ? (() => {
        const startNode = nodeMap.get(memberStartId);
        if (!startNode) return null;
        const start = toScreen(startNode.x, startNode.y);
        const end = toScreen(snapPreview.x, snapPreview.y);
        return <g className="member-preview" pointerEvents="none"><line x1={start.x} y1={start.y} x2={end.x} y2={end.y} /><text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 10}>{formatFixed(toDisplay(Math.hypot(snapPreview.x - startNode.x, snapPreview.y - startNode.y), units, 'length'), 3)} {lengthLabel}</text></g>;
      })() : null}
    </>;
  }

  if (!multiSelectionEnvelope) return null;
  return (
    <g className="multi-selection-envelope" data-multi-selection-envelope data-selection-count={selectionCount} aria-hidden="true">
      <rect className="multi-selection-frame" x={multiSelectionEnvelope.x} y={multiSelectionEnvelope.y} width={multiSelectionEnvelope.width} height={multiSelectionEnvelope.height} rx="8" />
      {selectionEnvelopeHandles(multiSelectionEnvelope).map((handle, index) => <rect key={index} className="multi-selection-handle" x={handle.x - 4} y={handle.y - 4} width="8" height="8" rx="2" />)}
      <g className="multi-selection-badge" transform={`translate(${Math.min(Math.max(8, multiSelectionEnvelope.x + 8), Math.max(8, size.width - 142))} ${multiSelectionEnvelope.y >= 34 ? multiSelectionEnvelope.y - 28 : multiSelectionEnvelope.y + 8})`}>
        <rect width="134" height="22" rx="7" />
        <text x="9" y="15">{t('inspector.selectedCount', { count: selectionCount })}</text>
      </g>
    </g>
  );
};

export const CanvasInteractionLayer = memo(CanvasInteractionLayerImpl);
