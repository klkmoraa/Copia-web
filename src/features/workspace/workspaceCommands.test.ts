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

  /**
   * Los cuatro comandos que había —uno por superficie densa— son ahora uno con
   * la pestaña como carga útil. Que la pestaña llegue intacta es lo que
   * sustituye a tener cuatro nombres distintos.
   */
  it('abre «Datos» en la pestaña pedida desde cualquier launcher', () => {
    const handler = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-data', handler);

    emitWorkspaceCommand('open-data', { tab: 'review' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ tab: 'review' });
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
    onWorkspaceCommand('open-data', handler)();
    emitWorkspaceCommand('open-data', { tab: 'results' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('no mezcla comandos distintos', () => {
    const data = vi.fn();
    const detail = vi.fn();
    const off = [
      onWorkspaceCommand('open-data', data),
      onWorkspaceCommand('open-detail', detail),
    ];
    emitWorkspaceCommand('open-detail', { segment: 'loads' });
    expect(detail).toHaveBeenCalledTimes(1);
    expect(data).not.toHaveBeenCalled();
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
