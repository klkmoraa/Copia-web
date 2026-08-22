import { memo, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { MemberLoad, MemberModel, NodeModel, ProjectModel } from '../../types';
import type { CanvasSelectionVisualState } from './selectionVisuals';
import type { EditorLayerState } from './editorLayers';
import type { ResultTab } from '../../store/ProjectContext';
import { toDisplay } from '../../engine/units';
import {
  distributedIntensityAt,
  grossRatioFromFlexible,
  memberAxis,
  pointAtGrossRatio,
  toGlobalVector,
} from '../../graphics/structureGeometry';
import { formatFixed } from '../../utils/numberFormat';
import { elasticIndexPaint } from '../results/elasticDemand';
import type { TranslationKey } from '../../i18n/catalogs';
import type { CandidateTarget } from './candidatePicker';
import { readCanvasViewSettings } from '../view/canvasViewSettings';

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
  candidatePreview: CandidateTarget | null;
  learningFocus: { nodeIds: string[]; memberIds: string[] } | null;
  memberStartId: string | null;
  layers: EditorLayerState;
  loadsLayerVisible: boolean;
  /**
   * η por barra cuando la capa `heatmap` está activa. Vacío significa "sin mapa
   * de calor": la barra conserva su color de dibujo técnico.
   */
  heatmapRatios: ReadonlyMap<string, number>;
  /** `true` mientras la capa está encendida: es lo que hace visible «no evaluado». */
  demandMapActive: boolean;
  resultTab: ResultTab;
  units: Units;
  forceLabel: string;
  momentLabel: string;
  distributedLabel: string;
  t: Translate;
  onObjectPointerDown: (event: ReactPointerEvent, target: StructuralTarget) => void;
  onObjectKeyDown: (event: ReactKeyboardEvent<SVGGElement>, target: Exclude<StructuralTarget, { kind: 'background' }>) => void;
  onShowCut: (event: ReactPointerEvent, member: MemberModel) => void;
  onCutLeave: () => void;
}

const CanvasGeometryLayerImpl = ({
  slot, project, nodeMap, memberMap, toScreen, camera, selectionVisualState, candidatePreview, learningFocus, memberStartId,
  layers, loadsLayerVisible, heatmapRatios, demandMapActive, resultTab, units, forceLabel, momentLabel, distributedLabel, t,
  onObjectPointerDown, onObjectKeyDown, onShowCut, onCutLeave,
}: CanvasGeometryLayerProps) => {
  const view = readCanvasViewSettings(project);
  const selectedNodeIds = selectionVisualState.nodeIds;
  const selectedMemberIds = selectionVisualState.memberIds;

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
    const previewed = candidatePreview?.kind === 'nodalLoad' && candidatePreview.id === load.id;
    if (magnitude > 1e-9) {
      const ux = load.fx / magnitude; const uy = -load.fy / magnitude;
      const length = 54;
      const start = { x: p.x - ux * length, y: p.y - uy * length };
      const end = { x: p.x - ux * 8, y: p.y - uy * 8 };
      return (
        <g key={load.id} className={`load-symbol${selected ? ' selected' : ''}${previewed ? ' candidate-preview' : ''}`} data-structure-object data-structure-kind="nodalLoad" data-structure-id={load.id} data-candidate-preview={previewed ? 'true' : undefined} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.pointLoadAria', { id: load.id, target: load.nodeId, value: formatFixed(toDisplay(magnitude, units, 'force'), 2), unit: forceLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'nodalLoad', id: load.id })} onKeyDown={(event) => onObjectKeyDown(event, { kind: 'nodalLoad', id: load.id })}>
          {selected ? <line className="load-selection-halo" x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null}
          {previewed ? <line className="candidate-preview-halo" x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null}
          <line className="load-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
          {arrowPath(start.x, start.y, end.x, end.y)}
        </g>
      );
    }
    if (Math.abs(load.mz) > 1e-9) {
      const momentPath = `M ${p.x - 20} ${p.y - 8} A 22 22 0 1 1 ${p.x + 17} ${p.y - 14}`;
      return <g key={load.id} className={`load-symbol${selected ? ' selected' : ''}${previewed ? ' candidate-preview' : ''}`} data-structure-object data-structure-kind="nodalLoad" data-structure-id={load.id} data-candidate-preview={previewed ? 'true' : undefined} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.momentLoadAria', { id: load.id, target: load.nodeId, value: formatFixed(toDisplay(load.mz, units, 'moment'), 2), unit: momentLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'nodalLoad', id: load.id })} onKeyDown={(event) => onObjectKeyDown(event, { kind: 'nodalLoad', id: load.id })}>
        {selected ? <path className="load-selection-halo" d={momentPath} /> : null}
        {previewed ? <path className="candidate-preview-halo" d={momentPath} /> : null}
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
    const previewed = candidatePreview?.kind === 'memberLoad' && candidatePreview.id === load.id;
    if (load.type === 'point') {
      const base = stationOf(load.position ?? 0.5);
      const px = load.px ?? 0; const py = load.py ?? 0; const mag = Math.hypot(px, py) || 1;
      const [gx, gy] = toGlobalVector(axis, load.coordinateSystem, px, py);
      const ux = gx / mag; const uy = -gy / mag;
      const start = { x: base.x - ux * 52, y: base.y - uy * 52 };
      const end = { x: base.x - ux * 7, y: base.y - uy * 7 };
      return <g key={load.id} className={`load-symbol${selected ? ' selected' : ''}${previewed ? ' candidate-preview' : ''}`} data-structure-object data-structure-kind="memberLoad" data-structure-id={load.id} data-candidate-preview={previewed ? 'true' : undefined} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.pointLoadAria', { id: load.id, target: load.memberId, value: formatFixed(toDisplay(mag, units, 'force'), 2), unit: forceLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'memberLoad', id: load.id })} onKeyDown={(event) => onObjectKeyDown(event, { kind: 'memberLoad', id: load.id })}>{selected ? <line className="load-selection-halo" x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null}{previewed ? <line className="candidate-preview-halo" x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null}<line className="load-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />{arrowPath(start.x, start.y, end.x, end.y)}</g>;
    }
    if (load.type === 'moment') {
      const base = stationOf(load.position ?? 0.5);
      const clockwise = (load.moment ?? 0) < 0;
      const path = clockwise
        ? `M ${base.x - 22} ${base.y - 3} A 23 23 0 1 0 ${base.x + 18} ${base.y - 13}`
        : `M ${base.x + 22} ${base.y - 3} A 23 23 0 1 1 ${base.x - 18} ${base.y - 13}`;
      return <g key={load.id} className={`load-symbol${selected ? ' selected' : ''}${previewed ? ' candidate-preview' : ''}`} data-structure-object data-structure-kind="memberLoad" data-structure-id={load.id} data-candidate-preview={previewed ? 'true' : undefined} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.momentLoadAria', { id: load.id, target: load.memberId, value: formatFixed(toDisplay(load.moment ?? 0, units, 'moment'), 2), unit: momentLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'memberLoad', id: load.id })} onKeyDown={(event) => onObjectKeyDown(event, { kind: 'memberLoad', id: load.id })}>{selected ? <path className="load-selection-halo" d={path} /> : null}{previewed ? <path className="candidate-preview-halo" d={path} /> : null}<path className="load-hit" d={path} /><path d={path} markerEnd="url(#arrow-purple)" /></g>;
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
    return <g key={load.id} className={`distributed-symbol${selected ? ' selected' : ''}${previewed ? ' candidate-preview' : ''}`} data-structure-object data-structure-kind="memberLoad" data-structure-id={load.id} data-candidate-preview={previewed ? 'true' : undefined} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.distributedLoadAria', { id: load.id, target: load.memberId, value: formatFixed(toDisplay(average, units, 'distributedForce'), 2), unit: distributedLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'memberLoad', id: load.id })} onKeyDown={(event) => onObjectKeyDown(event, { kind: 'memberLoad', id: load.id })}>{selected ? <line className="load-selection-halo" x1={hitStart.x} y1={hitStart.y} x2={hitEnd.x} y2={hitEnd.y} /> : null}{previewed ? <line className="candidate-preview-halo" x1={hitStart.x} y1={hitStart.y} x2={hitEnd.x} y2={hitEnd.y} /> : null}<line className="load-hit" x1={hitStart.x} y1={hitStart.y} x2={hitEnd.x} y2={hitEnd.y} />{arrows}</g>;
  };

  if (slot === 'members') {
    return (
      <g className="member-layer">
        {project.members.map((member) => {
          const ni = nodeMap.get(member.i); const nj = nodeMap.get(member.j); if (!ni || !nj) return null;
          const a = toScreen(ni.x, ni.y); const b = toScreen(nj.x, nj.y);
          const selected = selectedMemberIds.includes(member.id);
          const previewed = candidatePreview?.kind === 'member' && candidatePreview.id === member.id;
          const learningHighlighted = learningFocus?.memberIds.includes(member.id) ?? false;
          const demandRatio = heatmapRatios.get(member.id);
          // Gancho de diagnóstico, no un número en pantalla: se redondea sin
          // `toFixed` para no depender del locale ni de la política de
          // presentación, que gobierna sólo lo que el usuario lee.
          const demandAttribute = demandRatio === undefined ? undefined : String(Math.round(demandRatio * 1000) / 1000);
          const paint = demandRatio === undefined ? null : elasticIndexPaint(demandRatio);
          /* Un miembro que no pudo evaluarse no puede quedarse con su trazo
             técnico normal: sería indistinguible de uno con η baja. Se marca como
             **no evaluado** y la leyenda cuenta cuántos son. */
          const unevaluated = demandMapActive && demandRatio === undefined;
          return (
            <g
              key={member.id}
              data-structure-object
              data-structure-kind="member"
              data-structure-id={member.id}
              data-demand-ratio={demandAttribute}
              data-demand-at-reference={paint?.atReference ? 'true' : undefined}
              data-demand-saturated={paint?.saturated ? 'true' : undefined}
              data-elastic-index={unevaluated ? 'unevaluated' : paint ? 'evaluated' : undefined}
              /* El color térmico viaja como custom property y no como `stroke`:
                 así la selección y el foco pedagógico siguen ganando por CSS. */
              style={paint === null ? undefined : { '--member-demand-color': paint.color } as CSSProperties}
              className={`member-object ${selected ? 'selected' : ''}${previewed ? ' candidate-preview' : ''} ${learningHighlighted ? 'learning-highlight' : ''} ${member.type}${paint === null ? '' : ' has-demand'}${unevaluated ? ' is-unevaluated' : ''}`}
              data-candidate-preview={previewed ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-keyshortcuts="Enter Space"
              aria-label={t('canvas.memberAria', { id: member.id, i: member.i, j: member.j })}
              aria-pressed={selected}
              onPointerDown={(event) => onObjectPointerDown(event, { kind: 'member', id: member.id })}
              onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => onObjectKeyDown(event, { kind: 'member', id: member.id })}
              onPointerMove={(event) => onShowCut(event, member)}
              onPointerLeave={onCutLeave}
            >
              {selected ? <line className="member-selection-halo" x1={a.x} y1={a.y} x2={b.x} y2={b.y} /> : null}
              {previewed ? <line className="candidate-preview-halo" x1={a.x} y1={a.y} x2={b.x} y2={b.y} /> : null}
              <line className="member-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <line className="member-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              {member.type === 'frame' && ((member.rigidOffsetI ?? 0) > 0 || (member.rigidOffsetJ ?? 0) > 0) ? (() => {
                const length = Math.hypot(nj.x - ni.x, nj.y - ni.y);
                const ti = length > 0 ? (member.rigidOffsetI ?? 0) / length : 0;
                const tj = length > 0 ? (member.rigidOffsetJ ?? 0) / length : 0;
                const faceI = toScreen(ni.x + (nj.x - ni.x) * ti, ni.y + (nj.y - ni.y) * ti);
                const faceJ = toScreen(nj.x - (nj.x - ni.x) * tj, nj.y - (nj.y - ni.y) * tj);
                return <g className="rigid-zone-layer"><line x1={a.x} y1={a.y} x2={faceI.x} y2={faceI.y} /><line x1={faceJ.x} y1={faceJ.y} x2={b.x} y2={b.y} /><circle cx={faceI.x} cy={faceI.y} r="3" /><circle cx={faceJ.x} cy={faceJ.y} r="3" /></g>;
              })() : null}
              {layers.dimensions && view.showLocalAxes ? (() => {
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
    {loadsLayerVisible && view.showLoads && resultTab !== 'influence' ? <g className="load-layer">{project.memberLoads.map(renderMemberLoad)}{project.nodalLoads.map(renderNodalLoad)}</g> : null}
    <g className="node-layer">
      {project.nodes.map((node) => {
        const p = toScreen(node.x, node.y);
        const selected = selectedNodeIds.includes(node.id);
        const previewed = candidatePreview?.kind === 'node' && candidatePreview.id === node.id;
        const start = memberStartId === node.id;
        const learningHighlighted = learningFocus?.nodeIds.includes(node.id) ?? false;
        return (
          <g
            key={node.id}
            className={`node-object ${selected ? 'selected' : ''}${previewed ? ' candidate-preview' : ''} ${start ? 'member-start' : ''} ${learningHighlighted ? 'learning-highlight' : ''}`}
            data-structure-object
            data-structure-kind="node"
            data-structure-id={node.id}
            data-candidate-preview={previewed ? 'true' : undefined}
            role="button"
            tabIndex={0}
            aria-keyshortcuts="Enter Space"
            aria-label={t('canvas.nodeAria', { id: node.id, x: formatFixed(node.x, 3), y: formatFixed(node.y, 3) })}
            aria-pressed={selected}
            onPointerDown={(event) => onObjectPointerDown(event, { kind: 'node', id: node.id })}
            onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => onObjectKeyDown(event, { kind: 'node', id: node.id })}
          >
            {selected ? <><circle className="node-selection-halo" cx={p.x} cy={p.y} r="14" /><path className="node-selection-cross" d={`M ${p.x - 18} ${p.y} H ${p.x + 18} M ${p.x} ${p.y - 18} V ${p.y + 18}`} /></> : null}
            {previewed ? <circle className="candidate-preview-ring" cx={p.x} cy={p.y} r="18" /> : null}
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
