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

  it('drives materials from tokens, never from literal colors', () => {
    const { container } = render(<StructuralPortalHero />);
    for (const path of container.querySelectorAll('path.portal-hero__face')) {
      expect(path.getAttribute('fill')).toMatch(/^var\(--sc-/);
    }
  });
});
