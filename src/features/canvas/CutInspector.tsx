import { memo } from 'react';
import type { LeftCutEquilibrium } from '../../engine/cut';
import { toDisplay } from '../../engine/units';
import { formatFixed, formatScientific } from '../../utils/numberFormat';
import type { ElasticIndexPaint } from '../results/elasticDemand';
import { clamp, type CutInfo } from './canvasVocabulary';
import type { UnitSystemId } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';

export type CutDemand =
  | ({ status: 'available'; ratio: number } & ElasticIndexPaint)
  | { status: 'unavailable' }
  | null;

export interface CutInspectorProps {
  cut: CutInfo;
  cutDemand: CutDemand;
  cutEquilibrium: LeftCutEquilibrium | null;
  hostLeft: number;
  hostTop: number;
  size: { width: number; height: number };
  units: UnitSystemId;
  lengthLabel: string;
  forceLabel: string;
  momentLabel: string;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

/** Tooltip flotante con el diagrama de cuerpo libre y las ecuaciones de equilibrio de un corte. */
export const CutInspector = memo(({
  cut,
  cutDemand,
  cutEquilibrium,
  hostLeft,
  hostTop,
  size,
  units,
  lengthLabel,
  forceLabel,
  momentLabel,
  t,
}: CutInspectorProps) => {
  if (!cut.point) return null;
  const point = cut.point;
  return (
    <div className="cut-tooltip" style={{ left: clamp(cut.clientX - hostLeft + 14, 10, Math.max(10, size.width - 350)), top: clamp(cut.clientY - hostTop + 14, 10, Math.max(10, size.height - 390)) }}>
      <div className="cut-title-row">
        <strong>{t('canvas.cutTitle', { member: cut.memberId })}</strong>
        {cutDemand ? <span
          className="cut-demand-badge"
          data-status={cutDemand.status}
          data-at-reference={cutDemand.status === 'available' && cutDemand.atReference ? 'true' : undefined}
          title={t(cutDemand.status === 'available' ? 'canvas.cutDemandHint' : 'canvas.cutDemandUnavailableHint')}
        >{cutDemand.status === 'available'
          ? `η ${formatFixed(cutDemand.ratio, 2)}`
          : t('canvas.cutDemandUnavailable')}</span> : null}
        <span>{t(cut.pinned ? 'canvas.pinned' : 'canvas.preview')}</span>
      </div>
      <span>x = {formatFixed(toDisplay(point.x, units, 'length'), 3)} {lengthLabel} <small className="cut-station">({formatFixed(cut.ratio * 100, 1)}% s/L)</small></span>
      <div className="cut-values">
        <span className="axial-text">N = {formatFixed(toDisplay(point.axial, units, 'force'), 3)} {forceLabel}</span>
        <span className="shear-text">V = {formatFixed(toDisplay(point.shear, units, 'force'), 3)} {forceLabel}</span>
        <span className="moment-text">M = {formatFixed(toDisplay(point.moment, units, 'moment'), 3)} {momentLabel}</span>
      </div>
      {cutEquilibrium ? (
        <div className="cut-equilibrium">
          <b>{t('canvas.leftSideFbd')}</b>
          <svg className="cut-fbd" viewBox="0 0 280 82" role="img" aria-label={t('canvas.fbdAria', { member: cut.memberId, x: formatFixed(point.x, 3) })}>
            <line className="cut-fbd-member" x1="24" y1="43" x2="232" y2="43" />
            <line className="cut-fbd-section" x1="232" y1="17" x2="232" y2="68" />
            <line className="cut-fbd-axis" x1="24" y1="70" x2="65" y2="70" />
            <line className="cut-fbd-axis" x1="24" y1="70" x2="24" y2="54" />
            <text x="68" y="74">+x</text><text x="8" y="55">+y</text>
            <text x="20" y="35">N₀, V₀, M₀</text>
            <text x="238" y="29" className="axial-text">N</text>
            <text x="238" y="45" className="shear-text">V</text>
            <text x="238" y="61" className="moment-text">M</text>
            {cutEquilibrium.resultants.filter((load) => load.kind !== 'moment').map((load, index) => {
              const px = 24 + (cutEquilibrium.x > 1e-12 ? Math.max(0, Math.min(1, load.sourceX / cutEquilibrium.x)) : 0) * 198;
              return <g key={`${load.kind}-${load.sourceX}-${index}`} className="cut-fbd-load"><line x1={px} y1="12" x2={px} y2="38" /><path d={`M ${px - 4} 33 L ${px} 40 L ${px + 4} 33 Z`} /><text x={px} y="10" textAnchor="middle">{load.kind === 'distributed' ? 'Rᵥ' : 'P'}</text></g>;
            })}
            <text x="140" y="80" textAnchor="middle">x = {formatFixed(toDisplay(cutEquilibrium.x, units, 'length'), 3)} {lengthLabel}</text>
          </svg>
          {cutEquilibrium.resultants.length ? <div className="cut-resultants"><small>{t('canvas.externalResultants')}</small>{cutEquilibrium.resultants.map((load, index) => <span key={`${load.kind}-${load.sourceX}-${index}`}><b>{t(load.kind === 'distributed' ? 'canvas.distributedKind' : load.kind === 'point' ? 'canvas.pointKind' : 'canvas.momentKind')}</b> x={formatFixed(toDisplay(load.sourceX, units, 'length'), 3)} {lengthLabel} · Fx={formatFixed(toDisplay(load.forceX, units, 'force'), 3)} {forceLabel} · Fy={formatFixed(toDisplay(load.forceY, units, 'force'), 3)} {forceLabel}{Math.abs(load.appliedMoment) > 1e-12 ? ` · M=${formatFixed(toDisplay(load.appliedMoment, units, 'moment'), 3)} ${momentLabel}` : ''}</span>)}</div> : <small className="cut-no-loads">{t('canvas.noExternalLoads')}</small>}
          {cutEquilibrium.symbolicEquations.map((equation) => <code key={equation}>{equation}</code>)}
          <div className="cut-substitution">
            <code>ΣFₓ = {formatFixed(toDisplay(-cutEquilibrium.start.axial, units, 'force'), 3)} + {formatFixed(toDisplay(cutEquilibrium.totals.forceX, units, 'force'), 3)} + {formatFixed(toDisplay(point.axial, units, 'force'), 3)} = {formatScientific(toDisplay(cutEquilibrium.residuals.forceX, units, 'force'), 1)} {forceLabel}</code>
            <code>ΣFᵧ = {formatFixed(toDisplay(cutEquilibrium.start.shear, units, 'force'), 3)} + {formatFixed(toDisplay(cutEquilibrium.totals.forceY, units, 'force'), 3)} − {formatFixed(toDisplay(point.shear, units, 'force'), 3)} = {formatScientific(toDisplay(cutEquilibrium.residuals.forceY, units, 'force'), 1)} {forceLabel}</code>
            <code>ΣM = {formatFixed(toDisplay(-cutEquilibrium.start.moment, units, 'moment'), 3)} − ({formatFixed(toDisplay(cutEquilibrium.start.shear, units, 'force'), 3)})({formatFixed(toDisplay(cutEquilibrium.x, units, 'length'), 3)}) + {formatFixed(toDisplay(cutEquilibrium.totals.momentAboutCut, units, 'moment'), 3)} + {formatFixed(toDisplay(point.moment, units, 'moment'), 3)} = {formatScientific(toDisplay(cutEquilibrium.residuals.moment, units, 'moment'), 1)} {momentLabel}</code>
          </div>
          <div className="cut-residuals">
            <span>rₓ = {formatScientific(toDisplay(cutEquilibrium.residuals.forceX, units, 'force'), 1)} {forceLabel}</span>
            <span>rᵧ = {formatScientific(toDisplay(cutEquilibrium.residuals.forceY, units, 'force'), 1)} {forceLabel}</span>
            <span>rₘ = {formatScientific(toDisplay(cutEquilibrium.residuals.moment, units, 'moment'), 1)} {momentLabel}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
});

CutInspector.displayName = 'CutInspector';
