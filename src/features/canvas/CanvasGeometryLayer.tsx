import { memo, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { MemberLoad, MemberModel, NodeModel, ProjectModel, Selection } from '../../types';
import type { CanvasSelectionVisualState } from './selectionVisuals';
import type { EditorLayerState } from './editorLayers';
import type { ResultTab } from '../../store/ProjectContext';
import { toDisplay, unitLabel } from '../../engine/units';
import {
  distributedIntensityAt,
  grossRatioFromFlexible,
  memberAxis,
  pointAtGrossRatio,
  toGlobalVector,
} from '../../graphics/structureGeometry';
import { formatFixed } from '../../utils/numberFormat';
import type { TranslationKey } from '../../i18n/catalogs';

export type StructuralTarget =
  | { kind: 'background' }
  | { kind: 'node'; id: string }
  | { kind: 'member'; id: string }
  | { kind: 'nodalLoad'; id: string }
  | { kind: 'memberLoad'; id: string };

type Units = ProjectModel['settings']['units'];
type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

const arrowPath = (x1: number, y1: number, x2: number, y2: number) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#arrow-purple)" />
);

/** Presentation-only geometry: nodes, members, supports and loads. Selection/edit intents flow out via callback props. */
export interface CanvasGeometryLayerProps {
  /** `members` paints under the result annotations; `objects` (supports/loads/nodes) paints over them. */
  slot: 'members' | 'objects';
  project: ProjectModel;
  nodeMap: Map<string, NodeModel>;
  memberMap: Map<string, MemberModel>;
  toScreen: (x: number, y: number) => { x: number; y: number };
  camera: { scale: number };
  selectionVisualState: CanvasSelectionVisualState;
  learningFocus: { nodeIds: string[]; memberIds: string[] } | null;
  memberStartId: string | null;
  layers: EditorLayerState;
  loadsLayerVisible: boolean;
  resultTab: ResultTab;
  units: Units;
  forceLabel: string;
  momentLabel: string;
  distributedLabel: string;
  t: Translate;
  /** P6: demand ratio η per member id [0..∞]. Used when layers.heatmap is true. */
  heatmapRatios?: Map<string, number>;
  onObjectPointerDown: (event: ReactPointerEvent, target: StructuralTarget) => void;
  onSelect: (target: Selection) => void;
  onLoadKeyDown: (event: ReactKeyboardEvent<SVGGElement>, target: Selection) => void;
  onShowCut: (event: ReactPointerEvent, member: MemberModel) => void;
  onCutLeave: () => void;
}

const CanvasGeometryLayerImpl = ({
  slot, project, nodeMap, memberMap, toScreen, camera, selectionVisualState, learningFocus, memberStartId,
  layers, loadsLayerVisible, resultTab, units, forceLabel, momentLabel, distributedLabel, t,
  heatmapRatios,
  onObjectPointerDown, onSelect, onLoadKeyDown, onShowCut, onCutLeave,
}: CanvasGeometryLayerProps) => {
  const selectedNodeIds = selectionVisualState.nodeIds;
  const selectedMemberIds = selectionVisualState.memberIds;

  /** P6: computes heatmap stroke color for a demand ratio η. */
  const heatmapColor = (ratio: number): string => {
    if (ratio >= 1.0) return 'var(--sc-heatmap-critical, #ef4444)';
    if (ratio >= 0.85) return 'var(--sc-heatmap-warning, #f97316)';
    if (ratio >= 0.6) return 'var(--sc-heatmap-moderate, #f59e0b)';
    if (ratio >= 0.3) return 'var(--sc-heatmap-low, #84cc16)';
    return 'var(--sc-heatmap-safe, #22c55e)';
  };

  const renderSupport = (node: NodeModel) => {
    if (node.support.type === 'none') return null;
    const p = toScreen(node.x, node.y);
    const selected = selectedNodeIds.includes(node.id);

    if (node.support.type === 'fixed') {
      const rotation = node.support.angleDeg ?? 0;
      return (
        <g key={node.id} className={`support-symbol support-fixed${selected ? ' selected' : ''}`} transform={`translate(${p.x} ${p.y}) rotate(${rotation})`} data-support-id={node.id}>
          {selected ? <rect className="support-selection-frame" x="-22" y="-4" width="44" height="22" rx="6" /> : null}
          <line x1="-18" y1="7" x2="18" y2="7" className="support-baseplate" strokeWidth="2.4" strokeLinecap="round" />
          {[-14, -8, -2, 4, 10, 16].map((x) => <line key={x} x1={x} y1="7" x2={x - 5} y2="14" strokeWidth="1.4" strokeLinecap="round" />)}
          <line x1="0" y1="0" x2="0" y2="7" strokeWidth="2" />
          <circle cx="0" cy="0" r="2.2" className="support-pin-dot" />
        </g>
      );
    }

    if (node.support.type === 'pin') {
      const rotation = node.support.angleDeg ?? 0;
      return (
        <g key={node.id} className={`support-symbol support-pin${selected ? ' selected' : ''}`} transform={`translate(${p.x} ${p.y}) rotate(${rotation})`} data-support-id={node.id}>
          {selected ? <rect className="support-selection-frame" x="-20" y="-4" width="40" height="32" rx="7" /> : null}
          <polygon points="0,0 -12,18 12,18" className="support-body-fill" strokeWidth="1.8" strokeLinejoin="round" />
          <line x1="-16" y1="18" x2="16" y2="18" className="support-baseplate" strokeWidth="2" strokeLinecap="round" />
          {[-12, -6, 0, 6, 12].map((x) => <line key={x} x1={x} y1="18" x2={x - 5} y2="24" strokeWidth="1.4" strokeLinecap="round" />)}
          <circle cx="0" cy="0" r="2.4" className="support-pin-dot" />
        </g>
      );
    }

    if (node.support.type === 'roller') {
      const rotation = (node.support.angleDeg ?? 90) - 90;
      return (
        <g key={node.id} className={`support-symbol support-roller${selected ? ' selected' : ''}`} transform={`translate(${p.x} ${p.y}) rotate(${rotation})`} data-support-id={node.id}>
          {selected ? <rect className="support-selection-frame" x="-21" y="-4" width="42" height="35" rx="7" /> : null}
          <polygon points="0,0 -11,15 11,15" className="support-body-fill" strokeWidth="1.8" strokeLinejoin="round" />
          <line x1="-13" y1="15" x2="13" y2="15" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="-5.5" cy="18.5" r="2.8" className="support-roller-wheel" strokeWidth="1.5" />
          <circle cx="5.5" cy="18.5" r="2.8" className="support-roller-wheel" strokeWidth="1.5" />
          <line x1="-17" y1="21.5" x2="17" y2="21.5" className="support-baseplate" strokeWidth="2" strokeLinecap="round" />
          {[-12, -6, 0, 6, 12].map((x) => <line key={x} x1={x} y1="21.5" x2={x - 5} y2="26.5" strokeWidth="1.4" strokeLinecap="round" />)}
          <circle cx="0" cy="0" r="2.4" className="support-pin-dot" />
        </g>
      );
    }

    if (node.support.type === 'custom') {
      const rotation = node.support.angleDeg ?? 0;
      const hasSpring = Boolean(
        node.support.spring && (node.support.spring.kx || node.support.spring.ky || node.support.spring.kr || node.support.spring.kNormal),
      );
      return (
        <g key={node.id} className={`support-symbol support-custom${selected ? ' selected' : ''}`} transform={`translate(${p.x} ${p.y}) rotate(${rotation})`} data-support-id={node.id}>
          {selected ? <rect className="support-selection-frame" x="-22" y="-6" width="44" height="38" rx="7" /> : null}
          {hasSpring ? (
            <>
              {node.support.spring?.kr ? (
                <path d="M -8 -2 A 8 8 0 1 1 8 -2" fill="none" strokeWidth="1.8" strokeDasharray="3 2" className="support-spring-arc" />
              ) : null}
              <path d="M 0 0 L 0 4 L -5 7 L 5 11 L -5 15 L 5 19 L 0 22 L 0 25" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="support-spring-coil" />
              <line x1="-15" y1="25" x2="15" y2="25" className="support-baseplate" strokeWidth="2" strokeLinecap="round" />
              {[-10, -4, 2, 8].map((x) => <line key={x} x1={x} y1="25" x2={x - 4} y2="30" strokeWidth="1.4" strokeLinecap="round" />)}
            </>
          ) : (
            <>
              <line x1="-16" y1="-8" x2="16" y2="-8" strokeWidth="1.8" strokeDasharray="3 2" />
              <line x1="-16" y1="8" x2="16" y2="8" strokeWidth="1.8" strokeDasharray="3 2" />
              <rect x="-10" y="-5" width="20" height="10" rx="3" className="support-body-fill" strokeWidth="1.8" />
            </>
          )}
          <circle cx="0" cy="0" r="2.4" className="support-pin-dot" />
        </g>
      );
    }

    return null;
  };

  const renderNodalLoad = (load: ProjectModel['nodalLoads'][number]) => {
    const node = nodeMap.get(load.nodeId);
    if (!node) return null;
    const p = toScreen(node.x, node.y);
    const magnitude = Math.hypot(load.fx, load.fy);
    const selected = selectionVisualState.nodalLoadId === load.id;
    if (magnitude > 1e-9) {
      const ux = load.fx / magnitude; const uy = -load.fy / magnitude;
      const length = 54;
      const start = { x: p.x - ux * length, y: p.y - uy * length };
      const end = { x: p.x - ux * 8, y: p.y - uy * 8 };
      return (
        <g key={load.id} className={`load-symbol${selected ? ' selected' : ''}`} data-structure-object data-structure-kind="nodalLoad" data-structure-id={load.id} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.pointLoadAria', { id: load.id, target: load.nodeId, value: formatFixed(toDisplay(magnitude, units, 'force'), 2), unit: forceLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'nodalLoad', id: load.id })} onKeyDown={(event) => onLoadKeyDown(event, { kind: 'nodalLoad', id: load.id })}>
          {selected ? <line className="load-selection-halo" x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null}
          <line className="load-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
          {arrowPath(start.x, start.y, end.x, end.y)}
        </g>
      );
    }
    if (Math.abs(load.mz) > 1e-9) {
      const momentPath = `M ${p.x - 20} ${p.y - 8} A 22 22 0 1 1 ${p.x + 17} ${p.y - 14}`;
      return <g key={load.id} className={`load-symbol${selected ? ' selected' : ''}`} data-structure-object data-structure-kind="nodalLoad" data-structure-id={load.id} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.momentLoadAria', { id: load.id, target: load.nodeId, value: formatFixed(toDisplay(load.mz, units, 'moment'), 2), unit: momentLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'nodalLoad', id: load.id })} onKeyDown={(event) => onLoadKeyDown(event, { kind: 'nodalLoad', id: load.id })}>
        {selected ? <path className="load-selection-halo" d={momentPath} /> : null}
        <path className="load-hit" d={momentPath} />
        <path d={momentPath} fill="none" markerEnd="url(#arrow-purple)" />
      </g>;
    }
    return null;
  };

  const renderMemberLoad = (load: MemberLoad) => {
    const target = memberMap.get(load.memberId);
    if (!target) return null;
    const ni = nodeMap.get(target.i)!; const nj = nodeMap.get(target.j)!;
    const axis = memberAxis(target, ni, nj);
    const stationOf = (flexibleRatio: number) => {
      const point = pointAtGrossRatio(axis, grossRatioFromFlexible(axis, flexibleRatio));
      return toScreen(point.x, point.y);
    };
    const selected = selectionVisualState.memberLoadId === load.id;
    if (load.type === 'point') {
      const base = stationOf(load.position ?? 0.5);
      const px = load.px ?? 0; const py = load.py ?? 0; const mag = Math.hypot(px, py) || 1;
      const [gx, gy] = toGlobalVector(axis, load.coordinateSystem, px, py);
      const ux = gx / mag; const uy = -gy / mag;
      const start = { x: base.x - ux * 52, y: base.y - uy * 52 };
      const end = { x: base.x - ux * 7, y: base.y - uy * 7 };
      return <g key={load.id} className={`load-symbol${selected ? ' selected' : ''}`} data-structure-object data-structure-kind="memberLoad" data-structure-id={load.id} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.pointLoadAria', { id: load.id, target: load.memberId, value: formatFixed(toDisplay(mag, units, 'force'), 2), unit: forceLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'memberLoad', id: load.id })} onKeyDown={(event) => onLoadKeyDown(event, { kind: 'memberLoad', id: load.id })}>{selected ? <line className="load-selection-halo" x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null}<line className="load-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />{arrowPath(start.x, start.y, end.x, end.y)}</g>;
    }
    if (load.type === 'moment') {
      const base = stationOf(load.position ?? 0.5);
      const clockwise = (load.moment ?? 0) < 0;
      const path = clockwise
        ? `M ${base.x - 22} ${base.y - 3} A 23 23 0 1 0 ${base.x + 18} ${base.y - 13}`
        : `M ${base.x + 22} ${base.y - 3} A 23 23 0 1 1 ${base.x - 18} ${base.y - 13}`;
      return <g key={load.id} className={`load-symbol${selected ? ' selected' : ''}`} data-structure-object data-structure-kind="memberLoad" data-structure-id={load.id} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.momentLoadAria', { id: load.id, target: load.memberId, value: formatFixed(toDisplay(load.moment ?? 0, units, 'moment'), 2), unit: momentLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'memberLoad', id: load.id })} onKeyDown={(event) => onLoadKeyDown(event, { kind: 'memberLoad', id: load.id })}>{selected ? <path className="load-selection-halo" d={path} /> : null}<path className="load-hit" d={path} /><path d={path} markerEnd="url(#arrow-purple)" /></g>;
    }
    const visibleLoadedLength = axis.length * camera.scale * Math.abs(load.end - load.start);
    const count = Math.max(3, Math.min(9, Math.round(visibleLoadedLength / 34) + 1));
    const arrows = [];
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      const base = stationOf(load.start + (load.end - load.start) * t);
      const { qx, qy } = distributedIntensityAt(load, t);
      const [gx, gy] = toGlobalVector(axis, load.coordinateSystem, qx, qy);
      const mag = Math.hypot(gx, gy) || 1; const ux = gx / mag; const uy = -gy / mag;
      const length = 33 + 12 * (mag / Math.max(Math.abs(load.qyStart ?? 0), Math.abs(load.qyEnd ?? 0), Math.abs(load.qxStart ?? 0), Math.abs(load.qxEnd ?? 0), 1));
      arrows.push(<line key={i} x1={base.x - ux * length} y1={base.y - uy * length} x2={base.x - ux * 5} y2={base.y - uy * 5} markerEnd="url(#arrow-green)" />);
    }
    const qStartMagnitude = Math.hypot(load.qxStart ?? 0, load.qyStart ?? 0);
    const qEndMagnitude = Math.hypot(load.qxEnd ?? load.qxStart ?? 0, load.qyEnd ?? load.qyStart ?? 0);
    const average = (qStartMagnitude + qEndMagnitude) / 2;
    const hitStart = stationOf(load.start);
    const hitEnd = stationOf(load.end);
    return <g key={load.id} className={`distributed-symbol${selected ? ' selected' : ''}`} data-structure-object data-structure-kind="memberLoad" data-structure-id={load.id} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.distributedLoadAria', { id: load.id, target: load.memberId, value: formatFixed(toDisplay(average, units, 'distributedForce'), 2), unit: distributedLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'memberLoad', id: load.id })} onKeyDown={(event) => onLoadKeyDown(event, { kind: 'memberLoad', id: load.id })}>{selected ? <line className="load-selection-halo" x1={hitStart.x} y1={hitStart.y} x2={hitEnd.x} y2={hitEnd.y} /> : null}<line className="load-hit" x1={hitStart.x} y1={hitStart.y} x2={hitEnd.x} y2={hitEnd.y} />{arrows}</g>;
  };

  if (slot === 'members') {
    return (
      <g className="member-layer">
        {project.members.map((member) => {
          const ni = nodeMap.get(member.i); const nj = nodeMap.get(member.j); if (!ni || !nj) return null;
          const a = toScreen(ni.x, ni.y); const b = toScreen(nj.x, nj.y);
          const selected = selectedMemberIds.includes(member.id);
          const learningHighlighted = learningFocus?.memberIds.includes(member.id) ?? false;
          return (
            <g
              key={member.id}
              data-structure-object
              data-structure-kind="member"
              data-structure-id={member.id}
              className={`member-object ${selected ? 'selected' : ''} ${learningHighlighted ? 'learning-highlight' : ''} ${member.type}`}
              role="button"
              tabIndex={0}
              aria-keyshortcuts="Enter Space"
              aria-label={t('canvas.memberAria', { id: member.id, i: member.i, j: member.j })}
              aria-pressed={selected}
              onPointerDown={(event) => onObjectPointerDown(event, { kind: 'member', id: member.id })}
              onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect({ kind: 'member', id: member.id });
                }
              }}
              onPointerMove={(event) => onShowCut(event, member)}
              onPointerLeave={onCutLeave}
            >
              {selected ? <line className="member-selection-halo" x1={a.x} y1={a.y} x2={b.x} y2={b.y} /> : null}
              <line className="member-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <line
                className="member-line"
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                {...(layers.heatmap && heatmapRatios ? (() => {
                  const ratio = heatmapRatios.get(member.id) ?? 0;
                  return { stroke: heatmapColor(ratio), strokeWidth: selected ? 5 : 3.5 };
                })() : {})}
              />
              {member.type === 'frame' && ((member.rigidOffsetI ?? 0) > 0 || (member.rigidOffsetJ ?? 0) > 0) ? (() => {
                const length = Math.hypot(nj.x - ni.x, nj.y - ni.y);
                const ti = length > 0 ? (member.rigidOffsetI ?? 0) / length : 0;
                const tj = length > 0 ? (member.rigidOffsetJ ?? 0) / length : 0;
                const faceI = toScreen(ni.x + (nj.x - ni.x) * ti, ni.y + (nj.y - ni.y) * ti);
                const faceJ = toScreen(nj.x - (nj.x - ni.x) * tj, nj.y - (nj.y - ni.y) * tj);
                return <g className="rigid-zone-layer"><line x1={a.x} y1={a.y} x2={faceI.x} y2={faceI.y} /><line x1={faceJ.x} y1={faceJ.y} x2={b.x} y2={b.y} /><circle cx={faceI.x} cy={faceI.y} r="3" /><circle cx={faceJ.x} cy={faceJ.y} r="3" /></g>;
              })() : null}
              {layers.dimensions || selected ? (() => {
                const length = Math.hypot(nj.x - ni.x, nj.y - ni.y);
                const displayLength = formatFixed(toDisplay(length, units, 'length'), 2);
                const unit = unitLabel(units, 'length');
                const dx = nj.x - ni.x;
                const dy = nj.y - ni.y;
                const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 180;
                
                // Normal perpendicular en pantalla
                const screenDx = b.x - a.x;
                const screenDy = b.y - a.y;
                const screenLen = Math.max(1, Math.hypot(screenDx, screenDy));
                const nx = -screenDy / screenLen;
                const ny = screenDx / screenLen;
                
                // Offset de la cota según el ángulo
                const offsetDist = selected ? 32 : 24;
                const p1 = { x: a.x + nx * offsetDist, y: a.y + ny * offsetDist };
                const p2 = { x: b.x + nx * offsetDist, y: b.y + ny * offsetDist };
                const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                
                // Extensiones nodales
                const ext1Start = { x: a.x + nx * 4, y: a.y + ny * 4 };
                const ext1End = { x: a.x + nx * (offsetDist + 6), y: a.y + ny * (offsetDist + 6) };
                const ext2Start = { x: b.x + nx * 4, y: b.y + ny * 4 };
                const ext2End = { x: b.x + nx * (offsetDist + 6), y: b.y + ny * (offsetDist + 6) };
                
                // Ticks a 45° tipo CAD
                const tickLen = 5;
                const tickUx = (screenDx - screenDy) / (screenLen * Math.SQRT2);
                const tickUy = (screenDy + screenDx) / (screenLen * Math.SQRT2);

                return (
                  <g className={`cad-dimension-overlay${selected ? ' is-selected' : ''}`} pointerEvents="none">
                    {/* Líneas de extensión */}
                    <line className="cad-dim-extension" x1={ext1Start.x} y1={ext1Start.y} x2={ext1End.x} y2={ext1End.y} />
                    <line className="cad-dim-extension" x1={ext2Start.x} y1={ext2Start.y} x2={ext2End.x} y2={ext2End.y} />
                    {/* Línea de cota principal */}
                    <line className="cad-dim-line" x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
                    {/* Ticks oblicuos CAD 45° */}
                    <line className="cad-dim-tick" x1={p1.x - tickUx * tickLen} y1={p1.y - tickUy * tickLen} x2={p1.x + tickUx * tickLen} y2={p1.y + tickUy * tickLen} />
                    <line className="cad-dim-tick" x1={p2.x - tickUx * tickLen} y1={p2.y - tickUy * tickLen} x2={p2.x + tickUx * tickLen} y2={p2.y + tickUy * tickLen} />
                    {/* Píldora numérica de cota */}
                    <g transform={`translate(${mid.x} ${mid.y})`}>
                      <rect className="cad-dim-badge-bg" x="-32" y="-10" width="64" height="20" rx="6" />
                      <text className="cad-dim-badge-text" x="0" y="3.5" textAnchor="middle">
                        {displayLength} {unit}
                      </text>
                    </g>
                    {/* Detalle secundario en barra seleccionada */}
                    {selected && (
                      <g transform={`translate(${mid.x} ${mid.y + 16})`}>
                        <rect className="cad-dim-subbadge-bg" x="-42" y="-7" width="84" height="14" rx="4" />
                        <text className="cad-dim-subbadge-text" x="0" y="3" textAnchor="middle">
                          θ={formatFixed(angleDeg, 1)}° · Δx={formatFixed(toDisplay(Math.abs(dx), units, 'length'), 2)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })() : null}
              {layers.dimensions && project.settings.showLocalAxes ? (() => {
                const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
                const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
                const ux = (b.x - a.x) / length; const uy = (b.y - a.y) / length;
                const vx = uy; const vy = -ux;
                return <g className="local-axes"><line x1={mx} y1={my} x2={mx + ux * 34} y2={my + uy * 34} /><line x1={mx} y1={my} x2={mx + vx * 27} y2={my + vy * 27} /><text x={mx + ux * 41} y={my + uy * 41}>x</text><text x={mx + vx * 34} y={my + vy * 34}>y</text></g>;
              })() : null}
            </g>
          );
        })}
      </g>
    );
  }

  return <>
    <g className="support-layer">{project.nodes.map(renderSupport)}</g>
    {loadsLayerVisible && project.settings.showLoads && resultTab !== 'influence' ? <g className="load-layer">{project.memberLoads.map(renderMemberLoad)}{project.nodalLoads.map(renderNodalLoad)}</g> : null}
    <g className="node-layer">
      {project.nodes.map((node) => {
        const p = toScreen(node.x, node.y);
        const selected = selectedNodeIds.includes(node.id);
        const start = memberStartId === node.id;
        const learningHighlighted = learningFocus?.nodeIds.includes(node.id) ?? false;
        return (
          <g
            key={node.id}
            className={`node-object ${selected ? 'selected' : ''} ${start ? 'member-start' : ''} ${learningHighlighted ? 'learning-highlight' : ''}`}
            data-structure-object
            data-structure-kind="node"
            data-structure-id={node.id}
            role="button"
            tabIndex={0}
            aria-keyshortcuts="Enter Space"
            aria-label={t('canvas.nodeAria', { id: node.id, x: formatFixed(node.x, 3), y: formatFixed(node.y, 3) })}
            aria-pressed={selected}
            onPointerDown={(event) => onObjectPointerDown(event, { kind: 'node', id: node.id })}
            onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect({ kind: 'node', id: node.id });
              }
            }}
          >
            {selected ? <><circle className="node-selection-halo" cx={p.x} cy={p.y} r="14" /><path className="node-selection-cross" d={`M ${p.x - 18} ${p.y} H ${p.x + 18} M ${p.x} ${p.y - 18} V ${p.y + 18}`} /></> : null}
            <circle className="node-hit" cx={p.x} cy={p.y} r="20" />
            <circle className="node-dot" cx={p.x} cy={p.y} r="7" />
            {node.internalHinge ? <circle className="internal-hinge-symbol" cx={p.x} cy={p.y} r="11" /> : null}
          </g>
        );
      })}
    </g>
  </>;
};

export const CanvasGeometryLayer = memo(CanvasGeometryLayerImpl);
