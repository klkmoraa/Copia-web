import { useCallback, useEffect, useState } from 'react';
import { Copy, FolderClock, FolderOpen, Pencil, RotateCcw } from 'lucide-react';
import { usePhase2I18n } from '../../i18n/usePhase2I18n';
import { useI18n } from '../../i18n/useI18n';
import {
  getProjectRepository,
  type ProjectRepository,
  type RecoveryRecord,
  type StoredProjectRecord,
} from '../../storage/projectRepository';
import { ProjectVersions } from './ProjectVersions';
import './projectHub.css';

/**
 * Última edición del registro. Sale de `StoredProjectRecord.updatedAt`, que el
 * repositorio ya escribe — no es un dato nuevo ni inventado. Ante una fecha
 * ilegible devuelve cadena vacía y la celda queda muda, que es preferible a
 * enseñar «Invalid Date» junto a un proyecto real.
 */
const formatUpdated = (iso: string, language: 'es' | 'en') => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'es' ? 'es' : 'en', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(at);
};

export const ProjectHub = ({
  repository,
  onOpen,
}: {
  repository?: ProjectRepository;
  onOpen: (record: StoredProjectRecord) => void;
}) => {
  const { language } = useI18n();
  const { t } = usePhase2I18n(language);
  const activeRepository = repository ?? (typeof indexedDB === 'undefined' ? null : getProjectRepository());
  const [projects, setProjects] = useState<StoredProjectRecord[]>([]);
  const [recoveries, setRecoveries] = useState<RecoveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (!activeRepository) {
      setProjects([]);
      setRecoveries([]);
      setError(t('hub.unavailable'));
      setLoading(false);
      return;
    }
    try {
      const [nextProjects, nextRecoveries] = await Promise.all([activeRepository.listProjects(), activeRepository.listRecoveries()]);
      setProjects(nextProjects);
      /* Las versiones nombradas viven en el mismo almacén que las copias de
         recuperación —comparten esquema y ruta de restauración a propósito—,
         pero no son la misma cosa para quien mira: una la pidió el usuario y
         tiene nombre, la otra la tendió el producto solo. Desde que cada
         proyecto enseña las suyas, dejarlas también aquí las contaría dos veces
         y llamaría «copia recuperable» a algo que se llama «Antes de subir las
         cargas». */
      setRecoveries(nextRecoveries.filter((recovery) => recovery.reason !== 'version'));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('hub.unavailable'));
    } finally {
      setLoading(false);
    }
  }, [activeRepository, t]);

  useEffect(() => { void refresh(); }, [refresh]);

  const duplicate = async (record: StoredProjectRecord) => {
    if (!activeRepository) return;
    try {
      await activeRepository.duplicateProject(record.id, t('hub.copyName', { name: record.name }));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('hub.unavailable'));
    }
  };

  const commitRename = async () => {
    if (!editing?.name.trim() || !activeRepository) return;
    try {
      await activeRepository.renameProject(editing.id, editing.name.trim());
      setEditing(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('hub.unavailable'));
    }
  };

  const restore = async (recovery: RecoveryRecord) => {
    if (!activeRepository) return;
    try {
      const record = await activeRepository.restoreRecovery(recovery.id);
      await refresh();
      onOpen(record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('hub.unavailable'));
    }
  };

  /* CRI-112 · el hub vacío casi desaparece.
     Sin proyectos y sin copias recuperables, la biblioteca no gasta un panel
     entero, un eyebrow y un titular para decir una frase: se queda en una
     línea discreta. En cuanto hay algo que enseñar —un proyecto, un error de
     la biblioteca o una copia pendiente— se despliega sola. La recuperación
     queda garantizada por construcción: su presencia es lo que fuerza el
     despliegue, así que nunca puede quedar menos alcanzable que hoy. */
  const collapsed = !loading && !error && projects.length === 0 && recoveries.length === 0;

  return <section className={`project-hub${collapsed ? ' project-hub--collapsed' : ''}`} aria-labelledby="project-hub-title">
    <header className="project-hub__header">
      <div><span className="project-hub__eyebrow">{t('hub.localFirst')}</span><h2 id="project-hub-title">{t('hub.title')}</h2></div>
      <FolderClock size={22} aria-hidden="true" />
    </header>
    {loading ? <p role="status">{t('hub.loading')}</p> : null}
    {error ? <p className="project-hub__error" role="alert">{error}</p> : null}
    {!loading && projects.length === 0 ? <p className="project-hub__empty">{t('hub.empty')}</p> : null}
    {projects.length ? <div className="project-hub__list">
      {/* Encabezados de columna reales. Sólo campos que el repositorio guarda
          de verdad: nombre, última edición y revisión. Ni miniatura, ni tipo,
          ni estado de análisis — ese último es copy prohibido. */}
      <div className="project-hub__columns" aria-hidden="true">
        <span>{t('hub.columnProject')}</span>
        <span>{t('hub.columnUpdated')}</span>
        <span>{t('hub.columnRevision')}</span>
        <span />
      </div>
      {projects.map((record) => <div className="project-hub__entry" key={record.id}><article className="project-hub__row">
        <div className="project-hub__identity">
          {editing?.id === record.id ? <form onSubmit={(event) => { event.preventDefault(); void commitRename(); }}>
            <label><span className="sr-only">{t('hub.renameLabel')}</span><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} autoFocus /></label>
            <button type="submit">{t('hub.saveName')}</button>
            <button type="button" onClick={() => setEditing(null)}>{t('hub.cancel')}</button>
          {/* El nombre se recorta con puntos suspensivos cuando la fila no da
              más de sí —medido: 44 px de 436 en la biblioteca a 1440—, así que
              el nombre completo viaja en `title` y deja de depender del ancho.
              No sustituye a arreglar el reparto de la fila; lo hace legible
              mientras tanto. */}
          </form> : <strong title={record.name}>{record.name}</strong>}
        </div>
        <time className="project-hub__updated" dateTime={record.updatedAt}>{formatUpdated(record.updatedAt, language)}</time>
        <small className="project-hub__revision">{t('hub.revision', { revision: record.revision })}</small>
        <div className="project-hub__actions">
          <button type="button" aria-label={t('hub.openLabel', { name: record.name })} onClick={() => onOpen(record)}><FolderOpen size={16} />{t('hub.open')}</button>
          <button type="button" aria-label={t('hub.renameAction', { name: record.name })} onClick={() => setEditing({ id: record.id, name: record.name })}><Pencil size={16} /></button>
          <button type="button" aria-label={t('hub.duplicateAction', { name: record.name })} onClick={() => void duplicate(record)}><Copy size={16} /></button>
        </div>
      </article>
      {activeRepository ? <ProjectVersions
        repository={activeRepository}
        record={record}
        t={t}
        formatDate={(iso) => formatUpdated(iso, language)}
        onRestored={onOpen}
        onChanged={() => { void refresh(); }}
      /> : null}
      </div>)}
    </div> : null}
    {/* CRI-104 · la recuperación se abre sola cuando hay algo que recuperar.
        `RecoveryRecord` es seguridad de datos: si existe una copia, verla no
        puede depender de que alguien despliegue un `<details>` cerrado. Sin
        copias, el bloque sigue sin renderizarse, igual que antes. */}
    {recoveries.length ? <details className="project-hub__recoveries" open>
      <summary>{t('hub.recoveries', { count: recoveries.length })}</summary>
      {recoveries.map((recovery) => <button key={recovery.id} type="button" onClick={() => void restore(recovery)}>
        <RotateCcw size={16} /> {t('hub.restore', { name: recovery.project.name })}
      </button>)}
    </details> : null}
  </section>;
};

export default ProjectHub;
