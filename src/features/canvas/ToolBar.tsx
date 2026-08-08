import {
  BoxSelect,
  ChevronRight,
  CircleDot,
  Component,
  Crosshair,
  Delete,
  GitCommitHorizontal,
  Hand,
  MousePointer2,
  MoreHorizontal,
  MoveDiagonal2,
  RotateCcw,
  Ruler,
  Scissors,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

const RegisteredToolButton = ({
  definition,
  label,
  active,
  compact = false,
  className = '',
  onSelect,
  menuItem = false,
}: {
  definition: ToolDefinition;
  label: string;
  active: boolean;
  compact?: boolean;
  className?: string;
  onSelect: (tool: Tool) => void;
  menuItem?: boolean;
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
    title={`${label} (${shortcut})`}
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
    <span className="mobile-palette-icon" aria-hidden="true"><ToolGlyph definition={definition} size={23} /></span>
    <span className="mobile-palette-copy"><strong>{label}</strong><small>{detail}</small></span>
    <ChevronRight size={19} aria-hidden="true" />
    <kbd>{definition.shortcut}</kbd>
  </button>
);

export interface ToolBarProps {
  compact?: boolean;
}

export const ToolBar = ({ compact = false }: ToolBarProps) => {
  const { activeTool, setActiveTool, project } = useProject();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mobileMenu, setMobileMenu] = useState<'loads' | 'more' | null>(null);
  const loadMenuButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const paletteRef = useRef<HTMLElement>(null);
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

  const selectTool = (tool: Tool) => {
    setActiveTool(tool);
    if (mobileMenu) closeMobileMenu();
    else setMobileMenu(null);
  };

  const closeMobileMenu = (restoreFocus = true) => {
    const closingMenu = mobileMenu;
    setMobileMenu(null);
    if (!restoreFocus || !closingMenu) return;
    window.requestAnimationFrame(() => {
      (closingMenu === 'loads' ? loadMenuButtonRef : moreMenuButtonRef).current?.focus();
    });
  };

  useEffect(() => {
    if (!mobileMenu) return undefined;
    const palette = paletteRef.current;
    const background = document.querySelector<HTMLElement>('.app-shell');
    if (background) {
      background.inert = true;
      background.setAttribute('aria-hidden', 'true');
    }
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
      if (background) {
        background.inert = false;
        background.removeAttribute('aria-hidden');
      }
    };
    // closeMobileMenu intentionally captures the currently open sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileMenu]);

  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 1023px)');
    if (!query) return undefined;
    const onChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setMobileMenu(null);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const paletteTitle = mobileMenu === 'loads' ? t('toolbar.addLoad') : t('toolbar.moreSheetTitle');
  const paletteDescription = mobileMenu === 'loads' ? t('toolbar.loadSheetDescription') : t('toolbar.moreSheetDescription');
  const paletteGroups = TOOL_GROUPS.filter((group) => mobilePaletteTools.some((tool) => tool.group === group.id));
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
            if (!groupTools.length) return null;
            const headingId = `tool-group-${group.id}`;
            return <section key={group.id} className={`tool-group tool-group-${group.id}`} role="group" aria-labelledby={headingId}>
              <h2 id={headingId} className="tool-group-heading">{t(group.labelKey)}</h2>
              <div className="tool-group-actions">
                {groupTools.map((definition) => <RegisteredToolButton
                  key={definition.id}
                  definition={definition}
                  label={t(definition.labelKey)}
                  active={activeTool === definition.id}
                  compact={compact}
                  onSelect={selectTool}
                />)}
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
            className={`mobile-tool-group tool-button tool-pointLoad${loadGroupHighlighted ? ' active' : ''}`}
            aria-label={t('toolbar.loads')}
            aria-expanded={mobileMenu === 'loads'}
            aria-haspopup="dialog"
            onClick={() => setMobileMenu((current) => current === 'loads' ? null : 'loads')}
          >
            <StructuralToolIcon tool="pointLoad" />
            <span>{t('toolbar.loadsShort')}</span>
          </button>
          <button
            ref={moreMenuButtonRef}
            className={`mobile-tool-group tool-button${moreGroupHighlighted ? ' active' : ''}`}
            aria-label={t('toolbar.more')}
            aria-expanded={mobileMenu === 'more'}
            aria-haspopup="dialog"
            onClick={() => setMobileMenu((current) => current === 'more' ? null : 'more')}
          >
            <MoreHorizontal size={22} strokeWidth={1.8} />
            <span>{t('toolbar.moreShort')}</span>
          </button>
        </nav>
      </aside>
      {mobilePalette}
    </>
  );
};
