import { useMemo, useState } from 'react';
import type { ThemeMode, UnitSystemId } from '../../types';
import type { CanvasViewSettings } from '../view/canvasViewSettings';
import type { PersonalViewFavorite } from './personalLibrary';
import { usePersonalLibrary, type LibraryOperationResult } from './usePersonalLibrary';
import './memberFavorites.css';

const COPY = {
  es: {
    title: 'Vistas favoritas', body: 'Guarda tema y preferencias visuales. Seleccionar no modifica el proyecto.', favorite: 'Vista favorita', none: 'No hay vistas guardadas.',
    apply: 'Aplicar vista', name: 'Nombre para guardar', save: 'Guardar vista actual', saved: 'Vista guardada. El proyecto no cambió.', applied: 'Vista aplicada. El análisis y el historial estructural se conservaron.',
    storageError: 'No se pudo guardar en este dispositivo.', conflict: 'Ya existe un favorito activo con ese nombre.', invalid: 'Escribe un nombre válido.', applyError: 'No se pudo aplicar la vista.', day: 'Día', night: 'Noche',
  },
  en: {
    title: 'Favorite views', body: 'Save theme and visual preferences. Selecting one does not modify the project.', favorite: 'Favorite view', none: 'No views are saved.',
    apply: 'Apply view', name: 'Name to save', save: 'Save current view', saved: 'View saved. The project was not changed.', applied: 'View applied. Analysis and structural history were preserved.',
    storageError: 'Could not save on this device.', conflict: 'An active favorite already uses that name.', invalid: 'Enter a valid name.', applyError: 'The view could not be applied.', day: 'Day', night: 'Night',
  },
} as const;

const feedbackFor = (result: LibraryOperationResult, copy: typeof COPY.es | typeof COPY.en) => result.ok
  ? { kind: 'status' as const, message: copy.saved }
  : {
    kind: 'error' as const,
    message: result.reason === 'storage-unavailable' ? copy.storageError : result.reason === 'name-conflict' ? copy.conflict : copy.invalid,
  };

export const ViewFavoritesPanel = ({
  language,
  units,
  theme,
  view,
  onApply,
  storage = localStorage,
}: {
  language: 'es' | 'en';
  units: UnitSystemId;
  theme: ThemeMode;
  view: CanvasViewSettings;
  onApply: (favorite: PersonalViewFavorite) => void;
  storage?: Storage;
}) => {
  const copy = COPY[language];
  const repository = usePersonalLibrary(storage);
  const favorites = useMemo(() => repository.library.filter((favorite): favorite is PersonalViewFavorite => !favorite.deletedAt && favorite.kind === 'view'), [repository.library]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'status' | 'error'; message: string }>();
  const selected = favorites.find((favorite) => favorite.id === selectedId) ?? favorites[0];

  const save = () => {
    const result = repository.create({ kind: 'view', name, theme, view, unitsAtSave: units });
    setFeedback(feedbackFor(result, copy));
    if (result.ok) setName('');
  };

  const apply = () => {
    if (!selected) return;
    try {
      onApply(selected);
      setFeedback({ kind: 'status', message: copy.applied });
    } catch {
      setFeedback({ kind: 'error', message: copy.applyError });
    }
  };

  return <section className="member-favorites view-favorites" aria-labelledby="view-favorites-title">
    <header><h3 id="view-favorites-title">{copy.title}</h3><p>{copy.body}</p></header>
    <label><span>{copy.favorite}</span><select aria-label={copy.favorite} value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.currentTarget.value)} disabled={!favorites.length}>
      {!favorites.length ? <option value="">{copy.none}</option> : favorites.map((favorite) => <option key={favorite.id} value={favorite.id}>{favorite.name} · {favorite.theme === 'light' ? copy.day : copy.night} · {favorite.unitsAtSave}</option>)}
    </select></label>
    <button type="button" className="member-favorites__apply" disabled={!selected} onClick={apply}>{copy.apply}</button>
    <div className="member-favorites__save">
      <label><span>{copy.name}</span><input aria-label={copy.name} value={name} onChange={(event) => setName(event.currentTarget.value)} /></label>
      <button type="button" onClick={save}>{copy.save}</button>
    </div>
    {feedback ? <p className="member-favorites__feedback" role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</p> : null}
  </section>;
};
