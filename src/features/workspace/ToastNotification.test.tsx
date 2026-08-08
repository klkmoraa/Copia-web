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

describe('ToastNotification', () => {
  it('shows a toast when a show-toast command is emitted and announces it politely', async () => {
    renderToasts();

    emitWorkspaceCommand('show-toast', { message: 'Exportación lista', description: 'Viga simplemente apoyada', tone: 'success' });

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Exportación lista');
    expect(status.textContent).toContain('Viga simplemente apoyada');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('dismisses a toast when its close button is clicked', async () => {
    const user = userEvent.setup();
    renderToasts();

    emitWorkspaceCommand('show-toast', { message: 'Copiado', tone: 'success', durationMs: 0 });
    await screen.findByRole('status');

    await user.click(screen.getByRole('button', { name: /Cerrar notificación/i }));

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('caps concurrent toasts at 4, dropping the oldest', async () => {
    renderToasts();

    for (let index = 0; index < 5; index += 1) {
      emitWorkspaceCommand('show-toast', { message: `Toast ${index}`, tone: 'info', durationMs: 0 });
    }

    await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(4));
    expect(screen.queryByText('Toast 0')).toBeNull();
    expect(screen.getByText('Toast 4')).toBeTruthy();
  });
});
