// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemberModel, NodeModel } from '../../types';
import { CanvasMiniMap } from './CanvasMiniMap';

afterEach(cleanup);

const nodes = [
  { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
  { id: 'N2', x: 8, y: 0, support: { type: 'roller' } },
  { id: 'N3', x: 8, y: 5, support: { type: 'none' } },
] as unknown as NodeModel[];

const members = [
  { id: 'B1', i: 'N1', j: 'N2' },
  { id: 'B2', i: 'N2', j: 'N3' },
  { id: 'B3', i: 'N2', j: 'N9' },
] as unknown as MemberModel[];

const renderMiniMap = (
  viewport: { minX: number; minY: number; maxX: number; maxY: number } | null,
  onFit = vi.fn(),
  onNavigate = vi.fn(),
) => {
  const view = render(<CanvasMiniMap nodes={nodes} members={members} viewport={viewport} label="Radar" onFit={onFit} onNavigate={onNavigate} />);
  return { ...view, onFit, onNavigate };
};

describe('CanvasMiniMap', () => {
  it('stamps every node and every drawable member', () => {
    renderMiniMap(null);
    expect(document.querySelectorAll('.canvas-minimap-nodes circle')).toHaveLength(3);
    // B3 apunta a un nudo inexistente: se omite en vez de dibujar una línea a NaN.
    expect(document.querySelectorAll('.canvas-minimap-members line')).toHaveLength(2);
  });

  it('frames the visible rectangle inside the stamp', () => {
    renderMiniMap({ minX: 0, minY: 0, maxX: 4, maxY: 2.5 });
    const frame = document.querySelector('.canvas-minimap-viewport')!;
    expect(frame).not.toBeNull();
    const width = Number(frame.getAttribute('width'));
    const height = Number(frame.getAttribute('height'));
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    // Media estructura a lo ancho ⇒ el recuadro no puede cubrir el radar entero.
    expect(width).toBeLessThan(120);
    expect(height).toBeLessThan(80);
  });

  it('drops the frame when the whole model is already on screen', () => {
    // Un recuadro que cubre el radar no informa de nada: sólo estorba.
    renderMiniMap({ minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 });
    expect(document.querySelector('.canvas-minimap-viewport')).toBeNull();
  });

  it('falls back to framing the canvas when a click carries no usable pointer geometry', async () => {
    // jsdom no implementa SVGSVGElement.getScreenCTM(): un clic real cae al
    // mismo camino que el teclado. El comportamiento en un navegador real se
    // cubre con la verificación visual de Playwright, no aquí.
    const { onFit, onNavigate } = renderMiniMap(null);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Radar' }));
    expect(onFit).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('frames the canvas on a keyboard activation instead of navigating to (0,0)', async () => {
    const { onFit, onNavigate } = renderMiniMap(null);
    const trigger = screen.getByRole('button', { name: 'Radar' });
    trigger.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(onFit).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('renders nothing at all when there is no model to stamp', () => {
    const { container } = render(<CanvasMiniMap nodes={[]} members={[]} viewport={null} label="Radar" onFit={vi.fn()} onNavigate={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
