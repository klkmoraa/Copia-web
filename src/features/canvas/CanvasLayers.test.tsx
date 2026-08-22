// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider, type ResultTab } from '../../store/ProjectContext';
import { CanvasLayers } from './CanvasLayers';
import { createEditorLayerState, editorLayerReducer } from './editorLayers';
import { useReducer, useState } from 'react';

const Harness = ({ onSnapChange = vi.fn(), onGridChange = vi.fn() }: { onSnapChange?: (snap: boolean) => void; onGridChange?: (grid: boolean) => void }) => {
  const [layers, dispatch] = useReducer(editorLayerReducer, undefined, createEditorLayerState);
  const [resultTab, setResultTab] = useState<ResultTab>('moment');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridEnabled, setGridEnabled] = useState(false);
  return <CanvasLayers
    layers={layers}
    dispatch={dispatch}
    resultTab={resultTab}
    setResultTab={setResultTab}
    snapEnabled={snapEnabled}
    gridEnabled={gridEnabled}
    onSnapChange={(snap) => { setSnapEnabled(snap); onSnapChange(snap); }}
    onGridChange={(grid) => { setGridEnabled(grid); onGridChange(grid); }}
  />;
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

  it('makes snap and grid real, interactive switches instead of inert chips', async () => {
    const user = userEvent.setup();
    const onSnapChange = vi.fn();
    const onGridChange = vi.fn();
    render(<ProjectProvider><Harness onSnapChange={onSnapChange} onGridChange={onGridChange} /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: /capas de información/i }));

    const snap = screen.getByRole('switch', { name: /snap.*activo/i });
    const grid = screen.getByRole('switch', { name: /grid.*inactivo/i });
    expect(snap.getAttribute('aria-checked')).toBe('true');
    expect(grid.getAttribute('aria-checked')).toBe('false');

    await user.click(grid);
    expect(onGridChange).toHaveBeenCalledWith(true);
    await user.click(snap);
    expect(onSnapChange).toHaveBeenCalledWith(false);
  });

  it('closes with Escape and restores focus to its trigger', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);
    const trigger = screen.getByRole('button', { name: /capas de información/i });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: /capas de información/i })).toBeTruthy();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: /capas de información/i })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('turns evidence into a canvas layer instead of a panel (CRI-100)', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: /capas de información/i }));

    const axial = screen.getByRole('button', { name: 'Axial' });
    const shear = screen.getByRole('button', { name: 'Cortante' });
    const results = screen.getByRole('switch', { name: /resultados.*diagramas/i });
    const heatmap = screen.getByRole('button', { name: 'Mapa de demanda' });

    // Off by default: the `results` fixture in this suite has no analysis to show.
    expect(axial.getAttribute('aria-pressed')).toBe('false');

    await user.click(shear);
    expect(shear.getAttribute('aria-pressed')).toBe('true');
    expect(axial.getAttribute('aria-pressed')).toBe('false');
    expect(results.getAttribute('aria-checked')).toBe('true');

    // Picking the same evidence again turns the layer off, same as any toggle.
    await user.click(shear);
    expect(shear.getAttribute('aria-pressed')).toBe('false');

    expect(heatmap.getAttribute('aria-pressed')).toBe('false');
    await user.click(heatmap);
    expect(heatmap.getAttribute('aria-pressed')).toBe('true');
  });
});
