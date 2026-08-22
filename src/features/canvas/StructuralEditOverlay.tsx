import { Move, MousePointer2, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { PreparedStructuralEdit } from '../../data/structuralEditing';
import { Button, Field, IconButton, SegmentedControl } from '../../design-system/components/controls';
import { UnitField } from '../../design-system/components/editor';
import { Surface } from '../../design-system/components/surface';
import { useI18n } from '../../i18n/useI18n';
import type { StructuralEditDraft, StructuralEditKind } from './structuralEditUi';

export interface StructuralEditCapabilities {
  structural: boolean;
  align: boolean;
  distribute: boolean;
}

export interface StructuralEditOverlayProps {
  available: boolean;
  /** Prevent the contextual Repeat affordance from occupying the same canvas corner. */
  repeatAvailable?: boolean;
  draft: StructuralEditDraft | null;
  capabilities: StructuralEditCapabilities;
  prepared: PreparedStructuralEdit | null;
  error: string;
  pointerArmed: boolean;
  lengthUnit: string;
  onStart: (kind: StructuralEditKind) => void;
  onKindChange: (kind: StructuralEditKind) => void;
  onDraftChange: (draft: StructuralEditDraft) => void;
  onTogglePointer: () => void;
  onApply: () => void;
  onCancel: () => void;
}

const withField = (
  draft: StructuralEditDraft,
  field: keyof StructuralEditDraft['fields'],
  value: string,
): StructuralEditDraft => ({ ...draft, fields: { ...draft.fields, [field]: value } });

export const StructuralEditOverlay = ({
  available,
  repeatAvailable = false,
  draft,
  capabilities,
  prepared,
  error,
  pointerArmed,
  lengthUnit,
  onStart,
  onKindChange,
  onDraftChange,
  onTogglePointer,
  onApply,
  onCancel,
}: StructuralEditOverlayProps) => {
  const { t } = useI18n();
  if (!available) return null;

  if (!draft) return <Button
    className={`structural-edit-launcher${repeatAvailable ? ' structural-edit-offset-for-repeat' : ''}`}
    data-structural-edit-launcher
    variant="secondary"
    size="touch"
    leadingIcon={<Move size={18} />}
    onClick={() => onStart('move')}
  >{t('canvas.structuralEditLauncher')}</Button>;

  const set = (field: keyof StructuralEditDraft['fields']) => (value: string) => onDraftChange(withField(draft, field, value));
  const pointerSupported = ['move', 'rotate', 'mirror', 'linear-array'].includes(draft.kind);
  const operationOptions = [
    { value: 'move', label: t('canvas.structuralEditMove') },
    { value: 'rotate', label: t('canvas.structuralEditRotate') },
    { value: 'mirror', label: t('canvas.structuralEditMirror') },
    { value: 'linear-array', label: t('canvas.structuralEditArray') },
    { value: 'align', label: t('canvas.structuralEditAlign'), disabled: !capabilities.align },
    { value: 'distribute', label: t('canvas.structuralEditDistribute'), disabled: !capabilities.distribute },
  ] as const;
  const summary = prepared
    ? t(
      prepared.createdNodeIds.length || prepared.createdMemberIds.length
        ? 'canvas.structuralEditCopiesSummary'
        : 'canvas.structuralEditSummary',
      {
        nodes: prepared.createdNodeIds.length || prepared.affectedNodeIds.length,
        members: prepared.createdMemberIds.length || prepared.affectedMemberIds.length,
      },
    )
    : '';

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  };

  return <Surface
    as="section"
    level="floating"
    className={`structural-edit-surface${repeatAvailable ? ' structural-edit-offset-for-repeat' : ''}`}
    aria-label={t('canvas.structuralEditTitle')}
    data-structural-edit-surface
  >
    <form onSubmit={(event) => { event.preventDefault(); onApply(); }} onKeyDown={handleKeyDown}>
      <header className="structural-edit-header">
        <div>
          <strong>{t('canvas.structuralEditTitle')}</strong>
          <span>{t('canvas.structuralEditDescription')}</span>
        </div>
        <IconButton label={t('canvas.structuralEditCancel')} size="touch" onClick={onCancel}><X size={18} /></IconButton>
      </header>

      <SegmentedControl
        className="structural-edit-operation"
        label={t('canvas.structuralEditOperation')}
        value={draft.kind}
        options={operationOptions}
        onValueChange={(value) => onKindChange(value as StructuralEditKind)}
        size="sm"
      />

      <div className="structural-edit-fields">
        {draft.kind === 'move' ? <>
          <UnitField label={t('canvas.structuralEditDeltaX')} value={draft.fields.deltaX} unit={lengthUnit} onValueChange={set('deltaX')} />
          <UnitField label={t('canvas.structuralEditDeltaY')} value={draft.fields.deltaY} unit={lengthUnit} onValueChange={set('deltaY')} />
        </> : null}

        {draft.kind === 'rotate' ? <>
          <UnitField label={t('canvas.structuralEditCenterX')} value={draft.fields.centerX} unit={lengthUnit} onValueChange={set('centerX')} />
          <UnitField label={t('canvas.structuralEditCenterY')} value={draft.fields.centerY} unit={lengthUnit} onValueChange={set('centerY')} />
          <Field label={t('canvas.structuralEditAngle')} value={draft.fields.angleDeg} suffix="°" inputMode="decimal" onChange={(event) => set('angleDeg')(event.target.value)} />
        </> : null}

        {draft.kind === 'mirror' ? <>
          <SegmentedControl
            className="structural-edit-wide-field"
            label={t('canvas.structuralEditMirrorResult')}
            value={draft.fields.mirrorMode}
            options={[
              { value: 'transform', label: t('canvas.structuralEditTransform') },
              { value: 'copy', label: t('canvas.structuralEditCopy') },
            ]}
            onValueChange={set('mirrorMode')}
            size="sm"
          />
          <SegmentedControl
            className="structural-edit-wide-field"
            label={t('canvas.structuralEditAxis')}
            value={draft.fields.mirrorAxis}
            options={[
              { value: 'horizontal', label: t('canvas.structuralEditHorizontal') },
              { value: 'vertical', label: t('canvas.structuralEditVertical') },
              { value: 'arbitrary', label: t('canvas.structuralEditArbitrary') },
            ]}
            onValueChange={set('mirrorAxis')}
            size="sm"
          />
          {draft.fields.mirrorAxis === 'arbitrary' ? <>
            <UnitField label={t('canvas.structuralEditAxisStartX')} value={draft.fields.axisStartX} unit={lengthUnit} onValueChange={set('axisStartX')} />
            <UnitField label={t('canvas.structuralEditAxisStartY')} value={draft.fields.axisStartY} unit={lengthUnit} onValueChange={set('axisStartY')} />
            <UnitField label={t('canvas.structuralEditAxisEndX')} value={draft.fields.axisEndX} unit={lengthUnit} onValueChange={set('axisEndX')} />
            <UnitField label={t('canvas.structuralEditAxisEndY')} value={draft.fields.axisEndY} unit={lengthUnit} onValueChange={set('axisEndY')} />
          </> : <UnitField
            className="structural-edit-wide-field"
            label={t('canvas.structuralEditAxisCoordinate')}
            value={draft.fields.axisCoordinate}
            unit={lengthUnit}
            onValueChange={set('axisCoordinate')}
          />}
        </> : null}

        {draft.kind === 'linear-array' ? <>
          <Field label={t('canvas.structuralEditDirectionX')} value={draft.fields.directionX} inputMode="decimal" onChange={(event) => set('directionX')(event.target.value)} />
          <Field label={t('canvas.structuralEditDirectionY')} value={draft.fields.directionY} inputMode="decimal" onChange={(event) => set('directionY')(event.target.value)} />
          <UnitField label={t('canvas.structuralEditSpacing')} value={draft.fields.spacing} unit={lengthUnit} onValueChange={set('spacing')} />
          <Field label={t('canvas.structuralEditCount')} value={draft.fields.count} type="number" min={2} max={500} step={1} onChange={(event) => set('count')(event.target.value)} />
        </> : null}

        {draft.kind === 'align' ? <SegmentedControl
          className="structural-edit-wide-field"
          label={t('canvas.structuralEditAlignRule')}
          value={draft.fields.alignment}
          options={[
            { value: 'min-x', label: t('canvas.structuralEditMinX') },
            { value: 'max-x', label: t('canvas.structuralEditMaxX') },
            { value: 'center-x', label: t('canvas.structuralEditCenterXRule') },
            { value: 'min-y', label: t('canvas.structuralEditMinY') },
            { value: 'max-y', label: t('canvas.structuralEditMaxY') },
            { value: 'center-y', label: t('canvas.structuralEditCenterYRule') },
          ]}
          onValueChange={set('alignment')}
          size="sm"
        /> : null}

        {draft.kind === 'distribute' ? <SegmentedControl
          className="structural-edit-wide-field"
          label={t('canvas.structuralEditDistributeAxis')}
          value={draft.fields.distributeAxis}
          options={[{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }]}
          onValueChange={set('distributeAxis')}
          size="sm"
        /> : null}
      </div>

      {pointerSupported ? <div className="structural-edit-pointer-row">
        <Button
          variant={pointerArmed ? 'primary' : 'secondary'}
          size="touch"
          leadingIcon={<MousePointer2 size={16} />}
          aria-pressed={pointerArmed}
          onClick={onTogglePointer}
        >{t(pointerArmed ? 'canvas.structuralEditPointerActive' : 'canvas.structuralEditPointer')}</Button>
        <small>{t(pointerArmed ? 'canvas.structuralEditPointerHelp' : 'canvas.structuralEditConnectedHelp')}</small>
      </div> : null}

      {error ? <p className="structural-edit-error" role="alert">{error}</p>
        : !prepared?.hasChanges ? <p className="structural-edit-message" role="status">{t('canvas.structuralEditNoChange')}</p>
          : <p className="structural-edit-message" role="status">{summary}</p>}

      <footer className="structural-edit-actions">
        <Button type="submit" variant="primary" size="touch" disabled={!prepared?.hasChanges || Boolean(error)}>{t('canvas.structuralEditApply')}</Button>
        <Button variant="secondary" size="touch" onClick={onCancel}>{t('canvas.structuralEditCancel')}</Button>
      </footer>
    </form>
  </Surface>;
};
