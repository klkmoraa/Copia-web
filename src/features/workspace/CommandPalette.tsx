import { useCallback, useEffect, useId, useMemo, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useModalFocus } from '../../design-system/components/modalFocus';
import { Search } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { useProject } from '../../store/ProjectContext';
import { buildCommands, type CommandCategory, type CommandContext, type CommandListItem } from './commandRegistry';
import type { EditorLayerAction } from '../canvas/editorLayers';
import type { SurfacePresentation } from './surfacePresentation';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  dispatchLayers: Dispatch<EditorLayerAction>;
  presentation?: Extract<SurfacePresentation, 'overlay' | 'sheet'>;
}

const GROUP_LABEL_KEYS: Record<CommandCategory, TranslationKey> = {
  tools: 'palette.groupTools',
  view: 'palette.groupView',
  results: 'palette.groupResults',
  analysis: 'palette.groupAnalysis',
  navigate: 'palette.groupNavigate',
  export: 'palette.groupExport',
};

const GROUP_ORDER: readonly CommandCategory[] = ['analysis', 'tools', 'navigate', 'results', 'view', 'export'];

/** Coincidencia por subcadena sobre etiqueta y pista, sin acentos ni mayúsculas. */
const normalize = (value: string) => value
  .toLocaleLowerCase('es')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '');

/**
 * Paleta de comandos (Ctrl/⌘ + K).
 *
 * No construye su propia lista de comandos: proyecta `commandRegistry`
 * (CRI-103), la misma fuente que alimenta los botones visibles y los atajos
 * de teclado. Su valor está en alcanzar esos comandos con el teclado sin
 * recordar dónde vive cada control, y en poder saltar a un nudo o una barra
 * por su identificador — la única parte que sigue siendo contenido propio de
 * la paleta, porque es dato del proyecto, no un comando fijo.
 */
export const CommandPalette = ({ open, onClose, dispatchLayers, presentation = 'overlay' }: CommandPaletteProps) => {
  const {
    project, analysis, theme, canUndo, canRedo, isAnalyzing, selection,
    setActiveTool, setSelection, setResultTab, setTheme, updateProjectView, analyze, undo, redo,
  } = useProject();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const titleId = useId();

  const close = useCallback(() => onClose(), [onClose]);

  const context = useMemo<CommandContext>(() => ({
    t,
    project,
    hasAnalysis: Boolean(analysis),
    isAnalyzing,
    canUndo,
    canRedo,
    classroomMode: project.settings.calculationMode === 'classroom',
    theme,
    setActiveTool,
    setSelection,
    setResultTab,
    setTheme,
    updateProjectView,
    dispatchLayers,
    analyze,
    undo,
    redo,
  }), [
    t, project, analysis, isAnalyzing, canUndo, canRedo, theme,
    setActiveTool, setSelection, setResultTab, setTheme, updateProjectView, dispatchLayers, analyze, undo, redo,
  ]);

  const commands = useMemo<CommandListItem[]>(() => buildCommands(context), [context]);

  /** Ejecuta un comando de la paleta: la cierra y, si abre una superficie que
   *  monta al abrirse, difiere el efecto un frame para no competir con el
   *  cierre/restauración de foco de la propia paleta. */
  const execute = useCallback((command: CommandListItem) => {
    if (command.deferredOpen) {
      close();
      window.requestAnimationFrame(() => command.run());
      return;
    }
    command.run();
    close();
  }, [close]);

  const matches = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return commands;
    return commands.filter((command) =>
      normalize(command.label).includes(needle) || (command.hint ? normalize(command.hint).includes(needle) : false));
  }, [commands, query]);

  const enabled = useMemo(() => matches.filter((command) => !command.disabled), [matches]);

  useEffect(() => setActiveIndex(0), [query, open]);

  /**
   * Foco, `Escape` y bloqueo de scroll, del sistema de diseño.
   *
   * La paleta era el ÚNICO diálogo del producto que se los hacía a mano, y se
   * dejaba tres: sin trampa de foco —`Tab` salía a la mesa de detrás y seguía
   * tabulando por el lienzo—, sin bloqueo de scroll —la página de debajo se
   * desplazaba— y sin `aria-modal`, que además hacía que `isOwnHistoryScope`
   * (`commandRegistry.ts`) no la reconociera y dejara vivo el deshacer global
   * mientras estaba abierta. `useModalFocus` hace las tres cosas y ya las hace
   * bien para los demás diálogos.
   */
  useModalFocus({
    open,
    containerRef: dialogRef,
    onEscape: close,
    initialFocus: () => inputRef.current,
  });

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-palette-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, matches, open]);

  if (!open) return null;

  const move = (delta: number) => {
    if (enabled.length === 0) return;
    setActiveIndex((current) => (current + delta + enabled.length) % enabled.length);
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Home') { event.preventDefault(); setActiveIndex(0); }
    else if (event.key === 'End') { event.preventDefault(); setActiveIndex(Math.max(0, enabled.length - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); const command = enabled[activeIndex]; if (command) execute(command); }
  };

  const activeCommandId = enabled[activeIndex]?.id;

  return <div
    className={`command-palette-backdrop command-palette-backdrop--${presentation}`}
    data-surface-presentation={presentation}
    role="presentation"
    onPointerDown={(event) => {
    if (event.target === event.currentTarget) close();
  }}>
    <div ref={dialogRef} className="command-palette" data-workspace-surface="palette" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <h2 id={titleId} className="command-palette-title">{t('palette.title')}</h2>
      <div className="command-palette-search">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          data-surface-focus-key="command-query"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeCommandId ? `${listId}-${activeCommandId}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={t('palette.placeholder')}
          aria-label={t('palette.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
        />
        <kbd>Esc</kbd>
      </div>

      <div className="command-palette-list" id={listId} role="listbox" aria-label={t('palette.title')} ref={listRef}>
        {matches.length === 0 ? <p className="command-palette-empty">{t('palette.noResults', { query: query.trim() })}</p> : null}
        {GROUP_ORDER.map((group) => {
          const groupCommands = matches.filter((command) => command.category === group);
          if (groupCommands.length === 0) return null;
          return <section key={group} className="command-palette-group">
            <h3>{t(GROUP_LABEL_KEYS[group])}</h3>
            {groupCommands.map((command) => {
              const Icon = command.icon;
              const isActive = command.id === activeCommandId;
              return <button
                key={command.id}
                id={`${listId}-${command.id}`}
                type="button"
                role="option"
                /* Sin etiqueta explícita, el nombre accesible concatena
                   `strong`+`small`+`kbd` sin separación ("NodoN"). */
                aria-label={[command.label, command.hint, command.shortcut].filter(Boolean).join(' · ')}
                aria-selected={isActive}
                aria-disabled={command.disabled}
                data-palette-active={isActive}
                className={`command-palette-item${isActive ? ' is-active' : ''}`}
                disabled={command.disabled}
                onPointerEnter={() => {
                  const index = enabled.findIndex((candidate) => candidate.id === command.id);
                  if (index >= 0) setActiveIndex(index);
                }}
                onClick={() => execute(command)}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="command-palette-label">
                  <strong>{command.label}</strong>
                  {command.hint ? <small>{command.hint}</small> : null}
                </span>
                {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
              </button>;
            })}
          </section>;
        })}
      </div>

      <footer className="command-palette-footer">
        <span>{t('palette.hintNavigate')}</span>
        <span>{selection && selection.kind !== 'multi' ? t('palette.currentSelection', { id: selection.id }) : t('palette.noSelection')}</span>
      </footer>
    </div>
  </div>;
};
