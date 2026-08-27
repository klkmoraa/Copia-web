// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveStructuralAssetUrl, ThreeStructuralImage } from './ThreeStructuralImage';

afterEach(cleanup);

describe('ThreeStructuralImage', () => {
  it('resolves the generated asset under a nested Sites app base', () => {
    expect(resolveStructuralAssetUrl('portal:two-story', 'day', '/app/')).toBe('/app/assets/structural/day/portal/two-story.png');
    expect(resolveStructuralAssetUrl('portal:two-story', 'night', './')).toBe('./assets/structural/night/portal/two-story.png');
  });

  it('selects the generated transparent render for the active theme', () => {
    const { container, rerender } = render(<ThreeStructuralImage assetId="portal:two-story" theme="light" alt="Pórtico de dos niveles" eager />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/structural/day/portal/two-story.png');
    expect(container.querySelector('img')?.getAttribute('data-structural-render')).toBe('three-prerender');
    rerender(<ThreeStructuralImage assetId="portal:two-story" theme="dark" alt="Pórtico de dos niveles" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/structural/night/portal/two-story.png');
  });

  it('routes non-portal families to their generated Three.js render folders', () => {
    const { container, rerender } = render(<ThreeStructuralImage assetId="truss:warren" theme="light" alt="Armadura Warren" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/structural/day/truss/warren.png');
    rerender(<ThreeStructuralImage assetId="slab:waffle" theme="dark" alt="Losa reticular" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/structural/night/slab/waffle.png');
  });

  it('routes every new Three.js family to its transparent render folder', () => {
    const cases = [
      ['space-frame:industrial-shed', 'day/space-frame/industrial-shed.png'],
      ['support:spring', 'day/support/spring.png'],
      ['load:applied-moment', 'day/load/applied-moment.png'],
      ['section:box', 'day/section/box.png'],
      ['connection:base-plate', 'day/connection/base-plate.png'],
    ] as const;
    for (const [assetId, suffix] of cases) {
      const { unmount, container } = render(<ThreeStructuralImage assetId={assetId} theme="light" alt={assetId} />);
      expect(container.querySelector('img')?.getAttribute('src')).toBe(`/assets/structural/${suffix}`);
      unmount();
    }
  });

  it('falls back to the editable SVG when the generated image cannot load', () => {
    const { container } = render(<ThreeStructuralImage assetId="portal:single-bay" theme="light" alt="Pórtico sencillo" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('svg[data-structural-asset-id="portal:single-bay"]')).not.toBeNull();
  });
});
