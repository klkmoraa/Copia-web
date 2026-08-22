// @vitest-environment jsdom
import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemberModel, NodeModel } from '../../types';
import { CanvasNavigator } from './CanvasNavigator';

afterEach(cleanup);

const nodes = [
  { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
  { id: 'N2', x: 8, y: 0, support: { type: 'roller' } },
] as unknown as NodeModel[];
const members = [{ id: 'B1', i: 'N1', j: 'N2' }] as unknown as MemberModel[];

const renderNavigator = (overrides: Partial<React.ComponentProps<typeof CanvasNavigator>> = {}) => {
  const onFit = vi.fn();
  const onZoomIn = vi.fn();
  const onZoomOut = vi.fn();
  const onNavigate = vi.fn();
  const coordinateReadoutRef = createRef<HTMLOutputElement>();
  const view = render(<CanvasNavigator
    nodes={nodes}
    members={members}
    viewport={null}
    minimapLabel="Radar"
    coordinateReadoutRef={coordinateReadoutRef}
    coordinatesLabel="Coordenadas del cursor"
    lengthLabel="m"
    scale={170}
    scaleLabel="Escala"
    viewControlsLabel="Controles de cámara"
    zoomInLabel="Acercar"
    zoomOutLabel="Alejar"
    fitLabel="Ajustar modelo a la vista"
    onFit={onFit}
    onZoomIn={onZoomIn}
    onZoomOut={onZoomOut}
    onNavigate={onNavigate}
    {...overrides}
  />);
  return { ...view, onFit, onZoomIn, onZoomOut, onNavigate, coordinateReadoutRef };
};

describe('CanvasNavigator', () => {
  it('fuses the minimap, camera controls and coordinate readout into one surface', () => {
    const { container, coordinateReadoutRef } = renderNavigator();
    expect(container.querySelectorAll('[data-canvas-chrome="navigator"]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Radar' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Controles de cámara' })).toBeTruthy();
    expect(coordinateReadoutRef.current?.textContent).toContain('X — · Y — m');
    // 170 / 85 (CANVAS_REFERENCE_SCALE) = 2.00×
    expect(screen.getByText('2.00×')).toBeTruthy();
  });

  it('delegates zoom, fit and the fit-canvas workspace command', async () => {
    const user = userEvent.setup();
    const { onZoomIn, onZoomOut, onFit } = renderNavigator();

    await user.click(screen.getByRole('button', { name: 'Acercar' }));
    await user.click(screen.getByRole('button', { name: 'Alejar' }));
    await user.click(screen.getByRole('button', { name: 'Ajustar modelo a la vista' }));
    expect(onZoomIn).toHaveBeenCalledOnce();
    expect(onZoomOut).toHaveBeenCalledOnce();
    expect(onFit).toHaveBeenCalledOnce();

    window.dispatchEvent(new CustomEvent('structureco:fit-canvas'));
    expect(onFit).toHaveBeenCalledTimes(2);
  });

  it('re-frames the canvas when the minimap glyph is pressed', async () => {
    const { onFit } = renderNavigator();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Radar' }));
    expect(onFit).toHaveBeenCalledOnce();
  });
});
