// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  STRUCTURAL_ASSET_REGISTRY,
  STRUCTURAL_ASSET_IDS,
  StructuralIllustration,
  getStructuralAsset,
  type StructuralAssetFamily,
} from './index';

const EXPECTED_VARIANTS = {
  portal: ['single-bay', 'two-bay', 'two-story', 'industrial-pitched'],
  beam: ['simply-supported', 'two-span', 'three-span', 'overhang'],
  cantilever: ['wall', 'double', 'stepped', 'balcony'],
  truss: ['pratt', 'howe', 'warren', 'king-post'],
  slab: ['one-way', 'two-way', 'waffle', 'flat-slab'],
  'space-frame': ['single-module', 'multi-bay', 'two-story', 'industrial-shed'],
  support: ['pin', 'roller', 'fixed', 'spring'],
  load: ['point', 'distributed', 'varying', 'applied-moment'],
  section: ['rectangular', 'circular', 'i-profile', 'box'],
  connection: ['rigid', 'pinned', 'base-plate', 'splice'],
} as const satisfies Readonly<Record<StructuralAssetFamily, readonly string[]>>;

const allPresets = () => STRUCTURAL_ASSET_REGISTRY;

afterEach(cleanup);

describe('STRUCTURAL_ASSET_REGISTRY', () => {
  it('contains exactly the contracted ten families and four variants per family', () => {
    expect([...new Set(STRUCTURAL_ASSET_REGISTRY.map((preset) => preset.family))]).toEqual(
      Object.keys(EXPECTED_VARIANTS),
    );

    for (const [family, expectedVariants] of Object.entries(EXPECTED_VARIANTS)) {
      const presets = STRUCTURAL_ASSET_REGISTRY.filter((preset) => preset.family === family);
      expect(presets.map((preset) => preset.variant)).toEqual(expectedVariants);
    }

    expect(allPresets()).toHaveLength(40);
  });

  it('assigns every preset a stable and globally unique semantic id', () => {
    const ids = allPresets().map((preset) => preset.id);
    expect(new Set(ids).size).toBe(40);
    for (const preset of allPresets()) {
      expect(preset.id).toBe(`${preset.family}:${preset.variant}`);
    }
  });

  it('publishes ids in registry order and resolves known assets without cloning them', () => {
    expect(STRUCTURAL_ASSET_IDS).toEqual(STRUCTURAL_ASSET_REGISTRY.map((asset) => asset.id));
    expect(getStructuralAsset('portal:single-bay')).toBe(STRUCTURAL_ASSET_REGISTRY[0]);
    expect(getStructuralAsset('missing:asset')).toBeUndefined();
    expect(STRUCTURAL_ASSET_REGISTRY[0]).toMatchObject({
      id: 'portal:single-bay',
      family: 'portal',
      variant: 'single-bay',
      label: 'Single-bay portal frame',
      material: 'concrete',
    });
  });
});

describe('StructuralIllustration', () => {
  it('renders the same preset deterministically', () => {
    const assetId = 'portal:two-story';
    const first = renderToStaticMarkup(<StructuralIllustration assetId={assetId} detail="hero" />);
    const second = renderToStaticMarkup(<StructuralIllustration assetId={assetId} detail="hero" />);
    expect(second).toBe(first);
  });

  it('renders forty recognizable geometry signatures instead of relabeling one drawing', () => {
    const signatures = allPresets().map((preset) => {
      const { container, unmount } = render(<StructuralIllustration assetId={preset.id} />);
      const geometry = container.querySelector('[data-structural-geometry]');
      const signature = geometry?.innerHTML;
      unmount();
      return signature;
    });

    expect(signatures.every(Boolean)).toBe(true);
    expect(new Set(signatures).size).toBe(40);
  });

  it('uses canonical Pratt and Howe diagonal orientation around the centre', () => {
    const pathsFor = (assetId: string) => {
      const { container, unmount } = render(<StructuralIllustration assetId={assetId} />);
      const paths = [...container.querySelectorAll('[data-element="web"]')].map((path) => path.getAttribute('d'));
      unmount();
      return paths;
    };

    expect(pathsFor('truss:pratt')).toEqual(expect.arrayContaining([
      'M50 58 85 118', 'M85 58 120 118', 'M190 58 155 118', 'M155 58 120 118',
    ]));
    expect(pathsFor('truss:howe')).toEqual(expect.arrayContaining([
      'M50 118 85 58', 'M85 118 120 58', 'M190 118 155 58', 'M155 118 120 58',
    ]));
  });

  it('builds every portal hero from matte planes and restrained connection accents', () => {
    for (const assetId of ['portal:single-bay', 'portal:two-bay', 'portal:two-story', 'portal:industrial-pitched']) {
      const { container, unmount } = render(<StructuralIllustration assetId={assetId} detail="hero" />);
      expect(container.querySelectorAll('[data-element="surface"]').length, assetId).toBeGreaterThanOrEqual(6);
      expect(container.querySelector(`[fill="${'var(--structural-asset-accent, currentColor)'}"]`), assetId).not.toBeNull();
      unmount();
    }
  });

  it('uses projected structural solids for the architectural thumbnail families', () => {
    const projectedFamilies = ['portal:single-bay', 'beam:simply-supported', 'cantilever:wall', 'truss:pratt'];
    for (const assetId of projectedFamilies) {
      const { container, unmount } = render(<StructuralIllustration assetId={assetId} detail="card" />);
      expect(container.querySelectorAll('[data-element="surface"]').length, assetId).toBeGreaterThanOrEqual(3);
      if (!assetId.startsWith('portal:')) {
        expect(container.querySelector('[data-element="prismatic-member"]'), assetId).not.toBeNull();
      }
      unmount();
    }
  });

  it('keeps every SVG transparent and free of raster, filters, gradients and network references', () => {
    for (const preset of allPresets()) {
      const markup = renderToStaticMarkup(<StructuralIllustration assetId={preset.id} />);
      expect(markup).not.toMatch(/<(?:rect|image|filter|linearGradient|radialGradient|foreignObject)\b/i);
      expect(markup).not.toMatch(/(?:href|src)=["'](?:https?:|data:)/i);
      expect(markup).not.toMatch(/url\(/i);
    }
  });

  it('paints through CSS variables with currentColor fallbacks for day and night inheritance', () => {
    const { container } = render(
      <StructuralIllustration assetId="truss:pratt" />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('structural-illustration--theme-aware')).toBe(true);
    expect(svg?.getAttribute('data-material')).toBe('steel');

    for (const element of container.querySelectorAll('[fill], [stroke]')) {
      for (const attribute of ['fill', 'stroke'] as const) {
        const value = element.getAttribute(attribute);
        if (value === null || value === 'none') continue;
        expect(value).toMatch(/^var\(--structural-asset-[\w-]+, currentColor\)$/);
      }
    }
  });

  it('exposes family, variant, detail and geometry hooks without leaking implementation ids', () => {
    const preset = getStructuralAsset('load:varying')!;
    const { container } = render(<StructuralIllustration assetId={preset.id} detail="card" />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('data-structural-asset-id')).toBe(preset.id);
    expect(svg?.getAttribute('data-family')).toBe('load');
    expect(svg?.getAttribute('data-variant')).toBe('varying');
    expect(svg?.getAttribute('data-detail')).toBe('card');
    expect(svg?.querySelector('[data-structural-geometry="load:varying"]')).not.toBeNull();
    expect(svg?.querySelector('[id]')).toBeNull();
  });

  it('supports hero, card and compact detail while reducing secondary geometry in compact mode', () => {
    const preset = getStructuralAsset('space-frame:multi-bay')!;
    const detailCounts = (['hero', 'card', 'compact'] as const).map((detail) => {
      const { container, unmount } = render(<StructuralIllustration assetId={preset.id} detail={detail} />);
      const svg = container.querySelector('svg');
      const count = container.querySelectorAll('[data-asset-detail]').length;
      expect(svg?.getAttribute('data-detail')).toBe(detail);
      unmount();
      return count;
    });

    expect(detailCounts[0]).toBeGreaterThan(detailCounts[1]);
    expect(detailCounts[1]).toBeGreaterThan(detailCounts[2]);
  });

  it('is decorative and unfocusable by default', () => {
    const { container } = render(<StructuralIllustration assetId="beam:simply-supported" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(svg?.getAttribute('role')).toBe('presentation');
    expect(svg?.querySelector('title')).toBeNull();
  });

  it('becomes a labelled image only when explicitly presented as content', () => {
    const { container } = render(
      <StructuralIllustration
        assetId="connection:rigid"
        decorative={false}
        title="Rigid beam-to-column connection"
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.hasAttribute('aria-hidden')).toBe(false);
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Rigid beam-to-column connection');
    expect(svg?.querySelector('title')?.textContent).toBe('Rigid beam-to-column connection');
  });

  it('falls back to the registry label when a semantic title is empty', () => {
    const { container } = render(
      <StructuralIllustration assetId="connection:rigid" decorative={false} title="   " />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('Rigid connection');
    expect(svg?.querySelector('title')?.textContent).toBe('Rigid connection');
  });

  it('publishes motion metadata with a static reduced-motion fallback', () => {
    const { container } = render(
      <StructuralIllustration assetId="portal:single-bay" detail="hero" />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('data-motion')).toBe('settle');
    expect(svg?.getAttribute('data-reduced-motion')).toBe('static');
    expect(svg?.classList.contains('structural-illustration--motion-safe')).toBe(true);
  });
});
