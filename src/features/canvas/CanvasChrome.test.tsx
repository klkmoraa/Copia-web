// @vitest-environment jsdom
import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { CanvasChrome } from './CanvasChrome';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('CanvasChrome', () => {
  it('renders camera, mode and coordinate surfaces while delegating every command', async () => {
    const user = userEvent.setup();
    const onCancelPlacement = vi.fn();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onFit = vi.fn();
    const coordinateReadoutRef = createRef<HTMLOutputElement>();
    const { container } = render(<ProjectProvider><CanvasChrome
      modeLabel="Carga puntual"
      placementInstruction="Elige un nodo"
      showHelp
      snapEnabled
      gridEnabled={false}
      coordinateReadoutRef={coordinateReadoutRef}
      lengthLabel="m"
      scale={102}
      onCancelPlacement={onCancelPlacement}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onFit={onFit}
    /></ProjectProvider>);

    /* Cuatro, no cinco: el disparador de capas se fue con el panel flotante que
       abría. Las capas se deciden en «Vista», que es la única superficie de
       visualización — antes eran dos destinos para la misma decisión, cada uno
       con su propio almacén. */
    expect(container.querySelectorAll('[data-canvas-chrome]')).toHaveLength(4);
    expect(screen.getByText('Elige un nodo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar colocación' })).toBeTruthy();
    expect(container.querySelector('.canvas-mode-badge')?.classList.contains('placing-load')).toBe(true);
    expect(screen.getByText('SNAP activo')).toBeTruthy();
    expect(screen.getByText('GRID inactivo')).toBeTruthy();
    expect(coordinateReadoutRef.current?.textContent).toContain('X — · Y — m');

    await user.click(screen.getByRole('button', { name: 'Acercar' }));
    await user.click(screen.getByRole('button', { name: 'Alejar' }));
    await user.click(screen.getByRole('button', { name: 'Ajustar modelo a la vista' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar colocación' }));

    expect(onZoomIn).toHaveBeenCalledOnce();
    expect(onZoomOut).toHaveBeenCalledOnce();
    expect(onFit).toHaveBeenCalledOnce();
    expect(onCancelPlacement).toHaveBeenCalledOnce();

    window.dispatchEvent(new CustomEvent('structureco:fit-canvas'));
    expect(onFit).toHaveBeenCalledTimes(2);
  });
});
