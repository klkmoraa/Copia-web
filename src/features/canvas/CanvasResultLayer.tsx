import { memo } from 'react';
import type { AnalysisResult, DiagramQuantity, MemberModel, NodeModel, ProjectModel } from '../../types';
import type { InfluenceCanvasState, ResultCursor, ResultTab } from '../../store/ProjectContext';
import type { CanvasCamera } from './canvasInteraction';
import { evaluateDeformationAt, evaluateDiagramAt, segmentBezierControls } from '../../engine/diagram';
import { toDisplay, unitLabel } from '../../engine/units';
import { memberAxis } from '../../graphics/structureGeometry';
import { formatFixed, formatScientific } from '../../utils/numberFormat';
import type { TranslationKey } from '../../i18n/catalogs';
import { readCanvasViewSettings } from '../view/canvasViewSettings';

type MemberResult = AnalysisResult['memberResults'][number];
type NodeResult = AnalysisResult['nodeResults'][number];
type MechanismNode = NonNullable<AnalysisResult['mechanism']>['nodes'][number];
type Units = ProjectModel['settings']['units'];
type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

/** Presentation-only overlay of solved diagrams, deformed shapes and reaction arrows. Never mutates the model. */
export interface CanvasResultLayerProps {
  /** `diagrams` paints under the geometry (fills/curves); `annotations` paints over it (reactions, influence path). */
  slot: 'diagrams' | 'annotations';
  project: ProjectModel;
  analysis: AnalysisResult | null;
  resultTab: ResultTab;
  resultsAllowed: boolean;
  resultCursor: ResultCursor | null;
  influenceCanvasState: InfluenceCanvasState | null;
  camera: CanvasCamera;
  toScreen: (x: number, y: number) => { x: number; y: number };
  nodeMap: Map<string, NodeModel>;
  memberMap: Map<string, MemberModel>;
  resultMap: Map<string, MemberResult>;
  nodeResultMap: Map<string, NodeResult>;
  mechanismMap: Map<string, MechanismNode>;
  mechanismPixelScale: number;
  globalDiagramMax: number;
  units: Units;
  lengthLabel: string;
  forceLabel: string;
  momentLabel: string;
  showResults: boolean;
  showDiagnostics: boolean;
  size: { width: number; height: number };
  t: Translate;
}

// oxlint-disable-next-line react/only-export-components
export const reactionClearanceFor = (type: NodeModel['support']['type']): { bottom: number; side: number } => ({
  bottom: type === 'roller' ? 28 : type === 'pin' || type === 'custom' ? 25 : type === 'fixed' ? 16 : 8,
  side: type === 'none' ? 8 : type === 'fixed' ? 20 : 18,
});

/** Pixel scale for a diagram ordinate: shared global scale, or per-member when `diagramScaleMode` is `individual`. */
// oxlint-disable-next-line react/only-export-components
export const diagramPixelScaleFor = (project: ProjectModel, resultTab: ResultTab, globalDiagramMax: number, result: MemberResult) => {
  const view = readCanvasViewSettings(project);
  if (view.diagramScaleMode !== 'individual') return (68 * view.diagramScale) / globalDiagramMax;
  const key = resultTab === 'axial' ? 'axial' : resultTab === 'shear' ? 'shear' : 'moment';
  let maximum = 1e-9;
  for (const point of result.criticalPoints) {
    if (point.quantity === key) maximum = Math.max(maximum, Math.abs(point.value));
  }
  return (68 * view.diagramScale) / maximum;
};

/**
 * Un extremo sólo se sella si vale al menos esta fracción del máximo global del
 * diagrama. Sin el filtro, una estructura de treinta barras se cubre de
 * etiquetas —incluidas las de los tramos que apenas trabajan— y el sello deja
 * de señalar nada. Con él quedan los picos que de verdad gobiernan.
 */
// oxlint-disable-next-line react/only-export-components
export const CRITICAL_MARKER_MIN_SHARE = 0.15;

/** Extremos M/V ya resueltos por el análisis, listos para sellar sobre la barra. */
// oxlint-disable-next-line react/only-export-components
export const criticalExtremesFor = (
  points: ReadonlyArray<MemberResult['criticalPoints'][number]>,
  quantity: DiagramQuantity,
  floor: number,
): Array<{ point: MemberResult['criticalPoints'][number]; extreme: 'max' | 'min' }> => {
  const candidates = points.filter((point) => point.quantity === quantity);
  if (candidates.length === 0) return [];
  const highest = candidates.reduce((best, point) => (point.value > best.value ? point : best));
  const lowest = candidates.reduce((best, point) => (point.value < best.value ? point : best));
  const marks: Array<{ point: MemberResult['criticalPoints'][number]; extreme: 'max' | 'min' }> = [];
  if (Math.abs(highest.value) >= floor) marks.push({ point: highest, extreme: 'max' });
  // Un diagrama de signo constante tiene un solo extremo interesante: sellarlo
  // dos veces apilaría dos etiquetas idénticas sobre el mismo punto.
  if (Math.abs(lowest.value) >= floor && Math.abs(lowest.value - highest.value) > 1e-9) {
    marks.push({ point: lowest, extreme: 'min' });
  }
  return marks;
};

const CanvasResultLayerImpl = ({
  slot, project, analysis, resultTab, resultsAllowed, resultCursor, influenceCanvasState, camera, toScreen,
  nodeMap, memberMap, resultMap, nodeResultMap, mechanismMap, mechanismPixelScale, globalDiagramMax,
  units, lengthLabel, forceLabel, momentLabel, showResults, showDiagnostics, size, t,
}: CanvasResultLayerProps) => {
  const view = readCanvasViewSettings(project);
  const scaleFor = (result: MemberResult) => diagramPixelScaleFor(project, resultTab, globalDiagramMax, result);

  const diagramPath = (member: MemberModel) => {
    const result = resultMap.get(member.id);
    const ni = nodeMap.get(member.i); const nj = nodeMap.get(member.j);
    if (!resultsAllowed || !view.showResultOverlay || !result || !ni || !nj || !['axial', 'shear', 'moment'].includes(resultTab) || !result.diagramSegments.length) return null;
    const axis = memberAxis(member, ni, nj);
    const tx = axis.c; const ty = axis.s;
    const side = view.diagramSide === 'negative' ? -1 : 1;
    const nx = axis.normal.x * side; const ny = axis.normal.y * side;
    const key = resultTab as DiagramQuantity;
    const diagramPixelScale = scaleFor(result);
    const locate = (x: number, value: number) => {
      const grossX = (result.startOffset ?? 0) + x;
      const bx = ni.x + tx * grossX;
      const by = ni.y + ty * grossX;
      const offsetModel = (value * diagramPixelScale) / camera.scale;
      return toScreen(bx + nx * offsetModel, by + ny * offsetModel);
    };
    const baselineStart = toScreen(ni.x + tx * (result.startOffset ?? 0), ni.y + ty * (result.startOffset ?? 0));
    const baselineEnd = toScreen(ni.x + tx * ((result.startOffset ?? 0) + result.length), ni.y + ty * ((result.startOffset ?? 0) + result.length));
    const firstControl = segmentBezierControls(result.diagramSegments[0], key);
    const firstPoint = locate(firstControl.x0, firstControl.y0);
    const fillCommands = [`M ${baselineStart.x} ${baselineStart.y}`, `L ${firstPoint.x} ${firstPoint.y}`];
    const lineCommands = [`M ${firstPoint.x} ${firstPoint.y}`];
    const jumpCommands: string[] = [`M ${baselineStart.x} ${baselineStart.y} L ${firstPoint.x} ${firstPoint.y}`];
    let lastPoint = firstPoint;
    result.diagramSegments.forEach((segment, index) => {
      const control = segmentBezierControls(segment, key);
      const c1 = locate(control.c1x, control.c1y);
      const c2 = locate(control.c2x, control.c2y);
      const endPoint = locate(control.x1, control.y1);
      const curve = `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${endPoint.x} ${endPoint.y}`;
      fillCommands.push(curve);
      lineCommands.push(curve);
      lastPoint = endPoint;
      const next = result.diagramSegments[index + 1];
      if (next && Math.abs(next.x0 - segment.x1) < 1e-8) {
        const nextControl = segmentBezierControls(next, key);
        if (Math.abs(nextControl.y0 - control.y1) > 1e-10) {
          const rightPoint = locate(nextControl.x0, nextControl.y0);
          const jump = `L ${rightPoint.x} ${rightPoint.y}`;
          fillCommands.push(jump);
          lineCommands.push(jump);
          jumpCommands.push(`M ${endPoint.x} ${endPoint.y} L ${rightPoint.x} ${rightPoint.y}`);
          lastPoint = rightPoint;
        }
      }
    });
    fillCommands.push(`L ${baselineEnd.x} ${baselineEnd.y}`, 'Z');
    jumpCommands.push(`M ${lastPoint.x} ${lastPoint.y} L ${baselineEnd.x} ${baselineEnd.y}`);
    return <g key={member.id} className={`diagram-shape ${key}`}>
      <path d={fillCommands.join(' ')} className="diagram-fill" />
      <path d={lineCommands.join(' ')} className="diagram-line-exact" />
      <path d={jumpCommands.join(' ')} className="diagram-jumps" />
    </g>;
  };

  const deformedPath = (member: MemberModel) => {
    const result = resultMap.get(member.id);
    const ni = nodeMap.get(member.i); const nj = nodeMap.get(member.j);
    if (!result || !ni || !nj || member.type === 'rigid' || !result.deformation.length) return '';
    const { c, s } = memberAxis(member, ni, nj);
    const scale = view.deformedScale;
    const curved = result.deformation.map((point) => {
      const grossX = (result.startOffset ?? 0) + point.x;
      const gx = ni.x + c * grossX + scale * (c * point.u - s * point.v);
      const gy = ni.y + s * grossX + scale * (s * point.u + c * point.v);
      return toScreen(gx, gy);
    });
    const iResult = nodeResultMap.get(member.i);
    const jResult = nodeResultMap.get(member.j);
    const displacedI = toScreen(ni.x + scale * (iResult?.ux ?? 0), ni.y + scale * (iResult?.uy ?? 0));
    const displacedJ = toScreen(nj.x + scale * (jResult?.ux ?? 0), nj.y + scale * (jResult?.uy ?? 0));
    const all = [displacedI, ...curved, displacedJ];
    return all.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  };

  const renderResultCursor = () => {
    if (!resultsAllowed || !resultCursor || !analysis?.success) return null;
    const member = memberMap.get(resultCursor.memberId);
    const result = resultMap.get(resultCursor.memberId);
    if (!member || !result) return null;
    const ni = nodeMap.get(member.i);
    const nj = nodeMap.get(member.j);
    if (!ni || !nj) return null;
    const axis = memberAxis(member, ni, nj);
    if (axis.length <= 1e-12) return null;
    const { c, s } = axis;
    const x = Math.max(0, Math.min(result.length, resultCursor.x));
    const grossX = (result.startOffset ?? 0) + x;
    const base = { x: ni.x + c * grossX, y: ni.y + s * grossX };
    let screen = toScreen(base.x, base.y);
    let label = `x ${formatFixed(toDisplay(x, units, 'length'), 3)} ${lengthLabel}`;
    if (['axial', 'shear', 'moment'].includes(resultTab)) {
      const quantity = resultTab as DiagramQuantity;
      const value = evaluateDiagramAt(result.diagramSegments, result.diagramJumps, x, 'right')?.[quantity] ?? 0;
      const side = view.diagramSide === 'negative' ? -1 : 1;
      const nx = axis.normal.x * side;
      const ny = axis.normal.y * side;
      const offsetModel = value * scaleFor(result) / camera.scale;
      screen = toScreen(base.x + nx * offsetModel, base.y + ny * offsetModel);
      const displayQuantity = quantity === 'moment' ? 'moment' as const : 'force' as const;
      label = `${quantity === 'axial' ? 'N' : quantity === 'shear' ? 'V' : 'M'} ${formatFixed(toDisplay(value, units, displayQuantity), 3)} ${unitLabel(units, displayQuantity)}`;
    } else if (resultTab === 'deformed' && result.deformationSegments.length) {
      const response = evaluateDeformationAt(result.deformationSegments, x);
      if (response) {
        const scale = view.deformedScale;
        screen = toScreen(base.x + scale * (c * response.u - s * response.v), base.y + scale * (s * response.u + c * response.v));
        label = `v ${formatScientific(toDisplay(response.v, units, 'length'), 2)} ${lengthLabel}`;
      }
    }
    return <g className="result-cursor-marker" transform={`translate(${screen.x} ${screen.y})`} pointerEvents="none"><circle r="6" /><path d="M-13 0H13M0-13V13" /><g transform="translate(10 -31)"><rect width={Math.max(90, label.length * 5.5)} height="22" rx="7" /><text x="8" y="15">{label}</text></g></g>;
  };

  /**
   * Tallo y punto de Mmax/Mmin y Vmax/Vmin sobre la propia barra: sólo
   * geometría, marca dónde en el diagrama vive cada extremo. El texto del
   * valor y su estación los sella `canvasLabelSources.ts` como candidato del
   * mismo repartidor que coloca nodos, cotas y cargas — antes este componente
   * dibujaba su propio `<rect>`+`<text>` con una posición fija, ajena a esas
   * otras etiquetas, y el resultado eran dos etiquetas del mismo valor
   * pisándose entre sí y con lo que hubiera alrededor.
   */
  const renderCriticalPoints = () => {
    if (!resultsAllowed || !analysis?.success || !view.showResultOverlay) return null;
    if (resultTab !== 'shear' && resultTab !== 'moment') return null;
    const key = resultTab as DiagramQuantity;
    const floor = Math.max(globalDiagramMax * CRITICAL_MARKER_MIN_SHARE, 1e-9);
    const side = view.diagramSide === 'negative' ? -1 : 1;

    const stems = project.members.flatMap((member) => {
      const result = resultMap.get(member.id);
      const ni = nodeMap.get(member.i);
      const nj = nodeMap.get(member.j);
      if (!result || !ni || !nj || !result.criticalPoints.length) return [];
      const axis = memberAxis(member, ni, nj);
      if (axis.length <= 1e-12) return [];
      const nx = axis.normal.x * side;
      const ny = axis.normal.y * side;
      const diagramPixelScale = scaleFor(result);
      return criticalExtremesFor(result.criticalPoints, key, floor).map(({ point, extreme }) => {
        const grossX = (result.startOffset ?? 0) + point.x;
        const baseX = ni.x + axis.c * grossX;
        const baseY = ni.y + axis.s * grossX;
        const offsetModel = (point.value * diagramPixelScale) / camera.scale;
        const base = toScreen(baseX, baseY);
        const tip = toScreen(baseX + nx * offsetModel, baseY + ny * offsetModel);
        return <g
          key={`${member.id}-${key}-${extreme}`}
          className={`critical-point-marker is-${extreme}`}
          data-critical-point={`${member.id}:${key}:${extreme}`}
          pointerEvents="none"
        >
          <line className="critical-point-stem" x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} />
          <circle className="critical-point-dot" cx={tip.x} cy={tip.y} r="3.2" />
        </g>;
      });
    });
    return stems.length ? <g className={`critical-point-layer is-${key}`} aria-hidden="true">{stems}</g> : null;
  };

  const renderInfluenceOverlay = () => {
    if (!resultsAllowed || resultTab !== 'influence' || !analysis?.success || !influenceCanvasState) return null;
    const path = influenceCanvasState.pathMemberIds.flatMap((memberId) => {
      const member = memberMap.get(memberId);
      const result = resultMap.get(memberId);
      const ni = member ? nodeMap.get(member.i) : undefined;
      const nj = member ? nodeMap.get(member.j) : undefined;
      if (!member || !result || !ni || !nj) return [];
      const axis = memberAxis(member, ni, nj);
      if (axis.length <= 1e-12) return [];
      const { c, s } = axis;
      const start = result.startOffset ?? 0;
      const a = toScreen(ni.x + c * start, ni.y + s * start);
      const b = toScreen(ni.x + c * (start + result.length), ni.y + s * (start + result.length));
      return [{ memberId, a, b }];
    });
    const source = (() => {
      const marker = influenceCanvasState.source;
      if (!marker) return null;
      const member = memberMap.get(marker.memberId);
      const result = resultMap.get(marker.memberId);
      const ni = member ? nodeMap.get(member.i) : undefined;
      const nj = member ? nodeMap.get(member.j) : undefined;
      if (!member || !result || !ni || !nj) return null;
      const axis = memberAxis(member, ni, nj);
      if (axis.length <= 1e-12) return null;
      const { c, s } = axis;
      const localX = (result.startOffset ?? 0) + Math.max(0, Math.min(1, marker.ratio)) * result.length;
      const point = toScreen(ni.x + c * localX, ni.y + s * localX);
      const ordinate = influenceCanvasState.target.quantity === 'moment'
        ? `${formatFixed(toDisplay(marker.ordinate, units, 'length'), 4)} ${lengthLabel}`
        : formatFixed(marker.ordinate, 4);
      return { point, ordinate };
    })();
    const target = (() => {
      const marker = influenceCanvasState.target;
      const member = memberMap.get(marker.memberId);
      const result = resultMap.get(marker.memberId);
      const ni = member ? nodeMap.get(member.i) : undefined;
      const nj = member ? nodeMap.get(member.j) : undefined;
      if (!member || !result || !ni || !nj) return null;
      const axis = memberAxis(member, ni, nj);
      if (axis.length <= 1e-12) return null;
      const { c, s } = axis;
      const x = Math.max(0, Math.min(result.length, marker.x));
      const localX = (result.startOffset ?? 0) + x;
      const point = toScreen(ni.x + c * localX, ni.y + s * localX);
      return { point, nx: -s, ny: c, label: `${marker.quantity === 'axial' ? 'N' : marker.quantity === 'shear' ? 'V' : 'M'} · x ${formatFixed(toDisplay(x, units, 'length'), 3)} ${lengthLabel}` };
    })();
    return <g className="influence-canvas-overlay" pointerEvents="none">
      {path.map((item) => <line key={item.memberId} className="influence-path" x1={item.a.x} y1={item.a.y} x2={item.b.x} y2={item.b.y} />)}
      {target ? <g className="influence-target"><line x1={target.point.x - target.nx * 16} y1={target.point.y + target.ny * 16} x2={target.point.x + target.nx * 16} y2={target.point.y - target.ny * 16} /><circle cx={target.point.x} cy={target.point.y} r="4" /><text x={target.point.x + 10} y={target.point.y - 18}>{target.label}</text></g> : null}
      {source ? <g className="influence-unit-load"><line x1={source.point.x} y1={source.point.y - 55} x2={source.point.x} y2={source.point.y - 8} markerEnd="url(#arrow-purple)" /><circle cx={source.point.x} cy={source.point.y} r="5" /><text x={source.point.x + (source.point.x > size.width * 0.65 ? -10 : 10)} y={source.point.y - 62} textAnchor={source.point.x > size.width * 0.65 ? 'end' : 'start'}>{formatFixed(toDisplay(1, units, 'force'), 3)} {forceLabel} · ψ {source.ordinate}</text></g> : null}
    </g>;
  };

  const mechanismScreenPoint = (node: NodeModel) => {
    const point = toScreen(node.x, node.y);
    const mode = mechanismMap.get(node.id);
    if (!mode) return point;
    return {
      x: point.x + mode.ux * mechanismPixelScale,
      y: point.y - mode.uy * mechanismPixelScale,
    };
  };

  const renderMechanism = () => {
    if (analysis?.success !== false || !analysis.mechanism?.nodes.length) return null;
    return (
      <g className="mechanism-layer" aria-label={t('canvas.mechanismMode')}>
        {project.members.map((member) => {
          const ni = nodeMap.get(member.i); const nj = nodeMap.get(member.j);
          if (!ni || !nj) return null;
          const a = mechanismScreenPoint(ni); const b = mechanismScreenPoint(nj);
          return <line key={`mechanism-${member.id}`} className="mechanism-member" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
        {project.nodes.map((node) => {
          const mode = mechanismMap.get(node.id);
          if (!mode || mode.normalizedAmplitude < 1e-6) return null;
          const original = toScreen(node.x, node.y);
          const moved = mechanismScreenPoint(node);
          const translationPixels = Math.hypot(moved.x - original.x, moved.y - original.y);
          return (
            <g key={`mechanism-node-${node.id}`} className="mechanism-node">
              {translationPixels > 3 ? <line x1={original.x} y1={original.y} x2={moved.x} y2={moved.y} markerEnd="url(#arrow-mechanism)" /> : null}
              {translationPixels <= 3 && Math.abs(mode.rz) > 1e-12 ? <path d={`M ${original.x - 16} ${original.y} A 16 16 0 1 ${mode.rz >= 0 ? 1 : 0} ${original.x + 13} ${original.y - 9}`} markerEnd="url(#arrow-mechanism)" /> : null}
              <circle cx={moved.x} cy={moved.y} r={5 + 3 * mode.normalizedAmplitude} />
              <text x={moved.x + 10} y={moved.y - 9}>{node.id} · {mode.dominantDof} · {formatFixed((100 * mode.normalizedAmplitude), 0)}%</text>
            </g>
          );
        })}
        <g className="mechanism-caption" transform="translate(18 24)">
          <rect width="230" height="42" rx="8" />
          <text x="12" y="17">{t('canvas.mechanismDetected', { nullity: analysis.mechanism.nullity })}</text>
          <text x="12" y="32">{t('canvas.mechanismNormalized')}</text>
        </g>
      </g>
    );
  };

  const renderReaction = (node: NodeModel) => {
    if (!resultsAllowed || !analysis?.success) return null;
    const result = nodeResultMap.get(node.id);
    if (!result) return null;
    const p = toScreen(node.x, node.y);
    const { bottom: bottomClearance, side: sideClearance } = reactionClearanceFor(node.support.type);
    const elements = [];
    const descriptions: string[] = [];
    if (Math.abs(result.rx) > 1e-8) {
      const direction = Math.sign(result.rx);
      const length = 48;
      descriptions.push(`Rx = ${formatFixed(toDisplay(result.rx, units, 'force'), 3)} ${forceLabel}`);
      elements.push(
        <line key="rx" data-reaction-component="rx" x1={p.x - direction * (sideClearance + length)} y1={p.y} x2={p.x - direction * sideClearance} y2={p.y} markerEnd="url(#arrow-blue)" />,
      );
    }
    if (Math.abs(result.ry) > 1e-8) {
      const screenDirection = -Math.sign(result.ry);
      const length = 48;
      descriptions.push(`Ry = ${formatFixed(toDisplay(result.ry, units, 'force'), 3)} ${forceLabel}`);
      elements.push(
        screenDirection < 0
          ? <line key="ry" data-reaction-component="ry" x1={p.x} y1={p.y + bottomClearance + length} x2={p.x} y2={p.y + bottomClearance} markerEnd="url(#arrow-blue)" />
          : <line key="ry" data-reaction-component="ry" x1={p.x} y1={p.y + bottomClearance} x2={p.x} y2={p.y + bottomClearance + length} markerEnd="url(#arrow-blue)" />,
      );
    }
    if (Math.abs(result.rm) > 1e-8) {
      const clockwise = result.rm < 0;
      const r = Math.max(28, bottomClearance + 6);
      const path = clockwise
        ? `M ${p.x - 22} ${p.y - 10} A ${r} ${r} 0 1 0 ${p.x + 20} ${p.y - 14}`
        : `M ${p.x + 22} ${p.y - 10} A ${r} ${r} 0 1 1 ${p.x - 20} ${p.y - 14}`;
      descriptions.push(`Mᵣ = ${formatFixed(toDisplay(result.rm, units, 'moment'), 3)} ${momentLabel}`);
      elements.push(<path key="moment" d={path} markerEnd="url(#arrow-blue)" />);
    }
    return elements.length ? <g key={node.id} className="reaction-symbol" data-node-id={node.id}><title>{descriptions.join(' · ')}</title>{elements}</g> : null;
  };

  if (slot === 'diagrams') {
    return <>
      {showResults ? <g className="diagram-layer">{project.members.map(diagramPath)}</g> : null}
      {showResults && resultsAllowed && resultTab === 'deformed' && analysis?.success ? <g className="deformed-layer">{project.members.map((member) => <path key={member.id} d={deformedPath(member)} />)}</g> : null}
      {showResults ? renderResultCursor() : null}
      {showDiagnostics ? renderMechanism() : null}
    </>;
  }

  return <>
    {showResults ? renderInfluenceOverlay() : null}
    {showResults ? renderCriticalPoints() : null}
    {showResults ? <g className="reaction-layer">{project.nodes.map(renderReaction)}</g> : null}
  </>;
};

export const CanvasResultLayer = memo(CanvasResultLayerImpl);
