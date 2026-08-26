// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildCommands, isOwnHistoryScope, type CommandContext } from './commandRegistry';
import { onWorkspaceCommand } from './workspaceCommands';
import { createDefaultProject } from '../../data/defaultProject';

/**
 * CRI-103 / G-01: the global Ctrl+Z / Ctrl+Y binding must stay silent inside
 * any surface with its own editing history — a text field, the Datasheet
 * grid, or a modal surface — so it never undoes a model operation while the
 * user meant to undo a cell edit.
 */
describe('isOwnHistoryScope', () => {
  it('is true for a text input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(isOwnHistoryScope(input)).toBe(true);
  });

  it('is true for a textarea', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    expect(isOwnHistoryScope(textarea)).toBe(true);
  });

  it('is true inside the Datasheet grid, demonstrating Ctrl+Z there does not reach global undo', () => {
    const grid = document.createElement('table');
    grid.setAttribute('role', 'grid');
    const cell = document.createElement('td');
    grid.appendChild(cell);
    document.body.appendChild(grid);

    expect(isOwnHistoryScope(cell)).toBe(true);
    expect(isOwnHistoryScope(grid)).toBe(true);
  });

  it('is true inside a modal surface with its own history', () => {
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    const button = document.createElement('button');
    modal.appendChild(button);
    document.body.appendChild(modal);

    expect(isOwnHistoryScope(button)).toBe(true);
  });

  it('is false for the canvas element and other plain workspace targets', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg as unknown as Node);
    expect(isOwnHistoryScope(svg)).toBe(false);
    expect(isOwnHistoryScope(document.body)).toBe(false);
    expect(isOwnHistoryScope(null)).toBe(false);
  });
});

/**
 * El ACM se enciende con el ratón desde su botón del lienzo; la paleta es la
 * puerta que le queda a quien no lo usa. Si el comando desaparece de la lista,
 * esa puerta se cierra en silencio.
 */
describe('the ACM command', () => {
  const contextWith = (hasAnalysis: boolean) => ({
    t: (key: string) => key,
    project: createDefaultProject(),
    hasAnalysis,
    isAnalyzing: false,
    canUndo: false,
    canRedo: false,
    classroomMode: false,
    theme: 'light',
    selection: null,
    setActiveTool: () => undefined,
    setSelection: () => undefined,
    setResultTab: () => undefined,
    setTheme: () => undefined,
    updateProjectView: () => undefined,
    dispatchLayers: () => undefined,
    analyze: () => undefined,
    undo: () => undefined,
    redo: () => undefined,
  } as unknown as CommandContext);

  it('is offered next to the other evidence layers, and asks the canvas through the bus', () => {
    const command = buildCommands(contextWith(true)).find((item) => item.id === 'evidence:acm');
    expect(command).toBeTruthy();
    expect(command?.category).toBe('results');
    expect(command?.disabled).toBe(false);

    const seen: string[] = [];
    const stop = onWorkspaceCommand('toggle-diagram-stack', () => seen.push('asked'));
    command?.run();
    stop();
    expect(seen).toEqual(['asked']);
  });

  it('is offered but disabled while there is no analysis to deploy', () => {
    expect(buildCommands(contextWith(false)).find((item) => item.id === 'evidence:acm')?.disabled).toBe(true);
  });
});
