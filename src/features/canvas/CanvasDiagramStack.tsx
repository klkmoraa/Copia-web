import { memo, useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import type { MemberResult, ProjectModel } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';
import { toDisplay, unitLabel } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
import {
  buildDiagramStack,
  laneScreenX,
  laneScreenY,
  snapStation,
  stationFromScreenX,
  stationReadings,
  stackMetricsFor,
  type StackQuantity,
} from './diagramStack';

type Units = ProjectModel['settings']['units'];
type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

export interface CanvasDiagramStackProps {
  memberId: string;
  result: MemberResult;
  quantities: readonly StackQuantity[];
  /** Recuadro del modelo en pantalla: el despliegue cuelga de su borde inferior. */
  modelScreenBounds: { minX: number; maxX: number; maxY: number };
  /** Alto del lienzo: de él salen el alto de carril y el aire bajo el modelo. */
  viewportHeight: number;
  /** Estación leída, en coordenadas del miembro. `null` cuando no hay lectura. */
  cursorX: number | null;
  onCursorChange: (x: number | null) => void;
  units: Units;
  lengthLabel: string;
  t: Translate;
}

/** Ancho mínimo del despliegue: una estructura vertical no deja huella horizontal de la que colgar los carriles. */
const MIN_WIDTH = 180;
/** Holgura para que la lectura no salga cortada por el borde derecho del carril. */
const READING_FLIP_MARGIN = 96;

const nameKeyFor: Readonly<Record<StackQuantity, TranslationKey>> = {
  axial: 'results.axial',
  shear: 'results.shear',
  moment: 'results.moment',
};

const CanvasDiagramStackImpl = ({
  memberId, result, quantities, modelScreenBounds, viewportHeight, cursorX, onCursorChange, units, lengthLabel, t,
}: CanvasDiagramStackProps) => {
  const rect = useMemo(() => {
    const metrics = stackMetricsFor(viewportHeight, quantities.length);
    const span = modelScreenBounds.maxX - modelScreenBounds.minX;
    const width = Math.max(MIN_WIDTH, span);
    const center = (modelScreenBounds.minX + modelScreenBounds.maxX) / 2;
    return {
      x: center - width / 2,
      y: modelScreenBounds.maxY + metrics.offset,
      width,
      laneHeight: metrics.laneHeight,
      laneGap: metrics.laneGap,
    };
  }, [modelScreenBounds, quantities.length, viewportHeight]);

  const lanes = useMemo(() => buildDiagramStack(result, quantities, rect), [result, quantities, rect]);
  const readings = useMemo(
    () => (cursorX === null || !lanes.length ? null : stationReadings(result, cursorX)),
    [cursorX, lanes.length, result],
  );
  if (!lanes.length) return null;

  const first = lanes[0];
  const last = lanes[lanes.length - 1];
  const unitKindFor = (quantity: StackQuantity) => (quantity === 'moment' ? 'moment' as const : 'force' as const);
  const readingFor = (quantity: StackQuantity, value: number) =>
    `${formatFixed(toDisplay(value, units, unitKindFor(quantity)), 2)} ${unitLabel(units, unitKindFor(quantity))}`;

  /**
   * La lectura sale del propio dibujo: el puntero da una x de pantalla, se
   * convierte a estación y se imanta a la estación notable más cercana. No hay
   * un segundo cursor — se publica en el mismo `resultCursor` que ya mueve la
   * marca sobre la barra y el panel de resultados.
   */
  const readStation = (event: ReactPointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    const raw = stationFromScreenX(first, result.length, event.clientX - bounds.left);
    onCursorChange(snapStation(result, raw));
  };

  const cursorScreenX = cursorX === null ? null : laneScreenX(first, cursorX);
  const flip = cursorScreenX !== null && cursorScreenX > first.right - READING_FLIP_MARGIN;

  return <g
    className="diagram-stack-layer"
    data-canvas-layer="diagram-stack"
    data-stack-member={memberId}
    aria-label={t('canvas.evidenceStackMember', { member: memberId })}
  >
    <text className="diagram-stack-title" x={rect.x} y={rect.y - 16}>
      {t('canvas.evidenceStackMember', { member: memberId })}
      <tspan className="diagram-stack-title__span" dx="8">
        {t('canvas.evidenceStackSpan', { length: `${formatFixed(toDisplay(result.length, units, 'length'), 2)} ${lengthLabel}` })}
      </tspan>
    </text>

    {lanes.map((lane) => {
      const reading = readings?.find((item) => item.quantity === lane.quantity) ?? null;
      return <g key={lane.quantity} className={`diagram-stack-lane ${lane.quantity}`} data-stack-lane={lane.quantity}>
        <line className="diagram-stack-baseline" x1={lane.left} y1={lane.baselineY} x2={lane.right} y2={lane.baselineY} />
        <path className="diagram-stack-fill" d={lane.fillPath} />
        <path className="diagram-stack-line" d={lane.linePath} />
        {/* El rótulo vive FUERA del carril, a su izquierda, como la fila de un
            small multiple: dentro se peleaba con el extremo que casi siempre
            cae en el arranque de la barra (el V máx de una viga vive en x=0). */}
        <text className="diagram-stack-caption" x={lane.left - 12} y={lane.baselineY - 2} textAnchor="end">
          <title>{t(nameKeyFor[lane.quantity])}</title>
          {lane.symbol}
          <tspan className="diagram-stack-caption__unit" x={lane.left - 12} dy="13">
            {unitLabel(units, unitKindFor(lane.quantity))}
          </tspan>
        </text>
        {/* Los extremos ya sellados se apagan mientras hay lectura activa: dos
            números sobre la misma curva compiten, y el que el usuario está
            buscando en ese momento es el del cursor. */}
        <g className={`diagram-stack-extremes${reading ? ' is-dimmed' : ''}`}>
          {lane.extremes.map((extreme) => {
            const anchorRight = extreme.screen.x > lane.right - READING_FLIP_MARGIN;
            return <g key={extreme.kind} data-stack-extreme={`${lane.quantity}:${extreme.kind}`}>
              <circle className={`diagram-stack-extreme is-${extreme.kind}`} cx={extreme.screen.x} cy={extreme.screen.y} r="3.2" />
              <text
                className="diagram-stack-extreme-label"
                x={extreme.screen.x + (anchorRight ? -7 : 7)}
                y={extreme.screen.y + (extreme.value >= 0 ? -7 : 15)}
                textAnchor={anchorRight ? 'end' : 'start'}
              >{readingFor(lane.quantity, extreme.value)}</text>
            </g>;
          })}
        </g>
        {reading ? <g className="diagram-stack-reading" data-stack-reading={lane.quantity}>
          <circle cx={laneScreenX(lane, cursorX ?? 0)} cy={laneScreenY(lane, reading.value)} r="4" />
          <text
            x={laneScreenX(lane, cursorX ?? 0) + (flip ? -9 : 9)}
            y={laneScreenY(lane, reading.value) - 8}
            textAnchor={flip ? 'end' : 'start'}
          >{reading.jump
            ? t('results.discontinuityReading', {
              left: formatFixed(toDisplay(reading.jump.left, units, unitKindFor(lane.quantity)), 2),
              right: formatFixed(toDisplay(reading.jump.right, units, unitKindFor(lane.quantity)), 2),
              unit: unitLabel(units, unitKindFor(lane.quantity)),
            })
            : readingFor(lane.quantity, reading.value)}</text>
        </g> : null}
      </g>;
    })}

    {/* El cursor cruza los tres carriles: leer N, V y M en la MISMA sección es
        justamente lo que un despliegue apilado permite y tres diagramas por
        turnos no. */}
    {cursorScreenX !== null ? <g className="diagram-stack-cursor" data-stack-cursor pointerEvents="none">
      <line x1={cursorScreenX} y1={first.top} x2={cursorScreenX} y2={last.top + last.height} />
      <text
        className="diagram-stack-cursor__station"
        x={cursorScreenX + (flip ? -8 : 8)}
        y={first.top - 6}
        textAnchor={flip ? 'end' : 'start'}
      >{`x ${formatFixed(toDisplay(cursorX ?? 0, units, 'length'), 3)} ${lengthLabel}`}</text>
    </g> : null}

    {/* La zona sensible va al final para quedar por encima, y no captura el
        `pointerdown`: encuadrar y seleccionar con caja siguen funcionando
        sobre el despliegue como sobre cualquier otro punto vacío del lienzo. */}
    <rect
      className="diagram-stack-surface"
      data-stack-surface
      x={rect.x}
      y={first.top}
      width={rect.width}
      height={last.top + last.height - first.top}
      onPointerMove={readStation}
      onPointerLeave={() => onCursorChange(null)}
    />
  </g>;
};

export const CanvasDiagramStack = memo(CanvasDiagramStackImpl);
