/**
 * Single source of truth for every command the workspace exposes as a
 * Command Palette entry and/or a keyboard shortcut (CRI-103).
 *
 * A command is defined exactly once here — `commandId`, i18n label, category,
 * displayed shortcut, enabled predicate, execution — and `CommandPalette`
 * projects this instead of building its own list. Tool commands are
 * *derived* from `TOOL_REGISTRY` (`../canvas/toolRegistry`), never
 * duplicated: that file stays the single source for tools specifically, this
 * one composes it into the wider command set. `isOwnHistoryScope` is the
 * shared definition of "has its own editing history" that gates the global
 * `Ctrl+Z`/`Ctrl+Y` binding (see `WorkspaceShell`).
 *
 * Commands that also have a dedicated button (undo/redo, datasheet, Model
 * Doctor, analyze, theme) read the same underlying store values the button
 * does — `canUndo`/`canRedo`/`undo`/`redo` and friends all come from
 * `useProject()`, so there is exactly one computation of each command's
 * enabled state in the app, not two independent copies that could drift.
 *
 * What stays out, deliberately: node/member navigation is generated from live
 * project data (unbounded, no fixed `commandId`, no button or shortcut
 * anywhere else), so it is built as data, not registered as a command.
 */
import type { ComponentType } from 'react';
import {
  ChartNoAxesCombined,
  Download,
  Grid3x3,
  BoxSelect,
  Layers3,
  LocateFixed,
  Moon,
  Play,
  Redo2,
  Sheet,
  ShieldCheck,
  Sun,
  Undo2,
  Wrench,
} from 'lucide-react';
import type { TranslationKey } from '../../i18n/catalogs';
import type { ProjectModel, Selection, Tool } from '../../types';
import type { ResultTab } from '../../store/ProjectContext';
import { TOOL_REGISTRY } from '../canvas/toolRegistry';
import type { EditorLayerAction, EditorLayerPresetId } from '../canvas/editorLayers';
import { activateEvidenceLayer, EVIDENCE_LAYERS } from '../canvas/evidenceLayers';
import { SELECTION_QUERIES, countOf, toSelection } from '../canvas/selectByProperty';
import { emitWorkspaceCommand } from './workspaceCommands';
import { readCanvasViewSettings, withCanvasViewSettings } from '../view/canvasViewSettings';
import { exportProjectJson } from '../../utils/export';

export type CommandCategory = 'tools' | 'view' | 'results' | 'analysis' | 'navigate' | 'select' | 'export';

export type CommandIcon = ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>;

/** Everything a command definition needs to compute its label, state and effect. */
export interface CommandContext {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  project: ProjectModel;
  hasAnalysis: boolean;
  isAnalyzing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  classroomMode: boolean;
  theme: 'light' | 'dark';
  setActiveTool: (tool: Tool) => void;
  /** La selección viva. Sólo la lee «Seleccionar similares», que se define contra ella. */
  selection: Selection;
  setSelection: (selection: Selection) => void;
  setResultTab: (tab: ResultTab) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  updateProjectView: (updater: (draft: ProjectModel) => ProjectModel) => void;
  dispatchLayers: (action: EditorLayerAction) => void;
  analyze: () => void;
  undo: () => void;
  redo: () => void;
}

export interface CommandDefinition {
  id: string;
  category: CommandCategory;
  icon: CommandIcon;
  /** Overrides `icon` when the icon depends on context (e.g. the theme toggle). */
  iconFor?: (ctx: CommandContext) => CommandIcon;
  label: (ctx: CommandContext) => string;
  hint?: (ctx: CommandContext) => string | undefined;
  /** Displayed shortcut hint (e.g. `"Ctrl Z"`). Purely presentational unless a live key binding also names this id. */
  shortcut?: string;
  isEnabled?: (ctx: CommandContext) => boolean;
  /**
   * Whether invoking this command from the Palette should close it first and
   * defer the effect to the next frame — the choreography surfaces that mount
   * on open (Model Doctor, Datasheet, the generator) need to avoid racing the
   * Palette's own close/focus-restore. Plain commands run immediately.
   */
  deferredOpen?: boolean;
  run: (ctx: CommandContext) => void;
}

export interface CommandListItem extends Omit<CommandDefinition, 'icon' | 'iconFor' | 'label' | 'hint' | 'isEnabled' | 'run'> {
  icon: CommandIcon;
  label: string;
  hint?: string;
  disabled: boolean;
  run: () => void;
}

const STATIC_COMMANDS: readonly CommandDefinition[] = [
  {
    id: 'analysis:run',
    category: 'analysis',
    icon: Play,
    label: (ctx) => ctx.t('analysis.run'),
    hint: (ctx) => ctx.t('palette.analyzeHint'),
    isEnabled: (ctx) => !ctx.isAnalyzing,
    run: (ctx) => ctx.analyze(),
  },
  {
    id: 'analysis:undo',
    category: 'analysis',
    icon: Undo2,
    label: (ctx) => ctx.t('history.undo'),
    shortcut: 'Ctrl Z',
    isEnabled: (ctx) => ctx.canUndo,
    run: (ctx) => ctx.undo(),
  },
  {
    id: 'analysis:redo',
    category: 'analysis',
    icon: Redo2,
    label: (ctx) => ctx.t('history.redo'),
    shortcut: 'Ctrl Y',
    isEnabled: (ctx) => ctx.canRedo,
    run: (ctx) => ctx.redo(),
  },
  {
    /* Lleva al Resumen, donde vive el botón de la tarjeta. No dispara el
       cálculo desde aquí: el certificado cuesta cuatro resoluciones y pedirlo
       sin ver la tarjeta dejaría al usuario esperando algo que no está mirando. */
    id: 'analysis:certificate',
    category: 'analysis',
    icon: ShieldCheck,
    label: (ctx) => ctx.t('results.computeCertificate'),
    hint: (ctx) => ctx.t('results.certificateIdle'),
    isEnabled: (ctx) => ctx.hasAnalysis,
    deferredOpen: true,
    run: () => emitWorkspaceCommand('open-data', { tab: 'results', resultTab: 'summary' }),
  },
  {
    id: 'analysis:model-doctor',
    category: 'analysis',
    icon: Wrench,
    // Product name, not translated in either language today (matches the TopBar button).
    label: () => 'Model Doctor',
    hint: (ctx) => ctx.t('palette.modelDoctorHint'),
    deferredOpen: true,
    run: () => emitWorkspaceCommand('open-data', { tab: 'review' }),
  },
  {
    /**
     * El unico lanzador de Resultados. Antes el panel se pedia desde dos
     * botones sueltos —el pie del riel en X2/M1 y el lanzador flotante en
     * K0— y desde ningun comando registrado: la superficie tenia dos puertas
     * y ninguna definicion. Ahora tiene una definicion y una puerta, y la
     * barra superior la proyecta como proyecta las demas.
     */
    id: 'tool:results',
    category: 'results',
    icon: ChartNoAxesCombined,
    label: (ctx) => ctx.t('results.outputs'),
    hint: (ctx) => ctx.t('palette.openResultsHint'),
    deferredOpen: true,
    run: () => emitWorkspaceCommand('open-data', { tab: 'results' }),
  },
  {
    id: 'tool:datasheet',
    category: 'tools',
    icon: Sheet,
    label: (ctx) => ctx.t('datasheet.title'),
    hint: (ctx) => ctx.t('datasheet.description'),
    deferredOpen: true,
    run: () => emitWorkspaceCommand('open-data', { tab: 'table' }),
  },
  {
    id: 'tool:structure-generator',
    category: 'tools',
    icon: Grid3x3,
    label: (ctx) => ctx.t('generator.launcher'),
    hint: (ctx) => ctx.t('generator.paletteHint'),
    deferredOpen: true,
    run: () => emitWorkspaceCommand('open-structure-generator'),
  },
  {
    id: 'view:fit',
    category: 'view',
    icon: LocateFixed,
    label: (ctx) => ctx.t('canvas.fit'),
    run: () => emitWorkspaceCommand('fit-canvas'),
  },
  {
    id: 'view:grid',
    category: 'view',
    icon: Layers3,
    label: (ctx) => ctx.t(readCanvasViewSettings(ctx.project).showGrid ? 'canvas.gridOff' : 'canvas.gridOn'),
    run: (ctx) => ctx.updateProjectView((draft) => withCanvasViewSettings(draft, { showGrid: !readCanvasViewSettings(draft).showGrid })),
  },
  {
    id: 'view:snap',
    category: 'view',
    icon: Layers3,
    label: (ctx) => ctx.t(readCanvasViewSettings(ctx.project).snap ? 'canvas.snapOff' : 'canvas.snapOn'),
    run: (ctx) => ctx.updateProjectView((draft) => withCanvasViewSettings(draft, { snap: !readCanvasViewSettings(draft).snap })),
  },
  {
    id: 'view:theme',
    category: 'view',
    icon: Moon,
    iconFor: (ctx) => (ctx.theme === 'light' ? Moon : Sun),
    label: (ctx) => ctx.t(ctx.theme === 'light' ? 'theme.dark' : 'theme.light'),
    run: (ctx) => ctx.setTheme(ctx.theme === 'light' ? 'dark' : 'light'),
  },
  {
    id: 'export:json',
    category: 'export',
    icon: Download,
    label: (ctx) => ctx.t('export.projectJson'),
    run: (ctx) => {
      exportProjectJson(ctx.project);
      emitWorkspaceCommand('show-toast', { message: ctx.t('export.completed'), description: ctx.project.name, tone: 'success' });
    },
  },
  {
    id: 'export:svg',
    category: 'export',
    icon: Download,
    label: (ctx) => ctx.t('export.imageSvg'),
    run: (ctx) => {
      emitWorkspaceCommand('export-svg');
      emitWorkspaceCommand('show-toast', { message: ctx.t('export.completed'), tone: 'success' });
    },
  },
  {
    id: 'export:png',
    category: 'export',
    icon: Download,
    label: (ctx) => ctx.t('export.imagePng'),
    run: (ctx) => {
      emitWorkspaceCommand('export-png');
      emitWorkspaceCommand('show-toast', { message: ctx.t('export.completed'), tone: 'success' });
    },
  },
  {
    id: 'export:print',
    category: 'export',
    icon: Download,
    label: (ctx) => ctx.t('export.print'),
    run: () => window.print(),
  },
];

const LAYER_PRESETS: ReadonlyArray<{ id: EditorLayerPresetId; labelKey: TranslationKey }> = [
  { id: 'all', labelKey: 'canvas.layerPresetAll' },
  { id: 'model', labelKey: 'canvas.layerPresetModel' },
  { id: 'loads', labelKey: 'canvas.layerPresetLoads' },
  { id: 'results', labelKey: 'canvas.layerPresetResults' },
  { id: 'clean', labelKey: 'canvas.layerPresetClean' },
];

/**
 * Las lecturas que sólo existen dentro de la superficie: resumen, reacciones,
 * influencia y «Entender» no tienen equivalente como capa del lienzo (CRI-100),
 * así que pedirlas es abrir «Datos» en esa lectura. N/V/M y deformada sí lo
 * tienen y viven en `evidenceLayerCommands`, que no abre nada.
 */
/**
 * Lecturas que la paleta abre por su nombre.
 *
 * No están las nueve: N, V, M y la deformada se piden como **capas de
 * evidencia** (`evidenceLayerCommands`, CRI-100), que encienden el dibujo en
 * vez de abrir el panel. Pandeo y Modos sí entran aquí porque no son capas:
 * son estudios que se piden y se leen en su pestaña.
 */
const PANEL_RESULT_TABS: ReadonlyArray<{ id: ResultTab; labelKey: TranslationKey }> = [
  { id: 'summary', labelKey: 'results.summary' },
  { id: 'reactions', labelKey: 'results.reactions' },
  { id: 'buckling', labelKey: 'results.buckling' },
  { id: 'modal', labelKey: 'results.modal' },
  { id: 'influence', labelKey: 'results.influence' },
  { id: 'learn', labelKey: 'results.learn' },
];

const layerPresetCommands = (ctx: CommandContext): CommandListItem[] => LAYER_PRESETS.map((preset): CommandListItem => ({
  id: `layers:${preset.id}`,
  category: 'view',
  icon: Layers3,
  label: ctx.t('palette.layerPreset', { preset: ctx.t(preset.labelKey) }),
  disabled: false,
  run: () => ctx.dispatchLayers({ type: 'preset', preset: preset.id }),
}));

const resultTabCommands = (ctx: CommandContext): CommandListItem[] => PANEL_RESULT_TABS.map((tab): CommandListItem => ({
  id: `results:${tab.id}`,
  category: 'results',
  icon: ChartNoAxesCombined,
  label: ctx.t('palette.openResultTab', { tab: ctx.t(tab.labelKey) }),
  disabled: !ctx.hasAnalysis,
  run: () => emitWorkspaceCommand('open-data', { tab: 'results', resultTab: tab.id }),
}));

/**
 * N / V / M / deformada / mapa are canvas evidence layers (CRI-100): they
 * light a layer on the drawing, they never open the Results panel.
 */
const evidenceLayerCommands = (ctx: CommandContext): CommandListItem[] => EVIDENCE_LAYERS.map((evidence): CommandListItem => ({
  id: `evidence:${evidence.id}`,
  category: 'results',
  icon: ChartNoAxesCombined,
  label: ctx.t('palette.toggleEvidenceLayer', { layer: ctx.t(evidence.labelKey) }),
  disabled: !ctx.hasAnalysis,
  run: () => activateEvidenceLayer(evidence.id, { setResultTab: ctx.setResultTab, dispatchLayers: ctx.dispatchLayers }),
}));

const toolCommands = (ctx: CommandContext): CommandListItem[] => TOOL_REGISTRY
  .map((tool): CommandListItem => ({
    id: `tool:${tool.id}`,
    category: 'tools',
    icon: Wrench,
    label: ctx.t(tool.labelKey),
    hint: tool.detailKey ? ctx.t(tool.detailKey) : undefined,
    shortcut: tool.shortcut,
    disabled: false,
    run: () => ctx.setActiveTool(tool.id),
  }));

/**
 * Seleccionar por propiedad.
 *
 * Sólo aparecen las consultas que HOY encuentran algo, y con el recuento en la
 * propia etiqueta: «Apoyos empotrados · 4» dice, antes de pulsarla, qué va a
 * pasar. Una consulta que devuelve cero no es una opción, es ruido — y en un
 * modelo sin armaduras «Barras de armadura» no debería ocupar un renglón.
 *
 * El único que puede aparecer desactivado es «Similares a la selección», y a
 * propósito: sin selección no es una consulta vacía, es una consulta que no se
 * puede formular. Verla apagada explica el mecanismo; no verla lo esconde.
 */
const selectionQueryCommands = (ctx: CommandContext): CommandListItem[] => SELECTION_QUERIES
  .map((query) => ({ query, result: query.run(ctx.project, ctx.selection) }))
  .filter(({ query, result }) => countOf(result) > 0 || query.needsSelection)
  .map(({ query, result }): CommandListItem => ({
    id: `select:${query.id}`,
    category: 'select',
    icon: BoxSelect,
    label: ctx.t('select.paletteEntry', { query: ctx.t(query.labelKey), count: countOf(result) }),
    disabled: countOf(result) === 0,
    run: () => ctx.setSelection(toSelection(result)),
  }));

const nodeCommands = (ctx: CommandContext): CommandListItem[] => ctx.project.nodes.map((node): CommandListItem => ({
  id: `node:${node.id}`,
  category: 'navigate',
  icon: LocateFixed,
  label: `${ctx.t('inspector.node')} ${node.id}`,
  hint: `X ${node.x} · Y ${node.y}`,
  disabled: false,
  run: () => {
    ctx.setSelection({ kind: 'node', id: node.id });
    emitWorkspaceCommand('focus-object', { kind: 'node', id: node.id });
  },
}));

const memberCommands = (ctx: CommandContext): CommandListItem[] => ctx.project.members.map((member): CommandListItem => ({
  id: `member:${member.id}`,
  category: 'navigate',
  icon: LocateFixed,
  label: `${ctx.t('inspector.member')} ${member.id}`,
  hint: `${member.i} → ${member.j}`,
  disabled: false,
  run: () => {
    ctx.setSelection({ kind: 'member', id: member.id });
    emitWorkspaceCommand('focus-object', { kind: 'member', id: member.id });
  },
}));

const projectStatic = (ctx: CommandContext): CommandListItem[] => STATIC_COMMANDS.map((command): CommandListItem => ({
  ...command,
  icon: command.iconFor ? command.iconFor(ctx) : command.icon,
  label: command.label(ctx),
  hint: command.hint?.(ctx),
  disabled: command.isEnabled ? !command.isEnabled(ctx) : false,
  run: () => command.run(ctx),
}));

/**
 * Whether `target` sits inside a surface with its own editing/history scope —
 * a text field, the Datasheet grid, or any modal surface — where the global
 * `Ctrl+Z`/`Ctrl+Y` shortcut must stay silent (G-01). Exported so the single
 * definition of "own history scope" is shared with whoever binds the keys.
 */
export const isOwnHistoryScope = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, [contenteditable="true"], [role="grid"], [aria-modal="true"]'));
};

/**
 * The full, ordered command set. `CommandPalette` projects this rather than
 * building its own list.
 */
export const buildCommands = (ctx: CommandContext): CommandListItem[] => [
  ...projectStatic(ctx),
  ...toolCommands(ctx),
  ...layerPresetCommands(ctx),
  ...resultTabCommands(ctx),
  ...evidenceLayerCommands(ctx),
  ...selectionQueryCommands(ctx),
  ...nodeCommands(ctx),
  ...memberCommands(ctx),
];

/**
 * Static commands that also have a dedicated visible button (TopBar) — the
 * ones `resolveTopBarCommand` is allowed to look up. Restricted on purpose:
 * every command in this list has been checked to only read `TopBarCommandContext`
 * (never canvas tool/selection/results/layer state), which is what lets
 * `resolveTopBarCommand` stub the rest of `CommandContext` safely instead of
 * forcing every button call site to fabricate unrelated callbacks.
 */
const TOPBAR_COMMAND_IDS = [
  'analysis:run', 'analysis:undo', 'analysis:redo', 'analysis:model-doctor',
  'tool:results', 'tool:datasheet', 'view:theme',
  'export:json', 'export:svg', 'export:png', 'export:print',
] as const;

export type TopBarCommandId = (typeof TOPBAR_COMMAND_IDS)[number];

export type TopBarCommandContext = Pick<CommandContext,
  't' | 'project' | 'isAnalyzing' | 'canUndo' | 'canRedo' | 'theme' | 'setTheme' | 'analyze' | 'undo' | 'redo'>;

/** Never invoked: every `TopBarCommandId` command is verified to not touch these. */
const unusedByTopBar = (): never => {
  throw new Error('commandRegistry: a TopBar command unexpectedly touched canvas/selection/results state.');
};

const TOPBAR_CONTEXT_STUBS: Pick<CommandContext,
  'hasAnalysis' | 'classroomMode' | 'setActiveTool' | 'selection' | 'setSelection' | 'setResultTab' | 'updateProjectView' | 'dispatchLayers'> = {
  hasAnalysis: false,
  classroomMode: false,
  selection: null,
  setActiveTool: unusedByTopBar,
  setSelection: unusedByTopBar,
  setResultTab: unusedByTopBar,
  updateProjectView: unusedByTopBar,
  dispatchLayers: unusedByTopBar,
};

/**
 * Resolves one command's projected state (label, disabled, run, shortcut)
 * for a button outside the Palette — TopBar's undo/redo, datasheet, Model
 * Doctor, analyze, theme and export controls. The button reads `.label`,
 * `.disabled` and `.run` straight off the result instead of recomputing them,
 * so the button and the Palette entry for the same `commandId` can never
 * drift apart.
 */
export const resolveTopBarCommand = (id: TopBarCommandId, ctx: TopBarCommandContext): CommandListItem => {
  const full: CommandContext = { ...TOPBAR_CONTEXT_STUBS, ...ctx };
  const command = projectStatic(full).find((item) => item.id === id);
  if (!command) throw new Error(`commandRegistry: unknown TopBar command "${id}"`);
  return command;
};
