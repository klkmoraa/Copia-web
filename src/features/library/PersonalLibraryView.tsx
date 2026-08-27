import { useMemo, useState } from 'react';
import { Copy, Pencil, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { standardMaterials } from '../../data/standardMaterials';
import { standardSections } from '../../data/standardSections';
import type { ThemeMode, UnitSystemId } from '../../types';
import type { CanvasViewSettings } from '../view/canvasViewSettings';
import {
  searchFavorites,
  uniqueFavoriteName,
  type PersonalFavorite,
  type PersonalFavoriteDraft,
  type PersonalFavoriteFilter,
} from './personalLibrary';
import { usePersonalLibrary, type LibraryOperationResult } from './usePersonalLibrary';
import { SectionBuilder } from './SectionBuilder';
import './personalLibrary.css';

type Language = 'es' | 'en';

const COPY = {
  es: {
    eyebrow: 'Biblioteca', title: 'Biblioteca personal', body: 'Referencias personales para reutilizar de forma explícita. No son un catálogo normativo ni modifican proyectos por sí solas.',
    search: 'Buscar favoritos', all: 'Todos', material: 'Material', section: 'Sección', pair: 'Par', view: 'Vista', create: 'Crear favorito', close: 'Cerrar creación',
    kind: 'Tipo de favorito', filters: 'Filtrar por tipo', name: 'Nombre del favorito', materialLabel: 'Material', sectionLabel: 'Sección', save: 'Guardar favorito', cancel: 'Cancelar',
    empty: 'Todavía no guardas favoritos.', emptyBody: 'Créalo aquí o guarda una identidad desde el Inspector.', noResults: 'No hay favoritos que coincidan con esta búsqueda.',
    trash: 'Papelera', active: 'Volver a favoritos', rename: 'Renombrar', duplicate: 'Duplicar', delete: 'Borrar', restore: 'Restaurar', newName: 'Nuevo nombre', saveName: 'Guardar nombre',
    copy: 'Copia', catalog: 'Catálogo integrado', units: 'Unidades', updated: 'Actualizado', day: 'Día', night: 'Noche', results: 'favoritos visibles',
    saved: 'Favorito guardado.', renamed: 'Nombre actualizado.', duplicated: 'Favorito duplicado.', deleted: 'Favorito movido a Papelera. Los proyectos no cambiaron.', restored: 'Favorito restaurado.',
    storageError: 'No se pudo guardar la biblioteca en este dispositivo. El proyecto no cambió.', conflict: 'No se restauró porque ese nombre ya está en uso. Renombra uno de los dos.', invalid: 'No se completó la operación. Revisa el nombre y las referencias.',
  },
  en: {
    eyebrow: 'Library', title: 'Personal library', body: 'Personal references for explicit reuse. They are not a normative catalog and never modify projects on their own.',
    search: 'Search favorites', all: 'All', material: 'Material', section: 'Section', pair: 'Pair', view: 'View', create: 'Create favorite', close: 'Close creation',
    kind: 'Favorite type', filters: 'Filter by type', name: 'Favorite name', materialLabel: 'Material', sectionLabel: 'Section', save: 'Save favorite', cancel: 'Cancel',
    empty: 'You have no saved favorites yet.', emptyBody: 'Create one here or save an explicit identity from the Inspector.', noResults: 'No favorites match this search.',
    trash: 'Trash', active: 'Back to favorites', rename: 'Rename', duplicate: 'Duplicate', delete: 'Delete', restore: 'Restore', newName: 'New name', saveName: 'Save name',
    copy: 'Copy', catalog: 'Built-in catalog', units: 'Units', updated: 'Updated', day: 'Day', night: 'Night', results: 'visible favorites',
    saved: 'Favorite saved.', renamed: 'Name updated.', duplicated: 'Favorite duplicated.', deleted: 'Favorite moved to Trash. Projects were not changed.', restored: 'Favorite restored.',
    storageError: 'The library could not be saved on this device. The project was not changed.', conflict: 'Restore failed because that name is already in use. Rename one of them.', invalid: 'The operation could not be completed. Review the name and references.',
  },
} as const;

const kindLabel = (favorite: PersonalFavorite, copy: typeof COPY.es | typeof COPY.en) => copy[favorite.kind];

const favoriteDetails = (favorite: PersonalFavorite, copy: typeof COPY.es | typeof COPY.en) => {
  if (favorite.kind === 'material') return `${copy.catalog} · ${favorite.materialId}`;
  if (favorite.kind === 'section') return `${copy.catalog} · ${favorite.sectionId}`;
  if (favorite.kind === 'pair') return `${copy.catalog} · ${favorite.materialId} + ${favorite.sectionId}`;
  return `${favorite.theme === 'light' ? copy.day : copy.night} · ${copy.units} ${favorite.unitsAtSave}`;
};

const feedbackFor = (result: LibraryOperationResult, success: string, copy: typeof COPY.es | typeof COPY.en) => result.ok
  ? { kind: 'status' as const, message: success }
  : { kind: 'error' as const, message: result.reason === 'storage-unavailable' ? copy.storageError : result.reason === 'name-conflict' ? copy.conflict : copy.invalid };

const FavoriteRow = ({
  favorite,
  language,
  deleted,
  onRename,
  onDuplicate,
  onDelete,
  onRestore,
}: {
  favorite: PersonalFavorite;
  language: Language;
  deleted: boolean;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) => {
  const copy = COPY[language];
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(favorite.name);
  return <li className="personal-library__item" aria-label={`${favorite.name}, ${kindLabel(favorite, copy)}`}>
    <div className="personal-library__identity">
      {renaming ? <div className="personal-library__rename">
        <label><span>{copy.newName}</span><input value={name} onChange={(event) => setName(event.currentTarget.value)} aria-label={copy.newName} /></label>
        <button type="button" onClick={() => { onRename(name); setRenaming(false); }}>{copy.saveName}</button>
      </div> : <><strong>{favorite.name}</strong><span>{kindLabel(favorite, copy)}</span></>}
      <small>{favoriteDetails(favorite, copy)}</small>
      <small>{copy.updated}: {new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(favorite.updatedAt))}</small>
    </div>
    <div className="personal-library__actions">
      <button type="button" aria-label={`${copy.rename} ${favorite.name}`} onClick={() => { setName(favorite.name); setRenaming(true); }}><Pencil size={16} aria-hidden="true" /><span>{copy.rename}</span></button>
      {deleted
        ? <button type="button" aria-label={`${copy.restore} ${favorite.name}`} onClick={onRestore}><RotateCcw size={16} aria-hidden="true" /><span>{copy.restore}</span></button>
        : <>
          <button type="button" aria-label={`${copy.duplicate} ${favorite.name}`} onClick={onDuplicate}><Copy size={16} aria-hidden="true" /><span>{copy.duplicate}</span></button>
          <button type="button" aria-label={`${copy.delete} ${favorite.name}`} onClick={onDelete}><Trash2 size={16} aria-hidden="true" /><span>{copy.delete}</span></button>
        </>}
    </div>
  </li>;
};

export const PersonalLibraryView = ({
  language,
  units,
  theme,
  view,
  storage = localStorage,
}: {
  language: Language;
  units: UnitSystemId;
  theme: ThemeMode;
  view: CanvasViewSettings;
  storage?: Storage;
}) => {
  const copy = COPY[language];
  const repository = usePersonalLibrary(storage);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PersonalFavoriteFilter>('all');
  const [trash, setTrash] = useState(false);
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<PersonalFavorite['kind']>('material');
  const [name, setName] = useState('');
  const [materialId, setMaterialId] = useState(standardMaterials[0].id);
  const [sectionId, setSectionId] = useState(standardSections[0].id);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'status'; message: string }>();
  const visible = useMemo(() => searchFavorites(repository.library, query, { filter, deleted: trash }), [filter, query, repository.library, trash]);
  const trashCount = repository.library.filter((favorite) => favorite.deletedAt).length;

  const save = () => {
    const base = { name, unitsAtSave: units };
    const draft: PersonalFavoriteDraft = kind === 'material' ? { ...base, kind, materialId }
      : kind === 'section' ? { ...base, kind, sectionId }
        : kind === 'pair' ? { ...base, kind, materialId, sectionId }
          : { ...base, kind, theme, view };
    const result = repository.create(draft);
    setFeedback(feedbackFor(result, copy.saved, copy));
    if (result.ok) { setName(''); setCreating(false); }
  };

  const filters: PersonalFavoriteFilter[] = ['all', 'material', 'section', 'pair', 'view'];
  return <div className="personal-library-shell"><section className="personal-library" aria-labelledby="personal-library-title">
    <header className="personal-library__header">
      <div><p>{copy.eyebrow}</p><h2 id="personal-library-title">{copy.title}</h2><span>{copy.body}</span></div>
      <button type="button" className="personal-library__create" onClick={() => setCreating((current) => !current)}>{creating ? <X size={16} aria-hidden="true" /> : null}{creating ? copy.close : copy.create}</button>
    </header>
    {creating ? <div className="personal-library__creator">
      <label><span>{copy.kind}</span><select aria-label={copy.kind} value={kind} onChange={(event) => setKind(event.currentTarget.value as PersonalFavorite['kind'])}>
        <option value="material">{copy.material}</option><option value="section">{copy.section}</option><option value="pair">{copy.pair}</option><option value="view">{copy.view}</option>
      </select></label>
      <label><span>{copy.name}</span><input aria-label={copy.name} value={name} onChange={(event) => setName(event.currentTarget.value)} /></label>
      {kind === 'material' || kind === 'pair' ? <label><span>{copy.materialLabel}</span><select aria-label={copy.materialLabel} value={materialId} onChange={(event) => setMaterialId(event.currentTarget.value)}>{standardMaterials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select></label> : null}
      {kind === 'section' || kind === 'pair' ? <label><span>{copy.sectionLabel}</span><select aria-label={copy.sectionLabel} value={sectionId} onChange={(event) => setSectionId(event.currentTarget.value)}>{standardSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label> : null}
      <div><button type="button" onClick={save}>{copy.save}</button><button type="button" onClick={() => setCreating(false)}>{copy.cancel}</button></div>
    </div> : null}
    <div className="personal-library__tools">
      <label className="personal-library__search"><Search size={17} aria-hidden="true" /><span className="sr-only">{copy.search}</span><input type="search" aria-label={copy.search} placeholder={copy.search} value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
      <div className="personal-library__filters" aria-label={copy.filters}>{filters.map((candidate) => <button type="button" key={candidate} aria-pressed={!trash && filter === candidate} onClick={() => { setTrash(false); setFilter(candidate); }}>{copy[candidate]}</button>)}</div>
      <button type="button" className="personal-library__trash" aria-pressed={trash} onClick={() => setTrash((current) => !current)}>{trash ? copy.active : `${copy.trash} ${trashCount}`}</button>
    </div>
    <output className="sr-only" aria-live="polite">{visible.length} {copy.results}</output>
    {feedback ? <p className="personal-library__feedback" role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</p> : null}
    {visible.length ? <ul className="personal-library__list">
      {visible.map((favorite) => <FavoriteRow
        key={favorite.id}
        favorite={favorite}
        language={language}
        deleted={trash}
        onRename={(nextName) => setFeedback(feedbackFor(repository.rename(favorite.id, nextName), copy.renamed, copy))}
        onDuplicate={() => setFeedback(feedbackFor(repository.duplicate(favorite.id, uniqueFavoriteName(repository.library, `${favorite.name} — ${copy.copy}`)), copy.duplicated, copy))}
        onDelete={() => setFeedback(feedbackFor(repository.remove(favorite.id), copy.deleted, copy))}
        onRestore={() => setFeedback(feedbackFor(repository.restore(favorite.id), copy.restored, copy))}
      />)}
    </ul> : <div className="personal-library__empty" role="status"><strong>{query ? copy.noResults : copy.empty}</strong>{!query ? <span>{copy.emptyBody}</span> : null}</div>}
  </section><SectionBuilder language={language} units={units} storage={storage} /></div>;
};
