// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CanvasTouchLoupe } from './CanvasTouchLoupe';

afterEach(cleanup);

const renderLoupe = (overrides: Partial<Parameters<typeof CanvasTouchLoupe>[0]> = {}) => render(
  <CanvasTouchLoupe
    screenX={320}
    screenY={400}
    modelX={4.25}
    modelY={-1.5}
    lengthLabel="m"
    sceneId="canvas-scene-root"
    canvasHeight={720}
    {...overrides}
  />,
);

/** `translate(cx cy) scale(k) translate(-x -y)` → los tres pares de números. */
const lensTransform = () => {
  const group = screen.getByTestId('canvas-touch-loupe-lens').querySelector('g > g')!;
  return group.getAttribute('transform')!;
};

describe('CanvasTouchLoupe', () => {
  it('magnifies the real canvas scene instead of redrawing it', () => {
    renderLoupe();
    // La regresión: la lupa era sólo retícula y cota. Ahora clona la escena.
    const use = screen.getByTestId('canvas-touch-loupe-lens').querySelector('use')!;
    expect(use.getAttribute('href')).toBe('#canvas-scene-root');
    expect(lensTransform()).toMatch(/scale\(2\.4\)/);
  });

  it('centres the magnification on the contact point', () => {
    renderLoupe({ screenX: 320, screenY: 400 });
    // El punto tocado se lleva al centro de la lente (104 / 2 = 52).
    expect(lensTransform()).toBe('translate(52 52) scale(2.4) translate(-320 -400)');
  });

  it('clips the lens to a circle so the ampliation reads as a lens', () => {
    renderLoupe();
    const lens = screen.getByTestId('canvas-touch-loupe-lens');
    expect(lens.querySelector('clipPath circle')).not.toBeNull();
    expect(lens.querySelector('g[clip-path="url(#canvas-touch-loupe-clip)"]')).not.toBeNull();
  });

  it('keeps the coordinates the readout used to be the only thing showing', () => {
    renderLoupe();
    expect(document.querySelector('.canvas-touch-loupe-coord')?.textContent)
      .toBe('X 4.25 · Y -1.50 m');
    expect(document.querySelector('.canvas-touch-loupe-reticle')).not.toBeNull();
  });

  it('flips below the finger when the lens would fall off the top edge', () => {
    const root = () => document.querySelector('.canvas-touch-loupe')!;
    renderLoupe({ screenY: 400 });
    expect(root().getAttribute('data-placement')).toBe('above');
    cleanup();

    renderLoupe({ screenY: 30 });
    expect(root().getAttribute('data-placement')).toBe('below');
    cleanup();

    // Lienzo tan corto que no cabe por ninguno de los dos lados: se queda
    // arriba, que es donde el dedo tapa menos.
    renderLoupe({ screenY: 30, canvasHeight: 120 });
    expect(root().getAttribute('data-placement')).toBe('above');
  });

  it('stays out of the accessibility tree and out of the way of the pointer', () => {
    renderLoupe();
    const root = document.querySelector('.canvas-touch-loupe')!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.getAttribute('data-canvas-chrome')).toBe('touch-loupe');
  });
});
