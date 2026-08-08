import { useEffect, useMemo, useState } from 'react';
import { fromDisplay, toDisplay, unitLabel } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import { useClassroomSession, type ClassroomPredictionSign } from '../../store/ClassroomSessionContext';
import type { DiagramQuantity, ProjectModel } from '../../types';

const quantities: Array<{ id: DiagramQuantity; symbol: string; unitQuantity: 'force' | 'moment' }> = [
  { id: 'axial', symbol: 'N', unitQuantity: 'force' },
  { id: 'shear', symbol: 'V', unitQuantity: 'force' },
  { id: 'moment', symbol: 'M', unitQuantity: 'moment' },
];

export const ClassroomPredictionForm = ({
  project,
  preferredMemberId,
  onContinue,
}: {
  project: ProjectModel;
  preferredMemberId?: string;
  onContinue?: () => void;
}) => {
  const { t } = useI18n();
  const session = useClassroomSession();
  const memberIds = useMemo(() => project.members.filter((member) => member.type !== 'rigid').map((member) => member.id), [project.members]);
  const defaultMemberId = preferredMemberId && memberIds.includes(preferredMemberId) ? preferredMemberId : memberIds[0] ?? '';
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [activeQuantity, setActiveQuantity] = useState<DiagramQuantity>('moment');
  useEffect(() => {
    if (!memberIds.includes(memberId)) setMemberId(defaultMemberId);
  }, [defaultMemberId, memberId, memberIds]);
  const visibleQuantities = quantities;

  return <section className="classroom-prediction" aria-labelledby="classroom-prediction-title">
    <header>
      <div><span>{t('classroom.eyebrow')}</span><h3 id="classroom-prediction-title" tabIndex={-1}>{t('classroom.predictionTitle')}</h3></div>
      <p>{t('classroom.predictionBody')}</p>
    </header>
    <label className="classroom-prediction__member">
      <span>{t('classroom.predictionMember')}</span>
      <select value={memberId} onChange={(event) => setMemberId(event.currentTarget.value)} disabled={!memberIds.length}>
        {memberIds.length ? memberIds.map((id) => <option key={id} value={id}>{id}</option>) : <option value="">—</option>}
      </select>
    </label>
    <div className="classroom-prediction__quantity-tabs" role="tablist" aria-label={t('classroom.predictionTitle')}>
      {visibleQuantities.map((quantity, index) => <button
        id={`classroom-prediction-tab-${quantity.id}`}
        key={quantity.id}
        type="button"
        role="tab"
        aria-controls={`classroom-prediction-panel-${quantity.id}`}
        aria-selected={activeQuantity === quantity.id}
        tabIndex={activeQuantity === quantity.id ? 0 : -1}
        onClick={() => setActiveQuantity(quantity.id)}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const nextIndex = event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? visibleQuantities.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + visibleQuantities.length) % visibleQuantities.length;
          const next = visibleQuantities[nextIndex];
          setActiveQuantity(next.id);
          window.requestAnimationFrame(() => document.getElementById(`classroom-prediction-tab-${next.id}`)?.focus());
        }}
      >{quantity.symbol}</button>)}
    </div>
    {visibleQuantities.map((quantity) => {
      const storedValue = session.predictions[memberId]?.[quantity.id];
      const displayValue = storedValue === undefined ? '' : String(toDisplay(storedValue, project.settings.units, quantity.unitQuantity));
      const sign = session.signPredictions[memberId]?.[quantity.id] ?? '';
      return <div
        id={`classroom-prediction-panel-${quantity.id}`}
        key={quantity.id}
        className={`classroom-prediction__question${activeQuantity === quantity.id ? ' is-active' : ''}`}
        role="tabpanel"
        aria-labelledby={`classroom-prediction-tab-${quantity.id}`}
        hidden={activeQuantity !== quantity.id}
      >
        <strong>{quantity.symbol}</strong>
        <label>
          <span>{t('classroom.predictionSign')}</span>
          <select value={sign} onChange={(event) => session.setSignPrediction(memberId, quantity.id, (event.currentTarget.value || null) as ClassroomPredictionSign | null)}>
            <option value="">{t('classroom.signEmpty')}</option>
            <option value="positive">{t('classroom.signPositive')}</option>
            <option value="negative">{t('classroom.signNegative')}</option>
            <option value="zero">{t('classroom.signZero')}</option>
            <option value="changes">{t('classroom.signChanges')}</option>
          </select>
        </label>
        <label>
          <span>{t('classroom.predictionMagnitude')}</span>
          <span className="classroom-prediction__numeric"><input
            aria-label={t('classroom.predictionMagnitude')}
            aria-describedby={`classroom-prediction-unit-${quantity.id}`}
            type="number"
            inputMode="decimal"
            value={displayValue}
            placeholder="—"
            onChange={(event) => {
              const value = event.currentTarget.value;
              session.setPrediction(memberId, quantity.id, value === '' ? null : fromDisplay(event.currentTarget.valueAsNumber, project.settings.units, quantity.unitQuantity));
            }}
          /><em id={`classroom-prediction-unit-${quantity.id}`}>{unitLabel(project.settings.units, quantity.unitQuantity)}</em></span>
        </label>
      </div>;
    })}
    <div className="classroom-prediction__footer">
      <p role="status">{session.hasPredictions ? t('classroom.predictionReady') : t('classroom.predictionRequired')}</p>
      {onContinue ? <button type="button" disabled={!session.hasPredictions || !memberId} onClick={onContinue}>{t('classroom.continueToAnalysis')}</button> : null}
    </div>
  </section>;
};
