import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, History, RotateCcw, Save } from 'lucide-react';
import type { DiffChangeKind, DiffEntityKind, ProjectDiff } from '../../data/projectDiff';
import type { Phase2TranslationKey } from '../../i18n/phase2Catalogs';
import type { ProjectRepository, StoredProjectRecord } from '../../storage/projectRepository';
import {
  compareVersionWithCurrent,
  compareVersions,
  listNamedVersions,
  restoreNamedVersion,
  saveNamedVersion,
  type NamedVersion,
} from '../../storage/projectVersions';
import {
  diffCounts,
  formatDiffValue,
  groupChangesByKind,
  limitChanges,
} from './projectDiffSummary';

/**
 * Versiones nombradas de un proyecto, con su diff, dentro de la biblioteca.
 *
 * `storage/projectVersions.ts` sabía guardar, listar, comparar y restaurar
 * desde la primera tanda, y nadie lo llamaba: la biblioteca enseñaba proyectos
 * y copias de recuperación, pero no había forma de decir «este estado es el de
 * antes de subir las cargas» ni de ver en qué se diferencia del de ahora.
 *
 * ## Qué es «el estado actual» aquí
 *
 * El registro de la biblioteca, no el modelo que hay en memoria. El espacio de
 * trabajo autoguarda en el repositorio en cada cambio, así que el registro **es**
 * lo último editado; compararse contra otra cosa sería comparar contra un estado
 * que nadie tiene guardado.
 *
 * ## Restaurar no borra lo que había
 *
 * `restoreRecovery` escribe la versión encima del proyecto, y el estado que
 * había se perdería. Antes de restaurar se tiende una copia de recuperación del
 * estado actual —la misma red que la importación DXF tiende antes de pisar un
 * modelo—, así que volver atrás nunca es un camino de una sola dirección. El
 * panel lo dice antes de que alguien pulse.
 */

const CURRENT = 'current';
const MAX_SHOWN_CHANGES = 40;

const ENTITY_LABEL_KEYS: Readonly<Record<DiffEntityKind, Phase2TranslationKey>> = {
  node: 'hub.diffKindNode',
  member: 'hub.diffKindMember',
  nodalLoad: 'hub.diffKindNodalLoad',
  memberLoad: 'hub.diffKindMemberLoad',
  prescribedDisplacement: 'hub.diffKindPrescribed',
  memberInitialEffect: 'hub.diffKindInitialEffect',
  loadCase: 'hub.diffKindLoadCase',
  combination: 'hub.diffKindCombination',
  settings: 'hub.diffKindSettings',
};

/** Las cuentas del resumen. */
const CHANGE_COUNT_KEYS: Readonly<Record<DiffChangeKind, Phase2TranslationKey>> = {
  added: 'hub.diffAdded',
  modified: 'hub.diffModified',
  removed: 'hub.diffRemoved',
};

/** La etiqueta de una fila. Una tabla y no una plantilla de clave: construir el
    nombre concatenando obligaría a un `as` que apagaría el chequeo del tipo. */
const CHANGE_BADGE_KEYS: Readonly<Record<DiffChangeKind, Phase2TranslationKey>> = {
  added: 'hub.diffBadgeAdded',
  modified: 'hub.diffBadgeModified',
  removed: 'hub.diffBadgeRemoved',
};

export interface ProjectVersionsProps {
  repository: ProjectRepository;
  record: StoredProjectRecord;
  /** Fecha legible; la calcula el hub, que ya tiene el idioma resuelto. */
  formatDate: (iso: string) => string;
  t: (key: Phase2TranslationKey, variables?: Record<string, string | number>) => string;
  onRestored: (record: StoredProjectRecord) => void;
  /** Se avisa al hub para que recargue proyectos y copias tras escribir. */
  onChanged: () => void;
}

export const ProjectVersions = ({
  repository,
  record,
  formatDate,
  t,
  onRestored,
  onChanged,
}: ProjectVersionsProps) => {
  const [versions, setVersions] = useState<NamedVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string>(CURRENT);

  const refresh = useCallback(async () => {
    try {
      setVersions(await listNamedVersions(repository, record.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('hub.versionsFailed'));
    }
  }, [repository, record.id, t]);

  useEffect(() => { void refresh(); }, [refresh]);

  /* Una versión que ya no está en la lista no puede seguir seleccionada ni ser
     el término de comparación: apuntaría al vacío y el panel enseñaría un diff
     de algo que no existe. */
  useEffect(() => {
    if (selectedId && !versions.some((version) => version.id === selectedId)) setSelectedId(null);
    if (compareId !== CURRENT && !versions.some((version) => version.id === compareId)) setCompareId(CURRENT);
  }, [versions, selectedId, compareId]);

  const save = async () => {
    const label = name.trim();
    if (!label) {
      setError(t('hub.versionNameRequired'));
      return;
    }
    setBusy(true);
    try {
      const saved = await saveNamedVersion(repository, record.project, label);
      setName('');
      setError(null);
      await refresh();
      setSelectedId(saved.id);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('hub.versionsFailed'));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (version: NamedVersion) => {
    setBusy(true);
    try {
      /* La red antes de pisar: el estado que hay ahora queda como copia
         recuperable. Sin esto, restaurar sería la única operación de la
         biblioteca de la que no se puede volver. */
      await repository.createRecovery(record.project, 'manual');
      const restored = await restoreNamedVersion(repository, version.id);
      setError(null);
      onChanged();
      onRestored(restored);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('hub.versionsFailed'));
    } finally {
      setBusy(false);
    }
  };

  const selected = versions.find((version) => version.id === selectedId) ?? null;
  const other = compareId === CURRENT ? null : versions.find((version) => version.id === compareId) ?? null;

  const comparison = useMemo<{ diff: ProjectDiff; againstLabel: string } | null>(() => {
    if (!selected) return null;
    if (compareId === CURRENT) {
      return { diff: compareVersionWithCurrent(selected, record.project), againstLabel: t('hub.currentState') };
    }
    if (!other) return null;
    return { diff: compareVersions(selected, other).diff, againstLabel: other.label };
  }, [selected, other, compareId, record.project, t]);

  const valueLabels = { absent: t('hub.diffAbsent'), yes: t('hub.yes'), no: t('hub.no') };

  return <details className="project-hub__versions">
    <summary><History size={15} aria-hidden="true" /> {t('hub.versions', { count: versions.length })}</summary>

    <div className="project-hub__versions-body">
      <form
        className="project-hub__version-form"
        onSubmit={(event) => { event.preventDefault(); void save(); }}
      >
        <label>
          <span className="sr-only">{t('hub.versionNameLabel')}</span>
          <input
            value={name}
            disabled={busy}
            placeholder={t('hub.versionNamePlaceholder')}
            aria-label={t('hub.versionNameLabel')}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}><Save size={15} aria-hidden="true" /> {t('hub.saveVersion')}</button>
      </form>
      <p className="project-hub__versions-note">{t('hub.versionsNote')}</p>

      {error ? <p className="project-hub__error" role="alert">{error}</p> : null}

      {versions.length === 0
        ? <p className="project-hub__versions-empty">{t('hub.versionsEmpty')}</p>
        : <ul className="project-hub__version-list">
          {versions.map((version) => <li key={version.id} className={version.id === selectedId ? 'is-selected' : undefined}>
            <button
              type="button"
              className="project-hub__version-pick"
              aria-pressed={version.id === selectedId}
              onClick={() => setSelectedId(version.id === selectedId ? null : version.id)}
            >
              <strong>{version.label}</strong>
              <time dateTime={version.createdAt}>{formatDate(version.createdAt)}</time>
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label={t('hub.restoreVersion', { label: version.label })}
              onClick={() => void restore(version)}
            >
              <RotateCcw size={15} aria-hidden="true" /> {t('hub.restoreShort')}
            </button>
          </li>)}
        </ul>}

      {selected ? <section className="project-hub__diff" aria-label={t('hub.diffTitle', { label: selected.label })}>
        <header>
          <label className="project-hub__diff-target">
            <span>{t('hub.compareWith')}</span>
            <select value={compareId} onChange={(event) => setCompareId(event.target.value)}>
              <option value={CURRENT}>{t('hub.currentState')}</option>
              {versions.filter((version) => version.id !== selected.id).map((version) => (
                <option key={version.id} value={version.id}>{version.label}</option>
              ))}
            </select>
          </label>
          <p className="project-hub__diff-direction">
            <GitCompareArrows size={15} aria-hidden="true" />
            {t('hub.diffDirection', { from: selected.label, to: comparison?.againstLabel ?? '' })}
          </p>
        </header>

        {comparison?.diff.identical ? <p className="project-hub__diff-identical">{t('hub.diffIdentical')}</p> : null}

        {comparison && !comparison.diff.identical ? <>
          <p className="project-hub__diff-counts">
            {diffCounts(comparison.diff)
              .map((entry) => t(CHANGE_COUNT_KEYS[entry.change], { count: entry.count }))
              .join(' · ')}
          </p>
          <p className="project-hub__versions-note">{t('hub.diffBaseUnits')}</p>
          {groupChangesByKind(comparison.diff).map((group) => {
            const limited = limitChanges(group.changes, MAX_SHOWN_CHANGES);
            return <section key={group.kind} className="project-hub__diff-group">
              <h4>{t(ENTITY_LABEL_KEYS[group.kind])}</h4>
              <ul>
                {limited.shown.map((change) => <li key={`${change.kind}:${change.id}`} data-change={change.change}>
                  <span className="project-hub__diff-badge">{t(CHANGE_BADGE_KEYS[change.change])}</span>
                  <code>{change.id}</code>
                  {change.fields.length ? <span className="project-hub__diff-fields">
                    {change.fields.map((field) => `${field.field}: ${formatDiffValue(field.before, valueLabels)} → ${formatDiffValue(field.after, valueLabels)}`).join(' · ')}
                  </span> : null}
                </li>)}
              </ul>
              {limited.hidden ? <p className="project-hub__diff-more">{t('hub.diffMore', { count: limited.hidden })}</p> : null}
            </section>;
          })}
        </> : null}
      </section> : null}
    </div>
  </details>;
};
