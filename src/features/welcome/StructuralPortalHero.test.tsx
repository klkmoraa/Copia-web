// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StructuralPortalHero } from './StructuralPortalHero';

describe('StructuralPortalHero', () => {
  it('renders without WebGL, canvas or any external asset', () => {
    const { container } = render(<StructuralPortalHero />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('stays out of the accessible tree: it is decoration, not content', () => {
    const { container } = render(<StructuralPortalHero />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(svg?.getAttribute('role')).toBe('presentation');
  });

  it('paints one path per face of the geometry', () => {
    const { container } = render(<StructuralPortalHero />);
    expect(container.querySelectorAll('path.portal-hero__face').length).toBeGreaterThan(20);
  });

  it('reserves its box so nothing shifts while the page settles', () => {
    const { container } = render(<StructuralPortalHero />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBeTruthy();
  });

  it('confines the clay finish to one filter inside its own svg', () => {
    const { container } = render(<StructuralPortalHero />);
    const filters = container.querySelectorAll('filter');
    // Uno, y sólo uno: el coste de un filtro SVG es exactamente lo que el
    // alcance recortado de CRI-104 mantiene acotado.
    expect(filters).toHaveLength(1);
    expect(filters[0].getAttribute('id')).toBe('sc-portal-clay');
    // Grano, luz de borde y recorte a la silueta — nada más.
    expect(container.querySelector('feTurbulence')).not.toBeNull();
    expect(container.querySelector('feMorphology')).not.toBeNull();
    expect(container.querySelector('feFlood')).not.toBeNull();
  });

  it('never pins the filter to the markup: la degradación plana la decide el CSS', () => {
    const { container } = render(<StructuralPortalHero />);
    const body = container.querySelector('.portal-hero__body');
    expect(body).not.toBeNull();
    // Sin atributo `filter` en el marcado: si estuviera aquí, ninguna media
    // query de `prefers-reduced-motion` / `prefers-reduced-transparency`
    // podría apagarlo, y tampoco habría respaldo cuando el navegador no
    // resuelva `filter: url(...)`.
    expect(body?.getAttribute('filter')).toBeNull();
    // Y las caras siguen teniendo relleno propio, así que el dibujo plano
    // está completo antes de que el filtro entre en juego.
    expect(body?.querySelectorAll('path.portal-hero__face').length).toBeGreaterThan(20);
  });

  it('keeps the flood colour on a token, never on a literal', () => {
    const { container } = render(<StructuralPortalHero />);
    const flood = container.querySelector('feFlood');
    expect(flood?.getAttribute('flood-color')).toBeNull();
    expect(flood?.getAttribute('class')).toBe('portal-hero__rim');
  });

  it('drives materials from tokens, never from literal colors', () => {
    const { container } = render(<StructuralPortalHero />);
    for (const path of container.querySelectorAll('path.portal-hero__face')) {
      expect(path.getAttribute('fill')).toMatch(/^var\(--sc-/);
    }
  });
});
