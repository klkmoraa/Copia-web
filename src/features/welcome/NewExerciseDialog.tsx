import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  classroomExerciseTemplates,
  getClassroomExerciseTemplate,
  type ClassroomDifficulty,
  type ClassroomExerciseParameterKey,
  type ClassroomExerciseParameters,
  type ClassroomExerciseTemplateId,
  type ClassroomTopic,
} from '../../education/exerciseTemplates';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import type { ProjectModel } from '../../types';
import { useModalFocus } from '../../design-system/components/modalFocus';

export interface NewExerciseDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (project: ProjectModel) => void;
  initialTemplateId?: ClassroomExerciseTemplateId;
}

const difficultyLabelKeys: Record<ClassroomDifficulty, TranslationKey> = {
  basic: 'newExercise.difficultyBasic',
  intermediate: 'newExercise.difficultyIntermediate',
  advanced: 'newExercise.difficultyAdvanced',
};

const templateCopyKeys: Record<ClassroomExerciseTemplateId, { name: TranslationKey; description: TranslationKey }> = {
  blank: { name: 'newExercise.template.blankName', description: 'newExercise.template.blankDescription' },
  'simple-beam': { name: 'newExercise.template.simpleBeamName', description: 'newExercise.template.simpleBeamDescription' },
  cantilever: { name: 'newExercise.template.cantileverName', description: 'newExercise.template.cantileverDescription' },
  'triangular-truss': { name: 'newExercise.template.triangularTrussName', description: 'newExercise.template.triangularTrussDescription' },
  'portal-frame': { name: 'newExercise.template.portalFrameName', description: 'newExercise.template.portalFrameDescription' },
};

const topicLabelKeys: Record<ClassroomTopic, TranslationKey> = {
  inicio: 'newExercise.topicStart',
  vigas: 'newExercise.topicBeams',
  diagramas: 'newExercise.topicDiagrams',
  pórticos: 'newExercise.topicFrames',
  armaduras: 'newExercise.topicTrusses',
  hiperestática: 'newExercise.topicIndeterminate',
};

const fieldLabelKeys: Record<ClassroomExerciseParameterKey, TranslationKey> = {
  length: 'newExercise.fieldLength',
  height: 'newExercise.fieldHeight',
  loadMagnitude: 'newExercise.fieldLoad',
  distributedLoadMagnitude: 'newExercise.fieldDistributedLoad',
  loadPosition: 'newExercise.fieldLoadPosition',
};

const initialParameters = (templateId: ClassroomExerciseTemplateId) => ({
  ...getClassroomExerciseTemplate(templateId).defaults,
});

export const NewExerciseDialog = ({
  open,
  onClose,
  onCreate,
  initialTemplateId = 'blank',
}: NewExerciseDialogProps) => {
  const { t } = useI18n();
  const [templateId, setTemplateId] = useState<ClassroomExerciseTemplateId>(initialTemplateId);
  const [parameters, setParameters] = useState<Partial<ClassroomExerciseParameters>>(() => initialParameters(initialTemplateId));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ClassroomExerciseParameterKey, string>>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const shouldFocusInvalidRef = useRef(false);
  const template = getClassroomExerciseTemplate(templateId);

  useEffect(() => {
    if (!shouldFocusInvalidRef.current) return;
    shouldFocusInvalidRef.current = false;
    dialogRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [fieldErrors]);

  useEffect(() => {
    if (!open) return;
    setTemplateId(initialTemplateId);
    setParameters(initialParameters(initialTemplateId));
    setFieldErrors({});
  }, [initialTemplateId, open]);

  useModalFocus({
    open,
    containerRef: dialogRef,
    onEscape: onClose,
    initialFocus: (dialog) => dialog.querySelector<HTMLElement>('button, input'),
  });

  if (!open) return null;

  const chooseTemplate = (id: ClassroomExerciseTemplateId) => {
    setTemplateId(id);
    setParameters(initialParameters(id));
    setFieldErrors({});
  };

  const onTemplateKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + classroomExerciseTemplates.length) % classroomExerciseTemplates.length;
    else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % classroomExerciseTemplates.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = classroomExerciseTemplates.length - 1;
    else return;
    event.preventDefault();
    const next = classroomExerciseTemplates[nextIndex];
    chooseTemplate(next.id);
    window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>(`[data-template-id="${next.id}"]`)?.focus());
  };

  return (
    <div
      className="new-exercise-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="new-exercise-dialog" role="dialog" aria-modal="true" aria-labelledby="new-exercise-title" aria-describedby="new-exercise-subtitle">
        <header className="new-exercise-header">
          <div>
            <p className="new-exercise-eyebrow">{t('classroom.eyebrow')}</p>
            <h2 id="new-exercise-title" className="new-exercise-title">{t('newExercise.title')}</h2>
            <p id="new-exercise-subtitle" className="new-exercise-subtitle">{t('newExercise.subtitle')}</p>
          </div>
          <button type="button" className="new-exercise-close" aria-label={t('newExercise.close')} onClick={onClose}>×</button>
        </header>
        <form
          className="new-exercise-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const nextErrors: Partial<Record<ClassroomExerciseParameterKey, string>> = {};
            for (const field of template.fields) {
              const value = parameters[field.key];
              if (typeof value !== 'number' || !Number.isFinite(value)) {
                nextErrors[field.key] = t('newExercise.fieldEmpty');
              } else if (value < field.min || value > field.max) {
                nextErrors[field.key] = t('newExercise.fieldRange', { min: field.min, max: field.max });
              }
            }
            if (Object.keys(nextErrors).length) {
              shouldFocusInvalidRef.current = true;
              setFieldErrors(nextErrors);
              return;
            }
            onCreate(template.build(parameters));
          }}
        >
          <div className="new-exercise-chooser" role="radiogroup" aria-label={t('newExercise.typeLabel')}>
            <h3 className="new-exercise-section-title">{t('newExercise.chooseBase')}</h3>
            {classroomExerciseTemplates.map((candidate, index) => {
              const selected = candidate.id === templateId;
              const copy = templateCopyKeys[candidate.id];
              return (
                <button
                  key={candidate.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  data-template-id={candidate.id}
                  className={`new-exercise-template${selected ? ' selected' : ''}`}
                  onClick={() => chooseTemplate(candidate.id)}
                  onKeyDown={(event) => onTemplateKeyDown(event, index)}
                >
                  <span className="new-exercise-template-copy">
                    <strong className="new-exercise-template-name">{t(copy.name)}</strong>
                    <span className="new-exercise-template-description">{t(copy.description)}</span>
                    <span className="new-exercise-badge-row">
                      <span className="new-exercise-badge">{t(difficultyLabelKeys[candidate.difficulty])}</span>
                      <span className="new-exercise-badge">{t('newExercise.duration', { minutes: candidate.durationMinutes })}</span>
                      {candidate.topics.slice(0, 2).map((topic) => <span key={topic} className="new-exercise-badge">{t(topicLabelKeys[topic])}</span>)}
                    </span>
                  </span>
                  <span className="new-exercise-radio" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <section className="new-exercise-settings" aria-labelledby="exercise-parameters-title">
            <h3 id="exercise-parameters-title" className="new-exercise-section-title">{t('newExercise.parametersTitle')}</h3>
            {template.fields.length ? template.fields.map((field) => {
              const label = t(fieldLabelKeys[field.key]);
              const error = fieldErrors[field.key];
              const errorId = `new-exercise-${field.key}-error`;
              return <label key={field.key} className="new-exercise-field">
                <span>{label}</span>
                <span className="new-exercise-input-wrap">
                  <input
                    className="new-exercise-input"
                    aria-label={label}
                    type="number"
                    inputMode="decimal"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    required
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    aria-errormessage={error ? errorId : undefined}
                    value={parameters[field.key] ?? ''}
                    onChange={(event) => {
                      const value = event.currentTarget.valueAsNumber;
                      setParameters((current) => {
                        const next = { ...current };
                        if (Number.isFinite(value)) next[field.key] = value;
                        else delete next[field.key];
                        return next;
                      });
                      setFieldErrors((current) => {
                        if (!current[field.key]) return current;
                        const next = { ...current };
                        delete next[field.key];
                        return next;
                      });
                    }}
                  />
                  <small className="new-exercise-unit">{field.unit}</small>
                </span>
                {error ? <small id={errorId} className="new-exercise-field-error" role="alert">{error}</small> : null}
              </label>;
            }) : <p className="new-exercise-note">{t('newExercise.emptyNote')}</p>}
            <p className="new-exercise-note">{t('newExercise.mechanicalNote')}</p>
            <button className="new-exercise-submit" type="submit">{t('newExercise.create')}</button>
          </section>
        </form>
      </div>
    </div>
  );
};
