import { useEffect, useId, useRef, useState, useMemo } from 'react';
import {
  Search,
  Play,
  FileDown,
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
  GraduationCap,
  Download,
  Box,
} from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useProject, useWorkspaceUI } from '../../store/ProjectContext';
import { exampleProjects } from '../../data/defaultProject';
import { standardSections } from '../../data/standardSections';
import { exportProjectJson } from '../../utils/export';
import { formatFixed } from '../../utils/numberFormat';
import { emitWorkspaceCommand } from './workspaceCommands';

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
  const { t } = useI18n();
  const {
    project,
    replaceProject,
    updateProject,
    updateProjectView,
    setSelection,
    selection,
    analyze,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useProject();
  const { theme, setTheme, setActiveTool } = useWorkspaceUI();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Reset query and focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      // Actions
      {
        id: 'action-analyze',
        category: t('palette.categoryActions') || 'Acciones',
        label: t('analysis.run') || 'Ejecutar Análisis Estructural',
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
      {
        id: 'action-toggle-classroom',
        category: t('palette.categoryView') || 'Vista y Temas',
        label: project.settings.calculationMode === 'classroom'
          ? 'Cambiar a Modo Completo (Profesional)'
          : 'Cambiar a Modo Aula (Pedagógico)',
        description: 'Alternar experiencia pedagógica o ingeniería completa',
        icon: GraduationCap,
        action: () => {
          updateProjectView((draft) => ({
            ...draft,
            settings: {
              ...draft.settings,
              calculationMode: draft.settings.calculationMode === 'classroom' ? 'complete' : 'classroom',
            },
          }));
          onClose();
        },
      },
      {
        id: 'action-toggle-grid',
        category: t('palette.categoryView') || 'Vista y Temas',
        label: project.settings.showGrid ? 'Ocultar Rejilla (Grid)' : 'Mostrar Rejilla (Grid)',
        icon: Grid,
        action: () => {
          updateProjectView((draft) => ({
            ...draft,
            settings: { ...draft.settings, showGrid: !draft.settings.showGrid },
          }));
          onClose();
        },
      },
      {
        id: 'action-toggle-snap',
        category: t('palette.categoryView') || 'Vista y Temas',
        label: project.settings.snap ? 'Desactivar SNAP Imantación' : 'Activar SNAP Imantación',
        icon: Magnet,
        action: () => {
          updateProjectView((draft) => ({
            ...draft,
            settings: { ...draft.settings, snap: !draft.settings.snap },
          }));
          onClose();
        },
      },
      {
        id: 'action-export-json',
        category: t('palette.categoryActions') || 'Acciones',
        label: 'Exportar Proyecto como JSON',
        description: 'Descargar archivo de proyecto structureCo',
        icon: Download,
        action: () => {
          exportProjectJson(project);
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
        label: 'Tema Blueprint Técnico (Azul Cian)',
        icon: Eye,
        action: () => {
          document.documentElement.setAttribute('data-canvas-theme', 'blueprint');
          onClose();
        },
      },
      {
        id: 'canvas-theme-charcoal',
        category: t('palette.categoryCanvasTheme') || 'Tema del Lienzo',
        label: 'Tema CAD Charcoal (Grafito Oscuro)',
        icon: Eye,
        action: () => {
          document.documentElement.setAttribute('data-canvas-theme', 'cad-charcoal');
          onClose();
        },
      },
      {
        id: 'canvas-theme-editorial',
        category: t('palette.categoryCanvasTheme') || 'Tema del Lienzo',
        label: 'Tema Editorial Clean (Papel Técnico)',
        icon: Eye,
        action: () => {
          document.documentElement.setAttribute('data-canvas-theme', 'editorial-clean');
          onClose();
        },
      },
      // Tools
      {
        id: 'tool-node',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Herramienta Nodo',
        description: 'Insertar nodos en el modelo',
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
        label: 'Herramienta Barra / Miembro',
        description: 'Dibujar elementos entre nodos',
        icon: Compass,
        shortcut: 'M',
        action: () => {
          setActiveTool('member');
          onClose();
        },
      },
      {
        id: 'tool-support',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Herramienta Apoyo',
        description: 'Asignar condiciones de contorno',
        icon: Grid,
        shortcut: 'S',
        action: () => {
          setActiveTool('support');
          onClose();
        },
      },
      {
        id: 'tool-point-load',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Carga Puntual',
        description: 'Aplicar fuerza o momento',
        icon: Magnet,
        shortcut: 'P',
        action: () => {
          setActiveTool('pointLoad');
          onClose();
        },
      },
      {
        id: 'tool-distributed-load',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Carga Distribuida',
        description: 'Carga uniforme o trapezoidal sobre barra',
        icon: Magnet,
        shortcut: 'D',
        action: () => {
          setActiveTool('distributedLoad');
          onClose();
        },
      },
      {
        id: 'tool-dimension',
        category: t('palette.categoryTools') || 'Herramientas',
        label: 'Herramienta Cota',
        description: 'Medir distancia o longitud',
        icon: FileCode2,
        shortcut: 'C',
        action: () => {
          setActiveTool('dimension');
          onClose();
        },
      },
      // Quick Standard Sections for Members
      ...standardSections.slice(0, 8).map((sec) => ({
        id: `section-${sec.name}`,
        category: 'Perfiles de Catálogo',
        label: `Asignar sección ${sec.name}`,
        description: `${sec.shapeType.toUpperCase()} · A = ${formatFixed(sec.area * 1e4, 1)} cm², I = ${formatFixed(sec.inertiaX * 1e8, 0)} cm⁴`,
        icon: Box,
        action: () => {
          updateProject((draft) => {
            const targetMembers = selection?.kind === 'member'
              ? draft.members.filter((m) => m.id === selection.id)
              : selection?.kind === 'multi'
                ? draft.members.filter((m) => selection.memberIds.includes(m.id))
                : draft.members;
            for (const member of targetMembers) {
              member.A = sec.area;
              member.I = sec.inertiaX;
            }
            return draft;
          });
          onClose();
        },
      })),
      // Direct Member Navigation
      ...project.members.map((member) => ({
        id: `member-${member.id}`,
        category: 'Navegación de Barras',
        label: `Barra ${member.id} (${member.i} → ${member.j})`,
        description: `Tipo: ${member.type} · E = ${formatFixed(member.E / 1e6, 0)} GPa`,
        icon: Compass,
        action: () => {
          setSelection({ kind: 'member', id: member.id });
          onClose();
        },
      })),
      // Direct Node Navigation
      ...project.nodes.map((node) => ({
        id: `node-${node.id}`,
        category: 'Navegación de Nodos',
        label: `Nodo ${node.id} (X: ${formatFixed(node.x, 2)}, Y: ${formatFixed(node.y, 2)})`,
        description: `Apoyo: ${node.support.type}`,
        icon: Crosshair,
        action: () => {
          setSelection({ kind: 'node', id: node.id });
          onClose();
        },
      })),
      // Templates
      ...exampleProjects.map((ex) => ({
        id: `template-${ex.name}`,
        category: t('palette.categoryTemplates') || 'Plantillas',
        label: `Cargar: ${ex.name}`,
        description: ex.description,
        icon: FileDown,
        action: () => {
          replaceProject(ex.build());
          onClose();
        },
      })),
    ];
    return list;
  }, [
    t,
    analyze,
    onClose,
    canUndo,
    undo,
    canRedo,
    redo,
    theme,
    setTheme,
    setActiveTool,
    replaceProject,
    project,
    updateProject,
    updateProjectView,
    setSelection,
    selection,
  ]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.shortcut && c.shortcut.toLowerCase().includes(q))
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
              const isSelected = index === selectedIndex;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`command-palette-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="command-palette-item-icon">
                    <Icon size={16} />
                  </span>
                  <div className="command-palette-item-text">
                    <span className="command-palette-item-label">{item.label}</span>
                    {item.description && (
                      <span className="command-palette-item-desc">{item.description}</span>
                    )}
                  </div>
                  <span className="command-palette-item-category">{item.category}</span>
                  {item.shortcut && (
                    <span className="command-palette-item-shortcut">{item.shortcut}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> Navegar
          </span>
          <span>
            <kbd>↵</kbd> Ejecutar
          </span>
          <span>
            <kbd>ESC</kbd> Cerrar
          </span>
        </div>
      </div>
    </div>
  );
};
