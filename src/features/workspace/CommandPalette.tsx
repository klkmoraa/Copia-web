import { useEffect, useId, useRef, useState, useMemo } from 'react';
import {
  Search,
  Play,
  FileDown,
  Layers,
  Sun,
  Moon,
  Grid,
  Magnet,
  Maximize2,
  Undo2,
  Redo2,
  FileCode2,
  Eye,
  Crosshair,
  Compass,
} from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { exampleProjects } from '../../data/defaultProject';
import { emitWorkspaceCommand } from './workspaceCommands';
import type { Tool } from '../../types';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  category: string;
  label: string;
  description?: string;
  icon: typeof Search;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette = ({ isOpen, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { t } = useI18n();
  const {
    setActiveTool,
    analyze,
    undo,
    redo,
    canUndo,
    canRedo,
    theme,
    setTheme,
    replaceProject,
  } = useProject();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      // Actions
      {
        id: 'action-analyze',
        category: t('palette.categoryActions') || 'Acciones',
        label: t('palette.runAnalysis') || 'Ejecutar Análisis Estructural',
        description: 'P-Delta & Solver Matricial',
        icon: Play,
        shortcut: 'Ctrl+Enter',
        action: () => {
          analyze();
          onClose();
        },
      },
      {
        id: 'action-fit-canvas',
        category: t('palette.categoryActions') || 'Acciones',
        label: t('palette.fitCanvas') || 'Auto-encuadrar Canvas',
        icon: Maximize2,
        shortcut: 'F',
        action: () => {
          emitWorkspaceCommand('fit-canvas');
          onClose();
        },
      },
      {
        id: 'action-undo',
        category: t('palette.categoryActions') || 'Acciones',
        label: t('palette.undo') || 'Deshacer último cambio',
        icon: Undo2,
        shortcut: 'Ctrl+Z',
        action: () => {
          if (canUndo) undo();
          onClose();
        },
      },
      {
        id: 'action-redo',
        category: t('palette.categoryActions') || 'Acciones',
        label: t('palette.redo') || 'Rehacer cambio',
        icon: Redo2,
        shortcut: 'Ctrl+Y',
        action: () => {
          if (canRedo) redo();
          onClose();
        },
      },
      {
        id: 'action-toggle-theme',
        category: t('palette.categoryView') || 'Vista y Temas',
        label: theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro',
        icon: theme === 'dark' ? Sun : Moon,
        action: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark');
          onClose();
        },
      },
      // Canvas Themes
      {
        id: 'canvas-theme-standard',
        category: t('palette.categoryCanvasTheme') || 'Tema del Lienzo',
        label: 'Lienzo Estándar structureCo',
        icon: Eye,
        action: () => {
          document.documentElement.removeAttribute('data-canvas-theme');
          onClose();
        },
      },
      {
        id: 'canvas-theme-blueprint',
        category: t('palette.categoryCanvasTheme') || 'Tema del Lienzo',
        label: 'Lienzo Engineering Blueprint (Plano Técnico)',
        icon: Compass,
        action: () => {
          document.documentElement.setAttribute('data-canvas-theme', 'blueprint');
          onClose();
        },
      },
      {
        id: 'canvas-theme-cad',
        category: t('palette.categoryCanvasTheme') || 'Tema del Lienzo',
        label: 'Lienzo CAD Charcoal (Alto Contraste)',
        icon: Crosshair,
        action: () => {
          document.documentElement.setAttribute('data-canvas-theme', 'cad-charcoal');
          onClose();
        },
      },
      {
        id: 'canvas-theme-clean',
        category: t('palette.categoryCanvasTheme') || 'Tema del Lienzo',
        label: 'Lienzo Editorial Clean (Blanco Inmaculado)',
        icon: FileDown,
        action: () => {
          document.documentElement.setAttribute('data-canvas-theme', 'editorial-clean');
          onClose();
        },
      },
      // Tools
      {
        id: 'tool-select',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Herramienta Selección / Cursor',
        icon: Crosshair,
        shortcut: 'V',
        action: () => {
          setActiveTool('select');
          onClose();
        },
      },
      {
        id: 'tool-node',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Crear Nodos de Estructura',
        icon: Crosshair,
        shortcut: 'N',
        action: () => {
          setActiveTool('node');
          onClose();
        },
      },
      {
        id: 'tool-member',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Dibujar Barras / Elementos Viga',
        icon: Layers,
        shortcut: 'B',
        action: () => {
          setActiveTool('member');
          onClose();
        },
      },
      {
        id: 'tool-support',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Asignar Apoyos y Restricciones',
        icon: Magnet,
        shortcut: 'S',
        action: () => {
          setActiveTool('support');
          onClose();
        },
      },
      {
        id: 'tool-point-load',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Aplicar Carga Puntual',
        icon: Grid,
        shortcut: 'P',
        action: () => {
          setActiveTool('pointLoad');
          onClose();
        },
      },
      {
        id: 'tool-distributed-load',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Aplicar Carga Distribuida',
        icon: Grid,
        shortcut: 'D',
        action: () => {
          setActiveTool('distributedLoad');
          onClose();
        },
      },
    ];

    // Add Examples
    exampleProjects.forEach((ex) => {
      list.push({
        id: `example-${ex.name}`,
        category: t('palette.categoryTemplates') || 'Plantillas y Ejemplos',
        label: `Cargar: ${ex.name}`,
        description: ex.description,
        icon: FileCode2,
        action: () => {
          replaceProject(ex.build());
          emitWorkspaceCommand('fit-canvas');
          onClose();
        },
      });
    });

    return list;
  }, [t, analyze, canUndo, canRedo, undo, redo, theme, setTheme, setActiveTool, replaceProject, onClose]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [commands, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) selected.action();
    }
  };

  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(0);
    }
  }, [filteredCommands.length, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="command-palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="command-palette-modal">
        <div className="command-palette-input-wrap">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            id={titleId}
            className="command-palette-input"
            type="text"
            placeholder={t('palette.placeholder') || 'Buscar comando, plantilla o acción (Ctrl+K)...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
          />
          <span className="command-palette-keycap">ESC</span>
        </div>

        <div className="command-palette-list" ref={listRef} role="listbox">
          {filteredCommands.length === 0 ? (
            <div className="empty-small">{t('palette.noResults') || 'No se encontraron comandos'}</div>
          ) : (
            filteredCommands.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`command-palette-item${isSelected ? ' selected' : ''}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <Icon size={16} style={{ opacity: 0.8, flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 650, color: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                      {item.description ? (
                        <small style={{ fontSize: '10px', opacity: 0.7 }}>{item.description}</small>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '9.5px', textTransform: 'uppercase', opacity: 0.6 }}>
                      {item.category}
                    </span>
                    {item.shortcut ? (
                      <span className="command-palette-keycap">{item.shortcut}</span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <span>{filteredCommands.length} {t('palette.commandsAvailable') || 'comandos disponibles'}</span>
          <span><b>↑↓</b> navegar · <b>↵</b> ejecutar · <b>ESC</b> cerrar</span>
        </div>
      </div>
    </div>
  );
};
