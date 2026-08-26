import { memo, useMemo } from 'react';
import type { MemberResult, ProjectModel } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';
import { toDisplay, unitLabel } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
import { buildDiagramStack, type DiagramStackLane, type StackQuantity } from './diagramStack';

type Units = ProjectModel['settings']['units'];
type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

export interface CanvasDiagramStackProps {
  memberId: string;
  result: MemberResult;
  quantities: readonly StackQuantity[];
  /** Recuadro del modelo en pantalla: el despliegue cuelga de su borde inferior. */
  modelScreenBounds: { minX: number; maxX: number; maxY: number };
  units: Units;
  t: Translate;
}

/** Ancho mínimo del despliegue: una estructura vertical no deja huella horizontal de la que colgar los carriles. */
const MIN_WIDTH = 180;
const LANE_HEIGHT = 88;
const LANE_GAP = 12;
/**
 * Aire entre el borde inferior del modelo y el primer carril. Tiene que dejar
 * pasar lo que ya cuelga de los apoyos —flechas y rótulos de reacción— o el
 * primer carril nace encima de ellos.
 */
const STACK_OFFSET = 104;

const labelKeyFor: Readonly<Record<StackQuantity, TranslationKey>> = {
  axial: 'results.axial',
  shear: 'results.shear',
  moment: 'results.moment',
};

const CanvasDiagramStackImpl = ({ memberId, result, quantities, modelScreenBounds, units, t }: CanvasDiagramStackProps) => {
  const rect = useMemo(() => {
    const span = modelScreenBounds.maxX - modelScreenBounds.minX;
    const width = Math.max(MIN_WIDTH, span);
    const center = (modelScreenBounds.minX + modelScreenBounds.maxX) / 2;
    return {
      x: center - width / 2,
      y: modelScreenBounds.maxY + STACK_OFFSET,
      width,
      laneHeight: LANE_HEIGHT,
      laneGap: LANE_GAP,
    };
  }, [modelScreenBounds]);

  const lanes = useMemo(() => buildDiagramStack(result, quantities, rect), [result, quantities, rect]);
  if (!lanes.length) return null;

  const readingFor = (lane: DiagramStackLane, value: number) => {
    const kind = lane.quantity === 'moment' ? 'moment' as const : 'force' as const;
    return `${formatFixed(toDisplay(value, units, kind), 2)} ${unitLabel(units, kind)}`;
  };

  return <g
    className="diagram-stack-layer"
    data-canvas-layer="diagram-stack"
    data-stack-member={memberId}
    aria-label={t('canvas.evidenceStackMember', { member: memberId })}
    pointerEvents="none"
  >
    <text className="diagram-stack-title" x={rect.x} y={rect.y - 14}>{t('canvas.evidenceStackMember', { member: memberId })}</text>
    {lanes.map((lane) => {
      const peak = lane.extremes.reduce<DiagramStackLane['extremes'][number] | null>(
        (best, extreme) => (!best || Math.abs(extreme.value) > Math.abs(best.value) ? extreme : best),
        null,
      );
      return <g key={lane.quantity} className={`diagram-stack-lane ${lane.quantity}`} data-stack-lane={lane.quantity}>
        <line className="diagram-stack-baseline" x1={lane.left} y1={lane.baselineY} x2={lane.right} y2={lane.baselineY} />
        <path className="diagram-stack-fill" d={lane.fillPath} />
        <path className="diagram-stack-line" d={lane.linePath} />
        {lane.extremes.map((extreme) => <circle
          key={extreme.kind}
          className={`diagram-stack-extreme is-${extreme.kind}`}
          cx={extreme.screen.x}
          cy={extreme.screen.y}
          r="3.2"
        />)}
        <text className="diagram-stack-caption" x={lane.left} y={lane.top + 10}>
          {peak
            ? `${lane.symbol} · ${t('results.maximum')} ${readingFor(lane, peak.value)}`
            : `${lane.symbol} · ${t(labelKeyFor[lane.quantity])}`}
        </text>
      </g>;
    })}
  </g>;
};

export const CanvasDiagramStack = memo(CanvasDiagramStackImpl);
