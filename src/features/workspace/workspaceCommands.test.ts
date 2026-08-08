// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  emitWorkspaceCommand,
  onWorkspaceCommand,
  workspaceCommandEventName,
} from './workspaceCommands';

describe('bus de comandos del workspace', () => {
  it('entrega el comando a quien lo escucha', () => {
    const handler = vi.fn();
    const unsubscribe = onWorkspaceCommand('fit-canvas', handler);
    emitWorkspaceCommand('fit-canvas');
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('entrega el detalle del comando sin castings en el consumidor', () => {
    const handler = vi.fn();
    const unsubscribe = onWorkspaceCommand('focus-object', handler);
    emitWorkspaceCommand('focus-object', { kind: 'member', id: 'AB' });
    expect(handler).toHaveBeenCalledWith({ kind: 'member', id: 'AB' });
    unsubscribe();
  });

  it('deja de entregar tras darse de baja, sin dejar el listener colgado', () => {
    const handler = vi.fn();
    onWorkspaceCommand('expand-mobile-results', handler)();
    emitWorkspaceCommand('expand-mobile-results');
    expect(handler).not.toHaveBeenCalled();
  });

  it('no mezcla comandos distintos', () => {
    const expand = vi.fn();
    const collapse = vi.fn();
    const off = [
      onWorkspaceCommand('expand-mobile-results', expand),
      onWorkspaceCommand('collapse-mobile-results', collapse),
    ];
    emitWorkspaceCommand('collapse-mobile-results');
    expect(collapse).toHaveBeenCalledTimes(1);
    expect(expand).not.toHaveBeenCalled();
    for (const unsubscribe of off) unsubscribe();
  });

  it('admite varios suscriptores del mismo comando', () => {
    const first = vi.fn();
    const second = vi.fn();
    const off = [
      onWorkspaceCommand('export-svg', first),
      onWorkspaceCommand('export-svg', second),
    ];
    emitWorkspaceCommand('export-svg');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    for (const unsubscribe of off) unsubscribe();
  });

  it('conserva el nombre de evento anterior, para no romper a quien ya escuchaba', () => {
    // The transport is deliberately unchanged: these are the exact names the workspace
    // dispatched before the bus existed.
    expect(workspaceCommandEventName('focus-object')).toBe('structureco:focus-object');
    expect(workspaceCommandEventName('fit-canvas')).toBe('structureco:fit-canvas');
    expect(workspaceCommandEventName('export-png')).toBe('structureco:export-png');

    const handler = vi.fn();
    window.addEventListener('structureco:fit-canvas', handler);
    emitWorkspaceCommand('fit-canvas');
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('structureco:fit-canvas', handler);
  });
});
