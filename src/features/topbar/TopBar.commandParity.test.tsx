// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ClassroomSessionProvider } from '../../store/ClassroomSessionContext';
import { ProjectProvider } from '../../store/ProjectContext';
import { TopBar } from './TopBar';
import { CommandPalette } from '../workspace/CommandPalette';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';
import {
  buildCommands,
  resolveTopBarCommand,
  type CommandContext,
  type TopBarCommandContext,
} from '../workspace/commandRegistry';

/**
 * CRI-103 follow-up: proves *by construction* — not by convention — that
 * TopBar's buttons and the Command Palette resolve the same `commandRegistry`
 * entry for the commands both surfaces expose (undo/redo, datasheet, Model
 * Doctor, theme, plain exports).
 */

const baseFullContext = (overrides: Partial<CommandContext> = {}): CommandContext => ({
  t: (key) => key,
  project: createDefaultProject(),
  hasAnalysis: false,
  isAnalyzing: false,
  canUndo: false,
  canRedo: false,
  classroomMode: false,
  theme: 'light',
  setActiveTool: vi.fn(),
  setSelection: vi.fn(),
  setResultTab: vi.fn(),
  setTheme: vi.fn(),
  updateProjectView: vi.fn(),
  dispatchLayers: vi.fn(),
  analyze: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  ...overrides,
});

const topBarContextFrom = (full: CommandContext): TopBarCommandContext => ({
  t: full.t,
  project: full.project,
  isAnalyzing: full.isAnalyzing,
  canUndo: full.canUndo,
  canRedo: full.canRedo,
  theme: full.theme,
  setTheme: full.setTheme,
  analyze: full.analyze,
  undo: full.undo,
  redo: full.redo,
});

describe('commandRegistry: TopBar and Palette resolve the same command (construction, not convention)', () => {
  it('undo/redo: button and Palette share label, enabled state, and execution', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    const full = baseFullContext({ canUndo: true, canRedo: false, undo, redo });
    const topBarCtx = topBarContextFrom(full);

    const paletteUndo = buildCommands(full).find((c) => c.id === 'analysis:undo')!;
    const buttonUndo = resolveTopBarCommand('analysis:undo', topBarCtx);
    const paletteRedo = buildCommands(full).find((c) => c.id === 'analysis:redo')!;
    const buttonRedo = resolveTopBarCommand('analysis:redo', topBarCtx);

    expect(buttonUndo.label).toBe(paletteUndo.label);
    expect(buttonUndo.disabled).toBe(paletteUndo.disabled);
    expect(buttonUndo.disabled).toBe(false); // canUndo: true
    expect(buttonRedo.label).toBe(paletteRedo.label);
    expect(buttonRedo.disabled).toBe(paletteRedo.disabled);
    expect(buttonRedo.disabled).toBe(true); // canRedo: false

    buttonUndo.run();
    paletteUndo.run();
    expect(undo).toHaveBeenCalledTimes(2); // both paths call the very same `undo`, not a hand-written copy
  });

  it('flipping canUndo/canRedo changes both consumers identically, from one definition', () => {
    const off = baseFullContext({ canUndo: false, canRedo: false });
    const on = baseFullContext({ canUndo: true, canRedo: true });

    for (const [ctx, expected] of [[off, true], [on, false]] as const) {
      const paletteUndo = buildCommands(ctx).find((c) => c.id === 'analysis:undo')!;
      const buttonUndo = resolveTopBarCommand('analysis:undo', topBarContextFrom(ctx));
      const paletteRedo = buildCommands(ctx).find((c) => c.id === 'analysis:redo')!;
      const buttonRedo = resolveTopBarCommand('analysis:redo', topBarContextFrom(ctx));

      expect(paletteUndo.disabled).toBe(expected);
      expect(buttonUndo.disabled).toBe(expected);
      expect(paletteRedo.disabled).toBe(expected);
      expect(buttonRedo.disabled).toBe(expected);
    }
  });

  it('Datasheet and Model Doctor: button and Palette resolve the exact same commandId and effect', () => {
    const full = baseFullContext();
    const topBarCtx = topBarContextFrom(full);

    for (const id of ['tool:datasheet', 'analysis:model-doctor'] as const) {
      const paletteCommand = buildCommands(full).find((c) => c.id === id)!;
      const buttonCommand = resolveTopBarCommand(id, topBarCtx);
      expect(buttonCommand.label).toBe(paletteCommand.label);
      expect(buttonCommand.id).toBe(paletteCommand.id);

      // Los dos destinos viajan ahora por UN comando con la pestaña como carga
      // útil, así que la paridad se comprueba sobre la pestaña, no sobre el
      // nombre del evento: botón y paleta tienen que pedir la misma.
      const tabs: (string | undefined)[] = [];
      const unsubscribe = onWorkspaceCommand('open-data', (request) => tabs.push(request?.tab));
      buttonCommand.run();
      paletteCommand.run();
      unsubscribe();
      expect(tabs).toHaveLength(2);
      expect(new Set(tabs).size).toBe(1); // same tab both times — same underlying action
    }
  });

  it('theme toggle: same label and icon resolved for button and Palette', () => {
    const light = baseFullContext({ theme: 'light' });
    const dark = baseFullContext({ theme: 'dark' });

    for (const ctx of [light, dark]) {
      const paletteTheme = buildCommands(ctx).find((c) => c.id === 'view:theme')!;
      const buttonTheme = resolveTopBarCommand('view:theme', topBarContextFrom(ctx));
      expect(buttonTheme.label).toBe(paletteTheme.label);
      expect(buttonTheme.icon).toBe(paletteTheme.icon);
    }
  });
});

const TopBarHarness = ({ children }: { children: React.ReactNode }) => (
  <ProjectProvider><ClassroomSessionProvider projectId="topbar-parity-test">{children}</ClassroomSessionProvider></ProjectProvider>
);

beforeEach(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TopBar rendered live: shares real state with the Palette, not a parallel copy', () => {
  it('clicking the rendered Datasheet button and the rendered Palette entry emit the same workspace command', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const unsubscribe = onWorkspaceCommand('open-data', (request) => events.push(request?.tab ?? 'results'));
    // Botón y paleta piden la MISMA pestaña: eso es la paridad ahora que los
    // cuatro comandos por superficie son uno con la pestaña como carga útil.

    render(<TopBarHarness>
      <TopBar />
      <CommandPalette open onClose={() => {}} dispatchLayers={vi.fn()} />
    </TopBarHarness>);

    await user.click(screen.getByRole('button', { name: /hoja de datos estructural/i }));
    await user.click(screen.getByRole('option', { name: /hoja de datos estructural/i }));

    // The Palette defers its effect a frame past its own close (CRI-103
    // choreography); the button fires immediately — both still land on the
    // same event, proving the same underlying `run`.
    await waitFor(() => expect(events).toEqual(['table', 'table']));
    unsubscribe();
  });

  it('Undo starts disabled on both the TopBar button and the Palette entry, sourced from the same project store', () => {
    render(<TopBarHarness>
      <TopBar />
      <CommandPalette open onClose={() => {}} dispatchLayers={vi.fn()} />
    </TopBarHarness>);

    const topBarUndo = screen.getByRole('button', { name: /deshacer/i }) as HTMLButtonElement;
    const paletteUndo = screen.getByRole('option', { name: /deshacer/i });

    expect(topBarUndo.disabled).toBe(true);
    expect(paletteUndo.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('TopBar source: no second hand-written implementation of a registered command remains', () => {
  const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'TopBar.tsx'), 'utf8');

  it('never emits open-datasheet, export-svg or export-png outside the shared registry', () => {
    expect(source).not.toContain("emitWorkspaceCommand('open-datasheet')");
    expect(source).not.toContain("emitWorkspaceCommand('export-svg')");
    expect(source).not.toContain("emitWorkspaceCommand('export-png')");
  });

  it('never calls window.print() directly — only the registry’s export:print command does', () => {
    expect(source).not.toContain('window.print()');
  });

  it('emite la apertura de la Revisión exactamente una vez, en la excepción documentada del callback estable', () => {
    const codeLines = source.split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
    const occurrences = codeLines.filter((line) => line.includes("emitWorkspaceCommand('open-data', { tab: 'review' })")).length;
    expect(occurrences).toBe(1);
    expect(source).toContain('kept as its own `useCallback`');
  });
});
