// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { emitWorkspaceCommand } from './workspaceCommands';
import { ToastNotification } from './ToastNotification';

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const renderToasts = () => render(<ProjectProvider><ToastNotification /></ProjectProvider>);

const region = () => screen.getByRole('region', { name: /Notificaciones/i });
const cards = () => [...region().querySelectorAll('.sc-toast-card')];

describe('ToastNotification', () => {
  it('tiene la región viva ANTES de que llegue el primer aviso', () => {
    // Una región viva sólo anuncia lo que cambia DENTRO de ella. Cada tarjeta
    // traía su propio `role="status" aria-live="polite"` y entraba en el
    // documento a la vez que su texto: la región y su contenido nacían en la
    // misma mutación, que es el caso que los lectores de pantalla no leen. Los
    // avisos del producto eran, con toda probabilidad, mudos.
    renderToasts();
    const live = region();
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(cards()).toHaveLength(0);
  });

  it('shows a toast when a show-toast command is emitted and announces it politely', async () => {
    renderToasts();

    emitWorkspaceCommand('show-toast', { message: 'Exportación lista', description: 'Viga simplemente apoyada', tone: 'success' });

    await waitFor(() => expect(cards()).toHaveLength(1));
    expect(region().textContent).toContain('Exportación lista');
    expect(region().textContent).toContain('Viga simplemente apoyada');
  });

  it('dismisses a toast when its close button is clicked', async () => {
    const user = userEvent.setup();
    renderToasts();

    emitWorkspaceCommand('show-toast', { message: 'Copiado', tone: 'success', durationMs: 0 });
    await waitFor(() => expect(cards()).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: /Cerrar notificación/i }));

    await waitFor(() => expect(cards()).toHaveLength(0));
  });

  it('caps concurrent toasts at 4, dropping the oldest', async () => {
    renderToasts();

    for (let index = 0; index < 5; index += 1) {
      emitWorkspaceCommand('show-toast', { message: `Toast ${index}`, tone: 'info', durationMs: 0 });
    }

    await waitFor(() => expect(cards()).toHaveLength(4));
    expect(screen.queryByText('Toast 0')).toBeNull();
    expect(screen.getByText('Toast 4')).toBeTruthy();
  });

  it('no deja temporizadores vivos al desmontar la mesa', () => {
    vi.useFakeTimers();
    const view = renderToasts();
    emitWorkspaceCommand('show-toast', { message: 'Se va a desmontar', tone: 'info', durationMs: 3200 });
    view.unmount();
    // El `setTimeout` de retirada no se guardaba en ningún sitio, así que
    // seguía vivo apuntando a un `setState` de un componente ya desmontado.
    expect(() => vi.runOnlyPendingTimers()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
