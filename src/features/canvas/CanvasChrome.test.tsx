// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { CanvasChrome } from './CanvasChrome';
import { createEditorLayerState } from './editorLayers';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('CanvasChrome', () => {
  it('renders the mode badge and layers trigger, and delegates every command including snap/grid', async () => {
    const user = userEvent.setup();
    const onCancelPlacement = vi.fn();
    const onSnapChange = vi.fn();
    const onGridChange = vi.fn();
    const dispatchLayers = vi.fn();
    const { container } = render(<ProjectProvider><CanvasChrome
      modeLabel="Carga puntual"
      placementInstruction="Elige un nodo"
      showHelp
      layers={createEditorLayerState()}
      dispatchLayers={dispatchLayers}
      resultTab="moment"
      setResultTab={vi.fn()}
      snapEnabled
      gridEnabled={false}
      onSnapChange={onSnapChange}
      onGridChange={onGridChange}
      onCancelPlacement={onCancelPlacement}
    /></ProjectProvider>);

    expect(container.querySelectorAll('[data-canvas-chrome]')).toHaveLength(1);
    expect(screen.getByText('Elige un nodo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar colocación' })).toBeTruthy();
    expect(container.querySelector('.canvas-mode-badge')?.classList.contains('placing-load')).toBe(true);

    // Snap/rejilla viven dentro del popover de capas, no como chips aparte.
    await user.click(screen.getByRole('button', { name: /capas de información/i }));
    const snap = screen.getByRole('switch', { name: /snap.*activo/i });
    const grid = screen.getByRole('switch', { name: /grid.*inactivo/i });
    expect(snap.getAttribute('aria-checked')).toBe('true');
    expect(grid.getAttribute('aria-checked')).toBe('false');
    await user.click(snap);
    expect(onSnapChange).toHaveBeenCalledWith(false);
    await user.click(grid);
    expect(onGridChange).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Cancelar colocación' }));
    expect(onCancelPlacement).toHaveBeenCalledOnce();
  });
});
