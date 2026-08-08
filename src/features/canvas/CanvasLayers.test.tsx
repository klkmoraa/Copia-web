// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { CanvasLayers } from './CanvasLayers';
import { createEditorLayerState, editorLayerReducer } from './editorLayers';
import { useReducer } from 'react';

const Harness = () => {
  const [layers, dispatch] = useReducer(editorLayerReducer, undefined, createEditorLayerState);
  return <CanvasLayers layers={layers} dispatch={dispatch} />;
};

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('CanvasLayers', () => {
  it('keeps the model fixed and toggles presentation-only layers', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: /capas de información/i }));

    const model = screen.getByRole('switch', { name: /modelo.*geometría/i });
    const loads = screen.getByRole('switch', { name: /cargas.*aplicadas/i });
    expect((model as HTMLButtonElement).disabled).toBe(true);
    expect(model.getAttribute('aria-checked')).toBe('true');
    expect(loads.getAttribute('aria-checked')).toBe('true');

    await user.click(loads);
    expect(loads.getAttribute('aria-checked')).toBe('false');
    await user.click(screen.getByRole('button', { name: /restablecer capas/i }));
    expect(loads.getAttribute('aria-checked')).toBe('true');
  });

  it('closes with Escape and restores focus to its trigger', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);
    const trigger = screen.getByRole('button', { name: /capas de información/i });
    await user.click(trigger);
    expect(screen.getByRole('region', { name: /capas de información/i })).toBeTruthy();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('region', { name: /capas de información/i })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
