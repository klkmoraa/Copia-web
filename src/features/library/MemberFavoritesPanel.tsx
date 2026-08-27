import { useMemo, useState } from 'react';
import type { ProjectCommand } from '../../commands/projectCommand';
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { MemberModel, ProjectModel, UnitSystemId } from '../../types';
import type { LibraryOperationResult } from './usePersonalLibrary';
import { usePersonalLibrary } from './usePersonalLibrary';
import type { PersonalFavorite, PersonalFavoriteDraft } from './personalLibrary';
import { buildMemberFavoriteCommand, isMemberFavoriteAvailable } from './memberFavoriteCommand';
import './memberFavorites.css';

type StructuralFavorite = Exclude<PersonalFavorite, { kind: 'view' }>;

const COPY = {
  es: {
    title: 'Favoritos estructurales', body: 'Guarda o aplica identidades de catálogo. Nada cambia hasta que eliges Aplicar.',
    favorite: 'Favorito estructural', none: 'No hay favoritos estructurales guardados.', apply: 'Aplicar favorito', unavailable: 'Referencia de catálogo no disponible. El favorito se conserva, pero no puede aplicarse.',
    name: 'Nombre para guardar', saveMaterial: 'Guardar material', saveSection: 'Guardar sección', savePair: 'Guardar par',
    identityHint: 'Sólo se guardan identidades de catálogo explícitas; los valores personalizados no se infieren.',
    saved: 'Favorito guardado. El proyecto no cambió.', applied: 'Favorito aplicado al miembro en una sola operación.',
    storageError: 'No se pudo guardar en este dispositivo. El proyecto no cambió.', conflict: 'Ya existe un favorito activo con ese nombre.', invalid: 'Escribe un nombre válido y conserva una identidad de catálogo.', applyError: 'No se pudo aplicar el favorito. El proyecto conserva su estado anterior.',
  },
  en: {
    title: 'Structural favorites', body: 'Save or apply catalog identities. Nothing changes until you choose Apply.',
    favorite: 'Structural favorite', none: 'No structural favorites are saved.', apply: 'Apply favorite', unavailable: 'Catalog reference unavailable. The favorite is preserved but cannot be applied.',
    name: 'Name to save', saveMaterial: 'Save material', saveSection: 'Save section', savePair: 'Save pair',
    identityHint: 'Catalog identities only are saved; custom numeric values are never inferred.',
    saved: 'Favorite saved. The project was not changed.', applied: 'Favorite applied to the member as one operation.',
    storageError: 'Could not save on this device. The project was not changed.', conflict: 'An active favorite already uses that name.', invalid: 'Enter a valid name and keep an explicit catalog identity.', applyError: 'The favorite could not be applied. The project kept its previous state.',
  },
} as const;

const feedbackFor = (result: LibraryOperationResult, copy: typeof COPY.es | typeof COPY.en) => result.ok
  ? { kind: 'status' as const, message: copy.saved }
  : {
    kind: 'error' as const,
    message: result.reason === 'storage-unavailable' ? copy.storageError : result.reason === 'name-conflict' ? copy.conflict : copy.invalid,
  };

const favoriteLabel = (favorite: StructuralFavorite) => favorite.kind === 'material' ? `${favorite.name} · ${favorite.materialId}`
  : favorite.kind === 'section' ? `${favorite.name} · ${favorite.sectionId}`
    : `${favorite.name} · ${favorite.materialId} + ${favorite.sectionId}`;

export const MemberFavoritesPanel = ({
  project,
  member,
  language,
  units,
  executeProjectCommand,
  storage = localStorage,
}: {
  project: ProjectModel;
  member: MemberModel;
  language: 'es' | 'en';
  units: UnitSystemId;
  executeProjectCommand: (command: ProjectCommand) => Promise<unknown>;
  storage?: Storage;
}) => {
  const copy = COPY[language];
  const repository = usePersonalLibrary(storage);
  const favorites = useMemo(() => repository.library.filter((favorite): favorite is StructuralFavorite => !favorite.deletedAt && favorite.kind !== 'view'), [repository.library]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'status' | 'error'; message: string }>();
  const selected = favorites.find((favorite) => favorite.id === selectedId) ?? favorites[0];
  const command = selected ? buildMemberFavoriteCommand(project, member, selected) : null;
  const materialId = member.materialOrigin === 'catalog' && member.materialId && findStandardMaterial(member.materialId) ? member.materialId : undefined;
  const sectionId = member.sectionOrigin === 'catalog' && member.sectionId && findStandardSection(member.sectionId) ? member.sectionId : undefined;

  const save = (kind: StructuralFavorite['kind']) => {
    let draft: PersonalFavoriteDraft | null = null;
    if (kind === 'material' && materialId) draft = { kind, name, materialId, unitsAtSave: units };
    if (kind === 'section' && sectionId) draft = { kind, name, sectionId, unitsAtSave: units };
    if (kind === 'pair' && materialId && sectionId) draft = { kind, name, materialId, sectionId, unitsAtSave: units };
    const result = draft ? repository.create(draft) : { ok: false as const, reason: 'invalid' as const };
    setFeedback(feedbackFor(result, copy));
    if (result.ok) setName('');
  };

  const apply = async () => {
    if (!command) return;
    try {
      await executeProjectCommand(command);
      setFeedback({ kind: 'status', message: copy.applied });
    } catch {
      setFeedback({ kind: 'error', message: copy.applyError });
    }
  };

  return <section className="member-favorites" aria-labelledby={`member-favorites-${member.id}`}>
    <header><h3 id={`member-favorites-${member.id}`}>{copy.title}</h3><p>{copy.body}</p></header>
    <label><span>{copy.favorite}</span><select aria-label={copy.favorite} value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.currentTarget.value)} disabled={!favorites.length}>
      {!favorites.length ? <option value="">{copy.none}</option> : favorites.map((favorite) => <option key={favorite.id} value={favorite.id}>{favoriteLabel(favorite)}</option>)}
    </select></label>
    {selected && !isMemberFavoriteAvailable(selected) ? <p className="member-favorites__unavailable" role="status">{copy.unavailable}</p> : null}
    <button type="button" className="member-favorites__apply" disabled={!command} onClick={() => void apply()}>{copy.apply}</button>
    <div className="member-favorites__save">
      <label><span>{copy.name}</span><input aria-label={copy.name} value={name} onChange={(event) => setName(event.currentTarget.value)} /></label>
      <div>
        <button type="button" disabled={!materialId} onClick={() => save('material')}>{copy.saveMaterial}</button>
        <button type="button" disabled={!sectionId} onClick={() => save('section')}>{copy.saveSection}</button>
        <button type="button" disabled={!materialId || !sectionId} onClick={() => save('pair')}>{copy.savePair}</button>
      </div>
      <small>{copy.identityHint}</small>
    </div>
    {feedback ? <p className="member-favorites__feedback" role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</p> : null}
  </section>;
};
