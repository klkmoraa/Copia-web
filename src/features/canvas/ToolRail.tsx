import {
  BoxSelect,
  ChevronRight,
  CircleDot,
  Component,
  Crosshair,
  Delete,
  GitCommitHorizontal,
  Grid3x3,
  Hand,
  Move,
  MousePointer2,
  MoreHorizontal,
  MoveDiagonal2,
  RotateCcw,
  Ruler,
  Search,
  Scissors,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import type { Tool } from '../../types';
import { ToolButton as EditorToolButton, type ToolTone } from '../../design-system/components/editor';
import { STRUCTURAL_TOOL_IDS, StructuralToolIcon } from './StructuralToolIcon';
import {
  TOOL_GROUPS,
  TOOL_REGISTRY,
  type ToolDefinition,
  toolsInGroup,
} from './toolRegistry';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import { useShellComposition } from '../workspace/useShellComposition';

const toolIcons: Record<Tool, LucideIcon> = {
  select: MousePointer2,
  pan: Hand,
  node: CircleDot,
  member: GitCommitHorizontal,
  support: Component,
  pointLoad: MoveDiagonal2,
  distributedLoad: Sigma,
  moment: RotateCcw,
  dimension: Ruler,
  split: Scissors,
  cut: Crosshair,
  delete: Delete,
};

const ToolGlyph = ({ definition, size = 22 }: { definition: ToolDefinition; size?: number }) => {
  const Icon = toolIcons[definition.id];
  return STRUCTURAL_TOOL_IDS.has(definition.id)
    ? <StructuralToolIcon tool={definition.id} />
    : <Icon size={size} strokeWidth={1.8} />;
};

const toolTones: Record<Tool, ToolTone> = {
  select: 'navigation',
  pan: 'navigation',
  node: 'structure',
  member: 'structure',
  support: 'structure',
  pointLoad: 'load',
  distributedLoad: 'distributed',
  moment: 'moment',
  dimension: 'dimension',
  split: 'structure',
  cut: 'cut',
  delete: 'destructive',
};

/**
 * Tooltip local del riel, visible por foco y no sólo por hover (CRI-98 §4).
 * Se porta a `document.body` a propósito: `.toolbar` scrollea en Y
 * (`overflow-y:auto`), y eso recorta cualquier burbuja posicionada dentro de
 * su propia caja, sobre todo en `M1` donde el riel mide apenas 76px de ancho.
 */
const RailTooltip = ({ id, content, children }: { id: string; content: string; children: ReactNode }) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const rect = open ? anchorRef.current?.getBoundingClientRect() : undefined;

  return <span
    ref={anchorRef}
    className="tool-rail-tooltip-anchor"
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => setOpen(false)}
    onFocus={() => setOpen(true)}
    onBlur={() => setOpen(false)}
  >
    {children}
    {rect && typeof document !== 'undefined' ? createPortal(
      <span
        role="tooltip"
        id={id}
        className="tool-rail-tooltip"
        style={{ top: rect.top + rect.height / 2, left: rect.right + 8 }}
      >{content}</span>,
      document.body,
    ) : null}
  </span>;
};

const RegisteredToolButton = ({
  definition,
  label,
  active,
  compact = false,
  className = '',
  onSelect,
  menuItem = false,
  'aria-describedby': ariaDescribedBy,
}: {
  definition: ToolDefinition;
  label: string;
  active: boolean;
  compact?: boolean;
  className?: string;
  onSelect: (tool: Tool) => void;
  menuItem?: boolean;
  'aria-describedby'?: string;
}) => {
  const { id, shortcut } = definition;
  return <EditorToolButton
    className={`tool-button tool-${id}${active ? ' active' : ''}${definition.destructive ? ' destructive' : ''}${className ? ` ${className}` : ''}`}
    label={label}
    icon={<ToolGlyph definition={definition} />}
    shortcut={shortcut}
    keyShortcut={definition.activationKey?.toUpperCase() ?? 'Delete Backspace'}
    tone={toolTones[id]}
    active={active}
    compact={compact}
    onClick={() => onSelect(id)}
    aria-describedby={ariaDescribedBy}
    role={menuItem ? 'menuitemradio' : undefined}
    aria-checked={menuItem ? active : undefined}
    data-tool-id={id}
    data-tool-group={definition.group}
  />;
};

const PaletteToolButton = ({
  definition,
  label,
  detail,
  active,
  onSelect,
}: {
  definition: ToolDefinition;
  label: string;
  detail: string;
  active: boolean;
  onSelect: (tool: Tool) => void;
}) => (
  <button
    className={`mobile-palette-tool tool-${definition.id}${active ? ' active' : ''}${definition.destructive ? ' destructive' : ''}`}
    onClick={() => onSelect(definition.id)}
    aria-label={`${label}. ${detail}`}
    role="menuitemradio"
    aria-checked={active}
    aria-keyshortcuts={definition.activationKey?.toUpperCase() ?? 'Delete Backspace'}
    data-tool-id={definition.id}
    data-tool-group={definition.group}
  >
    <span className="mobile-palette-icon" aria-hidden="true"><ToolGlyph definition={definition} size={22} /></span>
    <span className="mobile-palette-copy"><strong>{label}</strong><small>{detail}</small></span>
    <ChevronRight size={18} aria-hidden="true" />
    <kbd>{definition.shortcut}</kbd>
  </button>
);

const CommandPaletteButton = ({
  label,
  accessibleLabel,
  compact = false,
  'aria-describedby': ariaDescribedBy,
}: { label: string; accessibleLabel: string; compact?: boolean; 'aria-describedby'?: string }) => <button
  type="button"
  className={`sc-tool-button sc-tool-button--navigation tool-button tool-command-palette${compact ? ' is-compact' : ''}`}
  aria-label={accessibleLabel}
  aria-describedby={ariaDescribedBy}
  aria-keyshortcuts="Control+K Meta+K"
  onClick={() => emitWorkspaceCommand('open-command-palette')}
>
  <span className="sc-tool-button__icon" aria-hidden="true"><Search size={22} strokeWidth={1.8} /></span>
  <span className="sc-tool-button__copy"><strong>{label}</strong></span>
  {!compact ? <kbd>Ctrl K</kbd> : null}
</button>;

const MobileCommandPaletteButton = ({ label, accessibleLabel, onOpen }: { label: string; accessibleLabel: string; onOpen: () => void }) => <button
  className="mobile-palette-tool tool-command-palette"
  type="button"
  role="menuitem"
  aria-label={accessibleLabel}
  aria-keyshortcuts="Control+K Meta+K"
  onClick={onOpen}
>
  <span className="mobile-palette-icon" aria-hidden="true"><Search size={22} strokeWidth={1.8} /></span>
  <span className="mobile-palette-copy"><strong>{label}</strong></span>
  <ChevronRight size={18} aria-hidden="true" />
  <kbd>Ctrl K</kbd>
</button>;

/** The portal sheet owns inertness; restore it synchronously when it closes. */
const setAppShellMobileInert = (inert: boolean) => {
  const background = document.querySelector<HTMLElement>('.app-shell');
  if (!background) return;
  background.inert = inert;
  if (inert) background.setAttribute('aria-hidden', 'true');
  else background.removeAttribute('aria-hidden');
};

/**
 * Único componente del riel de herramientas (CRI-98): su forma la decide la
 * clase de composición resuelta por el shell (`useShellComposition`), nunca
 * un `matchMedia` propio. `X2` lleva etiqueta, `M1` es icon-only, `K0` es la
 * paleta táctil — sin booleano de compatibilidad que un llamador pueda pasar
 * por su cuenta.
 */
export const ToolRail = () => {
  const { activeTool, setActiveTool, project, selection } = useProject();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mobileMenu, setMobileMenu] = useState<'loads' | 'more' | null>(null);
  const loadMenuButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const paletteRef = useRef<HTMLElement>(null);
  const { shellClass } = useShellComposition();
  const previousShellClassRef = useRef(shellClass);
  /** Expanded (`X2`) lleva etiqueta; Medium (`M1`) y Compact (`K0`) son icon-only. */
  const compact = shellClass !== 'X2';
  const { t } = useI18n();
  const classroom = project.settings.calculationMode === 'classroom';
  const activeDefinition = TOOL_REGISTRY.find((tool) => tool.id === activeTool);
  const revealAdvanced = showAdvanced || Boolean(activeDefinition?.classroomAdvanced);
  const visibleTools = classroom && !revealAdvanced
    ? TOOL_REGISTRY.filter((tool) => !tool.classroomAdvanced)
    : TOOL_REGISTRY;
  const mobilePrimaryTools = TOOL_REGISTRY.filter((tool) => tool.mobile === 'primary');
  const mobilePaletteTools = TOOL_REGISTRY.filter((tool) => tool.mobile === mobileMenu);
  const loadToolActive = TOOL_REGISTRY.some((tool) => tool.mobile === 'loads' && tool.id === activeTool);
  const moreToolActive = TOOL_REGISTRY.some((tool) => tool.mobile === 'more' && tool.id === activeTool);
  const loadGroupHighlighted = mobileMenu ? mobileMenu === 'loads' : loadToolActive;
  const moreGroupHighlighted = mobileMenu ? mobileMenu === 'more' : moreToolActive;
  const canEditSelection = selection?.kind === 'node'
    || selection?.kind === 'member'
    || (selection?.kind === 'multi' && (selection.nodeIds.length > 0 || selection.memberIds.length > 0));

  const selectTool = (tool: Tool) => {
    setActiveTool(tool);
    if (mobileMenu) closeMobileMenu();
    else setMobileMenu(null);
  };

  const openCommandPaletteFromMobile = () => {
    moreMenuButtonRef.current?.focus({ preventScroll: true });
    setMobileMenu(null);
    emitWorkspaceCommand('open-command-palette');
  };

  const openStructuralEditFromMobile = () => {
    closeMobileMenu(false);
    window.requestAnimationFrame(() => emitWorkspaceCommand('open-structural-edit'));
  };

  const openStructureGeneratorFromMobile = () => {
    closeMobileMenu(false);
    window.requestAnimationFrame(() => emitWorkspaceCommand('open-structure-generator'));
  };

  const closeMobileMenu = (restoreFocus = true) => {
    const closingMenu = mobileMenu;
    setMobileMenu(null);
    // Do not wait for the effect cleanup: the selected portal action may open
    // an immediate canvas interaction on the following animation frame.
    setAppShellMobileInert(false);
    if (!restoreFocus || !closingMenu) return;
    window.requestAnimationFrame(() => {
      (closingMenu === 'loads' ? loadMenuButtonRef : moreMenuButtonRef).current?.focus();
    });
  };

  useEffect(() => {
    if (!mobileMenu) return undefined;
    const palette = paletteRef.current;
    setAppShellMobileInert(true);
    const focusFrame = window.requestAnimationFrame(() => paletteRef.current?.querySelector<HTMLButtonElement>('.mobile-palette-tool')?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileMenu();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(palette?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
      if (!focusable.length) {
        event.preventDefault();
        palette?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !palette?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !palette?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      setAppShellMobileInert(false);
    };
    // closeMobileMenu intentionally captures the currently open sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileMenu]);

  // Las hojas de herramientas sólo existen como presentación en Compact: al
  // salir de `K0` dejan de tener destino. Igual que el `change` de la media
  // query que sustituye, sólo reacciona al CAMBIO de clase — montar la barra ya
  // fuera de Compact no puede cerrar una hoja que el usuario acaba de abrir.
  useEffect(() => {
    if (previousShellClassRef.current === shellClass) return;
    previousShellClassRef.current = shellClass;
    if (shellClass !== 'K0') setMobileMenu(null);
  }, [shellClass]);

  const paletteTitle = mobileMenu === 'loads' ? t('toolbar.addLoad') : t('toolbar.moreSheetTitle');
  const paletteDescription = mobileMenu === 'loads' ? t('toolbar.loadSheetDescription') : t('toolbar.moreSheetDescription');
  const paletteGroups = TOOL_GROUPS.filter((group) =>
    mobilePaletteTools.some((tool) => tool.group === group.id)
      || (group.id === 'edit' && canEditSelection)
      // Generar no es una herramienta del registro y no depende de la
      // selección, pero pertenece a «Crear»: sin esto su grupo no existiría en
      // la hoja y la única vía en compacto sería la paleta de comandos.
      || (group.id === 'create' && mobileMenu === 'more'),
  );
  const mobilePalette = mobileMenu && typeof document !== 'undefined' ? createPortal(<>
    <button type="button" className="mobile-tool-sheet-backdrop" aria-hidden="true" tabIndex={-1} onPointerDown={() => closeMobileMenu()} />
    <section
      ref={paletteRef}
      className={`mobile-tool-palette mobile-tool-palette-${mobileMenu}`}
      role="dialog"
      aria-modal="true"
      aria-label={paletteTitle}
      aria-describedby="mobile-tool-palette-description"
      tabIndex={-1}
    >
      <div className="mobile-tool-palette-handle" aria-hidden="true" />
      <header className="mobile-tool-palette-header">
        <div><strong>{paletteTitle}</strong><span id="mobile-tool-palette-description">{paletteDescription}</span></div>
        <button type="button" className="mobile-tool-palette-close" onClick={() => closeMobileMenu()}>{t('toolbar.close')}</button>
      </header>
      <div className="mobile-tool-palette-list" role="menu" aria-label={paletteTitle}>
        {paletteGroups.map((group) => <div key={group.id} className="mobile-palette-group" role="group" aria-label={t(group.labelKey)}>
          <h3>{t(group.labelKey)}</h3>
          {toolsInGroup(group.id, mobilePaletteTools).map((definition) => <PaletteToolButton
            key={definition.id}
            definition={definition}
            label={t(definition.labelKey)}
            detail={definition.detailKey ? t(definition.detailKey) : ''}
            active={activeTool === definition.id}
            onSelect={selectTool}
          />)}
          {group.id === 'navigate' ? <MobileCommandPaletteButton label={t('palette.openShort')} accessibleLabel={t('palette.open')} onOpen={openCommandPaletteFromMobile} /> : null}
          {group.id === 'create' ? <button
            className="mobile-palette-tool tool-structure-generator"
            type="button"
            role="menuitem"
            aria-label={t('generator.launcher')}
            onClick={openStructureGeneratorFromMobile}
            data-structure-generator-command
          >
            <span className="mobile-palette-icon" aria-hidden="true"><Grid3x3 size={22} strokeWidth={1.8} /></span>
            <span className="mobile-palette-copy"><strong>{t('generator.launcher')}</strong></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button> : null}
          {group.id === 'edit' && canEditSelection ? <button
            className="mobile-palette-tool tool-structural-edit"
            type="button"
            role="menuitem"
            aria-label={t('canvas.structuralEditLauncher')}
            onClick={openStructuralEditFromMobile}
            data-structural-edit-command
          >
            <span className="mobile-palette-icon" aria-hidden="true"><Move size={22} strokeWidth={1.8} /></span>
            <span className="mobile-palette-copy"><strong>{t('canvas.structuralEditLauncher')}</strong></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button> : null}
        </div>)}
      </div>
    </section>
  </>, document.body) : null;

  return (
    <>
      <aside className={`toolbar tool-rail${compact ? ' is-compact' : ''}${mobileMenu ? ' mobile-menu-open' : ''}`} aria-label={t('toolbar.label')} data-tool-rail={compact ? 'compact' : 'expanded'}>
        <div className="desktop-tool-list">
          {TOOL_GROUPS.map((group) => {
            const groupTools = toolsInGroup(group.id, visibleTools);
            if (!groupTools.length && !(group.id === 'edit' && canEditSelection)) return null;
            const headingId = `tool-group-${group.id}`;
            return <section key={group.id} className={`tool-group tool-group-${group.id}`} role="group" aria-labelledby={headingId}>
              <h2 id={headingId} className="tool-group-heading">{t(group.labelKey)}</h2>
              <div className="tool-group-actions">
                {groupTools.map((definition) => {
                  const tipId = `tool-rail-tip-${definition.id}`;
                  return <RailTooltip key={definition.id} id={tipId} content={`${t(definition.labelKey)} (${definition.shortcut})`}>
                    <RegisteredToolButton
                      definition={definition}
                      label={t(definition.labelKey)}
                      active={activeTool === definition.id}
                      compact={compact}
                      onSelect={selectTool}
                      aria-describedby={tipId}
                    />
                  </RailTooltip>;
                })}
                {group.id === 'navigate' ? <RailTooltip id="tool-rail-tip-command-palette" content={`${t('palette.open')} (Ctrl K)`}>
                  <CommandPaletteButton label={t('palette.openShort')} accessibleLabel={t('palette.open')} compact={compact} aria-describedby="tool-rail-tip-command-palette" />
                </RailTooltip> : null}
                {group.id === 'create' ? <RailTooltip id="tool-rail-tip-generator" content={t('generator.launcher')}>
                  <EditorToolButton
                    className={`tool-button tool-structure-generator${compact ? ' is-compact' : ''}`}
                    label={t('generator.launcher')}
                    icon={<Grid3x3 size={22} strokeWidth={1.8} />}
                    tone="structure"
                    compact={compact}
                    onClick={() => emitWorkspaceCommand('open-structure-generator')}
                    aria-describedby="tool-rail-tip-generator"
                    data-structure-generator-command
                  />
                </RailTooltip> : null}
                {group.id === 'edit' && canEditSelection ? <RailTooltip id="tool-rail-tip-structural-edit" content={t('canvas.structuralEditLauncher')}>
                  <EditorToolButton
                    className={`tool-button tool-structural-edit${compact ? ' is-compact' : ''}`}
                    label={t('canvas.structuralEditLauncher')}
                    icon={<Move size={22} strokeWidth={1.8} />}
                    tone="structure"
                    compact={compact}
                    onClick={() => emitWorkspaceCommand('open-structural-edit')}
                    aria-describedby="tool-rail-tip-structural-edit"
                    data-structural-edit-command
                  />
                </RailTooltip> : null}
              </div>
            </section>;
          })}
          {classroom ? <button
            className="tool-button tool-more desktop-advanced-toggle"
            aria-label={showAdvanced ? t('toolbar.hideAdvanced') : t('toolbar.showAdvanced')}
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((current) => !current)}
          ><MoreHorizontal size={22} /><span>{showAdvanced ? t('toolbar.lessShort') : t('toolbar.moreShort')}</span></button> : null}
        </div>

        <div className="toolbar-spacer" />
        <div className="selection-tip"><BoxSelect size={18} /><span>{t('toolbar.tip')}</span></div>

        <nav className="mobile-tool-dock" aria-label={t('toolbar.primary')}>
          {mobilePrimaryTools.map((definition) => <RegisteredToolButton
            key={definition.id}
            definition={definition}
            label={t(definition.labelKey)}
            active={activeTool === definition.id}
            className="mobile-dock-tool"
            onSelect={selectTool}
          />)}
          <button
            ref={loadMenuButtonRef}
            className={`sc-tool-button sc-tool-button--load mobile-tool-group tool-button tool-pointLoad mobile-dock-tool${loadGroupHighlighted ? ' is-active' : ''}`}
            aria-label={t('toolbar.loads')}
            aria-expanded={mobileMenu === 'loads'}
            aria-haspopup="dialog"
            onClick={() => setMobileMenu((current) => current === 'loads' ? null : 'loads')}
          >
            <span className="sc-tool-button__icon" aria-hidden="true"><StructuralToolIcon tool="pointLoad" /></span>
            <span className="sc-tool-button__copy"><strong>{t('toolbar.loadsShort')}</strong></span>
          </button>
          <button
            ref={moreMenuButtonRef}
            className={`sc-tool-button sc-tool-button--navigation mobile-tool-group tool-button mobile-dock-tool${moreGroupHighlighted ? ' is-active' : ''}`}
            aria-label={t('toolbar.more')}
            aria-expanded={mobileMenu === 'more'}
            aria-haspopup="dialog"
            onClick={() => setMobileMenu((current) => current === 'more' ? null : 'more')}
          >
            <span className="sc-tool-button__icon" aria-hidden="true"><MoreHorizontal size={22} strokeWidth={1.8} /></span>
            <span className="sc-tool-button__copy"><strong>{t('toolbar.moreShort')}</strong></span>
          </button>
        </nav>
      </aside>
      {mobilePalette}
    </>
  );
};
