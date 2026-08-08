import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  evaluateAxleTrain,
  evaluateInfluenceLine,
  type AxleTrainEnvelope,
  type ConcentratedAxle,
  type InfluenceLine,
  type InfluenceQuantity,
} from '../../engine/influence';
import { useInfluenceAnalysis } from '../../engine/useInfluenceAnalysis';
import { fromDisplay, toDisplay, unitLabel } from '../../engine/units';
import type { DiagramQuantity, ProjectModel, Selection } from '../../types';
import type { InfluenceCanvasState } from '../../store/ProjectContext';
import { useI18n } from '../../i18n/useI18n';
import { formatFixed, formatScientific, formatSignificant } from '../../utils/numberFormat';

export interface InfluenceLineViewProps {
  project: ProjectModel;
  selection?: Selection;
  onCanvasStateChange?: (state: InfluenceCanvasState | null) => void;
}

type InfluenceSubtab = 'line' | 'train';

interface CurveSegment {
  x0: number;
  x1: number;
  coefficients: readonly [number, number, number, number];
}

interface CurveJump {
  x: number;
  left: number;
  right: number;
}

interface CurveExtreme {
  x: number;
  value: number;
  label: string;
}

interface CursorReading {
  position: number;
  value: number;
}

const controlGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 10,
  alignItems: 'end',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  fontSize: 10,
  color: 'var(--muted)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  border: '1px solid var(--border)',
  borderRadius: 7,
  padding: '7px 8px',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontVariantNumeric: 'tabular-nums',
};

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '8px 10px',
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

const finiteExponential = (value: number, digits = 2): string => formatScientific(value, digits);

const polynomialValue = (coefficients: readonly number[], xi: number): number =>
  coefficients.reduceRight((value, coefficient) => value * xi + coefficient, 0);

const segmentEndValue = (segment: CurveSegment): number =>
  polynomialValue(segment.coefficients, segment.x1 - segment.x0);

const deriveJumps = (segments: readonly CurveSegment[]): CurveJump[] => {
  const jumps: CurveJump[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    const next = segments[index];
    const left = segmentEndValue(previous);
    const right = polynomialValue(next.coefficients, 0);
    if (Math.abs(left - right) > 1e-10 * Math.max(1, Math.abs(left), Math.abs(right))) {
      jumps.push({ x: next.x0, left, right });
    }
  }
  return jumps;
};

const memberDeformableLength = (project: ProjectModel, memberId: string): number => {
  const member = project.members.find((candidate) => candidate.id === memberId);
  if (!member) return 0;
  const nodeI = project.nodes.find((node) => node.id === member.i);
  const nodeJ = project.nodes.find((node) => node.id === member.j);
  if (!nodeI || !nodeJ) return 0;
  return Math.max(0, Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y)
    - (member.rigidOffsetI ?? 0) - (member.rigidOffsetJ ?? 0));
};

const selectionFrameIds = (project: ProjectModel, selection: Selection | undefined): string[] => {
  const requested = selection?.kind === 'member'
    ? [selection.id]
    : selection?.kind === 'multi'
      ? selection.memberIds
      : [];
  const frameIds = new Set(project.members.filter((member) => member.type === 'frame').map((member) => member.id));
  return requested.filter((id) => frameIds.has(id));
};

const diagramQuantity = (quantity: InfluenceQuantity): DiagramQuantity =>
  quantity === 'N' ? 'axial' : quantity === 'V' ? 'shear' : 'moment';

const curveClass = (quantity: InfluenceQuantity): DiagramQuantity => diagramQuantity(quantity);

const cubicBezier = (segment: CurveSegment) => {
  const length = segment.x1 - segment.x0;
  const [c0, c1, c2, c3] = segment.coefficients;
  const y0 = c0;
  const y1 = polynomialValue(segment.coefficients, length);
  const slope0 = c1;
  const slope1 = c1 + 2 * c2 * length + 3 * c3 * length ** 2;
  return {
    x0: segment.x0,
    y0,
    c1x: segment.x0 + length / 3,
    c1y: y0 + slope0 * length / 3,
    c2x: segment.x1 - length / 3,
    c2y: y1 - slope1 * length / 3,
    x1: segment.x1,
    y1,
  };
};

interface ExactPolynomialChartProps {
  ariaLabel: string;
  colorClass: DiagramQuantity;
  segments: readonly CurveSegment[];
  jumps: readonly CurveJump[];
  domain: readonly [number, number];
  minimum: CurveExtreme;
  maximum: CurveExtreme;
  valueAt: (position: number) => number;
  formatX: (position: number) => string;
  formatY: (value: number) => string;
  xAxisLabel: string;
  yAxisLabel: string;
  onCursorChange: (reading: CursorReading | null) => void;
}

const ExactPolynomialChart = ({
  ariaLabel,
  colorClass,
  segments,
  jumps,
  domain,
  minimum,
  maximum,
  valueAt,
  formatX,
  formatY,
  xAxisLabel,
  yAxisLabel,
  onCursorChange,
}: ExactPolynomialChartProps) => {
  const { t } = useI18n();
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [pinnedPosition, setPinnedPosition] = useState<number | null>(null);
  const [domainStart, domainEnd] = domain;
  const domainLength = Math.max(1e-12, domainEnd - domainStart);
  const maxAbs = Math.max(Math.abs(minimum.value), Math.abs(maximum.value), 1e-12);
  const width = 880;
  const height = 220;
  const baseline = 106;
  const amplitude = 76;
  const sx = useCallback(
    (x: number) => ((x - domainStart) / domainLength) * width,
    [domainLength, domainStart],
  );
  const sy = useCallback(
    (value: number) => baseline - value / maxAbs * amplitude,
    [maxAbs],
  );
  const activePosition = pinnedPosition ?? hoverPosition;
  const activeValue = activePosition === null ? null : valueAt(activePosition);

  useEffect(() => {
    setHoverPosition(null);
    setPinnedPosition(null);
  }, [domainEnd, domainStart, segments]);

  useEffect(() => {
    onCursorChange(activePosition === null || activeValue === null
      ? null
      : { position: activePosition, value: activeValue });
  }, [activePosition, activeValue, onCursorChange]);

  const paths = useMemo(() => segments.map((segment) => {
    const control = cubicBezier(segment);
    const number = (value: number) => formatFixed(value, 5);
    return `M ${number(sx(control.x0))} ${number(sy(control.y0))} C ${number(sx(control.c1x))} ${number(sy(control.c1y))} ${number(sx(control.c2x))} ${number(sy(control.c2y))} ${number(sx(control.x1))} ${number(sy(control.y1))}`;
  }), [segments, sx, sy]);

  const positionFromPointer = (event: ReactPointerEvent<SVGSVGElement>): number => {
    const rectangle = event.currentTarget.getBoundingClientRect();
    if (rectangle.width <= 0) return domainStart;
    return clamp(domainStart + (event.clientX - rectangle.left) / rectangle.width * domainLength, domainStart, domainEnd);
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    const step = domainLength / 100;
    const current = activePosition ?? domainStart;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = current - step;
    else if (event.key === 'ArrowRight') next = current + step;
    else if (event.key === 'Home') next = domainStart;
    else if (event.key === 'End') next = domainEnd;
    else if (event.key === 'Escape') {
      event.preventDefault();
      setPinnedPosition(null);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    const clamped = clamp(next, domainStart, domainEnd);
    setPinnedPosition(clamped);
    setHoverPosition(clamped);
  };

  const extrema = minimum.x === maximum.x && minimum.value === maximum.value ? [minimum] : [minimum, maximum];
  const first = segments[0];
  const last = segments.at(-1);
  const endpoints = first && last
    ? [
        { x: first.x0, value: polynomialValue(first.coefficients, 0) },
        { x: last.x1, value: segmentEndValue(last) },
      ]
    : [];

  return <div className={`diagram-chart ${colorClass}`}>
    <div className="diagram-chart-heading">
      <strong>{ariaLabel}</strong>
      <small>{pinnedPosition === null ? t('influence.chartPointerHint') : t('influence.chartPinnedHint')}</small>
    </div>
    <svg
      tabIndex={0}
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      onKeyDown={onKeyDown}
      onPointerMove={(event) => setHoverPosition(positionFromPointer(event))}
      onPointerDown={(event) => {
        const position = positionFromPointer(event);
        setHoverPosition(position);
        setPinnedPosition((current) => current === null ? position : null);
      }}
      onPointerLeave={() => setHoverPosition(null)}
    >
      <title>{ariaLabel}</title>
      <desc>{t('influence.chartDescription')}</desc>
      <line className="chart-axis" x1="0" y1={baseline} x2={width} y2={baseline} />
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const position = domainStart + fraction * domainLength;
        return <g className="chart-tick" key={fraction}>
          <line x1={sx(position)} y1={baseline - 4} x2={sx(position)} y2={baseline + 5} />
          <text x={sx(position)} y={height - 10} textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>{formatX(position)}</text>
        </g>;
      })}
      <text x="8" y="14">{yAxisLabel}</text>
      <text x={width - 8} y={height - 10} textAnchor="end">{xAxisLabel}</text>
      <text x="4" y={sy(maxAbs) - 4}>{formatY(maxAbs)}</text>
      <text x="4" y={sy(-maxAbs) + 12}>{formatY(-maxAbs)}</text>
      {paths.map((path, index) => <path className="chart-line" d={path} fill="none" key={`${segments[index].x0}-${segments[index].x1}`} />)}
      {jumps.map((jump, index) => <line className="chart-jump" x1={sx(jump.x)} y1={sy(jump.left)} x2={sx(jump.x)} y2={sy(jump.right)} key={`${jump.x}-${index}`} />)}
      {endpoints.map((point, index) => <circle className="chart-line" cx={sx(point.x)} cy={sy(point.value)} fill="var(--surface)" r="3.8" key={`end-${index}`} />)}
      {extrema.map((point) => <g className="chart-critical" key={`${point.label}-${point.x}-${point.value}`}>
        <circle cx={sx(point.x)} cy={sy(point.value)} r="3.4" />
        <text x={sx(point.x)} y={sy(point.value) + (point.value >= 0 ? -8 : 14)} textAnchor={point.x < domainStart + domainLength * 0.08 ? 'start' : point.x > domainEnd - domainLength * 0.08 ? 'end' : 'middle'}>{point.label} {formatY(point.value)}</text>
      </g>)}
      {activePosition !== null && activeValue !== null ? <g className={`chart-hover ${pinnedPosition === null ? '' : 'pinned'}`}>
        <line x1={sx(activePosition)} y1="18" x2={sx(activePosition)} y2={height - 24} />
        <circle cx={sx(activePosition)} cy={sy(activeValue)} r="4" />
      </g> : null}
    </svg>
    {activePosition !== null && activeValue !== null
      ? <div className="diagram-cursor-readout"><span><b>x</b>{formatX(activePosition)}</span><span><b>{t('influence.value')}</b>{formatY(activeValue)}</span></div>
      : <div className="diagram-cursor-placeholder">{t('influence.chartCursorPlaceholder')}</div>}
  </div>;
};

const InfluenceDiagnostics = ({ line }: { line: InfluenceLine }) => {
  const { t } = useI18n();
  const closurePassed = line.fit.maxAbsoluteError <= 1e-9 || line.fit.maxRelativeError <= 1e-8;
  const equilibriumResidual = Math.max(line.solver.maxEquilibriumResidual, line.solver.maxStructuralResidual);
  const equilibriumPassed = equilibriumResidual <= 1e-8;
  const precisionPassed = (line.solver.maxForwardErrorBound <= 1e-6 || !Number.isFinite(line.solver.maxForwardErrorBound))
    && (line.solver.minReliableDigits >= 6 || !Number.isFinite(line.solver.minReliableDigits));
  return <>
    <div className="verification-grid">
      <div className={closurePassed ? 'passed' : 'warning'}><span>{t('influence.polynomialClosure')}</span><strong>{finiteExponential(line.fit.maxAbsoluteError, 3)}</strong><small>{t('influence.polynomialClosureDetail', { relative: finiteExponential(line.fit.maxRelativeError, 2), count: line.fit.validations.length })}</small></div>
      <div className={equilibriumPassed ? 'passed' : 'warning'}><span>{t('influence.equilibrium')}</span><strong>{finiteExponential(equilibriumResidual, 3)}</strong><small>{t('influence.equilibriumDetail', { count: line.solver.analyses })}</small></div>
      <div className={precisionPassed ? 'passed' : 'warning'}><span>{t('influence.estimatedPrecision')}</span><strong>{Number.isFinite(line.solver.minReliableDigits) ? t('influence.reliableDigits', { digits: formatFixed(line.solver.minReliableDigits, 1) }) : t('influence.notEstimated')}</strong><small>{t('influence.precisionDetail', { bound: finiteExponential(line.solver.maxForwardErrorBound, 2), residual: finiteExponential(line.solver.maxLinearResidual, 2) })}</small></div>
      <div className="passed"><span>{t('influence.extrema')}</span><strong>{t('influence.exactRoots')}</strong><small>{t('influence.extremaDetail')}</small></div>
    </div>
    <details style={{ margin: '8px 12px 12px' }}>
      <summary style={{ cursor: 'pointer', fontSize: 10, color: 'var(--muted)' }}>{t('influence.numericDetails')}</summary>
      <div className="education-kpis" style={{ marginTop: 8 }}>
        <div><span>{t('influence.interpolationCondition')}</span><strong>{finiteExponential(line.fit.interpolationConditionEstimate, 2)}</strong></div>
        <div><span>{t('influence.interpolationResidual')}</span><strong>{finiteExponential(line.fit.interpolationRelativeResidual, 2)}</strong></div>
        <div><span>{t('influence.pivotRatio')}</span><strong>{finiteExponential(line.fit.interpolationPivotRatio, 2)}</strong></div>
        <div><span>{t('influence.maximumStructuralCondition')}</span><strong>{finiteExponential(line.solver.maxConditionEstimate, 2)}</strong></div>
      </div>
    </details>
  </>;
};

const lineCurveSegments = (line: InfluenceLine | null): CurveSegment[] => line?.segments.map((segment) => ({
  x0: segment.pathStart,
  x1: segment.pathEnd,
  coefficients: segment.coefficients,
})) ?? [];

const trainCurveSegments = (train: AxleTrainEnvelope | null): CurveSegment[] => train?.segments.map((segment) => ({
  x0: segment.positionStart,
  x1: segment.positionEnd,
  coefficients: segment.coefficients,
})) ?? [];

export const InfluenceLineView = ({ project, selection = null, onCanvasStateChange }: InfluenceLineViewProps) => {
  const { t } = useI18n();
  const deformableMembers = useMemo(() => project.members.filter((member) => member.type !== 'rigid'), [project.members]);
  const frameMembers = useMemo(() => project.members.filter((member) => member.type === 'frame'), [project.members]);
  const selectedFrameIds = useMemo(() => selectionFrameIds(project, selection), [project, selection]);
  const selectedMemberId = selection?.kind === 'member'
    ? selection.id
    : selection?.kind === 'multi'
      ? selection.memberIds[0]
      : undefined;
  const initialTargetId = deformableMembers.some((member) => member.id === selectedMemberId)
    ? selectedMemberId ?? ''
    : frameMembers[0]?.id ?? deformableMembers[0]?.id ?? '';
  const [targetMemberId, setTargetMemberId] = useState(initialTargetId);
  const [targetX, setTargetX] = useState(() => memberDeformableLength(project, initialTargetId) / 2);
  const [quantity, setQuantity] = useState<InfluenceQuantity>('M');
  const [targetSide, setTargetSide] = useState<'left' | 'right'>('right');
  const [pathMemberIds, setPathMemberIds] = useState<string[]>(() => selectedFrameIds.length
    ? selectedFrameIds
    : frameMembers[0] ? [frameMembers[0].id] : []);
  const [subtab, setSubtab] = useState<InfluenceSubtab>('line');
  const [axles, setAxles] = useState<ConcentratedAxle[]>([
    { id: 'E1', P: 100, offset: 0 },
    { id: 'E2', P: 100, offset: 2 },
  ]);
  const [impactFactor, setImpactFactor] = useState(1);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<CursorReading | null>(null);
  const axleIdRef = useRef(3);
  const canvasCallbackRef = useRef(onCanvasStateChange);
  const { line, axleTrain, busy, error, run, clear } = useInfluenceAnalysis(project);
  const units = project.settings.units;
  const lengthUnit = unitLabel(units, 'length');
  const forceUnit = unitLabel(units, 'force');
  const momentUnit = unitLabel(units, 'moment');
  const targetLength = memberDeformableLength(project, targetMemberId);
  const targetLengthDisplay = toDisplay(targetLength, units, 'length');
  const rangeStep = Math.max(targetLengthDisplay / 200, 10 ** -6);

  useEffect(() => {
    canvasCallbackRef.current = onCanvasStateChange;
  }, [onCanvasStateChange]);

  useEffect(() => () => canvasCallbackRef.current?.(null), []);

  useEffect(() => {
    if (deformableMembers.some((member) => member.id === targetMemberId)) return;
    const next = frameMembers[0]?.id ?? deformableMembers[0]?.id ?? '';
    setTargetMemberId(next);
    setTargetX(memberDeformableLength(project, next) / 2);
  }, [deformableMembers, frameMembers, project, targetMemberId]);

  useEffect(() => {
    setTargetX((current) => clamp(current, 0, targetLength));
  }, [targetLength]);

  useEffect(() => {
    const validFrames = new Set(frameMembers.map((member) => member.id));
    setPathMemberIds((current) => {
      const valid = current.filter((id) => validFrames.has(id));
      return valid.length ? valid : frameMembers[0] ? [frameMembers[0].id] : [];
    });
  }, [frameMembers]);

  useEffect(() => {
    const callback = canvasCallbackRef.current;
    if (!callback) return;
    if (!line) {
      callback(null);
      return;
    }
    let source: InfluenceCanvasState['source'];
    if (subtab === 'line' && cursor) {
      const tolerance = Math.max(1, line.path.length) * 1e-10;
      const pathMember = line.path.members.find((member) => cursor.position < member.pathEnd - tolerance)
        ?? line.path.members.at(-1);
      if (pathMember) {
        const alongPath = clamp(cursor.position - pathMember.pathStart, 0, pathMember.length);
        const memberX = pathMember.reversed ? pathMember.length - alongPath : alongPath;
        source = {
          memberId: pathMember.memberId,
          ratio: pathMember.length > 0 ? memberX / pathMember.length : 0,
          ordinate: cursor.value,
        };
      }
    }
    callback({
      pathMemberIds: line.path.members.map((member) => member.memberId),
      target: {
        memberId: line.target.memberId,
        x: line.target.x,
        quantity: diagramQuantity(line.target.quantity),
      },
      source,
    });
  }, [cursor, line, subtab]);

  const invalidate = useCallback(() => {
    clear();
    setCursor(null);
    setLocalError(null);
  }, [clear]);

  const useSelectionAsPath = () => {
    if (!selectedFrameIds.length) {
      setLocalError(t('influence.errorSelectionNoFrames'));
      return;
    }
    invalidate();
    setPathMemberIds(selectedFrameIds);
  };

  const calculate = () => {
    setLocalError(null);
    if (!targetMemberId || targetLength <= 0) {
      setLocalError(t('influence.errorSelectTarget'));
      return;
    }
    if (!pathMemberIds.length) {
      setLocalError(t('influence.errorSelectPath'));
      return;
    }
    if (axles.length < 1 || axles.length > 4) {
      setLocalError(t('influence.errorAxleCount'));
      return;
    }
    if (axles.some((axle) => !Number.isFinite(axle.P) || axle.P <= 0 || !Number.isFinite(axle.offset))) {
      setLocalError(t('influence.errorInvalidAxle'));
      return;
    }
    if (!Number.isFinite(impactFactor) || impactFactor < 1) {
      setLocalError(t('influence.errorImpactFactor'));
      return;
    }
    setCursor(null);
    run({
      pathMemberIds,
      target: { memberId: targetMemberId, x: targetX, quantity, side: targetSide },
      train: { axles, impactFactor },
    });
  };

  const updateAxle = (index: number, changes: Partial<ConcentratedAxle>) => {
    invalidate();
    setAxles((current) => current.map((axle, axleIndex) => axleIndex === index ? { ...axle, ...changes } : axle));
  };

  const addAxle = () => {
    if (axles.length >= 4) return;
    invalidate();
    const spacing = Math.max(targetLength / 4, 1);
    const lastOffset = axles.at(-1)?.offset ?? -spacing;
    const id = `E${axleIdRef.current}`;
    axleIdRef.current += 1;
    setAxles((current) => [...current, { id, P: 100, offset: lastOffset + spacing }]);
  };

  const removeAxle = (index: number) => {
    if (axles.length <= 1) return;
    invalidate();
    setAxles((current) => current.filter((_, axleIndex) => axleIndex !== index));
  };

  const lineSegments = useMemo(() => lineCurveSegments(line), [line]);
  const trainSegments = useMemo(() => trainCurveSegments(axleTrain), [axleTrain]);
  const lineJumps = useMemo(() => line?.jumps.map((jump) => ({ x: jump.position, left: jump.left, right: jump.right })) ?? [], [line]);
  const trainJumps = useMemo(() => deriveJumps(trainSegments), [trainSegments]);
  const lineValueAt = useCallback((position: number) => line ? evaluateInfluenceLine(line, position, 'right') ?? 0 : 0, [line]);
  const trainValueAt = useCallback((position: number) => axleTrain ? evaluateAxleTrain(axleTrain, position, 'right') : 0, [axleTrain]);
  const formatPathX = useCallback((position: number) => `${formatFixed(toDisplay(position, units, 'length'), 3)} ${lengthUnit}`, [lengthUnit, units]);
  const formatInfluenceValue = useCallback((value: number) => quantity === 'M'
    ? `${formatSignificant(toDisplay(value, units, 'length'), 5)} ${lengthUnit}`
    : formatSignificant(value, 5), [lengthUnit, quantity, units]);
  const formatTrainValue = useCallback((value: number) => quantity === 'M'
    ? `${formatSignificant(toDisplay(value, units, 'moment'), 5)} ${momentUnit}`
    : `${formatSignificant(toDisplay(value, units, 'force'), 5)} ${forceUnit}`, [forceUnit, momentUnit, quantity, units]);
  const pathSummary = pathMemberIds.length
    ? t(pathMemberIds.length === 1 ? 'influence.pathSummaryOne' : 'influence.pathSummaryMany', {
        count: pathMemberIds.length,
        members: pathMemberIds.join(' → '),
      })
    : t('influence.noPath');
  const displayedError = localError ?? error;

  return <section className="education-explorer influence-line-view" aria-label={t('influence.regionLabel')}>
    <div className="education-explorer-heading">
      <div><strong>{t('influence.title')}</strong><small>{t('influence.subtitle')}</small></div>
      <span>{busy ? t('influence.calculating') : line ? t('influence.analysisCount', { count: line.solver.analyses }) : 'N · V · M'}</span>
    </div>
    <div className="education-stage" style={{ display: 'grid', gap: 12 }}>
      <div style={controlGridStyle}>
        <label style={fieldStyle}><span>{t('influence.targetResponse')}</span><div className="response-selector" role="group" aria-label={t('influence.responseGroup')}>
          {(['N', 'V', 'M'] as const).map((item) => <button type="button" aria-pressed={quantity === item} className={quantity === item ? 'active' : ''} key={item} onClick={() => { invalidate(); setQuantity(item); }}>{item}</button>)}
        </div></label>
        <label style={fieldStyle}><span>{t('influence.targetMember')}</span><select style={inputStyle} value={targetMemberId} onChange={(event) => {
          const memberId = event.currentTarget.value;
          invalidate();
          setTargetMemberId(memberId);
          setTargetX(memberDeformableLength(project, memberId) / 2);
        }}>{deformableMembers.map((member) => <option value={member.id} key={member.id}>{member.label ? `${member.id} · ${member.label}` : member.id}</option>)}</select></label>
        <label style={fieldStyle}><span>{t('influence.cutLimit')}</span><select style={inputStyle} value={targetSide} onChange={(event) => { invalidate(); setTargetSide(event.currentTarget.value as 'left' | 'right'); }}><option value="right">{t('influence.right')}</option><option value="left">{t('influence.left')}</option></select></label>
        <div style={fieldStyle}><span>{t('influence.loadPath')}</span><button type="button" style={secondaryButtonStyle} disabled={!selectedFrameIds.length || busy} onClick={useSelectionAsPath}>{t('influence.useSelection', { count: selectedFrameIds.length })}</button></div>
      </div>
      <label style={fieldStyle}>
        <span>{t('influence.targetSection', { length: formatFixed(targetLengthDisplay, 3), unit: lengthUnit })}</span>
        <div style={rowStyle}>
          <input style={{ flex: '1 1 260px' }} type="range" min={0} max={targetLengthDisplay || 0} step={rangeStep} value={toDisplay(targetX, units, 'length')} onChange={(event) => { invalidate(); setTargetX(fromDisplay(event.currentTarget.valueAsNumber, units, 'length')); }} />
          <span className="number-control" style={{ width: 150 }}><input aria-label={t('influence.cutCoordinate')} type="number" min={0} max={targetLengthDisplay || 0} step={rangeStep} value={toDisplay(targetX, units, 'length')} onChange={(event) => {
            if (!Number.isFinite(event.currentTarget.valueAsNumber)) return;
            invalidate();
            setTargetX(clamp(fromDisplay(event.currentTarget.valueAsNumber, units, 'length'), 0, targetLength));
          }} /><small>{lengthUnit}</small></span>
        </div>
      </label>
      <div style={rowStyle}>
        <small style={{ flex: '1 1 280px', color: 'var(--muted)' }}>{pathSummary}</small>
        <button type="button" disabled={busy || !frameMembers.length || !deformableMembers.length} onClick={calculate}>{busy ? t('influence.calculating') : t('influence.calculate')}</button>
      </div>
      {displayedError ? <div className="issue-card error" role="alert"><span className="issue-icon">!</span><div><strong>{t('influence.calculationErrorTitle')}</strong><p>{displayedError}</p></div></div> : null}
    </div>

    <div className="education-stage-tabs" role="tablist" aria-label={t('influence.viewLabel')}>
      <button type="button" role="tab" aria-selected={subtab === 'line'} className={subtab === 'line' ? 'active' : ''} onClick={() => { setCursor(null); setSubtab('line'); }}>{t('influence.title')}</button>
      <button type="button" role="tab" aria-selected={subtab === 'train'} className={subtab === 'train' ? 'active' : ''} onClick={() => { setCursor(null); setSubtab('train'); }}>{t('influence.axleTrain')}</button>
    </div>

    {subtab === 'train' ? <div className="education-stage" style={{ display: 'grid', gap: 10 }}>
      <div style={rowStyle}><strong style={{ fontSize: 11, flex: 1 }}>{t('influence.localEditor', { count: axles.length })}</strong><label style={{ ...fieldStyle, gridTemplateColumns: 'auto 100px', alignItems: 'center' }}><span>{t('influence.impact')}</span><input aria-label={t('influence.impactFactor')} style={inputStyle} type="number" min={1} step={0.01} value={impactFactor} onChange={(event) => { if (!Number.isFinite(event.currentTarget.valueAsNumber)) return; invalidate(); setImpactFactor(event.currentTarget.valueAsNumber); }} /></label><button type="button" style={secondaryButtonStyle} disabled={axles.length >= 4} onClick={addAxle}>{t('influence.addAxle')}</button></div>
      <div className="table-wrap"><table className="results-table"><thead><tr><th>{t('influence.axle')}</th><th>{t('influence.positiveLoad', { unit: forceUnit })}</th><th>{t('influence.offset', { unit: lengthUnit })}</th><th>{t('influence.action')}</th></tr></thead><tbody>{axles.map((axle, index) => <tr key={axle.id ?? index}><td><strong>{axle.id ?? `E${index + 1}`}</strong></td><td><input aria-label={t('influence.axleLoad', { index: index + 1 })} style={inputStyle} type="number" min={0} step="any" value={toDisplay(axle.P, units, 'force')} onChange={(event) => { if (Number.isFinite(event.currentTarget.valueAsNumber)) updateAxle(index, { P: fromDisplay(event.currentTarget.valueAsNumber, units, 'force') }); }} /></td><td><input aria-label={t('influence.axleOffset', { index: index + 1 })} style={inputStyle} type="number" step="any" value={toDisplay(axle.offset, units, 'length')} onChange={(event) => { if (Number.isFinite(event.currentTarget.valueAsNumber)) updateAxle(index, { offset: fromDisplay(event.currentTarget.valueAsNumber, units, 'length') }); }} /></td><td><button type="button" style={secondaryButtonStyle} disabled={axles.length <= 1} onClick={() => removeAxle(index)}>{t('influence.remove')}</button></td></tr>)}</tbody></table></div>
      <small style={{ color: 'var(--muted)' }}>{t('influence.trainHelp')}</small>
    </div> : null}

    {!line && !busy ? <div className="empty-small">{t('influence.emptyPrompt')}</div> : null}
    {busy ? <div className="empty-small" aria-live="polite">{t('influence.busyMessage')}</div> : null}

    {line && subtab === 'line' ? <>
      <div className="education-stage" style={{ paddingBottom: 0 }}><div className="education-kpis">
        <div><span>{t('influence.minimum')}</span><strong>{formatInfluenceValue(line.minimum.value)}</strong><small>x {formatPathX(line.minimum.position)}</small></div>
        <div><span>{t('influence.maximum')}</span><strong>{formatInfluenceValue(line.maximum.value)}</strong><small>x {formatPathX(line.maximum.position)}</small></div>
        <div><span>{t('influence.routeLength')}</span><strong>{formatPathX(line.path.length)}</strong><small>{t(line.path.members.length === 1 ? 'influence.orderedMemberOne' : 'influence.orderedMemberMany', { count: line.path.members.length })}</small></div>
        <div><span>{t('influence.representation')}</span><strong>{t(line.segments.length === 1 ? 'influence.cubicOne' : 'influence.cubicMany', { count: line.segments.length })}</strong><small>{t(line.jumps.length === 1 ? 'influence.explicitJumpOne' : 'influence.explicitJumpMany', { count: line.jumps.length })}</small></div>
      </div></div>
      <ExactPolynomialChart
        ariaLabel={t('influence.lineChartLabel', { quantity, member: line.target.memberId, position: formatPathX(line.target.x) })}
        colorClass={curveClass(quantity)}
        segments={lineSegments}
        jumps={lineJumps}
        domain={[0, line.path.length]}
        minimum={{ x: line.minimum.position, value: line.minimum.value, label: t('influence.minimumShort') }}
        maximum={{ x: line.maximum.position, value: line.maximum.value, label: t('influence.maximumShort') }}
        valueAt={lineValueAt}
        formatX={formatPathX}
        formatY={formatInfluenceValue}
        xAxisLabel={t('influence.routePosition', { unit: lengthUnit })}
        yAxisLabel={quantity === 'M' ? `ψM (${lengthUnit})` : `ψ${quantity} (${t('influence.dimensionless')})`}
        onCursorChange={setCursor}
      />
      <InfluenceDiagnostics line={line} />
    </> : null}

    {line && subtab === 'train' && axleTrain ? <>
      <div className="education-stage" style={{ paddingBottom: 0 }}><div className="education-kpis">
        <div><span>{t('influence.trainMinimum')}</span><strong>{formatTrainValue(axleTrain.minimum.value)}</strong><small>{t('influence.referenceShort')} {formatPathX(axleTrain.minimum.referencePosition)}</small></div>
        <div><span>{t('influence.trainMaximum')}</span><strong>{formatTrainValue(axleTrain.maximum.value)}</strong><small>{t('influence.referenceShort')} {formatPathX(axleTrain.maximum.referencePosition)}</small></div>
        <div><span>{t('influence.referenceDomain')}</span><strong>{formatPathX(axleTrain.domain[1] - axleTrain.domain[0])}</strong><small>{t('influence.rangeFromTo', { from: formatPathX(axleTrain.domain[0]), to: formatPathX(axleTrain.domain[1]) })}</small></div>
        <div><span>{t('influence.solution')}</span><strong>{t(axleTrain.segments.length === 1 ? 'influence.cubicOne' : 'influence.cubicMany', { count: axleTrain.segments.length })}</strong><small>φ = {formatFixed(axleTrain.train.impactFactor, 3)} · {t(axleTrain.train.axles.length === 1 ? 'influence.axleCountOne' : 'influence.axleCountMany', { count: axleTrain.train.axles.length })}</small></div>
      </div></div>
      <ExactPolynomialChart
        ariaLabel={t('influence.trainChartLabel', { quantity, member: line.target.memberId })}
        colorClass={curveClass(quantity)}
        segments={trainSegments}
        jumps={trainJumps}
        domain={axleTrain.domain}
        minimum={{ x: axleTrain.minimum.referencePosition, value: axleTrain.minimum.value, label: t('influence.minimumShort') }}
        maximum={{ x: axleTrain.maximum.referencePosition, value: axleTrain.maximum.value, label: t('influence.maximumShort') }}
        valueAt={trainValueAt}
        formatX={formatPathX}
        formatY={formatTrainValue}
        xAxisLabel={t('influence.referencePosition', { unit: lengthUnit })}
        yAxisLabel={quantity === 'M' ? momentUnit : forceUnit}
        onCursorChange={setCursor}
      />
      <details style={{ margin: '0 12px 12px' }}><summary style={{ cursor: 'pointer', fontSize: 10, color: 'var(--muted)' }}>{t('influence.exactAxlePositions')}</summary><div style={{ ...controlGridStyle, marginTop: 8 }}>{([[t('influence.minimum'), axleTrain.minimum], [t('influence.maximum'), axleTrain.maximum]] as const).map(([label, extreme]) => <div className="matrix-view" style={{ marginTop: 0 }} key={label}><div className="matrix-view-heading"><strong>{label}</strong><span>{t('influence.referenceShort')} {formatPathX(extreme.referencePosition)}</span></div><div style={{ padding: 9, display: 'grid', gap: 4 }}>{extreme.axlePositions.map((position, index) => <small key={`${position.id}-${index}`} style={{ color: position.onPath ? 'var(--text)' : 'var(--muted)' }}>{position.id ?? `E${index + 1}`}: {formatPathX(position.position)} · {position.onPath ? t('influence.onPath') : t('influence.offPath')}</small>)}</div></div>)}</div></details>
      <InfluenceDiagnostics line={line} />
    </> : null}
  </section>;
};
