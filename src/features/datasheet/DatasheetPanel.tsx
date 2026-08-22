import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Drawer } from '../../design-system/components/overlays';
import { useI18n } from '../../i18n/useI18n';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import type { Selection } from '../../types';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import type { SurfaceExtent, SurfacePresentation } from '../workspace/surfacePresentation';
import type { DatasheetCellEditorProps } from './DatasheetCellEditor';
import { DatasheetEditorPanel } from './DatasheetEditorPanel';
import { DatasheetGrid } from './DatasheetGrid';
import { DatasheetReviewPanel, type DatasheetPasteReport } from './DatasheetReviewPanel';
import { applyDatasheetPlan } from './datasheetEditApply';
import {
  EMPTY_DATASHEET_DRAFT,
  datasheetDraftCount,
  draftKey,
  interpretDatasheetEdits,
  stageDatasheetEdit,
  type DatasheetEditDraft,
  type DatasheetEditPlan,
} from './datasheetEditDraft';
import { datasheetField, datasheetRowField, type DatasheetFieldId } from './datasheetEditModel';
import { mapPasteToEdits, parseClipboardGrid } from './datasheetPaste';
import { clampGridPosition, type GridPosition } from './datasheetGridNavigation';
import {
  applyDatasheetPipeline,
  datasheetColumns,
  datasheetFacets,
  datasheetRowSearchText,
  projectDatasheetRows,
  type DatasheetColumn,
  type DatasheetEntity,
  type DatasheetRow,
  type DatasheetSort,
} from './datasheetModel';
import {
  datasheetEditorText,
  datasheetFieldOptions,
  editabilityMessageKey,
  formatDatasheetNumber,
} from './datasheetPresentation';
import { modifierLabel } from '../../design-system/platformKeys';
import './datasheet.css';

/**
 * Datasheet estructural — fase de auditoría (CRI-81).
 *
 * Es una **proyección** del proyecto, no un modelo paralelo: no hay estado de
 * entidades aquí, ni historial, ni undo propios. Lo único que este componente
 * guarda es la vista —entidad, búsqueda, filtros, orden y celda enfocada—, que
 * no es información del modelo y desaparece al cerrar sin dejar rastro.
 *
 * La selección es la del workspace. Seleccionar varias filas produce una
 * selección `multi`, que es exactamente lo que ya consumen el lienzo, el
 * Inspector y la edición múltiple.
 */

const selectionIds = (selection: Selection, entity: DatasheetEntity): ReadonlySet<string> => {
  if (!selection) return new Set();
  if (entity === 'loads') {
    // `Selection.multi` sólo transporta nudos y miembros, así que una tabla de
    // cargas sincroniza como mucho la fila enfocada. No se amplía `Selection`:
    // editar varias cargas no lo necesita, porque las ediciones son por celda.
    return selection.kind === 'nodalLoad' || selection.kind === 'memberLoad'
      ? new Set([selection.id])
      : new Set();
  }
  if (selection.kind === 'multi') return new Set(entity === 'nodes' ? selection.nodeIds : selection.memberIds);
  const expected = entity === 'nodes' ? 'node' : 'member';
  return selection.kind === expected ? new Set([selection.id]) : new Set();
};

/** Selección de una carga: siempre simple, porque `multi` no la sabe transportar. */
const buildLoadSelection = (rows: readonly DatasheetRow[], ids: readonly string[]): Selection => {
  const row = ids.length === 1 ? rows.find((candidate) => candidate.id === ids[0]) : undefined;
  if (!row) return null;
  return row.kind === 'nodalLoad' ? { kind: 'nodalLoad', id: row.id } : { kind: 'memberLoad', id: row.id };
};

/** Construye la selección del workspace conservando la de la otra entidad. */
const buildSelection = (
  entity: DatasheetEntity,
  ids: readonly string[],
  current: Selection,
  rows: readonly DatasheetRow[],
): Selection => {
  if (entity === 'loads') return buildLoadSelection(rows, ids);
  const other = current?.kind === 'multi'
    ? (entity === 'nodes' ? current.memberIds : current.nodeIds)
    : current?.kind === (entity === 'nodes' ? 'member' : 'node')
      ? [current.id]
      : [];
  const nodeIds = entity === 'nodes' ? [...ids] : [...other];
  const memberIds = entity === 'nodes' ? [...other] : [...ids];
  if (nodeIds.length === 0 && memberIds.length === 0) return null;
  if (nodeIds.length === 1 && memberIds.length === 0) return { kind: 'node', id: nodeIds[0] };
  if (memberIds.length === 1 && nodeIds.length === 0) return { kind: 'member', id: memberIds[0] };
  return { kind: 'multi', nodeIds, memberIds };
};

export interface DatasheetPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo?: HTMLElement | null;
  presentation?: Extract<SurfacePresentation, 'drawer' | 'fullscreen'>;
  onSurfaceReady?: (ready: boolean) => void;
  /** `default` | `peek` (CRI-102). The broker owns this; the panel only renders it. */
  extent?: SurfaceExtent;
  /** Degrades to `peek` instead of closing — "Localizar" never closes the sheet. */
  onPeek?: () => void;
  /** Restores from `peek` back to `default`. */
  onRestore?: () => void;
}

export const DatasheetPanel = ({
  open,
  onOpenChange,
  returnFocusTo,
  presentation = 'drawer',
  onSurfaceReady,
  extent = 'default',
  onPeek,
  onRestore,
}: DatasheetPanelProps) => {
  const { language, t } = useI18n();
  const { project, updateProject } = useProjectModel();
  const { selection, setSelection } = useWorkspaceUI();
  const [entity, setEntity] = useState<DatasheetEntity>('nodes');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, ReadonlySet<string>>>({});
  const [sort, setSort] = useState<DatasheetSort | null>(null);
  const [focus, setFocus] = useState<GridPosition>({ row: 0, column: 0 });
  const [announcement, setAnnouncement] = useState('');
  /**
   * Borrador de edición. No es estado del modelo: es lo que el usuario tecleó y
   * todavía no aplicó, y desaparece al aplicar, al cancelar o al cerrar.
   */
  const [draft, setDraft] = useState<DatasheetEditDraft>(EMPTY_DATASHEET_DRAFT);
  const [editing, setEditing] = useState<GridPosition | null>(null);
  /** Presente sólo cuando el borrador viene de un pegado, con lo que descartó. */
  const [paste, setPaste] = useState<DatasheetPasteReport | null>(null);
  /**
   * De dónde viene el borrador. La rejilla no tiene dónde explicar un cambio
   * pendiente, así que a partir de dos —o de un error— necesita la revisión. El
   * panel editor sí lo explica: enseña el preview, el error junto a su campo y
   * su propia barra de Aplicar, y sustituirlo por la revisión mientras se edita
   * le quitaría al usuario justo lo que estaba mirando.
   */
  const [draftSource, setDraftSource] = useState<'grid' | 'panel' | null>(null);
  /** Ancla del rango con `Mayús`; es estado de interacción, no del modelo. */
  const rangeAnchorRef = useRef<string | null>(null);

  const units = project.settings.units;
  const columns = datasheetColumns(entity);
  const allRows = useMemo(() => projectDatasheetRows(project, entity), [project, entity]);

  const haystack = useCallback(
    (row: Parameters<typeof datasheetRowSearchText>[0]) => datasheetRowSearchText(
      row,
      (key) => t(key),
      (value, quantity) => formatDatasheetNumber(value, units, quantity),
    ),
    [t, units],
  );

  const facets = useMemo(() => datasheetFacets(allRows, entity), [allRows, entity]);
  const pipelineRows = useMemo(
    () => applyDatasheetPipeline({ rows: allRows, query, filters, sort, haystack }),
    [allRows, query, filters, sort, haystack],
  );

  const selectedIds = useMemo(() => selectionIds(selection, entity), [selection, entity]);

  /**
   * Faceta "sólo la selección" (D-11). Es una lectura más encima del pipeline
   * canónico —no dentro de él—, así que el contrato del Datasheet (rejilla
   * propia, sin historial, escritura vía `updateProject`) no cambia.
   */
  const [selectionOnly, setSelectionOnly] = useState(false);
  const rows = useMemo(
    () => (selectionOnly ? pipelineRows.filter((row) => selectedIds.has(row.id)) : pipelineRows),
    [pipelineRows, selectedIds, selectionOnly],
  );

  // Cambiar de entidad invalida orden, filtros, foco y borrador: sus filas y sus
  // columnas son otras, así que un cambio pendiente ya no tendría dónde caer.
  useEffect(() => {
    setFilters({});
    setSort(null);
    setFocus({ row: 0, column: 0 });
    setDraft(EMPTY_DATASHEET_DRAFT);
    setEditing(null);
    setPaste(null);
    setDraftSource(null);
    setSelectionOnly(false);
    rangeAnchorRef.current = null;
  }, [entity]);

  // Buscar o filtrar puede dejar el foco fuera de la tabla; se reencaja para que
  // la rejilla nunca se quede sin su única parada de tabulación.
  useEffect(() => {
    setFocus((current) => {
      const next = clampGridPosition(current, { rows: rows.length, columns: columns.length });
      return next.row === current.row && next.column === current.column ? current : next;
    });
  }, [rows.length, columns.length]);

  // Al abrir, el datasheet se sitúa sobre lo que ya estaba seleccionado en el
  // lienzo, en vez de mandar al usuario a buscar su objeto en la primera fila.
  useEffect(() => {
    if (!open || !selection || selection.kind === 'multi') return;
    const targetEntity: DatasheetEntity | null = selection.kind === 'node'
      ? 'nodes'
      : selection.kind === 'member'
        ? 'members'
        : selection.kind === 'nodalLoad' || selection.kind === 'memberLoad' ? 'loads' : null;
    if (targetEntity) setEntity(targetEntity);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo en la apertura
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = rows.findIndex((row) => selectedIds.has(row.id));
    if (index >= 0) setFocus((current) => (current.row === index ? current : { ...current, row: index }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al cambiar de entidad tras abrir
  }, [entity, open]);

  const target = useMemo(() => {
    const focusedRow = rows[Math.min(focus.row, Math.max(rows.length - 1, 0))];
    return focusedRow ? { kind: focusedRow.kind, id: focusedRow.id } : null;
  }, [focus.row, rows]);

  const onSelectRow = useCallback((rowId: string, mode: 'replace' | 'additive' | 'range') => {
    const current = [...selectedIds];
    if (mode === 'replace') {
      rangeAnchorRef.current = rowId;
      setSelection(buildSelection(entity, [rowId], selection, rows));
      return;
    }
    if (mode === 'additive') {
      rangeAnchorRef.current = rowId;
      const next = current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId];
      setSelection(buildSelection(entity, next, selection, rows));
      return;
    }
    const anchor = rangeAnchorRef.current ?? rowId;
    const from = rows.findIndex((row) => row.id === anchor);
    const to = rows.findIndex((row) => row.id === rowId);
    if (from < 0 || to < 0) {
      setSelection(buildSelection(entity, [rowId], selection, rows));
      return;
    }
    const range = rows.slice(Math.min(from, to), Math.max(from, to) + 1).map((row) => row.id);
    setSelection(buildSelection(entity, range, selection, rows));
  }, [entity, rows, selectedIds, selection, setSelection]);

  const onActivateRow = useCallback((rowId: string) => {
    rangeAnchorRef.current = rowId;
    setSelection(buildSelection(entity, [rowId], selection, rows));
  }, [entity, rows, selection, setSelection]);

  const onRequestEdit = useCallback((column: DatasheetColumn) => {
    setAnnouncement(t(editabilityMessageKey(column.editability), { column: t(column.labelKey) }));
  }, [t]);

  /* ---------------------------------------------------------------------- *
   * Edición: borrador → plan → preview → una sola escritura.
   * ---------------------------------------------------------------------- */

  const plan = useMemo(
    () => interpretDatasheetEdits(project, draft, units),
    [project, draft, units],
  );

  /**
   * Proyecto con el plan aplicado. Alimenta todos los previews, y sale de la
   * misma función que la escritura real: si fueran dos caminos podrían divergir,
   * y entonces lo que se ve antes de aplicar dejaría de ser lo que se escribe.
   */
  const previewProject = useMemo(() => applyDatasheetPlan(project, plan), [project, plan]);

  const applyPlan = useCallback((target: DatasheetEditPlan) => {
    if (!target.applicable) return;
    // Una sola escritura: el plan entero entra como una entrada de historial y
    // no existe camino por el que se aplique una parte.
    updateProject((current) => applyDatasheetPlan(current, target));
    setDraft(EMPTY_DATASHEET_DRAFT);
    setPaste(null);
    setDraftSource(null);
  }, [updateProject]);

  const onCancelDraft = useCallback(() => {
    setDraft(EMPTY_DATASHEET_DRAFT);
    setEditing(null);
    setPaste(null);
    setDraftSource(null);
  }, []);

  const onCommitEdit = useCallback((rowId: string, fieldId: DatasheetFieldId, raw: string) => {
    setEditing(null);
    const next = stageDatasheetEdit(draft, rowId, fieldId, raw);
    const nextPlan = interpretDatasheetEdits(project, next, units);
    // Con el borrador vacío, un cambio válido y único se aplica ya: pedir
    // «Aplicar» por cada celda haría inservible una hoja de datos. En cualquier
    // otro caso el cambio se suma al borrador y pasa por revisión.
    if (datasheetDraftCount(draft) === 0 && nextPlan.applicable && nextPlan.changes.length === 1) {
      applyPlan(nextPlan);
      return;
    }
    setDraft(next);
    setDraftSource('grid');
  }, [applyPlan, draft, project, units]);

  const onPasteBlock = useCallback((text: string, anchor: GridPosition) => {
    const result = mapPasteToEdits({ block: parseClipboardGrid(text), rows, columns, entity, anchor });
    if (result.edits.length === 0 && result.droppedOutside === 0 && result.droppedReadOnly === 0) return;
    setDraft((current) => result.edits.reduce(
      (accumulated, edit) => stageDatasheetEdit(accumulated, edit.rowId, edit.fieldId, edit.raw),
      current,
    ));
    // El recorte se guarda aunque sea cero: la revisión tiene que poder decir
    // que un pegado entró entero, no sólo cuándo se descartó algo.
    setPaste({ droppedOutside: result.droppedOutside, droppedReadOnly: result.droppedReadOnly });
    setDraftSource('grid');
  }, [columns, entity, rows]);

  const draftText = useCallback((row: DatasheetRow, column: DatasheetColumn): string | undefined => {
    const fieldId = datasheetRowField(entity, column.id, row.kind);
    return fieldId ? draft[draftKey(row.id, fieldId)] : undefined;
  }, [draft, entity]);

  const editorFor = useCallback((row: DatasheetRow, column: DatasheetColumn): DatasheetCellEditorProps | null => {
    const fieldId = datasheetRowField(entity, column.id, row.kind);
    if (!fieldId) return null;
    const field = datasheetField(fieldId);
    return {
      field,
      initialText: draft[draftKey(row.id, fieldId)]
        ?? datasheetEditorText(row.values[column.id], units, field),
      options: datasheetFieldOptions(field, project, language, t),
      label: t('datasheet.edit.cellLabel', { column: t(column.labelKey), row: row.id }),
      onCommit: (raw) => onCommitEdit(row.id, fieldId, raw),
      onCancel: () => setEditing(null),
    };
  }, [draft, entity, language, onCommitEdit, project, t, units]);

  /** Etiqueta de un campo para la revisión, que no conoce las columnas. */
  const fieldLabel = useCallback((fieldId: DatasheetFieldId): string => {
    const column = columns.find((candidate) => {
      const rowKinds = ['node', 'member', 'nodalLoad', 'memberLoad'] as const;
      return rowKinds.some((kind) => datasheetRowField(entity, candidate.id, kind) === fieldId);
    });
    return column ? t(column.labelKey) : fieldId;
  }, [columns, entity, t]);

  /** Escritura desde el panel editor: nunca se aplica sola, siempre al borrador. */
  const onStageFromPanel = useCallback((fieldId: DatasheetFieldId, raw: string) => {
    if (!target) return;
    setDraft((current) => stageDatasheetEdit(current, target.id, fieldId, raw));
    setDraftSource('panel');
  }, [target]);

  const panelDraftText = useCallback(
    (fieldId: DatasheetFieldId) => (target ? draft[draftKey(target.id, fieldId)] : undefined),
    [draft, target],
  );

  /**
   * La revisión sustituye al panel sólo cuando el borrador viene de la rejilla,
   * que no tiene dónde explicar un cambio pendiente, o de un pegado, que además
   * tiene que decir qué descartó.
   */
  const reviewing = paste !== null
    || (draftSource === 'grid' && (plan.errors.length > 0 || plan.changes.length > 1));

  const onClearSelection = useCallback(() => {
    if (selectedIds.size === 0) return false;
    setSelection(buildSelection(entity, [], selection, rows));
    rangeAnchorRef.current = null;
    return true;
  }, [entity, rows, selectedIds.size, selection, setSelection]);

  const onFocusObject = useCallback(() => {
    if (!target) return;
    setSelection({ kind: target.kind, id: target.id });
    // Localizar degrada a `peek`, nunca cierra (CRI-102 / D-11): la hoja sigue
    // montada con su fila, su desplazamiento y su borrador exactamente donde
    // estaban, sólo encogida para dejar ver el lienzo.
    onPeek?.();
    window.requestAnimationFrame(() => emitWorkspaceCommand('focus-object', { kind: target.kind, id: target.id }));
  }, [onPeek, setSelection, target]);

  const toggleFacet = useCallback((columnId: string, token: string) => {
    setFilters((current) => {
      const active = new Set(current[columnId] ?? []);
      if (active.has(token)) active.delete(token);
      else active.add(token);
      return { ...current, [columnId]: active };
    });
  }, []);

  return <Drawer
    open={open}
    onOpenChange={onOpenChange}
    side="bottom"
    presentation={presentation}
    title={t('datasheet.title')}
    description={t('datasheet.description')}
    closeLabel={t('datasheet.close')}
    className="datasheet-surface"
    returnFocusTo={returnFocusTo}
    restoreFocus={!onSurfaceReady}
    surfaceId="datasheet"
    onSurfaceReady={onSurfaceReady}
    extent={extent}
    onRestore={onRestore}
    restoreLabel={t('datasheet.restore')}
  >
    <div className="datasheet-layout">
      <div className="datasheet-main">
        <div className="datasheet-toolbar">
          <div className="datasheet-entity" role="group" aria-label={t('datasheet.entityGroup')}>
            {(['nodes', 'members', 'loads'] as const).map((candidate) => <button
              key={candidate}
              type="button"
              className={entity === candidate ? 'active' : ''}
              aria-pressed={entity === candidate}
              onClick={() => setEntity(candidate)}
            >
              {t(candidate === 'nodes'
                ? 'datasheet.entity.nodes'
                : candidate === 'members' ? 'datasheet.entity.members' : 'datasheet.entity.loads')}
              <span className="datasheet-entity__count">
                {candidate === 'nodes'
                  ? project.nodes.length
                  : candidate === 'members'
                    ? project.members.length
                    : project.nodalLoads.length + project.memberLoads.length}
              </span>
            </button>)}
          </div>

          <label className="datasheet-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder={t('datasheet.searchPlaceholder')}
              aria-label={t('datasheet.searchLabel')}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <button
            type="button"
            className={`datasheet-chip datasheet-selection-only${selectionOnly ? ' active' : ''}`}
            aria-pressed={selectionOnly}
            disabled={selectedIds.size === 0 && !selectionOnly}
            onClick={() => setSelectionOnly((current) => !current)}
          >{t('datasheet.selectionOnly')}</button>

          <p className="datasheet-count" role="status">
            {t('datasheet.rowCount', { visible: rows.length, total: allRows.length })}
          </p>
        </div>

        {facets.length > 0 ? <div className="datasheet-filters">
          {facets.map((facet) => <div key={facet.columnId} className="datasheet-filter" role="group" aria-label={t(facet.labelKey)}>
            <span className="datasheet-filter__label">{t(facet.labelKey)}</span>
            {facet.options.map((option) => {
              const active = filters[facet.columnId]?.has(option.token) ?? false;
              return <button
                key={option.token}
                type="button"
                className={`datasheet-chip${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleFacet(facet.columnId, option.token)}
              >
                {/* Un enumerado del dominio se traduce; lo que nombra el usuario
                    se muestra tal cual. El token nunca se enseña: es la clave. */}
                {option.labelKey ? t(option.labelKey) : option.label ?? option.token}
                <span className="datasheet-chip__count">{option.count}</span>
              </button>;
            })}
          </div>)}
        </div> : null}

        <DatasheetGrid
          columns={columns}
          rows={rows}
          units={units}
          t={t}
          selectedIds={selectedIds}
          focus={focus}
          onFocusChange={setFocus}
          sort={sort}
          onSortChange={setSort}
          onSelectRow={onSelectRow}
          onActivateRow={onActivateRow}
          onRequestEdit={onRequestEdit}
          onClearSelection={onClearSelection}
          emptyMessage={t('datasheet.emptyFiltered')}
          editing={editing}
          onBeginEdit={setEditing}
          onPasteBlock={onPasteBlock}
          draftText={draftText}
          editorFor={editorFor}
        />

        {/* La pista nombraba «Ctrl» en las dos lenguas y en las dos plataformas.
            El modificador se interpola: ⌘ donde ⌘ es lo que hay. */}
        <p className="datasheet-keyboard-hint">{t('datasheet.keyboardHint', { mod: modifierLabel('mod') })}</p>
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </div>

      {reviewing
        ? <DatasheetReviewPanel
          plan={plan}
          paste={paste}
          project={project}
          units={units}
          language={language}
          t={t}
          fieldLabel={fieldLabel}
          onApply={() => applyPlan(plan)}
          onCancel={onCancelDraft}
        />
        : <DatasheetEditorPanel
          project={project}
          previewProject={previewProject}
          target={target}
          units={units}
          language={language}
          t={t}
          draftText={panelDraftText}
          onStage={onStageFromPanel}
          pendingCount={datasheetDraftCount(draft)}
          planApplicable={plan.applicable}
          planErrors={plan.errors}
          onApply={() => applyPlan(plan)}
          onCancelDraft={onCancelDraft}
          onFocusObject={onFocusObject}
          focusLabel={t('datasheet.focusObject')}
        />}
    </div>
  </Drawer>;
};

export default DatasheetPanel;
